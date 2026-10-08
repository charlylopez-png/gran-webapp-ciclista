"use client";

import Spinner from "@/components/spinner";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

// Edición pasada de UNA carrera, o de la competición entera si no tiene
// carreras propias (general de una gran vuelta) — solo informativa, no
// puntúa: un corredor por línea en orden de llegada, con el equipo opcional
// detrás de un ";". `saveUrl` decide dónde se guarda.
export default function EventHistoryForm({
  saveUrl,
  initialYear,
  initialRows,
}: {
  saveUrl: string;
  initialYear: number;
  initialRows: { rider_name: string; team: string | null }[];
}) {
  const router = useRouter();
  const [year, setYear] = useState(String(initialYear));
  const [text, setText] = useState(() =>
    initialRows.map((r) => (r.team ? `${r.rider_name}; ${r.team}` : r.rider_name)).join("\n")
  );
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const rows = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, ...rest] = line.split(";");
      const team = rest.join(";").trim();
      return { riderName: name.trim(), team: team || null };
    })
    .filter((r) => r.riderName);

  function save() {
    setFeedback(null);
    if (rows.length > 20) {
      setFeedback({ type: "error", text: "Como mucho 20 corredores." });
      return;
    }
    startTransition(async () => {
      const res = await fetch(saveUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editionYear: Number(year), rows }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setFeedback({ type: "error", text: data?.error ?? "No se pudo guardar." });
        return;
      }
      setFeedback({ type: "ok", text: "Edición pasada guardada." });
      router.refresh();
    });
  }

  return (
    <div>
      <label className="flex w-32 flex-col gap-1 text-xs text-text-soft">
        Año
        <input
          type="number"
          min={1900}
          max={2100}
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className="rounded-full border border-line bg-[var(--bg)] px-3.5 py-2 text-sm text-text outline-none focus:border-verde"
        />
      </label>
      <label className="mt-3 flex flex-col gap-1 text-xs text-text-soft">
        Top 20, un corredor por línea (Nombre; Equipo)
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={12}
          placeholder={"Mathieu van der Poel; Alpecin-Deceuninck\nTadej Pogačar; UAE Team Emirates"}
          className="rounded-2xl border border-line bg-[var(--bg)] px-3.5 py-2 font-mono text-sm text-text outline-none focus:border-verde"
        />
      </label>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="rounded-full bg-[var(--accent)] px-4 py-2 font-display text-xs uppercase tracking-wide text-on-accent hover:brightness-110 disabled:opacity-40"
        >
          {isPending ? <><Spinner />Guardando…</> : `Guardar (${rows.length}/20)`}
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
