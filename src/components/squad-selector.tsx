"use client";

import { useMemo, useState, useTransition } from "react";
import {
  CATEGORY_LABEL,
  squadCounts,
  squadSizeOf,
  type RiderCategory,
  type SquadComposition,
} from "@/lib/competitions";
import CountryFlag from "./country-flag";

// Selector de plantilla genérico: lo usa cualquier competición
// squad_color (Clásicas, Mundial, y las que se añadan). Antes había dos
// copias casi idénticas de este componente — una para clásicas agrupada
// por equipo ciclista, otra para el Mundial agrupada por país con
// nombre de equipo editable y bloqueo — ahora es una sola, parametrizada.
export type SelectableRider = {
  id: string; // competition_riders.id — lo que se guarda en team_squad
  name: string;
  team: string | null;
  division: "worldtour" | "proteam" | null;
  category: RiderCategory;
};

const CATEGORIES: RiderCategory[] = ["amarillo", "rosa", "verde"];

const CATEGORY_STYLES: Record<RiderCategory, string> = {
  amarillo: "bg-amarillo text-on-accent",
  rosa: "bg-rosa text-on-accent",
  verde: "bg-verde text-on-accent",
};

export default function SquadSelector({
  riders,
  initialSelectedIds,
  saveUrl,
  squadComposition,
  showFlags = false,
  showDivisionFilter = false,
  groupLabel = "Sin equipo",
  teamName,
  onSaved,
  locked = false,
}: {
  riders: SelectableRider[];
  initialSelectedIds: string[];
  saveUrl: string;
  squadComposition: SquadComposition;
  // Mundial agrupa y busca por país (con bandera); clásicas por equipo
  // ciclista. Es el mismo campo `team` en ambos casos.
  showFlags?: boolean;
  showDivisionFilter?: boolean;
  groupLabel?: string;
  // Si se pasa, se muestra un campo de nombre de equipo editable (se
  // guarda junto con la plantilla) — lo usan las competiciones donde el
  // nombre se fija al fichar (p.ej. Mundial); si no se pasa, se asume que
  // el nombre del equipo ya se gestiona aparte (TeamSwitcher).
  teamName?: string;
  onSaved?: () => void;
  locked?: boolean;
}) {
  const squadSize = squadSizeOf(squadComposition);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialSelectedIds)
  );
  const [name, setName] = useState(teamName ?? "");
  const [query, setQuery] = useState("");
  const [division, setDivision] = useState<"all" | "worldtour" | "proteam">("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | RiderCategory>("all");
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<
    { type: "ok" | "error"; text: string } | null
  >(null);

  const ridersById = useMemo(() => {
    const m = new Map<string, SelectableRider>();
    for (const r of riders) m.set(r.id, r);
    return m;
  }, [riders]);

  const counts = useMemo(() => {
    const cats = Array.from(selected)
      .map((id) => ridersById.get(id)?.category)
      .filter((c): c is RiderCategory => Boolean(c));
    return squadCounts(cats);
  }, [selected, ridersById]);

  const total = selected.size;
  const canSave =
    !locked &&
    total === squadSize &&
    (teamName === undefined || name.trim().length > 0) &&
    counts.amarillo === squadComposition.amarillo &&
    counts.rosa === squadComposition.rosa &&
    counts.verde === squadComposition.verde;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return riders.filter((r) => {
      if (division !== "all" && r.division !== division) return false;
      if (categoryFilter !== "all" && r.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) || (r.team ?? "").toLowerCase().includes(q)
      );
    });
  }, [riders, query, division, categoryFilter]);

  const groups = useMemo(() => {
    const byGroup = new Map<string, SelectableRider[]>();
    for (const r of filtered) {
      const key = r.team ?? groupLabel;
      if (!byGroup.has(key)) byGroup.set(key, []);
      byGroup.get(key)!.push(r);
    }
    for (const list of byGroup.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return Array.from(byGroup.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered, groupLabel]);

  function toggle(rider: SelectableRider) {
    if (locked) return;
    setFeedback(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(rider.id)) {
        next.delete(rider.id);
        return next;
      }
      const currentCount = squadCounts(
        Array.from(prev)
          .map((id) => ridersById.get(id)?.category)
          .filter((c): c is RiderCategory => Boolean(c))
      )[rider.category];
      if (currentCount >= squadComposition[rider.category]) {
        return prev; // ya está completo ese hueco, no hace nada
      }
      next.add(rider.id);
      return next;
    });
  }

  function save() {
    setFeedback(null);
    startTransition(async () => {
      const body: Record<string, unknown> = { riderIds: Array.from(selected) };
      if (teamName !== undefined) body.teamName = name.trim();
      const res = await fetch(saveUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setFeedback({ type: "error", text: data?.error ?? "No se pudo guardar." });
        return;
      }
      setFeedback({ type: "ok", text: "Guardado." });
      onSaved?.();
    });
  }

  return (
    <div>
      {teamName !== undefined &&
        (locked ? (
          <p className="font-display text-sm uppercase tracking-wide text-verde-deep">
            {name || "Sin nombre de equipo"}
          </p>
        ) : (
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder="Nombre de tu equipo"
            className="mb-3 w-full rounded-full border border-line bg-surface px-4 py-2.5 text-base outline-none focus:border-verde"
          />
        ))}

      <div className="flex flex-wrap items-center gap-2">
        {CATEGORIES.map((c) => (
          <span
            key={c}
            className={`rounded-full px-3 py-1.5 font-display text-sm uppercase tracking-wide ${
              counts[c] === squadComposition[c]
                ? CATEGORY_STYLES[c]
                : "border border-line bg-transparent text-text-soft"
            }`}
          >
            {CATEGORY_LABEL[c]} · {counts[c]}/{squadComposition[c]}
          </span>
        ))}
        {!locked && (
          <button
            type="button"
            disabled={!canSave || isPending}
            onClick={save}
            className="ml-auto rounded-full bg-amarillo px-4 py-2.5 font-display text-sm uppercase tracking-wide text-on-accent hover:bg-gold disabled:opacity-40"
          >
            {isPending ? "Guardando…" : `Guardar (${total}/${squadSize})`}
          </button>
        )}
      </div>
      {feedback && (
        <p
          className={`mt-2 text-sm ${
            feedback.type === "ok" ? "text-verde-deep" : "text-rosa"
          }`}
        >
          {feedback.text}
        </p>
      )}

      {!locked && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar corredor o equipo…"
            className="w-full rounded-full border border-line bg-surface px-4 py-2.5 text-base outline-none focus:border-verde"
          />
          {showDivisionFilter && (
            <select
              value={division}
              onChange={(e) => setDivision(e.target.value as typeof division)}
              className="rounded-full border border-line bg-surface px-4 py-2.5 text-base outline-none focus:border-verde"
            >
              <option value="all">Todas las divisiones</option>
              <option value="worldtour">World Tour</option>
              <option value="proteam">ProTeam</option>
            </select>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-text-soft">Color:</span>
        <button
          type="button"
          onClick={() => setCategoryFilter("all")}
          className={`rounded-full border px-3 py-1.5 font-display text-xs uppercase tracking-wide ${
            categoryFilter === "all"
              ? "border-verde-deep bg-verde-deep text-on-accent"
              : "border-line bg-surface text-text-soft"
          }`}
        >
          Todos
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategoryFilter((prev) => (prev === c ? "all" : c))}
            aria-pressed={categoryFilter === c}
            className={`rounded-full px-3 py-1.5 font-display text-xs uppercase tracking-wide transition ${CATEGORY_STYLES[c]} ${
              categoryFilter === c
                ? "ring-2 ring-offset-1 ring-verde-deep"
                : categoryFilter === "all"
                ? ""
                : "opacity-40"
            }`}
          >
            {CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-4">
        {groups.map(([group, groupRiders]) => (
          <div key={group}>
            <h3 className="font-display text-sm uppercase tracking-wide text-verde-deep">
              {showFlags && <CountryFlag team={group} className="mr-1.5" />}
              {group}
            </h3>
            <div className="mt-2 flex flex-col gap-1.5">
              {groupRiders.map((rider) => {
                const isSelected = selected.has(rider.id);
                const full =
                  !isSelected && counts[rider.category] >= squadComposition[rider.category];
                return (
                  <button
                    key={rider.id}
                    type="button"
                    disabled={locked || full}
                    onClick={() => toggle(rider)}
                    className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition ${
                      isSelected
                        ? "border-verde-deep bg-verde-deep/10"
                        : full || locked
                        ? "border-line bg-surface opacity-40"
                        : "border-line bg-surface hover:border-verde-deep/50"
                    }`}
                  >
                    <span className="min-w-0 truncate text-base">{rider.name}</span>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-display uppercase tracking-wide ${CATEGORY_STYLES[rider.category]}`}
                    >
                      {CATEGORY_LABEL[rider.category]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {groups.length === 0 && (
          <p className="text-sm text-text-soft">No hay corredores que coincidan.</p>
        )}
      </div>
    </div>
  );
}
