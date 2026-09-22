import { NextResponse } from "next/server";
import { z } from "zod";
import { sql, transaction } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getCompetition } from "@/lib/competitions-data";
import { getActiveTeam, renameTeam, DuplicateTeamNameError } from "@/lib/teams";
import { isValidSquad, isPicksLocked, type RiderCategory } from "@/lib/competitions";

// Guarda la plantilla fija (Equipo Base) del equipo activo del usuario en
// esta competición. Sustituye a los antiguos /api/team-base (solo
// clásicas) y /api/mundial/picks (solo Mundial): ahora es una sola ruta,
// genérica para cualquier competición squad_color.
const BodySchema = z.object({
  riderIds: z.array(z.string().uuid()),
  teamName: z.string().trim().max(60).optional(),
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
  if (competition.game_type !== "squad_color" || !competition.squad_composition) {
    return NextResponse.json(
      { error: "Esta competición no usa plantilla por color." },
      { status: 400 }
    );
  }
  if (isPicksLocked(competition.picks_lock_at)) {
    return NextResponse.json({ error: "Los fichajes ya están cerrados." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de fichaje no válidos." }, { status: 400 });
  }

  const riderIds = Array.from(new Set(parsed.data.riderIds));
  const rows = (await sql`
    select id, category from competition_riders
    where competition_id = ${competition.id} and id = any(${riderIds}::uuid[]) and active = true
  `) as { id: string; category: RiderCategory }[];

  if (rows.length !== riderIds.length) {
    return NextResponse.json(
      { error: "Alguno de los corredores seleccionados ya no existe." },
      { status: 400 }
    );
  }
  if (!isValidSquad(rows.map((r) => r.category), competition.squad_composition)) {
    return NextResponse.json(
      { error: "La plantilla no cumple la composición exigida." },
      { status: 400 }
    );
  }

  const { activeTeam } = await getActiveTeam(session.userId, competition.id);

  if (parsed.data.teamName) {
    try {
      await renameTeam(activeTeam.id, session.userId, parsed.data.teamName);
    } catch (err) {
      if (err instanceof DuplicateTeamNameError) {
        return NextResponse.json({ error: err.message }, { status: 409 });
      }
      throw err;
    }
  }

  await transaction(async (tx) => {
    await tx`delete from team_squad where team_id = ${activeTeam.id}`;
    await tx`
      insert into team_squad (team_id, competition_rider_id)
      select ${activeTeam.id}::uuid, unnest(${riderIds}::uuid[])
    `;
  });

  return NextResponse.json({ ok: true });
}
