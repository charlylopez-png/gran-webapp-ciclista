import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getCompetition } from "@/lib/competitions-data";
import { getGrandTourData, grandTourConfig, lowestPriceTier } from "@/lib/grand-tour-data";
import { getActiveTeam } from "@/lib/teams";
import { canSubstitute, hasStageResults } from "@/lib/grand-tour";

// Mete un suplente por un titular retirado (caída o enfermedad) en el
// equipo activo. Solo vale si el admin ya marcó la retirada, el suplente
// es de los suyos, no se ha usado ya y cumple la regla de precio. Puntúa
// desde la primera etapa que todavía no tiene resultados (la que viene).
const BodySchema = z.object({
  outRiderId: z.string().uuid(),
  inRiderId: z.string().uuid(),
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
  if (!competition || !grandTourConfig(competition)) {
    return NextResponse.json({ error: "Esa competición no existe." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de sustitución no válidos." }, { status: 400 });
  }
  const { outRiderId, inRiderId } = parsed.data;

  const { activeTeam } = await getActiveTeam(session.userId, competition.id);
  const data = await getGrandTourData(competition.id);
  const roster = data.rosters.find((r) => r.teamId === activeTeam.id);
  if (!roster) {
    return NextResponse.json({ error: "No tienes plantilla en esta competición." }, { status: 400 });
  }

  const ridersById = new Map(data.riders.map((r) => [r.id, r]));
  const out = ridersById.get(outRiderId);
  const inn = ridersById.get(inRiderId);
  if (!out || !inn || !roster.starters.includes(outRiderId) || !roster.bench.includes(inRiderId)) {
    return NextResponse.json(
      { error: "Solo puedes cambiar un titular tuyo por uno de tus suplentes." },
      { status: 400 }
    );
  }
  if (roster.substitutions.some((s) => s.outRiderId === outRiderId)) {
    return NextResponse.json({ error: "Ese titular ya está sustituido." }, { status: 400 });
  }
  if (roster.substitutions.some((s) => s.inRiderId === inRiderId)) {
    return NextResponse.json({ error: "Ese suplente ya ha entrado antes." }, { status: 400 });
  }
  if (!out.withdrawnEventId) {
    return NextResponse.json(
      { error: "Ese corredor no consta como retirado: solo se sustituye por caída o enfermedad." },
      { status: 400 }
    );
  }
  if (!canSubstitute(out.price, inn.price, lowestPriceTier(data.riders))) {
    return NextResponse.json(
      { error: `${inn.name} (${inn.price}) no puede sustituir a ${out.name} (${out.price}): tiene que valer menos.` },
      { status: 400 }
    );
  }

  const withdrawnStage = data.stages.find((s) => s.id === out.withdrawnEventId);
  const resultByStage = new Map(data.results.map((r) => [r.stageId, r]));
  const fromStage = data.stages.find(
    (s) =>
      !s.cancelled &&
      s.order > (withdrawnStage?.order ?? 0) &&
      !hasStageResults(resultByStage.get(s.id))
  );
  if (!fromStage) {
    return NextResponse.json(
      { error: "Ya no quedan etapas por disputar en las que pueda puntuar el suplente." },
      { status: 400 }
    );
  }

  await sql`
    insert into team_substitutions (team_id, out_rider_id, in_rider_id, from_event_id)
    values (${activeTeam.id}, ${outRiderId}, ${inRiderId}, ${fromStage.id})
  `;

  return NextResponse.json({ ok: true, fromStage: fromStage.order });
}
