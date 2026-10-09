import "server-only";
import { sql } from "./db";
import type { Competition } from "./competitions-data";
import type {
  GtListEntry,
  GtRoster,
  GtStage,
  GtStageResult,
  ListKind,
} from "./grand-tour";

// Acceso a datos de las grandes vueltas (budget_draft). Todo lo que
// necesitan las pantallas se carga de una vez por competición — son pocas
// filas (21 etapas, ~180 corredores, unas decenas de participantes) y así
// cada página calcula la clasificación sin una consulta por etapa.

export type GtConfig = {
  budget: number;
  squadSize: number;
  benchSize: number;
  realTeamPicks: number;
};

// Configuración de la competición, o null si todavía no está montada (Tour y
// Vuelta hasta que se clonen del Giro).
export function grandTourConfig(competition: Competition): GtConfig | null {
  if (competition.game_type !== "budget_draft") return null;
  if (!competition.budget_cap || !competition.budget_squad_size) return null;
  return {
    budget: Number(competition.budget_cap),
    squadSize: competition.budget_squad_size,
    benchSize: competition.budget_bench_size ?? 0,
    realTeamPicks: competition.real_team_pick_size ?? 0,
  };
}

export type GtRider = {
  id: string; // competition_riders.id
  name: string;
  team: string | null;
  nationality: string | null; // ISO de 2 letras, para la bandera
  price: number;
  active: boolean;
  withdrawnEventId: string | null;
};

export type GtRealTeam = { id: string; name: string };

export type GtStageInfo = GtStage & {
  name: string;
  date: string | null;
  type: string | null;
  start: string | null;
  finish: string | null;
  km: number | null;
  profileImage: string | null;
};

export type GtRestDay = { date: string; place: string | null };

export type GtData = {
  riders: GtRider[];
  realTeams: GtRealTeam[];
  stages: GtStageInfo[];
  restDays: GtRestDay[];
  results: GtStageResult[];
  rosters: GtRoster[];
};

// postgres.js devuelve `date` como Date (UTC) o como string según versión.
function isoDate(value: string | Date | null): string | null {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

export async function getGrandTourRiders(competitionId: string): Promise<GtRider[]> {
  const rows = (await sql`
    select cr.id, r.name, coalesce(cr.team, r.team) as team, r.nationality, cr.point_cost, cr.active, cr.withdrawn_event_id
    from competition_riders cr
    join riders r on r.id = cr.rider_id
    where cr.competition_id = ${competitionId}
    order by coalesce(cr.team, r.team) nulls last, r.name
  `) as {
    id: string;
    name: string;
    team: string | null;
    nationality: string | null;
    point_cost: string | number | null;
    active: boolean;
    withdrawn_event_id: string | null;
  }[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    team: r.team,
    nationality: r.nationality,
    price: Number(r.point_cost ?? 0),
    active: r.active,
    withdrawnEventId: r.withdrawn_event_id,
  }));
}

export async function getGrandTourRealTeams(competitionId: string): Promise<GtRealTeam[]> {
  return (await sql`
    select id, name from competition_real_teams
    where competition_id = ${competitionId} and active = true
    order by name
  `) as GtRealTeam[];
}

export async function getGrandTourStages(competitionId: string): Promise<GtStageInfo[]> {
  const rows = (await sql`
    select id, order_num, name, event_date, stage_type, start_place, finish_place,
           distance_km, cancelled, profile_image_path
    from competition_events
    where competition_id = ${competitionId}
    order by order_num
  `) as {
    id: string;
    order_num: number;
    name: string;
    event_date: string | Date | null;
    stage_type: string | null;
    start_place: string | null;
    finish_place: string | null;
    distance_km: string | number | null;
    cancelled: boolean;
    profile_image_path: string | null;
  }[];
  return rows.map((r) => ({
    id: r.id,
    order: r.order_num,
    name: r.name,
    date: isoDate(r.event_date),
    type: r.stage_type,
    start: r.start_place,
    finish: r.finish_place,
    km: r.distance_km === null ? null : Number(r.distance_km),
    cancelled: r.cancelled,
    profileImage: r.profile_image_path,
  }));
}

export async function getGrandTourRestDays(competitionId: string): Promise<GtRestDay[]> {
  const rows = (await sql`
    select rest_date, place from competition_rest_days
    where competition_id = ${competitionId}
    order by rest_date
  `) as { rest_date: string | Date; place: string | null }[];
  return rows.map((r) => ({ date: isoDate(r.rest_date)!, place: r.place }));
}

