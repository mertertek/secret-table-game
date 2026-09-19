#!/usr/bin/env python3
"""D6 isim etiketi — tasarım üreteci (KOD DEĞİL, tasarım aracı).

Üretir:
  docs/design/d6/nameplate-states.svg   tek sayfa durum matrisi (1 m = 1000 px)
  docs/design/d6/mockup-seat.png        docs/qa/claude/d5/result-seat.png üstüne fotomontaj
  docs/design/d6/mockup-overview.png    docs/qa/claude/d5/result-overview.png üstüne fotomontaj

Çalıştırma (repo kökünden):  python3 docs/design/d6/render.py
Bağımlılık: Pillow (11.x). Yazı: packages/scene/public/fonts/NotoSans.ttf ("Table Sans").
Aynı geometri/renk sözlüğü (SPEC, TOK) hem SVG hem PNG'yi besler; D6-nameplate.md'deki
ölçüler buradan alınmıştır.
"""
from __future__ import annotations

import math
import os
from dataclasses import dataclass, field

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
OUT = os.path.join(ROOT, 'docs', 'design', 'd6')
FONT = os.path.join(ROOT, 'packages', 'scene', 'public', 'fonts', 'NotoSans.ttf')

# ---------------------------------------------------------------- geometri (metre)
SPEC = dict(
    W=.60, H=.18, R=.032, LINE=.006, LINE_AIMED=.010, PAD=.03,
    NAME_SIZE=.066, NAME_CY=.064, NAME_MAX=.50, NAME_CHARS=15,
    META_SIZE=.038, META_CY=.135, META_TRACK=.06,
    GLYPH_D=.026, GLYPH_GAP=.012,
    CHIP_H=.060, CHIP_PADX=.020, CHIP_GLYPH_R=.014, CHIP_TEXT=.034, CHIP_GAP=.014,
    TAG_W=.090, TAG_H=.034, TAG_TEXT=.022, TAG_X=.030, TAG_Y=-.012,
    BRACKET=.030, BRACKET_OUT=.010,
    # Kompakt varyant (telefon / dar alan)
    C_H=.11, C_NAME_SIZE=.056, C_NAME_CY=.055, C_R=.026,
)
TOK = dict(
    bg='#17241f', bgA=.86, bgDead='#141d1c', bgDeadA=.55,
    line='#59625a', lineLocal='#b49359', lineTarget='#a4c9b7', lineGold='#e3be73',
    lineWarn='#e6a95c', lineDead='#3d4643',
    name='#eee1c7', name2='#cfc3a9', name3='#a39a86', ink='#1b1f1e',
    gold='#e3be73', brass='#b49359', target='#a4c9b7', ready='#8fd3a5', warn='#e6a95c',
    voteYes='#4f9464', voteNo='#c0564e', voteIdle='#5a6860', chipFill='#eee1c7',
    # Çip kelimesi/simgesi krem üstünde ≥ 4,5:1 için koyu tonlar (kenar D5 vurgusunda kalır)
    voteYesText='#2a5f3c', voteNoText='#8f3a33', voteIdleText='#4a5650',
    selectedBg='#e3be73', selectedBgA=.96,
)


@dataclass
class State:
    name: str
    local: bool = False
    office: str | None = None          # president | chancellor | president_candidate | chancellor_candidate
    status: str | None = None          # eliminated | offline | ready | None
    seat: int = 1
    targetable: bool = False
    hovered: bool = False
    aimed: bool = False
    selected: bool = False
    vote: str | None = None            # waiting | voted | yes | no
    compact: bool = False
    lobby: bool = False


# ---------------------------------------------------------------- yazı ölçümü
_fonts: dict = {}


def font(size_px: float, weight: int) -> ImageFont.FreeTypeFont:
    key = (round(size_px), weight)
    if key not in _fonts:
        f = ImageFont.truetype(FONT, max(1, round(size_px)))
        f.set_variation_by_axes([weight, 100])
        _fonts[key] = f
    return _fonts[key]


def text_width(text: str, size_px: float, weight: int, tracking_em: float = 0) -> float:
    f = font(size_px, weight)
    w = f.getlength(text)
    return w + tracking_em * size_px * max(0, len(text) - 1)


def clip_name(name: str) -> str:
    chars = list(name)
    return ''.join(chars[:SPEC['NAME_CHARS'] - 1]) + '…' if len(chars) > SPEC['NAME_CHARS'] else name


