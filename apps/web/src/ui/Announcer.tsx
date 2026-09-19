import { useEffect, useRef, useState } from 'react';
import type { SceneCue, SceneView } from '@secret-table/contracts';

import {
  announcementCandidates,
  announcementsFor,
  enqueueAnnouncements,
  type Announcement,
} from './announcements';

/**
 * Ekran ortası duyuru katmanı — ROADMAP D9.
 *
 * Faz değişimlerini ve önemli olayları (oylar açıldı, kanun kondu, yetki,
 * infaz, kaos, veto, oyun bitti) üst-orta bölgede 2,6–3,2 sn büyük başlıkla
 * duyurur. Eller, kartlar ve alt tuş çubuğu kapanmaz; `pointer-events: none`
 * olduğu için tıklamayı ENGELLEMEZ.
 *
 * Karar tamamen saf `announcements.ts` katmanındadır; burada yalnız kuyruk ve
 * zamanlayıcı vardır. İlk yüklemede / yeniden bağlanmada eldeki anahtarlar
 * "görülmüş" sayılarak tohumlanır: geçmiş fazlar yeniden oynatılmaz.
 */

/** Giriş/çıkış geçiş süresi; `reducedMotion` iken anında. */
const EXIT_MS = 200;

export function Announcer({
  view,
  cues,
  reducedMotion = false,
}: {
  view: SceneView;
  cues: readonly SceneCue[];
  reducedMotion?: boolean;
}) {
  /** Gösterilmiş ya da tohumlanmış anahtarlar; `null` → henüz tohumlanmadı. */
  const seenRef = useRef<Set<string> | null>(null);
  const gameIdRef = useRef<string | null | undefined>(undefined);
  const [queue, setQueue] = useState<readonly Announcement[]>([]);
  const [current, setCurrent] = useState<Announcement | null>(null);
  const [leaving, setLeaving] = useState(false);
  /** D12 §4: gecikmeli duyuru (infaz) bekleme süresi dolana kadar çizilmez. */
  const [armed, setArmed] = useState(true);

  // 1) Yeni görünüm/cue → yeni duyuruları kuyruğa al.
  useEffect(() => {
    if (gameIdRef.current !== view.gameId) {
      // Yeni oyun (ya da ilk görünüm): kuyruğu boşalt, baştan tohumla.
      gameIdRef.current = view.gameId;
      seenRef.current = null;
      setQueue([]);
      setCurrent(null);
      setLeaving(false);
      setArmed(true);
    }
    const seen = seenRef.current;
    if (!seen) {
      seenRef.current = new Set(announcementCandidates(view, cues).map((a) => a.key));
      return;
    }
    const next = announcementsFor(view, cues, [...seen]);
    if (next.length === 0) return;
    for (const item of next) seen.add(item.key);
    setQueue((q) => enqueueAnnouncements(q, next));
  }, [view, cues]);

  // 2) Boştaysa kuyruğun başını ekrana al.
  useEffect(() => {
    if (current || queue.length === 0) return;
    const next = queue[0] ?? null;
    setCurrent(next);
    setArmed(!next?.delayMs);
    setLeaving(false);
    setQueue((q) => q.slice(1));
  }, [current, queue]);

  // 2b) D12 §4 — gecikmeli duyuru: sayaç ancak gecikme dolunca başlar.
  useEffect(() => {
    if (!current || armed) return;
    const timer = setTimeout(() => setArmed(true), current.delayMs);
    return () => clearTimeout(timer);
  }, [current, armed]);

  // 3) Süresi dolunca çıkış animasyonu, sonra sıradaki.
  useEffect(() => {
    if (!current || !armed) return;
    const exit = reducedMotion ? 0 : EXIT_MS;
    const hold = setTimeout(() => setLeaving(true), current.durationMs);
    const done = setTimeout(() => {
      setCurrent(null);
      setLeaving(false);
    }, current.durationMs + exit);
    return () => {
      clearTimeout(hold);
      clearTimeout(done);
    };
  }, [current, armed, reducedMotion]);

  if (!current || !armed) return null;

  return (
    <div className="announcer">
      <div
        key={current.key}
        className={`announcer__card announcer__card--${current.tone}${
          leaving ? ' announcer__card--leaving' : ''
        }${reducedMotion ? ' announcer__card--instant' : ''}`}
        role="status"
        aria-live="polite"
      >
        <strong className="announcer__title">{current.title}</strong>
        <span className="announcer__subtitle">{current.subtitle}</span>
        {current.note ? <span className="announcer__note">{current.note}</span> : null}
      </div>
    </div>
  );
}
