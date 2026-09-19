/**
 * D2 oda dokuları — hepsi canvas'ta prosedürel üretilir, dış varlık yok.
 *
 * `document` olmayan ortamda (vitest node) her üretici `null` döner; çağıran
 * dokuyu atlar (malzeme düz renge düşer). Böylece geometri/bütçe testleri
 * jsdom olmadan çalışır.
 */
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import type { Texture } from 'three';
import { room } from '../materials/palette';

/** Tarayıcı dışı ortamda doku üretimi atlanır (test güvenliği). */
export const canDrawTextures = () =>
  typeof document !== 'undefined' && typeof document.createElement === 'function';

function draw(size: number, height: number, paint: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): Texture | null {
  if (!canDrawTextures()) return null;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  paint(ctx, size, height);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  return texture;
}

/** Tekrarlanabilir gürültü; her doku kendi tohumuyla çağırır. */
function rng(seed: number) {
  let state = seed;
  return () => { state = (state * 16807) % 2147483647; return state / 2147483647; };
}

/** Balıksırtı parke: 1024², 6×5 tekrar. Lata yönü dönüşümlü. */
export function parquetTexture(): Texture | null {
  return draw(1024, 1024, (ctx, w, h) => {
    const random = rng(91);
    ctx.fillStyle = room.floorLine; ctx.fillRect(0, 0, w, h);
    const block = w / 8;           // 8×8 balıksırtı bloğu
    const plank = block / 4;       // blok başına 4 lata
    for (let by = 0; by < 8; by += 1) for (let bx = 0; bx < 8; bx += 1) {
      const horizontal = (bx + by) % 2 === 0;
      for (let i = 0; i < 4; i += 1) {
        const tone = random();
        ctx.fillStyle = tone > .5 ? room.floor2 : room.floor;
        const x = bx * block, y = by * block;
        if (horizontal) ctx.fillRect(x + .6, y + i * plank + .6, block - 1.2, plank - 1.2);
        else ctx.fillRect(x + i * plank + .6, y + .6, plank - 1.2, block - 1.2);
        // damar
        ctx.strokeStyle = `rgba(28,16,8,${.05 + random() * .1})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let t = 0; t <= 1.001; t += .1) {
          const along = t * block, off = (random() - .5) * plank * .3 + plank / 2;
          const px = horizontal ? x + along : x + i * plank + off;
          const py = horizontal ? y + i * plank + off : y + along;
          if (t === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
    }
    // genel kirlilik / cila lekeleri
    for (let i = 0; i < 900; i += 1) {
      ctx.fillStyle = `rgba(${random() > .5 ? '18,10,4' : '150,116,74'},${random() * .06})`;
      ctx.fillRect(random() * w, random() * h, random() * 40 + 6, random() * 8 + 2);
    }
  });
}

/** Yeşil damask duvar kâğıdı: 512², ince altın motif. */
export function damaskTexture(): Texture | null {
  return draw(512, 512, (ctx, w, h) => {
    const random = rng(1301);
    ctx.fillStyle = room.wallpaper; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 26000; i += 1) {
      ctx.fillStyle = `rgba(${random() > .5 ? '214,232,214' : '4,18,12'},${random() * .05})`;
      ctx.fillRect(random() * w, random() * h, 1.2, 1.2);
    }
    const motif = (cx: number, cy: number, scale: number) => {
      ctx.save(); ctx.translate(cx, cy); ctx.scale(scale, scale);
      ctx.fillStyle = room.wallpaper2;
      ctx.beginPath();
      ctx.moveTo(0, -42);
      ctx.bezierCurveTo(26, -30, 32, -6, 0, 40);
      ctx.bezierCurveTo(-32, -6, -26, -30, 0, -42);
      ctx.fill();
      ctx.strokeStyle = room.wallGold; ctx.lineWidth = 1.6; ctx.stroke();
      // yan kıvrımlar
      ctx.strokeStyle = room.wallGold; ctx.lineWidth = 1.2;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(side * 6, 18);
        ctx.bezierCurveTo(side * 34, 6, side * 42, -18, side * 22, -34);
        ctx.stroke();
      }
      ctx.restore();
    };
    // yarım kaydırmalı ızgara (kenarlar sorunsuz eklensin)
    for (let row = -1; row <= 4; row += 1) for (let col = -1; col <= 4; col += 1) {
      motif(col * 128 + (row % 2 ? 64 : 0), row * 128 + 64, 1);
      ctx.fillStyle = room.wallGold;
      ctx.globalAlpha = .5;
      ctx.beginPath();
      ctx.arc(col * 128 + (row % 2 ? 64 : 0) + 64, row * 128, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  });
}

/** Halı: art-deco pirinç bordür + keçe dokusu (elips için kare kaplama). */
export function rugTexture(): Texture | null {
  const texture = draw(512, 512, (ctx, w, h) => {
    const random = rng(577);
    ctx.fillStyle = room.rug; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 34000; i += 1) {
      ctx.fillStyle = `rgba(${random() > .5 ? '196,220,204' : '2,16,10'},${random() * .08})`;
      ctx.fillRect(random() * w, random() * h, 1.4, 1.4);
    }
    ctx.save(); ctx.translate(w / 2, h / 2);
    ctx.strokeStyle = room.rugLine;
    for (const [r, width, dash] of [[232, 3, null], [214, 1.2, [10, 7]], [176, 2, null], [162, 1, [4, 6]]] as const) {
      ctx.lineWidth = width; ctx.setLineDash(dash ? [...dash] : []);
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.setLineDash([]);
    // merkez güneş motifi
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 24; i += 1) {
      const a = i / 24 * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 40, Math.sin(a) * 40);
      ctx.lineTo(Math.cos(a) * 96, Math.sin(a) * 96);
      ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  });
  if (texture) texture.wrapS = texture.wrapT = 1001; // ClampToEdgeWrapping
  return texture;
}

/** Kasetli (koffer) tavan: 256², 3×3 tekrar. */
export function ceilingTexture(): Texture | null {
  return draw(256, 256, (ctx, w) => {
    ctx.fillStyle = room.ceiling2; ctx.fillRect(0, 0, w, w);
    const cell = w / 2;
    for (let y = 0; y < 2; y += 1) for (let x = 0; x < 2; x += 1) {
      const px = x * cell, py = y * cell;
      ctx.fillStyle = room.ceiling;
      ctx.fillRect(px + 10, py + 10, cell - 20, cell - 20);
      ctx.strokeStyle = 'rgba(90,74,48,.35)'; ctx.lineWidth = 3;
      ctx.strokeRect(px + 16, py + 16, cell - 32, cell - 32);
      ctx.strokeStyle = 'rgba(255,246,222,.4)'; ctx.lineWidth = 1.4;
      ctx.strokeRect(px + 21, py + 21, cell - 42, cell - 42);
    }
  });
}

/** Gece penceresi: gradyan gök, ay, Berlin silueti, birkaç sıcak pencere. */
export function nightTexture(): Texture | null {
  const texture = draw(256, 256, (ctx, w, h) => {
    const random = rng(7717);
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#0b1626');
    sky.addColorStop(.62, room.night);
    sky.addColorStop(1, '#1d3048');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i += 1) {
      ctx.fillStyle = `rgba(232,240,255,${random() * .5})`;
      ctx.fillRect(random() * w, random() * h * .55, 1, 1);
    }
    // ay + hale
    const halo = ctx.createRadialGradient(184, 56, 4, 184, 56, 52);
    halo.addColorStop(0, 'rgba(241,230,200,.55)');
    halo.addColorStop(1, 'rgba(241,230,200,0)');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(184, 56, 52, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = room.moon; ctx.beginPath(); ctx.arc(184, 56, 15, 0, Math.PI * 2); ctx.fill();
    // uzak siluet
    ctx.fillStyle = '#1a2c41';
    let x = 0;
    while (x < w) {
      const bw = 14 + random() * 26, bh = 30 + random() * 42;
      ctx.fillRect(x, h - 70 - bh, bw, bh + 70);
      x += bw + 3;
    }
    // yakın siluet + aydınlık pencereler
    ctx.fillStyle = '#0d1a29';
    x = -8;
    while (x < w) {
      const bw = 22 + random() * 34, bh = 44 + random() * 58;
      const top = h - 42 - bh;
      ctx.fillRect(x, top, bw, bh + 42);
      // çatı aksanı
      if (random() > .55) ctx.fillRect(x + bw / 2 - 2, top - 12 - random() * 16, 4, 16);
      for (let wy = top + 8; wy < h - 16; wy += 12) {
        for (let wx = x + 5; wx < x + bw - 6; wx += 10) {
          if (random() > .62) {
            ctx.fillStyle = random() > .3 ? 'rgba(255,208,138,.85)' : 'rgba(180,200,220,.5)';
            ctx.fillRect(wx, wy, 4, 6);
            ctx.fillStyle = '#0d1a29';
          }
        }
      }
      x += bw + 2;
    }
    // cam üstünde hafif parlama
    ctx.fillStyle = 'rgba(160,190,220,.06)';
    ctx.fillRect(0, 0, w, h);
  });
  if (texture) texture.wrapS = texture.wrapT = 1001;
  return texture;
}

/** Berlin haritası: kâğıt tonu, sokak ızgarası, Spree kıvrımı — yazı yok. */
export function mapTexture(): Texture | null {
  const texture = draw(512, 384, (ctx, w, h) => {
    const random = rng(4099);
    ctx.fillStyle = room.paper; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 4000; i += 1) {
      ctx.fillStyle = `rgba(${random() > .5 ? '120,96,60' : '255,248,226'},${random() * .12})`;
      ctx.fillRect(random() * w, random() * h, 2, 2);
    }
    ctx.strokeStyle = 'rgba(80,66,44,.5)'; ctx.lineWidth = 1;
    for (let i = 1; i < 16; i += 1) {
      ctx.beginPath(); ctx.moveTo(i * w / 16, 0); ctx.lineTo(i * w / 16, h); ctx.stroke();
      if (i < 12) { ctx.beginPath(); ctx.moveTo(0, i * h / 12); ctx.lineTo(w, i * h / 12); ctx.stroke(); }
    }
    // radyal bulvarlar
    ctx.strokeStyle = 'rgba(60,48,30,.65)'; ctx.lineWidth = 2;
    for (let i = 0; i < 6; i += 1) {
      const a = i / 6 * Math.PI * 2 + .3;
      ctx.beginPath(); ctx.moveTo(w * .46, h * .5);
      ctx.lineTo(w * .46 + Math.cos(a) * 400, h * .5 + Math.sin(a) * 400); ctx.stroke();
    }
    // Spree
    ctx.strokeStyle = 'rgba(70,110,120,.75)'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-10, h * .68);
    ctx.bezierCurveTo(w * .3, h * .48, w * .45, h * .78, w * .7, h * .52);
    ctx.bezierCurveTo(w * .82, h * .4, w * .9, h * .5, w + 10, h * .38);
    ctx.stroke();
    // yeşil alan
    ctx.fillStyle = 'rgba(96,116,72,.45)';
    ctx.beginPath(); ctx.ellipse(w * .22, h * .34, 62, 40, .3, 0, Math.PI * 2); ctx.fill();
    // kenar yıpranması
    ctx.strokeStyle = 'rgba(70,56,34,.5)'; ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, w - 4, h - 4);
  });
  if (texture) texture.wrapS = texture.wrapT = 1001;
  return texture;
}

/**
 * Afiş atlası 2×2: üç soyut art-deco afiş (yazısız) + saat kadranı.
 * UV bölmeleri: sol-üst/sağ-üst/sol-alt afiş, sağ-alt saat.
 */
export function posterAtlasTexture(): Texture | null {
  const texture = draw(512, 512, (ctx, w) => {
    const q = w / 2;
    const panel = (ox: number, oy: number, paint: () => void) => {
      ctx.save(); ctx.translate(ox, oy);
      ctx.beginPath(); ctx.rect(0, 0, q, q); ctx.clip();
      paint(); ctx.restore();
    };
    // 1 — yükselen ışınlar
    panel(0, 0, () => {
      ctx.fillStyle = room.paper; ctx.fillRect(0, 0, q, q);
      ctx.fillStyle = '#7a2f3a';
      for (let i = 0; i < 9; i += 1) {
        ctx.beginPath(); ctx.moveTo(q / 2, q * .88);
        const a = -Math.PI / 2 + (i - 4) * .22;
        ctx.lineTo(q / 2 + Math.cos(a - .07) * q, q * .88 + Math.sin(a - .07) * q);
        ctx.lineTo(q / 2 + Math.cos(a + .07) * q, q * .88 + Math.sin(a + .07) * q);
        ctx.fill();
      }
      ctx.fillStyle = '#2f3f5c';
      ctx.beginPath(); ctx.arc(q / 2, q * .36, q * .16, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = room.wallGold; ctx.lineWidth = 4; ctx.strokeRect(10, 10, q - 20, q - 20);
    });
    // 2 — basamaklı zigurat
    panel(q, 0, () => {
      ctx.fillStyle = '#1f2c33'; ctx.fillRect(0, 0, q, q);
      ctx.fillStyle = room.paper;
      for (let i = 0; i < 5; i += 1) {
        const inset = i * q * .08;
        ctx.fillRect(q * .18 + inset, q * .78 - i * q * .13, q * .64 - inset * 2, q * .09);
      }
      ctx.fillStyle = room.wallGold;
      ctx.beginPath(); ctx.moveTo(q / 2, q * .1); ctx.lineTo(q * .62, q * .24); ctx.lineTo(q * .38, q * .24); ctx.fill();
      ctx.strokeStyle = room.paper; ctx.lineWidth = 3; ctx.strokeRect(9, 9, q - 18, q - 18);
    });
    // 3 — daire ve dalgalar
    panel(0, q, () => {
      ctx.fillStyle = '#284237'; ctx.fillRect(0, 0, q, q);
      ctx.strokeStyle = room.paper; ctx.lineWidth = 5;
      for (let i = 0; i < 4; i += 1) {
        ctx.beginPath();
        for (let x = 0; x <= q; x += 6) ctx[x === 0 ? 'moveTo' : 'lineTo'](x, q * .62 + i * 22 + Math.sin(x / 26) * 9);
        ctx.stroke();
      }
      ctx.fillStyle = '#c9a227';
      ctx.beginPath(); ctx.arc(q / 2, q * .34, q * .19, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = room.wallGold; ctx.lineWidth = 4; ctx.strokeRect(10, 10, q - 20, q - 20);
    });
    // 4 — saat kadranı (akrep/yelkovan dahil; ayrı geometri yok)
    panel(q, q, () => {
      ctx.fillStyle = '#1a1410'; ctx.fillRect(0, 0, q, q);
      ctx.fillStyle = '#efe3c6';
      ctx.beginPath(); ctx.arc(q / 2, q / 2, q * .42, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = room.brassDark; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.arc(q / 2, q / 2, q * .42, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#2a2418';
      for (let i = 0; i < 12; i += 1) {
        const a = i / 12 * Math.PI * 2;
        ctx.lineWidth = i % 3 === 0 ? 5 : 2.5;
        ctx.beginPath();
        ctx.moveTo(q / 2 + Math.cos(a) * q * .36, q / 2 + Math.sin(a) * q * .36);
        ctx.lineTo(q / 2 + Math.cos(a) * q * .30, q / 2 + Math.sin(a) * q * .30);
        ctx.stroke();
      }
      ctx.lineCap = 'round'; ctx.strokeStyle = '#2a2418';
      ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(q / 2, q / 2); ctx.lineTo(q / 2 + 32, q / 2 - 34); ctx.stroke();
      ctx.lineWidth = 4.5; ctx.beginPath(); ctx.moveTo(q / 2, q / 2); ctx.lineTo(q / 2 - 14, q / 2 + 62); ctx.stroke();
      ctx.fillStyle = room.brassDark;
      ctx.beginPath(); ctx.arc(q / 2, q / 2, 7, 0, Math.PI * 2); ctx.fill();
    });
  });
  if (texture) texture.wrapS = texture.wrapT = 1001;
  return texture;
}

/** Kitap sırtları: 256×256, tek instanced kutu için dikey şerit dokusu. */
export function bookTexture(): Texture | null {
  const texture = draw(64, 128, (ctx, w, h) => {
    const random = rng(233);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    ctx.fillRect(0, 0, 3, h); ctx.fillRect(w - 3, 0, 3, h);
    ctx.fillStyle = 'rgba(226,211,179,.75)';
    for (const y of [h * .16, h * .22, h * .74]) ctx.fillRect(6, y, w - 12, 3);
    for (let i = 0; i < 260; i += 1) {
      ctx.fillStyle = `rgba(${random() > .5 ? '255,255,255' : '0,0,0'},${random() * .1})`;
      ctx.fillRect(random() * w, random() * h, 2, 2);
    }
  });
  if (texture) texture.wrapS = texture.wrapT = 1001;
  return texture;
}

export type RoomTextures = {
  parquet: Texture | null; damask: Texture | null; rug: Texture | null;
  ceiling: Texture | null; night: Texture | null; map: Texture | null;
  posters: Texture | null; books: Texture | null;
};

/** `low` kalitede yalnız kabuk dokuları üretilir (bellek ve süre bütçesi). */
export function createRoomTextures(quality: 'low' | 'standard'): RoomTextures {
  const parquet = parquetTexture();
  if (parquet) parquet.repeat.set(6, 5);
  const damask = damaskTexture();
  if (damask) damask.repeat.set(9, 1.7);
  const ceiling = ceilingTexture();
  if (ceiling) ceiling.repeat.set(3, 3);
  const rug = quality === 'low' ? null : rugTexture();
  const extra = quality === 'low';
  return {
    parquet, damask, rug, ceiling,
    night: extra ? null : nightTexture(),
    map: extra ? null : mapTexture(),
    posters: extra ? null : posterAtlasTexture(),
    books: extra ? null : bookTexture(),
  };
}

export function disposeRoomTextures(textures: RoomTextures) {
  for (const texture of Object.values(textures)) texture?.dispose();
}
