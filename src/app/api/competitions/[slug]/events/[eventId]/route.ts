import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getCompetition } from "@/lib/competitions-data";

// Datos editables de UNA carrera desde /[slug]/admin (EventAdminRow): fecha,
// web oficial, cierre de su selección de carrera, estrellas y coeficiente.
// El formulario manda siempre el estado completo; null = vaciar el campo.
const BodySchema = z.object({
  eventDate: z.iso.date().nullable(),
  // Solo http(s): se pinta como enlace en la ficha de la carrera.
  officialUrl: z.url({ protocol: /^https?$/ }).nullable(),
  picksLockAt: z.iso.datetime({ offset: true }).nullable(),
  stars: z.number().int().min(1).max(5).nullable(),
  // numeric(3, 2) en la base de datos: hasta 9,99.
  multiplier: z.number().min(0).max(9.99).nullable(),
});

export async function PATCH(
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

  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    const messages: Record<string, string> = {
      eventDate: "La fecha de la carrera no es válida.",
      officialUrl: "La web oficial tiene que ser una dirección completa (https://…).",
      picksLockAt: "La fecha de cierre no es válida.",
      stars: "Las estrellas tienen que ir de 1 a 5.",
      multiplier: "El coeficiente tiene que estar entre 0 y 9,99.",
    };
    return NextResponse.json(
      { error: (typeof field === "string" && messages[field]) || "Datos de la carrera no válidos." },
      { status: 400 }
    );
  }

  const { eventDate, officialUrl, picksLockAt, stars, multiplier } = parsed.data;
  const updated = await sql`
    update competition_events set
      event_date = ${eventDate},
      official_url = ${officialUrl},
      picks_lock_at = ${picksLockAt},
      stars = ${stars},
      multiplier = ${multiplier}
    where id = ${eventId} and competition_id = ${competition.id}
    returning id
  `;
  if (updated.length === 0) {
    return NextResponse.json({ error: "Esa carrera no existe en esta competición." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
