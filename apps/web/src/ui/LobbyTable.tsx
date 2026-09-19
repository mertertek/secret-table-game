import type { LobbyMember } from '@secret-table/contracts';

import { useT, currentLanguage } from '../i18n';
import { avatarText, skinText, avatarLabel } from './avatarText';

/**
 * ROADMAP B6 — lobinin yuvarlak masa çizimi.
 *
 * Masa yüzeyi inline SVG (dekoratif, `aria-hidden`), koltuklar üstüne
 * konumlanmış gerçek HTML liste öğeleridir: ad metni, ekran okuyucu durumu ve
 * kırpma HTML tarafında kalır. `@secret-table/scene` (three) burada YÜKLENMEZ;
 * bu yalnız 2B bir yer tutucudur, gerçek 3D masa oyun ekranında.
 *
 * Yerel oyuncu masanın ALT ortasına döndürülür (sahnedeki kamera kuralıyla
 * aynı his); sunucu koltuk sırası değişmez, yalnız çizim döndürülür.
 */

/** Görünecek koltuk sayısı: en az `minPlayers`, en çok `maxPlayers`. */
export function seatCount(memberCount: number, minPlayers: number, maxPlayers: number): number {
  return Math.min(Math.max(memberCount, minPlayers), maxPlayers);
}

function initial(name: string): string {
  const trimmed = name.trim();
  const locale = currentLanguage() === 'tr' ? 'tr-TR' : 'en-US';
  return trimmed ? trimmed.slice(0, 1).toLocaleUpperCase(locale) : '?';
}

function CrownIcon() {
  return (
    <svg className="seat__crown" viewBox="0 0 24 16" aria-hidden="true" focusable="false">
      <path
        d="M2 14 L2 4 L7 8 L12 1 L17 8 L22 4 L22 14 Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="seat__check" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="M3 8.5 L6.5 12 L13 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LobbyTable({
  members,
  minPlayers,
  maxPlayers,
}: {
  members: readonly LobbyMember[];
  minPlayers: number;
  maxPlayers: number;
}) {
  const t = useT();
  const ordered = [...members].sort((a, b) => a.seatIndex - b.seatIndex);
  const total = seatCount(ordered.length, minPlayers, maxPlayers);
  const localIndex = ordered.findIndex((m) => m.isLocal);
  const step = 360 / total;
  // 90° = masanın altı (SVG/CSS'te y aşağı büyür). Yerel oyuncu oraya gelsin.
  const base = 90 - (localIndex >= 0 ? localIndex : 0) * step;
  const readyCount = ordered.filter((m) => m.ready).length;

  return (
    <div className="table">
      <svg
        className="table__surface"
        viewBox="0 0 200 200"
        aria-hidden="true"
        focusable="false"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <radialGradient id="st-tbl-felt" cx="50%" cy="42%" r="62%">
            <stop offset="0%" stopColor="#2d6151" />
            <stop offset="70%" stopColor="#22483d" />
            <stop offset="100%" stopColor="#16332b" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r="74" fill="#4a3123" />
        <circle cx="100" cy="100" r="70" fill="#6d4a34" />
        <circle cx="100" cy="100" r="64" fill="url(#st-tbl-felt)" />
        <circle
          cx="100"
          cy="100"
          r="57"
          fill="none"
          stroke="#b49359"
          strokeOpacity="0.35"
          strokeWidth="0.8"
          strokeDasharray="4 4"
        />
        <rect
          x="88"
          y="86"
          width="24"
          height="30"
          rx="3"
          fill="#eee1c7"
          fillOpacity="0.14"
          stroke="#b49359"
          strokeOpacity="0.3"
          strokeWidth="0.8"
        />
      </svg>

      <div className="table__center" aria-hidden="true">
        <span className="table__count">
          {ordered.length}
          <span className="table__count-max">/{maxPlayers}</span>
        </span>
        <span className="table__center-label">{t('lobby.playersLabel')}</span>
        <span className="table__center-sub">{t('lobby.readyCount', { count: readyCount })}</span>
      </div>

      <ul className="table__seats" aria-label={t('lobby.seats')}>
        {Array.from({ length: total }, (_, i) => {
          const member = ordered[i];
          const rad = ((base + i * step) * Math.PI) / 180;
          const style = {
            left: `${50 + Math.cos(rad) * 39}%`,
            top: `${50 + Math.sin(rad) * 39}%`,
          };

          if (!member) {
            return (
              <li key={`empty-${i}`} className="seat seat--empty" style={style}>
                <span className="seat__avatar" aria-hidden="true" />
                <span className="seat__name">{t('lobby.empty')}</span>
                <span className="sr-only">{t('lobby.emptySeat', { index: i + 1 })}</span>
              </li>
            );
          }

          const classes = [
            'seat',
            member.ready ? 'is-ready' : '',
            member.isLocal ? 'is-local' : '',
            member.connected ? '' : 'is-offline',
          ]
            .filter(Boolean)
            .join(' ');

          const avatar = avatarText(member.avatar.character);
          return (
            <li key={member.playerId} className={classes} style={style}>
              <span
                className="seat__avatar"
                /* D3.4: seçilen karakterin vurgu rengi + ten tonu halkası.
                   Rol ima etmez; lobide herkese açık bir tercihtir. */
                style={{ background: avatar.accent, borderColor: skinText(member.avatar.skin).swatch }}
              >
                <span aria-hidden="true">{initial(member.displayName)}</span>
                {member.isHost ? <CrownIcon /> : null}
                {member.ready ? <CheckIcon /> : null}
              </span>
              <span className="seat__name" title={member.displayName}>
                {member.displayName}
              </span>
              <span className="seat__avatar-name" title={avatarLabel(member.avatar.character, member.avatar.skin)}>
                {avatar.name}
              </span>
              <span className="sr-only">
                {`, ${avatarLabel(member.avatar.character, member.avatar.skin)}`}
                {member.isHost ? t('lobby.srHost') : ''}
                {member.isLocal ? t('lobby.srYou') : ''}
                {member.ready ? t('lobby.srReady') : t('lobby.srWaiting')}
                {member.connected ? '' : t('lobby.srOffline')}
              </span>
              {member.isLocal ? <span className="seat__you">{t('lobby.you')}</span> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
