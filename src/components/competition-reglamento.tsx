import Image from "next/image";
import type { Competition } from "@/lib/competitions-data";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  DEFAULT_CATEGORY_MULTIPLIER,
  POINTS_BY_POSITION,
  squadLabels,
  squadSizeOf,
  type RiderCategory,
} from "@/lib/competitions";
import {
  FINAL_LIST_KINDS,
  LIST_ICON,
  LIST_LABEL,
  POINTS_TABLE,
  STAGE_LIST_KINDS,
  type ListKind,
} from "@/lib/grand-tour";

// Reglamento por competición: antes era una única página estática escrita
// a mano solo para UKT (src/app/reglamento/page.tsx). Carlos pidió que el
// reglamento deje de ser global (lo que se enseñaba ahí era el de UKT, no
// el de todas) y viva dentro de cada competición, mostrando el que le
// corresponde: el Mundial no tiene Last Draft ni Sprint, así que su
// reglamento sale más corto automáticamente — no hay una copia de texto
// por competición, este componente lee la configuración real
// (`squad_composition`, `has_sprint_duels`, `allows_event_draft`) y monta
// solo los bloques que aplican, para que nunca se desincronice de las
// reglas que de verdad está aplicando el motor de puntuación
// (lib/competitions.ts).
export default function CompetitionReglamento({
  competition,
}: {
  competition: Competition;
}) {
  return (
    <div>
      <RaceInfoCard competition={competition} />
      {competition.game_type === "budget_draft" ? (
        <BudgetDraftReglamento competition={competition} />
      ) : competition.squad_composition ? (
        <SquadColorReglamento competition={competition} />
      ) : (
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-sm text-text-soft">
            El reglamento de {competition.name} está en preparación.
          </p>
        </div>
      )}
    </div>
  );
}

