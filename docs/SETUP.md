# Deploy your own Secret Table

> **This is the recommended way to play.** The preview deployment linked from the
> README exists only so you can look at the game first; it shares one small free-tier
> project with everyone who opens it. Your own copy has none of those limits, costs
> nothing for a group of friends, and runs the same code.

This guide takes a fresh clone to a running deployment on your own Supabase project
and your own Vercel project. Nothing in the repository is tied to a specific account:
there are no hard-coded project IDs, keys or domains.

You do **not** need any of this to try the game. With no environment variables at all
the app runs in an **in-memory mode** (`pnpm install && pnpm --filter @secret-table/web dev`)
where the dev server process holds the room state — enough to open several tabs, add
bots and play a full game locally. Supabase is only needed for real, multi-device,
persistent rooms.

## 1. Requirements

- Node.js 20.11+ and pnpm 9+ (the repo pins `pnpm@10.18.3` via `packageManager`).
- A Supabase project (Free tier is enough for a friend group).
- A Vercel project (Hobby tier is enough).
- Optional: the Supabase CLI is already a dev dependency (`pnpm supabase …`).

## 2. Create the Supabase project

1. Create a new project in the Supabase dashboard. Note the **project ref** (the
   subdomain of your project URL).
2. **Authentication → Sign In / Providers → Anonymous sign-ins: ON.** The game has no
   accounts; every guest gets an authenticated anonymous session behind the name entry
   screen. Without this, nobody can join a room.

   Note on the rate limit: Supabase applies a default rate limit to anonymous
   sign-ins (30 per hour per IP at the time of writing). That is fine for a friend
   group, but it is **not** enough for automated testing — a script that opens six or
   more fresh anonymous sessions in a row will start getting `429`. During development
   we reuse stored sessions instead of signing up again; if you are scripting tests,
   raise the limit in the dashboard (Authentication → Rate Limits) or reuse sessions.
3. **Project Settings → API Keys:** copy the *publishable* key and the *secret* key.
   The secret key must never be given a `VITE_` prefix and must never reach the browser.
4. Realtime is enabled on the Free tier by default; no extra setting is required.
5. Data API "automatically expose new tables" can stay **off**. The browser never talks
   to PostgREST; the server uses the secret key and the migrations grant exactly what it
   needs.

## 3. Apply the migrations

The schema lives in `supabase/migrations/` and must be applied **in order**
(`0001` … `0008`). Two ways:

**A — Supabase CLI (you have the database password):**

```bash
set -a && source .env && set +a          # export the CLI variables
pnpm supabase link --project-ref "$SUPABASE_PROJECT_REF"
pnpm supabase db push
```

**B — Management API (no database password needed):**
`POST https://api.supabase.com/v1/projects/{ref}/database/query` runs SQL as the
`postgres` role using a personal access token (`sbp_…`). POST the contents of each
migration file in order as `{"query": "..."}`, then insert the corresponding `version`
rows into `supabase_migrations.schema_migrations` so a later `db push` stays in sync.
Anonymous sign-ins can be enabled with the same token:
`PATCH /v1/projects/{ref}/config/auth` with `{"external_anonymous_users_enabled": true}`.

What the migrations do:

| File | Purpose |
| --- | --- |
| `0001_schema.sql` | Tables and RLS; revokes client grants on the secret tables |
| `0002_functions.sql` | RPCs including `commit_move` (the atomic compare-and-swap); `EXECUTE` only for `service_role` |
| `0003_realtime.sql` | Trigger that publishes the revision signal on the room's private channel |
| `0004_explicit_grants.sql` | Explicit grants instead of relying on defaults; membership check for private Realtime channels |
| `0005_trigger_fn_grants.sql` | Revokes `EXECUTE` on the notify trigger function from everyone but `service_role` |
| `0006_rematch.sql` | "Play again" straight from a finished game |
| `0007_viewpoint_channels.sql` | Per-player head/gesture topics (identity comes from the authorized topic, never the payload) |
| `0008_avatar.sql` | Two nullable columns for the character picker (additive) |

If `db push` prints a notice about a skipped `room_channel_read` policy, run
`supabase/realtime_policy.sql` in the dashboard SQL editor and verify it with
`select * from pg_policies`.

## 4. Environment variables

Copy `.env.example` to `.env` and fill it in. Vite reads the file from the repository
root (`apps/web/vite.config.ts` → `envDir`).

| Variable | Visible to | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Browser | Project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser | Publishable API key (anonymous auth + Realtime subscription) |
| `SUPABASE_URL` | Server only | Project the API connects to |
| `SUPABASE_SECRET_KEY` | Server only | Server-side database access; never logged, never sent to the browser |
| `APP_ORIGIN` | Server only | The deployment's own web address (request policy; see below) |
| `ROOM_RECONNECT_SECONDS` | Server only | Reconnect window, suggested `600` |
| `SUPABASE_PROJECT_REF` / `SUPABASE_ACCESS_TOKEN` / `SUPABASE_DB_PASSWORD` | CLI only | Migrations; not needed at runtime |
| `SECRET_TABLE_ALLOW_DEV_AUTH` | Server only | Normally unset. See §6 |

Anything with a `VITE_` prefix ends up in the browser bundle — treat it as public.
Everything else exists only inside the Vercel Function.

## 5. Vercel project

- **Root directory:** `apps/web`. **Framework preset:** Vite. Build command
  `pnpm run build` (which first runs `node ../../scripts/build-runtime.mjs` to compile
  the workspace packages that the Functions import).
- The `api/` folder inside `apps/web` becomes Node.js Vercel Functions automatically
  (`api/game.ts`, `api/health.ts`). `packages/server` and `packages/game-core` are used
  only from those entry points.
