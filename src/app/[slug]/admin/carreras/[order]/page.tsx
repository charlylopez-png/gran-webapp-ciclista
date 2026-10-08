import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import {
  getCompetition,
  getCompetitionEvent,
  getCompetitionRiders,
  getEventHistoryYears,
  getEventResultHistory,
  getEventResults,
} from "@/lib/competitions-data";
import EventResultsForm from "@/components/admin/event-results-form";
import EventHistoryForm from "@/components/admin/event-history-form";

// Admin de UNA carrera: su resultado oficial (top 20, lo que puntúa) y la
// edición pasada (solo informativa, se enseña en la ficha de la carrera).
// Vive aparte de /[slug]/admin porque son listas largas.
export default async function EventAdminPage({
  params,
}: {
  params: Promise<{ slug: string; order: string }>;
}) {
  const { slug, order } = await params;
  const orderNum = Number(order);
  if (!Number.isInteger(orderNum)) notFound();

  const competition = await getCompetition(slug);
  if (!competition || competition.status === "hidden") notFound();

  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") notFound();

  const event = await getCompetitionEvent(competition.id, orderNum);
  if (!event) notFound();

  const [competitionRiders, results, historyYears] = await Promise.all([
    getCompetitionRiders(competition.id),
    getEventResults(event.id),
    getEventHistoryYears(event.id),
  ]);
  const latestYear = historyYears[0] ?? competition.season - 1;
  const history = historyYears.length > 0 ? await getEventResultHistory(event.id, latestYear) : [];

  return (
    <div>
      <Link href={`/${slug}/admin`} className="text-xs text-text-soft hover:text-verde-deep">
        ← Admin
      </Link>
      <div className="mt-3 mb-1 flex items-center gap-2 font-display text-[11px] uppercase tracking-[0.16em] text-verde">
        <span className="h-1.5 w-1.5 rounded-full bg-amarillo" />
        Carrera {String(event.order_num).padStart(2, "0")}
      </div>
      <h1 className="text-2xl text-verde-deep">{event.name}</h1>

      <section className="mt-6 rounded-2xl border border-line bg-surface p-4">
        <h2 className="font-display text-sm text-verde-deep">Resultado {competition.season}</h2>
        <p className="mt-1 text-sm text-text-soft">
          Los 20 primeros: es lo que reparte puntos en la clasificación.
        </p>
        <div className="mt-3">
          <EventResultsForm
            slug={slug}
            eventId={event.id}
            riders={competitionRiders.map((r) => ({
              id: r.id,
              name: r.name,
              team: r.team,
              category: r.category,
            }))}
            initialResults={results}
          />
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-surface p-4">
        <h2 className="font-display text-sm text-verde-deep">Edición pasada</h2>
        <p className="mt-1 text-sm text-text-soft">
          Solo informativa: se enseña en la ficha de la carrera y no puntúa.
        </p>
        <div className="mt-3">
          <EventHistoryForm
            saveUrl={`/api/competitions/${slug}/events/${event.id}/history`}
            initialYear={latestYear}
            initialRows={history}
          />
        </div>
      </section>
    </div>
  );
}
