# NOTICE — attribution and third-party material

_Türkçe özet aşağıda._

## Secret Hitler

This project implements the rules of **Secret Hitler**, a social deduction game
created by Mike Boxleiter, Tommy Maranges, Max Temkin and Mac Schubert.

> Secret Hitler © Goat, Wolf & Cabbage LLC — licensed under
> [Creative Commons BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/).

Because the rules are used under CC BY-NC-SA 4.0, this project is released under
the **same licence** (see `LICENSE`) and is **non-commercial**.

What this project does **not** use:

- the official Secret Hitler name as a product name (this project is called
  "Secret Table"), logo, wordmark or box art;
- the official card, board, envelope or token artwork;
- any scanned, traced or derived image file from the published game;
- any photograph, HDRI, downloaded 3D model or purchased asset.

What it does use: the **rules** (role distribution, election, legislative
session, election tracker, presidential powers, veto, victory conditions) as
published in the official rulebook, and the standard English terminology for
them (President, Chancellor, Liberal/Fascist policy, election tracker,
Investigate Loyalty, Special Election, Policy Peek, Execution, veto).

## Changes made to the licensed work (CC BY-NC-SA 4.0 §3(a)(1)(B))

The rules were adapted to a real-time, browser-based 3D multiplayer format: a
server-side rules engine with per-player filtered views, a 3D table with
first-person seats, hand gestures, an execution animation, and a Turkish and
English interface. No rule was changed. The physical components (cards, boards,
envelopes) were re-drawn from scratch in code, without reference to the official
artwork files.

## No affiliation

Secret Table is an unofficial fan project. It is not affiliated with, endorsed by,
sponsored by or otherwise connected to Goat, Wolf & Cabbage LLC or the authors of
Secret Hitler. The name "Secret Hitler" appears in this repository only to
identify the ruleset being implemented (nominative use); the product itself is
named "Secret Table". No trademark rights are claimed or implied.

## Original assets

Every visual and audio asset in this repository is **produced parametrically in
code** for this project — table, chairs, room, characters, hands, cards, boards,
nameplates, emblems and sound effects. There are no imported models, textures,
sprites or samples. Details, sizes and verification notes: `docs/ASSETS.md`.

The two emblems (a leaf for the Liberals, a geometric bastion for the Fascists)
are original drawings made for this project and do not reproduce the official
game's symbols.

Sound effects are synthesised at runtime with the Web Audio API
(`packages/scene/src/audio/SceneAudio.ts`); no sample files are shipped.

## Fonts

`packages/scene/public/fonts/` contains **Noto Sans** and **Noto Serif**
(variable TTF), © The Noto Project Authors, licensed under the
[SIL Open Font License 1.1](https://openfontlicense.org/). The OFL permits
bundling and redistribution with the software; the font files are unmodified.

## Third-party software

Runtime and build dependencies (React, Vite, Three.js, @react-three/fiber,
@react-three/drei, Supabase JS, Zod, Vitest and their transitive dependencies)
keep their own licences, listed in `pnpm-lock.yaml` and in each package's
`node_modules/*/LICENSE`.

---

## Türkçe özet

Bu proje **Secret Hitler** kurallarını uygular. Secret Hitler © Goat, Wolf &
Cabbage LLC ve [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)
ile lisanslıdır; bu yüzden bu depo da **aynı lisansla** ve **ticari olmayan**
kullanım için yayımlanır (`LICENSE`).

Resmî ad (ürün adı olarak), logo, kart/tahta görselleri ve kutu sanatı
**kullanılmadı**; proje adı "Secret Table"dır. Kullanılan şey yalnız resmî
kitapçıktaki **kurallardır**.

Depodaki bütün görsel ve işitsel varlıklar bu proje için **kodda parametrik
olarak üretildi** (masa, koltuk, oda, karakterler, eller, kartlar, tahtalar,
isim plakaları, amblemler, sesler). Dış model, doku, fotoğraf veya ses örneği
yoktur — ayrıntı `docs/ASSETS.md`.

Fontlar Noto Sans ve Noto Serif, SIL Open Font License 1.1 ile dağıtılır ve
değiştirilmemiştir.
