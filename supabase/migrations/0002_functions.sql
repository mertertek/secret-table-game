-- Secret Table — sunucuya özel işlevler (C03).
-- Hepsi SECURITY DEFINER; atomik. İstemci anahtarına EXECUTE verilmez
-- (yalnız Vercel Functions'ın service_role anahtarı çağırır). Yüksek yetkili
-- anahtar kullanıcı yetkisini otomatik uygulamaz: API kimlik/üyelik doğrular.

-- ---------------------------------------------------------------------------
-- notify_room_revision — Realtime sürüm sinyali (gizli alan içermez).
--   commit_move ve start_game bunu çağırır. Kanal ayrıntısı 0003_realtime.sql.
-- ---------------------------------------------------------------------------
create or replace function public.notify_room_revision(
  p_room_id uuid,
  p_revision integer
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform realtime.send(
    jsonb_build_object('roomId', p_room_id, 'revision', p_revision),
    'room_revision_changed',
    'room:' || p_room_id::text,
    true
  );
exception when undefined_function or undefined_table then
  -- realtime şeması yoksa (ör. saf pgTAP testi) sinyal atlanır; durum yazımı bozulmaz.
  null;
end;
$$;

-- ---------------------------------------------------------------------------
-- create_room(host + koltuk 0) — tek işlem
-- ---------------------------------------------------------------------------
create or replace function public.create_room(
  p_room_id uuid,
  p_invite_code text,
  p_host_user_id uuid,
  p_host_player_id uuid,
  p_host_display_name text,
  p_reconnect_seconds integer
) returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms;
begin
  insert into public.rooms (id, invite_code, host_user_id, reconnect_seconds)
  values (p_room_id, p_invite_code, p_host_user_id, p_reconnect_seconds)
  returning * into v_room;

  insert into public.room_members (room_id, user_id, player_id, seat_index, display_name)
  values (p_room_id, p_host_user_id, p_host_player_id, 0, p_host_display_name);

  return v_room;
end;
$$;

-- ---------------------------------------------------------------------------
-- join_room — doluluk/üyelik yarışı yaratmayacak biçimde koltuk atar
-- ---------------------------------------------------------------------------
create or replace function public.join_room(
  p_room_id uuid,
  p_user_id uuid,
  p_player_id uuid,
  p_display_name text,
  p_max_players integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms;
  v_member public.room_members;
  v_seat integer;
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found then
    return jsonb_build_object('status', 'room_not_found', 'member', null);
  end if;

  select * into v_member from public.room_members
    where room_id = p_room_id and user_id = p_user_id;
  if found then
    update public.room_members
      set status = 'active', display_name = p_display_name
      where room_id = p_room_id and user_id = p_user_id
      returning * into v_member;
    return jsonb_build_object('status', 'ok', 'member', to_jsonb(v_member));
  end if;

  if v_room.status <> 'lobby' then
    return jsonb_build_object('status', 'already_started', 'member', null);
  end if;

  select count(*) into v_seat from public.room_members where room_id = p_room_id;
  if v_seat >= p_max_players then
    return jsonb_build_object('status', 'room_full', 'member', null);
  end if;

  insert into public.room_members (room_id, user_id, player_id, seat_index, display_name)
  values (p_room_id, p_user_id, p_player_id, v_seat, p_display_name)
  returning * into v_member;

  return jsonb_build_object('status', 'ok', 'member', to_jsonb(v_member));
end;
$$;

-- ---------------------------------------------------------------------------
-- start_game — oda lobiden çıkar, ilk durum yazılır (tek işlem)
-- ---------------------------------------------------------------------------
create or replace function public.start_game(
  p_room_id uuid,
  p_game_id uuid,
  p_state jsonb,
  p_revision integer
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.rooms
    set status = 'in_game', game_id = p_game_id, status_changed_at = now()
    where id = p_room_id and status = 'lobby';
  if not found then
    raise exception 'start_game: oda lobide değil (%).', p_room_id;
  end if;

  insert into public.game_states (room_id, game_id, revision, state)
  values (p_room_id, p_game_id, p_revision, p_state)
  on conflict (room_id) do update
    set game_id = excluded.game_id,
        revision = excluded.revision,
        state = excluded.state,
        state_version = 1,
        updated_at = now();
end;
$$;

-- ---------------------------------------------------------------------------
-- commit_move — atomik CAS: tekrar kontrolü + sürüm kontrolü + yazım + sinyal
--   (docs/DEPLOYMENT.md bölüm 3)
-- ---------------------------------------------------------------------------
create or replace function public.commit_move(
  p_room_id uuid,
  p_game_id uuid,
  p_command_key text,
  p_user_id uuid,
  p_request_digest text,
  p_expected_revision integer,
  p_next_state jsonb,
  p_next_revision integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.processed_commands;
  v_current public.game_states;
begin
  -- Durum satırını kilitle: eşzamanlı hamleleri seri hale getirir.
  select * into v_current from public.game_states where room_id = p_room_id for update;
  if not found then
    return jsonb_build_object('status', 'version_conflict');
  end if;

  -- Tekrar komut kontrolü (kilit altında).
  select * into v_existing from public.processed_commands
    where room_id = p_room_id and command_key = p_command_key;
  if found then
    if v_existing.request_digest <> p_request_digest then
      return jsonb_build_object('status', 'duplicate_digest_mismatch');
    end if;
    return jsonb_build_object('status', 'duplicate',
                             'result_revision', v_existing.result_revision);
  end if;

  if v_current.revision <> p_expected_revision then
    return jsonb_build_object('status', 'version_conflict');
  end if;

  update public.game_states
    set state = p_next_state, revision = p_next_revision, updated_at = now()
    where room_id = p_room_id;

  insert into public.processed_commands
    (room_id, game_id, command_key, user_id, request_digest, result_revision)
  values
    (p_room_id, p_game_id, p_command_key, p_user_id, p_request_digest, p_next_revision);

  -- Sürüm sinyali (gizli alan içermez). Aynı işlemde; geri alınırsa gönderilmez.
  perform public.notify_room_revision(p_room_id, p_next_revision);

  return jsonb_build_object('status', 'ok');
end;
$$;

-- ---------------------------------------------------------------------------
-- Oturum / yeniden bağlanma
-- ---------------------------------------------------------------------------
create or replace function public.touch_session(
  p_room_id uuid,
  p_user_id uuid,
  p_now timestamptz
) returns public.player_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.player_sessions;
begin
  insert into public.player_sessions (room_id, user_id, last_seen_at)
  values (p_room_id, p_user_id, p_now)
  on conflict (room_id, user_id) do update set last_seen_at = excluded.last_seen_at
  returning * into v_session;
  return v_session;
end;
$$;

create or replace function public.bump_session_generation(
  p_room_id uuid,
  p_user_id uuid,
  p_now timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_generation integer;
begin
  insert into public.player_sessions (room_id, user_id, session_generation, last_seen_at)
  values (p_room_id, p_user_id, 1, p_now)
  on conflict (room_id, user_id) do update
    set session_generation = public.player_sessions.session_generation + 1,
        last_seen_at = excluded.last_seen_at
  returning session_generation into v_generation;
  return jsonb_build_object('session_generation', v_generation);
end;
$$;

-- ---------------------------------------------------------------------------
-- EXECUTE ayrıcalıkları
--   Postgres varsayılanı: her fonksiyonun EXECUTE'u PUBLIC'e verilir; anon/
--   authenticated bunu PUBLIC'ten miras alır. Bu yüzden PUBLIC'ten de geri
--   alınır. Tüm çağrılar Vercel API üzerinden service_role ile yapılır; hiçbir
--   RPC istemciye açık değildir (docs/DEPLOYMENT.md bölüm 2).
-- ---------------------------------------------------------------------------
do $$
declare
  fn text;
  fns text[] := array[
    'public.notify_room_revision(uuid, integer)',
    'public.create_room(uuid, text, uuid, uuid, text, integer)',
    'public.join_room(uuid, uuid, uuid, text, integer)',
    'public.start_game(uuid, uuid, jsonb, integer)',
    'public.commit_move(uuid, uuid, text, uuid, text, integer, jsonb, integer)',
    'public.touch_session(uuid, uuid, timestamptz)',
    'public.bump_session_generation(uuid, uuid, timestamptz)'
  ];
begin
  foreach fn in array fns loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end $$;
