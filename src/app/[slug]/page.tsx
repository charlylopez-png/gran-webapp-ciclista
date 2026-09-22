import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getCompetition } from "@/lib/competitions-data";
import { getActiveTeam } from "@/lib/teams";

// Resumen de una competición: cuántos corredores lleva fichados el
// equipo activo y accesos a Mi equipo / Clasificación. Sustituye a la
// portada a medida que tenía el Mundial (mundial-home-banner.tsx).
export default async function CompetitionHomePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const competition = await getCompetition(slug);
  if (!competition || competition.status === "hidden") notFound();

  const session = await getSession();
  if (!session || session.status !== "approved") {
    return (
      <p className="text-sm text-text-soft">
        {session
          ? "Tu cuenta todavía no está aprobada."
          : "Inicia sesión para apuntarte a esta competición."}
      </p>
    );
  }

  // Giro/Tour/Vuelta: dadas de alta para reservar su hueco en la portada,
  // pero su motor de fichaje por presupuesto todavía no existe. Ni
  // creamos equipo ni enlazamos a /equipo (que da 404 a propósito para
  // este game_type) hasta que esa pantalla exista.
  if (competition.game_type !== "squad_color" || !competition.squad_composition) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="font-display text-sm text-verde-deep">Muy pronto</h2>
        <p className="mt-1 text-sm text-text-soft">
          El fichaje por presupuesto de {competition.short_name ?? competition.name}{" "}
          está en marcha. En cuanto esté listo el reglamento y los corredores,
          podrás armar tu equipo aquí.
        </p>
      </div>
    );
  }

  const { activeTeam } = await getActiveTeam(session.userId, competition.id);
  const [{ count }] = (await sql`
    select count(*)::int as count from team_squad where team_id = ${activeTeam.id}
  `) as { count: number }[];

  const squadSize = competition.squad_composition
    ? competition.squad_composition.amarillo +
      competition.squad_composition.rosa +
      competition.squad_composition.verde
    : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="font-display text-sm text-verde-deep">
          {activeTeam.name}
        </h2>
        <p className="mt-1 text-sm text-text-soft">
          {squadSize
            ? `${count}/${squadSize} corredores fichados.`
            : `${count} corredores fichados.`}
        </p>
        <Link
          href={`/${slug}/equipo`}
          className="mt-3 inline-block rounded-full bg-amarillo px-4 py-2 font-display text-xs uppercase tracking-wide text-on-accent hover:bg-gold"
        >
          Editar mi equipo
        </Link>
      </div>
      <Link
        href={`/${slug}/clasificacion`}
        className="rounded-2xl border border-line bg-surface p-4 hover:border-verde-deep/50"
      >
        <h2 className="font-display text-sm text-verde-deep">Clasificación</h2>
        <p className="mt-1 text-sm text-text-soft">Ver cómo va la porra.</p>
      </Link>
    </div>
  );
}
