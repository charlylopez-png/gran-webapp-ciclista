import { NextResponse } from "next/server";
import { z } from "zod";
import { transaction } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getCompetition } from "@/lib/competitions-data";
import { grandTourConfig } from "@/lib/grand-tour-data";
import { STAGE_TYPES } from "@/lib/grand-tour";

// Recorrido de una gran vuelta: etapas (número, fecha, salida, meta, km,
// tipo) y días de descanso. Cada etapa se guarda como competition_event
// (event_kind 'stage'); si ya existe ese número se actualiza, así que se
// puede volver a pegar el recorrido entero para corregir algo sin perder
// los resultados ya metidos. Solo el admin.
const stageTypes = Object.keys(STAGE_TYPES) as [keyof typeof STAGE_TYPES, ...(keyof typeof STAGE_TYPES)[]];

const BodySchema = z.object({
  stages: z
    .array(
      z.object({
        order: z.number().int().min(1).max(30),
        date: z.iso.date().nullable(),
        start: z.string().trim().min(1).max(120),
        finish: z.string().trim().min(1).max(120),
        km: z.number().min(0).max(400).nullable(),
        type: z.enum(stageTypes).nullable(),
      })
    )
    .max(30),
  restDays: z
    .array(z.object({ date: z.iso.date(), place: z.string().trim().max(120).nullable() }))
    .max(10),
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
      { error: "Recorrido no válido: revisa números, fechas (AAAA-MM-DD) y tipos de etapa." },
      { status: 400 }
    );
  }

  await transaction(async (tx) => {
    for (const s of parsed.data.stages) {
      await tx`
        insert into competition_events
          (competition_id, order_num, name, event_date, event_kind, stage_type,
           start_place, finish_place, distance_km)
        values
          (${competition.id}, ${s.order}, ${`Etapa ${s.order}`}, ${s.date}, 'stage', ${s.type},
           ${s.start}, ${s.finish}, ${s.km})
        on conflict (competition_id, order_num) do update set
          event_date = excluded.event_date,
          event_kind = 'stage',
          stage_type = excluded.stage_type,
          start_place = excluded.start_place,
          finish_place = excluded.finish_place,
          distance_km = excluded.distance_km
      `;
    }
    await tx`delete from competition_rest_days where competition_id = ${competition.id}`;
    for (const d of parsed.data.restDays) {
      await tx`
        insert into competition_rest_days (competition_id, rest_date, place)
        values (${competition.id}, ${d.date}, ${d.place})
      `;
    }
  });

  return NextResponse.json({ ok: true, stages: parsed.data.stages.length });
}
