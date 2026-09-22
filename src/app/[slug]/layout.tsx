import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getCompetition } from "@/lib/competitions-data";
import { isPicksLocked, formatEventDate } from "@/lib/competitions";
import { getCompetitionTheme } from "@/lib/competition-theme";

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

  return (
    <div className={theme.scopeClassName}>
      {theme.stripeClassName && <div className={theme.stripeClassName} />}
      <div className="mx-auto max-w-3xl px-5 py-8">
        <div className="mb-1 flex items-center gap-2 font-display text-[11px] uppercase tracking-[0.16em] text-verde">
          <span className="h-1.5 w-1.5 rounded-full bg-amarillo" />
          {competition.season}
        </div>
        <h1 className="text-2xl text-verde-deep">{competition.name}</h1>

        {competition.picks_lock_at && (
          <p
            className={`mt-2 font-display text-xs uppercase tracking-wide ${
              locked ? "text-rosa" : "text-verde"
            }`}
          >
            {locked
              ? "Los fichajes están cerrados."
              : `Fichajes abiertos hasta ${formatEventDate(competition.picks_lock_at)}.`}
          </p>
        )}

        <nav className="mt-5 flex flex-wrap gap-1.5">
          {session?.status === "approved" && (
            <>
              <SubNavLink href={`/${slug}`}>Resumen</SubNavLink>
              {competition.game_type === "squad_color" && competition.squad_composition && (
                <SubNavLink href={`/${slug}/equipo`}>Mi equipo</SubNavLink>
              )}
              <SubNavLink href={`/${slug}/clasificacion`}>Clasificación</SubNavLink>
            </>
          )}
          <SubNavLink href={`/${slug}/reglamento`}>Reglamento</SubNavLink>
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
