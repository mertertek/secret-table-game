#!/usr/bin/env python3
"""D2 oda tasarımı: plan.svg (üstten), elevation.svg (arka duvar kesiti), concept.svg (konsept).

Ölçüler metre; sahne koordinatı: masa yüzeyi y=0, zemin y=-0.81 (h = y + 0.81, h zeminden yükseklik).
Oda: uzatılmış sekizgen, x ±4.6, z ±4.0, köşe pahı 1.5 m; tavan h 3.3 (y 2.49).
Çalıştır: python3 docs/design/d2/gen_d2.py  → aynı klasöre yazar.
"""
import math, os
OUT = os.path.dirname(os.path.abspath(__file__))

# ---- palet (docs/design/D2-room.md §3 ile aynı) -----------------------------------------
P = dict(
    floor='#4a3220', floor2='#5e4129', floorLine='#2c1c10', rug='#243932', rugLine='#b49359',
    wainscot='#3a2617', wainscot2='#4c3320', walnut='#583b2b', wallpaper='#2b4438', wallpaper2='#355344',
    wallGold='#6f5b36', ceiling='#cdbb98', ceiling2='#a8976f', cornice='#e2d3b3',
    velvet='#5c2a30', velvet2='#7a3a40', night='#132236', night2='#25405c', moon='#f1e6c8',
    brass='#b49359', brassDark='#8a6d3b', lampGreen='#2f6b4f', lampGlow='#e9f2d2', lampWarm='#ffd08a',
    paper='#d8c7a0', ink='#252b2c', felt='#234b40', cream='#eee1c7', smoke='#cfc6b5', fog='#101715',
    books=['#6b3a3a', '#3d5a4a', '#8a6d3b', '#2f3f5c', '#5a4634', '#b39a6a', '#4a5a3a', '#7d5a48'],
)
SKINS = ['#e8b48c', '#c98a5e', '#8d5a3c']
ACCENTS = ['#7a2f3a', '#c9a227', '#2e7d5b', '#1f3a6e', '#d9772b', '#6a3d8f', '#d07a9a', '#4aa3d8']


def svg(w, h, body, extra_defs=''):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" '
            f'font-family="Helvetica, Arial, sans-serif">\n<defs>{extra_defs}</defs>\n{body}\n</svg>\n')