# ---------------------------------------------------------------- durum çözümü
def resolve(s: State) -> dict:
    """Durum → görsel karar. D6-nameplate.md §5 ile birebir."""
    dead = s.status == 'eliminated'
    off = s.status == 'offline'
    # Çerçeve
    if s.selected: frame, lw = TOK['lineGold'], SPEC['LINE']
    elif s.aimed: frame, lw = TOK['lineGold'], SPEC['LINE_AIMED']
    elif s.hovered: frame, lw = TOK['lineGold'], SPEC['LINE']
    elif dead: frame, lw = TOK['lineDead'], SPEC['LINE']
    elif off: frame, lw = TOK['lineWarn'], SPEC['LINE']
    elif s.targetable: frame, lw = TOK['lineTarget'], SPEC['LINE']
    elif s.local: frame, lw = TOK['lineLocal'], SPEC['LINE']
    else: frame, lw = TOK['line'], SPEC['LINE']
    # Zemin
    if s.selected: bg, bga = TOK['selectedBg'], TOK['selectedBgA']
    elif dead: bg, bga = TOK['bgDead'], TOK['bgDeadA']
    else: bg, bga = TOK['bg'], TOK['bgA']
    name_color = TOK['ink'] if s.selected else TOK['name3'] if dead else TOK['name']
    # Makam simgesi (kelimeden bağımsız her zaman)
    glyph = None
    if s.office and not dead:
        kind = 'disc' if s.office.startswith('president') else 'ring'
        glyph = dict(kind=kind, candidate=s.office.endswith('candidate'),
                     color=TOK['ink'] if s.selected else TOK['gold'])
    office_word = {'president': 'BAŞKAN', 'chancellor': 'ŞANSÖLYE',
                   'president_candidate': 'BAŞKAN ADAYI', 'chancellor_candidate': 'ŞANSÖLYE ADAYI'}.get(s.office or '')
    # Satır 2 metni: öncelik sırası
    if dead: text, tcol = 'ELENDİ', TOK['name3']
    elif off: text, tcol = 'BAĞLANTI YOK', TOK['warn']
    elif s.selected: text, tcol = 'SEÇİLDİ', TOK['ink']
    elif s.targetable and not s.aimed and not s.hovered: text, tcol = 'HEDEF SEÇ', TOK['target']
    elif s.targetable: text, tcol = 'HEDEF SEÇ', TOK['gold']
    elif office_word: text, tcol = office_word, TOK['gold']
    elif s.lobby and s.status == 'ready': text, tcol = 'HAZIR', TOK['ready']
    else: text, tcol = f'KOLTUK {s.seat:02d}', TOK['name3']
    filler = text.startswith('KOLTUK')
    # Oy çipi
    chip = None
    if s.vote and not dead and not s.local:
        acc = {'waiting': TOK['voteIdle'], 'voted': TOK['voteYes'], 'yes': TOK['voteYes'], 'no': TOK['voteNo']}[s.vote]
        ink = {'waiting': TOK['voteIdleText'], 'voted': TOK['voteYesText'], 'yes': TOK['voteYesText'], 'no': TOK['voteNoText']}[s.vote]
        label = {'waiting': 'BEKLİYOR', 'voted': 'OY VERDİ', 'yes': 'EVET', 'no': 'HAYIR'}[s.vote]
        mark = {'waiting': 'idle', 'voted': 'yes', 'yes': 'yes', 'no': 'no'}[s.vote]
        chip = dict(accent=acc, ink=ink, label=label, mark=mark, alpha=.78 if s.vote == 'waiting' else 1.0)
        if filler: text = None  # dolgu metni çipe yer açar
    return dict(frame=frame, lw=lw, bg=bg, bga=bga, name=clip_name(s.name), name_color=name_color,
                glyph=glyph, text=text, tcol=tcol, chip=chip, dead=dead,
                tag='SEN' if s.local else None, brackets=s.aimed)


# ---------------------------------------------------------------- çizim (soyut tuval)
class Canvas:
    """px cinsinden çizim; alt sınıflar PIL ve SVG. Koordinatlar etiketin sol-üstünden."""
    def rrect(self, x, y, w, h, r, fill=None, fa=1.0, stroke=None, sw=0, sa=1.0): ...
    def circle(self, cx, cy, r, fill=None, fa=1.0, stroke=None, sw=0, dashed=False): ...
    def polyline(self, pts, stroke, sw, alpha=1.0): ...
    def text(self, x, cy, s, size, weight, color, anchor='middle', tracking=0.0, alpha=1.0): ...


