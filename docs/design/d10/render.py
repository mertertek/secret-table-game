#!/usr/bin/env python3
"""D10 politika tahtaları — tasarım aracı (uygulama kodu değildir).

Tek ölçü/renk sözlüğünden `icons.svg`, `icons.json` ve `board-*.svg` üretir.
Ölçek: tuval 1940×450 px = 1,94×0,45 m (1 px = 1 mm). Yuva konumları
`PolicyBoard.tsx` kesirleriyle aynı: x = .31 + i·.109, en .096.
Çalıştır: python3 docs/design/d10/render.py
"""
from __future__ import annotations
import json, os
OUT = os.path.dirname(os.path.abspath(__file__))
W, H = 1940, 450

C = {  # renk tokenleri (palette.ts ile uyumlu; yeni olanlar §6'da listelenir)
    'cream': '#eee1c7', 'paper2': '#e4d6b8', 'line': '#c1b49a', 'ghost': '#dccfb2',
    'ink': '#252b2c', 'ink2': '#6f6b58', 'num': '#9b9076', 'brass': '#b49359',
    'liberal': '#427e9e', 'liberalDeep': '#2f5f78', 'fascist': '#a94743', 'fascistDeep': '#7e332f',
    'gold': '#e3be73',
}
FONT = 'Noto Sans, Helvetica Neue, Arial, sans-serif'
SERIF = 'Noto Serif, Georgia, serif'

# 100×100 viewBox, yalnız dolgu. Delikler aynı path dizgisi içinde alt yol olarak (evenodd);
# ayrı path'ler üst üste binmez. Canvas: for d of paths → ctx.fill(new Path2D(d), 'evenodd').
ICONS: dict[str, list[str]] = {
    'investigate_loyalty': [  # büyüteç + merceğin içinde parti kartı
        'M42 16 a26 26 0 1 0 0 52 a26 26 0 1 0 0 -52 Z M42 25 a17 17 0 1 0 0 34 a17 17 0 1 0 0 -34 Z',
        'M55.8 64.2 L83.8 92.2 L92.2 83.8 L64.2 55.8 Z',
        'M34 30 h16 v24 h-16 Z M37 33 h10 v18 h-10 Z',
    ],
    'call_special_election': [  # oy sandığı + işaretli pusula
        'M10 40 h80 v8 h-4 v44 h-72 v-44 h-4 Z M36 40 h28 v8 h-28 Z',
        'M40 4 h26 l-6 30 h-26 Z M42 18 l5 5 l10 -10 l3 3 l-13 13 l-8 -8 Z',
    ],
    'policy_peek': [  # göz + üç kart
        'M50 6 C66 6 78 16 86 22 C78 28 66 38 50 38 C34 38 22 28 14 22 C22 16 34 6 50 6 Z M50 14 a8 8 0 1 0 0 16 a8 8 0 1 0 0 -16 Z',
        'M8 46 h24 v46 h-24 Z',
        'M38 42 h24 v50 h-24 Z',
        'M68 46 h24 v46 h-24 Z',
    ],
    'execution': [],  # mermi: aşağıda dik tanımdan -28° döndürülerek üretilir
    'victory': [  # yıldız + iki kurdele
        'M50 10 L58.2 32.7 L82.3 33.5 L63.3 48.3 L70 71.5 L50 58 L30 71.5 L36.7 48.3 L17.7 33.5 L41.8 32.7 Z',
        'M28 73 L20 95 L31 90 L37 99 L44 78 Z',
        'M72 73 L80 95 L69 90 L63 99 L56 78 Z',
    ],
}
import math
def _rot(pts, deg=-28, c=(50, 52), k=.92):
    a = math.radians(deg); out = []
    for x, y in pts:
        dx, dy = (x - c[0]) * k, (y - c[1]) * k
        out.append((c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a)))
    return out
