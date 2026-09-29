import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { verifyPassword, setSessionCookie } from "@/lib/auth";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  const normalizedEmail = parsed.data.email.trim().toLowerCase();
  // El teclado/autocompletar de algunos móviles añade un espacio al
  // final de la contraseña al pulsar "Ir" o al aceptar una sugerencia,
  // así que se recorta antes de comparar (igual que ya se hace con el
  // email) — si no, el login falla en el móvil con la contraseña
  // correcta aunque en el ordenador funcione bien.
  const password = parsed.data.password.trim();
  const rows = await sql`
    select id, email, password_hash, display_name, role, status, is_sanedrin, is_manual
    from users where email = ${normalizedEmail}
  `;
  const user = rows[0];

  if (
    !user ||
    user.is_manual ||
    !(await verifyPassword(password, user.password_hash))
  ) {
    return NextResponse.json(
      { error: "Email o contraseña incorrectos." },
      { status: 401 }
    );
  }

  await setSessionCookie({
    userId: user.id,
    email: user.email,
    displayName: user.display_name,
    role: user.role,
    status: user.status,
    sanedrin: Boolean(user.is_sanedrin),
  });

  return NextResponse.json({ ok: true, status: user.status });
}
