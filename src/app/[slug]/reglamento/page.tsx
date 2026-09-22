import { notFound } from "next/navigation";
import { getCompetition } from "@/lib/competitions-data";
import CompetitionReglamento from "@/components/competition-reglamento";

// Reglamento de una competición: sustituye a la antigua página global
// /reglamento (que en realidad solo describía las reglas de UKT). Cada
// competición tiene aquí el suyo, sin sesión requerida — es información
// pública para quien todavía no se ha apuntado.
export default async function CompetitionReglamentoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const competition = await getCompetition(slug);
  if (!competition || competition.status === "hidden") notFound();

  return <CompetitionReglamento competition={competition} />;
}
