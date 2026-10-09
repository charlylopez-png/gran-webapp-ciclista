"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  FINAL_LIST_KINDS,
  LIST_ICON,
  LIST_LABEL,
  STAGE_LIST_KINDS,
  activeRidersAt,
  computeStandings,
  hasStageResults,
  idealSquad,
  isTeamList,
  pointsAt,
  pointsByEntry,
  type GtRoster,
  type GtStageResult,
  type ListKind,
} from "@/lib/grand-tour";

// Pestaña Data de una gran vuelta, con las mismas secciones que la app
// anterior. Todo se calcula aquí, en el navegador, a partir de los datos
// crudos (corredores, resultados, plantillas) con las funciones puras de
// lib/grand-tour.ts — las mismas que usa la clasificación, así que los
// números siempre cuadran.
type Rider = { id: string; name: string; team: string | null; price: number };
type RealTeam = { id: string; name: string };
type Stage = { id: string; order: number; cancelled: boolean; label: string };

const SECTIONS = [
  { key: "ranking", label: "⛰️ Ranking corredores" },
  { key: "ideal", label: "🧠 Equipo ideal" },
  { key: "buscador", label: "🔍 ¿Quién tiene a…?" },
  { key: "participantes", label: "👥 Participantes" },
  { key: "sorpresa", label: "🎁 Sorpresa" },
  { key: "rentabilidad", label: "💰 Rentabilidad" },
  { key: "var", label: "🖥️ VAR" },
  { key: "sistema", label: "📖 Sistema de puntos" },
] as const;
type SectionKey = (typeof SECTIONS)[number]["key"];

