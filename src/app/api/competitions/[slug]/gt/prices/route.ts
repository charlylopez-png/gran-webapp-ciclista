import { NextResponse } from "next/server";
import { z } from "zod";
import { transaction } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getCompetition } from "@/lib/competitions-data";
import { canManagePrices, grandTourConfig } from "@/lib/grand-tour-data";

// Precio de cada corredor de una gran vuelta: lo ponen el admin o el
// sanedrín. Se mandan solo los que cambian.
const BodySchema = z.object({
  prices: z
    .array(
      z.object({
        id: z.string().uuid(),
        price: z.number().int().min(0).max(5000).nullable(),
      })
    )
    .max(400),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await getSession();
  if (!(await canManagePrices(session))) {
    return NextResponse.json({ error: "Solo el admin o el sanedrín ponen precios." }, { status: 403 });
  }
  const { slug } = await params;
  const competition = await getCompetition(slug);
  if (!competition || !grandTourConfig(competition)) {
    return NextResponse.json({ error: "Esa competición no existe." }, { status: 404 });
  }
  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Precios no válidos." }, { status: 400 });
  }

  await transaction(async (tx) => {
    for (const { id, price } of parsed.data.prices) {
      await tx`
        update competition_riders set point_cost = ${price}
        where id = ${id} and competition_id = ${competition.id}
      `;
    }
  });

  return NextResponse.json({ ok: true });
}
