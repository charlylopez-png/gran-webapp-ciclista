import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { renameTeam, DuplicateTeamNameError, TEAM_NAME_MAX_LEN } from "@/lib/teams";

// Cambia el nombre de uno de los equipos del usuario (el primero, que se
// crea solo como "Mi equipo", o cualquiera de los que haya creado
// después). renameTeam ya comprueba que el equipo sea suyo.
const BodySchema = z.object({
  name: z.string().trim().min(1).max(TEAM_NAME_MAX_LEN),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (session.role !== "admin" && session.status !== "approved") {
    return NextResponse.json({ error: "Tu cuenta todavía no está aprobada." }, { status: 403 });
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Ese equipo no existe." }, { status: 404 });
  }
  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: `Ponle un nombre al equipo (máximo ${TEAM_NAME_MAX_LEN} caracteres).` },
      { status: 400 }
    );
  }

  try {
    await renameTeam(id, session.userId, parsed.data.name);
  } catch (err) {
    if (err instanceof DuplicateTeamNameError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
  return NextResponse.json({ ok: true });
}
