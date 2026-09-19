# Architecture

Secret Table is a browser game for 5–10 players with hidden roles, a 3D table and a
first-person seat. It runs on serverless functions and Postgres — there is no long-lived
game server and no in-memory room. This document describes how that is put together and
which trade-offs it forced.

## 1. Package map

```
apps/web            React + Vite + react-three-fiber client; Vercel Functions in api/
packages/contracts  Shared types, Zod schemas, rule tables (board layouts, role setups)
packages/game-core  Pure, deterministic rules engine: createGame() + applyCommand()
packages/server     Command service, per-player projection, Supabase / in-memory gateways
packages/scene      The 3D table: room, characters, hands, cards, boards, animations, audio
packages/fixtures   Scene fixtures for the dev pages and tests
supabase/           Postgres schema, RLS, RPCs, Realtime triggers (migrations)
```

Dependencies only ever point inward:

```
contracts ← game-core ← server
contracts ← scene
contracts ← fixtures
                    ↑ apps/web depends on all of them
```

- `contracts` depends on nothing but Zod. It is the only place both the client and the
  server are allowed to agree on.
- `game-core` depends on `contracts` and nothing else — no I/O, no clock, no randomness
  beyond its own seeded generator.
- `server` depends on `game-core` and `contracts`, and talks to the database through a
  `GameGateway` interface with two implementations (Supabase, in-memory).
- `scene` depends on `contracts` and three.js. It knows nothing about HTTP, Supabase or
  the rules; it draws the authorized view it is handed. It does not import the web app's
  i18n module either — `TableScene` takes a `language` prop instead.

## 2. The path of one move

1. A player sends a **command** (`nominate`, `vote`, `discard`, `use_power`, …) to
   `POST /api/game` with their Supabase access token in the `Authorization` header and a
   unique `commandId` in the envelope.
2. The Function authenticates the token, checks membership and the room's state, and
   loads the current game row with its `revision`. A command id that was already
   processed returns the previous result instead of replaying the move.
3. `applyCommand(state, command)` — a pure function — validates the move and returns the
   next state. No database, no network, no `Date.now()` inside it.
4. The new state is committed through a server-only RPC (`commit_move`) that locks the
   room's row and writes only if the revision is still the one we read: a
   **compare-and-swap**. The state write, the processed-command record and the
   notification all happen in one transaction, so a move can never be applied twice and
   a rolled-back transaction never produces a visible state.
5. A trigger in that same transaction publishes `{roomId, revision}` on the room's
   private Supabase Realtime channel. **That is all that goes over Realtime** — no
   state, no roles, no votes. Knowing the channel name is not access; subscription is
   authorized against membership.
6. Every client that hears the signal fetches **its own filtered view** over HTTP. The
   view endpoint re-checks identity and membership on every request and answers with
   `Cache-Control: private, no-store`.
7. If the signal is lost, a 10 second backup poll picks up the change anyway, so
   correctness never depends on the channel. In the lobby the backup poll is silent
   because the lobby already runs its own short cycle.

Two consequences are worth naming. First, the server is stateless between requests:
any Function instance can continue any room, and a deploy in the middle of a game does
not interrupt it. Second, the client is never the authority — it sends move *requests*,
and the rules that accept or reject them live on the server.

## 3. Determinism and the seed

`createGame({ players, seed })` plus a sequence of commands fully determines a game.
The engine's randomness — role assignment, deck shuffles, reshuffles — comes from a
seeded generator that is part of the state, not from `Math.random()`. Same seed, same
commands, same game, on any machine.

This is what makes the rules testable at scale rather than by anecdote.
`packages/game-core/src/engine.simulation.test.ts` plays **300 random games for each of
the six table sizes (5–10) — 1 800 seeded games** — and checks rulebook invariants at
every step: the policy counts, the election tracker, term limits, who may be nominated,
what each presidential power is allowed to do, how the game may end. A violation is
reported with its seed, so any failure is reproducible by replaying that one number.

## 4. Privacy and projection

Hidden information is not filtered in the UI; it never reaches the client.

