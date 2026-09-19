-- Secret Table — Realtime sürüm bildirimi (C03).
--
-- Kanal: oda başına özel `room:<roomId>`. Taşınan tek sinyal `{roomId, revision}`.
-- Tam durum, rol, kart, oy veya oturum anahtarı kanala GİRMEZ. Bildirimi DB üretir;
-- istemciye Broadcast gönderme yetkisi verilmez. İstemci sinyalden sonra yetkili
-- görünümü HTTP'den yeniden alır (docs/DEPLOYMENT.md bölüm 4).

-- `public.notify_room_revision` 0002_functions.sql'de tanımlıdır (commit_move
-- ondan önce çağırdığı için). Burada tetikleyici ve kanal RLS'i eklenir.

-- game_states değişiminde de sinyal (commit_move dışında bir yol durumu
-- değiştirirse yine bildirilsin).
create or replace function public.game_states_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.notify_room_revision(new.room_id, new.revision);
  return new;
end;
$$;

drop trigger if exists game_states_revision_notify on public.game_states;
create trigger game_states_revision_notify
  after insert or update of revision on public.game_states
  for each row
  execute function public.game_states_notify();

-- Özel kanala abonelik yetkisi: kullanıcı yalnız üyesi olduğu odanın kanalına
-- abone olabilir. `realtime.messages` üzerinde RLS Supabase tarafından zaten
-- açıktır ve tablo sahibi platformdur; migration rolü `enable row level security`
-- çalıştıramaz. Politikayı sahiplik gerektirmeden eklemeyi dene, olmazsa atla
-- (C06'da dashboard/SQL editöründen uygulanır).
do $$
begin
  execute $pol$
    drop policy if exists room_channel_read on realtime.messages;
  $pol$;
  execute $pol$
    create policy room_channel_read on realtime.messages
      for select to authenticated
      using (
        realtime.messages.extension = 'broadcast'
        and exists (
          select 1
          from public.room_members m
          join public.rooms r on r.id = m.room_id
          where m.user_id = (select auth.uid())
            and realtime.topic() = 'room:' || r.id::text
        )
      );
  $pol$;
exception when insufficient_privilege then
  raise notice 'room_channel_read politikası atlandı (yetki yok); C06''da elle uygulanacak.';
end $$;

-- İstemci bu kanala Broadcast GÖNDEREMEZ (insert politikası yok).
