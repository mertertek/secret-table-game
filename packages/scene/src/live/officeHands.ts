/**
 * D17 — yasama sırasında KAMU elinde kart sırtları (saf katman).
 *
 * Kullanıcı 2026-09-12: "kart seçen başkanın önünde 3 kart görünse, diğer 2'sini
 * seçen şansölyenin elinde 2 kart görünse akış daha güzel olur".
 *
 * Yalnız KAMU bilgisi kullanılır: `view.phase` + `PlayerView.office`. Kart yüzü,
 * sırası, hangi kartın atıldığı BURAYA GİRMEZ; sonuç yalnız "kaç kapalı sırt,
 * hangi koltukta, hangi tutuşla" bilgisidir. React/three yoktur; testler bu
 * fonksiyonlara bakar.
 */
import type { SceneCue, ScenePhase, SceneView } from '@secret-table/contracts';

export type OfficeHandGrip = 'holdFan3' | 'holdFan2';
export type OfficeName = 'president' | 'chancellor';

export type OfficeHandState = {
  /** Sırtları tutan koltuğun oyuncusu (kamu). */
  playerId: string;
  office: OfficeName;
  /** Elde duran kapalı kart adedi. */
  count: 2 | 3;
  grip: OfficeHandGrip;
};

/**
 * Faz → (ofis, adet). Sözleşme faz adları: `president_discard` yasama-başkan,
 * `chancellor_choice` yasama-şansölye, `veto_response` veto kararı (kartlar
 * hâlâ ŞANSÖLYEDE). Diğer fazlarda kimsenin elinde kamu kartı yoktur.
 */
const PHASE_HAND: Partial<Record<ScenePhase, { office: OfficeName; count: 2 | 3 }>> = {
  president_discard: { office: 'president', count: 3 },
  chancellor_choice: { office: 'chancellor', count: 2 },
  veto_response: { office: 'chancellor', count: 2 },
};

/** Adet → tutuş (0/1 ya da beklenmeyen adet = el yok). */
export function gripForCount(count: number): OfficeHandGrip | null {
  return count === 3 ? 'holdFan3' : count === 2 ? 'holdFan2' : null;
}

/**
 * O anki yetkili görünümde kimin elinde kaç kapalı sırt var. Cue gerekmez:
 * yeniden bağlanmada da faz + ofisten türetilir (anında doğru durum).
 */
export function officeHandState(view: Pick<SceneView, 'phase' | 'players'>): OfficeHandState | null {
  const slot = PHASE_HAND[view.phase];
  if (!slot) return null;
  const holder = view.players.find((p) => p.office === slot.office && p.alive !== false);
  const grip = gripForCount(slot.count);
  if (!holder || !grip) return null;
  return { playerId: holder.playerId, office: slot.office, count: slot.count, grip };
}

export type OfficeHandFlow = {
  /** `in`: bu koltuğa geliyor, `out`: bu koltuktan çıkıyor. */
  direction: 'in' | 'out';
  count: number;
  /** Karşı uç (deste / atık / öteki ofis). */
  endpoint: 'deck' | 'discard' | OfficeName;
};

/** Bir `cards_moved` cue'sunun BU koltuk için anlamı (yoksa `null`). */
export function officeHandFlow(
  view: Pick<SceneView, 'players'>,
  cue: SceneCue,
  playerId: string,
): OfficeHandFlow | null {
  if (cue.kind !== 'cards_moved' || !Number.isInteger(cue.count) || cue.count <= 0) return null;
  const seatOf = (office: OfficeName) => view.players.find((p) => p.office === office)?.playerId;
  const fromId = cue.from === 'deck' ? undefined : seatOf(cue.from);
  const toId = cue.to === 'discard' ? undefined : seatOf(cue.to);
  if (toId === playerId) return { direction: 'in', count: cue.count, endpoint: cue.from };
  if (fromId === playerId) return { direction: 'out', count: cue.count, endpoint: cue.to };
  return null;
}

/**
 * D21/E — aynı sürümde birden çok `cards_moved` olabilir; BU koltuğu
 * ilgilendiren İLKİNİ seçer (yoksa `null`).
 *
 * Başkanın atma turu iki cue üretir: başkan→atık (1) ve başkan→şansölye (2).
 * Eski sahne kodu listedeki ilk `cards_moved`'ı alıp her koltuğa onu soruyordu;
 * şansölye koltuğu için sonuç her zaman `null` çıkıyor ve iki sırtın uçarak
 * gelişi hiç oynamıyordu.
 */
export function pickOfficeHandCue(
  view: Pick<SceneView, 'players'>,
  cues: readonly SceneCue[],
  playerId: string,
): { index: number; cue: SceneCue; flow: OfficeHandFlow } | null {
  for (let index = 0; index < cues.length; index += 1) {
    const cue = cues[index]!;
    const flow = officeHandFlow(view, cue, playerId);
    if (flow) return { index, cue, flow };
  }
  return null;
}

/**
 * Cue'nun bu koltuktaki tutuş geçişi: hareket ÖNCESİ ve SONRASI tutuş. Sonrası
 * yetkili görünümden (`officeHandState`), öncesi adet farkından türer.
 */
export function officeHandTransition(
  view: Pick<SceneView, 'phase' | 'players'>,
  cue: SceneCue,
  playerId: string,
): { from: OfficeHandGrip | null; to: OfficeHandGrip | null } | null {
  const flow = officeHandFlow(view, cue, playerId);
  if (!flow) return null;
  const state = officeHandState(view);
  const to = state?.playerId === playerId ? state.count : 0;
  const from = flow.direction === 'in' ? to - flow.count : to + flow.count;
  return { from: gripForCount(from), to: gripForCount(to) };
}
