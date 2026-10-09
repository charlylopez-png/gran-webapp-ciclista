import type { Competition } from "@/lib/competitions-data";
import type { SessionPayload } from "@/lib/auth";
import {
  buildRosterLookup,
  getGrandTourData,
  lowestPriceTier,
  type GtConfig,
} from "@/lib/grand-tour-data";
import { canSubstitute, computeStandings } from "@/lib/grand-tour";
import { formatEventDate, isPicksLocked } from "@/lib/competitions";
import { getActiveTeam } from "@/lib/teams";
import BudgetSquadSelector from "@/components/budget-squad-selector";
import SubstitutionPanel, { type PendingSubstitution } from "@/components/substitution-panel";
import TeamRoster from "@/components/grand-tour/team-roster";
import TeamSwitcher from "@/components/team-switcher";

// "Mi equipo" de una gran vuelta. Antes del cierre: la plantilla guardada
// arriba y el selector debajo, para cambiar de opinión. Después del
// cierre: solo la plantilla elegida, con los puntos de cada uno y, si se
// ha retirado algún titular, la opción de meter un suplente.
export default async function GrandTourEquipo({
  competition,
  config,
  session,
}: {
  competition: Competition;
  config: GtConfig;
  session: SessionPayload;
}) {
  const slug = competition.slug;
  const { teams, activeTeam } = await getActiveTeam(session.userId, competition.id);
  const data = await getGrandTourData(competition.id);
  const lookup = buildRosterLookup(data);
  const locked = isPicksLocked(competition.picks_lock_at);

  const roster = data.rosters.find((r) => r.teamId === activeTeam.id) ?? {
    teamId: activeTeam.id,
    teamName: activeTeam.name,
    ownerName: session.displayName,
    starters: [],
    bench: [],
    realTeams: [],
    substitutions: [],
  };
  const standing = computeStandings([roster], data.stages, data.results)[0];
  const hasPicks = roster.starters.length + roster.bench.length + roster.realTeams.length > 0;

  // Titulares retirados todavía sin sustituir, con los suplentes válidos.
  const lowest = lowestPriceTier(data.riders);
  const usedBench = new Set(roster.substitutions.map((s) => s.inRiderId));
  const subbedOut = new Set(roster.substitutions.map((s) => s.outRiderId));
  const pending: PendingSubstitution[] = locked
    ? roster.starters
        .map((id) => data.riders.find((r) => r.id === id))
        .filter((r): r is NonNullable<typeof r> => Boolean(r?.withdrawnEventId) && !subbedOut.has(r!.id))
        .map((out) => ({
          out: {
            id: out.id,
            name: out.name,
            price: out.price,
            stage: out.withdrawnEventId ? lookup.stageOrderById.get(out.withdrawnEventId) ?? null : null,
          },
          options: roster.bench
            .filter((id) => !usedBench.has(id))
            .map((id) => data.riders.find((r) => r.id === id))
            .filter((r): r is NonNullable<typeof r> => Boolean(r))
            .filter((r) => !r.withdrawnEventId && canSubstitute(out.price, r.price, lowest))
            .map((r) => ({ id: r.id, name: r.name, price: r.price })),
        }))
    : [];

  return (
    <div>
      <TeamSwitcher teams={teams} activeTeamId={activeTeam.id} competitionId={competition.id} />

      <p
        className={`mt-4 font-display text-xs uppercase tracking-wide ${locked ? "text-rosa" : "text-verde"}`}
      >
        {competition.picks_lock_at
          ? locked
            ? `Plantillas cerradas el ${formatEventDate(competition.picks_lock_at)}.`
            : `Cierre de plantillas: ${formatEventDate(competition.picks_lock_at)}.`
          : "Fecha de cierre por confirmar."}
      </p>

      {hasPicks && (
        <section className="mt-4 rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-sm uppercase tracking-wide text-verde-deep">
              {locked ? activeTeam.name : "Tu plantilla guardada"}
            </h2>
            {locked && <span className="font-display text-xl text-verde-deep">{standing.total} pts</span>}
          </div>
          <div className="mt-3">
            <TeamRoster roster={roster} contributions={standing.contributions} lookup={lookup} />
          </div>
        </section>
      )}

      {locked ? (
        <>
          <SubstitutionPanel pending={pending} saveUrl={`/api/competitions/${slug}/substitution`} />
          {!hasPicks && (
            <p className="mt-6 text-sm text-text-soft">No llegaste a guardar plantilla antes del cierre.</p>
          )}
        </>
      ) : (
        <section className="mt-6 rounded-2xl bg-surface p-4">
          <h2 className="mb-2 font-display text-sm uppercase tracking-wide text-verde-deep">
            {hasPicks ? "Cambiar la plantilla" : "Arma tu plantilla"}
          </h2>
          <BudgetSquadSelector
            key={activeTeam.id}
            riders={data.riders
              .filter((r) => r.active && r.price > 0)
              .map((r) => ({ id: r.id, name: r.name, team: r.team, nationality: r.nationality, price: r.price }))}
            realTeams={data.realTeams}
            initialStarters={roster.starters}
            initialBench={roster.bench}
            initialRealTeams={roster.realTeams}
            budget={config.budget}
            squadSize={config.squadSize}
            benchSize={config.benchSize}
            realTeamPicks={config.realTeamPicks}
            saveUrl={`/api/competitions/${slug}/budget-squad`}
          />
        </section>
      )}
    </div>
  );
}
