import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getCompetition } from "@/lib/competitions-data";
import { getGrandTourData, grandTourConfig } from "@/lib/grand-tour-data";
import { stageTypeInfo, type ListKind } from "@/lib/grand-tour";
import GtStageForm from "@/components/admin/gt-stage-form";

// Admin de UNA etapa de una gran vuelta: listados oficiales, retiradas,
// perfil y anulación (y en la última, las clasificaciones finales).
export default async function GrandTourStageAdminPage({
  params,
}: {
  params: Promise<{ slug: string; order: string }>;
}) {
  const { slug, order } = await params;
  const orderNum = Number(order);
  if (!Number.isInteger(orderNum)) notFound();
  const competition = await getCompetition(slug);
  if (!competition || !grandTourConfig(competition)) notFound();

  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") notFound();

  const data = await getGrandTourData(competition.id);
  const index = data.stages.findIndex((s) => s.order === orderNum);
  if (index === -1) notFound();
  const stage = data.stages[index];
  const isLast = index === data.stages.length - 1;
  const result = data.results.find((r) => r.stageId === stage.id);
  const stageOrderById = new Map(data.stages.map((s) => [s.id, s.order]));

  const initialLists: Partial<Record<ListKind, string[]>> = {};
  for (const [kind, entries] of Object.entries(result?.lists ?? {}) as [ListKind, { name: string }[]][]) {
    initialLists[kind] = entries.map((e) => e.name);
  }

  return (
    <div>
      <Link href={`/${slug}/admin`} className="text-xs text-text-soft hover:text-verde-deep">
        ← Admin
      </Link>
      <div className="mt-3 mb-1 flex items-center gap-2 font-display text-[11px] uppercase tracking-[0.16em] text-verde">
        {stageTypeInfo(stage.type).icon} Etapa {stage.order}
      </div>
      <h1 className="text-2xl text-verde-deep">
        {stage.start && stage.finish ? `${stage.start} → ${stage.finish}` : stage.name}
      </h1>
      <div className="mt-6">
        <GtStageForm
          slug={slug}
          eventId={stage.id}
          isLast={isLast}
          teamTimeTrial={stage.type === "contrarreloj_equipos"}
          riders={data.riders.map((r) => ({ id: r.id, name: r.name, team: r.team }))}
          teams={data.realTeams}
          initialLists={initialLists}
          initialCancelled={stage.cancelled}
          initialProfileImage={stage.profileImage}
          initialWithdrawn={data.riders.filter((r) => r.withdrawnEventId === stage.id).map((r) => r.id)}
          withdrawnElsewhere={data.riders
            .filter((r) => r.withdrawnEventId && r.withdrawnEventId !== stage.id)
            .map((r) => ({ id: r.id, stage: stageOrderById.get(r.withdrawnEventId!) ?? 0 }))}
        />
      </div>
    </div>
  );
}
