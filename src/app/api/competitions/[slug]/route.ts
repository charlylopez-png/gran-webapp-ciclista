import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getCompetition } from "@/lib/competitions-data";

// Ajustes de UNA competición desde /[slug]/admin. De momento solo el cierre
// de la plantilla fija (Klassiekerkern/Equipo Base): null = sin cierre.
const BodySchema = z.object({
  picksLockAt: z.iso.datetime({ offset: true }).nullable(),
});

export async function PATCH(
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
    return NextResponse.json({ error: "Fecha de cierre no válida." }, { status: 400 });
  }

  await sql`
    update competitions set picks_lock_at = ${parsed.data.picksLockAt}
    where id = ${competition.id}
  `;

  return NextResponse.json({ ok: true });
}
