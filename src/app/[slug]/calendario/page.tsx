import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompetition, getCompetitionEvents } from "@/lib/competitions-data";
import { formatCoefficient, formatEventDate, squadLabels } from "@/lib/competitions";

// Calendario de una competición: lista de sus carreras/pruebas con logo,
// fecha y coeficiente, cada una enlazando a su ficha propia. Adaptado del
// /calendario de la app de Clásicas anterior (a medida, tabla `races`) a
// cualquier competición squad_color con varios eventos.
export default async function CalendarioPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const competition = await getCompetition(slug);
  if (!competition || competition.status === "hidden") notFound();
  if (competition.game_type !== "squad_color" || !competition.squad_composition) notFound();

  const events = await getCompetitionEvents(competition.id);
  const labels = squadLabels(slug);

  return (
    <div>
      <div className="mb-1 flex items-center gap-2 font-display text-[11px] uppercase tracking-[0.16em] text-verde">
        <span className="h-1.5 w-1.5 rounded-full bg-amarillo" />
        Calendario {competition.season}
      </div>
      <h1 className="text-2xl text-verde-deep">{competition.name}</h1>
      <p className="mt-2 max-w-prose text-sm text-text-soft">
        Pincha en una carrera para ver sus datos, la edición anterior
        {competition.allows_event_draft ? ` y fichar tu ${labels.draft}` : " y elegir tu Kopman"}.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {events.map((event) => (
          <Link
            key={event.id}
            href={`/${slug}/carreras/${event.order_num}`}
            className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-3 hover:border-verde-deep/50"
          >
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 border-white bg-white">
              {event.logo_path ? (
                <Image
                  src={event.logo_path}
                  alt={event.name}
                  width={64}
                  height={64}
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-display text-[11px] text-text-soft">
                {String(event.order_num).padStart(2, "0")}
              </div>
              <div className="truncate text-sm font-semibold">{event.name}</div>
              {event.event_date && (
                <div className="text-[11px] text-text-soft">
                  {formatEventDate(event.event_date, "short")}
                </div>
              )}
              {event.stars !== null && (
                <div className="mt-0.5 text-amarillo" aria-label={`${event.stars} estrellas`}>
                  {"★".repeat(event.stars)}
                  <span className="text-line">{"★".repeat(5 - event.stars)}</span>
                </div>
              )}
            </div>
            {event.multiplier !== null && (
              <span className="shrink-0 rounded-full bg-rosa px-2.5 py-1 font-display text-[11px] font-semibold text-on-accent">
                {formatCoefficient(event.multiplier)}
              </span>
            )}
          </Link>
        ))}
        {events.length === 0 && (
          <p className="text-sm text-text-soft">Todavía no hay carreras dadas de alta.</p>
        )}
      </div>
    </div>
  );
}
