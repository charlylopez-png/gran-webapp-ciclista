"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import Spinner from "@/components/spinner";

// Selector de plantilla de una gran vuelta: titulares dentro del
// presupuesto, suplentes fuera de él y equipos ciclistas sin coste. Va
// haciendo las cuentas en vivo (gastado, restante, cuántos faltan y media
// por hueco) para que se vea al momento si la plantilla cabe.
export type BudgetRider = {
  id: string;
  name: string;
  team: string | null;
  price: number;
};

export type BudgetRealTeam = { id: string; name: string };

type Slot = "starter" | "bench";

export default function BudgetSquadSelector({
  riders,
  realTeams,
  initialStarters,
  initialBench,
  initialRealTeams,
  budget,
  squadSize,
  benchSize,
  realTeamPicks,
  saveUrl,
}: {
  riders: BudgetRider[];
  realTeams: BudgetRealTeam[];
  initialStarters: string[];
  initialBench: string[];
  initialRealTeams: string[];
  budget: number;
  squadSize: number;
  benchSize: number;
  realTeamPicks: number;
  saveUrl: string;
}) {
  const router = useRouter();
  const [starters, setStarters] = useState<string[]>(initialStarters);
  const [bench, setBench] = useState<string[]>(initialBench);
  const [teams, setTeams] = useState<string[]>(initialRealTeams);
  const [query, setQuery] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [priceFilter, setPriceFilter] = useState<number | null>(null);
  const [sort, setSort] = useState<"price" | "name" | "team">("price");
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const ridersById = useMemo(() => new Map(riders.map((r) => [r.id, r])), [riders]);
  const teamsById = useMemo(() => new Map(realTeams.map((t) => [t.id, t])), [realTeams]);
  const prices = useMemo(
    () => Array.from(new Set(riders.map((r) => r.price))).sort((a, b) => b - a),
    [riders]
  );
  const cyclingTeams = useMemo(
    () => Array.from(new Set(riders.map((r) => r.team).filter((t): t is string => Boolean(t)))).sort(),
    [riders]
  );

  const spent = starters.reduce((s, id) => s + (ridersById.get(id)?.price ?? 0), 0);
  const remaining = budget - spent;
  const missing = squadSize - starters.length;
  const average = missing > 0 ? Math.floor(remaining / missing) : 0;
  const complete =
    starters.length === squadSize && bench.length === benchSize && teams.length === realTeamPicks;
  const dirty =
    !sameSet(starters, initialStarters) ||
    !sameSet(bench, initialBench) ||
    !sameSet(teams, initialRealTeams);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = riders.filter((r) => {
      if (teamFilter && r.team !== teamFilter) return false;
      if (priceFilter !== null && r.price !== priceFilter) return false;
      if (!q) return true;
      return r.name.toLowerCase().includes(q) || (r.team ?? "").toLowerCase().includes(q);
    });
    return list.sort((a, b) => {
      if (sort === "price") return b.price - a.price || a.name.localeCompare(b.name);
      if (sort === "team") return (a.team ?? "").localeCompare(b.team ?? "") || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name);
    });
  }, [riders, query, teamFilter, priceFilter, sort]);

  function add(rider: BudgetRider, slot: Slot) {
    setFeedback(null);
    if (slot === "starter") {
      setBench((b) => b.filter((id) => id !== rider.id));
      setStarters((s) => (s.includes(rider.id) ? s : [...s, rider.id]));
    } else {
      setStarters((s) => s.filter((id) => id !== rider.id));
      setBench((b) => (b.includes(rider.id) ? b : [...b, rider.id]));
    }
  }

  function remove(id: string) {
    setFeedback(null);
    setStarters((s) => s.filter((x) => x !== id));
    setBench((b) => b.filter((x) => x !== id));
  }

  function toggleTeam(id: string) {
    setFeedback(null);
    setTeams((t) => (t.includes(id) ? t.filter((x) => x !== id) : t.length < realTeamPicks ? [...t, id] : t));
  }

  function save() {
    setFeedback(null);
    startTransition(async () => {
      const res = await fetch(saveUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ starters, bench, realTeams: teams }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setFeedback({ type: "error", text: data?.error ?? "No se pudo guardar." });
        return;
      }
      setFeedback({
        type: "ok",
        text: complete ? "Plantilla guardada." : "Guardada, pero todavía está incompleta.",
      });
      router.refresh();
    });
  }

  const pct = Math.min(100, Math.round((spent / budget) * 100));

  return (
    <div>
      {/* Marcador de presupuesto: siempre a la vista mientras se ficha. */}
      <div className="sticky top-0 z-10 -mx-4 rounded-b-2xl bg-surface px-4 pb-3 pt-2 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="font-display text-sm uppercase tracking-wide text-verde-deep">
            {spent.toLocaleString("es-ES")} / {budget.toLocaleString("es-ES")} pts
          </div>
          <div className={`text-sm font-semibold ${remaining < 0 ? "text-rosa" : "text-text"}`}>
            {remaining < 0 ? `Te pasas ${-remaining}` : `Quedan ${remaining}`}
            {missing > 0 && remaining >= 0 && (
              <span className="font-normal text-text-soft"> · {average} de media por corredor</span>
            )}
          </div>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--line)]">
          <div
            className={`h-full rounded-full ${remaining < 0 ? "bg-rosa" : "bg-[var(--accent)]"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <Counter label="Titulares" value={starters.length} max={squadSize} />
          {benchSize > 0 && <Counter label="Suplentes" value={bench.length} max={benchSize} />}
          {realTeamPicks > 0 && <Counter label="Equipos" value={teams.length} max={realTeamPicks} />}
          <button
            type="button"
            onClick={save}
            disabled={isPending || remaining < 0 || !dirty}
            className="ml-auto rounded-full bg-[var(--accent)] px-4 py-2 font-display text-xs uppercase tracking-wide text-on-accent hover:brightness-110 disabled:opacity-40"
          >
            {isPending ? (
              <>
                <Spinner />
                Guardando…
              </>
            ) : dirty ? (
              "Guardar plantilla"
            ) : (
              "Guardada"
            )}
          </button>
        </div>
        {feedback && (
          <p className={`mt-2 text-sm ${feedback.type === "ok" ? "text-verde-deep" : "text-rosa"}`}>
            {feedback.text}
          </p>
        )}
      </div>

      {/* Lo elegido hasta ahora. */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <PickedList
          title={`Titulares (${starters.length}/${squadSize})`}
          ids={starters}
          ridersById={ridersById}
          onRemove={remove}
          empty="Añade corredores desde la lista de abajo."
        />
        {benchSize > 0 && (
          <PickedList
            title={`Suplentes (${bench.length}/${benchSize}) · fuera del presupuesto`}
            ids={bench}
            ridersById={ridersById}
            onRemove={remove}
            empty="Solo entran por caída o enfermedad de un titular, y tienen que valer menos que él."
          />
        )}
      </div>

      {realTeamPicks > 0 && (
        <section className="mt-6">
          <h3 className="font-display text-sm uppercase tracking-wide text-verde-deep">
            Equipos ciclistas ({teams.length}/{realTeamPicks}) · sin coste
          </h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {realTeams.map((t) => {
              const on = teams.includes(t.id);
              const full = !on && teams.length >= realTeamPicks;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTeam(t.id)}
                  disabled={full}
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${
                    on
                      ? "border-verde-deep bg-verde-deep text-on-accent"
                      : full
                      ? "border-line opacity-40"
                      : "border-line bg-surface hover:border-verde-deep/50"
                  }`}
                >
                  {on ? "✓ " : ""}
                  {t.name}
                </button>
              );
            })}
            {realTeams.length === 0 && (
              <p className="text-sm text-text-soft">Todavía no están cargados los equipos.</p>
            )}
          </div>
          {teams.length > 0 && (
            <p className="mt-1 text-xs text-text-soft">
              {teams.map((id) => teamsById.get(id)?.name).filter(Boolean).join(" · ")}
            </p>
          )}
        </section>
      )}

      {/* Buscador y lista de corredores. */}
      <section className="mt-8">
        <h3 className="font-display text-sm uppercase tracking-wide text-verde-deep">Corredores</h3>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar corredor o equipo…"
            className="w-full rounded-full border border-line bg-surface px-4 py-2.5 text-base outline-none focus:border-verde"
          />
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="rounded-full border border-line bg-surface px-4 py-2.5 text-base outline-none focus:border-verde"
          >
            <option value="">Todos los equipos</option>
            {cyclingTeams.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="rounded-full border border-line bg-surface px-4 py-2.5 text-base outline-none focus:border-verde"
          >
            <option value="price">Más caros primero</option>
            <option value="name">Por nombre</option>
            <option value="team">Por equipo</option>
          </select>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-text-soft">Precio:</span>
          <Chip on={priceFilter === null} onClick={() => setPriceFilter(null)}>
            Todos
          </Chip>
          {prices.map((p) => (
            <Chip key={p} on={priceFilter === p} onClick={() => setPriceFilter(priceFilter === p ? null : p)}>
              {p}
            </Chip>
          ))}
        </div>

        <div className="mt-3 flex flex-col gap-1.5">
          {filtered.map((rider) => {
            const isStarter = starters.includes(rider.id);
            const isBench = bench.includes(rider.id);
            const startersFull = !isStarter && starters.length >= squadSize;
            const tooExpensive = !isStarter && rider.price > remaining;
            const benchFull = !isBench && bench.length >= benchSize;
            return (
              <div
                key={rider.id}
                className={`flex items-center gap-3 rounded-xl border px-3.5 py-2 ${
                  isStarter || isBench ? "border-verde-deep bg-verde-deep/10" : "border-line bg-surface"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base">{rider.name}</div>
                  <div className="truncate text-xs text-text-soft">{rider.team ?? "Sin equipo"}</div>
                </div>
                <span className="shrink-0 rounded-full bg-[var(--pill-bg)] px-2.5 py-1 font-display text-xs text-[var(--pill-text)]">
                  {rider.price}
                </span>
                {isStarter || isBench ? (
                  <button
                    type="button"
                    onClick={() => remove(rider.id)}
                    className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs text-text-soft hover:border-rosa hover:text-rosa"
                  >
                    {isStarter ? "Titular ✕" : "Suplente ✕"}
                  </button>
                ) : (
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => add(rider, "starter")}
                      disabled={startersFull || tooExpensive}
                      title={tooExpensive ? "No te llega el presupuesto" : undefined}
                      className="rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs text-on-accent hover:brightness-110 disabled:opacity-30"
                    >
                      + Titular
                    </button>
                    {benchSize > 0 && (
                      <button
                        type="button"
                        onClick={() => add(rider, "bench")}
                        disabled={benchFull}
                        className="rounded-full border border-line px-3 py-1.5 text-xs hover:border-verde-deep/50 disabled:opacity-30"
                      >
                        + Suplente
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-sm text-text-soft">
              {riders.length === 0
                ? "Todavía no están cargados los corredores ni sus precios."
                : "No hay corredores que coincidan."}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function sameSet(a: string[], b: string[]) {
  return a.length === b.length && a.every((x) => b.includes(x));
}

function Counter({ label, value, max }: { label: string; value: number; max: number }) {
  const done = value === max;
  return (
    <span
      className={`rounded-full px-3 py-1 font-display uppercase tracking-wide ${
        done ? "bg-verde-deep text-on-accent" : "border border-line text-text-soft"
      }`}
    >
      {label} {value}/{max}
    </span>
  );
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 font-display text-xs ${
        on ? "border-verde-deep bg-verde-deep text-on-accent" : "border-line bg-surface text-text-soft"
      }`}
    >
      {children}
    </button>
  );
}

function PickedList({
  title,
  ids,
  ridersById,
  onRemove,
  empty,
}: {
  title: string;
  ids: string[];
  ridersById: Map<string, BudgetRider>;
  onRemove: (id: string) => void;
  empty: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-3">
      <h3 className="font-display text-xs uppercase tracking-wide text-verde-deep">{title}</h3>
      {ids.length === 0 ? (
        <p className="mt-2 text-xs text-text-soft">{empty}</p>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {ids
            .map((id) => ridersById.get(id))
            .filter((r): r is BudgetRider => Boolean(r))
            .sort((a, b) => b.price - a.price)
            .map((r) => (
              <li key={r.id} className="flex items-center gap-2 py-1.5 text-sm">
                <span className="min-w-0 flex-1 truncate">{r.name}</span>
                <span className="shrink-0 text-xs text-text-soft">{r.price}</span>
                <button
                  type="button"
                  onClick={() => onRemove(r.id)}
                  aria-label={`Quitar a ${r.name}`}
                  className="shrink-0 px-1 text-text-soft hover:text-rosa"
                >
                  ×
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
