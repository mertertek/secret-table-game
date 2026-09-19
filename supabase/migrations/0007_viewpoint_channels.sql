-- Ephemeral head direction: identity is the authorized topic, NEVER payload.playerId.
-- Game scope prevents a previous game's cached channel from affecting its rematch.
-- Realtime authorization is cached until join/token renewal; this is presentation only.
create or replace function public.can_use_viewpoint_topic(p_topic text, p_write boolean)
returns boolean language plpgsql security definer stable set search_path = '' as $$
declare parts text[]; rid uuid; gid uuid; pid uuid;
begin
  if p_topic !~ '^room:[0-9a-fA-F-]{36}:viewpoint:[0-9a-fA-F-]{36}:[0-9a-fA-F-]{36}$' then return false; end if;
  parts := string_to_array(p_topic, ':');
  begin rid := parts[2]::uuid; gid := parts[4]::uuid; pid := parts[5]::uuid;
  exception when invalid_text_representation then return false; end;
  return exists (
    select 1 from public.rooms r
    join public.room_members actor on actor.room_id = r.id and actor.player_id = pid and actor.status = 'active'
    join public.room_members viewer on viewer.room_id = r.id and viewer.user_id = (select auth.uid()) and viewer.status = 'active'
    where r.id = rid and r.game_id = gid and r.status = 'in_game'
      and (not p_write or actor.user_id = (select auth.uid()))
  );
end $$;
revoke all on function public.can_use_viewpoint_topic(text, boolean) from public, anon;
grant execute on function public.can_use_viewpoint_topic(text, boolean) to authenticated, service_role;

drop policy if exists viewpoint_channel_read on realtime.messages;
create policy viewpoint_channel_read on realtime.messages for select to authenticated
using (extension = 'broadcast' and public.can_use_viewpoint_topic((select realtime.topic()), false));
drop policy if exists viewpoint_channel_write on realtime.messages;
create policy viewpoint_channel_write on realtime.messages for insert to authenticated
with check (extension = 'broadcast' and public.can_use_viewpoint_topic((select realtime.topic()), true));
-- Existing room:<id> SELECT remains; no client INSERT policy can match that topic.
notify pgrst, 'reload schema';
