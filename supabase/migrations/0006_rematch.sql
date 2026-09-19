-- Secret Table — bitmiş oyundan doğrudan yeniden başlatma (QA-R01).
--
-- Sorun: `start_game` (0002_functions.sql) yalnız `status = 'lobby'` satırını kabul
-- eder. Bir oyun bitince oda `status = 'in_game'` kalır; sonuç ekranındaki "Yeniden
-- oyna" düğmesi `play_again` → `start_game` çağırır, güncelleme 0 satır etkiler ve
-- fonksiyon `raise exception` ile döner → API `500 SERVICE_UNAVAILABLE`.
--
-- Çözüm: UYGULANMIŞ 0002 DEĞİŞTİRİLMEZ. Ayrı, yetkili ve atomik bir geçiş RPC'si
-- eklenir. `restart_finished_game`:
--   * oda satırını `for update` ile kilitler (eşzamanlı başlat/yeniden-başlat serileşir);
--   * yalnız `status = 'lobby'` VEYA DB'de kayıtlı oyun durumu `phase.kind = 'game_over'`
--     iken geçişe izin verir — **devam eden (bitmemiş) oyun asla sıfırlanamaz**;
--   * oda durumunu + `game_id`'yi günceller ve yeni ilk durumu yazar (tek transaction);
--   * eski oyunun `processed_commands` satırlarını temizler (yeni `command_key`'ler
--     zaten `game_id` taşıdığı için çakışma yoktu; bu yalnız birikmeyi önler).
-- Sürüm sinyali `game_states_revision_notify` tetikleyicisinden gelir (0003).

create or replace function public.restart_finished_game(
  p_room_id uuid,
  p_game_id uuid,
  p_state jsonb,
  p_revision integer
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms;
  v_state public.game_states;
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found then
    raise exception 'restart_finished_game: oda yok (%).', p_room_id;
  end if;

  if v_room.status = 'in_game' then
    -- Devam eden oyun korunur: yalnız kayıtlı durum game_over ise yeniden başlat.
    select * into v_state from public.game_states where room_id = p_room_id for update;
    if not found or coalesce(v_state.state #>> '{phase,kind}', '') <> 'game_over' then
      raise exception 'restart_finished_game: oyun sürüyor, sıfırlanamaz (%).', p_room_id
        using errcode = 'check_violation';
    end if;
  elsif v_room.status <> 'lobby' then
    raise exception 'restart_finished_game: oda uygun durumda değil (% / %).',
      p_room_id, v_room.status;
  end if;

  update public.rooms
    set status = 'in_game', game_id = p_game_id, status_changed_at = now()
    where id = p_room_id;

  insert into public.game_states (room_id, game_id, revision, state)
  values (p_room_id, p_game_id, p_revision, p_state)
  on conflict (room_id) do update
    set game_id = excluded.game_id,
        revision = excluded.revision,
        state = excluded.state,
        state_version = 1,
        updated_at = now();

  delete from public.processed_commands
    where room_id = p_room_id and game_id <> p_game_id;
end;
$$;

-- EXECUTE yalnız service_role (0002/0004 ile aynı ilke; otomatik izinlere güvenme).
revoke all on function public.restart_finished_game(uuid, uuid, jsonb, integer)
  from public, anon, authenticated;
grant execute on function public.restart_finished_game(uuid, uuid, jsonb, integer)
  to service_role;

notify pgrst, 'reload schema';
