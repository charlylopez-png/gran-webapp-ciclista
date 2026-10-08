import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getCompetition } from "@/lib/competitions-data";
import { isPicksLocked, formatEventDate, squadLabels } from "@/lib/competitions";
import { getCompetitionTheme } from "@/lib/competition-theme";
import CobbleBackground from "@/components/cobble-background";

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

  return (
    <div className={theme.scopeClassName}>
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
              {locked
                ? `Los fichajes del ${labels.base} están cerrados.`
                : `${labels.base} abierto hasta ${formatEventDate(competition.picks_lock_at)}.`}
            </p>
          )}
        </div>
      </div>
      <div className="mx-auto max-w-3xl px-5 pb-8">
        <nav className="mt-5 flex flex-wrap gap-1.5">
          {session?.status === "approved" && <SubNavLink href={`/${slug}`}>Inicio</SubNavLink>}
          <SubNavLink href={`/${slug}/reglamento`}>Reglamento</SubNavLink>
          {session?.status === "approved" && (
            <>
              {hasEvents && (
                <>
                  <SubNavLink href={`/${slug}/equipo`}>Mi {labels.baseShort}</SubNavLink>
                  <SubNavLink href={`/${slug}/calendario`}>Calendario</SubNavLink>
                  <SubNavLink href={`/${slug}/equipos`}>Equipos</SubNavLink>
                </>
              )}
              <SubNavLink href={`/${slug}/clasificacion`}>Clasificación</SubNavLink>
            </>
          )}
          {session?.role === "admin" && (
            <SubNavLink href={`/${slug}/admin`}>Admin</SubNavLink>
          )}
        </nav>

        <div className="mt-6 pb-10">{children}</div>
      </div>
    </div>
  );
}

function SubNavLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-full border border-line bg-surface px-3.5 py-2 font-display text-xs uppercase tracking-wide text-text-soft hover:border-verde-deep/50"
    >
      {children}
    </Link>
  );
}