def write(name, text):
    with open(os.path.join(OUT, name), 'w') as f:
        f.write(text)
    print('yazıldı', name, len(text) // 1024, 'KB')


# ======================================================================================
# 1. PLAN (üstten). 1 m = 70 px; x sağa, z aşağı (yerel oyuncu altta, +z).
# ======================================================================================
def plan():
    S = 70; CX, CY = 400, 400
    def X(x): return CX + x * S
    def Z(z): return CY + z * S
    out = []
    out.append(f'<rect width="1180" height="800" fill="#f5f1e8"/>')
    # oda sekizgeni
    hx, hz, c = 4.6, 4.0, 1.5
    pts = [(-hx + c, -hz), (hx - c, -hz), (hx, -hz + c), (hx, hz - c), (hx - c, hz), (-hx + c, hz), (-hx, hz - c), (-hx, -hz + c)]
    poly = ' '.join(f'{X(x):.1f},{Z(z):.1f}' for x, z in pts)
    out.append(f'<polygon points="{poly}" fill="{P["floor"]}" stroke="{P["ink"]}" stroke-width="6"/>')
    # parke yönü
    for i in range(-9, 10):
        out.append(f'<line x1="{X(-4.6)}" y1="{Z(i*.45)}" x2="{X(4.6)}" y2="{Z(i*.45)}" stroke="{P["floorLine"]}" stroke-width=".6" opacity=".5"/>')
    out.append(f'<clipPath id="room"><polygon points="{poly}"/></clipPath>')
    # halı
    out.append(f'<ellipse cx="{X(0)}" cy="{Z(0)}" rx="{3.6*S}" ry="{2.75*S}" fill="{P["rug"]}" stroke="{P["rugLine"]}" stroke-width="2"/>')
    out.append(f'<ellipse cx="{X(0)}" cy="{Z(0)}" rx="{3.35*S}" ry="{2.5*S}" fill="none" stroke="{P["rugLine"]}" stroke-width="1" stroke-dasharray="6 4"/>')
    # masa
    out.append(f'<ellipse cx="{X(0)}" cy="{Z(0)}" rx="{2.35*S}" ry="{1.65*S}" fill="{P["walnut"]}"/>')
    out.append(f'<ellipse cx="{X(0)}" cy="{Z(0)}" rx="{2.12*S}" ry="{1.42*S}" fill="{P["felt"]}"/>')
    out.append(f'<rect x="{X(-.97)}" y="{Z(-.62)}" width="{1.94*S}" height="{.45*S}" fill="{P["cream"]}" stroke="{P["ink"]}" stroke-width=".8"/>')
    out.append(f'<rect x="{X(-.97)}" y="{Z(-.07)}" width="{1.94*S}" height="{.45*S}" fill="{P["cream"]}" stroke="{P["ink"]}" stroke-width=".8"/>')
    # koltuk elipsi ve sandalyeler (10)
    out.append(f'<ellipse cx="{X(0)}" cy="{Z(0)}" rx="{2.64*S}" ry="{2.0*S}" fill="none" stroke="#c0564e" stroke-width="1.2" stroke-dasharray="8 5"/>')
    for k in range(10):
        a = k / 10 * math.tau
        x, z = math.sin(a) * 2.64, math.cos(a) * 2.0
        deg = -math.degrees(a)
        out.append(f'<g transform="translate({X(x):.1f},{Z(z):.1f}) rotate({deg:.1f})">'
                   f'<rect x="{-.245*S}" y="{-.23*S}" width="{.49*S}" height="{.46*S}" rx="4" fill="{P["walnut"]}" stroke="{P["ink"]}" stroke-width="1"/>'
                   f'<rect x="{-.245*S}" y="{.16*S}" width="{.49*S}" height="{.07*S}" fill="{P["ink"]}"/>'
                   f'<circle cx="0" cy="{-.02*S}" r="{.2*S}" fill="{SKINS[k%3]}" stroke="{P["ink"]}" stroke-width="1"/></g>')
    # sen
    out.append(f'<text x="{X(0)}" y="{Z(2.0)+30}" text-anchor="middle" font-size="12" fill="#ffb3ad" font-weight="bold">SEN (koltuk 0) · göz h 1,32</text>')

    def box(x, z, w, d, fill, label, rot=0, lx=0, lz=0, fs=11, tc='#f5f1e8'):
        out.append(f'<g transform="translate({X(x):.1f},{Z(z):.1f}) rotate({rot})"><rect x="{-w/2*S}" y="{-d/2*S}" width="{w*S}" height="{d*S}" fill="{fill}" stroke="{P["ink"]}" stroke-width="1.2"/></g>')
        out.append(f'<text x="{X(x+lx):.1f}" y="{Z(z+lz):.1f}" text-anchor="middle" font-size="{fs}" fill="{tc}" font-weight="bold">{label}</text>')

    # arka duvar (-z) öğeleri
    box(-2.1, -3.825, 1.6, .35, P['wainscot2'], 'KİTAPLIK A', lz=.05)
    box(2.1, -3.825, 1.6, .35, P['wainscot2'], 'KİTAPLIK B', lz=.05)
    out.append(f'<rect x="{X(-.9)}" y="{Z(-4.0)-6}" width="{1.8*S}" height="10" fill="{P["night2"]}" stroke="{P["ink"]}"/>')
    out.append(f'<text x="{X(0)}" y="{Z(-4.0)-12}" text-anchor="middle" font-size="11" fill="{P["ink"]}" font-weight="bold">PENCERE 1,8 m (gece)</text>')
    for sx in (-1.15, 1.15):
        out.append(f'<path d="M{X(sx-.25)},{Z(-3.95)} q{.12*S},{.12*S} {.25*S},0 q{.12*S},{.12*S} {.25*S},0" fill="none" stroke="{P["velvet2"]}" stroke-width="5"/>')
    box(0, -3.75, 1.7, .45, P['walnut'], 'KONSOL · radyo · sürahi', lz=.04, fs=10)
    # yan duvarlar
    box(-4.5, -.3, .12, 1.5, P['paper'], '', rot=0)
    out.append(f'<text x="{X(-4.85)}" y="{Z(-.25)}" font-size="11" fill="{P["ink"]}" font-weight="bold" transform="rotate(-90 {X(-4.85)} {Z(-.25)})">HARİTA 1,5×1,1</text>')
    box(4.5, -.4, .12, 2.2, P['paper'], '', rot=0)
    out.append(f'<text x="{X(4.68)}" y="{Z(-.35)}" font-size="11" fill="{P["ink"]}" font-weight="bold" transform="rotate(90 {X(4.68)} {Z(-.35)})">3 AFİŞ + SAAT</text>')
    # lambalar ve sehpalar
    for sx in (-3.6, 3.6):
        out.append(f'<circle cx="{X(sx)}" cy="{Z(-1.7)}" r="{.32*S}" fill="{P["lampWarm"]}" opacity=".35"/>')
        out.append(f'<circle cx="{X(sx)}" cy="{Z(-1.7)}" r="{.2*S}" fill="{P["cream"]}" stroke="{P["ink"]}"/>')
        out.append(f'<text x="{X(sx)}" y="{Z(-1.7)+4}" text-anchor="middle" font-size="9" fill="{P["ink"]}">LAMBA</text>')
        box(sx, -.95, .5, .5, P['walnut'], 'sehpa', fs=9)
    # avize
    out.append(f'<circle cx="{X(0)}" cy="{Z(0)}" r="{.65*S}" fill="none" stroke="{P["brass"]}" stroke-width="3" stroke-dasharray="3 3"/>')
    out.append(f'<text x="{X(0)}" y="{Z(0)+4}" text-anchor="middle" font-size="10" fill="{P["cream"]}" font-weight="bold">AVİZE r 0,65 · h 2,76</text>')
    # köşe eşyaları
    box(-3.9, -3.3, .5, .5, '#3d5a4a', 'bitki', rot=45, fs=9)
    box(3.9, -3.3, .5, .5, '#3d5a4a', 'küre', rot=45, fs=9)
    box(-3.9, 3.3, .4, .4, P['walnut'], 'askı', rot=45, fs=9)
    box(3.9, 3.3, .5, .5, P['walnut'], 'bar', rot=45, fs=9)
    # kapı (yakın duvar)
    out.append(f'<rect x="{X(-.65)}" y="{Z(4.0)-5}" width="{1.3*S}" height="10" fill="{P["walnut"]}" stroke="{P["ink"]}"/>')
    out.append(f'<text x="{X(0)}" y="{Z(4.0)+22}" text-anchor="middle" font-size="11" fill="{P["ink"]}" font-weight="bold">ÇİFT KAPI 1,3 m (senin arkan — sade)</text>')
    # aplikler (pah duvarları)
    for (x, z) in [(-3.85, -3.25), (3.85, -3.25), (-3.85, 3.25), (3.85, 3.25)]:
        out.append(f'<circle cx="{X(x)+(14 if x<0 else -14)*(-1 if z>0 else 1)*0}" cy="{Z(z)}" r="5" fill="{P["lampWarm"]}" stroke="{P["ink"]}"/>')
    # genel bakış kamerası (odanın dışında)
    out.append(f'<g transform="translate({X(0)},{Z(5.07)})"><polygon points="-14,10 14,10 0,-12" fill="#c0564e"/><text x="0" y="28" text-anchor="middle" font-size="11" fill="#c0564e" font-weight="bold">GENEL BAKIŞ KAMERASI (0, +5,9, +5,1) — duvar dışı; iç yüz tek taraflı</text></g>')
    # ölçü çizgileri
    out.append(f'<line x1="{X(-4.6)}" y1="{Z(-4.45)}" x2="{X(4.6)}" y2="{Z(-4.45)}" stroke="{P["ink"]}" stroke-width="1"/>')
    out.append(f'<text x="{X(0)}" y="{Z(-4.45)-5}" text-anchor="middle" font-size="12" fill="{P["ink"]}">9,2 m</text>')
    out.append(f'<line x1="{X(-5.1)}" y1="{Z(-4.0)}" x2="{X(-5.1)}" y2="{Z(4.0)}" stroke="{P["ink"]}" stroke-width="1"/>')
    out.append(f'<text x="{X(-5.2)}" y="{Z(0)}" text-anchor="middle" font-size="12" fill="{P["ink"]}" transform="rotate(-90 {X(-5.2)} {Z(0)})">8,0 m</text>')
    out.append(f'<text x="{X(-4.55)}" y="{Z(-3.7)}" font-size="9" fill="{P["ink"]}">pah 1,5</text>')
    # lejant
    lx, ly = 760, 60
    legend = [
        ('D2 — Oda planı (üstten)', None), ('Ölçek 1 m = 70 px · sahne x sağa, z aşağı', None),
        ('Zemin: balıksırtı parke (prosedürel), h 0', P['floor']), ('Halı: yeşil, art-deco pirinç bordür 7,2×5,5', P['rug']),
        ('Masa 4,7×3,3 (mevcut) · keçe', P['felt']), ('Koltuk elipsi x 2,64 · z 2,0 (mevcut)', '#c0564e'),
        ('Lambri h 1,35 + pirinç ray · üstü duvar kâğıdı', P['wainscot']), ('Kitaplık 1,6×0,35×2,3 (×2)', P['wainscot2']),
        ('Pencere 1,8×1,7 · kadife perde bordo', P['velvet']), ('Konsol 1,7×0,45×0,85: radyo, sürahi, yeşil lamba', P['walnut']),
        ('Ayaklı lamba ×2 (mevcut, x ±3,6 z −1,7)', P['lampWarm']), ('Avize: pirinç halka r 0,65, 8 abajur', P['brass']),
        ('Aplik ×4 (yalnız emissive, ışık yok)', P['lampWarm']), ('Köşe: bitki / küre / askı / bar arabası (D2.3)', '#3d5a4a'),
        ('Tavan h 3,3 (y 2,49) kasetli doku', P['ceiling']),
    ]
    out.append(f'<rect x="{lx-14}" y="{ly-30}" width="410" height="{len(legend)*24+40}" fill="#fffdf8" stroke="{P["ink"]}" stroke-width="1" rx="6"/>')
    for i, (t, col) in enumerate(legend):
        y = ly + i * 24
        if col:
            out.append(f'<rect x="{lx}" y="{y-11}" width="16" height="14" fill="{col}" stroke="{P["ink"]}" stroke-width=".6"/>')
            out.append(f'<text x="{lx+24}" y="{y}" font-size="12" fill="{P["ink"]}">{t}</text>')
        else:
            out.append(f'<text x="{lx}" y="{y}" font-size="{15 if i==0 else 11}" font-weight="{"bold" if i==0 else "normal"}" fill="{P["ink"]}">{t}</text>')
    return svg(1180, 800, '\n'.join(out))


# ======================================================================================
# 2. ELEVATION — arka duvar (z=-4) koltuktan görünüş, ortografik. 1 m = 100 px.
# ======================================================================================
def elevation():
    S = 100; OX, OY = 90, 420  # OY = zemin çizgisi
    def X(x): return OX + (x + 4.6) * S
    def H(h): return OY - h * S
    o = []
    o.append('<rect width="1140" height="520" fill="#f5f1e8"/>')
    # duvar kâğıdı + lambri + pah bölgeleri
    o.append(f'<rect x="{X(-4.6)}" y="{H(3.3)}" width="{9.2*S}" height="{3.3*S}" fill="{P["wallpaper"]}"/>')
    for i in range(0, 46):
        x = X(-4.6) + i * 20
        o.append(f'<path d="M{x},{H(3.3)} l10,14 l10,-14" fill="none" stroke="{P["wallpaper2"]}" stroke-width="1" opacity=".8"/>')
        o.append(f'<path d="M{x},{H(1.35)-20} l10,14 l10,-14" fill="none" stroke="{P["wallGold"]}" stroke-width=".8" opacity=".6"/>')
    o.append(f'<rect x="{X(-4.6)}" y="{H(1.35)}" width="{9.2*S}" height="{1.35*S}" fill="{P["wainscot"]}"/>')
    for i in range(12):
        x = X(-4.6) + 12 + i * 76
        o.append(f'<rect x="{x}" y="{H(1.2)}" width="58" height="{.95*S}" fill="none" stroke="{P["wainscot2"]}" stroke-width="3" rx="2"/>')
    o.append(f'<rect x="{X(-4.6)}" y="{H(1.37)}" width="{9.2*S}" height="5" fill="{P["brass"]}"/>')  # ray
    o.append(f'<rect x="{X(-4.6)}" y="{H(.12)}" width="{9.2*S}" height="12" fill="{P["walnut"]}"/>')  # süpürgelik
    o.append(f'<rect x="{X(-4.6)}" y="{H(3.3)}" width="{9.2*S}" height="14" fill="{P["cornice"]}"/>')  # korniş
    o.append(f'<rect x="{X(-4.6)}" y="{H(3.3)+14}" width="{9.2*S}" height="4" fill="{P["brassDark"]}"/>')
    # pah sınırları
    for x in (-3.1, 3.1):
        o.append(f'<line x1="{X(x)}" y1="{H(0)}" x2="{X(x)}" y2="{H(3.3)}" stroke="{P["ink"]}" stroke-width="1" stroke-dasharray="4 4"/>')
    o.append(f'<text x="{X(-3.85)}" y="{H(3.3)-6}" text-anchor="middle" font-size="10" fill="{P["ink"]}">pah duvarı (45°)</text>')
    o.append(f'<text x="{X(3.85)}" y="{H(3.3)-6}" text-anchor="middle" font-size="10" fill="{P["ink"]}">pah duvarı (45°)</text>')
    # aplikler pah duvarlarında
    for x in (-3.85, 3.85):
        o.append(f'<circle cx="{X(x)}" cy="{H(2.0)}" r="22" fill="{P["lampWarm"]}" opacity=".35"/>')
        o.append(f'<path d="M{X(x)-12},{H(1.95)} l24,0 l-6,-16 l-12,0 z" fill="{P["cream"]}" stroke="{P["brassDark"]}"/>')
        o.append(f'<rect x="{X(x)-3}" y="{H(1.95)}" width="6" height="18" fill="{P["brass"]}"/>')
    # kitaplıklar
    for cx in (-2.1, 2.1):
        o.append(f'<rect x="{X(cx-.8)}" y="{H(2.3)}" width="{1.6*S}" height="{2.3*S}" fill="{P["wainscot2"]}" stroke="{P["ink"]}" stroke-width="1.5"/>')
        o.append(f'<rect x="{X(cx-.8)-4}" y="{H(2.3)-8}" width="{1.6*S+8}" height="10" fill="{P["walnut"]}"/>')
        for r in range(5):
            y = H(.35 + r * .42)
            o.append(f'<rect x="{X(cx-.75)}" y="{y-2}" width="{1.5*S}" height="4" fill="{P["walnut"]}"/>')
            x = X(cx - .73)
            k = 0
            while x < X(cx + .72) - 8:
                w = 7 + (k * 7 + r * 3) % 9; hh = 24 + (k * 5 + r * 7) % 12
                o.append(f'<rect x="{x}" y="{y-2-hh}" width="{w}" height="{hh}" fill="{P["books"][(k+r)%8]}"/>')
                x += w + 1; k += 1
    # pencere
    o.append(f'<rect x="{X(-.9)}" y="{H(2.6)}" width="{1.8*S}" height="{1.7*S}" fill="{P["night"]}" stroke="{P["walnut"]}" stroke-width="8"/>')
    o.append(f'<circle cx="{X(.45)}" cy="{H(2.25)}" r="16" fill="{P["moon"]}"/>')
    for i, (bx, bh) in enumerate([(-.8, .5), (-.6, .8), (-.35, .6), (-.1, .95), (.15, .7), (.4, .55), (.65, .85)]):
        o.append(f'<rect x="{X(bx)}" y="{H(.9+bh)}" width="{.2*S}" height="{bh*S}" fill="{P["night2"]}"/>')
        o.append(f'<rect x="{X(bx)+6}" y="{H(.9+bh*.6)}" width="4" height="5" fill="{P["lampWarm"]}"/>')
    o.append(f'<line x1="{X(0)}" y1="{H(2.6)}" x2="{X(0)}" y2="{H(.9)}" stroke="{P["walnut"]}" stroke-width="6"/>')
    o.append(f'<line x1="{X(-.9)}" y1="{H(1.75)}" x2="{X(.9)}" y2="{H(1.75)}" stroke="{P["walnut"]}" stroke-width="6"/>')
    o.append(f'<rect x="{X(-.95)}" y="{H(.9)}" width="{1.9*S}" height="6" fill="{P["walnut"]}"/>')
    # perdeler + pelmet
    for sx in (-1.4, .9):
        o.append(f'<rect x="{X(sx)}" y="{H(2.75)}" width="{.5*S}" height="{2.65*S}" fill="{P["velvet"]}"/>')
        for i in range(5):
            o.append(f'<line x1="{X(sx)+8+i*10}" y1="{H(2.75)}" x2="{X(sx)+6+i*10}" y2="{H(.1)}" stroke="{P["velvet2"]}" stroke-width="3"/>')
        o.append(f'<rect x="{X(sx)}" y="{H(1.3)}" width="{.5*S}" height="6" fill="{P["brass"]}"/>')  # bağ kordonu
    o.append(f'<rect x="{X(-1.45)}" y="{H(2.9)}" width="{2.9*S}" height="{.18*S}" fill="{P["velvet"]}" stroke="{P["brass"]}" stroke-width="2"/>')
    # konsol + eşyalar
    o.append(f'<rect x="{X(-.85)}" y="{H(.85)}" width="{1.7*S}" height="{.85*S}" fill="{P["walnut"]}" stroke="{P["ink"]}" stroke-width="1.5"/>')
    for i in range(3):
        o.append(f'<rect x="{X(-.8)+i*54}" y="{H(.78)}" width="50" height="{.68*S}" fill="none" stroke="{P["wainscot2"]}" stroke-width="2"/>')
        o.append(f'<circle cx="{X(-.8)+i*54+25}" cy="{H(.45)}" r="3" fill="{P["brass"]}"/>')
    # radyo
    o.append(f'<rect x="{X(-.7)}" y="{H(1.25)}" width="{.45*S}" height="{.4*S}" rx="10" fill="{P["walnut"]}" stroke="{P["ink"]}"/>')
    o.append(f'<rect x="{X(-.64)}" y="{H(1.2)}" width="{.2*S}" height="{.28*S}" rx="4" fill="{P["paper"]}"/>')
    o.append(f'<rect x="{X(-.41)}" y="{H(1.12)}" width="{.12*S}" height="{.05*S}" fill="{P["lampWarm"]}"/>')
    # yeşil abajurlu masa lambası
    o.append(f'<rect x="{X(.5)}" y="{H(.88)}" width="16" height="{.36*S}" fill="{P["brass"]}"/>')
    o.append(f'<path d="M{X(.3)},{H(1.22)} l56,0 l-8,-14 l-40,0 z" fill="{P["lampGreen"]}" stroke="{P["brassDark"]}"/>')
    o.append(f'<ellipse cx="{X(.58)}" cy="{H(1.1)}" rx="40" ry="18" fill="{P["lampGlow"]}" opacity=".35"/>')
    # sürahi / bardaklar
    o.append(f'<path d="M{X(.05)},{H(.85)} l0,-22 l-6,-8 l0,-10 l16,0 l0,10 l-6,8 l0,22 z" fill="{P["moon"]}" opacity=".8" stroke="{P["ink"]}" stroke-width=".8"/>')
    for i in range(3):
        o.append(f'<rect x="{X(.14)+i*9}" y="{H(.85)-14}" width="7" height="14" fill="{P["moon"]}" opacity=".7" stroke="{P["ink"]}" stroke-width=".6"/>')
    # masa çizgisi, oyuncu başları (karşı koltuklar), etiketler, göz çizgisi
    o.append(f'<rect x="{X(-2.35)}" y="{H(.81)}" width="{4.7*S}" height="8" fill="{P["walnut"]}" opacity=".9"/>')
    o.append(f'<text x="{X(-4.55)}" y="{H(.81)-4}" font-size="10" fill="{P["cream"]}">masa yüzeyi h 0,81 (y 0)</text>')
    for i, x in enumerate((-1.87, 0, 1.87)):
        sk = SKINS[i]; ac = ACCENTS[(i * 3) % 8]
        o.append(f'<rect x="{X(x-.3)}" y="{H(.81)}" width="{.6*S}" height="{.5*S}" rx="12" fill="{ac}"/>')
        o.append(f'<rect x="{X(x-.35)}" y="{H(.95)}" width="{.7*S}" height="{.35*S}" rx="18" fill="{ac}"/>')
        o.append(f'<circle cx="{X(x)}" cy="{H(1.36)}" r="{.2*S}" fill="{sk}" stroke="{P["ink"]}" stroke-width="1"/>')
        o.append(f'<circle cx="{X(x)-7}" cy="{H(1.38)}" r="3" fill="{P["ink"]}"/><circle cx="{X(x)+7}" cy="{H(1.38)}" r="3" fill="{P["ink"]}"/>')
        o.append(f'<rect x="{X(x)-40}" y="{H(1.86)}" width="80" height="26" rx="5" fill="#17241f" opacity=".86" stroke="#59625a"/>')
        o.append(f'<text x="{X(x)}" y="{H(1.86)+17}" text-anchor="middle" font-size="11" fill="{P["cream"]}" font-weight="bold">{["Ada","Barış","Selin"][i]}</text>')
    o.append(f'<line x1="{X(-4.6)}" y1="{H(1.32)}" x2="{X(4.6)}" y2="{H(1.32)}" stroke="#c0564e" stroke-width="1" stroke-dasharray="6 4"/>')
    o.append(f'<text x="{X(3.2)}" y="{H(1.32)-4}" font-size="10" fill="#e08a82" font-weight="bold">göz çizgisi h 1,32 (y 0,51)</text>')
    # avize önde (kesikli)
    o.append(f'<line x1="{X(0)}" y1="{H(3.3)}" x2="{X(0)}" y2="{H(2.85)}" stroke="{P["brass"]}" stroke-width="3" stroke-dasharray="4 3"/>')
    o.append(f'<ellipse cx="{X(0)}" cy="{H(2.76)}" rx="{.65*S}" ry="10" fill="none" stroke="{P["brass"]}" stroke-width="4" stroke-dasharray="5 3"/>')
    for i in range(-3, 4):
        x = X(i * .2)
        o.append(f'<path d="M{x-9},{H(2.72)} l18,0 l-4,-16 l-10,0 z" fill="{P["cream"]}" opacity=".85" stroke="{P["brassDark"]}" stroke-dasharray="2 2"/>')
    o.append(f'<text x="{X(0)}" y="{H(3.3)-22}" text-anchor="middle" font-size="10" fill="{P["ink"]}">avize (masanın üstünde, duvarın önünde) h 2,5–2,9 — pelmet arkasında kalır</text>')
    # ölçüler
    o.append(f'<line x1="{X(4.75)}" y1="{H(0)}" x2="{X(4.75)}" y2="{H(3.3)}" stroke="{P["ink"]}"/>')
    for h, t in ((0, '0'), (.81, '0,81 masa'), (1.35, '1,35 ray'), (2.3, '2,3 kitaplık'), (2.6, '2,6 pencere üst'), (3.3, '3,3 tavan')):
        o.append(f'<line x1="{X(4.7)}" y1="{H(h)}" x2="{X(4.8)}" y2="{H(h)}" stroke="{P["ink"]}"/>')
        o.append(f'<text x="{X(4.85)}" y="{H(h)+4}" font-size="10" fill="{P["ink"]}">{t}</text>')
    o.append(f'<text x="20" y="30" font-size="16" font-weight="bold" fill="{P["ink"]}">D2 — Arka duvar (z = −4,0) koltuktan görünüş · ortografik · 1 m = 100 px</text>')
    o.append(f'<text x="20" y="48" font-size="11" fill="{P["ink"]}">Kahraman bant: h 1,6–2,6 (başların ve etiketlerin üstü). Pah duvarları düzleştirilmiş çizildi. Zemin y −0,81.</text>')
    o.append(f'<text x="{X(0)}" y="{H(0)+30}" text-anchor="middle" font-size="11" fill="{P["ink"]}">x = −4,6 … +4,6 (düz bölüm −3,1 … +3,1)</text>')
    return svg(1140, 520, '\n'.join(o))


# ======================================================================================
# 3. CONCEPT — perspektif 1600×900. Göz (0, h 1,85, z 3,4) hafif aşağı; f = 800 px.
# ======================================================================================
EYE_H, EYE_Z, F, HOR, CXP = 1.95, 3.95, 800.0, 300.0, 800.0


def pr(x, h, z):
    d = EYE_Z - z
    s = F / d
    return CXP + x * s, HOR - (h - EYE_H) * s


def pts(seq):
    return ' '.join(f'{px:.1f},{py:.1f}' for px, py in seq)


def poly(seq, fill, extra=''):
    return f'<polygon points="{pts(seq)}" fill="{fill}" {extra}/>'


def wall_quad(x1, h1, x2, h2, z, fill, extra=''):  # arka duvarda dikdörtgen
    return poly([pr(x1, h1, z), pr(x2, h1, z), pr(x2, h2, z), pr(x1, h2, z)], fill, extra)


def side_quad(x, h1, h2, z1, z2, fill, extra=''):  # yan duvarda dikdörtgen
    return poly([pr(x, h1, z1), pr(x, h1, z2), pr(x, h2, z2), pr(x, h2, z1)], fill, extra)


def concept():
    o = []
    defs = f'''
<linearGradient id="wp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1e3129"/><stop offset=".55" stop-color="{P["wallpaper"]}"/><stop offset="1" stop-color="{P["wallpaper2"]}"/></linearGradient>
<linearGradient id="ceil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6a5c44"/><stop offset="1" stop-color="{P["ceiling2"]}"/></linearGradient>
<linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b1d12"/><stop offset="1" stop-color="{P["floor2"]}"/></linearGradient>
<radialGradient id="glowWarm" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="{P["lampWarm"]}" stop-opacity=".9"/><stop offset=".4" stop-color="{P["lampWarm"]}" stop-opacity=".35"/><stop offset="1" stop-color="{P["lampWarm"]}" stop-opacity="0"/></radialGradient>
<radialGradient id="glowGreen" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="{P["lampGlow"]}" stop-opacity=".8"/><stop offset="1" stop-color="{P["lampGlow"]}" stop-opacity="0"/></radialGradient>
<radialGradient id="vig" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".62"/></radialGradient>
<linearGradient id="tableFelt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c3a31"/><stop offset=".5" stop-color="{P["felt"]}"/><stop offset="1" stop-color="#2b5a4c"/></linearGradient>
<linearGradient id="night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d1828"/><stop offset="1" stop-color="{P["night2"]}"/></linearGradient>
<linearGradient id="velvet" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3f1c22"/><stop offset=".3" stop-color="{P["velvet2"]}"/><stop offset=".5" stop-color="#4a2127"/><stop offset=".75" stop-color="{P["velvet2"]}"/><stop offset="1" stop-color="#3f1c22"/></linearGradient>
<linearGradient id="haze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{P["smoke"]}" stop-opacity=".16"/><stop offset="1" stop-color="{P["smoke"]}" stop-opacity="0"/></linearGradient>
<pattern id="damask" width="26" height="26" patternUnits="userSpaceOnUse"><path d="M13,2 l7,11 l-7,11 l-7,-11 z" fill="none" stroke="{P["wallGold"]}" stroke-width=".9" opacity=".55"/><circle cx="13" cy="13" r="2" fill="{P["wallpaper2"]}"/></pattern>
<pattern id="parquet" width="60" height="30" patternUnits="userSpaceOnUse" patternTransform="skewX(0)"><path d="M0,30 L30,0 M30,30 L60,0" stroke="{P["floorLine"]}" stroke-width="1" opacity=".55"/><path d="M0,0 L30,30 M30,0 L60,30" stroke="#6a4a2f" stroke-width=".6" opacity=".35"/></pattern>
<pattern id="coffer" width="120" height="60" patternUnits="userSpaceOnUse"><rect x="8" y="8" width="104" height="44" fill="none" stroke="#5c4d36" stroke-width="3"/></pattern>
<filter id="blur8"><feGaussianBlur stdDeviation="8"/></filter>
<filter id="blur3"><feGaussianBlur stdDeviation="3"/></filter>
<filter id="blur20"><feGaussianBlur stdDeviation="22"/></filter>
'''
    W, HGT = 1600, 900
    o.append(f'<rect width="{W}" height="{HGT}" fill="{P["fog"]}"/>')
    # ---- tavan (kamera arkasından uzağa): üst şerit
    ceil_far = [pr(-4.6, 3.3, -2.5), pr(-3.1, 3.3, -4), pr(3.1, 3.3, -4), pr(4.6, 3.3, -2.5), (W + 400, -400), (-400, -400)]
    o.append(poly(ceil_far, 'url(#ceil)'))
    o.append(poly(ceil_far, 'url(#coffer)', 'opacity=".5"'))
    # ---- zemin
    floor_far = [pr(-4.6, 0, -2.5), pr(-3.1, 0, -4), pr(3.1, 0, -4), pr(4.6, 0, -2.5), (W + 600, HGT + 300), (-600, HGT + 300)]
    o.append(poly(floor_far, 'url(#floor)'))
    o.append(poly(floor_far, 'url(#parquet)'))
    # halı (elips z=0 merkez): perspektifte yaklaşık dörtgen-elips
    rug = []
    for i in range(48):
        a = i / 48 * math.tau
        rug.append(pr(math.cos(a) * 3.6, 0.005, math.sin(a) * 2.75))
    o.append(poly(rug, P['rug']))
    rug2 = [pr(math.cos(i / 48 * math.tau) * 3.35, 0.005, math.sin(i / 48 * math.tau) * 2.5) for i in range(48)]
    o.append(poly(rug2, 'none', f'stroke="{P["rugLine"]}" stroke-width="2" opacity=".7"'))
    # ---- duvarlar
    # arka duvar üst (duvar kâğıdı) ve alt (lambri)
    o.append(wall_quad(-3.1, 1.35, 3.1, 3.3, -4, 'url(#wp)'))
    o.append(wall_quad(-3.1, 1.35, 3.1, 3.3, -4, 'url(#damask)'))
    o.append(wall_quad(-3.1, 0, 3.1, 1.35, -4, P['wainscot']))
    # pah duvarları (z -4 → -2.5, x ±3.1 → ±4.6)
    for sgn in (-1, 1):
        q = [pr(sgn * 3.1, 1.35, -4), pr(sgn * 4.6, 1.35, -2.5), pr(sgn * 4.6, 3.3, -2.5), pr(sgn * 3.1, 3.3, -4)]
        o.append(poly(q, 'url(#wp)')); o.append(poly(q, 'url(#damask)'))
        q2 = [pr(sgn * 3.1, 0, -4), pr(sgn * 4.6, 0, -2.5), pr(sgn * 4.6, 1.35, -2.5), pr(sgn * 3.1, 1.35, -4)]
        o.append(poly(q2, P['wainscot2'] if sgn < 0 else P['wainscot']))
    # yan duvarlar (z -2.5 → +2.5, kadraj dışına)
    for sgn in (-1, 1):
        o.append(side_quad(sgn * 4.6, 1.35, 3.3, -2.5, 2.4, 'url(#wp)'))
        o.append(side_quad(sgn * 4.6, 1.35, 3.3, -2.5, 2.4, 'url(#damask)'))
        o.append(side_quad(sgn * 4.6, 0, 1.35, -2.5, 2.4, P['wainscot2']))
    # lambri panelleri (arka + pah)
    x = -3.0
    while x < 3.0:
        o.append(wall_quad(x, .2, x + .5, 1.15, -3.99, 'none', f'stroke="{P["wainscot2"]}" stroke-width="2"'))
        x += .6
    for sgn in (-1, 1):
        for i in range(3):
            t0, t1 = i / 3 + .04, (i + 1) / 3 - .04
            q = [pr(sgn * (3.1 + 1.5 * t0), .2, -4 + 1.5 * t0), pr(sgn * (3.1 + 1.5 * t1), .2, -4 + 1.5 * t1), pr(sgn * (3.1 + 1.5 * t1), 1.15, -4 + 1.5 * t1), pr(sgn * (3.1 + 1.5 * t0), 1.15, -4 + 1.5 * t0)]
            o.append(poly(q, 'none', f'stroke="{P["wainscot2"]}" stroke-width="2"'))
    # pirinç ray, süpürgelik, korniş (arka + pah + yan)
    def band(h1, h2, fill):
        seq = [(-4.6, 2.4), (-4.6, -2.5), (-3.1, -4), (3.1, -4), (4.6, -2.5), (4.6, 2.4)]
        for (xa, za), (xb, zb) in zip(seq, seq[1:]):
            o.append(poly([pr(xa, h1, za), pr(xb, h1, zb), pr(xb, h2, zb), pr(xa, h2, za)], fill))
    band(1.33, 1.37, P['brass']); band(0, .12, P['walnut']); band(3.18, 3.3, P['cornice']); band(3.14, 3.18, P['brassDark'])
    # ---- arka duvar öğeleri
    # kitaplıklar
    for cx in (-2.1, 2.1):
        o.append(wall_quad(cx - .8, 0, cx + .8, 2.3, -3.65, P['wainscot2'], f'stroke="{P["ink"]}" stroke-width="1"'))
        # yan derinlik yüzü
        inner = -1 if cx < 0 else 1
        o.append(poly([pr(cx + inner * .8, 0, -3.65), pr(cx + inner * .8, 0, -4), pr(cx + inner * .8, 2.3, -4), pr(cx + inner * .8, 2.3, -3.65)], P['wainscot']))
        for r in range(5):
            hb = .35 + r * .42
            o.append(wall_quad(cx - .75, hb - .02, cx + .75, hb + .02, -3.66, P['walnut']))
            bx = cx - .73; k = 0
            while bx < cx + .7:
                w = (.05 + ((k * 7 + r * 3) % 9) * .008); bh = .24 + ((k * 5 + r * 7) % 12) * .012
                o.append(wall_quad(bx, hb + .02, bx + w, hb + .02 + bh, -3.67, P['books'][(k + r) % 8]))
                bx += w + .008; k += 1
    # pencere: gece + şehir siluetleri + ay
    o.append(wall_quad(-.9, .9, .9, 2.6, -4, 'url(#night)'))
    mx, my = pr(.45, 2.25, -4)
    o.append(f'<circle cx="{mx:.1f}" cy="{my:.1f}" r="12" fill="{P["moon"]}"/>')
    o.append(f'<circle cx="{mx:.1f}" cy="{my:.1f}" r="26" fill="{P["moon"]}" opacity=".18" filter="url(#blur3)"/>')
    for bx, bh, bw in [(-.85, .5, .18), (-.65, .85, .22), (-.4, .6, .16), (-.2, 1.0, .2), (.05, .7, .18), (.28, .55, .14), (.5, .9, .2), (.72, .65, .16)]:
        o.append(wall_quad(bx, .9, bx + bw, .9 + bh, -3.99, '#1a2c44'))
        for j in range(2):
            o.append(wall_quad(bx + .04 + j * .07, .9 + bh * .45, bx + .07 + j * .07, .9 + bh * .45 + .04, -3.98, P['lampWarm'], 'opacity=".8"'))
    # pencere kayıtları ve çerçeve
    o.append(wall_quad(-.03, .9, .03, 2.6, -3.98, P['walnut'])); o.append(wall_quad(-.9, 1.72, .9, 1.78, -3.98, P['walnut']))
    for (a, b) in ((-.97, -.9), (.9, .97)):
        o.append(wall_quad(a, .85, b, 2.66, -3.98, P['walnut']))
    o.append(wall_quad(-.97, 2.6, .97, 2.66, -3.98, P['walnut'])); o.append(wall_quad(-1.0, .84, 1.0, .9, -3.97, P['walnut']))
    # cam parlaması
    o.append(wall_quad(-.85, 1.8, -.2, 2.55, -3.985, '#ffffff', 'opacity=".05"'))
    # perdeler + pelmet
    for sx in (-1.45, .9):
        o.append(wall_quad(sx, .1, sx + .55, 2.78, -3.9, 'url(#velvet)'))
        for i in range(6):
            xx = sx + .05 + i * .09
            o.append(poly([pr(xx, 2.78, -3.89), pr(xx + .02, 2.78, -3.89), pr(xx - .01, .1, -3.89), pr(xx - .03, .1, -3.89)], '#3a181e', 'opacity=".6"'))
        o.append(wall_quad(sx, 1.28, sx + .55, 1.34, -3.88, P['brass']))
    o.append(wall_quad(-1.5, 2.72, 1.5, 2.92, -3.86, P['velvet'], f'stroke="{P["brass"]}" stroke-width="2"'))
    # konsol
    o.append(wall_quad(-.85, 0, .85, .85, -3.55, P['walnut'], f'stroke="{P["ink"]}" stroke-width="1"'))
    o.append(poly([pr(-.85, .85, -3.55), pr(.85, .85, -3.55), pr(.85, .85, -4), pr(-.85, .85, -4)], '#6a4834'))
    for i in range(3):
        o.append(wall_quad(-.78 + i * .54, .1, -.3 + i * .54, .75, -3.54, 'none', f'stroke="{P["wainscot"]}" stroke-width="2"'))
    # radyo
    o.append(wall_quad(-.72, .85, -.27, 1.25, -3.72, P['walnut'], f'stroke="{P["ink"]}" stroke-width="1" rx="6"'))
    o.append(wall_quad(-.66, .93, -.46, 1.19, -3.71, P['paper'])); o.append(wall_quad(-.42, .96, -.31, 1.0, -3.71, P['lampWarm']))
    # yeşil abajurlu lamba
    lx_, ly_ = pr(.55, 1.1, -3.7)
    o.append(f'<ellipse cx="{lx_:.1f}" cy="{ly_+6:.1f}" rx="70" ry="34" fill="url(#glowGreen)"/>')
    o.append(wall_quad(.53, .85, .57, 1.2, -3.7, P['brass']))
    o.append(poly([pr(.32, 1.2, -3.7), pr(.78, 1.2, -3.7), pr(.7, 1.33, -3.7), pr(.4, 1.33, -3.7)], P['lampGreen'], f'stroke="{P["brassDark"]}"'))
    o.append(poly([pr(.34, 1.2, -3.7), pr(.76, 1.2, -3.7), pr(.72, 1.23, -3.7), pr(.38, 1.23, -3.7)], P['lampGlow'], 'opacity=".9"'))
    # sürahi ve bardaklar
    o.append(wall_quad(.02, .85, .12, 1.12, -3.7, P['moon'], 'opacity=".75"'))
    for i in range(3):
        o.append(wall_quad(.16 + i * .08, .85, .22 + i * .08, .97, -3.7, P['moon'], 'opacity=".65"'))
    # aplikler pah duvarlarında
    for sgn in (-1, 1):
        ax, ay = pr(sgn * 3.85, 2.0, -3.25)
        o.append(f'<ellipse cx="{ax:.1f}" cy="{ay:.1f}" rx="90" ry="120" fill="url(#glowWarm)" opacity=".7"/>')
        o.append(f'<path d="M{ax-14},{ay+6} l28,0 l-7,-18 l-14,0 z" fill="{P["cream"]}" stroke="{P["brassDark"]}"/>')
        o.append(f'<rect x="{ax-3}" y="{ay+6}" width="6" height="18" fill="{P["brass"]}"/>')
    # sol duvar: harita
    mp = [pr(-4.58, 1.6, -1.6), pr(-4.58, 1.6, -.1), pr(-4.58, 2.7, -.1), pr(-4.58, 2.7, -1.6)]
    o.append(poly(mp, P['paper'], f'stroke="{P["walnut"]}" stroke-width="6"'))
    # harita çizgileri (Spree kıvrımı + sokak ızgarası)
    (x0, y0), (x1, y1), (x2, y2), (x3, y3) = mp
    for t in (.25, .5, .75):
        o.append(f'<line x1="{x0+(x1-x0)*t:.1f}" y1="{y0+(y1-y0)*t:.1f}" x2="{x3+(x2-x3)*t:.1f}" y2="{y3+(y2-y3)*t:.1f}" stroke="#a8967a" stroke-width="1"/>')
    for t in (.3, .6):
        o.append(f'<line x1="{x0+(x3-x0)*t:.1f}" y1="{y0+(y3-y0)*t:.1f}" x2="{x1+(x2-x1)*t:.1f}" y2="{y1+(y2-y1)*t:.1f}" stroke="#a8967a" stroke-width="1"/>')
    o.append(f'<path d="M{x0+4},{(y0+y3)/2} C{x0+20},{y0-10} {x1-30},{y2+10} {x1-4},{(y1+y2)/2}" fill="none" stroke="#2f5f78" stroke-width="3" opacity=".8"/>')
    # sağ duvar: 3 afiş + saat
    for i, zc in enumerate((-1.9, -1.1, -.3)):
        q = [pr(4.58, 1.65, zc - .3), pr(4.58, 1.65, zc + .3), pr(4.58, 2.5, zc + .3), pr(4.58, 2.5, zc - .3)]
        o.append(poly(q, P['paper'], f'stroke="{P["walnut"]}" stroke-width="4"'))
        col = [P['velvet'], P['night2'], P['lampGreen']][i]
        inner = [pr(4.58, 1.8, zc - .2), pr(4.58, 1.8, zc + .2), pr(4.58, 2.35, zc + .2), pr(4.58, 2.35, zc - .2)]
        o.append(poly(inner, col, 'opacity=".85"'))
        cx_, cy_ = pr(4.58, 2.05, zc)
        o.append(f'<circle cx="{cx_:.1f}" cy="{cy_:.1f}" r="{9-i*2}" fill="{P["paper"]}" opacity=".9"/>')
    cx_, cy_ = pr(4.58, 2.75, .6)
    o.append(f'<ellipse cx="{cx_:.1f}" cy="{cy_:.1f}" rx="14" ry="30" fill="{P["cream"]}" stroke="{P["brass"]}" stroke-width="3"/>')
    # ---- ayaklı lambalar (x ±3.6, z −1.7)
    for sgn in (-1, 1):
        bx, by = pr(sgn * 3.6, 0, -1.7)
        sx, sy = pr(sgn * 3.6, 2.0, -1.7)
        o.append(f'<ellipse cx="{sx:.1f}" cy="{sy+40:.1f}" rx="170" ry="210" fill="url(#glowWarm)" opacity=".55"/>')
        o.append(f'<ellipse cx="{bx:.1f}" cy="{by:.1f}" rx="26" ry="8" fill="{P["brassDark"]}"/>')
        o.append(f'<line x1="{bx:.1f}" y1="{by:.1f}" x2="{sx:.1f}" y2="{sy+30:.1f}" stroke="{P["brass"]}" stroke-width="4"/>')
        o.append(f'<path d="M{sx-46},{sy+30} l92,0 l-22,-52 l-48,0 z" fill="#f4d3a1" stroke="{P["brassDark"]}"/>')
        o.append(f'<path d="M{sx-46},{sy+30} l92,0 l-22,-52 l-48,0 z" fill="{P["lampWarm"]}" opacity=".5"/>')
        # sehpa + küllük
        tx, ty = pr(sgn * 3.6, .62, -.95)
        o.append(f'<ellipse cx="{tx:.1f}" cy="{ty:.1f}" rx="46" ry="12" fill="{P["walnut"]}" stroke="{P["ink"]}" stroke-width="1"/>')
        o.append(f'<line x1="{tx:.1f}" y1="{ty:.1f}" x2="{tx:.1f}" y2="{ty+70:.1f}" stroke="{P["wainscot"]}" stroke-width="6"/>')
        o.append(f'<ellipse cx="{tx:.1f}" cy="{ty-4:.1f}" rx="10" ry="4" fill="{P["brass"]}"/>')
        o.append(f'<path d="M{tx+2},{ty-6} c8,-20 -8,-30 4,-52 c8,-16 -4,-24 6,-40" fill="none" stroke="{P["smoke"]}" stroke-width="3" opacity=".4" filter="url(#blur3)"/>')
    # ---- masa
    tbl = [pr(math.cos(i / 64 * math.tau) * 2.35, .81, math.sin(i / 64 * math.tau) * 1.65) for i in range(64)]
    tbl_lo = [pr(math.cos(i / 64 * math.tau) * 2.35, .6, math.sin(i / 64 * math.tau) * 1.65) for i in range(64)]
    o.append(poly(tbl_lo[:33] + list(reversed(tbl[:33])), '#3e2a1e'))  # yakın kenar kalınlığı
    o.append(poly(tbl, P['walnut']))
    felt = [pr(math.cos(i / 64 * math.tau) * 2.12, .812, math.sin(i / 64 * math.tau) * 1.42) for i in range(64)]
    o.append(poly(felt, 'url(#tableFelt)'))
    o.append(poly([pr(math.cos(i / 64 * math.tau) * 2.13, .813, math.sin(i / 64 * math.tau) * 1.43) for i in range(64)], 'none', f'stroke="{P["brass"]}" stroke-width="1.5"'))
    # tahtalar ve deste
    def board(zc, col, name):
        q = [pr(-.97, .82, zc + .225), pr(.97, .82, zc + .225), pr(.97, .82, zc - .225), pr(-.97, .82, zc - .225)]
        o.append(poly(q, P['cream'], f'stroke="{P["ink"]}" stroke-width=".8"'))
        b = [pr(-.95, .822, zc + .2), pr(-.45, .822, zc + .2), pr(-.45, .822, zc - .2), pr(-.95, .822, zc - .2)]
        o.append(poly(b, col))
        for i in range(5):
            xs = -.38 + i * .27
            o.append(poly([pr(xs, .822, zc + .17), pr(xs + .22, .822, zc + .17), pr(xs + .22, .822, zc - .17), pr(xs, .822, zc - .17)], 'none', f'stroke="{P["ink"]}" stroke-width=".6" opacity=".5"'))
    board(-.4, P['ink'] if False else '#427e9e', 'L'); board(.16, '#a94743', 'F')
    for sx in (-1.28, 1.28):
        q = [pr(sx - .09, .83, -.07 + .115), pr(sx + .09, .83, -.07 + .115), pr(sx + .09, .83, -.07 - .115), pr(sx - .09, .83, -.07 - .115)]
        o.append(poly(q, '#1b2e28', f'stroke="{P["ink"]}"'))
    for a in [k / 8 * math.tau for k in range(8)]:
        cx_, cz_ = math.sin(a) * 1.62, math.cos(a) * .85
        q = [pr(cx_ - .08, .815, cz_ + .1), pr(cx_ + .08, .815, cz_ + .1), pr(cx_ + .08, .815, cz_ - .1), pr(cx_ - .08, .815, cz_ - .1)]
        o.append(poly(q, P['cream'], f'stroke="{P["ink"]}" stroke-width=".5"'))
        ex, ey = pr(cx_, .82, cz_)
        o.append(f'<circle cx="{ex:.1f}" cy="{ey:.1f}" r="{max(2, 4*F/(EYE_Z-cz_)/240):.1f}" fill="#a94743"/>')
    # ---- oyuncular (8 koltuk, yerel 0 gizli). Uzaktan yakına sırala.
    seats = []
    for k in range(1, 8):
        a = k / 8 * math.tau
        seats.append((a, math.sin(a) * 2.64, math.cos(a) * 2.0, k))
    seats.sort(key=lambda s: s[2])
    names = ['', 'Elif', 'Deniz', 'Kaan', 'Selin', 'Barış', 'Ada', 'Cem']
    hats = ['fedora', 'bun', 'beanie', 'cap', 'curly', 'bald', 'beret']
    for a, x, z, k in seats:
        s = F / (EYE_Z - z)
        # sandalye arkalığı (kameraya bakan koltuklar için)
        cbx = x + math.sin(a) * .2; cbz = z + math.cos(a) * .2
        if z > -1.9:
            q = [pr(cbx - .25 * math.cos(a), .81 + .1, cbz + .25 * math.sin(a)), pr(cbx + .25 * math.cos(a), .81 + .1, cbz - .25 * math.sin(a)),
                 pr(cbx + .25 * math.cos(a), .81 + .55, cbz - .25 * math.sin(a)), pr(cbx - .25 * math.cos(a), .81 + .55, cbz + .25 * math.sin(a))]
            o.append(poly(q, P['walnut'], f'stroke="{P["ink"]}" stroke-width="1"'))
        acc = ACCENTS[k % 8]; skin = SKINS[k % 3]
        bx_, by_ = pr(x, .81 + .12, z)
        r = .2 * s
        o.append(f'<rect x="{bx_-.36*s:.1f}" y="{by_-.62*s:.1f}" width="{.72*s:.1f}" height="{.62*s:.1f}" rx="{.22*s:.1f}" fill="{acc}" stroke="{P["ink"]}" stroke-width="1"/>')
        hx_, hy_ = pr(x, 1.36, z)
        o.append(f'<circle cx="{hx_:.1f}" cy="{hy_:.1f}" r="{r:.1f}" fill="{skin}" stroke="{P["ink"]}" stroke-width="1"/>')
        # yüz: gözler + ağız (kameraya dönük kabul)
        o.append(f'<circle cx="{hx_-r*.32:.1f}" cy="{hy_-r*.05:.1f}" r="{r*.13:.1f}" fill="{P["ink"]}"/><circle cx="{hx_+r*.32:.1f}" cy="{hy_-r*.05:.1f}" r="{r*.13:.1f}" fill="{P["ink"]}"/>')
        o.append(f'<path d="M{hx_-r*.3:.1f},{hy_+r*.35:.1f} q{r*.3:.1f},{r*.25:.1f} {r*.6:.1f},0" fill="none" stroke="{P["ink"]}" stroke-width="{max(1, r*.08):.1f}"/>')
        hat = hats[(k - 1) % 7]
        if hat == 'fedora':
            o.append(f'<ellipse cx="{hx_:.1f}" cy="{hy_-r*.65:.1f}" rx="{r*1.3:.1f}" ry="{r*.28:.1f}" fill="#1f2a44"/><rect x="{hx_-r*.75:.1f}" y="{hy_-r*1.35:.1f}" width="{r*1.5:.1f}" height="{r*.75:.1f}" rx="{r*.2:.1f}" fill="#1f2a44"/>')
        elif hat == 'bun':
            o.append(f'<path d="M{hx_-r:.1f},{hy_:.1f} a{r:.1f},{r:.1f} 0 0 1 {2*r:.1f},0 z" fill="#3b2a1e"/><circle cx="{hx_:.1f}" cy="{hy_-r*1.05:.1f}" r="{r*.38:.1f}" fill="#3b2a1e"/>')
        elif hat == 'beanie':
            o.append(f'<path d="M{hx_-r*1.02:.1f},{hy_-r*.1:.1f} a{r*1.02:.1f},{r*1.02:.1f} 0 0 1 {2.04*r:.1f},0 z" fill="{P["books"][7]}"/><rect x="{hx_-r*1.02:.1f}" y="{hy_-r*.35:.1f}" width="{2.04*r:.1f}" height="{r*.3:.1f}" fill="#d9772b"/>')
        elif hat == 'cap':
            o.append(f'<path d="M{hx_-r:.1f},{hy_-r*.15:.1f} a{r:.1f},{r:.1f} 0 0 1 {2*r:.1f},0 z" fill="#4aa3d8"/><rect x="{hx_-r*1.15:.1f}" y="{hy_-r*.25:.1f}" width="{r*1.4:.1f}" height="{r*.16:.1f}" rx="{r*.08:.1f}" fill="#3b86b3"/>')
        elif hat == 'curly':
            for i in range(7):
                aa = math.pi + i / 6 * math.pi
                o.append(f'<circle cx="{hx_+math.cos(aa)*r*.95:.1f}" cy="{hy_+math.sin(aa)*r*.95:.1f}" r="{r*.42:.1f}" fill="#2c1d14"/>')
        elif hat == 'bald':
            o.append(f'<path d="M{hx_-r*.9:.1f},{hy_+r*.15:.1f} q{r*.9:.1f},{r*.55:.1f} {r*1.8:.1f},0" fill="none" stroke="#5a4634" stroke-width="{max(1.5, r*.18):.1f}"/>')
        elif hat == 'beret':
            o.append(f'<ellipse cx="{hx_+r*.1:.1f}" cy="{hy_-r*.75:.1f}" rx="{r*1.05:.1f}" ry="{r*.42:.1f}" fill="#d07a9a"/>')
        # etiket
        lx_, ly_ = pr(x, 1.62 + (.12 if hat in ('fedora', 'beanie', 'curly') else 0), z)
        lw, lh = min(150, max(60, .42 * s)), min(40, max(22, .16 * s))
        o.append(f'<rect x="{lx_-lw/2:.1f}" y="{ly_-lh:.1f}" width="{lw:.1f}" height="{lh:.1f}" rx="5" fill="#17241f" opacity=".86" stroke="#59625a"/>')
        o.append(f'<text x="{lx_:.1f}" y="{ly_-lh*.32:.1f}" text-anchor="middle" font-size="{min(20, max(11, lh*.6)):.0f}" font-weight="bold" fill="{P["cream"]}">{names[k]}</text>')
    # ---- avize (masanın üstü, h 2,5–3,3)
    ring = [pr(math.cos(i / 48 * math.tau) * .65, 2.76, math.sin(i / 48 * math.tau) * .65) for i in range(48)]
    ring_in = [pr(math.cos(i / 48 * math.tau) * .58, 2.76, math.sin(i / 48 * math.tau) * .58) for i in range(48)]
    cx_, cy_ = pr(0, 2.6, 0)
    o.append(f'<ellipse cx="{cx_:.1f}" cy="{cy_+30:.1f}" rx="420" ry="150" fill="url(#glowWarm)" opacity=".55"/>')
    tx, ty = pr(0, 3.3, 0)
    o.append(f'<line x1="{cx_:.1f}" y1="{ty:.1f}" x2="{cx_:.1f}" y2="{pr(0,2.82,0)[1]:.1f}" stroke="{P["brassDark"]}" stroke-width="4"/>')
    o.append(poly(ring, 'none', f'stroke="{P["brassDark"]}" stroke-width="9"'))
    o.append(poly(ring, 'none', f'stroke="{P["brass"]}" stroke-width="5"'))
    for i in range(8):
        aa = i / 8 * math.tau
        px, pz = math.cos(aa) * .65, math.sin(aa) * .65
        tx1, ty1 = pr(px, 2.76, pz); bx1, by1 = pr(px, 2.5, pz)
        w = .12 * F / (EYE_Z - pz)
        o.append(f'<path d="M{tx1-w*.55:.1f},{ty1:.1f} L{tx1+w*.55:.1f},{ty1:.1f} L{bx1+w:.1f},{by1:.1f} L{bx1-w:.1f},{by1:.1f} z" fill="#f6e0b8" stroke="{P["brassDark"]}" stroke-width="1"/>')
        o.append(f'<ellipse cx="{bx1:.1f}" cy="{by1:.1f}" rx="{w:.1f}" ry="{w*.35:.1f}" fill="{P["lampWarm"]}"/>')
    # ---- duman/hava katmanı ve vinyet
    o.append(f'<rect width="{W}" height="{HGT*.5}" fill="url(#haze)"/>')
    for (ex, ey, rx, ry) in ((520, 250, 260, 70), (1100, 210, 300, 60), (800, 330, 420, 50)):
        o.append(f'<ellipse cx="{ex}" cy="{ey}" rx="{rx}" ry="{ry}" fill="{P["smoke"]}" opacity=".07" filter="url(#blur20)"/>')
    o.append(f'<rect width="{W}" height="{HGT}" fill="url(#vig)"/>')
    # ---- başlık
    o.append(f'<rect x="20" y="{HGT-58}" width="620" height="40" rx="6" fill="#0b100e" opacity=".7"/>')
    o.append(f'<text x="34" y="{HGT-32}" font-size="17" fill="{P["cream"]}" font-weight="bold">D2 konsept — Arka oda, Berlin 1932 · koltuk arkasından görünüm (masa yüzeyi y 0, tavan 3,3 m)</text>')
    return svg(W, HGT, '\n'.join(o), defs)


if __name__ == '__main__':
    write('plan.svg', plan())
    write('elevation.svg', elevation())
    write('concept.svg', concept())