class PilCanvas(Canvas):
    def __init__(self, layer: Image.Image, ox: float, oy: float):
        self.im, self.ox, self.oy = layer, ox, oy
        self.d = ImageDraw.Draw(layer, 'RGBA')

    @staticmethod
    def col(hexs: str, a: float):
        h = hexs.lstrip('#'); return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), round(255 * a))

    def rrect(self, x, y, w, h, r, fill=None, fa=1.0, stroke=None, sw=0, sa=1.0):
        box = [self.ox + x, self.oy + y, self.ox + x + w, self.oy + y + h]
        self.d.rounded_rectangle(box, radius=r, fill=self.col(fill, fa) if fill else None,
                                 outline=self.col(stroke, sa) if stroke and sw else None, width=max(1, round(sw)))

    def circle(self, cx, cy, r, fill=None, fa=1.0, stroke=None, sw=0, dashed=False):
        box = [self.ox + cx - r, self.oy + cy - r, self.ox + cx + r, self.oy + cy + r]
        if dashed and stroke:
            for k in range(6):
                self.d.arc(box, k * 60, k * 60 + 34, fill=self.col(stroke, 1), width=max(1, round(sw)))
            return
        self.d.ellipse(box, fill=self.col(fill, fa) if fill else None,
                       outline=self.col(stroke, 1) if stroke and sw else None, width=max(1, round(sw)))

    def polyline(self, pts, stroke, sw, alpha=1.0):
        p = [(self.ox + x, self.oy + y) for x, y in pts]
        self.d.line(p, fill=self.col(stroke, alpha), width=max(1, round(sw)), joint='curve')
        r = sw / 2
        for x, y in (p[0], p[-1]):
            self.d.ellipse([x - r, y - r, x + r, y + r], fill=self.col(stroke, alpha))

    def text(self, x, cy, s, size, weight, color, anchor='middle', tracking=0.0, alpha=1.0):
        f = font(size, weight)
        w = text_width(s, size, weight, tracking)
        x0 = self.ox + (x - w / 2 if anchor == 'middle' else x if anchor == 'start' else x - w)
        y = self.oy + cy
        if tracking:
            cx = x0
            for ch in s:
                self.d.text((cx, y), ch, font=f, fill=self.col(color, alpha), anchor='lm')
                cx += f.getlength(ch) + tracking * size
        else:
            self.d.text((x0, y), s, font=f, fill=self.col(color, alpha), anchor='lm')


class SvgCanvas(Canvas):
    def __init__(self, ox: float, oy: float):
        self.ox, self.oy, self.parts = ox, oy, []

    def rrect(self, x, y, w, h, r, fill=None, fa=1.0, stroke=None, sw=0, sa=1.0):
        self.parts.append(f'<rect x="{self.ox + x:.1f}" y="{self.oy + y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{r:.1f}" '
                          f'fill="{fill or "none"}" fill-opacity="{fa}" stroke="{stroke or "none"}" stroke-width="{sw:.1f}" stroke-opacity="{sa}"/>')

    def circle(self, cx, cy, r, fill=None, fa=1.0, stroke=None, sw=0, dashed=False):
        dash = f' stroke-dasharray="{r * .6:.1f} {r * .45:.1f}"' if dashed else ''
        self.parts.append(f'<circle cx="{self.ox + cx:.1f}" cy="{self.oy + cy:.1f}" r="{r:.1f}" fill="{fill or "none"}" '
                          f'fill-opacity="{fa}" stroke="{stroke or "none"}" stroke-width="{sw:.1f}"{dash}/>')

    def polyline(self, pts, stroke, sw, alpha=1.0):
        d = ' '.join(f'{self.ox + x:.1f},{self.oy + y:.1f}' for x, y in pts)
        self.parts.append(f'<polyline points="{d}" fill="none" stroke="{stroke}" stroke-width="{sw:.1f}" '
                          f'stroke-linecap="round" stroke-linejoin="round" stroke-opacity="{alpha}"/>')

    def text(self, x, cy, s, size, weight, color, anchor='middle', tracking=0.0, alpha=1.0):
        s = s.replace('&', '&amp;').replace('<', '&lt;')
        ta = {'middle': 'middle', 'start': 'start', 'end': 'end'}[anchor]
        ls = f' letter-spacing="{tracking * size:.1f}"' if tracking else ''
        self.parts.append(f'<text x="{self.ox + x:.1f}" y="{self.oy + cy:.1f}" font-size="{size:.1f}" font-weight="{weight}" '
                          f'fill="{color}" fill-opacity="{alpha}" text-anchor="{ta}" dominant-baseline="central"{ls}>{s}</text>')


# ---------------------------------------------------------------- etiket çizimi
def mark_path(kind: str, cx: float, cy: float, r: float) -> list[list[tuple[float, float]]]:
    if kind == 'yes':
        return [[(cx - r * .58, cy + r * .02), (cx - r * .16, cy + r * .46), (cx + r * .62, cy - r * .5)]]
    if kind == 'no':
        return [[(cx - r * .5, cy - r * .5), (cx + r * .5, cy + r * .5)], [(cx + r * .5, cy - r * .5), (cx - r * .5, cy + r * .5)]]
    return []


