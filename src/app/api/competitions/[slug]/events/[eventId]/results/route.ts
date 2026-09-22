import { NextResponse } from "next/server";
import { z } from "zod";
import { sql, transaction } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getCompetition } from "@/lib/competitions-data";

// Carga de resultados de una carrera/prueba (puesto de cada corredor,
// 1-20). Genérica para cualquier competición squad_color: sustituye a la
// antigua /api/mundial/results (era la única que existía; clásicas no
// tenía todavía ninguna pantalla de admin para esto).
const BodySchema = z.object({
  results: z.array(
    z.object({
      competitionRiderId: z.string().uuid(),
      position: z.number().int().min(1).max(20).nullable(),
    })
  ),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string; eventId: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { slug, eventId } = await params;
  const competition = await getCompetition(slug);
  if (!competition) {
    return NextResponse.json({ error: "Esa competición no existe." }, { status: 404 });
  }

  const [event] = (await sql`
    select id from competition_events
    where id = ${eventId} and competition_id = ${competition.id}
  `) as { id: string }[];
  if (!event) {
    return NextResponse.json({ error: "Esa carrera no existe en esta competición." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de resultados no válidos." }, { status: 400 });
  }

  const positions = parsed.data.results
    .map((r) => r.position)
    .filter((p): p is number => p !== null);
  if (new Set(positions).size !== positions.length) {
    return NextResponse.json(
      { error: "Hay un puesto repetido entre dos corredores distintos." },
      { status: 400 }
    );
  }

  await transaction(async (tx) => {
    for (const r of parsed.data.results) {
      if (r.position === null) {
        await tx`
          delete from event_results
          where event_id = ${eventId} and competition_rider_id = ${r.competitionRiderId}
        `;
      } else {
        await tx`
          insert into event_results (event_id, competition_rider_id, position)
          values (${eventId}, ${r.competitionRiderId}, ${r.position})
          on conflict (event_id, competition_rider_id) do update set position = excluded.position
        `;
      }
    }
  });

  return NextResponse.json({ ok: true });
}
