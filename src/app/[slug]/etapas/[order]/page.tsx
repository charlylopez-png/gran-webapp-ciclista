import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getCompetition } from "@/lib/competitions-data";
import { buildRosterLookup, getGrandTourData, grandTourConfig } from "@/lib/grand-tour-data";
import {
  FINAL_LIST_KINDS,
  LIST_ICON,
  LIST_LABEL,
  STAGE_LIST_KINDS,
  hasFinalResults,
  hasStageResults,
  pointsAt,
  rankRows,
  scoreStage,
  stageTypeInfo,
  type GtListEntry,
  type ListKind,
} from "@/lib/grand-tour";
import { formatEventDate } from "@/lib/competitions";
import { getUserTeams } from "@/lib/teams";
import StandingsList from "@/components/grand-tour/standings-list";

// Detalle de UNA etapa: los listados oficiales tal cual se metieron (con
// los puntos que reparte cada puesto, para contrastar con la fuente) y la
// clasificación de la porra en esa etapa. En la última, también el bonus
// final.
export default async function StageDetailPage({
  params,
}: {
  params: Promise<{ slug: string; order: string }>;
}) {
  const { slug, order } = await params;
  const orderNum = Number(order);
  if (!Number.isInteger(orderNum)) notFound();
  const competition = await getCompetition(slug);
  if (!competition || competition.status === "hidden" || !grandTourConfig(competition)) notFound();

  const data = await getGrandTourData(competition.id);
  const stage = data.stages.find((s) => s.order === orderNum);
  if (!stage) notFound();
  const lookup = buildRosterLookup(data);
  const result = data.results.find((r) => r.stageId === stage.id);
  const done = hasStageResults(result);
  const isLast = stage.order === data.stages[data.stages.length - 1]?.order;
  const info = stageTypeInfo(stage.type);

  const session = await getSession();
  const myTeams = session ? await getUserTeams(session.userId, competition.id) : [];

  const entries = done
    ? rankRows(
        data.rosters.map((roster) => {
          const { total, contributions } = scoreStage(roster, stage.order, result);
          return {
            teamId: roster.teamId,
            teamName: roster.teamName,
            ownerName: roster.ownerName,
            position: 0,
            points: total,
            contributions,
          };
        }),
        (e) => e.points
      )
    : [];

  const prev = data.stages.find((s) => s.order === orderNum - 1);
  const next = data.stages.find((s) => s.order === orderNum + 1);

  return (
    <div>
      <div className="flex items-center justify-between text-xs text-text-soft">
        <Link href={`/${slug}/etapas`} className="hover:text-verde-deep">
          ← Etapas
        </Link>
        <span className="flex gap-3">
          {prev && (
            <Link href={`/${slug}/etapas/${prev.order}`} className="hover:text-verde-deep">
              ‹ Etapa {prev.order}
            </Link>
          )}
          {next && (
            <Link href={`/${slug}/etapas/${next.order}`} className="hover:text-verde-deep">
              Etapa {next.order} ›
            </Link>
          )}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2 font-display text-[11px] uppercase tracking-[0.16em] text-verde">
        <span>{info.icon}</span>
        Etapa {stage.order}
        {info.label ? ` · ${info.label}` : ""}
      </div>
      <h1 className="text-2xl text-verde-deep">
        {stage.start && stage.finish ? `${stage.start} → ${stage.finish}` : stage.name}
      </h1>
      <p className="mt-1 text-sm text-text-soft">
        {stage.date ? formatEventDate(stage.date) : "Fecha por confirmar"}
        {stage.km !== null ? ` · ${stage.km} km` : ""}
        {stage.cancelled ? " · Anulada" : ""}
      </p>

      {stage.profileImage && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-white">
          {/* Perfil oficial alojado fuera (cualquier dominio): <img> normal
              en vez de next/image, que exigiría dar de alta cada dominio. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={stage.profileImage} alt={`Perfil de la etapa ${stage.order}`} className="h-auto w-full" />

        </div>
      )}

      {!done ? (
        <p className="mt-6 rounded-2xl border border-dashed border-line bg-surface p-6 text-center text-sm text-text-soft">
          {stage.cancelled
            ? "Etapa anulada: no reparte puntos."
            : "Todavía no se han metido los resultados de esta etapa."}
        </p>
      ) : (
        <>
          <section className="mt-6">
            <h2 className="font-display text-sm uppercase tracking-wide text-verde-deep">
              Listados oficiales
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {STAGE_LIST_KINDS.map((kind) => (
                <OfficialList key={kind} kind={kind} entries={result?.lists[kind] ?? []} />
              ))}
            </div>
          </section>

          {isLast && hasFinalResults(result) && (
            <section className="mt-6">
              <h2 className="font-display text-sm uppercase tracking-wide text-verde-deep">Bonus final</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {FINAL_LIST_KINDS.map((kind) => (
                  <OfficialList key={kind} kind={kind} entries={result?.lists[kind] ?? []} />
                ))}
              </div>
            </section>
          )}

          <section className="mt-8">
            <h2 className="font-display text-sm uppercase tracking-wide text-verde-deep">
              La porra en la etapa {stage.order}
            </h2>
            <div className="mt-3">
              <StandingsList
                entries={entries}
                rosters={data.rosters}
                lookup={lookup}
                highlightTeamId={myTeams[0]?.id}
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function OfficialList({ kind, entries }: { kind: ListKind; entries: GtListEntry[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="border-b border-line px-4 py-2 text-sm font-semibold">
        {LIST_ICON[kind]} {LIST_LABEL[kind]}
      </div>
      {entries.length === 0 ? (
        <p className="px-4 py-3 text-sm text-text-soft">Sin datos.</p>
      ) : (
        <ol className="divide-y divide-line">
          {entries.map((e) => {
            const pts = pointsAt(kind, e.position);
            return (
              <li key={e.position} className="flex items-center gap-3 px-4 py-1.5 text-sm">
                <span className="w-5 shrink-0 text-right font-display text-xs text-text-soft">{e.position}</span>
                <span className={`min-w-0 flex-1 truncate ${e.riderId || e.teamId ? "" : "text-text-soft"}`}>
                  {e.name}
                </span>
                <span className="shrink-0 font-display text-xs text-verde-deep">{pts > 0 ? `+${pts}` : "—"}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
