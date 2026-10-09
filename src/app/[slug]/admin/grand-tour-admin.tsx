import Link from "next/link";
import type { Competition } from "@/lib/competitions-data";
import { getCompetitionResultHistory, getRaceEditions } from "@/lib/competitions-data";
import { getGrandTourData } from "@/lib/grand-tour-data";
import { hasFinalResults, hasStageResults, stageTypeInfo } from "@/lib/grand-tour";
import CompetitionLockForm from "@/components/admin/competition-lock-form";
import EventHistoryForm from "@/components/admin/event-history-form";
import { GtRidersLoader, GtStagesLoader } from "@/components/admin/gt-bulk-loaders";

// Panel de admin de una gran vuelta: cierre de plantillas, lista de salida
// con precios, recorrido, resultados etapa a etapa y la edición pasada.
export default async function GrandTourAdmin({ competition }: { competition: Competition }) {
  const slug = competition.slug;
  const data = await getGrandTourData(competition.id);
  const resultByStage = new Map(data.results.map((r) => [r.stageId, r]));
  const priced = data.riders.filter((r) => r.price > 0).length;
  const lastYear = competition.season - 1;
  const [history, editions] = await Promise.all([
    getCompetitionResultHistory(competition.id, lastYear),
    getRaceEditions(competition.id, lastYear),
  ]);

  const stagesText = [
    ...data.stages.map((s) =>
      [s.order, s.date ?? "", s.start ?? "", s.finish ?? "", s.km !== null ? String(s.km).replace(".", ",") : "", s.type ?? ""].join("; ")
    ),
    ...data.restDays.map((d) => ["descanso", d.date, d.place ?? ""].join("; ")),
  ].join("\n");

  return (
    <div>
      <div className="mb-1 flex items-center gap-2 font-display text-[11px] uppercase tracking-[0.16em] text-verde">
        <span className="h-1.5 w-1.5 rounded-full bg-amarillo" />
        Administración
      </div>
      <h1 className="text-2xl text-verde-deep">{competition.name}</h1>

      <Section title="1 · Cierre de plantillas">
        <p className="mb-3 text-sm text-text-soft">
          A partir de esta fecha nadie puede cambiar su plantilla (solo meter suplentes por retiradas).
        </p>
        <CompetitionLockForm slug={slug} picksLockAt={competition.picks_lock_at} />
      </Section>

      <Section title="2 · Corredores y precios">
        <p className="mb-3 text-sm text-text-soft">
          {data.riders.length} corredores cargados, {priced} con precio · {data.realTeams.length} equipos.{" "}
          <Link href={`/${slug}/precios`} className="text-verde-deep underline underline-offset-2">
            Editar precios →
          </Link>
        </p>
        <GtRidersLoader slug={slug} />
      </Section>

      <Section title="3 · Recorrido">
        <GtStagesLoader slug={slug} initialText={stagesText} />
      </Section>

      <Section title="4 · Resultados por etapa">
        {data.stages.length === 0 ? (
          <p className="text-sm text-text-soft">Carga primero el recorrido.</p>
        ) : (
          <ol className="grid gap-1.5 sm:grid-cols-2">
            {data.stages.map((s, i) => {
              const result = resultByStage.get(s.id);
              const done = hasStageResults(result);
              const isLast = i === data.stages.length - 1;
              const withdrawn = data.riders.filter((r) => r.withdrawnEventId === s.id).length;
              return (
                <li key={s.id}>
                  <Link
                    href={`/${slug}/admin/etapas/${s.order}`}
                    className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm hover:border-verde-deep/50"
                  >
                    <span className="w-6 shrink-0 font-display">{s.order}</span>
                    <span className="shrink-0">{stageTypeInfo(s.type).icon}</span>
                    <span className="min-w-0 flex-1 truncate">
                      {s.start && s.finish ? `${s.start} → ${s.finish}` : s.name}
                    </span>
                    {withdrawn > 0 && <span className="shrink-0 text-xs text-rosa">🤕{withdrawn}</span>}
                    <span className={`shrink-0 text-xs ${done ? "text-verde" : "text-text-soft"}`}>
                      {s.cancelled ? "anulada" : done ? (isLast && hasFinalResults(result) ? "✓ + final" : "✓") : "pendiente"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </Section>

      <Section title={`5 · Edición ${lastYear} (pestaña informativa)`}>
        <EventHistoryForm
          saveUrl={`/api/competitions/${slug}/history`}
          initialYear={lastYear}
          initialRows={history}
          initialName={editions.find((e) => e.event_id === null)?.name}
        />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-2xl border border-line bg-surface p-4">
      <h2 className="mb-2 font-display text-sm text-verde-deep">{title}</h2>
      {children}
    </section>
  );
}
