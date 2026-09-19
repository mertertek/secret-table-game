/**
 * ROADMAP B6 — giriş / katıl / lobi kabuğunun dekoratif arka planı.
 *
 * Tamamen inline SVG + CSS: `@secret-table/scene` (three) BURAYA GİRMEZ,
 * giriş chunk'ı hafif kalır. İçerik taşımaz, yalnız oyunun paletindeki
 * (keçe, ceviz, krem, pirinç) masa/kart motifini çizer; bu yüzden
 * `aria-hidden` ve `focusable="false"`.
 *
 * Sayfa başına bir kez çizilir (gradyan `id`'leri benzersiz kalsın).
 */
export function TableBackdrop() {
  return (
    <svg
      className="backdrop"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id="st-bd-glow" cx="50%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#3d7d67" stopOpacity="0.85" />
          <stop offset="45%" stopColor="#2a5749" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#0d1f1b" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="st-bd-wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6d4a34" />
          <stop offset="55%" stopColor="#4a3123" />
          <stop offset="100%" stopColor="#2c1c14" />
        </linearGradient>
        <linearGradient id="st-bd-card" x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#f3e9d3" />
          <stop offset="100%" stopColor="#cbbb95" />
        </linearGradient>
      </defs>

      {/* Tavandan düşen ışık huzmesi */}
      <rect width="1440" height="900" fill="url(#st-bd-glow)" />

      {/* Masanın arkasındaki koltuk sırtları (masa üstlerini örter) */}
      <g className="backdrop__chairs" opacity="0.85">
        {[-142, -116, -90, -64, -38].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          const cx = 720 + Math.cos(rad) * 880;
          const cy = 1010 + Math.sin(rad) * 410;
          return (
            <g key={deg} transform={`translate(${cx} ${cy})`}>
              <rect x="-66" y="-96" width="132" height="150" rx="26" fill="#3d2a1e" />
              <rect x="-52" y="-82" width="104" height="120" rx="20" fill="#4a3123" />
            </g>
          );
        })}
      </g>

      {/* Alttan yükselen yuvarlak masa: ceviz kenar + keçe yüzey + dikiş çizgisi */}
      <g className="backdrop__table">
        <ellipse cx="720" cy="1010" rx="880" ry="410" fill="url(#st-bd-wood)" />
        <ellipse cx="720" cy="1010" rx="812" ry="352" fill="#22483d" />
        <ellipse
          cx="720"
          cy="1010"
          rx="770"
          ry="316"
          fill="none"
          stroke="#b49359"
          strokeOpacity="0.32"
          strokeWidth="2"
          strokeDasharray="14 12"
        />
      </g>

      {/* Masaya yelpaze gibi bırakılmış kartlar (keçenin üstünde durur) */}
      <g className="backdrop__fan" opacity="0.34">
        <g transform="translate(214 806) rotate(-17)">
          <rect width="152" height="212" rx="14" fill="url(#st-bd-card)" />
          <rect
            x="12"
            y="12"
            width="128"
            height="188"
            rx="9"
            fill="none"
            stroke="#583b2b"
            strokeOpacity="0.35"
          />
          <circle cx="76" cy="106" r="30" fill="none" stroke="#583b2b" strokeOpacity="0.3" strokeWidth="3" />
        </g>
        <g transform="translate(356 782) rotate(-4)">
          <rect width="152" height="212" rx="14" fill="url(#st-bd-card)" />
          <rect
            x="12"
            y="12"
            width="128"
            height="188"
            rx="9"
            fill="none"
            stroke="#583b2b"
            strokeOpacity="0.35"
          />
          <path d="M46 138 L76 74 L106 138 Z" fill="none" stroke="#583b2b" strokeOpacity="0.3" strokeWidth="3" />
        </g>
        <g transform="translate(1046 790) rotate(11)">
          <rect width="152" height="212" rx="14" fill="url(#st-bd-card)" />
          <rect
            x="12"
            y="12"
            width="128"
            height="188"
            rx="9"
            fill="none"
            stroke="#583b2b"
            strokeOpacity="0.35"
          />
          <rect
            x="46"
            y="76"
            width="60"
            height="60"
            rx="8"
            fill="none"
            stroke="#583b2b"
            strokeOpacity="0.3"
            strokeWidth="3"
          />
        </g>
      </g>

    </svg>
  );
}
