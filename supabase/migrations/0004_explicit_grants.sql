-- Secret Table — açık ayrıcalıklar + özel Realtime kanal yetkisi (C06).
--
-- Kullanıcı talebi: otomatik izinlere GÜVENME. Sunucunun (secret key /
-- service_role) ihtiyaç duyduğu her ayrıcalık burada AÇIKÇA verilir. Gizli oyun
-- verisi anon/authenticated'a tamamen kapalıdır. Hedef projede
-- "Automatically expose new tables" KAPALI, "automatic RLS" AÇIK olduğundan
-- public tablolarımız istemci rollerine otomatik grant almaz; service_role
-- grant'ını da elle veriyoruz.

-- ---------------------------------------------------------------------------
-- 1) service_role — açık ayrıcalıklar (Data API / secret key yolu)
-- ---------------------------------------------------------------------------
grant usage on schema public to service_role;

grant select, insert, update, delete on
  public.rooms,
  public.room_members,
  public.game_states,
  public.processed_commands,
  public.player_sessions
to service_role;

-- Sonraki migration'larda eklenecek public tablolar için de varsayılan.
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;

-- ---------------------------------------------------------------------------
-- 2) İstemci rolleri — gizli tablolara HİÇBİR erişim
--    rooms/room_members dahil doğrudan tablo erişimi yok: istemci yalnızca
--    HTTP API (service_role) ve özel Realtime kanalı kullanır.
-- ---------------------------------------------------------------------------
revoke all on
  public.rooms,
  public.room_members,
  public.game_states,
  public.processed_commands,
  public.player_sessions
from anon, authenticated;

-- 0001'deki select politikaları artık grant olmadığı için işlevsizdir; kanal
-- yetkisi aşağıdaki SECURITY DEFINER yardımcı ile sağlanır. Politikaları
-- karışıklık olmasın diye kaldırıyoruz.
drop policy if exists rooms_select_member on public.rooms;
drop policy if exists room_members_select_self on public.room_members;

comment on table public.game_states is
  'Tam gizli oyun durumu. Yalnız service_role. Data API ve Realtime yayınından çıkarılmıştır.';

-- ---------------------------------------------------------------------------
-- 3) Özel oda Realtime kanalı yetkisi
--    Kullanıcı yalnız AKTİF üyesi olduğu odanın `room:<uuid>` kanalını
--    dinleyebilir. Politika ifadesi istemci rolüyle çalıştığından, tablo
--    erişimi yerine SECURITY DEFINER yardımcı kullanılır.
-- ---------------------------------------------------------------------------
create or replace function public.is_room_member(p_room_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.room_members m
    where m.room_id = p_room_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  );
$$;

revoke all on function public.is_room_member(uuid) from public, anon;
grant execute on function public.is_room_member(uuid) to authenticated;

do $$
begin
  execute 'alter table realtime.messages enable row level security';
exception when insufficient_privilege or undefined_table then
  raise notice 'realtime.messages RLS alter atlandi (yetki/tablo yok).';
end $$;

drop policy if exists room_channel_read on realtime.messages;

do $$
begin
  execute $pol$
    create policy room_channel_read on realtime.messages
      for select to authenticated
      using (
        realtime.messages.extension = 'broadcast'
        and case
          when realtime.topic() ~ '^room:[0-9a-fA-F-]{36}$'
            then public.is_room_member(substring(realtime.topic() from 6)::uuid)
          else false
        end
      )
  $pol$;
exception
  when insufficient_privilege then
    raise notice 'room_channel_read politikasi atlandi (yetki yok); SQL Editor''den uygulayin (bkz. supabase/realtime_policy.sql).';
  when others then
    raise notice 'room_channel_read politikasi kurulamadi: %', sqlerrm;
end $$;

-- İstemci bu kanala Broadcast GÖNDEREMEZ: insert/update/delete politikası yok.

-- ---------------------------------------------------------------------------
-- 4) Fonksiyon EXECUTE ayrıcalıkları — yeniden doğrula (yalnız service_role)
-- ---------------------------------------------------------------------------
do $$
declare
  fn text;
  fns text[] := array[
    'public.notify_room_revision(uuid, integer)',
    'public.is_room_member(uuid)',
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
  end loop;
  -- is_room_member authenticated'a açık kalmalı (yukarıda verildi); diğerleri yalnız service_role.
  execute 'grant execute on function public.is_room_member(uuid) to authenticated';
  foreach fn in array fns loop
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 5) PostgREST şema önbelleğini yenile
-- ---------------------------------------------------------------------------
notify pgrst, 'reload schema';
