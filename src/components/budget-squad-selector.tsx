"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import Spinner from "@/components/spinner";
import { FlagIcon } from "@/components/country-flag";
import { priceTone, teamColor } from "@/lib/cycling-teams";

// Selector de plantilla de una gran vuelta: titulares dentro del
// presupuesto, suplentes fuera de él y equipos ciclistas sin coste. Va
// haciendo las cuentas en vivo (gastado, restante, cuántos faltan y media
// por hueco) para que se vea al momento si la plantilla cabe. Los
// corredores se ven por equipos (con el color de su maillot) o por precio,
// con bandera y filtros de precio.
export type BudgetRider = {
  id: string;
  name: string;
  team: string | null;
  nationality: string | null;
  price: number;
};

export type BudgetRealTeam = { id: string; name: string };

type Slot = "starter" | "bench";
type View = "teams" | "price";

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
  const [minPrice, setMinPrice] = useState<number | null>(null);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [onlyAffordable, setOnlyAffordable] = useState(false);
  const [view, setView] = useState<View>("teams");
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
    return riders.filter((r) => {
      if (teamFilter && r.team !== teamFilter) return false;
      if (minPrice !== null && r.price < minPrice) return false;
      if (maxPrice !== null && r.price > maxPrice) return false;
      if (onlyAffordable && !starters.includes(r.id) && r.price > remaining) return false;
      if (!q) return true;
      return r.name.toLowerCase().includes(q) || (r.team ?? "").toLowerCase().includes(q);
    });
  }, [riders, query, teamFilter, minPrice, maxPrice, onlyAffordable, starters, remaining]);

  // Bloques a pintar: por equipo (ordenados por nombre, corredores de más a
  // menos caro) o por escalón de precio (de más caro a más barato).
  const groups = useMemo(() => {
    const map = new Map<string, BudgetRider[]>();
    for (const r of filtered) {
      const key = view === "teams" ? r.team ?? "Sin equipo" : String(r.price);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    for (const list of map.values()) {
      list.sort((a, b) => b.price - a.price || a.name.localeCompare(b.name));
    }
    return Array.from(map.entries()).sort((a, b) =>
      view === "teams" ? a[0].localeCompare(b[0]) : Number(b[0]) - Number(a[0])
    );
  }, [filtered, view]);

  const activeFilters =
    (teamFilter ? 1 : 0) + (minPrice !== null ? 1 : 0) + (maxPrice !== null ? 1 : 0) + (onlyAffordable ? 1 : 0);

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

  function quickPrice(p: number) {
    // Un toque = solo ese escalón; otro toque en el mismo = quitar filtro.
    if (minPrice === p && maxPrice === p) {
      setMinPrice(null);
      setMaxPrice(null);
    } else {
      setMinPrice(p);
      setMaxPrice(p);
    }
  }

  function clearFilters() {
    setTeamFilter("");
    setMinPrice(null);
    setMaxPrice(null);
    setOnlyAffordable(false);
    setQuery("");
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
      {/* Ventanita flotante con las cuentas en cuanto se empieza a elegir. */}
      {(starters.length > 0 || bench.length > 0 || teams.length > 0 || dirty) && (
        <FloatingTally
          starters={starters.length}
          squadSize={squadSize}
          bench={bench.length}
          benchSize={benchSize}
          teams={teams.length}
          realTeamPicks={realTeamPicks}
          spent={spent}
          remaining={remaining}
          average={average}
          budget={budget}
          dirty={dirty}
          saving={isPending}
          onSave={save}
        />
      )}

      {/* Marcador de presupuesto. */}
      <div className="rounded-2xl border border-line bg-surface px-4 pb-3 pt-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="font-display text-lg text-verde-deep">
            {spent.toLocaleString("es-ES")}
            <span className="text-sm text-text-soft"> / {budget.toLocaleString("es-ES")} pts</span>
          </div>
          <div className={`text-sm font-semibold ${remaining < 0 ? "text-rosa" : "text-text"}`}>
            {remaining < 0 ? `Te pasas ${-remaining}` : `Quedan ${remaining}`}
            {missing > 0 && remaining >= 0 && (
              <span className="font-normal text-text-soft"> · {average} de media</span>
            )}
          </div>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[var(--line)]">
          <div
            className={`h-full rounded-full transition-all ${remaining < 0 ? "bg-rosa" : "bg-[var(--accent)]"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
          <Counter label="Titulares" value={starters.length} max={squadSize} />
          {benchSize > 0 && <Counter label="Suplentes" value={bench.length} max={benchSize} />}
          {realTeamPicks > 0 && <Counter label="Equipos" value={teams.length} max={realTeamPicks} />}
          <button
            type="button"
            onClick={save}
            disabled={isPending || remaining < 0 || !dirty}
            className="ml-auto rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-on-accent hover:brightness-110 disabled:opacity-40"
          >
            {isPending ? (
              <>
                <Spinner />
                Guardando…
              </>
            ) : dirty ? (
              "Guardar"
            ) : (
              "Guardada ✓"
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
          title={`Titulares ${starters.length}/${squadSize}`}
          ids={starters}
          ridersById={ridersById}
          onRemove={remove}
          empty="Añade corredores desde la lista de abajo."
        />
        {benchSize > 0 && (
          <PickedList
            title={`Suplentes ${bench.length}/${benchSize} · fuera del presupuesto`}
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
            Equipos ciclistas {teams.length}/{realTeamPicks} · sin coste
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
                  className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition ${
                    on
                      ? "border-[var(--accent)] bg-[var(--accent)] font-semibold text-on-accent"
                      : full
                      ? "border-line opacity-40"
                      : "border-line bg-surface hover:border-[var(--accent)]"
                  }`}
                >
                  <span className="h-3 w-3 shrink-0 rounded-full ring-1 ring-white/30" style={{ background: teamColor(t.name) }} />
                  {t.name}
                  {on && " ✓"}
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

      {/* Buscador, filtros y lista de corredores. */}
      <section className="mt-8">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-sm uppercase tracking-wide text-verde-deep">
            Corredores <span className="text-text-soft">({filtered.length})</span>
          </h3>
          <div className="flex rounded-full border border-line bg-surface p-0.5 text-xs font-semibold">
            <ViewButton active={view === "teams"} onClick={() => setView("teams")}>
              Por equipos
            </ViewButton>
            <ViewButton active={view === "price"} onClick={() => setView("price")}>
              Por precio
            </ViewButton>
          </div>
        </div>

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar corredor o equipo…"
          className="mt-3 w-full rounded-2xl border border-line bg-surface px-4 py-3 text-base outline-none focus:border-[var(--accent)]"
        />

        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="col-span-2 rounded-2xl border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)] sm:col-span-2"
          >
            <option value="">Todos los equipos</option>
            {cyclingTeams.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <PriceSelect label="Desde" value={minPrice} prices={prices} onChange={setMinPrice} />
          <PriceSelect label="Hasta" value={maxPrice} prices={prices} onChange={setMaxPrice} />
        </div>

        <div className="-mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {prices.map((p) => {
            const tone = priceTone(p);
            const on = minPrice === p && maxPrice === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => quickPrice(p)}
                className={`shrink-0 rounded-full px-3 py-1.5 font-display text-sm transition ${
                  on ? "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg)]" : "opacity-80 hover:opacity-100"
                }`}
                style={{ background: tone.bg, color: tone.fg }}
              >
                {p}
              </button>
            );
          })}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          <label className="flex items-center gap-2 text-sm text-text-soft">
            <input
              type="checkbox"
              checked={onlyAffordable}
              onChange={(e) => setOnlyAffordable(e.target.checked)}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            Solo los que me caben ({Math.max(remaining, 0)})
          </label>
          {(activeFilters > 0 || query) && (
            <button type="button" onClick={clearFilters} className="text-sm text-[var(--accent)] underline-offset-2 hover:underline">
              Quitar filtros
            </button>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-4">
          {groups.map(([key, list]) => {
            const chosen = list.filter((r) => starters.includes(r.id) || bench.includes(r.id)).length;
            const color = view === "teams" ? teamColor(key) : priceTone(Number(key)).bg;
            return (
              <section
                key={key}
                className="overflow-hidden rounded-2xl border border-line bg-surface"
                style={{ borderLeft: `5px solid ${color}` }}
              >
                <header className="flex items-center justify-between gap-2 border-b border-line px-3.5 py-2.5">
                  <h4 className="min-w-0 truncate font-display text-sm uppercase tracking-wide text-text">
                    {view === "teams" ? key : `${key} puntos`}
                  </h4>
                  <span className="shrink-0 text-xs text-text-soft">
                    {chosen > 0 && <span className="mr-2 font-semibold text-[var(--accent)]">{chosen} elegidos</span>}
                    {list.length}
                  </span>
                </header>
                <ul className="divide-y divide-line">
                  {list.map((rider) => (
                    <RiderRow
                      key={rider.id}
                      rider={rider}
                      showTeam={view === "price"}
                      isStarter={starters.includes(rider.id)}
                      isBench={bench.includes(rider.id)}
                      startersFull={starters.length >= squadSize}
                      benchFull={bench.length >= benchSize}
                      benchEnabled={benchSize > 0}
                      tooExpensive={rider.price > remaining}
                      onAdd={add}
                      onRemove={remove}
                    />
                  ))}
                </ul>
              </section>
            );
          })}
          {groups.length === 0 && (
            <p className="rounded-2xl border border-dashed border-line bg-surface p-6 text-center text-sm text-text-soft">
              {riders.length === 0
                ? "Todavía no están cargados los corredores ni sus precios."
                : "No hay corredores que coincidan con los filtros."}
            </p>
          )}
        </div>
      </section>
      {/* Hueco para que la ventanita flotante no tape el último corredor. */}
      <div className="h-24" aria-hidden="true" />
    </div>
  );
}

