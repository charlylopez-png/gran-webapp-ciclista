import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCompetition,
  getCompetitionEvents,
  getCompetitionEventsHistory,
  getCompetitionResultHistory,
  getRaceEditions,
  type EventResultHistoryRow,
} from "@/lib/competitions-data";

// Pestaña "Edición <año anterior>": el top 10 de cada carrera de la edición
// pasada (en UKT, una lista por clásica; en una gran vuelta, la general; en
// una prueba única, su carrera). Solo informativa, no puntúa — sirve para
// fichar con criterio. Pública, como el reglamento.
const TOP = 10;

export default async function PreviousEditionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const competition = await getCompetition(slug);
  if (!competition || competition.status === "hidden") notFound();

  const year = competition.season - 1;
  const [events, eventsHistory, competitionHistory, editions] = await Promise.all([
    getCompetitionEvents(competition.id),
    getCompetitionEventsHistory(competition.id, year, TOP),
    getCompetitionResultHistory(competition.id, year),
    getRaceEditions(competition.id, year),
  ]);
  // Nombre/logo de ESA edición (p.ej. "Mundial de Montreal 2026"); si no
  // hay, el de la carrera actual (las clásicas no cambian de nombre).
  const editionByEvent = new Map(editions.filter((e) => e.event_id).map((e) => [e.event_id!, e]));
  const competitionEdition = editions.find((e) => e.event_id === null) ?? null;

  const historyByEvent = new Map<string, EventResultHistoryRow[]>();
  for (const row of eventsHistory) {
    if (!historyByEvent.has(row.event_id)) historyByEvent.set(row.event_id, []);
    historyByEvent.get(row.event_id)!.push(row);
  }

  const showEventList = events.length > 0;
  const nothingLoaded = eventsHistory.length === 0 && competitionHistory.length === 0;

  return (
    <div>
      <div className="mb-1 flex items-center gap-2 font-display text-[11px] uppercase tracking-[0.16em] text-verde">
        <span className="h-1.5 w-1.5 rounded-full bg-amarillo" />
        Para fichar con criterio
      </div>
      <h1 className="text-2xl text-verde-deep">Edición {year}</h1>
      <p className="mt-2 max-w-prose text-sm text-text-soft">
        Los {TOP} primeros de {showEventList && events.length > 1 ? "cada carrera" : "la carrera"} el
        año pasado. Solo informativo: no puntúa en la porra de {competition.season}.
      </p>

      {nothingLoaded && (
        <div className="mt-6 rounded-2xl border border-dashed border-line bg-surface p-6 text-center text-sm text-text-soft">
          Todavía no están cargados los resultados de {year}.
        </div>
      )}

      {competitionHistory.length > 0 && (
        <div className="mt-6">
          <ResultList
            title={competitionEdition?.name ?? competition.name}
            kicker={competition.game_type === "budget_draft" ? "Clasificación general" : undefined}
            logoPath={competitionEdition?.logo_path ?? competition.logo_path}
            rows={competitionHistory.slice(0, TOP)}
          />
        </div>
      )}

      {showEventList && eventsHistory.length > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {events.map((event) => {
            const rows = historyByEvent.get(event.id) ?? [];
            const edition = editionByEvent.get(event.id);
            return (
              <ResultList
                key={event.id}
                title={edition?.name ?? event.name}
                kicker={events.length > 1 ? `Carrera ${String(event.order_num).padStart(2, "0")}` : undefined}
                logoPath={edition?.logo_path ?? event.logo_path}
                href={`/${slug}/carreras/${event.order_num}`}
                rows={rows}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function ResultList({
  title,
  kicker,
  logoPath,
  href,
  rows,
}: {
  title: string;
  kicker?: string;
  logoPath?: string | null;
  href?: string;
  rows: EventResultHistoryRow[];
}) {
  const header = (
    <div className="flex items-center gap-3 border-b border-line px-4 py-3">
      {logoPath && (
        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-line bg-white">
          <Image src={logoPath} alt="" width={36} height={36} className="h-full w-full object-cover" />
        </div>
      )}
      <div className="min-w-0">
        {kicker && <div className="font-display text-[10px] text-text-soft">{kicker}</div>}
        <h2 className="truncate font-display text-sm text-verde-deep">{title}</h2>
      </div>
    </div>
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface">
      {href ? (
        <Link href={href} className="block hover:bg-surface-2">
          {header}
        </Link>
      ) : (
        header
      )}
      {rows.length > 0 ? (
        <ol className="divide-y divide-line">
          {rows.map((row) => (
            <li
              key={row.position}
              className={`flex items-center gap-3 px-4 py-1.5 text-sm ${
                row.position === 1 ? "bg-amarillo/20" : ""
              }`}
            >
              <span
                className={`w-5 shrink-0 text-right font-display text-xs ${
                  row.position === 1 ? "text-amarillo" : "text-text-soft"
                }`}
              >
                {row.position}
              </span>
              <span className="min-w-0 flex-1 truncate">
                {row.rider_name}
                {row.position === 1 && " 🏆"}
              </span>
              {row.team && <span className="shrink-0 truncate text-xs text-text-soft">{row.team}</span>}
            </li>
          ))}
        </ol>
      ) : (
        <p className="px-4 py-3 text-sm text-text-soft">Sin resultados cargados.</p>
      )}
    </section>
  );
}
