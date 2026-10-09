import { NextResponse } from "next/server";
import { z } from "zod";
import { transaction } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getCompetition } from "@/lib/competitions-data";
import { grandTourConfig } from "@/lib/grand-tour-data";

// Carga de golpe la lista de salida de una gran vuelta: cada fila es un
// corredor con su equipo y (opcional) su precio. Reutiliza el corredor del
// maestro `riders` si ya existe con ese nombre, y da de alta los equipos
// ciclistas que falten (los que luego eligen los participantes). Solo el
// admin. Los precios se pueden afinar después en /[slug]/precios.
const BodySchema = z.object({
  rows: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        team: z.string().trim().min(1).max(120),
        price: z.number().int().min(0).max(5000).nullable(),
      })
    )
    .min(1)
    .max(400),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }
  const { slug } = await params;
  const competition = await getCompetition(slug);
  if (!competition || !grandTourConfig(competition)) {
    return NextResponse.json({ error: "Esa competición no existe." }, { status: 404 });
  }
  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Lista no válida: una línea por corredor, «Nombre; Equipo; Precio»." },
      { status: 400 }
    );
  }

  let created = 0;
  let updated = 0;
  await transaction(async (tx) => {
    for (const row of parsed.data.rows) {
      const [existing] = (await tx`
        select id from riders where lower(name) = lower(${row.name}) order by created_at limit 1
      `) as { id: string }[];
      let riderId = existing?.id;
      if (riderId) {
        await tx`update riders set team = ${row.team} where id = ${riderId}`;
      } else {
        const [inserted] = (await tx`
          insert into riders (name, team) values (${row.name}, ${row.team}) returning id
        `) as { id: string }[];
        riderId = inserted.id;
      }
      const [link] = (await tx`
        insert into competition_riders (competition_id, rider_id, point_cost, active)
        values (${competition.id}, ${riderId}, ${row.price}, true)
        on conflict (competition_id, rider_id) do update
          set point_cost = coalesce(excluded.point_cost, competition_riders.point_cost), active = true
        returning (xmax = 0) as inserted
      `) as { inserted: boolean }[];
      if (link.inserted) created++;
      else updated++;
      await tx`
        insert into competition_real_teams (competition_id, name)
        values (${competition.id}, ${row.team})
        on conflict (competition_id, name) do update set active = true
      `;
    }
  });

  return NextResponse.json({ ok: true, created, updated });
}
