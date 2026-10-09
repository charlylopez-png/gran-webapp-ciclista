"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import Spinner from "@/components/spinner";
import {
  FINAL_LIST_KINDS,
  LIST_ICON,
  LIST_LABEL,
  POINTS_TABLE,
  STAGE_LIST_KINDS,
  isTeamList,
  normalizeName,
  type ListKind,
} from "@/lib/grand-tour";

// Admin de UNA etapa: un hueco por puesto en cada listado oficial (con
// autocompletado sobre los corredores o equipos de la competición), las
// retiradas de la etapa, la imagen del perfil y si se anuló. Un solo
// "Guardar" con todo. En la última etapa salen además las finales.
export default function GtStageForm({
  slug,
  eventId,
  isLast,
  teamTimeTrial,
  riders,
  teams,
  initialLists,
  initialCancelled,
  initialProfileImage,
  initialWithdrawn,
  withdrawnElsewhere,
}: {
  slug: string;
  eventId: string;
  isLast: boolean;
  teamTimeTrial: boolean;
  riders: { id: string; name: string; team: string | null }[];
  teams: { id: string; name: string }[];
  initialLists: Partial<Record<ListKind, string[]>>;
  initialCancelled: boolean;
  initialProfileImage: string | null;
  initialWithdrawn: string[];
  withdrawnElsewhere: { id: string; stage: number }[];
}) {
  const router = useRouter();
  // El listado de la contrarreloj por equipos solo sale en etapas de ese
  // tipo (o si ya tiene datos).
  const stageKinds: ListKind[] =
    teamTimeTrial || (initialLists.etapa_equipos?.length ?? 0) > 0
      ? [...STAGE_LIST_KINDS, "etapa_equipos"]
      : STAGE_LIST_KINDS;
  const kinds: ListKind[] = isLast ? [...stageKinds, ...FINAL_LIST_KINDS] : stageKinds;
  const [lists, setLists] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(
      kinds.map((k) => [
        k,
        Array.from({ length: POINTS_TABLE[k].length }, (_, i) => initialLists[k]?.[i] ?? ""),
      ])
    )
  );
  const [cancelled, setCancelled] = useState(initialCancelled);
  const [profileImage, setProfileImage] = useState(initialProfileImage ?? "");
  const [withdrawn, setWithdrawn] = useState<string[]>(initialWithdrawn);
  const [withdrawQuery, setWithdrawQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const riderNames = useMemo(() => new Set(riders.map((r) => normalizeName(r.name))), [riders]);
  const teamNames = useMemo(() => new Set(teams.map((t) => normalizeName(t.name))), [teams]);
  const elsewhere = new Map(withdrawnElsewhere.map((w) => [w.id, w.stage]));

  function setEntry(kind: string, i: number, value: string) {
    setFeedback(null);
    setLists((prev) => ({ ...prev, [kind]: prev[kind].map((v, j) => (j === i ? value : v)) }));
  }

  // Pegar una lista entera (una por línea) en el primer hueco la reparte.
  function pasteList(kind: string, text: string) {
    const names = text.split("\n").map((l) => l.replace(/^\s*\d+[.)º-]?\s*/, "").trim()).filter(Boolean);
    if (names.length <= 1) return false;
    setLists((prev) => ({
      ...prev,
      [kind]: prev[kind].map((_, i) => names[i] ?? ""),
    }));
    return true;
  }

  function save() {
    setFeedback(null);
    startTransition(async () => {
      const res = await fetch(`/api/competitions/${slug}/gt/stages/${eventId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lists: Object.fromEntries(
            Object.entries(lists).map(([k, names]) => [k, names.map((n) => n.trim()).filter(Boolean)])
          ),
          cancelled,
          profileImage: profileImage.trim() || null,
          withdrawn,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setFeedback({ type: "error", text: data?.error ?? "No se pudo guardar." });
        return;
      }
      const unmatched: string[] = data?.unmatched ?? [];
      setFeedback(
        unmatched.length
          ? { type: "error", text: `Guardado, pero no casan (no puntúan): ${unmatched.join(", ")}` }
          : { type: "ok", text: "Etapa guardada." }
      );
      router.refresh();
    });
  }

  const withdrawCandidates = riders.filter((r) => {
    if (withdrawn.includes(r.id)) return false;
    const q = withdrawQuery.trim().toLowerCase();
    return q.length >= 2 && (r.name.toLowerCase().includes(q) || (r.team ?? "").toLowerCase().includes(q));
  });

  return (
    <div className="flex flex-col gap-6">
      <datalist id="gt-riders">
        {riders.map((r) => (
          <option key={r.id} value={r.name}>
            {r.team ?? ""}
          </option>
        ))}
      </datalist>
      <datalist id="gt-teams">
        {teams.map((t) => (
          <option key={t.id} value={t.name} />
        ))}
      </datalist>

      <div className="grid gap-4 sm:grid-cols-2">
        {kinds.map((kind) => {
          const team = isTeamList(kind);
          const known = team ? teamNames : riderNames;
          return (
            <section key={kind} className="rounded-2xl border border-line bg-surface p-3">
              <h3 className="text-sm font-semibold">
                {LIST_ICON[kind]} {LIST_LABEL[kind]}
              </h3>
              <ol className="mt-2 flex flex-col gap-1">
                {lists[kind].map((value, i) => {
                  const unknown = value.trim() !== "" && !known.has(normalizeName(value));
                  return (
                    <li key={i} className="flex items-center gap-2">
                      <span className="w-6 shrink-0 text-right font-display text-xs text-text-soft">{i + 1}º</span>
                      <input
                        list={team ? "gt-teams" : "gt-riders"}
                        value={value}
                        onChange={(e) => setEntry(kind, i, e.target.value)}
                        onPaste={(e) => {
                          if (i === 0 && pasteList(kind, e.clipboardData.getData("text"))) e.preventDefault();
                        }}
                        placeholder={team ? "Equipo…" : "Corredor…"}
                        className={`min-w-0 flex-1 rounded-full border bg-[var(--bg)] px-3 py-1 text-sm text-text outline-none focus:border-verde ${
                          unknown ? "border-rosa" : "border-line"
                        }`}
                      />
                      <span className="w-8 shrink-0 text-right text-[11px] text-text-soft">
                        {POINTS_TABLE[kind][i]}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </div>
      <p className="-mt-3 text-xs text-text-soft">
        Consejo: copia la lista de la web oficial (una línea por puesto) y pégala en el 1º hueco: se
        reparte sola. En rosa, nombres que no casan con ningún corredor/equipo cargado.
      </p>

      <section className="rounded-2xl border border-line bg-surface p-3">
        <h3 className="text-sm font-semibold">🤕 Retirados en esta etapa (caída o enfermedad)</h3>
        <p className="mt-1 text-xs text-text-soft">
          A quien lleve de titular a uno de estos se le abre la opción de meter un suplente.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {withdrawn.map((id) => {
            const r = riders.find((x) => x.id === id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => setWithdrawn((w) => w.filter((x) => x !== id))}
                className="rounded-full border border-rosa px-3 py-1 text-sm text-rosa"
              >
                {r?.name ?? id} ✕
              </button>
            );
          })}
          {withdrawn.length === 0 && <span className="text-xs text-text-soft">Ninguno.</span>}
        </div>
        <input
          type="search"
          value={withdrawQuery}
          onChange={(e) => setWithdrawQuery(e.target.value)}
          placeholder="Buscar corredor para marcarlo como retirado…"
          className="mt-2 w-full rounded-full border border-line bg-[var(--bg)] px-3.5 py-2 text-sm outline-none focus:border-verde"
        />
        {withdrawCandidates.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {withdrawCandidates.slice(0, 12).map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setWithdrawn((w) => [...w, r.id]);
                  setWithdrawQuery("");
                }}
                className="rounded-full border border-line px-3 py-1 text-sm hover:border-rosa"
              >
                + {r.name}
                {elsewhere.has(r.id) ? ` (ya retirado en la ${elsewhere.get(r.id)})` : ""}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-3 rounded-2xl border border-line bg-surface p-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="flex flex-col gap-1 text-xs text-text-soft">
          Imagen del perfil oficial (URL)
          <input
            type="url"
            value={profileImage}
            onChange={(e) => setProfileImage(e.target.value)}
            placeholder="https://…"
            className="rounded-full border border-line bg-[var(--bg)] px-3.5 py-2 text-sm text-text outline-none focus:border-verde"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={cancelled} onChange={(e) => setCancelled(e.target.checked)} />
          Etapa anulada
        </label>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="rounded-full bg-[var(--accent)] px-5 py-2.5 font-display text-xs uppercase tracking-wide text-on-accent hover:brightness-110 disabled:opacity-40"
        >
          {isPending ? (
            <>
              <Spinner />
              Guardando…
            </>
          ) : (
            "Guardar etapa"
          )}
        </button>
        {feedback && (
          <p className={`text-sm ${feedback.type === "ok" ? "text-verde-deep" : "text-rosa"}`}>{feedback.text}</p>
        )}
      </div>
    </div>
  );
}
