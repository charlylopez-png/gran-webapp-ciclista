import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  getCompetition,
  getCompetitionRiders,
  getAllEventResults,
} from "@/lib/competitions-data";
import { getUserTeams } from "@/lib/teams";
import { pointsForPosition, isPicksLocked } from "@/lib/competitions";
import CountryFlag from "@/components/country-flag";

// Clasificación general: sustituye a /mundial/clasificacion (la única de
// las dos que llegó a implementarse — la de clásicas se había quedado en
// "próximamente"). Ahora es genérica para cualquier competición
// squad_color: suma, para cada equipo, pointsForPosition(puesto) ×
// multiplicador del corredor × coeficiente de la carrera (si la
// competición tiene varias carreras con coeficiente propio, como
// Clásicas; para una prueba única como el Mundial el coeficiente es 1).
//
// Nota: todavía usa siempre la plantilla fija (team_squad) del equipo,
// también para competiciones con Last Draft por carrera — el re-fichaje
// por carrera (team_event_draft) está pendiente de pantalla propia.
export default async function ClasificacionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const competition = await getCompetition(slug);
  if (!competition || competition.status === "hidden") notFound();

  const session = await getSession();
  if (!session) return null;

  if (competition.game_type !== "squad_color") {
    return (
      <p className="text-sm text-text-soft">
        Pendiente: clasificación para el juego de presupuesto de las
        grandes vueltas.
      </p>
    );
  }

  const locked = isPicksLocked(competition.picks_lock_at);

  const squadRows = (await sql`
    select distinct t.id as team_id, t.name as team_name, u.display_name
    from team_squad ts
    join teams t on t.id = ts.team_id
    join users u on u.id = t.user_id
    where t.competition_id = ${competition.id}
    order by u.display_name
  `) as { team_id: string; team_name: string; display_name: string }[];

  const pickRows = (await sql`
    select ts.team_id, ts.competition_rider_id
    from team_squad ts
    join teams t on t.id = ts.team_id
    where t.competition_id = ${competition.id}
  `) as { team_id: string; competition_rider_id: string }[];

  const riders = await getCompetitionRiders(competition.id, { onlyActive: false });
  const ridersById = new Map(riders.map((r) => [r.id, r]));

  const results = await getAllEventResults(competition.id);
  const riderPoints = new Map<string, number>();
  for (const r of results) {
    const rider = ridersById.get(r.competition_rider_id);
    if (!rider) continue;
    const eventMultiplier = r.event_multiplier ? Number(r.event_multiplier) : 1;
    const points = pointsForPosition(r.position) * Number(rider.multiplier) * eventMultiplier;
    riderPoints.set(
      r.competition_rider_id,
      (riderPoints.get(r.competition_rider_id) ?? 0) + points
    );
  }

  const picksByTeam = new Map<string, string[]>();
  for (const row of pickRows) {
    if (!picksByTeam.has(row.team_id)) picksByTeam.set(row.team_id, []);
    picksByTeam.get(row.team_id)!.push(row.competition_rider_id);
  }

  const myTeamIds = new Set(
    (await getUserTeams(session.userId, competition.id)).map((t) => t.id)
  );

  const standings = squadRows
    .map((s) => {
      const riderIds = picksByTeam.get(s.team_id) ?? [];
      const total = riderIds.reduce((sum, id) => sum + (riderPoints.get(id) ?? 0), 0);
      return {
        teamId: s.team_id,
        displayName: s.display_name,
        teamName: s.team_name || "(sin nombre)",
        total,
        riderIds,
      };
    })
    .sort((a, b) => b.total - a.total);

  return (
    <section>
      {standings.length === 0 ? (
        <p className="text-sm text-text-soft">
          Todavía no hay ningún equipo con plantilla en esta competición.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {standings.map((s, i) => {
            const revealed = locked || myTeamIds.has(s.teamId);
            return (
              <div key={s.teamId} className="rounded-2xl border border-line bg-surface p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="font-display text-sm text-verde-deep">
                      {i + 1}. {s.teamName}
                    </span>
                    <div className="text-[11px] text-text-soft">{s.displayName}</div>
                  </div>
                  <span className="shrink-0 font-display text-lg text-amarillo">
                    {s.total.toFixed(1)}
                  </span>
                </div>
                {revealed ? (
                  <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-text-soft">
                    {s.riderIds.map((id) => {
                      const rider = ridersById.get(id);
                      if (!rider) return null;
                      return (
                        <span key={id} className="rounded-full border border-line px-2.5 py-1">
                          <CountryFlag team={rider.team} className="mr-1" />
                          {rider.name} · {(riderPoints.get(id) ?? 0).toFixed(1)}
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-2 text-[11px] text-text-faint">
                    Equipo oculto hasta que se cierren los fichajes.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
