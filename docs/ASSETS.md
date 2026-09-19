# Asset inventory

Owner: Claude (since 2026-09-11; the earlier sections are Codex-era history). Last
content update: 2026-09-09, translated to English 2026-09-18. The **FINAL-SCENE
production integration** is in the last section below; the sections before it are
delivery history. The old "prototype, not wired to the live game" limitation was lifted
by a later user assignment; real user/device acceptance and the open handovers are in
the FINAL-SCENE report.

Every object is real parametric Three.js geometry. Source: produced for this project by
Codex. No external model, photograph, HDRI or card graphic was used. The original
sources fall under the same usage scope as the project code; at the time this section
was written the repository had not yet declared a separate licence (it is now
CC BY-NC-SA 4.0 — see `LICENSE` and `NOTICE.md`). The third-party font licences for A15
are listed further down.

The components are exported from the sources below, but **the package's only entry
point for the application remains `TableScene`**. The application does not import
internal object paths. Dimensions are X × Y × Z in metres; v1 applies to all of the
generated assets listed here.

| ID | Asset / source | Dimensions and states | Verification / task |
| --- | --- | --- | --- |
| A01 | `packages/scene/src/objects/Table.tsx` → Table | 4.70 × 0.24 × 3.30 oval walnut; 4.24 × 2.84 felt; two brass strips; two legs | 5–10 player table renders, X01 done |
| A02 | `objects/Chair.tsx`, `objects/furnitureGeometry.ts` → Chair | About 0.49 × 0.90 × 0.46; walnut frame, green cushion; single merged mesh | 5–10 chairs, X01 done |
| A03 | `objects/Nameplate.tsx` + `objects/nameplateState.ts` → Nameplate | **D6:** a single camera-facing label above the head, 0.60 × 0.18 (compact 0.60 × 0.11); bottom-centre pivot, world y = 0.48; unlit, `depthTest` off; name + office icon/word + status + the D5 vote chip. Ellipsis after 15 characters; the DOM name button and hover bubble were removed (full names live in the HUD player list) | `docs/qa/claude/d6/*.png` (seat, table overview, 10 players, phone); state matrix test `nameplateState.test.ts` |
| A04 | `objects/PolicyBoard.tsx` → PolicyBoard | Each track 1.96 × 0.034 × 0.47; 5/6 slots; small/medium/large print variant; empty and full | Table, private hand, end of game; X02 done |
| A05 | `objects/PolicyTile.tsx`, `objects/CardBody.tsx` → PolicyTile | 0.19 × 0.009 × 0.272; face-down/liberal/fascist; selected lift; settled card | Private selected hand and filled tracks, X02 done |
| A06 | `objects/BallotCard.tsx` → BallotCard | Same card body; JA + tick, NEIN + cross; face-down submission / revealed result | Vote selection and election result, X02 done |
| A07 | `objects/RoleEnvelope.tsx` → RoleEnvelope | 0.22 × 0.013 × 0.30; closed wax seal, open separate flap, closed again | Open/closed envelope renders, X02 done; 550 ms local card draw X03 done |
| A08 | `objects/RoleCard.tsx` → RoleCard | Same card body; liberal/fascist/Hitler; only your own role, or revealed roles at the end of the game. The Investigate Loyalty result is a separate PARTY MEMBERSHIP face and never claims an exact role | Local role and end-of-game renders; investigation behaviour check, X02 done |
| A09 | ~~`objects/OfficePlacard.tsx`~~ → folded into Nameplate (D6) | File **deleted**; the office is now the label's second line (icon + PRESIDENT / CHANCELLOR / … NOMINEE). The `office_moved` cue triggers a 300 ms cross-fade instead of sliding a placard | `docs/qa/claude/d6/*.png` |
| A10 | `objects/ElectionMarker.tsx` → ElectionMarker | 1.30 × 0.11 print area; 0.07 m brass marker for 0–3 | Different tracker states verified, X02 done; with no separate tracker cue the current value is drawn immediately |
| A11 | `objects/CardStack.tsx` → CardStack | 0.29 × 0.024 × 0.37 base; 0–5 visible layers, real count text; discard pile slightly scattered | Empty/full draw and discard piles, X02 done |
| A12 | `materials/cardArt.ts`, `objects/Surface.tsx` | Original canvas textures: leaf / geometric bastion, text + symbol; one shared ST back face on every card. Artwork sits on real 3D cards | Close-ups; X02 done |
| A13 | `materials/SceneMaterials.tsx`, `materials/palette.ts`, `objects/furnitureGeometry.ts` | Walnut grain / felt fibres generated in code; PBR roughness; brass; vertex-coloured merged furniture | Table and close-ups, X01/X02 done |
| A14 | `audio/SceneAudio.ts` | 5 original mono Web Audio sounds: paper (190 ms), flip (160 ms), wood (140 ms), result (650 ms), selection (55 ms). Synthesised locally, no download or licence dependency | Autoplay lock, mute/stop, single-voice and waveform limits checked; no listening evaluation on speakers was done. X03 done |
| A15 | `packages/scene/public/fonts/` | Noto Sans 2,049,096 bytes + Noto Serif 1,887,192 bytes; variable local TTF, Turkish coverage | Turkish names and cards verified visually, X01 done |
| A16 | `objects/RoomDecor.tsx` → RoomDecor | Floor, oval rug, plain wall mouldings, two real 3D lamps. Decor and lamp lights turn off at low quality | Basic environment X01 done; detailed room polish X04. **Superseded by D2** — this file was deleted and replaced by `packages/scene/src/room/` |
| A17 | `objects/PlayerAvatar.tsx`, `objects/furnitureGeometry.ts` → PlayerAvatar | Roughly 0.30 × 0.51 m stylised seated character; head, hair, eyes, nose, arms, jacket; neutral colour derived only from `seatIndex` | 5–10 player tables and eliminated players, X02 done. **Superseded by D3** |
| A18 | `animation/cues.ts`, `useSceneCues.ts`, `Motion.tsx`, `RevealCard.tsx`, `CueEffects.tsx` | Deal 520, face-down transfer 460, vote flip 480, policy placement 620, power 420, elimination 350, result 850 ms. Reduced motion: instant position and at most a 100 ms event lifetime | 6/7/10 players, simultaneous votes/hands/powers; repeat, resync, interruption, stale hand cleanup, idle check. X03 done |