function RiderRow({
  rider,
  showTeam,
  isStarter,
  isBench,
  startersFull,
  benchFull,
  benchEnabled,
  tooExpensive,
  onAdd,
  onRemove,
}: {
  rider: BudgetRider;
  showTeam: boolean;
  isStarter: boolean;
  isBench: boolean;
  startersFull: boolean;
  benchFull: boolean;
  benchEnabled: boolean;
  tooExpensive: boolean;
  onAdd: (r: BudgetRider, slot: Slot) => void;
  onRemove: (id: string) => void;
}) {
  const tone = priceTone(rider.price);
  const picked = isStarter || isBench;
  // T = titular, S = suplente: dos botones redondos pequeños para que el
  // nombre (y la bandera) tengan sitio en el móvil. Elegido, el suyo se
  // rellena y otro toque lo quita.
  return (
    <li className={`flex items-center gap-2.5 py-2 pl-3 pr-2 ${picked ? "bg-[var(--accent)]/10" : ""}`}>
      <FlagIcon iso={rider.nationality} className="text-[15px]" />
      <div className="min-w-0 flex-1">
        <div className={`truncate text-[15px] leading-tight ${picked ? "font-semibold" : ""}`}>{rider.name}</div>
        {showTeam && rider.team && (
          <div className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-text-soft">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: teamColor(rider.team) }} />
            {rider.team}
          </div>
        )}
      </div>
      <span
        className="shrink-0 rounded-lg px-1.5 py-0.5 font-display text-sm tabular-nums"
        style={{ background: tone.bg, color: tone.fg }}
      >
        {rider.price}
      </span>
      <SlotButton
        letter="T"
        label={isStarter ? `Quitar a ${rider.name} de titulares` : `${rider.name} titular`}
        on={isStarter}
        disabled={!isStarter && (startersFull || tooExpensive)}
        title={!isStarter && tooExpensive ? "No te llega el presupuesto" : !isStarter && startersFull ? "Ya tienes los titulares" : "Titular"}
        onClick={() => (isStarter ? onRemove(rider.id) : onAdd(rider, "starter"))}
      />
      {benchEnabled && (
        <SlotButton
          letter="S"
          label={isBench ? `Quitar a ${rider.name} de suplentes` : `${rider.name} suplente`}
          on={isBench}
          disabled={!isBench && benchFull}
          title={!isBench && benchFull ? "Ya tienes los suplentes" : "Suplente"}
          onClick={() => (isBench ? onRemove(rider.id) : onAdd(rider, "bench"))}
          secondary
        />
      )}
    </li>
  );
}

