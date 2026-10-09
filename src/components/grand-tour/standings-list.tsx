import type { GtRoster, StandingRow } from "@/lib/grand-tour";
import TeamRoster, { type RosterLookup } from "./team-roster";

// Clasificación de participantes de una gran vuelta. Cada fila se despliega
// (con <details>, sin JavaScript) para ver los corredores del equipo y lo
// que ha puntuado cada uno — en la general o en una sola etapa, según las
// `contributions` que traiga cada fila.
export type StandingsEntry = {
  teamId: string;
  teamName: string;
  ownerName: string;
  position: number;
  points: number;
  contributions: StandingRow["contributions"];
  // Puesto en la clasificación anterior (para la flecha ▲▼), si hay.
  previousPosition?: number;
};

export default function StandingsList({
  entries,
  rosters,
  lookup,
  highlightTeamId,
}: {
  entries: StandingsEntry[];
  rosters: GtRoster[];
  lookup: RosterLookup;
  highlightTeamId?: string;
}) {
  const rosterById = new Map(rosters.map((r) => [r.teamId, r]));
  if (entries.length === 0) {
    return <p className="text-sm text-text-soft">Todavía no hay participantes con plantilla.</p>;
  }
  return (
    <ol className="flex flex-col gap-1.5">
      {entries.map((e) => {
        const roster = rosterById.get(e.teamId);
        const delta = e.previousPosition !== undefined ? e.previousPosition - e.position : 0;
        return (
          <li key={e.teamId}>
            <details
              className={`group rounded-xl border bg-surface ${
                e.teamId === highlightTeamId ? "border-verde-deep" : "border-line"
              }`}
            >
              <summary className="flex cursor-pointer list-none items-center gap-3 px-3.5 py-2.5">
                <span
                  className={`w-7 shrink-0 text-center font-display text-sm ${
                    e.position <= 3 ? "text-amarillo" : "text-text-soft"
                  }`}
                >
                  {e.position}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base">{e.teamName}</span>
                  <span className="block truncate text-xs text-text-soft">{e.ownerName}</span>
                </span>
                {delta !== 0 && (
                  <span className={`shrink-0 text-xs ${delta > 0 ? "text-verde" : "text-rosa"}`}>
                    {delta > 0 ? `▲${delta}` : `▼${-delta}`}
                  </span>
                )}
                <span className="shrink-0 font-display text-lg text-verde-deep">{e.points}</span>
                <span className="shrink-0 text-text-soft transition group-open:rotate-90">›</span>
              </summary>
              {roster && (
                <div className="border-t border-line px-3.5 py-3">
                  <TeamRoster roster={roster} contributions={e.contributions} lookup={lookup} compact />
                </div>
              )}
            </details>
          </li>
        );
      })}
    </ol>
  );
}
