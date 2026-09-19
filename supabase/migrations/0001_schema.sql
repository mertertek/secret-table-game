-- Secret Table — şema (C03).
-- Sorumluluk ayrımı: docs/DEPLOYMENT.md bölüm 2.
-- Gizli tablolar (game_states, processed_commands, player_sessions) yalnız
-- sunucuya (service_role) açıktır; Data API ve Realtime yayınından çıkarılır.
--
-- DURUM: bu migration canlı Supabase'e karşı çalıştırılıp doğrulanmadı
-- (bkz. packages/server/src/supabase-gateway.ts başlığı). C03 kabul ölçütündeki
-- 7-istemci gizlilik/eşzamanlılık testi gerçek DB'de C06 öncesi koşulmalı.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- rooms
-- ---------------------------------------------------------------------------
create table if not exists public.rooms (
  id                 uuid primary key default gen_random_uuid(),
  invite_code        text not null unique,
  status             text not null default 'lobby'
                       check (status in ('lobby', 'in_game', 'ended')),
  host_user_id       uuid not null references auth.users (id) on delete cascade,
  reconnect_seconds  integer not null default 600,
  game_id            uuid,
  created_at         timestamptz not null default now(),
  status_changed_at  timestamptz not null default now(),
  expires_at         timestamptz not null default now() + interval '12 hours'
);

create index if not exists rooms_invite_code_idx on public.rooms (invite_code);

-- ---------------------------------------------------------------------------
-- room_members
-- ---------------------------------------------------------------------------
create table if not exists public.room_members (
  room_id       uuid not null references public.rooms (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  -- Motora verilen sabit, opak oyuncu kimliği (auth kimliğinden ayrı).
  player_id     uuid not null default gen_random_uuid(),
  seat_index    integer not null,
  display_name  text not null,
  status        text not null default 'active' check (status in ('active', 'left')),
  ready         boolean not null default false,
  joined_at     timestamptz not null default now(),
  primary key (room_id, user_id),
  unique (room_id, seat_index),
  unique (room_id, player_id)
);

create index if not exists room_members_user_idx on public.room_members (user_id);

-- ---------------------------------------------------------------------------
-- game_states  — tam oyun durumu; gizli roller/deste/eller. YALNIZ SUNUCU.
-- ---------------------------------------------------------------------------
create table if not exists public.game_states (
  room_id        uuid primary key references public.rooms (id) on delete cascade,
  game_id        uuid not null,
  revision       integer not null,
  state_version  integer not null default 1,
  state          jsonb not null,
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- processed_commands — kalıcı tek uygulama kaydı (idempotency). YALNIZ SUNUCU.
-- ---------------------------------------------------------------------------
create table if not exists public.processed_commands (
  room_id         uuid not null references public.rooms (id) on delete cascade,
  game_id         uuid not null,
  command_key     text not null,
  user_id         uuid not null,
  request_digest  text not null,
  result_revision integer not null,
  created_at      timestamptz not null default now(),
  primary key (room_id, command_key)
);

-- ---------------------------------------------------------------------------
-- player_sessions — etkin oturum nesli + son görülme. YALNIZ SUNUCU.
-- ---------------------------------------------------------------------------
create table if not exists public.player_sessions (
  room_id            uuid not null references public.rooms (id) on delete cascade,
  user_id            uuid not null references auth.users (id) on delete cascade,
  session_generation integer not null default 1,
  last_seen_at       timestamptz not null default now(),
  primary key (room_id, user_id)
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.rooms            enable row level security;
alter table public.room_members     enable row level security;
alter table public.game_states      enable row level security;
alter table public.processed_commands enable row level security;
alter table public.player_sessions  enable row level security;

-- rooms: üye olan kullanıcı kendi odasının genel alanlarını görebilir.
-- (Herkese açık oda listesi yok; erişim üyeliğe bağlı.)
drop policy if exists rooms_select_member on public.rooms;
create policy rooms_select_member on public.rooms
  for select to authenticated
  using (
    exists (
      select 1 from public.room_members m
      where m.room_id = rooms.id and m.user_id = (select auth.uid())
    )
  );

-- room_members: kullanıcı yalnız kendi üyelik satırını okur (oyun bilgisi içermez).
drop policy if exists room_members_select_self on public.room_members;
create policy room_members_select_self on public.room_members
  for select to authenticated
  using (user_id = (select auth.uid()));

-- game_states / processed_commands / player_sessions: istemci rollerine HİÇBİR
-- politika verilmez -> RLS altında anon/authenticated satır göremez/yazamaz.
-- Ek olarak tablo ayrıcalıkları da kaldırılır (aşağıda).

revoke all on public.game_states        from anon, authenticated;
revoke all on public.processed_commands  from anon, authenticated;
revoke all on public.player_sessions     from anon, authenticated;

-- rooms/room_members: yazma yalnız SECURITY DEFINER RPC üzerinden.
revoke insert, update, delete on public.rooms        from anon, authenticated;
revoke insert, update, delete on public.room_members from anon, authenticated;

comment on table public.game_states is
  'Tam gizli oyun durumu. Yalnız service_role. Data API ve Realtime yayınından çıkarılmıştır.';
