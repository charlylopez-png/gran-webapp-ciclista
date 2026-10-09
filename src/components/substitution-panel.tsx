"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Spinner from "@/components/spinner";

// Sustituciones pendientes del equipo: por cada titular retirado (el admin
// ya marcó su caída/enfermedad), los suplentes que pueden entrar según la
// regla de precio. Si no hay ninguno válido, se dice y no hay botón.
export type PendingSubstitution = {
  out: { id: string; name: string; price: number; stage: number | null };
  options: { id: string; name: string; price: number }[];
};

export default function SubstitutionPanel({
  pending,
  saveUrl,
}: {
  pending: PendingSubstitution[];
  saveUrl: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  function substitute(outId: string, inId: string, inName: string) {
    setFeedback(null);
    setBusy(`${outId}:${inId}`);
    startTransition(async () => {
      const res = await fetch(saveUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outRiderId: outId, inRiderId: inId }),
      });
      const data = await res.json().catch(() => null);
      setBusy(null);
      if (!res.ok) {
        setFeedback({ type: "error", text: data?.error ?? "No se pudo hacer el cambio." });
        return;
      }
      setFeedback({ type: "ok", text: `${inName} entra y puntúa desde la etapa ${data.fromStage}.` });
      router.refresh();
    });
  }

  if (pending.length === 0) return null;

  return (
    <section className="mt-6 rounded-2xl border border-rosa/60 bg-surface p-4">
      <h2 className="font-display text-sm uppercase tracking-wide text-rosa">Sustituciones</h2>
      <div className="mt-3 flex flex-col gap-4">
        {pending.map((p) => (
          <div key={p.out.id}>
            <p className="text-sm">
              <b>{p.out.name}</b> ({p.out.price}) se ha retirado
              {p.out.stage ? ` en la etapa ${p.out.stage}` : ""}.
            </p>
            {p.options.length === 0 ? (
              <p className="mt-1 text-sm text-text-soft">
                No tienes ningún suplente que valga menos: sigues sin él.
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {p.options.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    disabled={isPending}
                    onClick={() => substitute(p.out.id, o.id, o.name)}
                    className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm text-on-accent hover:brightness-110 disabled:opacity-40"
                  >
                    {busy === `${p.out.id}:${o.id}` && <Spinner />}
                    Meter a {o.name} ({o.price})
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      {feedback && (
        <p className={`mt-3 text-sm ${feedback.type === "ok" ? "text-verde-deep" : "text-rosa"}`}>
          {feedback.text}
        </p>
      )}
    </section>
  );
}
