/**
 * D14 (D19'da genişletildi) — menüdeki "Geliştirici" sekmesi.
 *
 * YALNIZ `DEV_TOOLS` iken yüklenir: `GameMenu` bu modülü `import()` ile tembel
 * çeker, üretim paketinde ne sekme ne bu chunk bulunur (botRunner ile aynı
 * kalıp, ROADMAP A6).
 *
 * Komut normal `apiClient` üzerinden `dev_scenario` lobi komutu olarak gider.
 * Sunucu bunu yalnız `SECRET_TABLE_DEV_TOOLS=1` iken uygular; kapalıysa
 * `NOT_ALLOWED` döner ve hata menüde gösterilir.
 */

import { useCallback, useState } from 'react';
import {
  BOARD_LAYOUTS,
  PROTOCOL_VERSION,
  type DevScenarioName,
  type ExecutivePower,
  type PlayerCount,
} from '@secret-table/contracts';

import * as api from '../multiplayer/apiClient';
import { currentAccessToken, ensureGuestSession } from '../multiplayer/guestSession';

/**
 * Bir yetkinin bulunduğu oyuncu sayıları — `BOARD_LAYOUTS`tan TÜRETİLİR, elle
 * yazılmaz. Senaryonun bu masada çalışıp çalışmayacağını düğmeyi göndermeden
 * bilmek için kullanılır (sunucu ayrıca `SCENARIO_NEEDS_PLAYERS` döner).
 */
function countsWithPower(power: ExecutivePower): PlayerCount[] {
  const out: PlayerCount[] = [];
  for (const layout of Object.values(BOARD_LAYOUTS)) {
    if (layout.fascistPowers.includes(power)) out.push(...layout.playerCounts);
  }
  return out.sort((a, b) => a - b);
}

/** Yetki gerektirmeyen senaryolar her masada çalışır (`null`). */
type Scenario = {
  id: DevScenarioName;
  label: string;
  hint: string;
  /** Senaryonun dayandığı yetki; `null` ise oyuncu sayısı kısıtı yok. */
  power: ExecutivePower | null;
};

const SCENARIOS: readonly Scenario[] = [
  {
    id: 'execution_now',
    label: 'İnfaza atla (şimdi)',
    hint: 'Faşist tahta infaz yuvasına gelir, başkanlık sende ve infaz yetkisi hemen açıktır.',
    power: 'execution',
  },
  {
    id: 'execution_round',
    label: 'İnfaz turu (kanunlar hazır)',
    hint: 'Bir tur öncesi: başkan sensin, destenin üstü faşist; hükümet kurulunca infaz yetkisi gelir.',
    power: 'execution',
  },
  {
    id: 'investigate_now',
    label: 'Sadakat incelemesi (şimdi)',
    hint: 'İnceleme yetkisi sende: hedef seç, parti zarfı eline gelir (H).',
    power: 'investigate_loyalty',
  },
  {
    id: 'special_election_now',
    label: 'Özel seçim (şimdi)',
    hint: 'Özel seçim yetkisi sende: sonraki başkanı seç, sonra sıra kaldığı yerden devam eder.',
    power: 'call_special_election',
  },
  {
    id: 'policy_peek_now',
    label: 'Deste tepesi (şimdi)',
    hint: 'Destenin üstündeki 3 kart eline kapalı gelir; yalnız sen görürsün.',
    power: 'policy_peek',
  },
  {
    id: 'veto_round',
    label: 'Veto turu (şansölye sen)',
    hint: '5 faşist kanun; sen şansölyesin, elinde 2 faşist kart — "Veto öner" düğmesi açık, başkan bot yanıtlar.',
    power: null,
  },
  {
    id: 'veto_round_president',
    label: 'Veto turu (başkan sen)',
    hint: '5 faşist kanun; şansölye veto önerdi, kabul/ret kararı sende.',
    power: null,
  },
  {
    id: 'hitler_zone_round',
    label: 'Hitler bölgesi (3 faşist kanun)',
    hint: 'Başkan sensin ve tur kısıtı yok: Hitler’i şansölye yaparsan faşistler kazanır.',
    power: null,
  },
  {
    id: 'chaos_round',
    label: 'Kaos turu (sayaç 2)',
    hint: 'Seçim sayacı 2: bir sonraki ret deste tepesini yürürlüğe koyar ve sınırları sıfırlar.',
    power: null,
  },
];

/** Senaryo bu masada çalışır mı? (`null` = kısıt yok.) */
export function scenarioBlockedReason(
  scenario: Scenario,
  playerCount: number | undefined,
): string | null {
  if (!scenario.power || playerCount === undefined) return null;
  const counts = countsWithPower(scenario.power);
  if (counts.includes(playerCount as PlayerCount)) return null;
  const first = counts[0];
  const last = counts[counts.length - 1];
  return counts.length === 0
    ? 'bu düzende yok'
    : `${first === last ? first : `${first}-${last}`} kişi gerekir`;
}

