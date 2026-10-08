"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toLocalInputValue, fromLocalInputValue } from "@/lib/admin-datetime";
import { squadLabels } from "@/lib/competitions";

export type EventAdminData = {
  id: string;
  order_num: number;
  name: string;
  event_date: string | Date | null;
  official_url: string | null;
  picks_lock_at: string | Date | null;
  stars: number | null;
  multiplier: string | number | null;
};

// Fila editable de una carrera dentro de /[slug]/admin: fecha, web
// oficial, cierre de su Last Draft, estrellas y coeficiente — todo en un
// único "Guardar" (como el resto de formularios de la app, que siempre
// mandan el estado completo). El logo se sigue subiendo como archivo.
export default function EventAdminRow({ slug, event }: { slug: string; event: EventAdminData }) {
  const router = useRouter();
  const labels = squadLabels(slug);
  const [eventDate, setEventDate] = useState(() => toDateInputValue(event.event_date));
  const [officialUrl, setOfficialUrl] = useState(event.official_url ?? "");
  const [picksLockAt, setPicksLockAt] = useState(() => toLocalInputValue(event.picks_lock_at));
  const [stars, setStars] = useState(event.stars !== null ? String(event.stars) : "");
  const [multiplier, setMultiplier] = useState(
    event.multiplier !== null ? String(event.multiplier) : ""
  );
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  function save() {
    setFeedback(null);
    startTransition(async () => {
      const res = await fetch(`/api/competitions/${slug}/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventDate: eventDate || null,
          officialUrl: officialUrl.trim() || null,
          picksLockAt: fromLocalInputValue(picksLockAt),
          stars: stars ? Number(stars) : null,
          multiplier: multiplier ? Number(multiplier) : null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setFeedback({ type: "error", text: data?.error ?? "No se pudo guardar." });
        return;
      }
      setFeedback({ type: "ok", text: "Guardado." });
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-display text-sm text-verde-deep">
          {String(event.order_num).padStart(2, "0")} · {event.name}
        </span>
        <Link
          href={`/${slug}/admin/carreras/${event.order_num}`}
          className="text-xs text-verde-deep underline underline-offset-2"
        >
          Resultados y edición pasada →
        </Link>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-text-soft">
          Fecha de la carrera
          <input
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            className="rounded-full border border-line bg-[var(--bg)] px-3.5 py-2 text-sm text-text outline-none focus:border-verde"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-soft">
          Cierre del {labels.draft}
          <input
            type="datetime-local"
            value={picksLockAt}
            onChange={(e) => setPicksLockAt(e.target.value)}
            className="rounded-full border border-line bg-[var(--bg)] px-3.5 py-2 text-sm text-text outline-none focus:border-verde"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-soft sm:col-span-2">
          Web oficial
          <input
            type="url"
            value={officialUrl}
            onChange={(e) => setOfficialUrl(e.target.value)}
            placeholder="https://…"
            className="rounded-full border border-line bg-[var(--bg)] px-3.5 py-2 text-sm text-text outline-none focus:border-verde"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-soft">
          Estrellas (2-5)
          <input
            type="number"
            min={2}
            max={5}
            value={stars}
            onChange={(e) => setStars(e.target.value)}
            className="rounded-full border border-line bg-[var(--bg)] px-3.5 py-2 text-sm text-text outline-none focus:border-verde"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-soft">
          Coeficiente
          <input
            type="number"
            step="0.05"
            min={0}
            value={multiplier}
            onChange={(e) => setMultiplier(e.target.value)}
            className="rounded-full border border-line bg-[var(--bg)] px-3.5 py-2 text-sm text-text outline-none focus:border-verde"
          />
        </label>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="rounded-full bg-[var(--accent)] px-4 py-2 font-display text-xs uppercase tracking-wide text-on-accent hover:brightness-110 disabled:opacity-40"
        >
          {isPending ? "Guardando…" : "Guardar"}
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

// event_date es un `date` de Postgres: llega como "YYYY-MM-DD" (string) o
// como Date en UTC según el driver — <input type="date"> quiere
// "YYYY-MM-DD" siempre, y aquí (a diferencia de picks_lock_at) sí importa
// leer los getters UTC, no los locales, para no desplazar el día.
function toDateInputValue(value: string | Date | null): string {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
}
