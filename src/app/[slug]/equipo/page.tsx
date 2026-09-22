import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getCompetition, getCompetitionRiders } from "@/lib/competitions-data";
import { getActiveTeam } from "@/lib/teams";
import { isPicksLocked } from "@/lib/competitions";
import SquadSelector, { type SelectableRider } from "@/components/squad-selector";
import TeamSwitcher from "@/components/team-switcher";

// Pantalla de fichaje: sustituye a /mi-equipo (solo clásicas) y a
// /mundial/eleccion + /mundial/equipo (solo Mundial). Una sola pantalla,
// genérica para cualquier competición squad_color, con la composición de
// equipo (cuántos de cada color) que traiga la competición en vez de un
// 1+2+3 fijo en el código.
export default async function CompetitionEquipoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const competition = await getCompetition(slug);
  if (!competition || competition.status === "hidden") notFound();
  if (competition.game_type !== "squad_color" || !competition.squad_composition) {
    // Las competiciones budget_draft tienen su propia pantalla de fichaje
    // (pendiente: motor de presupuesto para las grandes vueltas).
    notFound();
  }

  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin" && session.status !== "approved") {
    return <p className="text-sm text-text-soft">Tu cuenta todavía no está aprobada.</p>;
  }

  const { teams, activeTeam } = await getActiveTeam(session.userId, competition.id);

  const competitionRiders = await getCompetitionRiders(competition.id);
  const riders: SelectableRider[] = competitionRiders
    .filter((r) => r.category !== null)
    .map((r) => ({
      id: r.id,
      name: r.name,
      team: r.team,
      division: r.division,
      category: r.category!,
    }));

  const squadRows = (await sql`
    select competition_rider_id from team_squad where team_id = ${activeTeam.id}
  `) as { competition_rider_id: string }[];

  const locked = isPicksLocked(competition.picks_lock_at);
  // Mundial agrupa y busca por país (con bandera); el resto de
  // competiciones squad_color, por equipo ciclista.
  const showFlags = competition.slug === "mundial";

  return (
    <div>
      <TeamSwitcher
        teams={teams}
        activeTeamId={activeTeam.id}
        competitionId={competition.id}
      />
      <div className="mt-4 rounded-2xl bg-surface p-4">
        <SquadSelector
          key={activeTeam.id}
          riders={riders}
          initialSelectedIds={squadRows.map((r) => r.competition_rider_id)}
          saveUrl={`/api/competitions/${slug}/team-squad`}
          squadComposition={competition.squad_composition}
          showFlags={showFlags}
          showDivisionFilter={!showFlags}
          groupLabel={showFlags ? "Sin país" : "Sin equipo"}
          locked={locked}
        />
      </div>
    </div>
  );
}
