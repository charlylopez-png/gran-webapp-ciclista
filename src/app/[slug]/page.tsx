import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getCompetition, getCompetitionEvents } from "@/lib/competitions-data";
import { getActiveTeam } from "@/lib/teams";
import { formatEventDate, isPicksLocked, squadLabels, squadSizeOf } from "@/lib/competitions";

// Inicio de una competición: reglamento en corto, estado del Equipo Base
// y la próxima carrera (con su fecha y el cierre del Last Draft), para
// que al entrar se vea de un vistazo qué toca hacer. Sustituye al
// resumen anterior (solo tarjeta de Equipo Base + enlace a Clasificación).
export default async function CompetitionHomePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const competition = await getCompetition(slug);
  if (!competition || competition.status === "hidden") notFound();

  const session = await getSession();
  if (!session || session.status !== "approved") {
    return (
      <p className="text-sm text-text-soft">
        {session
          ? "Tu cuenta todavía no está aprobada."
          : "Inicia sesión para apuntarte a esta competición."}
      </p>
    );
  }

  // Giro/Tour/Vuelta: dadas de alta para reservar su hueco en la portada,
  // pero su motor de fichaje por presupuesto todavía no existe.
  if (competition.game_type !== "squad_color" || !competition.squad_composition) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="font-display text-sm text-verde-deep">Muy pronto</h2>
        <p className="mt-1 text-sm text-text-soft">
          El fichaje por presupuesto de {competition.short_name ?? competition.name}{" "}
          está en marcha. En cuanto esté listo el reglamento y los corredores,
          podrás armar tu equipo aquí.
        </p>
      </div>
    );
  }

  const { activeTeam } = await getActiveTeam(session.userId, competition.id);
  const [{ count }] = (await sql`
    select count(*)::int as count from team_squad where team_id = ${activeTeam.id}
  `) as { count: number }[];

  const squadSize = squadSizeOf(competition.squad_composition);
  const labels = squadLabels(slug);
  const hasEventDraft = competition.allows_event_draft;

  const events = await getCompetitionEvents(competition.id);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextEvent =
    events.find((e) => e.event_date && new Date(e.event_date) >= today) ??
    events[events.length - 1] ??
    null;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="font-display text-sm text-verde-deep">Reglamento, en corto</h2>
        <p className="mt-1 text-sm leading-relaxed text-text-soft">
          Puntos por puesto × coeficiente de la carrera × coeficiente del
          corredor. {events.length > 0 && `${events.length} carreras`}
          {competition.squad_composition && `, plantilla de ${squadSize} corredores`}.
        </p>
        <Link
          href={`/${slug}/reglamento`}
          className="mt-3 inline-block rounded-full border border-line px-4 py-2 font-display text-xs uppercase tracking-wide text-verde-deep hover:border-verde-deep/50"
        >
          Ver el reglamento completo
        </Link>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="font-display text-sm text-verde-deep">{activeTeam.name}</h2>
        <p className="mt-1 text-sm text-text-soft">
          {labels.base}: {count}/{squadSize} corredores fichados.
        </p>
        <Link
          href={`/${slug}/equipo`}
          className="mt-3 inline-block rounded-full bg-[var(--accent)] px-4 py-2 font-display text-xs uppercase tracking-wide text-on-accent hover:brightness-110"
        >
          Editar mi {labels.base}
        </Link>
      </div>

      {nextEvent && (
        <Link
          href={`/${slug}/carreras/${nextEvent.order_num}`}
          className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 hover:border-verde-deep/50"
        >
          {nextEvent.logo_path ? (
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 border-white bg-white">
              <Image
                src={nextEvent.logo_path}
                alt={nextEvent.name}
                width={64}
                height={64}
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="h-16 w-16 shrink-0 rounded-xl bg-[var(--pill-bg)]" />
          )}
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[11px] uppercase tracking-wide text-verde-deep">
              Próxima carrera
            </h2>
            <div className="truncate text-base font-semibold">{nextEvent.name}</div>
            {nextEvent.event_date && (
              <div className="text-sm text-text-soft">
                {formatEventDate(nextEvent.event_date)}
              </div>
            )}
            {nextEvent.picks_lock_at && (
              <div
                className={`mt-0.5 text-xs font-display uppercase tracking-wide ${
                  isPicksLocked(nextEvent.picks_lock_at) ? "text-rosa" : "text-verde"
                }`}
              >
                {isPicksLocked(nextEvent.picks_lock_at)
                  ? `${hasEventDraft ? labels.draft : "Fichaje"} cerrado`
                  : `${hasEventDraft ? labels.draft : "Fichaje"} hasta ${formatEventDate(nextEvent.picks_lock_at, "short")}`}
              </div>
            )}
          </div>
        </Link>
      )}

      <Link
        href={`/${slug}/clasificacion`}
        className="rounded-2xl border border-line bg-surface p-4 hover:border-verde-deep/50"
      >
        <h2 className="font-display text-sm text-verde-deep">Clasificación</h2>
        <p className="mt-1 text-sm text-text-soft">Ver cómo va la porra.</p>
      </Link>
    </div>
  );
}