let seq = 0;
function nextCommandId(): string {
  seq += 1;
  return `dev_${Date.now().toString(36)}_${seq.toString(36)}`;
}

/**
 * Sunucu hata kodunu geliştiriciye anlaşılır Türkçeye çevirir.
 *
 * D21/I — `INVALID_OPTION` ARTIK "oyuncu sayısı" diye yorumlanmaz: aynı kod
 * `SCENARIO_NEEDS_PLAYERS` dışında başka nedenlerle de gelir (ör. geçersiz /
 * eksik `optionId`, motorun reddettiği hedef). Ham kod her zaman yazılır ki
 * yanlış teşhis üretmesin.
 */
export function errorLine(code: string): string {
  if (code === 'INVALID_OPTION') {
    return `Sunucu reddetti: ${code} — muhtemel neden: senaryo bu oyuncu sayısında yok (SCENARIO_NEEDS_PLAYERS); geçersiz seçenek de aynı kodu verir.`;
  }
  if (code === 'NOT_ALLOWED') {
    return `Sunucu reddetti: ${code} — SECRET_TABLE_DEV_TOOLS=1 mi, ve host musun? (D21: senaryoları yalnız oda hostu uygulayabilir.)`;
  }
  return `Sunucu reddetti: ${code}`;
}

export function DevScenarioSection({
  roomId,
  playerCount,
  isHost,
  onApplied,
}: {
  roomId: string;
  /** Masadaki oyuncu sayısı; uygun olmayan senaryolar devre dışı kalır. */
  playerCount?: number;
  /**
   * D21/K — yerel oyuncu oda hostu mu. Sunucu senaryoları yalnız hosttan kabul
   * eder (`policy_peek_now` gibi senaryolar gizli bilgiyi gönderene verir);
   * host değilse düğmeler devre dışı ve neden yazılı. Verilmezse (eski çağrı /
   * dev sayfası) kısıt uygulanmaz.
   */
  isHost?: boolean;
  /** Senaryo uygulandıktan sonra görünümü tazelemek için (`room.refresh`). */
  onApplied: () => void;
}) {
  const [busy, setBusy] = useState<DevScenarioName | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  // `undefined` = bilgi yok (dev sayfası): kısıt uygulanmaz.
  const notHost = isHost === false;

  const run = useCallback(
    async (scenario: DevScenarioName) => {
      setBusy(scenario);
      setError(null);
      setDone(null);
      try {
        const session = await ensureGuestSession();
        const token = await currentAccessToken(session);
        const res = await api.sendLobbyCommand(token, roomId, {
          protocolVersion: PROTOCOL_VERSION,
          commandId: nextCommandId(),
          type: 'dev_scenario',
          scenario,
        });
        if (!res.ok) {
          setError(`Senaryo gönderilemedi: ${res.error}`);
          return;
        }
        if (res.data.ok === false) {
          setError(errorLine(res.data.error ?? 'NOT_ALLOWED'));
          return;
        }
        setDone('Senaryo uygulandı.');
        onApplied();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        setBusy(null);
      }
    },
    [roomId, onApplied],
  );

  return (
    <section className="panel" aria-labelledby="game-menu-dev">
      <h2 id="game-menu-dev" className="panel__title">
        Geliştirici
      </h2>
      <p className="muted">
        Yalnız yerel geliştirme. Sunucu bu komutları yalnız <code>SECRET_TABLE_DEV_TOOLS=1</code>{' '}
        iken ve <strong>yalnız oda sahibinden</strong> kabul eder. Roller, gizli eller ve deste
        içeriği değişmez.
        {playerCount ? ` Masa: ${playerCount} oyuncu.` : ''}
      </p>
      {notHost ? (
        <p className="muted" role="status">
          Oda sahibi değilsin: senaryoları yalnız odayı kuran oyuncu uygulayabilir.
        </p>
      ) : null}
      <div className="dev-scenarios">
        {SCENARIOS.map((scenario) => {
          const blocked = notHost ? 'oda sahibi gerekir' : scenarioBlockedReason(scenario, playerCount);
          return (
            <button
              key={scenario.id}
              type="button"
              className="btn-ghost dev-scenarios__btn"
              disabled={busy !== null || blocked !== null}
              title={blocked ? `${scenario.hint} (${blocked})` : scenario.hint}
              onClick={() => void run(scenario.id)}
            >
              {busy === scenario.id ? 'Gönderiliyor…' : scenario.label}
              {blocked ? <span className="dev-scenarios__note"> · {blocked}</span> : null}
            </button>
          );
        })}
      </div>
      {error ? (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      ) : null}
      {done && !error ? (
        <p className="muted" role="status">
          {done}
        </p>
      ) : null}
    </section>
  );
}

export default DevScenarioSection;
