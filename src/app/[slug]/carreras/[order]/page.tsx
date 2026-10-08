import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import {
  getCompetition,
  getCompetitionEvent,
  getCompetitionRiders,
  getEventResultHistory,
  getEventHistoryYears,
  getEventKopman,
} from "@/lib/competitions-data";
import { getActiveTeam } from "@/lib/teams";
import {
  formatCoefficient,
  formatEventDate,
  isPicksLocked,
  squadLabels,
  type RiderCategory,
} from "@/lib/competitions";
import SquadSelector, { type SelectableRider } from "@/components/squad-selector";
import TeamSwitcher from "@/components/team-switcher";
import KopmanSelector, { type KopmanRider } from "@/components/kopman-selector";

// Ficha de una carrera/prueba: datos (logo, coeficiente, fecha, cierre de
// fichajes), edición anterior (top 20, si hay histórico cargado) y el
// Last Draft de esa carrera. Sustituye a /calendario/[order] de la app de
// Clásicas anterior, adaptado al modelo de competiciones unificado.
export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ slug: string; order: string }>;
}) {
  const { slug, order } = await params;
  const orderNum = Number(order);
  if (!Number.isInteger(orderNum)) notFound();

  const competition = await getCompetition(slug);
  if (!competition || competition.status === "hidden") notFound();
  if (competition.game_type !== "squad_color" || !competition.squad_composition) notFound();

  const event = await getCompetitionEvent(competition.id, orderNum);
  if (!event) notFound();

  const historyYears = await getEventHistoryYears(event.id);
  const latestYear = historyYears[0] ?? null;
  const history = latestYear ? await getEventResultHistory(event.id, latestYear) : [];

  const session = await getSession();
  const canDraft = Boolean(session && (session.role === "admin" || session.status === "approved"));
  const eventLocked = isPicksLocked(event.picks_lock_at);

  const labels = squadLabels(slug);
  const hasEventDraft = competition.allows_event_draft && Boolean(competition.event_squad_composition);

  let riders: SelectableRider[] = [];
  let initialSelectedIds: string[] = [];
  let teams: { id: string; name: string }[] = [];
  let activeTeamId = "";
  let kopmanPool: KopmanRider[] = [];
  let kopmanRiderId: string | null = null;
  if (canDraft && session) {
    const { teams: userTeams, activeTeam } = await getActiveTeam(session.userId, competition.id);
    teams = userTeams;
    activeTeamId = activeTeam.id;

    const competitionRiders = await getCompetitionRiders(competition.id);
    const ridersById = new Map(competitionRiders.map((r) => [r.id, r]));
    riders = competitionRiders
      .filter((r) => r.category !== null)
      .map((r) => ({
        id: r.id,
        name: r.name,
        team: r.team,
        division: r.division,
        category: r.category!,
      }));

    const squadRows = (await sql`
      select competition_rider_id from team_squad where team_id = ${activeTeam.id}
    `) as { competition_rider_id: string }[];

    if (hasEventDraft) {
      const picks = (await sql`
        select competition_rider_id from team_event_draft
        where team_id = ${activeTeam.id} and event_id = ${event.id}
      `) as { competition_rider_id: string }[];
      initialSelectedIds = picks.map((p) => p.competition_rider_id);
    }

    // El Kopman se elige entre el Klassiekerkern/Equipo Base y, si esta
    // competición tiene fichaje por carrera, también la Wedstrijdselectie/
    // Last Draft ya guardada de ESTA carrera.
    const kopmanIds = new Set([...squadRows.map((r) => r.competition_rider_id), ...initialSelectedIds]);
    kopmanPool = Array.from(kopmanIds)
      .map((id) => ridersById.get(id))
      .filter((r): r is NonNullable<typeof r> => Boolean(r && r.category))
      .map((r) => ({ id: r.id, name: r.name, category: r.category as RiderCategory }))
      .sort((a, b) => a.name.localeCompare(b.name));
    kopmanRiderId = await getEventKopman(activeTeam.id, event.id);
  }

  const showFlags = competition.slug === "mundial";

  return (
    <div>
      <Link
        href={`/${slug}/calendario`}
        className="text-xs text-text-soft hover:text-verde-deep"
      >
        ← Calendario
      </Link>

      <div className="mt-3 flex items-center gap-4">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-2 border-white bg-white">
          {event.logo_path ? (
            <Image
              src={event.logo_path}
              alt={event.name}
              width={80}
              height={80}
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>
        <div className="min-w-0">
          <div className="font-display text-[11px] text-text-soft">
            Carrera {String(event.order_num).padStart(2, "0")}
          </div>
          <h1 className="text-2xl text-verde-deep">{event.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            {event.stars !== null && (
              <span className="text-amarillo" aria-label={`${event.stars} estrellas`}>
                {"★".repeat(event.stars)}
                <span className="text-line">{"★".repeat(5 - event.stars)}</span>
              </span>
            )}
            {event.multiplier !== null && (
              <span className="rounded-full bg-rosa px-2.5 py-1 font-display text-[11px] font-semibold text-on-accent">
                {formatCoefficient(event.multiplier)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-soft">
        <span>{event.event_date ? formatEventDate(event.event_date) : "Fecha por confirmar."}</span>
        {event.official_url && (
          <a
            href={event.official_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-verde-deep underline underline-offset-2"
          >
            Web oficial ↗
          </a>
        )}
      </div>

      {event.picks_lock_at && (
        <p
          className={`mt-2 font-display text-xs uppercase tracking-wide ${
            eventLocked ? "text-rosa" : "text-verde"
          }`}
        >
          {hasEventDraft
            ? eventLocked
              ? `${labels.draft} de esta carrera cerrada.`
              : `${labels.draft} abierta hasta ${formatEventDate(event.picks_lock_at)}.`
            : eventLocked
            ? "Fichajes de esta carrera cerrados."
            : `Fichajes de esta carrera abiertos hasta ${formatEventDate(event.picks_lock_at)}.`}
        </p>
      )}

      <section className="mt-8">
        <h2 className="font-display text-sm text-verde-deep">
          {latestYear ? `Edición ${latestYear}` : "Edición pasada"}
        </h2>
        {history.length > 0 ? (
          <>
            <p className="mt-1 text-sm text-text-soft">
              {history[0] && (
                <>
                  Ganador: <b className="text-verde-deep">{history[0].rider_name}</b>
                  {history[0].team ? ` (${history[0].team})` : ""}.
                </>
              )}
            </p>
            <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-surface">
              <ol className="divide-y divide-line">
                {history.map((row) => (
                  <li
                    key={row.position}
                    className={`flex items-center gap-3 px-4 py-2 text-sm ${
                      row.position === 1 ? "bg-amarillo/20" : ""
                    }`}
                  >
                    <span
                      className={`w-6 shrink-0 text-right font-display text-xs ${
                        row.position === 1 ? "text-amarillo" : "text-text-soft"
                      }`}
                    >
                      {row.position}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {row.rider_name}
                      {row.position === 1 && " 🏆"}
                    </span>
                    {row.team && (
                      <span className="shrink-0 truncate text-xs text-text-soft">{row.team}</span>
                    )}
                  </li>
                ))}
              </ol>
            </div>
            {history.length < 20 && (
              <p className="mt-2 text-[11px] text-text-soft">
                De momento solo hay {history.length} posiciones confirmadas de esta edición.
              </p>
            )}
          </>
        ) : (
          <p className="mt-1 text-sm text-text-soft">
            Todavía no hay histórico cargado de esta carrera.
          </p>
        )}
      </section>

      <section className="mt-8 flex flex-wrap gap-3">
        <Link
          href={`/${slug}/equipos`}
          className="rounded-full border border-line px-4 py-2 font-display text-xs uppercase tracking-wide text-verde-deep hover:border-verde-deep/50"
        >
          Ver equipos
        </Link>
        <Link
          href={`/${slug}/clasificacion`}
          className="rounded-full border border-line px-4 py-2 font-display text-xs uppercase tracking-wide text-verde-deep hover:border-verde-deep/50"
        >
          Ver clasificación
        </Link>
      </section>

      {hasEventDraft && (
        <section className="mt-10 pb-6">
          <h2 className="font-display text-sm text-verde-deep">Tu {labels.draft} para esta carrera</h2>
          <p className="mt-1 text-sm text-text-soft">
            {competition.event_squad_composition!.amarillo} amarillo,{" "}
            {competition.event_squad_composition!.rojo} rojo,{" "}
            {competition.event_squad_composition!.rosa} rosas y{" "}
            {competition.event_squad_composition!.verde} verdes, solo para esta carrera —
            se suman a tu {labels.base} para puntuar aquí.
          </p>

          {canDraft ? (
            <div className="mt-4 rounded-2xl bg-surface p-4">
              <TeamSwitcher teams={teams} activeTeamId={activeTeamId} competitionId={competition.id} />
              <SquadSelector
                key={activeTeamId}
                riders={riders}
                initialSelectedIds={initialSelectedIds}
                saveUrl={`/api/competitions/${slug}/events/${event.id}/draft`}
                squadComposition={competition.event_squad_composition!}
                showFlags={showFlags}
                showDivisionFilter={!showFlags}
                groupLabel={showFlags ? "Sin país" : "Sin equipo"}
                locked={eventLocked}
              />
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-line bg-surface p-6 text-center text-sm text-text-soft">
              {session ? (
                "Tu cuenta todavía no está aprobada."
              ) : (
                <>
                  <Link href="/login" className="text-verde-deep underline">
                    Inicia sesión
                  </Link>{" "}
                  para fichar tu equipo de esta carrera.
                </>
              )}
            </div>
          )}
        </section>
      )}

      {canDraft && (
        <section className="mt-10 pb-6">
          <h2 className="font-display text-sm text-verde-deep">Kopman de esta carrera</h2>
          <div className="mt-4 rounded-2xl bg-surface p-4">
            <KopmanSelector
              key={activeTeamId}
              riders={kopmanPool}
              initialRiderId={kopmanRiderId}
              saveUrl={`/api/competitions/${slug}/events/${event.id}/kopman`}
              locked={eventLocked}
            />
          </div>
        </section>
      )}
    </div>
  );
}