export async function getGrandTourResults(competitionId: string): Promise<GtStageResult[]> {
  const rows = (await sql`
    select l.event_id, l.list_kind, l.position, l.entry_name,
           l.competition_rider_id, l.competition_real_team_id
    from stage_result_lists l
    join competition_events e on e.id = l.event_id
    where e.competition_id = ${competitionId}
    order by l.event_id, l.list_kind, l.position
  `) as {
    event_id: string;
    list_kind: ListKind;
    position: number;
    entry_name: string;
    competition_rider_id: string | null;
    competition_real_team_id: string | null;
  }[];
  const byStage = new Map<string, GtStageResult>();
  for (const r of rows) {
    if (!byStage.has(r.event_id)) byStage.set(r.event_id, { stageId: r.event_id, lists: {} });
    const result = byStage.get(r.event_id)!;
    const entry: GtListEntry = {
      position: r.position,
      name: r.entry_name,
      riderId: r.competition_rider_id,
      teamId: r.competition_real_team_id,
    };
    (result.lists[r.list_kind] ??= []).push(entry);
  }
  return Array.from(byStage.values());
}

// Plantillas de todos los participantes (titulares, suplentes, equipos y
// sustituciones). Solo los equipos que han guardado algo.
export async function getGrandTourRosters(competitionId: string): Promise<GtRoster[]> {
  const teams = (await sql`
    select t.id, t.name, u.display_name
    from teams t join users u on u.id = t.user_id
    where t.competition_id = ${competitionId}
      and (exists (select 1 from team_squad s where s.team_id = t.id)
           or exists (select 1 from team_squad_real_teams rt where rt.team_id = t.id))
    order by t.created_at
  `) as { id: string; name: string; display_name: string }[];
  if (teams.length === 0) return [];
  const ids = teams.map((t) => t.id);

  const [squad, realTeams, subs] = await Promise.all([
    sql`select team_id, competition_rider_id, role from team_squad where team_id = any(${ids}::uuid[])` as unknown as Promise<
      { team_id: string; competition_rider_id: string; role: "titular" | "suplente" }[]
    >,
    sql`select team_id, competition_real_team_id from team_squad_real_teams where team_id = any(${ids}::uuid[])` as unknown as Promise<
      { team_id: string; competition_real_team_id: string }[]
    >,
    sql`
      select s.team_id, s.out_rider_id, s.in_rider_id, e.order_num
      from team_substitutions s join competition_events e on e.id = s.from_event_id
      where s.team_id = any(${ids}::uuid[])
    ` as unknown as Promise<
      { team_id: string; out_rider_id: string; in_rider_id: string; order_num: number }[]
    >,
  ]);

  return teams.map((t) => ({
    teamId: t.id,
    teamName: t.name,
    ownerName: t.display_name,
    starters: squad.filter((s) => s.team_id === t.id && s.role === "titular").map((s) => s.competition_rider_id),
    bench: squad.filter((s) => s.team_id === t.id && s.role === "suplente").map((s) => s.competition_rider_id),
    realTeams: realTeams.filter((r) => r.team_id === t.id).map((r) => r.competition_real_team_id),
    substitutions: subs
      .filter((s) => s.team_id === t.id)
      .map((s) => ({ outRiderId: s.out_rider_id, inRiderId: s.in_rider_id, fromOrder: s.order_num })),
  }));
}

export async function getGrandTourData(competitionId: string): Promise<GtData> {
  const [riders, realTeams, stages, restDays, results, rosters] = await Promise.all([
    getGrandTourRiders(competitionId),
    getGrandTourRealTeams(competitionId),
    getGrandTourStages(competitionId),
    getGrandTourRestDays(competitionId),
    getGrandTourResults(competitionId),
    getGrandTourRosters(competitionId),
  ]);
  return { riders, realTeams, stages, restDays, results, rosters };
}

// Mapas de nombres/precios que necesitan los componentes que pintan
// plantillas (TeamRoster) — se construyen una vez por página.
export function buildRosterLookup(data: GtData) {
  return {
    riders: new Map(
      data.riders.map((r) => [
        r.id,
        {
          name: r.name,
          team: r.team,
          nationality: r.nationality,
          price: r.price,
          withdrawn: Boolean(r.withdrawnEventId),
        },
      ])
    ),
    teams: new Map(data.realTeams.map((t) => [t.id, t.name])),
    stageOrderById: new Map(data.stages.map((s) => [s.id, s.order])),
  };
}

// Precio más bajo de la competición (el "escalón de 50"): marca cuándo un
// suplente puede valer lo mismo que el titular al que sustituye.
export function lowestPriceTier(riders: GtRider[]) {
  const prices = riders.filter((r) => r.price > 0).map((r) => r.price);
  return prices.length > 0 ? Math.min(...prices) : 50;
}

// ¿Puede este usuario poner precios? El admin siempre; el sanedrín también,
// comprobado contra la base de datos (el token puede estar desactualizado).
export async function canManagePrices(session: { userId: string; role: string } | null) {
  if (!session) return false;
  if (session.role === "admin") return true;
  const [row] = (await sql`
    select is_sanedrin from users where id = ${session.userId}
  `) as { is_sanedrin: boolean }[];
  return Boolean(row?.is_sanedrin);
}
