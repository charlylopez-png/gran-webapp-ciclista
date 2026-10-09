import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getCompetition } from "@/lib/competitions-data";
import { isPicksLocked, formatEventDate, squadLabels } from "@/lib/competitions";
import { getCompetitionTheme } from "@/lib/competition-theme";
import CobbleBackground from "@/components/cobble-background";
import { grandTourConfig } from "@/lib/grand-tour-data";
import CompetitionNav, { type CompetitionNavItem } from "@/components/competition-nav";

// Envoltorio de tema por competición: sustituye a src/app/mundial/layout.tsx
// (que era a medida solo para el Mundial). Aplica la clase de tema
// registrada en competition-theme.ts (si la competición tiene una) para
// que cambie la apariencia al entrar, y el subnav básico común a
// cualquier competición squad_color.
export default async function CompetitionLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const competition = await getCompetition(slug);
  if (!competition || competition.status === "hidden") notFound();

  const session = await getSession();
  const theme = getCompetitionTheme(competition.theme_color);
  const locked = isPicksLocked(competition.picks_lock_at);
  const labels = squadLabels(slug);

  // El adoquinado (empedrado) es elemento de marca propio de UKT — el
  // resto de competiciones se quedan con su --hero-pattern normal.
  const showCobble = slug === "clasicas";
  const hasEvents = competition.game_type === "squad_color" && competition.squad_composition;
  // Gran vuelta ya montada (Giro; Tour y Vuelta cuando se clonen).
  const isGrandTour = grandTourConfig(competition) !== null;
  const lockedText = isGrandTour
    ? "Plantillas cerradas."
    : `Los fichajes del ${labels.base} están cerrados.`;
  const lockDate = competition.picks_lock_at ? formatEventDate(competition.picks_lock_at) : "";
  const openText = isGrandTour
    ? `Plantillas abiertas hasta ${lockDate}.`
    : `${labels.base} abierto hasta ${lockDate}.`;
  const isAdmin = session?.role === "admin";
  const navItems = buildNavItems({
    slug,
    season: competition.season,
    approved: Boolean(session && (session.status === "approved" || isAdmin)),
    isAdmin,
    canPrice: Boolean(isAdmin || session?.sanedrin),
    hasEvents: Boolean(hasEvents),
    isGrandTour,
    baseLabel: labels.baseShort,
  });

  return (
    <div className={`min-h-screen ${theme.scopeClassName}`}>
      {theme.stripeClassName && <div className={theme.stripeClassName} />}
      <div className="comp-hero relative overflow-hidden px-5 pb-6 pt-8">
        {showCobble && (
          <>
            <CobbleBackground cell={0.13} seed={7} />
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(120% 90% at 30% 20%, rgba(4,16,10,0.72), rgba(4,16,10,0.25) 55%, rgba(4,16,10,0.55))",
              }}
            />
          </>
        )}
        <div className="relative mx-auto max-w-3xl">
          <div className="mb-1 flex items-center gap-2 font-display text-[11px] uppercase tracking-[0.16em] text-verde">
            <span className="h-1.5 w-1.5 rounded-full bg-amarillo" />
            {competition.season}
          </div>
          <h1 className="comp-title text-2xl text-verde-deep">{competition.name}</h1>

          {competition.picks_lock_at && (
            <p
              className={`mt-2 font-display text-xs uppercase tracking-wide ${
                locked ? "text-rosa" : "text-verde"
              }`}
            >
              {locked ? lockedText : openText}
            </p>
          )}
        </div>
      </div>
      <div className="mx-auto max-w-3xl px-5 pb-8">
        <CompetitionNav items={navItems} homeHref={`/${slug}`} />
        {/* En móvil la barra de pestañas va fija abajo: hueco para que no tape el final. */}
        <div className="mt-6 pb-[calc(8rem+env(safe-area-inset-bottom))] sm:pb-10">{children}</div>
      </div>
    </div>
  );
}

// Pestañas de la competición, de más a menos usadas: las "primary" van en la
// barra inferior del móvil; el resto, en su panel "Más".
function buildNavItems({
  slug,
  season,
  approved,
  isAdmin,
  canPrice,
  hasEvents,
  isGrandTour,
  baseLabel,
}: {
  slug: string;
  season: number;
  approved: boolean;
  isAdmin: boolean;
  canPrice: boolean;
  hasEvents: boolean;
  isGrandTour: boolean;
  baseLabel: string;
}): CompetitionNavItem[] {
  const base = `/${slug}`;
  const items: CompetitionNavItem[] = [];
  if (approved) {
    items.push({ href: base, label: "Inicio", icon: "home", primary: true });
    if (isGrandTour) {
      items.push({ href: `${base}/equipo`, label: "Mi equipo", icon: "team", primary: true });
      items.push({ href: `${base}/etapas`, label: "Etapas", icon: "stages", primary: true });
    } else if (hasEvents) {
      items.push({ href: `${base}/equipo`, label: `Mi ${baseLabel}`, shortLabel: "Mi equipo", icon: "team", primary: true });
      items.push({ href: `${base}/calendario`, label: "Calendario", icon: "calendar", primary: true });
    }
    items.push({ href: `${base}/clasificacion`, label: "Clasificación", icon: "trophy", primary: true });
    if (isGrandTour) items.push({ href: `${base}/data`, label: "Data", icon: "data" });
    if (hasEvents) items.push({ href: `${base}/equipos`, label: "Equipos", icon: "teams" });
  }
  // Sin sesión aprobada, reglamento y edición pasada son lo único que hay:
  // van como principales para que se vean en la barra.
  items.push({ href: `${base}/edicion-anterior`, label: `Edición ${season - 1}`, icon: "history", primary: !approved });
  items.push({ href: `${base}/reglamento`, label: "Reglamento", icon: "rules", primary: !approved });
  if (isGrandTour && canPrice) items.push({ href: `${base}/precios`, label: "Precios", icon: "prices" });
  if (isAdmin) items.push({ href: `${base}/admin`, label: "Admin", icon: "admin" });
  return items;
}