def _path(cmds):
    s = []
    for cmd, pts in cmds:
        s.append(cmd + ' '.join(f'{x:.1f} {y:.1f}' for x, y in _rot(pts)))
    return ' '.join(s) + ' Z'
ICONS['execution'] = [
    ' '.join([_path([('M', [(32, 92)]), ('L', [(32, 48)]), ('C', [(32, 30), (40, 16), (50, 8)]), ('C', [(60, 16), (68, 30), (68, 48)]), ('L', [(68, 92)])]),
              _path([('M', [(36, 52)]), ('L', [(64, 52), (64, 58), (36, 58)])]),
              _path([('M', [(36, 64)]), ('L', [(64, 64), (64, 69), (36, 69)])])]),
    _path([('M', [(27, 92)]), ('L', [(73, 92), (73, 99), (27, 99)])]),
]
LABELS = {
    'investigate_loyalty': ['SADAKAT', 'İNCELEMESİ'], 'call_special_election': ['ÖZEL', 'SEÇİM'],
    'policy_peek': ['DESTE', 'TEPESİ'], 'execution': ['İNFAZ'],
    'victory_fascist': ['FAŞİST', 'ZAFERİ'], 'victory_liberal': ['LİBERAL', 'ZAFERİ'],
}
LAYOUTS = {  # packages/contracts/src/rules.ts BOARD_LAYOUTS.fascistPowers
    'small': ['none', 'none', 'policy_peek', 'execution', 'execution', 'none'],
    'medium': ['none', 'investigate_loyalty', 'call_special_election', 'execution', 'execution', 'none'],
    'large': ['investigate_loyalty', 'investigate_loyalty', 'call_special_election', 'execution', 'execution', 'none'],
}
PLAYERS = {'small': '5–6 OYUNCU', 'medium': '7–8 OYUNCU', 'large': '9–10 OYUNCU'}
HITLER_TEXT = 'HİTLER ŞANSÖLYE SEÇİLİRSE FAŞİSTLER KAZANIR'
CHAOS_TEXT = '3 BAŞARISIZ SEÇİM → ÜSTTEKİ KANUN UYGULANIR'

# Anatomi (px)
SLOT_X0, PITCH, SLOT_W = 601, 211.5, 186
TOP_Y0, TOP_Y1 = 20, 62          # üst şerit
SLOT_Y0, SLOT_Y1 = 72, 334       # yuva çerçevesi (kart 177×253 içinde, 4,5 mm pay)
BAND_Y0, BAND_Y1 = 342, 436      # yuva altı bant
CARD_W, CARD_H = 177, 253
ICON = 64                        # bant ikonu
GHOST = 100                      # yuva içi hayalet ikon

def slot_left(i: int) -> float: return SLOT_X0 + i * PITCH
def slot_cx(i: int) -> float: return slot_left(i) + SLOT_W / 2

def text(x, y, s, size, fill, weight=700, anchor='middle', spacing=None, family=FONT):
    ls = f' letter-spacing="{spacing}"' if spacing else ''
    return f'<text x="{x:.1f}" y="{y:.1f}" font-family="{family}" font-size="{size}" font-weight="{weight}" fill="{fill}" text-anchor="{anchor}"{ls}>{s}</text>'

def icon(name, x, y, size, fill):
    s = size / 100
    paths = ''.join(f'<path d="{d}"/>' for d in ICONS[name])
    return f'<g transform="translate({x:.1f} {y:.1f}) scale({s:.4f})" fill="{fill}" fill-rule="evenodd">{paths}</g>'