The `objects/`, `animation/`, `audio/` and `materials/` shorthands are under
`packages/scene/src/`. Geometry and texture dimensions are visual production decisions;
they contain no game rules.

## Layout and presentation

- Seat centres: X radius 2.64; Z radius 2.00. The local player sits at the bottom; the
  server's `seatIndex` never changes. Elimination or a lost connection does not remove
  seats.
- Public face-down cards render at 0.8 scale; the private hand at 1.45, ballot cards at
  1.35, the local envelope at 1.16. The personal-reading magnification is deliberate;
  the size of a face-down card never varies with its contents.
- **D6:** the table-top name card and office placard were removed (`seats.plate` →
  `seats.label`); a single label sits above each avatar's head and scales so that it
  stays at least 48 CSS px on screen (32 px compact), with zoom ≤ 2.4.
- If the scene is narrower than 700 px or shorter than 500 px, the label drops to a
  compact single line (name + office icon + vote chip icon); there is no DOM name
  button, and clicking/targeting happens on the 3D label itself.
- If two labels' screen rectangles overlap by more than 15%, the farther one goes
  compact with 300 ms hysteresis; at a ten-player table the label anchors are at least
  1.2 m apart. Checked at 1440×900 and 390×844.
- 40° perspective camera; fixed table angle plus a close-up of the private area. No free
  orbit. Under reduced motion the selection lift jumps straight to its final position.
  X03: the optional close-up transition is 500 ms; with reduced motion the camera and
  objects settle instantly.
- The player-count print on the boards comes from the `boardVariant` field. Power icons
  were not invented for the slots; for the source of the slot/power metadata see the
  CODEX-005 handover.

## Font sources and licences