// Tarjeta flotante con las cuentas de la plantilla: en el móvil, justo
// encima de la barra de pestañas (y de la rayita del iPhone); en el
// ordenador, abajo a la derecha. Lleva también el botón de guardar.
function FloatingTally({
  starters,
  squadSize,
  bench,
  benchSize,
  teams,
  realTeamPicks,
  spent,
  remaining,
  average,
  budget,
  dirty,
  saving,
  onSave,
}: {
  starters: number;
  squadSize: number;
  bench: number;
  benchSize: number;
  teams: number;
  realTeamPicks: number;
  spent: number;
  remaining: number;
  average: number;
  budget: number;
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
}) {
  const over = remaining < 0;
  const missing = squadSize - starters;
  return (
    <div className="fixed inset-x-3 bottom-[calc(max(env(safe-area-inset-bottom),10px)+80px)] z-30 mx-auto max-w-md rounded-2xl border border-line bg-surface/95 px-3.5 py-2.5 shadow-[0_8px_30px_rgba(0,0,0,0.45)] backdrop-blur sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[340px]">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-lg leading-none text-text">
              {starters}/{squadSize}
            </span>
            <span className="truncate text-xs text-text-soft">
              {missing > 0 ? `titulares · faltan ${missing}` : "titulares ✓"}
              {benchSize > 0 && ` · S ${bench}/${benchSize}`}
              {realTeamPicks > 0 && ` · Eq ${teams}/${realTeamPicks}`}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--line)]">
            <div
              className={`h-full rounded-full transition-all ${over ? "bg-rosa" : "bg-[var(--accent)]"}`}
              style={{ width: `${Math.min(100, Math.round((spent / budget) * 100))}%` }}
            />
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-2 text-xs tabular-nums">
            <span className="text-text-soft">
              Gastado <b className="text-text">{spent}</b>
            </span>
            <span className={over ? "font-semibold text-rosa" : "text-text-soft"}>
              {over ? (
                `Te pasas ${-remaining}`
              ) : (
                <>
                  Quedan <b className="text-text">{remaining}</b>
                  {missing > 0 && ` · ${average}/corr.`}
                </>
              )}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || over || !dirty}
          className="h-11 shrink-0 rounded-xl bg-[var(--accent)] px-3.5 text-sm font-semibold text-on-accent hover:brightness-110 disabled:opacity-40"
        >
          {saving ? <Spinner /> : dirty ? "Guardar" : "✓"}
        </button>
      </div>
    </div>
  );
}