def draw_label(c: Canvas, s: State, ppm: float, alpha: float = 1.0) -> None:
    """Etiketi (0,0) sol-üst köşesinden ppm (px/m) ölçeğinde çizer."""
    m = lambda v: v * ppm  # noqa: E731
    r = resolve(s)
    W, H = m(SPEC['W']), m(SPEC['C_H'] if s.compact else SPEC['H'])
    R = m(SPEC['C_R'] if s.compact else SPEC['R'])
    lw = m(r['lw'])
    ga = alpha * (1 if not r['dead'] else 1)  # ölü etiketin alfası zemin alfasında
    # Zemin + çerçeve
    c.rrect(lw / 2, lw / 2, W - lw, H - lw, R, fill=r['bg'], fa=r['bga'] * ga, stroke=r['frame'], sw=lw,
            sa=(.7 if r['dead'] else 1) * ga)
    # Hedefleme köşe kancaları (aimed)
    if r['brackets']:
        b, o, w2 = m(SPEC['BRACKET']), m(SPEC['BRACKET_OUT']), m(SPEC['LINE'])
        for sx, sy in ((1, 1), (-1, 1), (1, -1), (-1, -1)):
            x0 = -o if sx > 0 else W + o
            y0 = -o if sy > 0 else H + o
            c.polyline([(x0, y0 + sy * b), (x0, y0), (x0 + sx * b, y0)], TOK['gold'], w2, ga)
    # İsim
    if s.compact:
        ncy, nsize = m(SPEC['C_NAME_CY']), m(SPEC['C_NAME_SIZE'])
    else:
        ncy, nsize = m(SPEC['NAME_CY']), m(SPEC['NAME_SIZE'])
    name_x = W / 2
    # kompakt: satır 2 yok; makam simgesi ismin soluna, çip ismin sağına
    if s.compact:
        items_w = 0
        if r['glyph']: items_w += m(SPEC['GLYPH_D']) + m(SPEC['GLYPH_GAP'])
        chip_w = m(SPEC['CHIP_H']) * .8 if r['chip'] else 0
        nw = min(text_width(r['name'], nsize, 550), m(SPEC['NAME_MAX']) - items_w - chip_w)
        total = items_w + nw + (chip_w + m(SPEC['CHIP_GAP']) if chip_w else 0)
        x = W / 2 - total / 2
        if r['glyph']:
            draw_glyph(c, r['glyph'], x + m(SPEC['GLYPH_D']) / 2, ncy, m(SPEC['GLYPH_D']), ga)
            x += m(SPEC['GLYPH_D']) + m(SPEC['GLYPH_GAP'])
        c.text(x, ncy, r['name'], nsize, 550, r['name_color'], 'start', 0, ga)
        x += nw + m(SPEC['CHIP_GAP'])
        if r['chip']:
            draw_chip(c, r['chip'], x, ncy, m(SPEC['CHIP_H']) * .8, ppm, compact=True, alpha=ga)
        if r['tag']: draw_tag(c, r['tag'], ppm, ga)
        return
    c.text(name_x, ncy, r['name'], nsize, 550, r['name_color'], 'middle', 0, ga)
    # Satır 2
    pad, cy = m(SPEC['PAD']), m(SPEC['META_CY'])
    msize, track = m(SPEC['META_SIZE']), SPEC['META_TRACK']
    left_w = 0
    if r['glyph']: left_w += m(SPEC['GLYPH_D']) + (m(SPEC['GLYPH_GAP']) if r['text'] else 0)
    if r['text']: left_w += text_width(r['text'], msize, 600, track)
    chip_h = m(SPEC['CHIP_H'])
    chip_full_w = 0
    if r['chip']:
        chip_full_w = m(SPEC['CHIP_PADX']) * 2 + m(SPEC['CHIP_GLYPH_R']) * 2 + m(.010) + text_width(r['chip']['label'], m(SPEC['CHIP_TEXT']), 650, .04)
    avail = W - 2 * pad
    compact_chip = bool(r['chip']) and (left_w + (m(SPEC['CHIP_GAP']) if left_w else 0) + chip_full_w > avail)
    chip_w = (chip_h if compact_chip else chip_full_w) if r['chip'] else 0
    if r['chip'] and left_w:
        # çip sağa yaslı, sol grup kalan alanda ortalı
        chip_x = W - pad - chip_w
        zone_l, zone_r = pad, chip_x - m(SPEC['CHIP_GAP'])
    elif r['chip']:
        chip_x = W / 2 - chip_w / 2
        zone_l = zone_r = None
    else:
        chip_x = None
        zone_l, zone_r = pad, W - pad
    if zone_l is not None:
        x = (zone_l + zone_r) / 2 - left_w / 2
        if r['glyph']:
            draw_glyph(c, r['glyph'], x + m(SPEC['GLYPH_D']) / 2, cy, m(SPEC['GLYPH_D']), ga)
            x += m(SPEC['GLYPH_D']) + (m(SPEC['GLYPH_GAP']) if r['text'] else 0)
        if r['text']:
            c.text(x, cy, r['text'], msize, 600, r['tcol'], 'start', track, ga)
    if r['chip']:
        draw_chip(c, r['chip'], chip_x, cy, chip_h, ppm, compact=compact_chip, alpha=ga)
    if r['tag']:
        draw_tag(c, r['tag'], ppm, ga)


