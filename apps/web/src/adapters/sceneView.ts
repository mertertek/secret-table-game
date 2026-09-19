/**
 * Yetkili HTTP yanıtını (`PlayerViewResponse` / `CommandResponse`) TableScene
 * props'una dönüştüren yardımcılar (C05).
 *
 * - Cue kuyruğu: aynı `cueId` iki kez oynatılmaz; `resync` veya oyun kimliği
 *   değişimi kuyruğu TAMAMEN sıfırlar (gelen olay eklenmez, CODEX-006); kuyruk
 *   üst sınırlıdır (docs/CONTRACT.md § 7).
 * - Yerel seçim yaşam döngüsü: `phaseId` veya geçerli aksiyon değişince
 *   kesinleşmemiş seçim temizlenir (docs/CONTRACT.md § 5).
 */

import type {
  PlayerViewResponse,
  SceneCue,
  SceneSelection,
  SceneView,
} from '@secret-table/contracts';

export type SceneRenderInput = {
  view: SceneView;
  cues: readonly SceneCue[];
};

/** Geriye dönük: tek yanıtı doğrudan sahneye geçir. */
export function toSceneRenderInput(response: PlayerViewResponse): SceneRenderInput {
  return {
    view: response.view,
    cues: response.resync ? [] : response.cues,
  };
}

export type CueQueueState = {
  /** Sahneye verilecek, oynatılmayı bekleyen cue'lar. */
  queue: readonly SceneCue[];
  /** Görülen cue kimlikleri (tekrar oynatmayı engeller). */
  seen: ReadonlySet<string>;
  /** Kuyruğun ait olduğu oyun; değişince sıfırlanır. */
  gameId: string | null;
};

export const emptyCueQueue: CueQueueState = { queue: [], seen: new Set(), gameId: null };

/** Kuyruk üst sınırı: sahne cue'ları oynattıkça küçülür; yine de büyümesin. */
const MAX_QUEUE = 32;

/**
 * Yeni cue'ları kuyruğa ekler.
 *
 * - `resync` true veya oyun kimliği değişti → kuyruk ve "görülen" kümesi
 *   TAMAMEN sıfırlanır; gelen olaylar EKLENMEZ (CODEX-006). Yeniden bağlanmada /
 *   yeni oyunda eski animasyon oynatılmaz; sahne son görünüme oturur. Bir sonraki
 *   normal komut yanıtı taze cue'ları getirir.
 * - Aksi halde `incoming` içinden aynı oyuna ait, daha önce görülmemiş cue'lar
 *   eklenir; kuyruk `MAX_QUEUE` ile sınırlanır.
 */
export function mergeCues(
  prev: CueQueueState,
  incoming: readonly SceneCue[],
  opts: { resync?: boolean; gameId: string | null },
): CueQueueState {
  const gameChanged = prev.gameId !== opts.gameId;
  if (opts.resync || gameChanged) {
    return { queue: [], seen: new Set(), gameId: opts.gameId };
  }

  const seen = new Set(prev.seen);
  const queue = [...prev.queue];
  for (const cue of incoming) {
    if (cue.gameId !== opts.gameId) continue;
    if (seen.has(cue.cueId)) continue;
    seen.add(cue.cueId);
    queue.push(cue);
  }
  return {
    queue: queue.length > MAX_QUEUE ? queue.slice(-MAX_QUEUE) : queue,
    seen,
    gameId: opts.gameId,
  };
}

/**
 * Sahneye artık iletilmiş cue'ları kuyruktan düşürür. Sahne kendi içinde de
 * `cueId` tekrarını engeller; bu yalnız kuyruğun büyümesini durdurur.
 */
export function drainCues(prev: CueQueueState): CueQueueState {
  if (prev.queue.length === 0) return prev;
  return { ...prev, queue: [] };
}

/**
 * Yeni görünüme göre yerel seçimi doğrular. Seçili aksiyon artık yoksa veya
 * `phaseId` kaymışsa `null` döner.
 */
export function reconcileSelection(
  selection: SceneSelection | null,
  view: SceneView,
): SceneSelection | null {
  if (!selection) return null;
  const action = view.actions.find((a) => a.actionId === selection.actionId);
  if (!action) return null;
  if (action.phaseId !== view.phaseId) return null;
  const optionOk = action.options.some((o) => o.optionId === selection.optionId);
  return optionOk ? selection : null;
}
