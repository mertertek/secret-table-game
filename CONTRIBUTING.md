# Contributing

Thanks for looking. This is a hobby project, so the bar is simple: don't break the
rules engine, don't leak hidden information, and leave the test suite green.

## Getting set up

Requirements: Node.js 20.11+ and pnpm 9+ (the repo pins `pnpm@10.18.3`).

```bash
pnpm install
pnpm --filter @secret-table/web dev
```

With no environment variables the app runs in **in-memory mode**: the dev server process
holds the room state, so you can open several browser tabs (or add bots from the lobby)
and play a full game without any Supabase account. See [`docs/SETUP.md`](docs/SETUP.md)
if you want to run against your own Supabase project.

Before opening a pull request:

```bash
pnpm -r typecheck && pnpm test && pnpm --filter @secret-table/web build
```

Dev-only pages, useful when you are working on the 3D side: `/dev/scene` (every scene
fixture), `/dev/hands` (the hand rig), `/dev/characters` and `/dev/game`. In-game,
`M` → Developer offers scenario jumps (execution, veto round, Hitler zone…) in dev
builds.

## Package boundaries

The dependency direction is the main thing to respect (see
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)):

- **Rules stay pure in `packages/game-core`.** `applyCommand()` takes a state and a
  command and returns the next state. No I/O, no clock, no `Math.random()` — randomness
  comes from the seeded generator in the state, because the 1 800-game simulation test
  depends on determinism.
- **Hidden information stays server-side.** Roles, deck order and private hands are
  filtered out in `packages/server`'s projection. If a client needs to render something,
  it must arrive through the player's own view.
- **Visible text goes in `apps/web/src/i18n`.** Never in `contracts`, `game-core` or
  `server` — those send codes (`phase`, `power`, `errorCode`, cue `kind`), never prose.
  `tr.ts` is the source table and `en.ts` must satisfy the same key set: **update both**,
  or the build fails. The scene package has its own tiny dictionary,
  `packages/scene/src/i18n/sceneText.ts`, for the few strings drawn into textures.
- **Contract changes are additive.** Add optional fields; do not remove or repurpose
  existing ones, and keep `CONTRACT_VERSION` fixed unless you are genuinely breaking
  compatibility with deployed clients. Schemas live in `packages/contracts`.
- Database changes are new numbered files in `supabase/migrations/`; existing migrations
  are never edited.

## Code comments

The project was developed in Turkish and **existing code comments are in Turkish**. They
are not going to be translated wholesale. New comments may be written in English — a
mixed codebase is fine. User-facing text is a different matter: it always goes through
the i18n tables in both languages.

## Pull requests

- Add tests for what you change. Rules changes belong in `packages/game-core` tests;
  server behaviour in `packages/server`; UI and protocol in `apps/web`.
- `pnpm -r typecheck`, `pnpm test` and the web build must pass.
- Keep the change focused, and say in the description what you verified by hand
  (which player counts, which browser) rather than implying more than you tested.

## Licence

This project is released under **[CC BY-NC-SA 4.0](LICENSE)** (non-commercial), because
the *Secret Hitler* ruleset it implements is published under the same licence. By
contributing you agree that your contribution is licensed the same way. See
[`NOTICE.md`](NOTICE.md) for attribution and third-party material.
