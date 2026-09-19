# Supabase — yerel geliştirme

Mimari: Supabase Postgres (kalıcı oyun durumu) + Auth (anonim misafir) + Realtime
(özel oda kanalında yalnız `{roomId, revision}` sinyali). Ayrıntı: `docs/DEPLOYMENT.md`.

## Durum (C03)

- `config.toml`: anonim giriş açık, storage kapalı.
- `migrations/`: `0001_schema.sql` (tablolar + RLS + GRANT geri alma), `0002_functions.sql`
  (`create_room` / `join_room` / `start_game` / `commit_move` atomik CAS / oturum RPC'leri;
  EXECUTE yalnız `service_role`), `0003_realtime.sql` (`room:<id>` özel kanalı, sürüm
  sinyali tetikleyicisi + kanal RLS).
- 2026-09-09: `supabase start` + `supabase db reset` yerel Docker yığınında temiz
  uygulandı. `psql` ile doğrulandı: `commit_move` CAS (ok / duplicate /
  duplicate_digest_mismatch / version_conflict), RPC EXECUTE kilidi
  (authenticated/anon → permission denied), gizli tablolar (game_states /
  processed_commands / player_sessions → permission denied), `room_members` RLS
  yalnız kendi satırı. Ayrıntı: `docs/qa/claude/C02-C03.md`.
- **Uzak Supabase projesi yok.** `0003`'teki `realtime.messages` politikası
  migration rolünün sahiplik yetkisi yoksa atlanır (notice) — C06'da dashboard/SQL
  editöründen uygulanır.

## CLI

CLI depoya `devDependency` olarak eklendi; kök `pnpm supabase ...` ile çalışır.

```bash
# Sürüm
pnpm supabase --version

# Yerel yığını başlat (Docker gerekir; ilk çalıştırma imajları indirir)
pnpm supabase start

# Şemayı migration'lardan sıfırla
pnpm supabase db reset

# Yeni migration dosyası
pnpm supabase migration new <ad>

# Yığını durdur
pnpm supabase stop
```

`pnpm supabase start` sonrası yerel değerler (URL, publishable/secret anahtar)
terminalde yazılır; bunları depo kökündeki `.env` dosyasına elle koy (`.env.example`
alan adlarıyla). Anahtar değerleri Git'e veya Markdown'a yazma.

## Uzak projeye migration (C06)

Ön koşul: depo kökünde `.env` (gitignore'da) — `SUPABASE_PROJECT_REF`,
`SUPABASE_ACCESS_TOKEN` (`sbp_...`), `SUPABASE_DB_PASSWORD`.

```bash
set -a && source .env && set +a
pnpm supabase link --project-ref "$SUPABASE_PROJECT_REF"
pnpm supabase db push          # 0001..0004
```

- `0004_explicit_grants.sql`: otomatik izinlere güvenmeden `service_role`'e açık
  GRANT; gizli tablolar `anon`/`authenticated`'a tamamen kapalı; özel Realtime
  kanalı yetkisi `public.is_room_member()` SECURITY DEFINER + `realtime.messages` RLS ile.
- `db push` çıktısında `room_channel_read politikasi atlandi` görülürse
  `supabase/realtime_policy.sql`'i Dashboard → SQL Editor'de çalıştır.
- Dashboard'da elle: Authentication → **Anonymous sign-ins = ON**.

Ayrıntı ve doğrulama listesi: `docs/DEPLOYMENT.md` § 7. Preview ve production ayrı
projeler veya açıkça ayrılmış veri ortamları kullanır; testler production tablolarını
sıfırlamaz.