def draw_glyph(c: Canvas, g: dict, cx: float, cy: float, d: float, alpha: float) -> None:
    rr = d / 2
    if g['kind'] == 'disc' and not g['candidate']:
        c.circle(cx, cy, rr, fill=g['color'], fa=alpha)
    elif g['kind'] == 'disc':
        c.circle(cx, cy, rr - d * .1, stroke=g['color'], sw=d * .18, dashed=True)
        c.circle(cx, cy, rr * .35, fill=g['color'], fa=alpha)
    elif not g['candidate']:
        c.circle(cx, cy, rr - d * .1, stroke=g['color'], sw=d * .2)
    else:
        c.circle(cx, cy, rr - d * .1, stroke=g['color'], sw=d * .18, dashed=True)


def draw_chip(c: Canvas, chip: dict, x: float, cy: float, h: float, ppm: float, compact: bool, alpha: float) -> None:
    m = lambda v: v * ppm  # noqa: E731
    a = chip['alpha'] * alpha
    gr = m(SPEC['CHIP_GLYPH_R'])
    if compact:
        c.circle(x + h / 2, cy, h / 2, fill=TOK['chipFill'], fa=a, stroke=chip['accent'], sw=m(.003))
        gcx = x + h / 2
    else:
        w = m(SPEC['CHIP_PADX']) * 2 + gr * 2 + m(.010) + text_width(chip['label'], m(SPEC['CHIP_TEXT']), 650, .04)
        c.rrect(x, cy - h / 2, w, h, h / 2, fill=TOK['chipFill'], fa=a, stroke=chip['accent'], sw=m(.003), sa=a)
        gcx = x + m(SPEC['CHIP_PADX']) + gr
        c.text(gcx + gr + m(.010), cy, chip['label'], m(SPEC['CHIP_TEXT']), 650, chip['ink'], 'start', .04, a)
    if chip['mark'] == 'idle':
        c.circle(gcx, cy, gr * .62, stroke=chip['ink'], sw=gr * .28)
    else:
        for seg in mark_path(chip['mark'], gcx, cy, gr * 1.15):
            c.polyline(seg, chip['ink'], gr * .34, a)


def draw_tag(c: Canvas, label: str, ppm: float, alpha: float) -> None:
    m = lambda v: v * ppm  # noqa: E731
    x, y, w, h = m(SPEC['TAG_X']), m(SPEC['TAG_Y']), m(SPEC['TAG_W']), m(SPEC['TAG_H'])
    c.rrect(x, y, w, h, h / 2, fill=TOK['brass'], fa=alpha)
    c.text(x + w / 2, y + h / 2, label, m(SPEC['TAG_TEXT']), 700, TOK['ink'], 'middle', .12, alpha)


