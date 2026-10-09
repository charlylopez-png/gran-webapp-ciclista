"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import Spinner from "@/components/spinner";

// Editor de precios de una gran vuelta (admin y sanedrín): todos los
// corredores agrupados por equipo, con su precio editable y botones
// rápidos de escalón. Se guardan de golpe solo los que han cambiado.
const TIERS = [50, 75, 100, 125, 150, 200, 250, 300, 400, 500, 600];

export default function GtPriceEditor({
  slug,
  riders,
}: {
  slug: string;
  riders: { id: string; name: string; team: string | null; price: number }[];
}) {
  const router = useRouter();
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(riders.map((r) => [r.id, r.price > 0 ? String(r.price) : ""]))
  );
  const [query, setQuery] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const original = useMemo(
    () => Object.fromEntries(riders.map((r) => [r.id, r.price > 0 ? String(r.price) : ""])),
    [riders]
  );
  const changed = Object.keys(prices).filter((id) => prices[id] !== original[id]);
  const missing = riders.filter((r) => !prices[r.id]).length;

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const byTeam = new Map<string, typeof riders>();
    for (const r of riders) {
      if (onlyMissing && prices[r.id]) continue;
      if (q && !r.name.toLowerCase().includes(q) && !(r.team ?? "").toLowerCase().includes(q)) continue;
      const key = r.team ?? "Sin equipo";
      if (!byTeam.has(key)) byTeam.set(key, []);
      byTeam.get(key)!.push(r);
    }
    return Array.from(byTeam.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [riders, query, onlyMissing, prices]);

  function save() {
    setFeedback(null);
    startTransition(async () => {
      const res = await fetch(`/api/competitions/${slug}/gt/prices`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prices: changed.map((id) => ({ id, price: prices[id] ? Number(prices[id]) : null })),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setFeedback({ type: "error", text: data?.error ?? "No se pudo guardar." });
        return;
      }
      setFeedback({ type: "ok", text: `${changed.length} precios guardados.` });
      router.refresh();
    });
  }

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-4 flex flex-wrap items-center gap-2 bg-[var(--bg)] px-4 py-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar corredor o equipo…"
          className="min-w-0 flex-1 rounded-full border border-line bg-surface px-4 py-2 text-sm outline-none focus:border-verde"
        />
        <label className="flex items-center gap-1.5 text-xs text-text-soft">
          <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />
          Solo sin precio ({missing})
        </label>
        <button
          type="button"
          onClick={save}
          disabled={isPending || changed.length === 0}
          className="rounded-full bg-[var(--accent)] px-4 py-2 font-display text-xs uppercase tracking-wide text-on-accent hover:brightness-110 disabled:opacity-40"
        >
          {isPending ? (
            <>
              <Spinner />
              Guardando…
            </>
          ) : (
            `Guardar ${changed.length} cambios`
          )}
        </button>
      </div>
      {feedback && (
        <p className={`mt-2 text-sm ${feedback.type === "ok" ? "text-verde-deep" : "text-rosa"}`}>{feedback.text}</p>
      )}

      <div className="mt-4 flex flex-col gap-5">
        {groups.map(([team, list]) => (
          <section key={team}>
            <h3 className="font-display text-sm uppercase tracking-wide text-verde-deep">{team}</h3>
            <ul className="mt-1 divide-y divide-line rounded-xl border border-line bg-surface">
              {list.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-2 px-3 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-sm">{r.name}</span>
                  <div className="hidden gap-1 sm:flex">
                    {TIERS.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setPrices((p) => ({ ...p, [r.id]: String(t) }))}
                        className={`rounded-full px-1.5 py-0.5 text-[11px] ${
                          prices[r.id] === String(t) ? "bg-verde-deep text-on-accent" : "text-text-soft hover:bg-surface-2"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min={0}
                    step={25}
                    value={prices[r.id]}
                    onChange={(e) => setPrices((p) => ({ ...p, [r.id]: e.target.value }))}
                    className={`w-20 rounded-full border bg-[var(--bg)] px-3 py-1 text-right text-sm outline-none focus:border-verde ${
                      prices[r.id] !== original[r.id] ? "border-amarillo" : "border-line"
                    }`}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
        {riders.length === 0 && (
          <p className="text-sm text-text-soft">Todavía no hay corredores cargados en esta competición.</p>
        )}
      </div>
    </div>
  );
}
