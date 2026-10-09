import { NextResponse } from "next/server";
import { z } from "zod";
import { sql, transaction } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getCompetition } from "@/lib/competitions-data";
import { grandTourConfig } from "@/lib/grand-tour-data";
import { getActiveTeam } from "@/lib/teams";
import { isPicksLocked } from "@/lib/competitions";

// Guarda la plantilla de una gran vuelta (budget_draft) del equipo activo:
// titulares (dentro del presupuesto), suplentes (fuera de él) y equipos
// ciclistas (sin coste). Se permite guardar a medias — quien no la complete
// antes del cierre juega con lo que tenga —, pero nunca pasarse de los
// límites ni del presupuesto.
const BodySchema = z.object({
  starters: z.array(z.string().uuid()),
  bench: z.array(z.string().uuid()),
  realTeams: z.array(z.string().uuid()),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (session.role !== "admin" && session.status !== "approved") {
    return NextResponse.json({ error: "Tu cuenta todavía no está aprobada." }, { status: 403 });
  }

  const { slug } = await params;
  const competition = await getCompetition(slug);
  if (!competition) {
    return NextResponse.json({ error: "Esa competición no existe." }, { status: 404 });
  }
  const config = grandTourConfig(competition);
  if (!config) {
    return NextResponse.json({ error: "Esta competición todavía no está abierta." }, { status: 400 });
  }
  if (isPicksLocked(competition.picks_lock_at)) {
    return NextResponse.json({ error: "Las plantillas ya están cerradas." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de plantilla no válidos." }, { status: 400 });
  }
  const starters = Array.from(new Set(parsed.data.starters));
  const bench = Array.from(new Set(parsed.data.bench));
  const realTeams = Array.from(new Set(parsed.data.realTeams));

  if (starters.length > config.squadSize) {
    return NextResponse.json({ error: `Como mucho ${config.squadSize} titulares.` }, { status: 400 });
  }
  if (bench.length > config.benchSize) {
    return NextResponse.json({ error: `Como mucho ${config.benchSize} suplentes.` }, { status: 400 });
  }
  if (realTeams.length > config.realTeamPicks) {
    return NextResponse.json({ error: `Como mucho ${config.realTeamPicks} equipos.` }, { status: 400 });
  }
  if (starters.some((id) => bench.includes(id))) {
    return NextResponse.json(
      { error: "Un corredor no puede ser titular y suplente a la vez." },
      { status: 400 }
    );
  }

  const riderIds = [...starters, ...bench];
  const riders = (await sql`
    select id, point_cost from competition_riders
    where competition_id = ${competition.id} and id = any(${riderIds}::uuid[]) and active = true
  `) as { id: string; point_cost: string | number | null }[];
  if (riders.length !== riderIds.length) {
    return NextResponse.json(
      { error: "Alguno de los corredores seleccionados ya no está disponible." },
      { status: 400 }
    );
  }
  if (riders.some((r) => r.point_cost === null || Number(r.point_cost) <= 0)) {
    return NextResponse.json(
      { error: "Alguno de los corredores todavía no tiene precio." },
      { status: 400 }
    );
  }
  const priceById = new Map(riders.map((r) => [r.id, Number(r.point_cost)]));
  const spent = starters.reduce((sum, id) => sum + (priceById.get(id) ?? 0), 0);
  if (spent > config.budget) {
    return NextResponse.json(
      { error: `Los titulares suman ${spent} puntos y el presupuesto es de ${config.budget}.` },
      { status: 400 }
    );
  }

  const teamRows = (await sql`
    select id from competition_real_teams
    where competition_id = ${competition.id} and id = any(${realTeams}::uuid[]) and active = true
  `) as { id: string }[];
  if (teamRows.length !== realTeams.length) {
    return NextResponse.json({ error: "Alguno de los equipos ya no está disponible." }, { status: 400 });
  }

  const { activeTeam } = await getActiveTeam(session.userId, competition.id);

  await transaction(async (tx) => {
    await tx`delete from team_squad where team_id = ${activeTeam.id}`;
    await tx`delete from team_squad_real_teams where team_id = ${activeTeam.id}`;
    if (starters.length > 0) {
      await tx`
        insert into team_squad (team_id, competition_rider_id, role)
        select ${activeTeam.id}::uuid, unnest(${starters}::uuid[]), 'titular'
      `;
    }
    if (bench.length > 0) {
      await tx`
        insert into team_squad (team_id, competition_rider_id, role)
        select ${activeTeam.id}::uuid, unnest(${bench}::uuid[]), 'suplente'
      `;
    }
    if (realTeams.length > 0) {
      await tx`
        insert into team_squad_real_teams (team_id, competition_real_team_id)
        select ${activeTeam.id}::uuid, unnest(${realTeams}::uuid[])
      `;
    }
  });

  return NextResponse.json({ ok: true });
}
