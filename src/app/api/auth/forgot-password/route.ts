import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { createPasswordResetToken } from "@/lib/auth";
import { sendPasswordResetEmail } from "@/lib/email";

const Schema = z.object({ email: z.string().email() });

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Email inválido." }, { status: 400 });
  }

  const normalizedEmail = parsed.data.email.trim().toLowerCase();
  const rows = await sql`
    select id, password_hash, is_manual from users where email = ${normalizedEmail}
  `;
  const user = rows[0];

  // Se responde igual exista o no la cuenta (y aunque sea de un jugador
  // manual sin login propio, que no puede recuperar nada porque no tiene
  // contraseña), para no dar pistas de qué emails están registrados.
  if (user && !user.is_manual) {
    const token = await createPasswordResetToken(user.id, user.password_hash);
    const origin = new URL(request.url).origin;
    const resetUrl = `${origin}/restablecer-contrasena?token=${token}`;
    try {
      await sendPasswordResetEmail(normalizedEmail, resetUrl);
    } catch (err) {
      console.error("No se pudo enviar el email de recuperación:", err);
    }
  }

  return NextResponse.json({ ok: true });
}
