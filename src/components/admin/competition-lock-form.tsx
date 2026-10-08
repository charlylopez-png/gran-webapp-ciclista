"use client";

import Spinner from "@/components/spinner";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toLocalInputValue, fromLocalInputValue } from "@/lib/admin-datetime";

// Cierre de la plantilla fija de UNA competición (Klassiekerkern/Equipo
// Base): competitions.picks_lock_at. Dejarlo vacío = sin cierre.
export default function CompetitionLockForm({
  slug,
  picksLockAt,
}: {
  slug: string;
  picksLockAt: string | Date | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(() => toLocalInputValue(picksLockAt));
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  function save(next: string) {
    setFeedback(null);
    startTransition(async () => {
      const res = await fetch(`/api/competitions/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ picksLockAt: fromLocalInputValue(next) }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setFeedback({ type: "error", text: data?.error ?? "No se pudo guardar." });
        return;
      }
      setValue(next);
      setFeedback({ type: "ok", text: next ? "Cierre guardado." : "Cierre quitado." });
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-text-soft">
          Fecha y hora de cierre (hora de Madrid)
          <input
            type="datetime-local"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="rounded-full border border-line bg-[var(--bg)] px-3.5 py-2 text-sm text-text outline-none focus:border-verde"
          />
        </label>
        <button
          type="button"
          onClick={() => save(value)}
          disabled={isPending}
          className="rounded-full bg-[var(--accent)] px-4 py-2 font-display text-xs uppercase tracking-wide text-on-accent hover:brightness-110 disabled:opacity-40"
        >
          {isPending ? <><Spinner />Guardando…</> : "Guardar"}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => save("")}
            disabled={isPending}
            className="rounded-full border border-line px-4 py-2 font-display text-xs uppercase tracking-wide text-text-soft hover:border-verde-deep/50 disabled:opacity-40"
          >
            Quitar cierre
          </button>
        )}
      </div>
      {feedback && (
        <p className={`mt-2 text-xs ${feedback.type === "ok" ? "text-verde-deep" : "text-rosa"}`}>
          {feedback.text}
        </p>
      )}
    </div>
  );
}
