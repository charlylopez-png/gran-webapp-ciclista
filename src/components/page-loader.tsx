// Pantalla de carga entre páginas (la usan los loading.tsx): el icono de la
// app con las ruedas girando y, debajo, una barra con la franja del pelotón
// que va y viene — para que al pulsar un enlace se vea al momento que algo
// está pasando, en vez de parecer que la página se ha quedado congelada.
// Sin estado ni efectos: se pinta igual en servidor y navegador.
export default function PageLoader({ label = "Cargando…" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[40vh] flex-col items-center justify-center gap-4 py-16"
    >
      <BikeIcon className="h-16 w-16 drop-shadow-sm" />
      <div className="tx-loader-track h-1.5 w-40 overflow-hidden rounded-full">
        <div className="tx-loader-bar h-full w-1/2 rounded-full" />
      </div>
      <span className="font-display text-xs uppercase tracking-[0.16em] text-text-soft">
        {label}
      </span>
    </div>
  );
}

// El mismo dibujo que public/tx-identity/logo/tx-icon.svg, en línea para
// poder animar las ruedas (los radios discontinuos hacen que se note el giro).
function BikeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <defs>
        <clipPath id="tx-loader-clip">
          <rect width="100" height="100" rx="22.5" />
        </clipPath>
      </defs>
      <g clipPath="url(#tx-loader-clip)">
        <rect width="100" height="100" fill="#15140f" />
        <g
          fill="none"
          stroke="#f3f1ec"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle className="tx-loader-wheel" cx="28" cy="58" r="16" strokeDasharray="18 7.13" />
          <circle className="tx-loader-wheel" cx="72" cy="58" r="16" strokeDasharray="18 7.13" />
          <path d="M28 58 L47 58 L41 34 Z" />
          <path d="M41 34 L66 35 L47 58" />
          <path d="M65 32 L72 58" />
          <path d="M35 30 L46 30" />
          <path d="M65 32 L70 29 L76 29 Q80 29 80 33 L80 36 Q80 39 77 39" />
        </g>
        <rect x="0" y="88" width="20" height="12" fill="#5fc79b" />
        <rect x="20" y="88" width="20" height="12" fill="#f06aa0" />
        <rect x="40" y="88" width="20" height="12" fill="#f2c230" />
        <rect x="60" y="88" width="20" height="12" fill="#e5514a" />
        <rect x="80" y="88" width="20" height="12" fill="#4fa8e6" />
      </g>
    </svg>
  );
}
