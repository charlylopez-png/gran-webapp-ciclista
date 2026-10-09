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
      <div className="flex rounded-2xl border border-line bg-surface p-1 sm:inline-flex">
        <Tab href={`/${slug}/clasificacion`} active={view === "general"}>
          General
        </Tab>
        <Tab href={`/${slug}/clasificacion?vista=ultima`} active={view === "ultima"}>
          Última etapa
        </Tab>
      </div>
      <p className="mt-2 text-xs text-text-soft">
        {lastStage ? `Tras la etapa ${lastStage.order}` : "Aún no hay etapas puntuadas"}
      </p>
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
      aria-current={active ? "page" : undefined}
      className={`flex-1 rounded-xl px-5 py-2.5 text-center text-sm font-semibold transition sm:flex-none ${
        active ? "bg-[var(--accent)] text-on-accent shadow-sm" : "text-text-soft hover:text-text"
      }`}
    >
      {children}
    </Link>
  );
}
