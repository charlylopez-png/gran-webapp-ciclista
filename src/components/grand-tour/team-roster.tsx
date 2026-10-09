import type { Contribution, GtRoster } from "@/lib/grand-tour";

// Plantilla de un participante de una gran vuelta con lo que ha aportado
// cada corredor/equipo: titulares (con su suplente si entró), suplentes y
// equipos ciclistas. Sin estado: sirve en Inicio, Mi equipo y en el
// desplegable de la Clasificación.
export type RosterLookup = {
  riders: Map<string, { name: string; team: string | null; price: number; withdrawn: boolean }>;
  teams: Map<string, string>;
  stageOrderById: Map<string, number>;
};

export default function TeamRoster({
  roster,
  contributions,
  lookup,
  compact = false,
}: {
  roster: GtRoster;
  contributions: Contribution[];
  lookup: RosterLookup;
  compact?: boolean;
}) {
  const points = new Map(contributions.map((c) => [`${c.kind}:${c.id}`, c.points]));
  const subByOut = new Map(roster.substitutions.map((s) => [s.outRiderId, s]));
  const usedBench = new Set(roster.substitutions.map((s) => s.inRiderId));
  const spent = roster.starters.reduce((s, id) => s + (lookup.riders.get(id)?.price ?? 0), 0);

  const starters = [...roster.starters].sort(
    (a, b) => (lookup.riders.get(b)?.price ?? 0) - (lookup.riders.get(a)?.price ?? 0)
  );

  return (
    <div className="flex flex-col gap-3">
      <div>
        {!compact && (
          <div className="mb-1 flex items-baseline justify-between text-xs text-text-soft">
            <span className="font-display uppercase tracking-wide text-verde-deep">
              Titulares ({roster.starters.length})
            </span>
            <span>{spent} pts de presupuesto</span>
          </div>
        )}
        <ul className="divide-y divide-line">
          {starters.map((id) => {
            const r = lookup.riders.get(id);
            const sub = subByOut.get(id);
            const inRider = sub ? lookup.riders.get(sub.inRiderId) : undefined;
            return (
              <li key={id} className="py-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <span className={`min-w-0 flex-1 truncate ${sub ? "text-text-soft line-through" : ""}`}>
                    🚴 {r?.name ?? "—"}
                    {r?.withdrawn && !sub && <span className="ml-1 text-xs text-rosa">(retirado)</span>}
                  </span>
                  <span className="shrink-0 text-xs text-text-soft">{r?.price}</span>
                  <span className="w-12 shrink-0 text-right font-display">{points.get(`rider:${id}`) ?? 0}</span>
                </div>
                {sub && inRider && (
                  <div className="flex items-center gap-2 pl-5 text-sm">
                    <span className="min-w-0 flex-1 truncate">
                      ↳ {inRider.name}{" "}
                      <span className="text-xs text-text-soft">
                        (suplente desde la etapa {sub.fromOrder})
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-text-soft">{inRider.price}</span>
                    <span className="w-12 shrink-0 text-right font-display">
                      {points.get(`rider:${sub.inRiderId}`) ?? 0}
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {roster.bench.filter((id) => !usedBench.has(id)).length > 0 && (
        <div>
          <div className="mb-1 font-display text-xs uppercase tracking-wide text-verde-deep">Suplentes</div>
          <ul className="divide-y divide-line">
            {roster.bench
              .filter((id) => !usedBench.has(id))
              .map((id) => {
                const r = lookup.riders.get(id);
                return (
                  <li key={id} className="flex items-center gap-2 py-1.5 text-sm text-text-soft">
                    <span className="min-w-0 flex-1 truncate">🪑 {r?.name ?? "—"}</span>
                    <span className="shrink-0 text-xs">{r?.price}</span>
                    <span className="w-12 shrink-0 text-right">—</span>
                  </li>
                );
              })}
          </ul>
        </div>
      )}

      {roster.realTeams.length > 0 && (
        <div>
          <div className="mb-1 font-display text-xs uppercase tracking-wide text-verde-deep">Equipos</div>
          <ul className="divide-y divide-line">
            {roster.realTeams.map((id) => (
              <li key={id} className="flex items-center gap-2 py-1.5 text-sm">
                <span className="min-w-0 flex-1 truncate">🚩 {lookup.teams.get(id) ?? "—"}</span>
                <span className="w-12 shrink-0 text-right font-display">{points.get(`team:${id}`) ?? 0}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