function SlotButton({
  letter,
  label,
  title,
  on,
  disabled,
  onClick,
  secondary = false,
}: {
  letter: string;
  label: string;
  title: string;
  on: boolean;
  disabled: boolean;
  onClick: () => void;
  secondary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={on}
      title={title}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 font-display text-sm transition ${
        on
          ? "border-[var(--accent)] bg-[var(--accent)] text-on-accent"
          : secondary
          ? "border-line text-text-soft hover:border-[var(--accent)] hover:text-text"
          : "border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-on-accent"
      } disabled:border-line disabled:bg-transparent disabled:text-text-soft disabled:opacity-30`}
    >
      {letter}
    </button>
  );
}

function PriceSelect({
  label,
  value,
  prices,
  onChange,
}: {
  label: string;
  value: number | null;
  prices: number[];
  onChange: (v: number | null) => void;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      aria-label={`Precio ${label.toLowerCase()}`}
      className="rounded-2xl border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
    >
      <option value="">{label}: cualquiera</option>
      {[...prices].sort((a, b) => a - b).map((p) => (
        <option key={p} value={p}>
          {label} {p}
        </option>
      ))}
    </select>
  );
}

function ViewButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-3 py-1.5 transition ${
        active ? "bg-[var(--accent)] text-on-accent" : "text-text-soft hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

function sameSet(a: string[], b: string[]) {
  return a.length === b.length && a.every((x) => b.includes(x));
}

function Counter({ label, value, max }: { label: string; value: number; max: number }) {
  const done = value === max;
  return (
    <span
      className={`rounded-full px-3 py-1 font-semibold ${
        done ? "bg-verde-deep text-on-accent" : "border border-line text-text-soft"
      }`}
    >
      {label} {value}/{max}
    </span>
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
                <FlagIcon iso={r.nationality} />
                <span className="min-w-0 flex-1 truncate">{r.name}</span>
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: teamColor(r.team) }} title={r.team ?? undefined} />
                <span className="w-9 shrink-0 text-right text-xs tabular-nums text-text-soft">{r.price}</span>
                <button
                  type="button"
                  onClick={() => onRemove(r.id)}
                  aria-label={`Quitar a ${r.name}`}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-text-soft hover:bg-surface-2 hover:text-rosa"
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
