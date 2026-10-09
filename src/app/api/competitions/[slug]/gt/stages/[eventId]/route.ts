import { NextResponse } from "next/server";
import { z } from "zod";
import { sql, transaction } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getCompetition } from "@/lib/competitions-data";
import { getGrandTourRealTeams, getGrandTourRiders, grandTourConfig } from "@/lib/grand-tour-data";
import { FINAL_LIST_KINDS, POINTS_TABLE, STAGE_LIST_KINDS, isTeamList, normalizeName, type ListKind } from "@/lib/grand-tour";

// Admin de UNA etapa de una gran vuelta: sus listados oficiales (etapa,
// general, regularidad, montaña, equipos y, en la última, las finales),
// si está anulada, la imagen del perfil y qué corredores se retiraron en
// ella (abre la sustitución a quien los lleve). Cada listado sustituye al
// anterior entero. Los nombres se enlazan con los corredores/equipos de la
// competición; los que no casen se guardan igual pero no puntúan.
const listKinds = [...STAGE_LIST_KINDS, ...FINAL_LIST_KINDS] as [ListKind, ...ListKind[]];

const BodySchema = z.object({
  lists: z.partialRecord(z.enum(listKinds), z.array(z.string().trim().max(120)).max(20)),
  cancelled: z.boolean(),
  profileImage: z.url({ protocol: /^https?$/ }).nullable(),
  withdrawn: z.array(z.string().uuid()).max(200),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ slug: string; eventId: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }
  const { slug, eventId } = await params;
  const competition = await getCompetition(slug);
  if (!competition || !grandTourConfig(competition)) {
    return NextResponse.json({ error: "Esa competición no existe." }, { status: 404 });
  }
  const [event] = (await sql`
    select id from competition_events where id = ${eventId} and competition_id = ${competition.id}
  `) as { id: string }[];
  if (!event) {
    return NextResponse.json({ error: "Esa etapa no existe." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de la etapa no válidos." }, { status: 400 });
  }

  const [riders, realTeams] = await Promise.all([
    getGrandTourRiders(competition.id),
    getGrandTourRealTeams(competition.id),
  ]);
  const riderByName = new Map(riders.map((r) => [normalizeName(r.name), r.id]));
  const teamByName = new Map(realTeams.map((t) => [normalizeName(t.name), t.id]));
  const validRiderIds = new Set(riders.map((r) => r.id));
  const unmatched: string[] = [];

  await transaction(async (tx) => {
    for (const [kind, rawNames] of Object.entries(parsed.data.lists) as [ListKind, string[]][]) {
      const names = rawNames.filter(Boolean).slice(0, POINTS_TABLE[kind].length);
      await tx`delete from stage_result_lists where event_id = ${eventId} and list_kind = ${kind}`;
      for (const [i, name] of names.entries()) {
        const team = isTeamList(kind);
        const linked = (team ? teamByName : riderByName).get(normalizeName(name)) ?? null;
        if (!linked) unmatched.push(name);
        await tx`
          insert into stage_result_lists
            (event_id, list_kind, position, entry_name, entry_kind, competition_rider_id, competition_real_team_id)
          values
            (${eventId}, ${kind}, ${i + 1}, ${name}, ${team ? "team" : "rider"},
             ${team ? null : linked}, ${team ? linked : null})
        `;
      }
    }

    await tx`
      update competition_events
      set cancelled = ${parsed.data.cancelled}, profile_image_path = ${parsed.data.profileImage}
      where id = ${eventId}
    `;

    const withdrawn = parsed.data.withdrawn.filter((id) => validRiderIds.has(id));
    await tx`
      update competition_riders set withdrawn_event_id = null
      where competition_id = ${competition.id} and withdrawn_event_id = ${eventId}
        and not (id = any(${withdrawn}::uuid[]))
    `;
    if (withdrawn.length > 0) {
      await tx`
        update competition_riders set withdrawn_event_id = ${eventId}
        where competition_id = ${competition.id} and id = any(${withdrawn}::uuid[])
      `;
    }
  });

  return NextResponse.json({ ok: true, unmatched: Array.from(new Set(unmatched)) });
}
