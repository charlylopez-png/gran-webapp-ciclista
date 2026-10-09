import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  getCompetition,
  getCompetitionRiders,
  getCompetitionEvents,
  getAllEventResults,
  getAllTeamEventDraft,
  getAllEventKopman,
} from "@/lib/competitions-data";
import { getUserTeams } from "@/lib/teams";
import { pointsForPosition, isPicksLocked, kopmanAdjustment } from "@/lib/competitions";
import CountryFlag from "@/components/country-flag";
import { grandTourConfig } from "@/lib/grand-tour-data";
import GrandTourClasificacion from "./grand-tour-clasificacion";

// Clasificación general: suma, carrera a carrera, los puntos de cada
// equipo. En cada carrera cuentan TODOS los corredores que forman parte
// de ella para ese equipo: su Klassiekerkern/Equipo Base (fijo toda la
// temporada) MÁS su Wedstrijdselectie/Last Draft de esa carrera concreta
// (si la competición la usa — team_event_draft). A ese total se le aplica
// el ajuste de Kopman: si el Kopman de esa carrera puntuó, sus puntos
// cuentan una vez más (×2 en total); si la carrera ya tiene resultado
// cargado y no puntuó, resta 50 puntos fijos (ver kopmanAdjustment).
//
// pointsForPosition(puesto) × multiplicador del corredor × coeficiente de
// la carrera (×1 en una prueba única como Mundial/Europeo/Lombardia).
export default async function ClasificacionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ vista?: string }>;
}) {
  const { slug } = await params;
  const competition = await getCompetition(slug);
  if (!competition || competition.status === "hidden") notFound();

  const session = await getSession();
  if (!session) return null;

  if (grandTourConfig(competition)) {
    const { vista } = await searchParams;
    return (
      <GrandTourClasificacion
        competition={competition}
        session={session}
        view={vista === "ultima" ? "ultima" : "general"}
      />
    );
  }

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

  const events = await getCompetitionEvents(competition.id);
  const results = await getAllEventResults(competition.id);
  const draftRows = await getAllTeamEventDraft(competition.id);
  const kopmanRows = await getAllEventKopman(competition.id);

  // Puntos de CADA corredor en CADA carrera (puesto × su multiplicador ×
  // coeficiente de esa carrera) — se usa tanto para el total por equipo
  // como para el total "de siempre" que se enseña junto a cada corredor.
  const pointsByEventRider = new Map<string, number>();
  const riderPoints = new Map<string, number>();
  const eventsWithResults = new Set<string>();
  for (const r of results) {
    const rider = ridersById.get(r.competition_rider_id);
    if (!rider) continue;
    eventsWithResults.add(r.event_id);
    const eventMultiplier = r.event_multiplier ? Number(r.event_multiplier) : 1;
    const points = pointsForPosition(r.position) * Number(rider.multiplier) * eventMultiplier;
    pointsByEventRider.set(`${r.event_id}:${r.competition_rider_id}`, points);
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

  // Wedstrijdselectie/Last Draft de cada equipo, por carrera.
  const draftByTeamEvent = new Map<string, string[]>();
  for (const row of draftRows) {
    const key = `${row.team_id}:${row.event_id}`;
    if (!draftByTeamEvent.has(key)) draftByTeamEvent.set(key, []);
    draftByTeamEvent.get(key)!.push(row.competition_rider_id);
  }

  // Kopman elegido por cada equipo, por carrera.
  const kopmanByTeamEvent = new Map<string, string>();
  for (const row of kopmanRows) {
    kopmanByTeamEvent.set(`${row.team_id}:${row.event_id}`, row.competition_rider_id);
  }

  const myTeamIds = new Set(
    (await getUserTeams(session.userId, competition.id)).map((t) => t.id)
  );

  const standings = squadRows
    .map((s) => {
      const riderIds = picksByTeam.get(s.team_id) ?? [];
      let total = 0;
      for (const event of events) {
        const draftIds = draftByTeamEvent.get(`${s.team_id}:${event.id}`) ?? [];
        const effectiveIds = new Set([...riderIds, ...draftIds]);
        let eventTotal = 0;
        for (const id of effectiveIds) {
          eventTotal += pointsByEventRider.get(`${event.id}:${id}`) ?? 0;
        }

        // Solo cuenta si sigue siendo uno de los corredores de esa carrera
        // (si luego lo quitó de su plantilla, es como no haber elegido).
        const chosenKopman = kopmanByTeamEvent.get(`${s.team_id}:${event.id}`) ?? null;
        const kopmanRiderId = chosenKopman && effectiveIds.has(chosenKopman) ? chosenKopman : null;
        const kopmanPoints = kopmanRiderId
          ? pointsByEventRider.get(`${event.id}:${kopmanRiderId}`) ?? 0
          : null;
        eventTotal += kopmanAdjustment({
          hasResult: eventsWithResults.has(event.id),
          kopmanPoints,
        });

        total += eventTotal;
      }
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