# ---------------------------------------------------------------- SVG durum sayfası
def svg_sheet() -> str:
    PPM = 1000.0
    W, H = SPEC['W'] * PPM, SPEC['H'] * PPM
    GX, GY, CAPH = 90, 120, 60
    cols = 4
    groups: list[tuple[str, list[tuple[str, State]]]] = [
        ('Temel durumlar', [
            ('Normal (oyun içi, dolgu KOLTUK)', State('Kaan', seat=4)),
            ('Sen (genel masa görünümü)', State('Mert', local=True, seat=1)),
            ('Başkan', State('Elif', office='president')),
            ('Şansölye', State('Selin', office='chancellor')),
            ('Başkan adayı', State('Elif', office='president_candidate')),
            ('Şansölye adayı', State('Selin', office='chancellor_candidate')),
            ('Hazır (lobi)', State('Ada', lobby=True, status='ready')),
            ('Lobi, hazır değil', State('Barış', lobby=True, seat=6)),
        ]),
        ('Etkileşim', [
            ('Hedef seçilebilir', State('Deniz', targetable=True)),
            ('Üzerinde (hover)', State('Deniz', targetable=True, hovered=True)),
            ('Hedeflendi (klavye, aimed)', State('Deniz', targetable=True, aimed=True)),
            ('Seçili', State('Deniz', targetable=True, selected=True)),
        ]),
        ('Bağlantı ve eleme', [
            ('Bağlantı yok', State('Barış', status='offline')),
            ('Bağlantı yok + başkan', State('Elif', status='offline', office='president')),
            ('Elendi', State('Kaan', status='eliminated')),
            ('Uzun isim kırpma (15 kr)', State('Ayşegül Demirtaşoğlu', seat=9)),
        ]),
        ('Oy çipi (D5 gömülü)', [
            ('Oy bekliyor', State('Kaan', seat=4, vote='waiting')),
            ('Oy verdi', State('Kaan', seat=4, vote='voted')),
            ('Evet', State('Kaan', seat=4, vote='yes')),
            ('Hayır', State('Kaan', seat=4, vote='no')),
        ]),
        ('Kombinasyonlar', [
            ('Başkan + evet', State('Elif', office='president', vote='yes')),
            ('Şansölye adayı + hayır (çip kısa)', State('Selin', office='chancellor_candidate', vote='no')),
            ('Başkan adayı + oy verdi (çip kısa)', State('Elif', office='president_candidate', vote='voted')),
            ('Bağlantı yok + bekliyor', State('Barış', status='offline', vote='waiting')),
            ('Şansölye + hedef seçilebilir', State('Selin', office='chancellor', targetable=True)),
            ('Başkan + hedeflendi', State('Elif', office='president', aimed=True)),
            ('Uzun isim + başkan + evet', State('Ayşegül Demirtaşoğlu', office='president', vote='yes')),
            ('Elendi (oy yok, makam yok)', State('Ayşegül Demirtaşoğlu', status='eliminated')),
        ]),
        ('Kompakt varyant (telefon, 0,60 × 0,11 m)', [
            ('Normal', State('Kaan', compact=True)),
            ('Başkan + evet', State('Elif', office='president', vote='yes', compact=True)),
            ('Şansölye + hayır', State('Selin', office='chancellor', vote='no', compact=True)),
            ('Sen + hedeflendi', State('Mert', local=True, aimed=True, compact=True)),
        ]),
    ]
    parts = []
    y = 150
    cellw, cellh = W + GX, H + CAPH + GY
    total_w = int(cols * cellw + GX)
    # Anatomi çizimi
    parts.append(f'<text x="{GX}" y="70" font-size="44" font-weight="600" fill="{TOK["name"]}">D6 · Baş üstü isim etiketi — durum sayfası</text>')
    parts.append(f'<text x="{GX}" y="108" font-size="22" fill="{TOK["name2"]}">Ölçek 1 m = 1000 px · etiket 0,60 × 0,18 m · yazı: Noto Sans / sans-serif · renkler docs/design/D6-nameplate.md §4</text>')
    for title, items in groups:
        parts.append(f'<text x="{GX}" y="{y + 10}" font-size="30" font-weight="600" fill="{TOK["gold"]}">{title}</text>')
        y += 50
        for i, (cap, st) in enumerate(items):
            cx = GX + (i % cols) * cellw
            cy = y + (i // cols) * cellh
            c = SvgCanvas(cx, cy)
            draw_label(c, st, PPM)
            parts.extend(c.parts)
            hh = SPEC['C_H'] * PPM if st.compact else H
            parts.append(f'<text x="{cx}" y="{cy + hh + 38}" font-size="22" fill="{TOK["name2"]}">{cap}</text>')
        rows = math.ceil(len(items) / cols)
        y += rows * cellh + 20
    # Anatomi / ölçü çizgileri
    parts.append(f'<text x="{GX}" y="{y + 10}" font-size="30" font-weight="600" fill="{TOK["gold"]}">Anatomi ve ölçüler (metre)</text>')
    y += 120
    c = SvgCanvas(GX + 260, y)
    draw_label(c, State('Elif', office='president', vote='yes', local=True), PPM)
    parts.extend(c.parts)
    ax, ay = GX + 260, y
    dim = TOK['target']
    def dline(x1, y1, x2, y2, label, lx, ly):
        parts.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{dim}" stroke-width="2" stroke-dasharray="6 5"/>')
        parts.append(f'<text x="{lx}" y="{ly}" font-size="20" fill="{dim}" text-anchor="middle">{label}</text>')
    dline(ax, ay - 40, ax + W, ay - 40, 'W = 0,60 m', ax + W / 2, ay - 50)
    dline(ax + W + 40, ay, ax + W + 40, ay + H, 'H = 0,18 m', ax + W + 120, ay + H / 2)
    dline(ax - 40, ay, ax - 40, ay + SPEC['NAME_CY'] * PPM, 'isim merkezi 0,064', ax - 150, ay + SPEC['NAME_CY'] * PPM + 24)
    dline(ax - 40, ay + SPEC['META_CY'] * PPM, ax - 110, ay + SPEC['META_CY'] * PPM, 'satır 2 merkezi 0,135', ax - 160, ay + SPEC['META_CY'] * PPM + 30)
    notes = [
        'köşe r = 0,032 · çerçeve 0,006 (hedeflendi 0,010) · iç pay 0,030',
        'isim 0,066 m (550) · en fazla 15 karakter, 14 + … · genişlik ≤ 0,50',
        'satır 2 büyük harf 0,038 m (600), +0,06 em aralık · makam simgesi ⌀ 0,026',
        'oy çipi yükseklik 0,060 · yazı 0,034 (650) · iç pay 0,020 · sığmazsa yalnız simge (⌀ 0,060)',
        'SEN etiketi 0,090 × 0,034, sol üst, çerçeveyi 0,012 taşar',
        'dünya konumu: etiket alt kenarı baş tepesinin 0,05 m üstü (y = 0,48) · kameraya döner · ölçek alt kenardan büyür',
    ]
    for k, n in enumerate(notes):
        parts.append(f'<text x="{ax + W + 200}" y="{ay + 20 + k * 34}" font-size="22" fill="{TOK["name2"]}">{n}</text>')
    y += H + 120
    total_h = int(y)
    body = '\n'.join(parts)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{total_w}" height="{total_h}" viewBox="0 0 {total_w} {total_h}" '
            f'font-family="Noto Sans, Inter, Helvetica Neue, Arial, sans-serif">\n'
            f'<rect width="100%" height="100%" fill="#0f1815"/>\n'
            f'<!-- Sahne zemini (fotoğraflardaki keçe/duvar) temsili -->\n{body}\n</svg>\n')