- Add the same environment variables in the Vercel project settings. Remember that a
  variable added after a deployment only takes effect on the **next** build.
- Do not remove the explicit `module`, `moduleResolution` and `strict` fields from
  `apps/web/tsconfig.json`; the Vercel API compiler can inject its own defaults
  otherwise. `pnpm test:api-config` guards this.
- After deploying, check `/api/health` and then open a real room from a browser.

### `APP_ORIGIN` and CORS

The web app and the API ship in the **same** Vercel deployment and the client calls
`/api/game` as a relative path, so there is no cross-origin request and no CORS
configuration to do. `APP_ORIGIN` is declared for the deployment's own address and
request policy; the current API code does not read it. Keep it pointed at the
environment's real URL (`http://localhost:5173` locally) so it is correct if you add a
policy check, and prefer separate Supabase projects (or clearly separated data) for
preview and production.

Responses that carry a player's private view are sent with
`Cache-Control: private, no-store` so they are never held by a CDN.

## 6. Security model in one page

- **Secrets never leave the server.** Roles, the deck order and private hands live only
  in `game_states`, which client roles cannot read at all. The browser receives a
  per-player *projection* over HTTP and nothing else.
- **Explicit grants.** The migrations do not trust default privileges: `service_role`
  is granted what it needs, and `anon` / `authenticated` are revoked from the secret
  tables entirely — including direct table access to `rooms` and `room_members`.
- **RLS is not the only line.** Row-level security is applied *and* the schema-level
  `GRANT`s and function `EXECUTE` permissions are checked. `commit_move` and the other
  RPCs are executable only by `service_role`.
- **Private Realtime channel.** A room's channel (`room:<roomId>`) is authorized
  through a `SECURITY DEFINER` membership function against `realtime.messages` RLS;
  knowing the channel name grants nothing, and clients have no permission to broadcast
  on the game channel. The only thing the trigger publishes is `{roomId, revision}` —
  no state, no roles, no votes.
- **The client's word is not authority.** The API resolves the authenticated user from
  the Supabase access token; a `userId`/`playerId` in a request body is never trusted.
  Every rule is enforced server-side; the client only sends move requests.
- **Dev auth gate.** When `SUPABASE_URL`/`SUPABASE_SECRET_KEY` are missing, the local
  API accepts a fake `Authorization: Bearer dev:<id>` identity and a process-lifetime
  in-memory gateway. This is **always off** when `VERCEL_ENV` is `production` or
  `preview` — `SECRET_TABLE_ALLOW_DEV_AUTH=1` is ignored there, and a misconfigured
  production deployment returns `503 SUPABASE_NOT_CONFIGURED` instead of silently
  running without identity. Empty or placeholder values (`__FILL_ME__`, `YOUR-…`) count
  as unset. Unit test: `apps/web/api/_lib/context.test.ts`.

## 7. Free-tier limits worth knowing

Supabase's Free tier caps Realtime at roughly 100 messages per second and 2 million
messages per month (check the current pricing page). Two design decisions follow from
that:

- **Head and gesture packets are rate-limited by player count.** The send interval is
  `max(500, min(10, n)² × 15)` milliseconds — 500 ms up to six players, 1 500 ms at ten
  (`apps/web/src/multiplayer/viewpointProtocol.ts`). Because every player broadcasts to
  every other one, traffic grows with n², so a fixed interval would blow the quota at a
  full table. The chosen curve holds the ceiling at roughly 67 billed messages per
  second even when everybody is moving. The receiver compensates for the low rate with
  buffering and interpolation (see `docs/ARCHITECTURE.md`).
- **The `view` request was made cheap.** It used to cost 14–17 sequential Supabase
  round trips; it now costs 4 gateway calls. Measured with an 8 ms artificial round-trip
  per call, a ten-player table went from 17 calls / 154.9 ms to 4 calls / 37.0 ms
  (`docs/qa/claude/D21-review-fixes.md` §J). Together with the backup poll moving from
  3 s to 10 s, round trips per room dropped by about 91%.

Database rows are tiny (one state row per game), so storage is not the binding limit;
message and request counts are.

## 8. Troubleshooting

- **`429` on sign-in / players cannot join.** Supabase's anonymous sign-in rate limit
  per IP. Wait, raise the limit, or reuse existing sessions. Bots in dev mode reuse
  sessions stored in `localStorage` for exactly this reason.
- **The room stays empty or the lobby does not update.** Check that anonymous sign-ins
  are enabled, that the browser actually received `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_PUBLISHABLE_KEY` (they are baked in at build time — redeploy after
  adding them), and that migrations `0001`–`0008` are all applied.
- **No Realtime signal.** The client does not depend on it for correctness: there is a
  10 second backup poll (`BACKUP_POLL_MS` in `apps/web/src/multiplayer/roomChannel.ts`),
  so a room with a broken channel still advances, just with up to ~10 s of latency.
  If the signal never arrives, check the private channel policy from `0004` /
  `supabase/realtime_policy.sql`.
- **`503 SUPABASE_NOT_CONFIGURED` in production.** Intentional: the Supabase variables
  are missing or still hold placeholders, and the dev-auth fallback cannot be enabled in
  preview/production.
- **`ERR_MODULE_NOT_FOUND … contracts/src/*.ts` in a Function.** The build did not run
  `scripts/build-runtime.mjs`, or the manifests/lockfile are out of sync with the
  deployed commit. `pnpm test:runtime` reproduces this without the source folders.

---

Turkish original with full history: [`docs/DEPLOYMENT.md`](DEPLOYMENT.md).
