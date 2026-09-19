import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import { MaterialContext } from './context';
export { useSceneMaterials } from './context';

const sansUrl = new URL('../../public/fonts/NotoSans.ttf', import.meta.url).href;
const serifUrl = new URL('../../public/fonts/NotoSerif.ttf', import.meta.url).href;
let fontPromise: Promise<void> | undefined;
function loadFonts() {
  fontPromise ??= Promise.all([
    new FontFace('Table Sans', `url("${sansUrl}")`, { weight: '100 900' }).load(),
    new FontFace('Table Serif', `url("${serifUrl}")`, { weight: '100 900' }).load(),
  ]).then((fonts) => { fonts.forEach((font) => document.fonts.add(font)); });
  return fontPromise;
}

export function canvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Masa dokuları oluşturulamadı.');
  draw(ctx);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function surfaceTexture(kind: 'wood' | 'felt') {
  const texture = canvasTexture(512, 512, (ctx) => {
    ctx.fillStyle = kind === 'wood' ? '#72533f' : '#477363';
    ctx.fillRect(0, 0, 512, 512);
    let seed = 37;
    const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    if (kind === 'wood') {
      for (let y = 0; y < 512; y += 1) {
        ctx.strokeStyle = `rgba(${random() > .5 ? '37,17,8' : '202,158,104'},${random() * .11})`;
        ctx.lineWidth = random() * 2 + .3;
        ctx.beginPath();
        for (let x = 0; x <= 512; x += 8) {
          const dy = Math.sin(x / 83 + y / 44) * 6 + Math.sin(x / 31 + y / 73) * 2;
          if (x === 0) ctx.moveTo(x, y + dy); else ctx.lineTo(x, y + dy);
        }
        ctx.stroke();
      }
    } else {
      for (let i = 0; i < 46000; i++) {
        ctx.fillStyle = `rgba(${random() > .5 ? '224,238,210' : '2,23,13'},${random() * .19})`;
        ctx.fillRect(random() * 512, random() * 512, .7, 1.6);
      }
    }
  });
  texture.wrapS = texture.wrapT = RepeatWrapping;
  if (kind === 'felt') texture.repeat.set(3, 3);
  return texture;
}

export function SceneMaterials({ children }: { children: ReactNode }) {
  const [fontsReady, setFontsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const textures = useMemo(() => ({ wood: surfaceTexture('wood'), felt: surfaceTexture('felt') }), []);
  useEffect(() => {
    let active = true;
    loadFonts().then(() => { if (active) setFontsReady(true); }).catch(() => {
      if (active) setError(new Error('Yerel masa fontları yüklenemedi. Önizlemeyi yeniden açın.'));
    });
    return () => { active = false; };
  }, []);
  useEffect(() => () => { textures.wood.dispose(); textures.felt.dispose(); }, [textures]);
  if (error) throw error;
  return <MaterialContext.Provider value={{ ...textures, fontsReady }}>{children}</MaterialContext.Provider>;
}
