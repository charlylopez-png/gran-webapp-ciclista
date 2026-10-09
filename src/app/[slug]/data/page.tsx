import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getCompetition } from "@/lib/competitions-data";
import { getGrandTourData, grandTourConfig } from "@/lib/grand-tour-data";
import { getUserTeams } from "@/lib/teams";
import GrandTourData from "@/components/grand-tour/grand-tour-data-tabs";
import { GrandTourPointsTables } from "@/components/competition-reglamento";

// Pestaña Data de una gran vuelta (lo mismo que la app anterior): ranking
// de corredores, equipo ideal, quién tiene a quién, ficha de participante,
// sorpresas, rentabilidad, VAR y el sistema de puntos. Los cálculos son
// funciones puras de lib/grand-tour.ts, así que se hacen en el navegador
// con los datos crudos de la competición.
export default async function DataPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const competition = await getCompetition(slug);
  const config = competition ? grandTourConfig(competition) : null;
  if (!competition || competition.status === "hidden" || !config) notFound();

  const session = await getSession();
  const myTeams = session ? await getUserTeams(session.userId, competition.id) : [];
  const data = await getGrandTourData(competition.id);

  return (
    <GrandTourData
      riders={data.riders.map((r) => ({ id: r.id, name: r.name, team: r.team, price: r.price }))}
      realTeams={data.realTeams}
      stages={data.stages.map((s) => ({
        id: s.id,
        order: s.order,
        cancelled: s.cancelled,
        label: s.start && s.finish ? `${s.start} → ${s.finish}` : s.name,
      }))}
      results={data.results}
      rosters={data.rosters}
      budget={config.budget}
      squadSize={config.squadSize}
      realTeamPicks={config.realTeamPicks}
      myTeamId={myTeams[0]?.id ?? null}
      systemSlot={<GrandTourPointsTables />}
    />
  );
}