- The full state — roles, deck order, discard order, everyone's hand — lives only in
  the `game_states` row, which client database roles have no grants on at all.
- `packages/server` builds a **per-player projection**: the same state rendered from one
  seat's point of view. A player receives their own role, what their role is allowed to
  know (fascists know each other; Hitler knows the fascist only at 5–6 players), their
  own hand, and the public table. Other players' hands arrive as *counts*, not cards.
- Animations follow the same rule. When the President passes two cards to the
  Chancellor, everyone sees two card backs move, because the cue carries the movement
  and not the identity of the cards.
- The head/gesture channel carries only yaw, pitch and an emote id. Identity comes from
  the authorized per-player topic, never from the payload.

The engine has no concept of a "viewer", and the projection has no concept of the rules.
Keeping those two apart is what makes both testable.

## 5. The scene pipeline

Every object on the table is generated in code at runtime. There are no imported
models, textures, sprites or audio samples; the only binary assets in the repository are
two Noto font files under the SIL Open Font License. The characters, the hands, the
revolver, the cards, the boards and the room are all built the same way:

1. **Signed distance fields.** A character or a hand is described as a small set of SDF
   primitives — capsules, spheres, boxes, tori — smoothly unioned together. The numbers
   live in design JSON (`docs/design/d1/poses.json`, `docs/design/d3/characters.json`),
   not hard-coded in the renderer.
2. **Marching cubes.** Our own implementation polygonises the field at a voxel size
   chosen by the quality tier, so `low` gets a coarser mesh from the same description.
3. **Part-aware vertex clustering / decimation.** Welding is aware of which primitive a
   vertex came from, so adjacent fingers do not fuse into a mitten and the gaps between
   them survive the simplification.
4. **Skeleton weights.** Each vertex takes its weights from the nearest one or two
   primitives, producing a single `SkinnedMesh` — 16 bones for a hand, 8 for a seated
   character. The geometry is generated once per quality tier and shared by every hand
   and character at the table; only the skeleton is per-instance, and the left hand is
   the right one mirrored with `scale [-1, 1, 1]`.

Card faces, board prints and name plates are drawn into canvases with `Path2D`; the
board's power icons and the Hitler-zone banner are derived from `BOARD_LAYOUTS`, so the
three player-count layouts fall out of the same code. Sound effects are synthesised at
runtime with the Web Audio API.

The renderer runs with `frameloop="demand"`: frames are requested when something
actually changes — an animation cue, a head still interpolating, a camera transition —
and the table sits at zero frames per second when it is idle. Draw calls are budgeted
per feature and measured rather than estimated: a standard-quality ten-player table has
been measured at roughly 200 draw calls (the reports in `docs/qa/` carry the exact
figures per feature; the ≤120 target is still open and tracked in the roadmap).

## 6. The live look channel

Head direction and gestures are presentation, not state: they are never written to the
game state and never replayed. They travel on a low-rate Realtime broadcast channel, and
the rate is dictated by the free-tier quota rather than by what would look best.

Every player broadcasts to every other player, so message volume grows with n². The send
interval is therefore
`max(500, min(10, playerCount)² × 15)` ms — 500 ms up to six players, 1 500 ms at ten —
which keeps the billed rate at roughly 67 messages per second even when everybody is
moving at once (`apps/web/src/multiplayer/viewpointProtocol.ts`).

That is one packet every half second or worse, so all of the smoothness is produced at
the receiver (`packages/scene/src/live/headInterpolation.ts`):

- **A buffer with a jitter-derived delay.** The render cursor runs behind real time by
  the p90 of the last twelve *arrival* intervals plus 60 ms (150 ms when loss exceeds
  10%), clamped between the median × 1.1 and `min(1500 ms, staleAfter/2)`. The delay
  rises immediately and falls with a 2 s time constant.
- **De-jitter.** Since the send interval is fixed, sample timestamps are snapped back to
  the send grid and pulled 15% towards the real arrival, so two packets arriving 100 ms
  apart do not make the head sweep that step in 100 ms.
