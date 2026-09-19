#!/usr/bin/env python3
"""D27 tur 4 — aynı ham karelerden AKICI çıktı: animasyonlu WebP (README) ve
isteğe bağlı VP8 WebM (Playwright'in ffmpeg'i ile). GIF'in 12 fps / 256 renk
sınırı yok: 25–30 fps, tam renk.

Ortam: FRAMES_DIR, OUT_WEBP, [OUT_WEBM, FFMPEG], WIDTH=800, FPS=25, QUALITY=72,
pencereler d27-gif.py ile aynı adlarla (LOOK_FROM … EXEC_TO).
"""
import json, os, subprocess, io
from pathlib import Path
from PIL import Image

FRAMES = Path(os.environ["FRAMES_DIR"])
WIDTH = int(os.environ.get("WIDTH", "800"))
FPS = int(os.environ.get("FPS", "25"))
QUALITY = int(os.environ.get("QUALITY", "72"))
SEGMENTS = [
    ("01-look", int(os.environ.get("LOOK_FROM", "260")), int(os.environ.get("LOOK_TO", "3120"))),
    ("02-emote", int(os.environ.get("EMOTE_FROM", "330")), int(os.environ.get("EMOTE_TO", "3030"))),
    ("03-board", int(os.environ.get("BOARD_FROM", "120")), int(os.environ.get("BOARD_TO", "1760"))),
    (os.environ.get("EXEC_DIR", "04-execution"), int(os.environ.get("EXEC_FROM", "300")), int(os.environ.get("EXEC_TO", "3620"))),
]

def sample(folder, start_ms, end_ms):
    rows = json.loads((FRAMES / folder / "frames.json").read_text())["frames"]
    t0 = rows[0]["t"]; times = [r["t"] - t0 for r in rows]
    out, t, step, cache = [], float(start_ms), 1000.0 / FPS, {}
    while t <= end_ms:
        i = min(range(len(times)), key=lambda k: abs(times[k] - t))
        if i not in cache:
            im = Image.open(FRAMES / folder / rows[i]["file"]).convert("RGB")
            cache[i] = im.resize((WIDTH, round(im.height * WIDTH / im.width)), Image.LANCZOS)
        out.append(cache[i]); t += step
    return out

def native(folder, start_ms, end_ms):
    """Yeniden örnekleme YOK: her ham kare kendi gerçek süresiyle (45 fps'e yakın, düzensiz
    aralıklı yakalama → sabit ızgaraya oturtmak titreme üretir; WebP kare başına süre taşır)."""
    rows = json.loads((FRAMES / folder / "frames.json").read_text())["frames"]
    t0 = rows[0]["t"]; pick = [(r["t"] - t0, r["file"]) for r in rows if start_ms <= r["t"] - t0 <= end_ms]
    ims, durs = [], []
    for k, (t, name) in enumerate(pick):
        im = Image.open(FRAMES / folder / name).convert("RGB")
        ims.append(im.resize((WIDTH, round(im.height * WIDTH / im.width)), Image.LANCZOS))
        nxt = pick[k + 1][0] if k + 1 < len(pick) else min(end_ms, t + 33)
        durs.append(max(11, round(nxt - t)))
    return ims, durs

NATIVE = os.environ.get("NATIVE") == "1"
if NATIVE:
    frames, durations = [], []
    for seg in SEGMENTS:
        a, b = native(*seg); frames += a; durations += b
    print(f"yerel zamanlama: {len(frames)} kare, {sum(durations)/1000:.2f} s, ortanca kare {sorted(durations)[len(durations)//2]} ms")
else:
    frames = [f for seg in SEGMENTS for f in sample(*seg)]
    durations = round(1000 / FPS)
print(f"{len(frames)} kare, {frames[0].size}")

out = Path(os.environ["OUT_WEBP"])
frames[0].save(out, format="WEBP", save_all=True, append_images=frames[1:], duration=durations,
               loop=0, quality=QUALITY, method=6, minimize_size=True, allow_mixed=True)
print(f"webp: {out.stat().st_size/1048576:.2f} MiB")

webm, ffmpeg = os.environ.get("OUT_WEBM"), os.environ.get("FFMPEG")
if webm and ffmpeg:
    p = subprocess.Popen([ffmpeg, "-y", "-loglevel", "error", "-f", "image2pipe", "-c:v", "mjpeg", "-r", str(FPS), "-i", os.environ.get("FFIN", "pipe:0"),
                          "-c:v", "libvpx", "-b:v", os.environ.get("BITRATE", "2500k"), "-qmin", "4", "-qmax", "30",
                          "-deadline", "good", "-an", webm], stdin=subprocess.PIPE)
    for f in frames:
        buf = io.BytesIO(); f.save(buf, "JPEG", quality=95); p.stdin.write(buf.getvalue())
    p.stdin.close(); p.wait()
    print(f"webm: {Path(webm).stat().st_size/1048576:.2f} MiB (rc={p.returncode})")