// Ficha "sobre la carrera": enlace oficial, imagen de recorrido y datos
// (distancia, desnivel, notas de los ascensos). Genérica para cualquier
// competición — solo se pinta si hay algo que enseñar, así que Mundial y
// Europeo no cambian hasta que alguien les rellene estos campos también.
function RaceInfoCard({ competition }: { competition: Competition }) {
  const {
    official_url,
    route_image_path,
    route_distance_km,
    route_elevation_m,
    route_notes,
  } = competition;
  const hasInfo =
    official_url || route_image_path || route_distance_km || route_elevation_m || route_notes;
  if (!hasInfo) return null;

  return (
    <div className="mb-8 overflow-hidden rounded-2xl border border-line bg-surface">
      {route_image_path && (
        <Image
          src={route_image_path}
          alt={`Recorrido de ${competition.name}`}
          width={1400}
          height={460}
          className="w-full"
        />
      )}
      <div className="p-5">
        <Kicker>Sobre la carrera</Kicker>
        {(route_distance_km || route_elevation_m) && (
          <div className="mt-2 flex flex-wrap gap-4">
            {route_distance_km && (
              <Stat label="Distancia" value={`${Number(route_distance_km).toLocaleString("es-ES")} km`} />
            )}
            {route_elevation_m && (
              <Stat label="Desnivel" value={`${route_elevation_m.toLocaleString("es-ES")} m`} />
            )}
          </div>
        )}
        {route_notes && (
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-text-soft">{route_notes}</p>
        )}
        {official_url && (
          <a
            href={official_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-2 font-display text-xs uppercase tracking-wide text-verde-deep hover:border-verde-deep/50"
          >
            Web oficial ↗
          </a>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-display text-[11px] uppercase tracking-wide text-text-soft">
        {label}
      </div>
      <div className="font-display text-xl text-verde-deep">{value}</div>
    </div>
  );
}

function SquadColorReglamento({ competition }: { competition: Competition }) {
  const composition = competition.squad_composition!;
  const eventComposition = competition.event_squad_composition;
  const hasSprint = competition.has_sprint_duels;
  const hasLastDraft = competition.allows_event_draft && Boolean(eventComposition);
  const labels = squadLabels(competition.slug);
  const baseSize = squadSizeOf(composition);
  const eventSize = eventComposition ? squadSizeOf(eventComposition) : 0;
  const totalSize = hasLastDraft ? baseSize + eventSize : baseSize;

  type Mechanism = {
    n: string;
    title: string;
    accent: "verde" | "amarillo" | "rosa" | "rojo";
    body: string;
  };
  const mechanisms: Mechanism[] = [
    {
      n: "01",
      title: "Coeficientes",
      accent: "verde",
      body: "Carreras y corredores puntúan distinto según su categoría. Un favorito ganando una carrera menor vale bastante menos que una sorpresa triunfando en un Monumento.",
    },
    {
      n: "02",
      title: "Tu equipo",
      accent: "amarillo",
      body: hasLastDraft
        ? `Plantilla de ${totalSize} corredores por carrera en dos bloques: el ${labels.base}, ${baseSize} corredores fijos toda la temporada, y la ${labels.draft}, ${eventSize} corredores distintos que eliges antes de cada carrera.`
        : `Un ${labels.base} de ${baseSize} corredores, fijo para toda la competición.`,
    },
    {
      n: "03",
      title: "El Kopman",
      accent: "rojo",
      body: `Antes de cada carrera eliges un Kopman entre los corredores de tu ${labels.base}${
        hasLastDraft ? ` y tu ${labels.draft}` : ""
      } que la corren. Si puntúa, sus puntos valen el doble; si se queda fuera de los 20 primeros, te resta 50 puntos.`,
    },
  ];
  if (hasSprint) {
    mechanisms.push({
      n: "04",
      title: "El Sprint",
      accent: "rosa" as const,
      body: "Un duelo contra otro participante en cada carrera, sorteado al inicio de temporada. Ganarlo suma puntos extra; perderlo, los resta.",
    });
  }

  return (
    <div>
      <Kicker>Las reglas, en corto</Kicker>
      <h1 className="text-2xl text-verde-deep">
        Cómo funciona {competition.name}
      </h1>
      <p className="mt-2 max-w-prose text-sm text-text-soft">
        Estos mecanismos evitan que la liga la gane siempre “el más obvio”
        y mantienen la pelea viva hasta la última carrera.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {mechanisms.map((m) => (
          <RuleCard key={m.n} n={m.n} title={m.title} accent={m.accent}>
            {m.body}
          </RuleCard>
        ))}
      </div>

      <div className="mt-8 rounded-2xl bg-surface p-6 text-text">
        <h2 className="font-display text-xs tracking-wide text-amarillo">
          Fórmula de puntuación de cada corredor
        </h2>
        <div className="mt-3 rounded-xl border border-dashed border-white/35 bg-white/5 p-4 text-center font-display text-base">
          Puntos por puesto <span className="text-amarillo">×</span>{" "}
          Coeficiente de la carrera <span className="text-amarillo">×</span>{" "}
          Coeficiente del corredor
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Example title="Favorito claro">
            Amarillo (×1) gana una carrera de 5★ (×2): 100 × 2 × 1 ={" "}
            <b className="text-amarillo">200 pts</b>
          </Example>
          <Example title="Sorpresa premiada">
            Verde (×2) es 5º en una carrera de 5★ (×2): 16 × 2 × 2 ={" "}
            <b className="text-amarillo">64 pts</b>
          </Example>
        </div>
      </div>

      <div className="mt-10">
        <Kicker>Puntuación base</Kicker>
        <h2 className="text-xl text-verde-deep">Puntos por puesto</h2>
        <p className="mt-2 max-w-prose text-sm text-text-soft">
          Puntuación de partida antes de aplicar los coeficientes. Puntúan
          los 20 primeros.
        </p>
        {/* grid-flow-col + filas explícitas: rellena por columnas (1º-10º en
            la primera columna, 11º-20º en la segunda; a partir de sm, 4
            columnas de 5), en vez del orden por filas por defecto de CSS
            grid (que dejaba el 2º junto al 1º en vez de debajo). */}
        <div className="mt-4 grid grid-flow-col grid-cols-2 grid-rows-[repeat(10,minmax(0,auto))] gap-2 sm:grid-cols-4 sm:grid-rows-[repeat(5,minmax(0,auto))]">
          {Object.entries(POINTS_BY_POSITION).map(([pos, pts], i) => (
            <div
              key={pos}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                i < 3 ? "bg-amarillo text-on-accent font-bold" : "bg-surface"
              }`}
            >
              <span>{pos}º</span>
              <b className="font-display">{pts}</b>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10 pb-6">
        <Kicker>Tu plantilla</Kicker>
        <h2 className="text-xl text-verde-deep">Los corredores</h2>
        <p className="mt-2 max-w-prose text-sm text-text-soft">
          Cuanto menos favorito, más multiplica: una sorpresa bien elegida
          puede valer tanto como un ganador cantado.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORIES.map((cat) => (
            <CategoryCard key={cat} category={cat} />
          ))}
        </div>

        <div className="mt-4 rounded-2xl bg-surface p-5">
          <SquadBlock
            title={labels.base}
            when={
              hasLastDraft
                ? `${baseSize} corredores fijos para toda la temporada`
                : `${baseSize} corredores fijos para toda la competición`
            }
            composition={composition}
          />
          {hasLastDraft && eventComposition && (
            <>
              <div className="my-3 border-t border-dashed border-line" />
              <SquadBlock
                title={labels.draft}
                when={`Antes de cada carrera eliges ${eventSize} corredores que no estén en tu ${labels.baseShort}`}
                composition={eventComposition}
              />
              <div className="mt-3 border-t border-dashed border-line pt-3 text-center font-display text-xs tracking-wide text-verde-deep">
                {baseSize} + {eventSize} = {totalSize} CORREDORES EN TU
                PLANTILLA POR CARRERA
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function BudgetDraftReglamento({ competition }: { competition: Competition }) {
  const squadSize = competition.budget_squad_size;
  const cap = competition.budget_cap;
  if (squadSize && cap) return <GrandTourReglamento competition={competition} />;
  return (
    <div>
      <Kicker>Las reglas, en corto</Kicker>
      <h1 className="text-2xl text-verde-deep">
        Cómo funciona {competition.name}
      </h1>
      <p className="mt-2 max-w-prose text-sm text-text-soft">
        Mismo reglamento para las tres grandes vueltas (Giro, Tour y
        Vuelta): en vez de un equipo de categorías fijas, aquí fichas por
        presupuesto.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <RuleCard n="01" title="Ficha por presupuesto" accent="amarillo">
          Cada corredor de la carrera tiene un coste fijo en puntos.
          {squadSize
            ? ` Armas un equipo de ${squadSize} corredores`
            : " Armas tu equipo"}
          {cap ? ` sin superar un presupuesto de ${cap} puntos.` : " sin superar el presupuesto disponible."}
        </RuleCard>
        <RuleCard n="02" title="Puntúan las etapas" accent="verde">
          Cada etapa reparte puntos por clasificación de etapa, general,
          puntos, montaña y equipos, según los corredores de tu plantilla
          que aparezcan en esas listas.
        </RuleCard>
      </div>

      <div className="mt-8 rounded-2xl border border-dashed border-line bg-surface p-5">
        <p className="text-sm text-text-soft">
          El coste de cada corredor y el presupuesto total se están
          terminando de configurar para {competition.name}. En cuanto estén
          los corredores y sus costes, esta página mostrará la tabla
          completa.
        </p>
      </div>
    </div>
  );
}

// Reglamento de una gran vuelta ya montada (Giro; Tour y Vuelta cuando se
// clonen): presupuesto, titulares, suplentes, equipos y el baremo de
// lib/grand-tour.ts — se lee de ahí para que nunca se desincronice del
// motor de puntos.
function GrandTourReglamento({ competition }: { competition: Competition }) {
  const squadSize = competition.budget_squad_size!;
  const cap = Number(competition.budget_cap);
  const bench = competition.budget_bench_size ?? 0;
  const realTeams = competition.real_team_pick_size ?? 0;
  const name = competition.short_name ?? competition.name;

  return (
    <div>
      <Kicker>Las reglas, en corto</Kicker>
      <h1 className="text-2xl text-verde-deep">Cómo funciona {competition.name}</h1>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <RuleCard n="01" title="Presupuesto" accent="amarillo">
          Cada equipo parte de {cap.toLocaleString("es-ES")} puntos. Antes de la fecha de
          cierre formas un equipo de {squadSize} corredores que no pase de ese presupuesto:
          cada corredor tiene un precio en puntos.
        </RuleCard>
        {realTeams > 0 && (
          <RuleCard n="02" title={`${realTeams} equipos ciclistas`} accent="verde">
            Además eliges {realTeams} equipos ciclistas, sin coste. Puntúan en la
            clasificación por equipos de cada etapa y en la final.
          </RuleCard>
        )}
        {bench > 0 && (
          <RuleCard n={realTeams > 0 ? "03" : "02"} title={`${bench} suplentes`} accent="rosa">
            Fuera del presupuesto. Solo entran si un titular se cae o se retira por
            enfermedad, y puntúan desde la etapa en la que entran.
          </RuleCard>
        )}
        <RuleCard n={String(2 + (realTeams > 0 ? 1 : 0) + (bench > 0 ? 1 : 0)).padStart(2, "0")} title="Puntúan las etapas" accent="rojo">
          Cada día suman los corredores y equipos de tu plantilla que aparezcan en la
          etapa, la general, la regularidad, la montaña y la clasificación por equipos;
          al acabar {name}, un bonus por las clasificaciones finales.
        </RuleCard>
      </div>

      {bench > 0 && (
        <div className="mt-8 rounded-2xl bg-surface p-5">
          <h2 className="font-display text-sm text-verde-deep">Los suplentes, al detalle</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-text-soft">
            <li>
              Solo actúan por <b>caída o retirada por enfermedad</b> de un titular. Cuando se
              confirma la retirada, eliges cuál de tus suplentes entra.
            </li>
            <li>
              El suplente tiene que valer <b>menos</b> que el corredor al que sustituye. Nunca
              igual ni más.
            </li>
            <li>
              Excepción: si el retirado está en el escalón más bajo de precio (50 pt), puede
              entrar otro de 50.
            </li>
            <li>
              Si no tienes ningún suplente que cumpla la condición, no puedes sustituir y
              sigues con el equipo incompleto.
            </li>
            <li>Los suplentes solo puntúan desde la etapa en la que entran.</li>
          </ul>
        </div>
      )}

      <GrandTourPointsTables />
    </div>
  );
}

export function GrandTourPointsTables() {
  return (
    <>
      <div className="mt-10">
        <Kicker>Sistema de puntuación</Kicker>
        <h2 className="text-xl text-verde-deep">Cada etapa (se suma cada día)</h2>
        <div className="mt-3 flex flex-col gap-2">
          {STAGE_LIST_KINDS.map((kind) => (
            <PointsRow key={kind} kind={kind} />
          ))}
        </div>
      </div>
      <div className="mt-8 pb-6">
        <h2 className="text-xl text-verde-deep">Bonus final (solo una vez, al acabar)</h2>
        <div className="mt-3 flex flex-col gap-2">
          {FINAL_LIST_KINDS.map((kind) => (
            <PointsRow key={kind} kind={kind} />
          ))}
        </div>
      </div>
    </>
  );
}

function PointsRow({ kind }: { kind: ListKind }) {
  const table = POINTS_TABLE[kind];
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <div className="text-sm font-semibold text-text">
        {LIST_ICON[kind]} {LIST_LABEL[kind]} (top {table.length})
      </div>
      <div className="mt-1 text-xs text-text-soft">
        {table.map((pts, i) => `${i + 1}º: ${pts}`).join(" · ")}
      </div>
    </div>
  );
}

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1 flex items-center gap-2 font-display text-[11px] uppercase tracking-[0.16em] text-verde">
      <span className="h-1.5 w-1.5 rounded-full bg-amarillo" />
      {children}
    </div>
  );
}

function RuleCard({
  n,
  title,
  accent,
  children,
}: {
  n: string;
  title: string;
  accent: "verde" | "amarillo" | "rosa" | "rojo";
  children: React.ReactNode;
}) {
  const borderColor =
    accent === "verde"
      ? "border-t-verde"
      : accent === "amarillo"
      ? "border-t-amarillo"
      : accent === "rojo"
      ? "border-t-rojo"
      : "border-t-rosa";
  return (
    <div className={`rounded-2xl border-t-4 bg-surface p-4 ${borderColor}`}>
      <div className="font-display text-[11px] text-text-soft">{n}</div>
      <h3 className="mt-1 text-base text-verde-deep">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-text-soft">
        {children}
      </p>
    </div>
  );
}

function Example({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white/5 p-3 text-sm leading-relaxed">
      <b className="text-amarillo">{title}.</b> {children}
    </div>
  );
}

const CATEGORY_CLASSNAME: Record<RiderCategory, string> = {
  amarillo: "bg-gradient-to-br from-[#e9c03a] to-[#c8901a] text-on-accent",
  rojo: "bg-gradient-to-br from-[#d6453a] to-[#9c2f27] text-white",
  rosa: "bg-gradient-to-br from-[#f58fb0] to-[#d16c93] text-on-accent",
  verde: "bg-gradient-to-br from-[#3f8663] to-[#1a4c36] text-white",
};

const CATEGORY_DESCRIPTION: Record<RiderCategory, string> = {
  amarillo:
    "Top élite y favoritos indiscutibles. Ganan a menudo, pero apenas multiplican.",
  rojo: "Segundo nivel de favoritos: candidatos muy serios, casi tan fiables como los amarillos.",
  rosa: "Corredores de élite, candidatos serios sin ser los favoritos absolutos.",
  verde:
    "El resto del pelotón. Menos probable que puntúen, pero cuando lo hacen, multiplican por dos.",
};

function CategoryCard({ category }: { category: RiderCategory }) {
  const mult = DEFAULT_CATEGORY_MULTIPLIER[category];
  const multLabel = Number.isInteger(mult) ? `×${mult}` : `×${String(mult).replace(".", ",")}`;
  return (
    <div className={`rounded-2xl p-4 ${CATEGORY_CLASSNAME[category]}`}>
      <div className="flex items-baseline justify-between">
        <span className="font-display text-base font-bold">
          {CATEGORY_LABEL[category]}
        </span>
        <span className="font-display text-xl font-bold">{multLabel}</span>
      </div>
      <p className="mt-1.5 text-sm leading-relaxed">
        {CATEGORY_DESCRIPTION[category]}
      </p>
    </div>
  );
}

function SquadBlock({
  title,
  when,
  composition,
}: {
  title: string;
  when: string;
  composition: Record<RiderCategory, number>;
}) {
  return (
    <div>
      <h4 className="font-display text-sm text-verde-deep">{title}</h4>
      <div className="mb-2 text-[11px] text-text-soft">{when}</div>
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => {
          const mult = DEFAULT_CATEGORY_MULTIPLIER[cat];
          const multLabel = Number.isInteger(mult)
            ? `×${mult}`
            : `×${String(mult).replace(".", ",")}`;
          return (
            <Tag key={cat}>
              {composition[cat]} {CATEGORY_LABEL[cat]} {multLabel}
            </Tag>
          );
        })}
      </div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-lg border border-line bg-bg px-2.5 py-1 text-[12px]">
      {children}
    </span>
  );
}