- **Bounded extrapolation.** If the cursor passes the last sample, the head continues at
  the angular velocity of the last two samples with a τ = interval/2 decay, for at most
  one interval, and never past the view limits. When the prediction ends the pose
  freezes, so `frameloop="demand"` can stop. The reduced-motion path uses raw samples
  and does not extrapolate at all.
- **Speed limits.** The cursor cannot run outside 0.8–1.2× real time, and catching up
  after a late packet is capped at 1.5× the segment's natural speed plus 0.18 rad/s, so
  a late arrival cannot produce a visible jump.

Measured against real Supabase Realtime with five players (arrival intervals p50 501 ms,
p90 591 ms, max 647 ms, no loss), the largest per-frame yaw step fell from 0.0445 rad to
0.0199 rad and the number of frames stepping more than 20 mrad went from 4 to 0 over
1 081 frames (`docs/qa/claude/D24-head-interpolation.md` §9).

## 7. Internationalisation

The interface is Turkish and English, and **the language belongs to the player, not to
the room**. Two people at the same table can each read the HUD, the announcements, the
boards and the card faces in their own language, at the same time, in the same game.

This is possible because the server never sends prose. It sends codes — `phase`,
`power`, `errorCode`, cue `kind` — and every visible string is produced on the client
(`apps/web/src/i18n/`, plus a small `sceneText` dictionary in the scene package). There
is no language field in the contract, nothing about language in the database, and no
environment variable to set. The choice lives in `localStorage`; with nothing
stored the app opens in **English** (`DEFAULT_LANGUAGE`), the same for every visitor
regardless of browser locale, and a TR/EN switch on the entry screen or the in-game
menu changes it instantly.

`tr.ts` is the source table and `en.ts` must satisfy the same key set, so a missing
translation is a type error rather than a blank label. Canvas textures (boards, cards,
name plates) take the language as a draw dependency, so switching languages regenerates
them and disposes the old ones without a page reload.

## 8. Solo mode

A visitor who arrives alone can press **Try it solo** and play the whole game in the
browser against five bots. This works because `@secret-table/server` is pure: `service`,
`projection`, `engine-map` and `memory-gateway` import nothing from Node and nothing from
Supabase, and `game-core` only depends on the contracts. So the same `GameService`, behind
the same `InMemoryGateway` the tests use, runs in a tab and enforces the same rules — the
client still only asks, the engine still decides.

`apps/web/src/solo/soloTransport.ts` is a local twin of `api/game.ts`: same `action` and
payload, same `ApiResult` shape, same status codes, no network. One switch in `apiClient`
(`setSoloTransport`) routes every existing call there, so nothing else in the app knows
the difference. Identity is a fixed local id with a `solo:<id>` token, so no anonymous
Supabase account is created; the Realtime channel, the look channel, the heartbeat and
the dev scenarios stay off, and the version signal comes straight from the in-memory
gateway. Nothing is written to storage: closing the tab ends the game.

The whole feature is lazy (`import('../solo/startSolo')`), so a visitor who never presses
the button downloads none of it, and the server path — `api/game.ts`, the Supabase
gateway, the migrations — is untouched.

## 9. Tests and commands

```bash
pnpm install
pnpm -r typecheck                          # 6 packages
pnpm test                                  # 1046 tests
pnpm --filter @secret-table/web build
```

Current distribution: contracts 27, fixtures 56, game-core 147, scene 368, server 95,
web 331 — **1 024** in total. The 1 800-game simulation above is part of the game-core
figure. Beyond unit tests there are two useful extras: `pnpm test:runtime` exercises the
health and room paths against the compiled package output (without the source folders),
and `pnpm test:api-config` guards the TypeScript settings the Vercel API compiler
depends on.

For manual work there are dev pages, available only in a dev build: `/dev/scene` (every
scene fixture), `/dev/hands` (the hand rig), `/dev/characters` and `/dev/game`. In-game
there is also a dev scenario menu that jumps straight to a veto
round, an execution, a Hitler-zone round and so on — gated behind a server flag that is
never set in production.

---

Turkish working notes with the full history live in `docs/`; see
[`docs/README.md`](README.md) for the index.