export default function GrandTourDataTabs({
  riders,
  realTeams,
  stages,
  results,
  rosters,
  budget,
  squadSize,
  realTeamPicks,
  myTeamId,
  systemSlot,
}: {
  riders: Rider[];
  realTeams: RealTeam[];
  stages: Stage[];
  results: GtStageResult[];
  rosters: GtRoster[];
  budget: number;
  squadSize: number;
  realTeamPicks: number;
  myTeamId: string | null;
  systemSlot: ReactNode;
}) {
  const [section, setSection] = useState<SectionKey>("ranking");

  const ridersById = useMemo(() => new Map(riders.map((r) => [r.id, r])), [riders]);
  const teamsById = useMemo(() => new Map(realTeams.map((t) => [t.id, t])), [realTeams]);
  const standings = useMemo(() => computeStandings(rosters, stages, results), [rosters, stages, results]);
  const resultByStage = useMemo(() => new Map(results.map((r) => [r.stageId, r])), [results]);
  const doneStages = stages.filter((s) => hasStageResults(resultByStage.get(s.id)));

  // Puntos de cada corredor por tipo de clasificación (etapa, general…, bonus).
  const riderBreakdown = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    for (const result of results) {
      for (const kind of [...STAGE_LIST_KINDS, ...FINAL_LIST_KINDS]) {
        if (isTeamList(kind)) continue;
        for (const e of result.lists[kind] ?? []) {
          if (!e.riderId) continue;
          const pts = pointsAt(kind, e.position);
          if (!pts) continue;
          const bucket = kind.endsWith("_final") ? "bonus" : kind;
          const row = map.get(e.riderId) ?? {};
          row[bucket] = (row[bucket] ?? 0) + pts;
          map.set(e.riderId, row);
        }
      }
    }
    return map;
  }, [results]);
  const totals = useMemo(() => pointsByEntry(results), [results]);

  // Quién lleva a cada corredor (titulares, suplentes y los que entraron).
  const owners = useMemo(() => {
    const map = new Map<string, { teamName: string; ownerName: string; role: string }[]>();
    const add = (id: string, roster: GtRoster, role: string) => {
      if (!map.has(id)) map.set(id, []);
      map.get(id)!.push({ teamName: roster.teamName, ownerName: roster.ownerName, role });
    };
    for (const roster of rosters) {
      const subOut = new Set(roster.substitutions.map((s) => s.outRiderId));
      const subIn = new Map(roster.substitutions.map((s) => [s.inRiderId, s.fromOrder]));
      roster.starters.forEach((id) => add(id, roster, subOut.has(id) ? "titular (sustituido)" : "titular"));
      roster.bench.forEach((id) =>
        add(id, roster, subIn.has(id) ? `entró en la etapa ${subIn.get(id)}` : "suplente")
      );
    }
    return map;
  }, [rosters]);

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setSection(s.key)}
            className={`rounded-full border px-3 py-1.5 text-xs ${
              section === s.key ? "border-verde-deep bg-verde-deep text-on-accent" : "border-line bg-surface text-text-soft"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {section === "ranking" && (
          <RankingSection riders={riders} breakdown={riderBreakdown} owners={owners} />
        )}
        {section === "ideal" && (
          <IdealSection
            riders={riders}
            realTeams={realTeams}
            totals={totals}
            budget={budget}
            squadSize={squadSize}
            realTeamPicks={realTeamPicks}
            leaderPoints={standings[0]?.total ?? 0}
            myPoints={standings.find((s) => s.teamId === myTeamId)?.total ?? null}
          />
        )}
        {section === "buscador" && <SearchSection riders={riders} owners={owners} totals={totals.riders} />}
        {section === "participantes" && (
          <ParticipantSection
            standings={standings}
            rosters={rosters}
            doneStages={doneStages}
            ridersById={ridersById}
            teamsById={teamsById}
            myTeamId={myTeamId}
          />
        )}
        {section === "sorpresa" && <SurpriseSection riders={riders} totals={totals.riders} owners={owners} />}
        {section === "rentabilidad" && (
          <ValueSection riders={riders} totals={totals.riders} owners={owners} />
        )}
        {section === "var" && (
          <VarSection
            stages={doneStages}
            resultByStage={resultByStage}
            rosters={rosters}
            ridersById={ridersById}
            teamsById={teamsById}
            myTeamId={myTeamId}
          />
        )}
        {section === "sistema" && systemSlot}
      </div>
    </div>
  );
}

function Title({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-3">
      <h2 className="font-display text-sm uppercase tracking-wide text-verde-deep">{children}</h2>
      {hint && <p className="mt-1 text-sm text-text-soft">{hint}</p>}
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-line bg-surface p-6 text-center text-sm text-text-soft">{children}</p>;
}

// ── Ranking de corredores ───────────────────────────────────────────────
function RankingSection({
  riders,
  breakdown,
  owners,
}: {
  riders: Rider[];
  breakdown: Map<string, Record<string, number>>;
  owners: Map<string, unknown[]>;
}) {
  const [onlyOwned, setOnlyOwned] = useState(false);
  const rows = riders
    .map((r) => {
      const b = breakdown.get(r.id) ?? {};
      const total = Object.values(b).reduce((s, v) => s + v, 0);
      return { ...r, b, total, owners: owners.get(r.id)?.length ?? 0 };
    })
    .filter((r) => r.total > 0 && (!onlyOwned || r.owners > 0))
    .sort((a, b) => b.total - a.total);
  return (
    <div>
      <Title hint="Quién suma más con los criterios de la porra, sea de quien sea.">Ranking de corredores</Title>
      <label className="mb-2 flex items-center gap-2 text-xs text-text-soft">
        <input type="checkbox" checked={onlyOwned} onChange={(e) => setOnlyOwned(e.target.checked)} />
        Solo los que lleva alguien
      </label>
      {rows.length === 0 ? (
        <Empty>Todavía no ha puntuado nadie.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full text-sm">
            <thead className="text-xs text-text-soft">
              <tr className="border-b border-line">
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Corredor</th>
                <th className="px-2 py-2 text-right" title="Etapa">🚴</th>
                <th className="px-2 py-2 text-right" title="General">👑</th>
                <th className="px-2 py-2 text-right" title="Regularidad">🟢</th>
                <th className="px-2 py-2 text-right" title="Montaña">🔴</th>
                <th className="px-2 py-2 text-right" title="Bonus final">🏁</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-right" title="Participantes que lo llevan">👥</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r, i) => (
                <tr key={r.id}>
                  <td className="px-3 py-1.5 text-text-soft">{i + 1}</td>
                  <td className="px-3 py-1.5">
                    <div className="truncate">{r.name}</div>
                    <div className="truncate text-xs text-text-soft">
                      {r.team} · {r.price}
                    </div>
                  </td>
                  {["etapa", "general", "puntos", "montana", "bonus"].map((k) => (
                    <td key={k} className="px-2 py-1.5 text-right text-text-soft">
                      {r.b[k] ?? ""}
                    </td>
                  ))}
                  <td className="px-3 py-1.5 text-right font-display text-verde-deep">{r.total}</td>
                  <td className="px-3 py-1.5 text-right text-text-soft">{r.owners}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Equipo ideal ────────────────────────────────────────────────────────
function IdealSection({
  riders,
  realTeams,
  totals,
  budget,
  squadSize,
  realTeamPicks,
  leaderPoints,
  myPoints,
}: {
  riders: Rider[];
  realTeams: RealTeam[];
  totals: { riders: Map<string, number>; teams: Map<string, number> };
  budget: number;
  squadSize: number;
  realTeamPicks: number;
  leaderPoints: number;
  myPoints: number | null;
}) {
  const ideal = useMemo(
    () =>
      idealSquad(
        riders.map((r) => ({ id: r.id, price: r.price, points: totals.riders.get(r.id) ?? 0 })),
        budget,
        squadSize
      ),
    [riders, totals, budget, squadSize]
  );
  const bestTeams = realTeams
    .map((t) => ({ ...t, points: totals.teams.get(t.id) ?? 0 }))
    .filter((t) => t.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, realTeamPicks);
  const total = ideal.points + bestTeams.reduce((s, t) => s + t.points, 0);
  const chosen = ideal.ids
    .map((id) => riders.find((r) => r.id === id)!)
    .sort((a, b) => (totals.riders.get(b.id) ?? 0) - (totals.riders.get(a.id) ?? 0));

  if (total === 0) return <Empty>El equipo ideal sale en cuanto haya resultados.</Empty>;
  return (
    <div>
      <Title
        hint={`Los ${squadSize} corredores (sin pasar de ${budget}) y los ${realTeamPicks} equipos que más puntos habrían dado.`}
      >
        Equipo ideal · {total} pts
      </Title>
      <p className="mb-3 text-sm text-text-soft">
        El líder lleva el {Math.round((leaderPoints / total) * 100)}% del ideal
        {myPoints !== null ? `; tú, el ${Math.round((myPoints / total) * 100)}%` : ""}.
      </p>
      <div className="rounded-2xl border border-line bg-surface p-3">
        <ul className="divide-y divide-line">
          {chosen.map((r) => (
            <li key={r.id} className="flex items-center gap-2 py-1.5 text-sm">
              <span className="min-w-0 flex-1 truncate">🚴 {r.name}</span>
              <span className="shrink-0 text-xs text-text-soft">{r.price}</span>
              <span className="w-12 shrink-0 text-right font-display">{totals.riders.get(r.id)}</span>
            </li>
          ))}
          {bestTeams.map((t) => (
            <li key={t.id} className="flex items-center gap-2 py-1.5 text-sm">
              <span className="min-w-0 flex-1 truncate">🚩 {t.name}</span>
              <span className="w-12 shrink-0 text-right font-display">{t.points}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-right text-xs text-text-soft">
          Presupuesto usado: {ideal.cost} / {budget}
        </p>
      </div>
    </div>
  );
}

// ── ¿Quién tiene a…? ────────────────────────────────────────────────────
function SearchSection({
  riders,
  owners,
  totals,
}: {
  riders: Rider[];
  owners: Map<string, { teamName: string; ownerName: string; role: string }[]>;
  totals: Map<string, number>;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const matches = q.length >= 2 ? riders.filter((r) => r.name.toLowerCase().includes(q)).slice(0, 8) : [];
  return (
    <div>
      <Title hint="Escribe un corredor y descubre quién lo lleva.">¿Quién tiene a…?</Title>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Nombre del corredor…"
        className="w-full rounded-full border border-line bg-surface px-4 py-2.5 text-base outline-none focus:border-verde"
      />
      <div className="mt-3 flex flex-col gap-3">
        {matches.map((r) => {
          const list = owners.get(r.id) ?? [];
          return (
            <div key={r.id} className="rounded-2xl border border-line bg-surface p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold">{r.name}</span>
                <span className="text-xs text-text-soft">
                  {r.team} · {r.price} · {totals.get(r.id) ?? 0} pts
                </span>
              </div>
              {list.length === 0 ? (
                <p className="mt-1 text-sm text-text-soft">Nadie lo lleva.</p>
              ) : (
                <ul className="mt-1 text-sm">
                  {list.map((o, i) => (
                    <li key={i}>
                      {o.teamName} <span className="text-text-soft">({o.ownerName} · {o.role})</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Ficha de participante ───────────────────────────────────────────────
function ParticipantSection({
  standings,
  rosters,
  doneStages,
  ridersById,
  teamsById,
  myTeamId,
}: {
  standings: ReturnType<typeof computeStandings>;
  rosters: GtRoster[];
  doneStages: Stage[];
  ridersById: Map<string, Rider>;
  teamsById: Map<string, RealTeam>;
  myTeamId: string | null;
}) {
  const [teamId, setTeamId] = useState(
    myTeamId && standings.some((s) => s.teamId === myTeamId) ? myTeamId : standings[0]?.teamId ?? ""
  );
  const row = standings.find((s) => s.teamId === teamId);

  // Puesto en la general tras cada etapa (por el acumulado de ese día).
  const history = doneStages.map((stage) => {
    const ranked = standings
      .map((s) => ({ teamId: s.teamId, pts: s.byStage.find((b) => b.order === stage.order)?.cumulative ?? 0 }))
      .sort((a, b) => b.pts - a.pts);
    const idx = ranked.findIndex((r) => r.teamId === teamId);
    const day = row?.byStage.find((b) => b.order === stage.order)?.points ?? 0;
    return { order: stage.order, position: idx + 1, day };
  });
  const maxDay = Math.max(1, ...history.map((h) => h.day));

  if (standings.length === 0) return <Empty>Todavía no hay participantes con plantilla.</Empty>;
  return (
    <div>
      <Title>Ficha de participante</Title>
      <select
        value={teamId}
        onChange={(e) => setTeamId(e.target.value)}
        className="w-full rounded-full border border-line bg-surface px-4 py-2.5 text-base outline-none focus:border-verde"
      >
        {standings.map((s) => (
          <option key={s.teamId} value={s.teamId}>
            {s.position}º · {s.teamName} ({s.ownerName}) · {s.total} pts
          </option>
        ))}
      </select>
      {row && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-line bg-surface p-3">
            <h3 className="font-display text-xs uppercase tracking-wide text-verde-deep">Aporte de cada uno</h3>
            <ul className="mt-2 divide-y divide-line">
              {row.contributions.map((c) => (
                <li key={`${c.kind}:${c.id}`} className="flex items-center gap-2 py-1.5 text-sm">
                  <span className="min-w-0 flex-1 truncate">
                    {c.kind === "team" ? `🚩 ${teamsById.get(c.id)?.name ?? "—"}` : `🚴 ${ridersById.get(c.id)?.name ?? "—"}`}
                  </span>
                  <span className="w-12 shrink-0 text-right font-display">{c.points}</span>
                </li>
              ))}
            </ul>
            {row.bonus > 0 && <p className="mt-2 text-xs text-text-soft">Incluye {row.bonus} de bonus final.</p>}
          </div>
          <div className="rounded-2xl border border-line bg-surface p-3">
            <h3 className="font-display text-xs uppercase tracking-wide text-verde-deep">Etapa a etapa</h3>
            {history.length === 0 ? (
              <p className="mt-2 text-sm text-text-soft">Sin etapas puntuadas.</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1">
                {history.map((h) => (
                  <li key={h.order} className="flex items-center gap-2 text-xs">
                    <span className="w-8 shrink-0 text-text-soft">E{h.order}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--line)]">
                      <span className="block h-full rounded-full bg-[var(--accent)]" style={{ width: `${(h.day / maxDay) * 100}%` }} />
                    </span>
                    <span className="w-10 shrink-0 text-right font-display">{h.day}</span>
                    <span className="w-10 shrink-0 text-right text-text-soft">{h.position}º</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
      {rosters.length === 0 && null}
    </div>
  );
}

// ── Sorpresa ────────────────────────────────────────────────────────────
function SurpriseSection({
  riders,
  totals,
  owners,
}: {
  riders: Rider[];
  totals: Map<string, number>;
  owners: Map<string, unknown[]>;
}) {
  const rows = riders
    .filter((r) => (totals.get(r.id) ?? 0) > 0 && !owners.has(r.id))
    .sort((a, b) => (totals.get(b.id) ?? 0) - (totals.get(a.id) ?? 0))
    .slice(0, 10);
  return (
    <div>
      <Title hint="Corredores que han sumado puntos pero que nadie lleva: puntos sin dueño.">
        Top 10 sorpresa
      </Title>
      {rows.length === 0 ? (
        <Empty>Ninguna sorpresa todavía.</Empty>
      ) : (
        <SimpleList rows={rows.map((r) => ({ id: r.id, title: r.name, sub: `${r.team ?? ""} · ${r.price}`, value: totals.get(r.id) ?? 0 }))} />
      )}
    </div>
  );
}

// ── Rentabilidad ────────────────────────────────────────────────────────
function ValueSection({
  riders,
  totals,
  owners,
}: {
  riders: Rider[];
  totals: Map<string, number>;
  owners: Map<string, unknown[]>;
}) {
  const [onlyOwned, setOnlyOwned] = useState(false);
  const rows = riders
    .filter((r) => r.price > 0 && (totals.get(r.id) ?? 0) > 0 && (!onlyOwned || owners.has(r.id)))
    .map((r) => ({ ...r, points: totals.get(r.id) ?? 0, ratio: (totals.get(r.id) ?? 0) / r.price }))
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 25);
  return (
    <div>
      <Title hint="Puntos conseguidos por cada punto de precio.">Rentabilidad</Title>
      <label className="mb-2 flex items-center gap-2 text-xs text-text-soft">
        <input type="checkbox" checked={onlyOwned} onChange={(e) => setOnlyOwned(e.target.checked)} />
        Solo los que lleva alguien
      </label>
      {rows.length === 0 ? (
        <Empty>Todavía no ha puntuado nadie.</Empty>
      ) : (
        <SimpleList
          rows={rows.map((r) => ({
            id: r.id,
            title: r.name,
            sub: `${r.points} pts · precio ${r.price}`,
            value: r.ratio.toLocaleString("es-ES", { maximumFractionDigits: 2 }),
          }))}
        />
      )}
    </div>
  );
}

function SimpleList({ rows }: { rows: { id: string; title: string; sub: string; value: ReactNode }[] }) {
  return (
    <ol className="divide-y divide-line rounded-2xl border border-line bg-surface">
      {rows.map((r, i) => (
        <li key={r.id} className="flex items-center gap-3 px-3 py-2 text-sm">
          <span className="w-6 shrink-0 text-right font-display text-xs text-text-soft">{i + 1}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate">{r.title}</span>
            <span className="block truncate text-xs text-text-soft">{r.sub}</span>
          </span>
          <span className="shrink-0 font-display text-verde-deep">{r.value}</span>
        </li>
      ))}
    </ol>
  );
}

// ── VAR ─────────────────────────────────────────────────────────────────
function VarSection({
  stages,
  resultByStage,
  rosters,
  ridersById,
  teamsById,
  myTeamId,
}: {
  stages: Stage[];
  resultByStage: Map<string, GtStageResult>;
  rosters: GtRoster[];
  ridersById: Map<string, Rider>;
  teamsById: Map<string, RealTeam>;
  myTeamId: string | null;
}) {
  const [stageId, setStageId] = useState(stages[stages.length - 1]?.id ?? "");
  const [teamId, setTeamId] = useState(
    myTeamId && rosters.some((r) => r.teamId === myTeamId) ? myTeamId : rosters[0]?.teamId ?? ""
  );
  const stage = stages.find((s) => s.id === stageId);
  const roster = rosters.find((r) => r.teamId === teamId);
  const result = stage ? resultByStage.get(stage.id) : undefined;

  if (stages.length === 0 || rosters.length === 0) {
    return <Empty>El VAR se activa en cuanto haya etapas con resultados.</Empty>;
  }

  const isLast = stage && stage.order === stages[stages.length - 1].order;
  const kinds: ListKind[] = isLast ? [...STAGE_LIST_KINDS, ...FINAL_LIST_KINDS] : STAGE_LIST_KINDS;
  const active = roster && stage ? new Set(activeRidersAt(roster, stage.order)) : new Set<string>();
  const teams = new Set(roster?.realTeams ?? []);
  const lines: { kind: ListKind; position: number; name: string; points: number }[] = [];
  for (const kind of kinds) {
    for (const e of result?.lists[kind] ?? []) {
      const id = isTeamList(kind) ? e.teamId : e.riderId;
      if (!id) continue;
      if (isTeamList(kind) ? !teams.has(id) : !active.has(id)) continue;
      const pts = pointsAt(kind, e.position);
      if (pts) lines.push({ kind, position: e.position, name: e.name, points: pts });
    }
  }
  const total = lines.reduce((s, l) => s + l.points, 0);

  return (
    <div>
      <Title hint="De dónde sale cada punto de un participante en una etapa.">VAR</Title>
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          value={stageId}
          onChange={(e) => setStageId(e.target.value)}
          className="rounded-full border border-line bg-surface px-4 py-2.5 text-base outline-none focus:border-verde"
        >
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              Etapa {s.order} · {s.label}
            </option>
          ))}
        </select>
        <select
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
          className="min-w-0 flex-1 rounded-full border border-line bg-surface px-4 py-2.5 text-base outline-none focus:border-verde"
        >
          {rosters.map((r) => (
            <option key={r.teamId} value={r.teamId}>
              {r.teamName} ({r.ownerName})
            </option>
          ))}
        </select>
      </div>
      <div className="mt-3 rounded-2xl border border-line bg-surface p-3">
        {lines.length === 0 ? (
          <p className="text-sm text-text-soft">No sumó nada en esta etapa.</p>
        ) : (
          <ul className="divide-y divide-line">
            {lines.map((l, i) => (
              <li key={i} className="flex items-center gap-2 py-1.5 text-sm">
                <span className="w-6 shrink-0">{LIST_ICON[l.kind]}</span>
                <span className="min-w-0 flex-1 truncate">
                  {l.name} <span className="text-xs text-text-soft">· {l.position}º en {LIST_LABEL[l.kind]}</span>
                </span>
                <span className="w-12 shrink-0 text-right font-display">+{l.points}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-right font-display text-verde-deep">Total: {total}</p>
        {roster && stage && (
          <p className="mt-1 text-xs text-text-soft">
            Corredores que contaban en esa etapa:{" "}
            {Array.from(active)
              .map((id) => ridersById.get(id)?.name)
              .filter(Boolean)
              .join(", ") || "ninguno"}
            {roster.realTeams.length > 0 &&
              ` · equipos: ${roster.realTeams.map((id) => teamsById.get(id)?.name).filter(Boolean).join(", ")}`}
          </p>
        )}
      </div>
    </div>
  );
}
