import Link from "next/link";
import type { Competition } from "@/lib/competitions-data";
import type { SessionPayload } from "@/lib/auth";
import { buildRosterLookup, getGrandTourData } from "@/lib/grand-tour-data";
import { computeStandings, hasStageResults, stageTypeInfo } from "@/lib/grand-tour";
import { formatEventDate } from "@/lib/competitions";
import { getActiveTeam } from "@/lib/teams";
import TeamRoster from "@/components/grand-tour/team-roster";
import StandingsList from "@/components/grand-tour/standings-list";

// Inicio de una gran vuelta: tu equipo con los puntos que lleva, la
// próxima etapa y la clasificación general de los participantes.
export default async function GrandTourHome({
  competition,
  session,
}: {
  competition: Competition;
  session: SessionPayload;
}) {
  const slug = competition.slug;
  const { activeTeam } = await getActiveTeam(session.userId, competition.id);
  const data = await getGrandTourData(competition.id);
  const lookup = buildRosterLookup(data);
  const standings = computeStandings(data.rosters, data.stages, data.results);
  const mine = standings.find((s) => s.teamId === activeTeam.id);
  const myRoster = data.rosters.find((r) => r.teamId === activeTeam.id);

  const resultByStage = new Map(data.results.map((r) => [r.stageId, r]));
  const nextStage = data.stages.find((s) => !s.cancelled && !hasStageResults(resultByStage.get(s.id)));
  const lastDone = [...data.stages].reverse().find((s) => hasStageResults(resultByStage.get(s.id)));

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display text-sm uppercase tracking-wide text-verde-deep">{activeTeam.name}</h2>
          {mine && (
            <span className="text-right">
              <span className="font-display text-2xl text-verde-deep">{mine.total}</span>
              <span className="ml-1 text-xs text-text-soft">pts · {mine.position}º</span>
            </span>
          )}
        </div>
        {myRoster && mine ? (
          <div className="mt-3">
            <TeamRoster roster={myRoster} contributions={mine.contributions} lookup={lookup} compact />
          </div>
        ) : (
          <p className="mt-1 text-sm text-text-soft">Todavía no has armado tu plantilla.</p>
        )}
        <Link
          href={`/${slug}/equipo`}
          className="mt-3 inline-block rounded-full bg-[var(--accent)] px-4 py-2 font-display text-xs uppercase tracking-wide text-on-accent hover:brightness-110"
        >
          Mi equipo
        </Link>
      </section>

      {nextStage && (
        <Link
          href={`/${slug}/etapas/${nextStage.order}`}
          className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 hover:border-verde-deep/50"
        >
          <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-[var(--pill-bg)] text-[var(--pill-text)]">
            <span className="text-lg leading-none">{stageTypeInfo(nextStage.type).icon}</span>
            <span className="font-display text-xs">Etapa {nextStage.order}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-display text-[11px] uppercase tracking-wide text-verde-deep">Próxima etapa</div>
            <div className="truncate text-base font-semibold">
              {nextStage.start && nextStage.finish ? `${nextStage.start} → ${nextStage.finish}` : nextStage.name}
            </div>
            <div className="text-sm text-text-soft">
              {nextStage.date ? formatEventDate(nextStage.date) : "Fecha por confirmar"}
              {nextStage.km ? ` · ${nextStage.km} km` : ""}
            </div>
          </div>
        </Link>
      )}

      <section className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display text-sm uppercase tracking-wide text-verde-deep">Clasificación general</h2>
          {lastDone && <span className="text-xs text-text-soft">tras la etapa {lastDone.order}</span>}
        </div>
        <div className="mt-3">
          <StandingsList
            entries={standings.map((s) => ({
              teamId: s.teamId,
              teamName: s.teamName,
              ownerName: s.ownerName,
              position: s.position,
              points: s.total,
              contributions: s.contributions,
            }))}
            rosters={data.rosters}
            lookup={lookup}
            highlightTeamId={activeTeam.id}
          />
        </div>
        <Link
          href={`/${slug}/clasificacion`}
          className="mt-3 inline-block text-xs text-verde-deep underline underline-offset-2"
        >
          Ver la clasificación completa →
        </Link>
      </section>
    </div>
  );
}
