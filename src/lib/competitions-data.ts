import "server-only";
import { sql } from "./db";
import type { GameType, RiderCategory, SquadComposition } from "./competitions";

// Acceso a base de datos de competiciones, separado de ./competitions.ts
// (que solo tiene constantes/funciones puras) para que ningún componente
// cliente pueda arrastrar el driver de Postgres a su bundle por
// accidente: el import "server-only" de arriba lo convierte en un error
// de build, no en un fallo silencioso en producción.

export type Competition = {
  id: string;
  slug: string;
  name: string;
  short_name: string | null;
  game_type: GameType;
  season: number;
  status: "upcoming" | "active" | "finished" | "hidden";
  sort_order: number;
  theme_color: string | null;
  logo_path: string | null;
  has_sprint_duels: boolean;
  allows_event_draft: boolean;
  picks_lock_at: string | Date | null;
  squad_composition: SquadComposition | null;
  budget_squad_size: number | null;
  budget_cap: string | number | null;
  real_team_pick_size: number | null;
};

export async function getCompetition(slug: string): Promise<Competition | null> {
  const rows = (await sql`
    select * from competitions where slug = ${slug}
  `) as Competition[];
  return rows[0] ?? null;
}

export async function listCompetitions(): Promise<Competition[]> {
  return (await sql`
    select * from competitions order by sort_order, name
  `) as Competition[];
}

// Portada y cabecera: solo las que ya se pueden jugar (oculta 'hidden' y
// no confunde con las que aún no tienen calendario/corredores cargados).
export async function listVisibleCompetitions(): Promise<Competition[]> {
  return (await sql`
    select * from competitions where status != 'hidden' order by sort_order, name
  `) as Competition[];
}

export type CompetitionRider = {
  id: string; // competition_riders.id — lo que se guarda en team_squad
  rider_id: string;
  name: string;
  team: string | null;
  division: "worldtour" | "proteam" | null;
  category: RiderCategory | null;
  point_cost: string | number | null;
  multiplier: string | number;
  active: boolean;
};

export async function getCompetitionRiders(
  competitionId: string,
  { onlyActive = true }: { onlyActive?: boolean } = {}
): Promise<CompetitionRider[]> {
  return (await sql`
    select cr.id, cr.rider_id, r.name, r.team, r.division,
           cr.category, cr.point_cost, cr.multiplier, cr.active
    from competition_riders cr
    join riders r on r.id = cr.rider_id
    where cr.competition_id = ${competitionId}
      and (${onlyActive}::boolean = false or cr.active = true)
    order by r.division, r.team, r.name
  `) as CompetitionRider[];
}

export type CompetitionEvent = {
  id: string;
  order_num: number;
  name: string;
  event_date: string | Date | null;
  event_kind: "race" | "stage";
  stars: number | null;
  multiplier: string | number | null;
  logo_path: string | null;
};

export async function getCompetitionEvents(
  competitionId: string
): Promise<CompetitionEvent[]> {
  return (await sql`
    select id, order_num, name, event_date, event_kind, stars, multiplier, logo_path
    from competition_events
    where competition_id = ${competitionId}
    order by order_num
  `) as CompetitionEvent[];
}

export async function getEventResults(
  eventId: string
): Promise<{ competition_rider_id: string; position: number }[]> {
  return (await sql`
    select competition_rider_id, position
    from event_results
    where event_id = ${eventId}
  `) as { competition_rider_id: string; position: number }[];
}

// Todos los resultados de TODAS las carreras/pruebas de una competición de
// una vez — lo que necesita la clasificación general para sumar puntos
// por equipo sin hacer una consulta por carrera.
export async function getAllEventResults(
  competitionId: string
): Promise<
  { event_id: string; competition_rider_id: string; position: number; event_multiplier: string | number | null }[]
> {
  return (await sql`
    select er.event_id, er.competition_rider_id, er.position, ce.multiplier as event_multiplier
    from event_results er
    join competition_events ce on ce.id = er.event_id
    where ce.competition_id = ${competitionId}
  `) as {
    event_id: string;
    competition_rider_id: string;
    position: number;
    event_multiplier: string | number | null;
  }[];
}
