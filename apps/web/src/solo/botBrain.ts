/**
 * D26 — bot KARAR mantığı (saf, ağsız, çerçeveden bağımsız).
 *
 * Bu modül D14/A6 `dev/botRunner.ts` içinden ÇIKARILDI; davranış birebir aynıdır.
 * İki koşucu paylaşır:
 *  - `dev/botRunner.ts` — yalnız DEV: gerçek anonim Supabase kimlikleriyle HTTP.
 *  - `solo/soloBots.ts`  — üretimde de açık: tarayıcıdaki yerel servise doğrudan.
 *
 * Kural yok: burada yalnız "hangi geçerli hamle seçilsin" sorusu yanıtlanır.
 * Bot KENDİ yetkili görünümündeki `view.actions` dışına asla çıkmaz; sıra
 * onda değilse yetkili görünüm zaten boş liste verir ve `chooseMove` `null` döner.
 */

import {
  AVATAR_CHARACTER_IDS,
  AVATAR_SKIN_IDS,
  type AllowedAction,
  type AvatarSelection,
  type SceneView,
} from '@secret-table/contracts';

/** Evet oyu olasılığı (party.mjs ile aynı). */
export const YES_RATE = 0.75;
/** Bot şansölye veto açıkken bu olasılıkla veto ÖNERİR. */
export const VETO_REQUEST_RATE = 0.3;
/** Bot başkan veto isteğini bu olasılıkla KABUL eder. */
export const VETO_ACCEPT_RATE = 0.5;

/** Listeden rastgele bir eleman; boş listede `undefined`. */
export function pick<T>(list: readonly T[], random: () => number): T | undefined {
  if (list.length === 0) return undefined;
  const index = Math.min(list.length - 1, Math.max(0, Math.floor(random() * list.length)));
  return list[index];
}

/** Odada görünmeyen karakterlerden birini seçer; hepsi doluysa rastgele. */
export function pickBotAvatar(
  used: readonly string[],
  random: () => number,
): AvatarSelection {
  const free = AVATAR_CHARACTER_IDS.filter((id) => !used.includes(id));
  const pool = free.length > 0 ? free : AVATAR_CHARACTER_IDS;
  return {
    character: pick(pool, random) ?? AVATAR_CHARACTER_IDS[0]!,
    skin: pick(AVATAR_SKIN_IDS, random) ?? AVATAR_SKIN_IDS[0]!,
  };
}

/** Sıradaki aktörü herkese açık görünümden çıkarır (party.mjs ile aynı eşleme). */
export function actorPlayerId(view: SceneView): string | null {
  switch (view.phase) {
    case 'nomination':
      return view.players.find((p) => p.isPresidentialCandidate)?.playerId ?? null;
    case 'president_discard':
      return view.players.find((p) => p.office === 'president')?.playerId ?? null;
    case 'chancellor_choice':
      return view.players.find((p) => p.office === 'chancellor')?.playerId ?? null;
    case 'veto_response':
      return view.players.find((p) => p.office === 'president')?.playerId ?? null;
    case 'executive_action':
      return (
        view.table.currentPower?.actorId ??
        view.players.find((p) => p.office === 'president')?.playerId ??
        null
      );
    default:
      return null;
  }
}

/**
 * Bir botun kendi görünümü için aksiyon + seçenek seçer.
 *
 * - `chancellor_choice`: veto açıksa (`request_veto` görünümde) %30
 *   olasılıkla VETO ÖNERİR (D19; insan başkanın kabul/ret ekranını denemek
 *   için), aksi hâlde `enact_policy` ile kanun koyar — oyun boşuna uzamasın.
 *   Kart seçimi rastgeledir.
 * - `veto_response`: bot BAŞKAN veto isteğini %50 kabul, %50 ret eder.
 * - Diğer fazlar: rastgele aksiyon, o aksiyonun rastgele seçeneği. Yetkili
 *   görünümde yalnız SIRASI GELEN oyuncunun eylemleri bulunduğu için, yetki
 *   (inceleme / özel seçim / infaz) insandayken bot hiçbir hedef seçmez:
 *   `view.actions` boş döner ve `chooseMove` `null` verir.
 * - Seçenek yoksa (`options: []`) `optionId` gönderilmez.
 */
export function chooseMove(
  view: SceneView,
  random: () => number,
): { action: AllowedAction; optionId: string | undefined } | null {
  const actions = view.actions;
  if (actions.length === 0) return null;

  if (view.phase === 'chancellor_choice') {
    const veto = actions.find((a) => a.kind === 'request_veto');
    if (veto && random() < VETO_REQUEST_RATE) {
      return { action: veto, optionId: pick(veto.options, random)?.optionId };
    }
    const enact = actions.find((a) => a.kind === 'enact_policy');
    if (enact) return { action: enact, optionId: pick(enact.options, random)?.optionId };
  }

  if (view.phase === 'veto_response') {
    const respond = actions.find((a) => a.kind === 'respond_veto');
    if (respond) {
      const wanted = random() < VETO_ACCEPT_RATE ? 'veto_accept' : 'veto_reject';
      const option =
        respond.options.find((o) => o.optionId === wanted) ?? pick(respond.options, random);
      return { action: respond, optionId: option?.optionId };
    }
  }

  const action = pick(actions, random);
  if (!action) return null;
  const option = pick(action.options, random);
  return { action, optionId: option?.optionId };
}

/** Oy seçeneği: %75 evet. Yalnız görünümdeki gerçek seçenekler kullanılır. */
export function chooseVote(action: AllowedAction, random: () => number): string | undefined {
  const wantYes = random() < YES_RATE;
  const target = action.options.find((o) => o.vote === (wantYes ? 'yes' : 'no'));
  return (target ?? pick(action.options, random))?.optionId;
}
