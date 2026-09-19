import { useEffect, useState } from 'react';

import { freezeSceneClock, frozenTime, setSceneClock, subscribeSceneClock } from './sceneClock';

/**
 * `/dev/scene?...&t=1300` — sahne saatini dondurup cue kabul edilince o ana
 * ilerletir (D12 görsel kanıt). Dönen sayaç yalnız yeniden çizim tetikler.
 *
 * Saat İLK RENDER'da (children mount olmadan) durdurulur: cue `startedAt`
 * değeri de dondurulmuş ana düşer, böylece `t` cue başlangıcından ölçülür.
 */
export function useFrozenScene(raw: string | null): number {
  const target = frozenTime(raw);
  useState(() => {
    if (target !== null) freezeSceneClock(0);
    return null;
  });
  const [tick, setTick] = useState(0);
  useEffect(() => subscribeSceneClock(() => setTick((n) => n + 1)), []);
  useEffect(() => {
    if (target === null) return;
    let raf = 0;
    const startedAt = Date.now();
    const step = () => {
      const el = document.querySelector('[data-scene-cues-active]');
      const active = Number(el?.getAttribute('data-scene-cues-active') ?? 0);
      // D16: jestin de cue'su yok; sahne jesti latch'leyince dondur.
      const emotes = Number(el?.getAttribute('data-scene-emotes') ?? 0);
      const localEmote = el?.getAttribute('data-scene-emote-local') ?? '';
      // Cue/jest kabul edildiyse (ya da 8 sn içinde gelmediyse) istenen ana atla.
      if (active > 0 || emotes > 0 || localEmote !== '' || Date.now() - startedAt > 8000) {
        setSceneClock(target);
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return tick;
}
