import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { hashPassword, passwordFingerprint, verifyPasswordResetToken } from "@/lib/auth";

const Schema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 }
    );
  }

  const payload = await verifyPasswordResetToken(parsed.data.token);
  if (!payload) {
    return NextResponse.json(
      { error: "El enlace no es válido o ha caducado. Pide uno nuevo." },
      { status: 400 }
    );
  }

  const rows = await sql`select id, password_hash from users where id = ${payload.userId}`;
  const user = rows[0];
  if (!user || passwordFingerprint(user.password_hash) !== payload.pwFingerprint) {
    // La contraseña ya cambió desde que se envió este enlace (porque ya
    // se usó, o porque el admin la restableció mientras tanto) — se
    // invalida solo, sin necesidad de guardar nada aparte.
    return NextResponse.json(
      { error: "Este enlace ya no es válido. Pide uno nuevo." },
      { status: 400 }
    );
  }

  // Mismo motivo que en /api/auth/login: recorta espacios de más que
  // algunos móviles añaden solos al escribir o autocompletar.
  const password = parsed.data.password.trim();
  const passwordHash = await hashPassword(password);
  await sql`update users set password_hash = ${passwordHash} where id = ${user.id}`;

  return NextResponse.json({ ok: true });
}
