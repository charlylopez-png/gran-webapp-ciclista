import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getCompetition, getCompetitionRiders } from "@/lib/competitions-data";
import { isPicksLocked, squadLabels } from "@/lib/competitions";
import CountryFlag from "@/components/country-flag";

// Los Equipos Base de todos los participantes de una competición — solo
// se enseñan (a todo el mundo, no solo al dueño) una vez cerrado el
// plazo de fichaje, igual que ya hace la Clasificación con cada equipo
// individual antes de revelar su plantilla.
export default async function EquiposPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const competition = await getCompetition(slug);
  if (!competition || competition.status === "hidden") notFound();
  if (competition.game_type !== "squad_color" || !competition.squad_composition) notFound();

  const session = await getSession();
  if (!session || session.status !== "approved") {
    return (
      <p className="text-sm text-text-soft">
        {session
          ? "Tu cuenta todavía no está aprobada."
          : "Inicia sesión para ver los equipos de esta competición."}
      </p>
    );
  }

  const labels = squadLabels(slug);
  const locked = isPicksLocked(competition.picks_lock_at);
  if (!locked) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center">
        <h1 className="text-xl text-verde-deep">Equipos</h1>
        <p className="mt-2 text-sm text-text-soft">
          Los {labels.base} se enseñan aquí en cuanto se cierre el plazo de
          fichaje de todo el mundo.
        </p>
      </div>
    );
  }

  const squadRows = (await sql`
    select distinct t.id as team_id, t.name as team_name, u.display_name
    from team_squad ts
    join teams t on t.id = ts.team_id
    join users u on u.id = t.user_id
    where t.competition_id = ${competition.id}
    order by u.display_name, t.name
  `) as { team_id: string; team_name: string; display_name: string }[];

  const pickRows = (await sql`
    select ts.team_id, ts.competition_rider_id
    from team_squad ts
    join teams t on t.id = ts.team_id
    where t.competition_id = ${competition.id}
  `) as { team_id: string; competition_rider_id: string }[];

  const riders = await getCompetitionRiders(competition.id, { onlyActive: false });
  const ridersById = new Map(riders.map((r) => [r.id, r]));

  const picksByTeam = new Map<string, string[]>();
  for (const row of pickRows) {
    if (!picksByTeam.has(row.team_id)) picksByTeam.set(row.team_id, []);
    picksByTeam.get(row.team_id)!.push(row.competition_rider_id);
  }

  const showFlags = competition.slug === "mundial";

  return (
    <div>
      <div className="mb-1 flex items-center gap-2 font-display text-[11px] uppercase tracking-[0.16em] text-verde">
        <span className="h-1.5 w-1.5 rounded-full bg-amarillo" />
        Equipos
      </div>
      <h1 className="text-2xl text-verde-deep">{labels.base} de {competition.name}</h1>

      {squadRows.length === 0 ? (
        <p className="mt-4 text-sm text-text-soft">
          Todavía no hay ningún equipo con plantilla en esta competición.
        </p>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {squadRows.map((s) => {
            const riderIds = picksByTeam.get(s.team_id) ?? [];
            return (
              <div key={s.team_id} className="rounded-2xl border border-line bg-surface p-4">
                <span className="font-display text-sm text-verde-deep">{s.team_name}</span>
                <div className="text-[11px] text-text-soft">{s.display_name}</div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-text-soft">
                  {riderIds.map((id) => {
                    const rider = ridersById.get(id);
                    if (!rider) return null;
                    return (
                      <span key={id} className="rounded-full border border-line px-2.5 py-1">
                        {showFlags && <CountryFlag team={rider.team} className="mr-1" />}
                        {rider.name}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
