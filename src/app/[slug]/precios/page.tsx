import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getCompetition } from "@/lib/competitions-data";
import { canManagePrices, getGrandTourRiders, grandTourConfig } from "@/lib/grand-tour-data";
import GtPriceEditor from "@/components/admin/gt-price-editor";

// Precios de los corredores de una gran vuelta: los ponen el admin o los
// miembros del sanedrín.
export default async function PricesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const competition = await getCompetition(slug);
  if (!competition || competition.status === "hidden" || !grandTourConfig(competition)) notFound();

  const session = await getSession();
  if (!session) redirect("/login");
  if (!(await canManagePrices(session))) notFound();

  const riders = await getGrandTourRiders(competition.id);

  return (
    <div>
      <div className="mb-1 flex items-center gap-2 font-display text-[11px] uppercase tracking-[0.16em] text-verde">
        <span className="h-1.5 w-1.5 rounded-full bg-amarillo" />
        Admin y sanedrín
      </div>
      <h1 className="text-2xl text-verde-deep">Precios de {competition.short_name ?? competition.name}</h1>
      <p className="mt-2 max-w-prose text-sm text-text-soft">
        El escalón más bajo (normalmente 50) marca la excepción de los suplentes: un retirado de ese
        escalón puede sustituirse por otro del mismo precio.
      </p>
      <div className="mt-4">
        <GtPriceEditor
          slug={slug}
          riders={riders.map((r) => ({ id: r.id, name: r.name, team: r.team, price: r.price }))}
        />
      </div>
    </div>
  );
}