def emblem(party, x, y, r, color, cutout):
    if party == 'liberal':
        return (f'<g transform="translate({x} {y}) scale({r})">'
                f'<path d="M-.48 .65 Q-.15 -.2 .5 -.76 Q.68 .42 -.48 .65 Z" fill="{color}"/>'
                f'<path d="M-.5 .7 L.42 -.62" stroke="{cutout}" stroke-width=".035" fill="none"/>'
                + ''.join(f'<path d="M{-.23 + i * .13:.2f} {.35 - i * .22:.2f} L{.1 + i * .1:.2f} {.39 - i * .22:.2f}" stroke="{cutout}" stroke-width=".035"/>' for i in range(4))
                + '</g>')
    return (f'<g transform="translate({x} {y}) scale({r})">'
            f'<path d="M-.68 .65 L-.68 -.4 L-.35 -.4 L-.35 -.74 L.35 -.74 L.35 -.4 L.68 -.4 L.68 .65 Z" fill="{color}"/>'
            f'<rect x="-.12" y=".03" width=".24" height=".62" fill="{cutout}"/>'
            f'<rect x="-.45" y="-.21" width=".14" height=".15" fill="{cutout}"/><rect x=".31" y="-.21" width=".14" height=".15" fill="{cutout}"/></g>')

def card(party, cx, cy):
    """Yuvaya konmuş politika kartı (CardBody 0,19×0,272 m · scale .93 → 177×253). cardArt.ts sadeleştirmesi."""
    x, y = cx - CARD_W / 2, cy - CARD_H / 2
    col = C[party]
    return (f'<g><rect x="{x + 3}" y="{y + 5}" width="{CARD_W}" height="{CARD_H}" rx="4" fill="#000" opacity=".22"/>'
            f'<rect x="{x}" y="{y}" width="{CARD_W}" height="{CARD_H}" rx="4" fill="{C["cream"]}"/>'
            f'<rect x="{x + 8}" y="{y + 8}" width="{CARD_W - 16}" height="{CARD_H - 16}" fill="none" stroke="#bca57c" stroke-width="1.6"/>'
            + text(cx, y + 34, 'POLİTİKA', 13.5, C['ink2'], 550)
            + f'<circle cx="{cx}" cy="{y + 109}" r="49" fill="none" stroke="{col}" stroke-width=".8"/>'
            + emblem(party, cx, y + 109, 46, col, C['cream'])
            + text(cx, y + 191, 'LİBERAL' if party == 'liberal' else 'FAŞİST', 26, col, 600, family=SERIF)
            + f'<rect x="{cx - 26}" y="{y + 209}" width="52" height="2" fill="{col}"/>'
            + text(cx, y + 233, 'SECRET TABLE', 10, '#7a705b', 550) + '</g>')

def band_power(i, power, party):
    """Yuva altı bant: sol ikon, sağda 1–2 satır etiket (yatay düzen: koltuk kamerası dikeyi 3× sıkıştırır)."""
    L = slot_left(i); out = []
    if power == 'victory':
        col = C[party]
        out.append(f'<rect x="{L}" y="{BAND_Y0}" width="{SLOT_W}" height="{BAND_Y1 - BAND_Y0}" rx="8" fill="{col}"/>')
        out.append(icon('victory', L + 8, BAND_Y0 + 15, ICON, C['cream']))
        for n, line in enumerate(LABELS[f'victory_{party}']):
            out.append(text(L + 82, 383 + n * 22, line, 15, C['cream'], 700, 'start', .8))
        return ''.join(out)
    out.append(f'<rect x="{L}" y="{BAND_Y0}" width="{SLOT_W}" height="{BAND_Y1 - BAND_Y0}" rx="8" fill="{C["paper2"]}"/>')
    out.append(icon(power, L + 8, BAND_Y0 + 15, ICON, C[party]))
    for n, line in enumerate(LABELS[power]):
        out.append(text(L + 82, 383 + n * 22, line, 15, C['ink'], 700, 'start', .8))
    return ''.join(out)

def veto_tag(i):
    L = slot_left(i)
    return (f'<rect x="{L + 80}" y="396" width="98" height="24" rx="5" fill="{C["brass"]}"/>'
            + text(L + 129, 413, 'VETO AÇILDI', 12.5, C['ink'], 700, 'middle', 1))

