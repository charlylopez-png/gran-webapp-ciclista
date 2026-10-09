import Link from "next/link";
import type { Competition } from "@/lib/competitions-data";
import type { SessionPayload } from "@/lib/auth";
import { buildRosterLookup, getGrandTourData } from "@/lib/grand-tour-data";
import { computeStandings, hasStageResults, rankRows, scoreStage } from "@/lib/grand-tour";
import { getUserTeams } from "@/lib/teams";
import StandingsList, { type StandingsEntry } from "@/components/grand-tour/standings-list";

// Clasificación de una gran vuelta: la general (con la flecha de lo que ha
// subido o bajado cada uno en la última etapa) y la de la última etapa.
// Pulsando en un equipo se ven sus corredores con sus puntos.
export default async function GrandTourClasificacion({
  competition,
  session,
  view,
}: {
  competition: Competition;
  session: SessionPayload;
  view: "general" | "ultima";
}) {
  const slug = competition.slug;
  const data = await getGrandTourData(competition.id);
  const lookup = buildRosterLookup(data);
  const myTeams = await getUserTeams(session.userId, competition.id);
  const myTeamId = myTeams[0]?.id;

  const resultByStage = new Map(data.results.map((r) => [r.stageId, r]));
  const doneStages = data.stages.filter((s) => hasStageResults(resultByStage.get(s.id)));
  const lastStage = doneStages[doneStages.length - 1];

  const standings = computeStandings(data.rosters, data.stages, data.results);

  let entries: StandingsEntry[];
  if (view === "ultima") {
    entries = lastStage
      ? rankRows(
          data.rosters.map((roster) => {
            const { total, contributions } = scoreStage(roster, lastStage.order, resultByStage.get(lastStage.id));
            return {
              teamId: roster.teamId,
              teamName: roster.teamName,
              ownerName: roster.ownerName,
              position: 0,
              points: total,
              contributions,
            };
          }),
          (e) => e.points
        )
      : [];
  } else {
    // Puestos antes de la última etapa, para la flecha ▲▼.
    const previous =
      doneStages.length > 1
        ? computeStandings(
            data.rosters,
            data.stages,
            data.results.filter((r) => r.stageId !== lastStage?.id)
          )
        : [];
    const prevPos = new Map(previous.map((p) => [p.teamId, p.position]));
    entries = standings.map((s) => ({
      teamId: s.teamId,
      teamName: s.teamName,
      ownerName: s.ownerName,
      position: s.position,
      points: s.total,
      contributions: s.contributions,
      previousPosition: prevPos.get(s.teamId),
    }));
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Tab href={`/${slug}/clasificacion`} active={view === "general"}>
          General
        </Tab>
        <Tab href={`/${slug}/clasificacion?vista=ultima`} active={view === "ultima"}>
          Última etapa
        </Tab>
        <span className="ml-auto text-xs text-text-soft">
          {lastStage ? `Tras la etapa ${lastStage.order}` : "Aún no hay etapas puntuadas"}
        </span>
      </div>
      {view === "ultima" && lastStage && (
        <p className="mt-3 text-sm text-text-soft">
          Etapa {lastStage.order}
          {lastStage.start && lastStage.finish ? ` · ${lastStage.start} → ${lastStage.finish}` : ""}.{" "}
          <Link href={`/${slug}/etapas/${lastStage.order}`} className="text-verde-deep underline">
            Ver la etapa
          </Link>
        </p>
      )}
      <div className="mt-4">
        <StandingsList entries={entries} rosters={data.rosters} lookup={lookup} highlightTeamId={myTeamId} />
      </div>
    </div>
  );
}

function Tab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-4 py-2 font-display text-xs uppercase tracking-wide ${
        active ? "border-verde-deep bg-verde-deep text-on-accent" : "border-line bg-surface text-text-soft"
      }`}
    >
      {children}
    </Link>
  );
}
