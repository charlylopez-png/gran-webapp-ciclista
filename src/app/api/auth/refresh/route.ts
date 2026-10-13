import { NextResponse } from "next/server";
import { getSession, setSessionCookie } from "@/lib/auth";

// Vuelve a firmar la cookie de sesión con el estado actual de la base de
// datos (getSession ya lo lee de ahí). Lo usa la pantalla de "cuenta
// pendiente" para que, en cuanto el admin te aprueba, el proxy (que solo
// mira la cookie) también te deje pasar sin cerrar sesión.
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No has iniciado sesión." }, { status: 401 });
  }
  await setSessionCookie(session);
  return NextResponse.json({ ok: true, status: session.status });
}
