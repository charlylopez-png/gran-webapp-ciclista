"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Spinner from "@/components/spinner";
import { STAGE_TYPES, normalizeName, type StageType } from "@/lib/grand-tour";

// Cargas "pegando una lista" del admin de una gran vuelta: la lista de
// salida con precios y el recorrido. Una línea por fila, campos separados
// por ";" (o tabulador, para pegar directamente desde una hoja de cálculo).

function splitLine(line: string) {
  return line.split(/;|\t/).map((p) => p.trim());
}

function useSave(url: string, method: "POST" | "PUT" = "POST") {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  function save(body: unknown, okText: (data: Record<string, unknown>) => string) {
    setFeedback(null);
    startTransition(async () => {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setFeedback({ type: "error", text: data?.error ?? "No se pudo guardar." });
        return;
      }
      setFeedback({ type: "ok", text: okText(data ?? {}) });
      router.refresh();
    });
  }
  return { isPending, feedback, setFeedback, save };
}

export function GtRidersLoader({ slug }: { slug: string }) {
  const [text, setText] = useState("");
  const { isPending, feedback, setFeedback, save } = useSave(`/api/competitions/${slug}/gt/riders`);

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const rows = lines.map(splitLine).map(([name, team, price]) => ({
    name: name ?? "",
    team: team ?? "",
    price: price ? Number(price.replace(/\D/g, "")) || null : null,
  }));
  const bad = rows.filter((r) => !r.name || !r.team).length;

  return (
    <div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        placeholder={"Jonas Vingegaard; Visma–Lease a Bike; 600\nFelix Gall; Decathlon CMA CGM; 300\nTom Pidcock; Pinarello–Q36.5"}
        className="w-full rounded-2xl border border-line bg-[var(--bg)] px-3.5 py-2 font-mono text-sm text-text outline-none focus:border-verde"
      />
      <p className="mt-1 text-xs text-text-soft">
        Una línea por corredor: <b>Nombre; Equipo; Precio</b> (el precio es opcional, se puede poner
        después). Si el corredor ya estaba, se le actualiza el equipo y el precio.
      </p>
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          disabled={isPending || rows.length === 0 || bad > 0}
          onClick={() => {
            if (bad > 0) {
              setFeedback({ type: "error", text: `${bad} líneas sin nombre o sin equipo.` });
              return;
            }
            save({ rows }, (d) => `Hecho: ${d.created ?? 0} nuevos, ${d.updated ?? 0} actualizados.`);
          }}
          className="rounded-full bg-[var(--accent)] px-4 py-2 font-display text-xs uppercase tracking-wide text-on-accent hover:brightness-110 disabled:opacity-40"
        >
          {isPending ? (
            <>
              <Spinner />
              Cargando…
            </>
          ) : (
            `Cargar ${rows.length} corredores`
          )}
        </button>
        {bad > 0 && <span className="text-xs text-rosa">{bad} líneas incompletas</span>}
        {feedback && (
          <span className={`text-xs ${feedback.type === "ok" ? "text-verde-deep" : "text-rosa"}`}>
            {feedback.text}
          </span>
        )}
      </div>
    </div>
  );
}

// Tipo de etapa escrito a mano → clave interna ("crono" → contrarreloj_individual).
function parseStageType(raw: string | undefined): StageType | null {
  if (!raw) return null;
  const t = normalizeName(raw).toLowerCase().replace(/\s+/g, "_");
  if ((Object.keys(STAGE_TYPES) as StageType[]).includes(t as StageType)) return t as StageType;
  if (/equipo|cre|ttt/.test(t)) return "contrarreloj_equipos";
  if (/crono|contrarreloj|cri|itt/.test(t)) return "contrarreloj_individual";
  if (/alto/.test(t)) return "ondulada_final_alto";
  if (/media/.test(t)) return "media";
  if (/monta|alta/.test(t)) return "montana";
  if (/ondul|accident/.test(t)) return "ondulada";
  if (/llan|plana|sprint/.test(t)) return "llana";
  return null;
}

// "22/08/2027", "2027-08-22" o "22-08-2027" → "2027-08-22".
function parseDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (iso) return raw;
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(raw);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  return null;
}

export function GtStagesLoader({ slug, initialText }: { slug: string; initialText: string }) {
  const [text, setText] = useState(initialText);
  const { isPending, feedback, setFeedback, save } = useSave(`/api/competitions/${slug}/gt/stages`);

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const restDays: { date: string; place: string | null }[] = [];
  const stages: {
    order: number;
    date: string | null;
    start: string;
    finish: string;
    km: number | null;
    type: StageType | null;
  }[] = [];
  const errors: string[] = [];
  for (const line of lines) {
    const parts = splitLine(line);
    if (/^descanso$/i.test(parts[0])) {
      const date = parseDate(parts[1]);
      if (date) restDays.push({ date, place: parts[2] || null });
      else errors.push(line);
      continue;
    }
    const order = Number(parts[0]);
    const date = parseDate(parts[1]);
    if (!Number.isInteger(order) || order < 1 || !parts[2] || !parts[3]) {
      errors.push(line);
      continue;
    }
    stages.push({
      order,
      date,
      start: parts[2],
      finish: parts[3],
      km: parts[4] ? Number(parts[4].replace(",", ".")) || null : null,
      type: parseStageType(parts[5]),
    });
  }

  return (
    <div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        placeholder={"1; 2027-05-08; Salida; Meta; 9,4; crono\n2; 2027-05-09; Salida; Meta; 214; llana\ndescanso; 2027-05-17; Lugar"}
        className="w-full rounded-2xl border border-line bg-[var(--bg)] px-3.5 py-2 font-mono text-sm text-text outline-none focus:border-verde"
      />
      <p className="mt-1 text-xs text-text-soft">
        Una línea por etapa: <b>Nº; Fecha; Salida; Meta; Km; Tipo</b> (tipos: llana, ondulada, final en
        alto, media, montaña, crono, crono equipos). Días de descanso: <b>descanso; Fecha; Lugar</b>.
        Volver a cargar actualiza las etapas sin borrar sus resultados.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={isPending || stages.length === 0}
          onClick={() => {
            if (errors.length > 0) {
              setFeedback({ type: "error", text: `No entiendo estas líneas: ${errors.slice(0, 3).join(" · ")}` });
              return;
            }
            save({ stages, restDays }, (d) => `Recorrido guardado: ${d.stages ?? stages.length} etapas.`);
          }}
          className="rounded-full bg-[var(--accent)] px-4 py-2 font-display text-xs uppercase tracking-wide text-on-accent hover:brightness-110 disabled:opacity-40"
        >
          {isPending ? (
            <>
              <Spinner />
              Guardando…
            </>
          ) : (
            `Guardar ${stages.length} etapas${restDays.length ? ` y ${restDays.length} descansos` : ""}`
          )}
        </button>
        {errors.length > 0 && <span className="text-xs text-rosa">{errors.length} líneas sin entender</span>}
        {feedback && (
          <span className={`text-xs ${feedback.type === "ok" ? "text-verde-deep" : "text-rosa"}`}>
            {feedback.text}
          </span>
        )}
      </div>
    </div>
  );
}
