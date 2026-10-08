import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getCompetition } from "@/lib/competitions-data";
import { getActiveTeam } from "@/lib/teams";
import { isPicksLocked } from "@/lib/competitions";

// Guarda el Kopman (líder) del equipo activo para UNA carrera. El Kopman
// tiene que ser uno de los corredores que forman parte de esa carrera
// para ese equipo: su Klassiekerkern/Equipo Base, más su
// Wedstrijdselectie/Last Draft de esa carrera si la competición la usa
// (allows_event_draft) — de ahí la comprobación por UNION en vez de
// mirar solo team_squad.
const BodySchema = z.object({
  competitionRiderId: z.string().uuid().nullable(),
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
  if (!competition || competition.game_type !== "squad_color") {
    return NextResponse.json({ error: "Esa competición no existe." }, { status: 404 });
  }

  const [event] = (await sql`
    select id, picks_lock_at from competition_events
    where id = ${eventId} and competition_id = ${competition.id}
  `) as { id: string; picks_lock_at: string | Date | null }[];
  if (!event) {
    return NextResponse.json({ error: "Esa carrera no existe en esta competición." }, { status: 404 });
  }
  if (isPicksLocked(event.picks_lock_at)) {
    return NextResponse.json(
      { error: "Los fichajes de esta carrera ya están cerrados." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos no válidos." }, { status: 400 });
  }

  const { activeTeam } = await getActiveTeam(session.userId, competition.id);

  if (parsed.data.competitionRiderId === null) {
    await sql`
      delete from team_event_kopman
      where team_id = ${activeTeam.id} and event_id = ${eventId}
    `;
    return NextResponse.json({ ok: true });
  }

  const [{ eligible }] = (await sql`
    select exists(
      select 1 from team_squad
      where team_id = ${activeTeam.id} and competition_rider_id = ${parsed.data.competitionRiderId}
      union
      select 1 from team_event_draft
      where team_id = ${activeTeam.id} and event_id = ${eventId}
        and competition_rider_id = ${parsed.data.competitionRiderId}
    ) as eligible
  `) as { eligible: boolean }[];
  if (!eligible) {
    return NextResponse.json(
      { error: "Ese corredor no forma parte de tu plantilla en esta carrera." },
      { status: 400 }
    );
  }

  await sql`
    insert into team_event_kopman (team_id, event_id, competition_rider_id)
    values (${activeTeam.id}, ${eventId}, ${parsed.data.competitionRiderId})
    on conflict (team_id, event_id)
    do update set competition_rider_id = excluded.competition_rider_id
  `;

  return NextResponse.json({ ok: true });
}
