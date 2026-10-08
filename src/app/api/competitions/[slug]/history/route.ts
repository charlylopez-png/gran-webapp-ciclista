import { NextResponse } from "next/server";
import { z } from "zod";
import { transaction } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getCompetition, saveRaceEditionName } from "@/lib/competitions-data";

// Edición pasada de una competición SIN carreras propias (la general de una
// gran vuelta): hermana de events/[eventId]/history, pero contra
// competition_result_history. Sustituye entera la lista de ese año; el
// puesto es el orden en que llegan las filas.
const BodySchema = z.object({
  editionYear: z.number().int().min(1900).max(2100),
  // "Tour de France 2026"; null = sin nombre propio (el de la competición).
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
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { slug } = await params;
  const competition = await getCompetition(slug);
  if (!competition) {
    return NextResponse.json({ error: "Esa competición no existe." }, { status: 404 });
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
      delete from competition_result_history
      where competition_id = ${competition.id} and edition_year = ${editionYear}
    `;
    for (const [i, row] of rows.entries()) {
      await tx`
        insert into competition_result_history (competition_id, edition_year, position, rider_name, team)
        values (${competition.id}, ${editionYear}, ${i + 1}, ${row.riderName}, ${row.team || null})
      `;
    }
    // undefined = no tocar el nombre; null = quitarlo.
    if (editionName !== undefined) await saveRaceEditionName(tx, {
      competitionId: competition.id,
      eventId: null,
      editionYear,
      name: editionName,
    });
  });

  return NextResponse.json({ ok: true });
}
