import { NextResponse } from "next/server";
import { z } from "zod";
import { sql, transaction } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getCompetition } from "@/lib/competitions-data";
import { getActiveTeam } from "@/lib/teams";
import { isValidSquad, isPicksLocked, squadLabels, type RiderCategory } from "@/lib/competitions";

// Guarda la Wedstrijdselectie/Last Draft (fichaje específico de UNA
// carrera) del equipo activo. Hermano de team-squad/route.ts (que guarda
// el Klassiekerkern/Equipo Base fijo de toda la temporada): misma
// validación de plantilla, pero contra team_event_draft, el
// event_squad_composition de la competición (NO el squad_composition del
// Equipo Base — son tamaños distintos) y el picks_lock_at propio de la
// carrera, no el de la competición. Solo existe en competiciones con
// allows_event_draft = true (hoy, solo clasicas/UKT).
const BodySchema = z.object({
  riderIds: z.array(z.string().uuid()),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string; eventId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (session.role !== "admin" && session.status !== "approved") {
    return NextResponse.json({ error: "Tu cuenta todavía no está aprobada." }, { status: 403 });
  }

  const { slug, eventId } = await params;
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
  if (!competition.allows_event_draft || !competition.event_squad_composition) {
    return NextResponse.json(
      { error: "Esta competición no tiene fichaje por carrera." },
      { status: 400 }
    );
  }

  const [eventRow] = (await sql`
    select id, picks_lock_at from competition_events
    where id = ${eventId} and competition_id = ${competition.id}
  `) as { id: string; picks_lock_at: string | Date | null }[];
  if (!eventRow) {
    return NextResponse.json({ error: "Esa carrera no existe en esta competición." }, { status: 404 });
  }
  if (isPicksLocked(eventRow.picks_lock_at)) {
    return NextResponse.json(
      { error: `El ${squadLabels(slug).draft} de esta carrera ya está cerrado.` },
      { status: 403 }
    );
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
  if (!isValidSquad(rows.map((r) => r.category), competition.event_squad_composition)) {
    return NextResponse.json(
      { error: "La plantilla no cumple la composición exigida." },
      { status: 400 }
    );
  }

  const { activeTeam } = await getActiveTeam(session.userId, competition.id);

  await transaction(async (tx) => {
    await tx`delete from team_event_draft where team_id = ${activeTeam.id} and event_id = ${eventId}`;
    await tx`
      insert into team_event_draft (team_id, event_id, competition_rider_id)
      select ${activeTeam.id}::uuid, ${eventId}::uuid, unnest(${riderIds}::uuid[])
    `;
  });

  return NextResponse.json({ ok: true });
}
