import "server-only";
import { cookies } from "next/headers";
import { sql } from "./db";

// Un jugador puede tener más de un equipo POR COMPETICIÓN (dos equipos
// distintos en el Tour, uno en Clásicas, etc.): cada uno es una entrada
// independiente en esa porra, con su propia plantilla. `teams` es la
// entidad que representa cada una de esas entradas; `users` sigue siendo
// solo la cuenta con la que se inicia sesión.

export const DEFAULT_TEAM_NAME = "Mi equipo";
export const TEAM_NAME_MAX_LEN = 60;

export type Team = {
  id: string;
  name: string;
  user_id: string;
  competition_id: string;
};

// Una cookie de "equipo activo" POR competición, para que cambiar de
// equipo en el Tour no afecte a cuál tienes abierto en Clásicas.
export function activeTeamCookieName(competitionId: string) {
  return `ukt_active_team_${competitionId}`;
}

export async function getUserTeams(
  userId: string,
  competitionId: string
): Promise<Team[]> {
  return (await sql`
    select id, name, user_id, competition_id
    from teams
    where user_id = ${userId} and competition_id = ${competitionId}
    order by created_at
  `) as Team[];
}

// Cada jugador elige el nombre de cada uno de sus equipos, y tiene que
// ser distinto de los demás equipos SUYOS EN LA MISMA COMPETICIÓN (puede
// repetir nombre en otra competición, y no hace falta que sea único entre
// jugadores distintos). Se comprueba a nivel de aplicación para dar un
// mensaje claro, y además hay un índice único en la base de datos como
// red de seguridad por si dos peticiones llegan a la vez.
export class DuplicateTeamNameError extends Error {}

function isUniqueViolation(err: unknown): boolean {
  return Boolean(err && typeof err === "object" && "code" in err && err.code === "23505");
}

async function assertNameAvailable(
  userId: string,
  competitionId: string,
  name: string,
  excludeTeamId?: string
) {
  const existing = (await sql`
    select id from teams
    where user_id = ${userId} and competition_id = ${competitionId}
      and lower(name) = lower(${name})
      and id <> ${excludeTeamId ?? "00000000-0000-0000-0000-000000000000"}
  `) as { id: string }[];
  if (existing.length > 0) {
    throw new DuplicateTeamNameError(`Ya tienes un equipo llamado "${name}" en esta competición. Elige otro nombre.`);
  }
}

export async function createTeam(
  userId: string,
  competitionId: string,
  name: string
): Promise<Team> {
  const trimmed = name.trim().slice(0, TEAM_NAME_MAX_LEN) || DEFAULT_TEAM_NAME;
  await assertNameAvailable(userId, competitionId, trimmed);
  try {
    const [team] = (await sql`
      insert into teams (user_id, competition_id, name)
      values (${userId}, ${competitionId}, ${trimmed})
      returning id, name, user_id, competition_id
    `) as Team[];
    return team;
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new DuplicateTeamNameError(`Ya tienes un equipo llamado "${trimmed}" en esta competición. Elige otro nombre.`);
    }
    throw err;
  }
}

// Renombra un equipo ya existente (se usa, por ejemplo, al guardar el
// nombre de equipo desde las pantallas de fichaje).
export async function renameTeam(
  teamId: string,
  userId: string,
  name: string
): Promise<void> {
  const [team] = (await sql`
    select competition_id from teams where id = ${teamId} and user_id = ${userId}
  `) as { competition_id: string }[];
  if (!team) return;

  const trimmed = name.trim().slice(0, TEAM_NAME_MAX_LEN) || DEFAULT_TEAM_NAME;
  await assertNameAvailable(userId, team.competition_id, trimmed, teamId);
  try {
    await sql`update teams set name = ${trimmed} where id = ${teamId} and user_id = ${userId}`;
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new DuplicateTeamNameError(`Ya tienes un equipo llamado "${trimmed}" en esta competición. Elige otro nombre.`);
    }
    throw err;
  }
}

// El equipo "activo" de una competición: el que marca su cookie, si de
// verdad pertenece a este usuario, o si no el más antiguo de los suyos EN
// ESA COMPETICIÓN. Si por lo que sea todavía no tuviera ninguno, se le
// crea uno al vuelo para no romper ninguna pantalla.
export async function resolveActiveTeam(
  userId: string,
  competitionId: string,
  teams: Team[]
): Promise<Team> {
  if (teams.length === 0) {
    return createTeam(userId, competitionId, DEFAULT_TEAM_NAME);
  }
  const store = await cookies();
  const activeId = store.get(activeTeamCookieName(competitionId))?.value;
  return teams.find((t) => t.id === activeId) ?? teams[0];
}

// Conveniencia para páginas/rutas que solo necesitan el equipo activo de
// UNA competición (la mayoría): junta getUserTeams + resolveActiveTeam en
// una sola llamada.
export async function getActiveTeam(
  userId: string,
  competitionId: string
): Promise<{ teams: Team[]; activeTeam: Team }> {
  const teams = await getUserTeams(userId, competitionId);
  const activeTeam = await resolveActiveTeam(userId, competitionId, teams);
  return { teams, activeTeam };
}

export async function setActiveTeamCookie(competitionId: string, teamId: string) {
  const store = await cookies();
  store.set(activeTeamCookieName(competitionId), teamId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}
