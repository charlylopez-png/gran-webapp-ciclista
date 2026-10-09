import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompetition } from "@/lib/competitions-data";
import { getGrandTourData, grandTourConfig } from "@/lib/grand-tour-data";
import { hasStageResults, stageTypeInfo } from "@/lib/grand-tour";

// Todas las etapas de una gran vuelta, como en la app anterior: número,
// tipo, recorrido, fecha, km y estado (próxima, hoy, completada, anulada),
// con los días de descanso intercalados. Cada etapa abre su detalle.
const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export default async function StagesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const competition = await getCompetition(slug);
  if (!competition || competition.status === "hidden" || !grandTourConfig(competition)) notFound();

  const data = await getGrandTourData(competition.id);
  const resultByStage = new Map(data.results.map((r) => [r.stageId, r]));
  // Fecha de hoy en Madrid, para marcar la etapa del día.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());

  return (
    <div>
      <h1 className="text-2xl text-verde-deep">Etapas</h1>
      {data.stages.length === 0 ? (
        <p className="mt-3 text-sm text-text-soft">Todavía no está cargado el recorrido.</p>
      ) : (
        <ol className="mt-4 flex flex-col gap-1.5">
          {data.stages.map((stage, i) => {
            const prev = data.stages[i - 1];
            const rest =
              prev?.date && stage.date
                ? data.restDays.find((d) => d.date > prev.date! && d.date < stage.date!)
                : undefined;
            const done = hasStageResults(resultByStage.get(stage.id));
            const isToday = stage.date === today;
            const status = stage.cancelled
              ? { text: "Anulada", cls: "text-text-soft line-through" }
              : isToday
              ? { text: "Hoy", cls: "text-amarillo" }
              : done
              ? { text: "Completada", cls: "text-verde" }
              : stage.date && stage.date < today
              ? { text: "Disputada", cls: "text-text-soft" }
              : { text: "Próxima", cls: "text-text-soft" };
            const info = stageTypeInfo(stage.type);
            return (
              <li key={stage.id}>
                {rest && (
                  <div className="mb-1.5 rounded-xl border border-dashed border-line px-4 py-2 text-center text-xs text-text-soft">
                    💤 Día de descanso{rest.place ? ` · ${rest.place}` : ""}
                  </div>
                )}
                <Link
                  href={`/${slug}/etapas/${stage.order}`}
                  className={`flex items-center gap-3 rounded-xl border bg-surface px-3 py-2.5 hover:border-verde-deep/50 ${
                    isToday ? "border-amarillo" : "border-line"
                  } ${stage.cancelled ? "opacity-60" : ""}`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--pill-bg)] font-display text-sm text-[var(--pill-text)]">
                    {stage.order}
                  </span>
                  <span className="shrink-0 text-xl" title={info.label}>
                    {info.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {stage.start && stage.finish ? `${stage.start} → ${stage.finish}` : stage.name}
                    </span>
                    <span className="block truncate text-xs text-text-soft">
                      {stage.date ? `${WEEKDAYS[new Date(`${stage.date}T12:00:00Z`).getUTCDay()]} ${stage.date.slice(8, 10)}/${stage.date.slice(5, 7)}` : "Fecha por confirmar"}
                      {info.label ? ` · ${info.label}` : ""}
                    </span>
                  </span>
                  {stage.km !== null && (
                    <span className="hidden shrink-0 text-xs text-text-soft sm:block">{stage.km} km</span>
                  )}
                  <span className={`w-20 shrink-0 text-right font-display text-[11px] uppercase ${status.cls}`}>
                    {status.text}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
