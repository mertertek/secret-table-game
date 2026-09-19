/**
 * Saf seçiciler — durumdan türeyen kural bilgileri. Hem motor (komut
 * doğrulama) hem sunucu projeksiyonu (yapılabilir eylem seçenekleri) buradan
 * okur; kural mantığı tek yerde kalır.
 */

import type { Party } from '@secret-table/contracts';
import { REDUCED_TERM_LIMIT_ALIVE_THRESHOLD } from '@secret-table/contracts';

import type { GameState } from './types';

export function alivePlayerIds(state: GameState): string[] {
  return state.players.filter((p) => p.alive).map((p) => p.playerId);
}

/**
 * Oyunun ilerlemesi için şu an eylemi beklenen oyuncular. Bu oyunculardan biri
 * çevrimdışıysa sunucu oyunu duraklatır (docs/PLAN.md bölüm 5).
 */
export function requiredPlayerIds(state: GameState): string[] {
  const { phase } = state;
  switch (phase.kind) {
    case 'role_reveal':
      return state.players
        .filter((p) => !phase.ackedPlayerIds.includes(p.playerId))
        .map((p) => p.playerId);
    case 'nomination':
      return [phase.presidentId];
    case 'voting':
      return state.players
        .filter((p) => p.alive && phase.votes[p.playerId] === undefined)
        .map((p) => p.playerId);
    case 'legislative_president':
      return [phase.government.presidentId];
    case 'legislative_chancellor':
      return [phase.government.chancellorId];
    case 'veto_response':
      return [phase.government.presidentId];
    case 'executive_action':
      return [phase.government.presidentId];
    case 'game_over':
      return [];
    default: {
      const _exhaustive: never = phase;
      void _exhaustive;
      return [];
    }
  }
}

/** Bir başkan adayının tur kısıtı ve hayatta olma kuralına göre seçebileceği şansölyeler. */
export function eligibleChancellorIds(state: GameState, presidentId: string): string[] {
  const aliveTotal = state.players.filter((p) => p.alive).length;
  const banned = new Set<string>([presidentId]);
  if (state.lastGovernment) {
    banned.add(state.lastGovernment.chancellorId);
    if (aliveTotal > REDUCED_TERM_LIMIT_ALIVE_THRESHOLD) {
      banned.add(state.lastGovernment.presidentId);
    }
  }
  return state.players.filter((p) => p.alive && !banned.has(p.playerId)).map((p) => p.playerId);
}

/**
 * Sadakat incelemesinde seçilebilecek hedefler.
 *
 * D18/B1 — resmî kural: "No player may be investigated twice in the same game."
 * Teklik **başkandan bağımsızdır**: bir kez incelenen oyuncu, incelemeyi BAŞKA
 * bir başkan yapacak olsa da o oyunda ikinci kez incelenemez (eskiden kısıt
 * (başkan, hedef) çifti üzerineydi ve 9–10 kişilik masada bilgi fazlalığı
 * üretiyordu).
 */
export function investigatableTargetIds(state: GameState, presidentId: string): string[] {
  return state.players
    .filter(
      (p) =>
        p.alive &&
        p.playerId !== presidentId &&
        !state.investigations.some((i) => i.targetId === p.playerId),
    )
    .map((p) => p.playerId);
}

/** İnfaz / özel seçim hedefleri (hayatta, başkan değil). */
export function otherAliveTargetIds(state: GameState, presidentId: string): string[] {
  return state.players
    .filter((p) => p.alive && p.playerId !== presidentId)
    .map((p) => p.playerId);
}

export type KnownPlayerInfo = {
  playerId: string;
  knowledge: { kind: 'party'; party: Party } | { kind: 'role'; role: 'liberal' | 'fascist' | 'hitler' };
  source: 'fascists_know_each_other' | 'hitler_knows_fascists' | 'investigate_loyalty';
};

/**
 * Bir oyuncunun izinli bildiği diğer oyuncular: faşist takım tanışması, Hitler'in
 * faşistleri bilmesi (yalnız 5-6 kişi) ve kendi yaptığı sadakat incelemeleri.
 * Tam rol haritası DEĞİLDİR.
 */
export function knownPlayersFor(state: GameState, playerId: string): KnownPlayerInfo[] {
  const me = state.players.find((p) => p.playerId === playerId);
  if (!me) return [];
  const out: KnownPlayerInfo[] = [];

  if (me.role === 'fascist') {
    for (const other of state.players) {
      if (other.playerId === playerId) continue;
      if (other.role === 'fascist') {
        out.push({
          playerId: other.playerId,
          knowledge: { kind: 'role', role: 'fascist' },
          source: 'fascists_know_each_other',
        });
      } else if (other.role === 'hitler') {
        out.push({
          playerId: other.playerId,
          knowledge: { kind: 'role', role: 'hitler' },
          source: 'fascists_know_each_other',
        });
      }
    }
  }

  if (me.role === 'hitler' && state.roleSetup.hitlerKnowsFascists) {
    for (const other of state.players) {
      if (other.playerId !== playerId && other.role === 'fascist') {
        out.push({
          playerId: other.playerId,
          knowledge: { kind: 'role', role: 'fascist' },
          source: 'hitler_knows_fascists',
        });
      }
    }
  }

  for (const inv of state.investigations) {
    if (inv.actorId === playerId) {
      out.push({
        playerId: inv.targetId,
        knowledge: { kind: 'party', party: inv.party },
        source: 'investigate_loyalty',
      });
    }
  }

  return out;
}
