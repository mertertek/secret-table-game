#!/usr/bin/env python3
"""D27 — ham screencast karelerinden README tanıtım GIF'i (ffmpeg/gifski YOK).

Girdi: `d27-record.mjs` çıktısı; her segment klasöründe `frames.json`
(dosya adı + gerçek zaman damgası) ve jpeg kareler.

İş akışı: segment başına [başlangıç, bitiş] penceresi seç → hedef fps'e zaman
damgasına göre EN YAKIN kareyi al → tek ortak palet (adaptive, ≤ MAX_COLORS) →
kareler arası değişmeyen pikselleri saydamlaştır (frame differencing) →
`disposal=1`, `optimize=True` ile animasyonlu GIF.

Yollar ortamdan; mutlak yol gömülü değil:
  FRAMES_DIR=<ham kare klasörü> OUT_GIF=<hedef .gif> [OUT_POSTER=<.jpg>]
  [WIDTH=800] [FPS=12] [MAX_COLORS=256] [DIFF_THRESHOLD=6] [DITHER=0]
  [<SEGMENT>_FROM/_TO=ms] [POSTER_INDEX=n] python3 scratchpad/d27-gif.py
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image

FRAMES = Path(os.environ["FRAMES_DIR"])
OUT_GIF = Path(os.environ["OUT_GIF"])
OUT_POSTER = os.environ.get("OUT_POSTER")
WIDTH = int(os.environ.get("WIDTH", "800"))
FPS = int(os.environ.get("FPS", "14"))
MAX_COLORS = int(os.environ.get("MAX_COLORS", "160"))
DITHER = Image.Dither.FLOYDSTEINBERG if os.environ.get("DITHER", "0") == "1" else Image.Dither.NONE
# Kareler arası "değişti" eşiği (0–255, kanal başına en büyük fark).
DIFF_THRESHOLD = int(os.environ.get("DIFF_THRESHOLD", "10"))

def key_times(name: str) -> list[int]:
    raw = os.environ.get(f"{name}_KEYS", "").strip()
    return [int(v) for v in raw.split(",") if v.strip()]


# (klasör, pencere başlangıcı ms, pencere sonu ms, zorunlu anlar) — ölü zaman
# burada kırpılır, `_KEYS` ise kısa olayları (namlu alevi) garantiye alır.
SEGMENTS = [
    ("01-look", int(os.environ.get("LOOK_FROM", "220")), int(os.environ.get("LOOK_TO", "3180")), key_times("LOOK")),
    ("02-emote", int(os.environ.get("EMOTE_FROM", "300")), int(os.environ.get("EMOTE_TO", "3100")), key_times("EMOTE")),
    ("03-board", int(os.environ.get("BOARD_FROM", "120")), int(os.environ.get("BOARD_TO", "1800")), key_times("BOARD")),
    (
        os.environ.get("EXEC_DIR", "04-execution"),
        int(os.environ.get("EXEC_FROM", "250")),
        int(os.environ.get("EXEC_TO", "3850")),
        key_times("EXEC"),
    ),
]


def sample(folder: str, start_ms: int, end_ms: int, keys: list[int]) -> list[Image.Image]:
    """Pencereyi hedef fps'e yeniden örnekler: her zaman noktası için en yakın kare.

    `keys`: kaçırılmaması gereken anlar (ör. namlu alevi 120 ms sürer ve 12 fps
    ızgarasının iki örneği arasına düşebilir). Bu anlara en yakın ızgara noktası
    tam o zamana ÇEKİLİR; kare sayısı ve süre değişmez.
    """
    meta = json.loads((FRAMES / folder / "frames.json").read_text())
    rows = meta["frames"]
    t0 = rows[0]["t"]
    times = [r["t"] - t0 for r in rows]
    step = 1000.0 / FPS
    grid: list[float] = []
    t = float(start_ms)
    while t <= end_ms:
        grid.append(t)
        t += step
    for key in keys:
        j = min(range(len(grid)), key=lambda k: abs(grid[k] - key))
        grid[j] = float(key)
    out: list[Image.Image] = []
    for moment in grid:
        i = min(range(len(times)), key=lambda k: abs(times[k] - moment))
        image = Image.open(FRAMES / folder / rows[i]["file"]).convert("RGB")
        height = round(image.height * WIDTH / image.width)
        out.append(image.resize((WIDTH, height), Image.LANCZOS))
    return out


def build(frames: list[Image.Image], path: Path) -> int:
    """Ortak palet + frame differencing ile GIF yazar; bayt sayısını döner."""
    # Ortak palet: karelerin ızgara örneğinden tek palet üretilir; sahne
    # kesmelerinde renk atlaması olmaması için tüm kareler aynı paleti kullanır.
    strip = Image.new("RGB", (frames[0].width, frames[0].height * len(frames)))
    for i, f in enumerate(frames):
        strip.paste(f, (0, i * frames[0].height))
    # Son renk saydamlığa ayrılır.
    palette_img = strip.quantize(colors=MAX_COLORS - 1, method=Image.Quantize.MEDIANCUT)
    palette = palette_img.getpalette()[: (MAX_COLORS - 1) * 3]
    reference = Image.new("P", (16, 16))
    reference.putpalette(palette + [0, 0, 0])
    transparent = MAX_COLORS - 1

    quantized = [f.quantize(palette=reference, dither=DITHER) for f in frames]
    out = [quantized[0]]
    # İzleyicinin GÖRDÜĞÜ kare: karşılaştırma buna göre yapılır, böylece "az
    # değişti" diye atlanan piksel kare kare birikip leke yapmaz (hata kanal
    # başına en çok DIFF_THRESHOLD kalır).
    shown = np.asarray(frames[0], dtype=np.int16)
    for source, current in zip(frames[1:], quantized[1:]):
        rgb = np.asarray(source, dtype=np.int16)
        # JPEG gürültüsü tüm karede indis oynatıyor; eşik altındaki piksel
        # tuvalde kalır (saydam) ve GIF sözlüğü uzun aynı dizileri sıkıştırır.
        changed = np.abs(rgb - shown).max(axis=2) > DIFF_THRESHOLD
        index = np.asarray(current)
        frame = Image.fromarray(np.where(changed, index, transparent).astype(np.uint8)).convert("P")
        frame.putpalette(palette + [0, 0, 0])
        out.append(frame)
        shown = np.where(changed[..., None], rgb, shown)

    out[0].save(
        path,
        save_all=True,
        append_images=out[1:],
        duration=round(1000 / FPS),
        loop=0,
        optimize=True,
        disposal=1,
        transparency=transparent,
    )
    return path.stat().st_size


def main() -> None:
    frames: list[Image.Image] = []
    for folder, start, end, keys in SEGMENTS:
        part = sample(folder, start, end, keys)
        print(f"{folder}: {len(part)} kare ({(end - start) / 1000:.2f} s)")
        frames.extend(part)
    total = len(frames) / FPS
    OUT_GIF.parent.mkdir(parents=True, exist_ok=True)
    size = build(frames, OUT_GIF)
    print(
        f"GIF: {OUT_GIF} · {len(frames)} kare · {total:.2f} s · {FPS} fps · "
        f"{frames[0].width}x{frames[0].height} · {size / 1048576:.2f} MB"
    )
    if OUT_POSTER:
        index = int(os.environ.get("POSTER_INDEX", str(len(frames) - 1)))
        poster = frames[max(0, min(index, len(frames) - 1))]
        target = Path(OUT_POSTER)
        for quality in (86, 80, 74, 68, 62, 56):
            poster.save(target, "JPEG", quality=quality, optimize=True, progressive=True)
            if target.stat().st_size <= 200 * 1024:
                break
        print(f"poster: {target} · kare {index} · {target.stat().st_size / 1024:.0f} KB")
    if size > 8 * 1024 * 1024:
        print("UYARI: 8 MB üst sınırı aşıldı", file=sys.stderr)


if __name__ == "__main__":
    main()
