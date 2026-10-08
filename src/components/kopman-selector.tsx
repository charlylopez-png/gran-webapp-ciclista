"use client";

import { useState, useTransition } from "react";
import { CATEGORY_LABEL, type RiderCategory } from "@/lib/competitions";

export type KopmanRider = {
  id: string; // competition_riders.id
  name: string;
  category: RiderCategory;
};

const CATEGORY_STYLES: Record<RiderCategory, string> = {
  amarillo: "bg-amarillo text-on-accent",
  rojo: "bg-rojo text-on-accent",
  rosa: "bg-rosa text-on-accent",
  verde: "bg-verde text-on-accent",
};

// Elige el Kopman (líder) del equipo para UNA carrera, entre los
// corredores que forman parte de ella (Klassiekerkern+Wedstrijdselectie
// en UKT, o solo el Equipo Base donde no hay fichaje por carrera). Sus
// puntos de esa carrera cuentan ×2; si no queda entre los 20 primeros
// (una vez publicado el resultado), resta 50 puntos al equipo.
export default function KopmanSelector({
  riders,
  initialRiderId,
  saveUrl,
  locked = false,
}: {
  riders: KopmanRider[];
  initialRiderId: string | null;
  saveUrl: string;
  locked?: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(initialRiderId);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "ok" | "error"; text: string } | null>(
    null
  );

  function choose(riderId: string | null) {
    if (locked) return;
    setFeedback(null);
    const previous = selected;
    setSelected(riderId);
    startTransition(async () => {
      const res = await fetch(saveUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competitionRiderId: riderId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setSelected(previous);
        setFeedback({ type: "error", text: data?.error ?? "No se pudo guardar." });
        return;
      }
      setFeedback({ type: "ok", text: riderId ? "Kopman guardado." : "Kopman quitado." });
    });
  }

  return (
    <div>
      <p className="text-sm text-text-soft">
        Elige a tu Kopman para esta carrera: sus puntos cuentan ×2, pero si
        no queda entre los 20 primeros te resta 50 puntos.
      </p>
      <div className="mt-3 flex flex-col gap-1.5">
        {riders.map((rider) => {
          const isSelected = selected === rider.id;
          return (
            <button
              key={rider.id}
              type="button"
              disabled={locked || isPending}
              onClick={() => choose(isSelected ? null : rider.id)}
              className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition ${
                isSelected
                  ? "border-verde-deep bg-verde-deep/10"
                  : "border-line bg-surface hover:border-verde-deep/50"
              } ${locked ? "opacity-60" : ""}`}
            >
              <span className="min-w-0 truncate text-base">
                {isSelected && <span className="mr-1.5 text-amarillo">★</span>}
                {rider.name}
              </span>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-display uppercase tracking-wide ${CATEGORY_STYLES[rider.category]}`}
              >
                {CATEGORY_LABEL[rider.category]}
              </span>
            </button>
          );
        })}
        {riders.length === 0 && (
          <p className="text-sm text-text-soft">
            Todavía no tienes corredores fichados para esta carrera.
          </p>
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
    </div>
  );
}
