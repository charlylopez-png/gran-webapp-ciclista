"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// Navegación dentro de una competición. Dos formas según la pantalla:
//  · Móvil: barra fija abajo, como una app, con las secciones principales
//    (icono grande + texto) y un "Más" que abre un panel con el resto.
//  · Ordenador: fila de pestañas con icono y subrayado en la activa; las
//    principales primero y, tras un separador, las secundarias.
// La pestaña activa se calcula con la ruta actual.
export type NavIcon =
  | "home"
  | "team"
  | "stages"
  | "calendar"
  | "trophy"
  | "teams"
  | "data"
  | "history"
  | "rules"
  | "prices"
  | "admin";

export type CompetitionNavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  primary?: boolean;
  // Texto más corto para la barra inferior del móvil (si el normal no cabe).
  shortLabel?: string;
};

export default function CompetitionNav({ items, homeHref }: { items: CompetitionNavItem[]; homeHref: string }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  // Cierra el panel "Más" al cambiar de página.
  useEffect(() => setMoreOpen(false), [pathname]);

  const isActive = (href: string) =>
    href === homeHref ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  const primary = items.filter((i) => i.primary);
  const secondary = items.filter((i) => !i.primary);
  // En móvil caben 4 + "Más"; si no hay secundarias, hasta 5 principales.
  const mobileMain = secondary.length > 0 ? primary.slice(0, 4) : primary.slice(0, 5);
  const mobileMore = [...primary.slice(mobileMain.length), ...secondary];
  const moreActive = mobileMore.some((i) => isActive(i.href));

  if (items.length === 0) return null;

  return (
    <>
      {/* Ordenador / tableta */}
      <nav className="mt-4 hidden border-b border-line sm:block" aria-label="Secciones">
        <div className="-mb-px flex items-stretch gap-1 overflow-x-auto">
          {primary.map((item) => (
            <DesktopTab key={item.href} item={item} active={isActive(item.href)} />
          ))}
          {primary.length > 0 && secondary.length > 0 && (
            <span className="mx-2 my-3 w-px shrink-0 bg-[var(--line)]" aria-hidden="true" />
          )}
          {secondary.map((item) => (
            <DesktopTab key={item.href} item={item} active={isActive(item.href)} secondary />
          ))}
        </div>
      </nav>

      {/* Móvil: barra inferior fija */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-[var(--bg)] pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
        aria-label="Secciones"
      >
        <div className="mx-auto flex max-w-md items-stretch">
          {mobileMain.map((item) => (
            <MobileTab key={item.href} item={item} active={isActive(item.href)} />
          ))}
          {mobileMore.length > 0 && (
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={moreOpen}
              className={`flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1 px-1 text-[11px] font-semibold ${
                moreActive || moreOpen ? "text-[var(--accent)]" : "text-text-soft"
              }`}
            >
              <Icon name={moreOpen ? "close" : "more"} />
              Más
            </button>
          )}
        </div>
      </nav>

      {/* Móvil: panel "Más" */}
      {moreOpen && (
        <div className="fixed inset-0 z-30 sm:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-line bg-[var(--bg)] px-4 pb-[calc(76px+env(safe-area-inset-bottom))] pt-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--line)]" />
            <div className="grid grid-cols-2 gap-2">
              {mobileMore.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex min-h-[56px] items-center gap-3 rounded-2xl border px-4 text-sm font-semibold ${
                      active
                        ? "border-[var(--accent)] bg-[var(--accent)] text-on-accent"
                        : "border-line bg-surface text-text"
                    }`}
                  >
                    <Icon name={item.icon} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DesktopTab({
  item,
  active,
  secondary = false,
}: {
  item: CompetitionNavItem;
  active: boolean;
  secondary?: boolean;
}) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold transition ${
        active
          ? "border-[var(--accent)] text-text"
          : `border-transparent hover:border-[var(--line)] hover:text-text ${secondary ? "text-[var(--text-faint)]" : "text-text-soft"}`
      }`}
    >
      <Icon name={item.icon} small />
      {item.label}
    </Link>
  );
}

function MobileTab({ item, active }: { item: CompetitionNavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`relative flex min-h-[60px] min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-[11px] font-semibold ${
        active ? "text-[var(--accent)]" : "text-text-soft"
      }`}
    >
      {active && <span className="absolute inset-x-5 top-0 h-[3px] rounded-b-full bg-[var(--accent)]" />}
      <Icon name={item.icon} />
      <span className="max-w-full truncate">{item.shortLabel ?? item.label}</span>
    </Link>
  );
}

// Iconos de trazo (24×24), en el color del texto.
function Icon({ name, small = false }: { name: NavIcon | "more" | "close"; small?: boolean }) {
  const size = small ? 18 : 22;
  const paths: Record<string, React.ReactNode> = {
    home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
    team: (
      <>
        <circle cx="6" cy="17" r="3.5" />
        <circle cx="18" cy="17" r="3.5" />
        <path d="M6 17l4-8h5l3 8M10 9l-1.5-3H6M15 9l1-3h2.5" />
      </>
    ),
    stages: <path d="M3 19l5-9 4 5 3-4 6 8zM15 4v5M15 4l4 1.5L15 7" />,
    calendar: (
      <>
        <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
        <path d="M3.5 10h17M8 3v4M16 3v4" />
      </>
    ),
    trophy: <path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4.5v1.5A3.5 3.5 0 0 0 8 11M16 6h3.5v1.5A3.5 3.5 0 0 1 16 11M12 13v4M8.5 20.5h7M9.5 17h5v3.5h-5z" />,
    teams: (
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14a6.5 6.5 0 0 1 3 6" />
      </>
    ),
    data: <path d="M4 20V10M10 20V4M16 20v-7M21.5 20h-19" />,
    history: (
      <>
        <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6L3.5 8.5" />
        <path d="M3.5 3.5v5h5M12 7.5V12l3 2" />
      </>
    ),
    rules: <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5zM5 19.5A1.5 1.5 0 0 0 6.5 21H19M9 7.5h6M9 11h6" />,
    prices: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M14.5 9a2.5 2.5 0 0 0-2.5-1.5c-1.5 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1 2-2.5 2A2.5 2.5 0 0 1 9.5 15M12 6v1.5M12 16.5V18" />
      </>
    ),
    admin: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
      </>
    ),
    more: (
      <>
        <circle cx="5" cy="12" r="1.3" fill="currentColor" />
        <circle cx="12" cy="12" r="1.3" fill="currentColor" />
        <circle cx="19" cy="12" r="1.3" fill="currentColor" />
      </>
    ),
    close: <path d="M5 5l14 14M19 5L5 19" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {paths[name]}
    </svg>
  );
}
