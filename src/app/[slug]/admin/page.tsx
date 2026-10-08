import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import {
  getCompetition,
  getCompetitionEvents,
  getCompetitionResultHistory,
} from "@/lib/competitions-data";
import EventHistoryForm from "@/components/admin/event-history-form";
import { squadLabels } from "@/lib/competitions";
import CompetitionLockForm from "@/components/admin/competition-lock-form";
import EventAdminRow from "@/components/admin/event-admin-row";

// Panel de admin de UNA competición: cierre del Equipo Base y, para cada
// carrera, su fecha/web oficial/cierre de Last Draft/estrellas/
// coeficiente. Los resultados y la edición pasada de cada carrera viven
// en su propia pantalla (ver carreras/[order]/page.tsx) porque son listas
// largas, no caben cómodamente aquí.
export default async function CompetitionAdminPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const competition = await getCompetition(slug);
  if (!competition || competition.status === "hidden") notFound();

  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") notFound();

  const events =
    competition.game_type === "squad_color" && competition.squad_composition
      ? await getCompetitionEvents(competition.id)
      : [];
  const labels = squadLabels(slug);

  return (
    <div>
      <div className="mb-1 flex items-center gap-2 font-display text-[11px] uppercase tracking-[0.16em] text-verde">
        <span className="h-1.5 w-1.5 rounded-full bg-amarillo" />
        Administración
      </div>
      <h1 className="text-2xl text-verde-deep">{competition.name}</h1>

      <section className="mt-6 rounded-2xl border border-line bg-surface p-4">
        <h2 className="font-display text-sm text-verde-deep">Cierre del {labels.base}</h2>
        <p className="mt-1 text-sm text-text-soft">
          A partir de esta fecha nadie puede tocar su {labels.base}, y en{" "}
          {slug === "clasicas" ? "Equipos" : "la pestaña Equipos"} se enseña la
          plantilla de todo el mundo.
        </p>
        <div className="mt-3">
          <CompetitionLockForm slug={slug} picksLockAt={competition.picks_lock_at} />
        </div>
      </section>

      {events.length === 0 && (
        <section className="mt-6 rounded-2xl border border-line bg-surface p-4">
          <h2 className="font-display text-sm text-verde-deep">
            Edición {competition.season - 1}
            {competition.game_type === "budget_draft" ? " · clasificación general" : ""}
          </h2>
          <p className="mt-1 text-sm text-text-soft">
            Se enseña en la pestaña &quot;Edición {competition.season - 1}&quot; (los 10 primeros).
            Solo informativa, no puntúa.
          </p>
          <div className="mt-3">
            <EventHistoryForm
              saveUrl={`/api/competitions/${slug}/history`}
              initialYear={competition.season - 1}
              initialRows={await getCompetitionResultHistory(competition.id, competition.season - 1)}
            />
          </div>
        </section>
      )}

      {events.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-sm text-verde-deep">Carreras</h2>
          <div className="mt-3 flex flex-col gap-3">
            {events.map((event) => (
              <EventAdminRow key={event.id} slug={slug} event={event} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
