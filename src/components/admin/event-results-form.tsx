"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { CATEGORY_LABEL, POINTS_BY_POSITION, type RiderCategory } from "@/lib/competitions";

export type ResultsRider = {
  id: string; // competition_riders.id
  name: string;
  team: string | null;
  category: RiderCategory | null;
};

const POSITIONS = Object.keys(POINTS_BY_POSITION).map(Number);

function riderLabel(r: ResultsRider) {
  return r.team ? `${r.name} — ${r.team}` : r.name;
}

// Resultado oficial de UNA carrera (puestos 1-20) — lo que puntúa. Cada
// puesto es un campo con autocompletado sobre los corredores de la
// competición; los que no estén en la lista simplemente no puntúan para
// nadie, así que no hace falta meterlos.
export default function EventResultsForm({
  slug,
  eventId,
  riders,
  initialResults,
}: {
  slug: string;
  eventId: string;
  riders: ResultsRider[];
  initialResults: { competition_rider_id: string; position: number }[];
}) {
  const router = useRouter();
  const ridersById = useMemo(() => new Map(riders.map((r) => [r.id, r])), [riders]);
  const idByLabel = useMemo(() => new Map(riders.map((r) => [riderLabel(r), r.id])), [riders]);
  const listId = `riders-${eventId}`;

  const [slots, setSlots] = useState<string[]>(() =>
    POSITIONS.map((pos) => {
      const row = initialResults.find((r) => r.position === pos);
      const rider = row ? ridersById.get(row.competition_rider_id) : undefined;
      return rider ? riderLabel(rider) : "";
    })
  );
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  function setSlot(i: number, value: string) {
    setFeedback(null);
    setSlots((prev) => prev.map((v, j) => (j === i ? value : v)));
  }

  function save() {
    setFeedback(null);
    const chosen: { competitionRiderId: string; position: number }[] = [];
    for (const [i, text] of slots.entries()) {
      const label = text.trim();
      if (!label) continue;
      const id = idByLabel.get(label);
      if (!id) {
        setFeedback({
          type: "error",
          text: `El ${POSITIONS[i]}º no coincide con ningún corredor: elígelo de la lista.`,
        });
        return;
      }
      chosen.push({ competitionRiderId: id, position: POSITIONS[i] });
    }
    const chosenIds = new Set(chosen.map((c) => c.competitionRiderId));
    if (chosenIds.size !== chosen.length) {
      setFeedback({ type: "error", text: "Hay un corredor repetido en dos puestos." });
      return;
    }
    // Los que tenían puesto y ya no lo tienen se borran (position: null).
    const removed = initialResults
      .filter((r) => !chosenIds.has(r.competition_rider_id))
      .map((r) => ({ competitionRiderId: r.competition_rider_id, position: null }));

    startTransition(async () => {
      const res = await fetch(`/api/competitions/${slug}/events/${eventId}/results`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ results: [...removed, ...chosen] }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setFeedback({ type: "error", text: data?.error ?? "No se pudo guardar." });
        return;
      }
      setFeedback({ type: "ok", text: "Resultado guardado." });
      router.refresh();
    });
  }

  return (
    <div>
      <datalist id={listId}>
        {riders.map((r) => (
          <option key={r.id} value={riderLabel(r)}>
            {r.category ? CATEGORY_LABEL[r.category] : ""}
          </option>
        ))}
      </datalist>
      {riders.length === 0 && (
        <p className="mb-3 text-sm text-rosa">
          Esta competición todavía no tiene corredores cargados.
        </p>
      )}
      <ol className="flex flex-col gap-1.5">
        {POSITIONS.map((pos, i) => (
          <li key={pos} className="flex items-center gap-2">
            <span className="w-8 shrink-0 text-right font-display text-xs text-text-soft">{pos}º</span>
            <input
              list={listId}
              value={slots[i]}
              onChange={(e) => setSlot(i, e.target.value)}
              placeholder="Corredor…"
              className="min-w-0 flex-1 rounded-full border border-line bg-[var(--bg)] px-3.5 py-1.5 text-sm text-text outline-none focus:border-verde"
            />
            {slots[i] && (
              <button
                type="button"
                onClick={() => setSlot(i, "")}
                aria-label={`Vaciar el ${pos}º`}
                className="shrink-0 px-1 text-text-soft hover:text-rosa"
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ol>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="rounded-full bg-[var(--accent)] px-4 py-2 font-display text-xs uppercase tracking-wide text-on-accent hover:brightness-110 disabled:opacity-40"
        >
          {isPending ? "Guardando…" : "Guardar resultado"}
        </button>
        {feedback && (
          <p className={`text-xs ${feedback.type === "ok" ? "text-verde-deep" : "text-rosa"}`}>
            {feedback.text}
          </p>
        )}
      </div>
    </div>
  );
}