def frame(party, variant_label):
    out = [f'<rect width="{W}" height="{H}" fill="{C["cream"]}"/>',
           f'<rect x="8" y="8" width="{W - 16}" height="{H - 16}" fill="none" stroke="{C[party]}" stroke-width="3"/>',
           f'<rect x="16" y="16" width="{W * .25:.0f}" height="{H - 32}" fill="{C[party]}"/>',
           emblem(party, W * .14, H * .34, H * .19, C['cream'], C[party]),
           text(W * .14, H * .68 + 17, 'LİBERAL' if party == 'liberal' else 'FAŞİST', H * .11, C['cream'], 600, family=SERIF),
           text(W * .14, H * .84 + 9, variant_label, H * .058, C['cream'], 550, spacing=1.5)]
    return out

def slot(i, party, power, filled):
    L, cx = slot_left(i), slot_cx(i); out = []
    out.append(f'<rect x="{L}" y="{SLOT_Y0}" width="{SLOT_W}" height="{SLOT_Y1 - SLOT_Y0}" fill="none" stroke="{C["line"]}" stroke-width="2"/>')
    out.append(text(L + 12, 98, f'{i + 1:02d}', 26, C['num'], 600, 'start'))
    if power == 'victory':
        out.append(icon('victory', cx - GHOST / 2, 203 - GHOST / 2, GHOST, C['ghost']))
    elif power != 'none':
        out.append(icon(power, cx - GHOST / 2, 203 - GHOST / 2, GHOST, C['ghost']))
    if filled: out.append(card(party, cx, 203))
    return ''.join(out)

def fascist_board(variant, filled=0):
    powers = LAYOUTS[variant][:5] + ['victory']
    out = frame('fascist', PLAYERS[variant])
    x0, x1 = slot_left(2), slot_left(5) + SLOT_W
    out.append(f'<rect x="{x0}" y="{TOP_Y0}" width="{x1 - x0}" height="{TOP_Y1 - TOP_Y0}" rx="6" fill="{C["fascistDeep"]}"/>')
    out.append(text((x0 + x1) / 2, 49, HITLER_TEXT, 24, C['cream'], 700, spacing=2.4))
    # 3. yuvanın üstünde küçük ok: bölgenin başladığı yer
    out.append(f'<path d="M{x0 + 14} {TOP_Y1} l10 6 l10 -6 Z" fill="{C["fascistDeep"]}"/>')
    for i, p in enumerate(powers):
        out.append(slot(i, 'fascist', p, i < filled))
        if p != 'none': out.append(band_power(i, p, 'fascist'))
        if i == 4: out.append(veto_tag(i))
    return svg(out)