- [Noto Sans official source](https://github.com/google/fonts/tree/main/ofl/notosans),
  [Noto Serif official source](https://github.com/google/fonts/tree/main/ofl/notoserif).
- Both are under the SIL Open Font License 1.1; unmodified TTFs. The licences sit next
  to them as `NotoSans-OFL.txt` and `NotoSerif-OFL.txt`.
- The fonts are bundled with `new URL(..., import.meta.url)`; at runtime there is no
  font CDN and no request for an external model or texture. Raw font total 3,936,288
  bytes; surfaces are generated locally at runtime.
- **Subsetting status (ROADMAP §C/2, 2026-09-10):** the TTFs are still complete (not
  subset). Code splitting was done instead in C2: because `SceneFrame` loads the scene
  with `import()`, these two fonts now come down **only** with the scene chunk — the
  entry, `/katil` and lobby screens never request them (evidence:
  `docs/qa/claude/C2-bundle-mobile.md` §1). A real subset (Latin basic + Latin-1
  Supplement + Latin Extended-A + general punctuation + currency, including `ğĞıİöÖşŞüÜçÇ`
  for Turkish) was not produced because fontTools/`pyftsubset` is not installed on this
  machine. When it is done, the OFL files must stay beside the subset files and this
  line must be updated.

## Evidence and limits

The [QA report](qa/codex/X01-X02.md) contains all render and test links. Ten-player
standard render: 96,762 triangles / 201 draw calls (as reported, including the shadow
pass); low: 49,222 / 115. That is below the 150k-triangle starting budget; the target of
roughly 120 draw calls is not yet met at standard quality. No real integrated GPU/FPS
measurement was taken; that is X04's subject.

Completion chain: produced → verified in the stated synthetic view → integrated into the
live game → user acceptance. The last two stages are not claimed by that delivery.

## X03 evidence and integration

The [X03 QA report](qa/codex/X03.md) contains mid-animation renders, numeric browser
measurements and limits. No new audio/model bundle or network request was added. Final
frame with ten players at standard quality, end of game: 104,556 triangles / 223 draw
calls; idle 381→381. These are not FPS tests; the X04 performance targets remain open.

All cue types are supported. Since 2026-09-10 `cards_moved` is produced by the
engine/projection (ROADMAP A4, `docs/qa/claude/A4-cards-moved.md`). The "vote submitted"
marker and the election tracker are drawn immediately from the current snapshot; no
server event is invented for them. Action confirmation, the persistent sound preference
and the resync queue are in the application; see the CODEX-008/009 handover. The resync
filter was taken over and the 950 ms generation-guarded drain fix was made by Claude;
live visual timing evidence is open in J01.

## F02/F03-P — standalone seat and hand prototype (2026-09-09)

Produced under a new user assignment; this is not F00 acceptance or live F02/F03
integration. All new sources are under `packages/scene/src/prototype/` and are not
exported from the package entry point. The existing A01–A18 sources were not changed.
The source/licence scope is the same as the original parametric assets above; no new
dependency, download or audio file was added.

| ID | Asset / new source | Dimensions and states | Check |
| --- | --- | --- | --- |
| A19-P | `HandModel.tsx`, `rig.ts` | Two palms; three joints on each of four fingers, a two-part thumb; wrist, cream cuff, green forearm and a jacket sleeve reaching the camera boundary. Palm about 0.126 × 0.047 × 0.14 m | Table, card grip, selection, close-up and downward/sideways looks; no full body/IK/physics |
| A20-P | `PhysicalCard.tsx`, `HandRig.tsx` | 0.19 × 0.008 × 0.272 m real double-sided cream card; authorized policy/role and revealed JA/NEIN. Envelope 0.245 × 0.018 × 0.335 m, separate opening flap | The public view shows the ST back instead of the private face; when private data is removed, no stale face is left in the hand |
| A21-P | `ArticulatedAvatar.tsx` | Separate head/neck and a merged body; 4 neutral jacket/skin variants. Head ±0.65 rad horizontal, ±0.25 rad vertical | Synthetic samples, smoothing, rejection of stale/out-of-range samples, neutral after 1.8 s; not a real network |
| A22-P | `SeatCamera.tsx`, `FirstPersonStage.tsx` | Eye 0.60 m above the table top, bound to your own seat. ±58° horizontal, −48°/+12° vertical; overview/seat/private close-up, 620 ms transition | 5–10 layouts; 6/7/10 and the 10th local seat; mouse drag/click, keyboard, reduced motion; 390×844 / 844×390 |
| A23-P | `model.ts`, `rig.ts`, `HandRig.tsx` | Draw 1450, select 440, cancel 420, face-down release 1350, open vote flip 1150, envelope open 1650 ms. Persistent local hold pose | Synthetic motions and final positions; rejection, reset, privacy; no user move or game rule |

In the prototype the deck's local dealing area and the face-down release tray are at
X = ±0.70 / Z = 0.94 m. This prevents an unrealistic reach towards the central deck; the
live table layout did not change. In the public view your own avatar's old arms are not
drawn; in seat/close-up views your own avatar does not block the camera.

[Prototype QA and renders](qa/codex/F02-F03.md). Ten-player standard final grip:
102,880 triangles / 299 draw calls; the ~120 draw-call target is not met. Merging/LOD of
the hand geometry and real device FPS measurement are left to X04. The touch path is
ready via Pointer Events; no physical touch device test was done. Wiring live audio,
head direction and events is separate work after F00/F01.

## QA-R02 / R06 / R05 fixes (2026-09-09)

- **A19-P / A20-P / A23-P:** cards fan around a shared lower grip; fingers behind and
  thumb support in front, wrist bound to the card, the left hand holding the remaining
  packet. The exit point from selection was verified with 1/2/3 cards. Motion durations
  and geometry counts did not change; not wired to the live game.
- **Existing TableScene identity/camera:** the CLAUDE-005 controlled role prop and the
  explicit open/close direction are consumed. Keeping the overview camera, a single-card
  and a separate board close-up view plus card navigation controls were added. The
  close-up controls produce no game move.
- [Separate QA fix report](qa/codex/QA-FIXES.md): before/after plus intermediate frames,
  5–10 portrait framing, same-condition renderer comparison. Standard 89,472/267 →
  unchanged; low 34,398/136 → unchanged (triangles/draw calls; not FPS).
- The 390×844 card/role close-up passed; the application's 844×390 landscape 45vh scene
  container is limited, CODEX-013 HTML handover open. Full physical contact/real touch
  and the X04 budget remain separate.

## FINAL-SCENE — production entry point and final fan / X04 polish

All production features are consumed through `@secret-table/scene` → `TableScene`, with
the new shared `immersive` and `resetEpoch` types. The name of the internal prototype
folder is historical; the QA HTML/dev mount is not a production dependency. The default
table overview is preserved.

| ID | Production asset | Final state |
| --- | --- | --- |
| A19 / A23 | `prototype/InstancedHandModel.tsx`, `rig.ts`, `live/LocalMotion.ts` | Two-jointed hand, wrist/forearm; 3 instanced draws per hand. Grip first, lift second; current authorized cards; draw 1450 / select 440 / cancel 420 / release 1350 / vote 1150 / envelope 1650 ms |
| A20 | `PhysicalCard.tsx`, `grip.ts`, `FanLayout.ts` | 0.80 rad shared-base fan, revealed type / 1–3 print, opaque IDs matching left and right; the selected card is fully readable; 240 ms ID continuity for the remaining card, amber target highlight |
| A21 | `ArticulatedAvatar.tsx`, `live/PublicArms.tsx`, `ViewpointAdapter.ts` | Separate smoothed head, merged public arms; app-validated HeadViewpoint receive time, 4000 ms TTL, return to neutral. No private hand/vote/role network input |
| A22 | `SeatCamera.tsx` | Production horizontal ±1.4 rad; seat/overview/private/board, 620 ms camera; independent lock/free; portrait FOV; your own name label does not block the close framing |
| A24 | `live/useSceneControls.ts`, `Targeting.tsx` | Explicit controller, centre raycast, small reticle, card/label target highlight, out-of-frustum/null slot, local drag suppression. No second global keyboard/command listener |
| A18 update | `animation/cues.ts`, `useSceneCues.ts` | A normally empty queue is not a cancellation; only an explicit resetEpoch/suspension/privacy interrupts. Animation does not delay the completion of a game operation |

[FINAL-SCENE report](qa/codex/FINAL-SCENE.md): before/after fan, 5–10 / 1–3 screens,
controller/privacy/lifecycle. 269 tests + typecheck 6/6 + build passed. Same 7-player
production camera at standard: 280 → 199 draws / 79,554 → 76,986 triangles; low
146 → 102 draws / 31,758 → 30,298 triangles. Ten-player final at low: 119 draws;
standard 244, so the ~120 budget is still open. 36.742 s idle: 79 → 79 frames. These are
not FPS or GPU byte-memory figures; physical device / FPS acceptance is open.

Real Pointer Lock was refused by that in-app browser; scene targeting was verified only
with synthetic lock input. CODEX-017 app null-fallback/E/camera, real keyboard/Fullscreen/
Pointer Lock and a friend-group test are open. No new dependency, model, font or audio
bundle was added; Vercel was not opened in that session.

## Hands (D1)

`packages/scene/src/hands/**` — the hand surface is generated in code, with no external
model or texture: 23 SDF primitives → our own marching cubes → vertex clustering → a
16-bone `SkinnedMesh`. The geometry is produced once per quality tier (standard 4,950
triangles / 63–78 ms, low 2,248, PublicArms `distant` 802) and shared by every hand; the
skeleton is per hand, and the left hand is `scale [-1, 1, 1]`.

Poses and card–hand frames are read from `docs/design/d1/poses.json` (a design document;
the code does not copy it). Skin tone is a `#c9a184` vertex-colour gradient derived from
the cream/walnut tokens in `materials/palette.ts`; there are no nails or texture. Two
draw calls per hand (1 `SkinnedMesh` + 1 `InstancedMesh` for the arm/cuff).

Report and before/after frames: [D1-hands](qa/claude/D1-hands.md), `docs/qa/claude/d1/`.

## Policy boards (D10)

`packages/scene/src/objects/boardArt.ts` — the board surface is drawn on a single
`PrintedFace` canvas (2048 texture, 1024 at `quality: 'low'`) in a 1940 × 450 px =
1.94 × 0.45 m design space; there is no external model, SVG or icon font. The five
power/victory icons are verbatim copies of the path strings in
`docs/design/d10/icons.json`, filled with `Path2D` + `evenodd`.

Slot → power icon/label, the "VETO UNLOCKED" strip and the Hitler-zone banner are not
hard-coded: they are derived from `BOARD_LAYOUTS[variant]` (`fascistPowers`,
`vetoUnlockAt`, `hitlerChancellorWinAt`), so all three player-count layouts come out of
the same code. Colour tokens come from `materials/palette.ts` → `board` (public party
colours only; nothing that hints at a role or a hand).

Design source and target look: [D10-boards](design/D10-boards.md) +
`docs/design/d10/*.svg|png`; the code-side report and legibility measurements are in
[D10-boards QA](qa/claude/D10-boards.md), frames in `docs/qa/claude/d10/`.

## D3 — procedural characters (2026-09-11)

- `packages/scene/src/characters/**`: `docs/design/d3/characters.json` (23 base + 22
  accessory primitives, 8 characters × 3 skin tones) → SDF → marching cubes → vertex
  clustering → a single `SkinnedMesh` (8 bones, 2 material groups). The old
  `prototype/ArticulatedAvatar.tsx` was removed; the shared SDF primitives now live in
  `packages/scene/src/sdf/primitives.ts` alongside the D1 hands. No new dependency or
  downloaded asset; every number is read from the design JSON.
- Dimensions/budget (round 2): seated height 1.00 m (top of head at world 0.695), 3 draw
  calls per character (body + a 1024×512 canvas face + the `PublicArms` hand), standard
  9 mm voxels → about 9–10k triangles / ~0.4 s generation (first frame low 6.7k / 0.1 s,
  standard queued while idle), Taubin smoothing; thin details (glasses, chains) are real
  tori/cylinders in the same mesh. Seat camera eye at 0.47, label 0.745–0.865 (depending
  on the hat), `TargetZone` [0.64, 1.00, 0.52].
- Party colours (liberal/fascist) and any shape or colour that could hint at a role are
  never used; clothing and accent tones come from the §e table in `characters.json`.
  Details and deviations: `docs/qa/claude/D3-characters.md`.
