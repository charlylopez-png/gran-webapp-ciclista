import { NextResponse } from "next/server";
import { z } from "zod";
import { sql, transaction } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getCompetition, saveRaceEditionName } from "@/lib/competitions-data";

// Edición pasada de UNA carrera (top 20 de un año anterior, solo
// informativo: no puntúa). Sustituye entera la lista de ese año — el
// puesto es el orden en que llegan las filas (la primera es el 1º).
const BodySchema = z.object({
  editionYear: z.number().int().min(1900).max(2100),
  // "Mundial de Montreal 2026"; null = sin nombre propio (el de la carrera).
  editionName: z.string().trim().min(1).max(120).nullable().optional(),
  rows: z
    .array(
      z.object({
        riderName: z.string().trim().min(1).max(120),
        team: z.string().trim().max(120).nullable(),
      })
    )
    .max(20),
});

export async function PUT(
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
    return NextResponse.json(
      { error: "Datos no válidos: año correcto y como mucho 20 corredores." },
      { status: 400 }
    );
  }

  const { editionYear, editionName, rows } = parsed.data;
  await transaction(async (tx) => {
    await tx`
      delete from event_result_history
      where event_id = ${eventId} and edition_year = ${editionYear}
    `;
    for (const [i, row] of rows.entries()) {
      await tx`
        insert into event_result_history (event_id, edition_year, position, rider_name, team)
        values (${eventId}, ${editionYear}, ${i + 1}, ${row.riderName}, ${row.team || null})
      `;
    }
    // undefined = no tocar el nombre; null = quitarlo.
    if (editionName !== undefined) await saveRaceEditionName(tx, {
      competitionId: competition.id,
      eventId,
      editionYear,
      name: editionName,
    });
  });

  return NextResponse.json({ ok: true });
}