def liberal_board(filled=0, variant='medium'):
    out = frame('liberal', PLAYERS[variant])  # kod her iki tahtaya aynı varyant etiketini basar
    for i in range(5):
        p = 'victory' if i == 4 else 'none'
        out.append(slot(i, 'liberal', p, i < filled))
    # Kaos şeridi: 1–4. yuvaların altı (orijinalde sayaç burada; pul ayrı nesnede kalır)
    x0, x1 = slot_left(0), slot_left(3) + SLOT_W
    out.append(f'<rect x="{x0}" y="{BAND_Y0 + 14}" width="{x1 - x0}" height="{BAND_Y1 - BAND_Y0 - 28}" rx="6" fill="{C["liberalDeep"]}"/>')
    for k in range(3):
        cx = x0 + 34 + k * 30
        out.append(f'<circle cx="{cx}" cy="389" r="10" fill="{C["cream"] if k == 2 else "none"}" stroke="{C["cream"]}" stroke-width="2.5"/>')
    out.append(text(x0 + 124, 397, CHAOS_TEXT, 22, C['cream'], 700, 'start', 2))
    out.append(band_power(4, 'victory', 'liberal'))
    # Sağ sütun: sayaç açıklaması (pul masadaki ElectionMarker'da)
    px0, px1 = slot_left(4) + SLOT_W + 28, W - 24
    out.append(f'<rect x="{px0}" y="{SLOT_Y0}" width="{px1 - px0}" height="{SLOT_Y1 - SLOT_Y0}" rx="8" fill="{C["paper2"]}"/>')
    pcx = (px0 + px1) / 2
    out.append(text(pcx, 112, 'SEÇİM SAYACI', 20, C['ink'], 700, spacing=2))
    for k in range(4):
        cx = pcx - 84 + k * 56
        if k == 3:
            out.append(f'<circle cx="{cx}" cy="176" r="19" fill="{C["fascist"]}"/>')
            out.append(text(cx, 183, '3', 19, C['cream'], 700))
        else:
            out.append(f'<circle cx="{cx}" cy="176" r="19" fill="none" stroke="{C["ink2"]}" stroke-width="2.5"/>')
            out.append(text(cx, 183, str(k), 19, C['ink2'], 700))
    out.append(text(pcx + 84, 226, 'KAOS', 16, C['fascist'], 700, spacing=1.5))
    out.append(text(pcx, 268, 'ALTIN PUL MASADA', 14, C['ink2'], 600, spacing=1.2))
    out.append(text(pcx, 292, 'HER BAŞARISIZ SEÇİMDE', 14, C['ink2'], 600, spacing=1.2))
    out.append(text(pcx, 316, 'BİR ADIM İLERLER', 14, C['ink2'], 600, spacing=1.2))
    return svg(out)

def svg(body, w=W, h=H):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">\n'
            + '\n'.join(body) + '\n</svg>\n')

def icon_sheet():
    body = [f'<rect width="640" height="180" fill="{C["cream"]}"/>']
    for n, name in enumerate(ICONS):
        x = 20 + n * 124
        body.append(f'<rect x="{x}" y="20" width="100" height="100" fill="none" stroke="{C["line"]}" stroke-dasharray="4 4"/>')
        body.append(icon(name, x, 20, 100, C['fascist'] if name != 'victory' else C['liberal']))
        body.append(text(x + 50, 150, name, 12, C['ink2'], 600))
    return svg(body, 640, 180)

def contrast(a, b):
    def lum(h):
        r, g, b_ = (int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))
        f = lambda c: c / 12.92 if c <= .03928 else ((c + .055) / 1.055) ** 2.4
        return .2126 * f(r) + .7152 * f(g) + .0722 * f(b_)
    la, lb = lum(a), lum(b)
    return (max(la, lb) + .05) / (min(la, lb) + .05)

if __name__ == '__main__':
    files = {
        'icons.svg': icon_sheet(),
        'board-fascist-small.svg': fascist_board('small'),
        'board-fascist-medium.svg': fascist_board('medium', filled=3),
        'board-fascist-large.svg': fascist_board('large'),
        'board-liberal.svg': liberal_board(),
        'board-liberal-filled.svg': liberal_board(filled=4),
    }
    for name, content in files.items():
        with open(os.path.join(OUT, name), 'w', encoding='utf-8') as f: f.write(content)
    with open(os.path.join(OUT, 'icons.json'), 'w', encoding='utf-8') as f:
        json.dump({'viewBox': '0 0 100 100', 'fillRule': 'evenodd', 'icons': ICONS}, f, ensure_ascii=False, indent=2)
    for fg, bg in [('cream', 'fascist'), ('cream', 'fascistDeep'), ('cream', 'liberal'), ('cream', 'liberalDeep'),
                   ('ink', 'paper2'), ('ink', 'brass'), ('ink2', 'paper2'), ('num', 'cream'), ('ghost', 'cream'), ('fascist', 'paper2'), ('liberal', 'paper2')]:
        print(f'{fg} / {bg}: {contrast(C[fg], C[bg]):.2f}:1')