# ---------------------------------------------------------------- fotomontaj
def cover(im: Image.Image, box: tuple[int, int, int, int], side: str = 'both', pad: int = 6, mode: str = 'h') -> None:
    """Kutuyu komşu piksellerden aldığı renkle doldurur (eski plakayı gizler).
    mode 'h': satır satır sol/sağ komşudan; 'v': sütun sütun üst/alt komşudan (yanında el/kart varken)."""
    x0, y0, x1, y1 = box
    px = im.load()
    W, H = im.width, im.height

    def avg(pts):
        vals = [px[x, y] for x, y in pts if 0 <= x < W and 0 <= y < H]
        return tuple(sum(v[i] for v in vals) // len(vals) for i in range(3)) if vals else None

    if mode == 'm':
        # Kutuyu çevreleyen halkanın kanal medyanı: el/kart gibi aykırı komşulara dayanıklı düz dolgu
        ring = [px[x, y] for y in range(y0 - pad, y1 + pad) for x in range(x0 - pad, x1 + pad)
                if 0 <= x < W and 0 <= y < H and not (x0 <= x < x1 and y0 <= y < y1)]
        felt = [v for v in ring if v[1] > v[0] + 12 and v[1] > v[2] + 12]  # yalnız keçe tonları (el/ahşap dışarıda)
        ring = felt or ring
        med = tuple(sorted(v[i] for v in ring)[len(ring) // 2] for i in range(3))
        for y in range(y0, y1):
            for x in range(x0, x1):
                px[x, y] = med
        return
    if mode == 'hf':
        # Satır satır, sol/sağ tarafta en yakın KEÇE tonlu (G baskın) pikselleri arar; el/ahşap atlanır
        isfelt = lambda v: v[1] > v[0] + 12 and v[1] > v[2] + 12  # noqa: E731
        for y in range(y0, y1):
            L = avg([(x, y) for x in range(x0 - 1, max(-1, x0 - 90), -1) if isfelt(px[x, y])][:pad])
            Rr = avg([(x, y) for x in range(x1, min(W, x1 + 90)) if isfelt(px[x, y])][:pad])
            if L is None and Rr is None: continue
            L, Rr = L or Rr, Rr or L
            n = max(1, x1 - x0)
            for x in range(x0, x1):
                t = (x - x0) / n
                px[x, y] = tuple(round(L[i] * (1 - t) + Rr[i] * t) for i in range(3))
        return
    if mode in ('v', 'vf'):
        # Sütun sütun; örnekler kutunun 45-60 px ötesinden (el/plaka gölgesi halkasının dışından) alınır
        isfelt = (lambda v: v[1] > v[0] + 12 and v[1] > v[2] + 12) if mode == 'vf' else (lambda v: True)  # noqa: E731
        off = 45
        for x in range(x0, x1):
            T = avg([(x, y) for y in range(y0 - off, y0 - off - 15, -1) if isfelt(px[x, y])])
            B = avg([(x, y) for y in range(y1 + off, y1 + off + 15) if isfelt(px[x, y])])
            T, B = T or B, B or T
            if T is None: continue
            n = max(1, y1 - y0)
            for y in range(y0, y1):
                t = (y - y0) / n
                px[x, y] = tuple(round(T[i] * (1 - t) + B[i] * t) for i in range(3))
        return
    for y in range(y0, y1):
        L = avg([(x, y) for x in range(x0 - pad, x0)]) if side in ('both', 'left') else None
        Rr = avg([(x, y) for x in range(x1, x1 + pad)]) if side in ('both', 'right') else None
        if L is None and Rr is None: continue
        L, Rr = L or Rr, Rr or L
        n = max(1, x1 - x0)
        for x in range(x0, x1):
            t = (x - x0) / n
            px[x, y] = tuple(round(L[i] * (1 - t) + Rr[i] * t) for i in range(3))


def paste_label(base: Image.Image, st: State, cx: float, bottom: float, ppm: float, ss: int = 3) -> None:
    """Etiketi alt-merkez (cx,bottom) noktasına ppm ölçeğinde, ss× süperörnekleme ile bindirir."""
    m = lambda v: v * ppm * ss  # noqa: E731
    W, H = m(SPEC['W']), m(SPEC['C_H'] if st.compact else SPEC['H'])
    margin = m(.06)
    layer = Image.new('RGBA', (int(W + 2 * margin), int(H + 2 * margin)), (0, 0, 0, 0))
    c = PilCanvas(layer, margin, margin)
    draw_label(c, st, ppm * ss)
    small = layer.resize((round(layer.width / ss), round(layer.height / ss)), Image.LANCZOS)
    x = round(cx - small.width / 2)
    y = round(bottom + margin / ss - small.height)
    base.alpha_composite(small, (x, y))


def mockup_seat() -> None:
    im = Image.open(os.path.join(ROOT, 'docs/qa/claude/d5/result-seat.png')).convert('RGB')
    # Eski plakalar + makam plakası + D5 rozeti gizlenir
    cover(im, (895, 720, 1200, 805))     # Selin plakası
    cover(im, (1690, 720, 1995, 805))    # Kaan plakası
    cover(im, (1040, 805, 1090, 822))    # Selin makam plakası artığı
    cover(im, (925, 474, 1065, 536))     # Selin D5 rozeti
    cover(im, (1815, 474, 1955, 536))    # Kaan D5 rozeti
    cover(im, (20, 780, 445, 912), mode='v')     # Barış plakası (kenar)
    cover(im, (2440, 780, 2875, 912), mode='v')   # Deniz plakası (kenar)
    im = im.convert('RGBA')
    # Ölçek: karşı koltuk ~3,97 m, fov 40°, 900 css px → 0,00321 m/css px → 1 m = 623 cihaz px (DPR 2)
    ppm_far = 623
    clear = .05 * ppm_far
    paste_label(im, State('Selin', office='chancellor', vote='yes'), 1000, 562 - clear, ppm_far)
    paste_label(im, State('Kaan', seat=4, vote='no'), 1830, 562 - clear, ppm_far)
    # Yan komşular ~3,6 m → 1 m = 687 px; başları ekran kenarında (kısmen görünür)
    ppm_side = 687
    paste_label(im, State('Barış', seat=6, vote='no'), 10, 650 - .05 * ppm_side, ppm_side)
    paste_label(im, State('Deniz', seat=3, vote='no'), 2870, 650 - .05 * ppm_side, ppm_side)
    im.convert('RGB').save(os.path.join(OUT, 'mockup-seat.png'), optimize=True)


def mockup_overview() -> None:
    im = Image.open(os.path.join(ROOT, 'docs/qa/claude/d5/result-overview.png')).convert('RGB')
    for box in [(1076, 566, 1280, 624), (1116, 622, 1232, 644),     # Selin plaka + makam
                (1602, 566, 1798, 624),                             # Kaan
                (1322, 1182, 1558, 1264)]:                          # Mert
        cover(im, box)
    for box in [(702, 748, 918, 824), (1968, 748, 2185, 824),       # Barış, Deniz (yanlarında el var: dikey)
                (775, 1035, 998, 1110), (1882, 1035, 2105, 1136)]:  # Ada, Elif + makam plakası
        cover(im, box, mode='vf', pad=8)
    for box in [(1042, 328, 1172, 380), (1708, 328, 1838, 380), (535, 602, 672, 658), (2208, 602, 2345, 658),
                (588, 1048, 725, 1104), (2155, 1048, 2292, 1104)]:  # D5 rozetleri
        cover(im, box)
    im = im.convert('RGBA')
    # Genel masa: 0,18 m → ~27 css px < 48 → etiket 48 css px'e (96 cihaz px) büyütülür; 1 m = 533 px
    ppm = 96 / SPEC['H']
    clear = 12  # 0,05 m düşey boşluk, 45° kamera izdüşümü
    for st, cx, top in [
        (State('Selin', office='chancellor', vote='yes'), 1113, 387),
        (State('Kaan', seat=4, vote='no'), 1751, 387),
        (State('Barış', seat=6, vote='no'), 647, 687),
        (State('Deniz', seat=3, vote='no'), 2233, 687),
        (State('Ada', seat=7, vote='yes'), 687, 1113),
        (State('Elif', office='president_candidate', vote='yes'), 2187, 1113),
        (State('Mert', local=True, seat=1), 1440, 1336),
    ]:
        paste_label(im, st, cx, top - clear, ppm)
    im.convert('RGB').save(os.path.join(OUT, 'mockup-overview.png'), optimize=True)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, 'nameplate-states.svg'), 'w', encoding='utf-8') as fh:
        fh.write(svg_sheet())
    mockup_seat()
    mockup_overview()
    print('ok', OUT)
