import type { Competition } from "@/lib/competitions-data";
import {
  CATEGORY_LABEL,
  DEFAULT_CATEGORY_MULTIPLIER,
  POINTS_BY_POSITION,
  squadSizeOf,
  type RiderCategory,
} from "@/lib/competitions";

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
  if (competition.game_type === "budget_draft") {
    return <BudgetDraftReglamento competition={competition} />;
  }
  if (competition.squad_composition) {
    return <SquadColorReglamento competition={competition} />;
  }
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-sm text-text-soft">
        El reglamento de {competition.name} está en preparación.
      </p>
    </div>
  );
}

function SquadColorReglamento({ competition }: { competition: Competition }) {
  const composition = competition.squad_composition!;
  const hasSprint = competition.has_sprint_duels;
  const hasLastDraft = competition.allows_event_draft;
  const baseSize = squadSizeOf(composition);
  const totalSize = hasLastDraft ? baseSize * 2 : baseSize;

  type Mechanism = {
    n: string;
    title: string;
    accent: "verde" | "amarillo" | "rosa";
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
        ? `Plantilla de ${totalSize} corredores en dos bloques: el Equipo Base, fijo toda la temporada, y el Last Draft, que recompones carrera a carrera.`
        : `Un Equipo Base de ${baseSize} corredores, fijo para toda la competición.`,
    },
  ];
  if (hasSprint) {
    mechanisms.push({
      n: "03",
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
        {mechanisms.length === 3
          ? "Tres mecanismos evitan que la liga la gane siempre “el más obvio” y mantienen la pelea viva hasta la última carrera."
          : "Estos mecanismos evitan que la liga la gane siempre “el más obvio” y mantienen la pelea viva hasta el final."}
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {mechanisms.map((m) => (
          <RuleCard key={m.n} n={m.n} title={m.title} accent={m.accent}>
            {m.body}
          </RuleCard>
        ))}
      </div>

      <div
        className="mt-8 rounded-2xl p-6 text-[var(--hero-text)]"
        style={{ background: "var(--hero-bg-1)" }}
      >
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
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
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
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {(Object.keys(composition) as RiderCategory[]).map((cat) => (
            <CategoryCard key={cat} category={cat} />
          ))}
        </div>

        <div className="mt-4 rounded-2xl bg-surface p-5">
          <SquadBlock
            title="Equipo Base"
            when={
              hasLastDraft
                ? "Fijo para toda la temporada"
                : "Fijo para toda la competición"
            }
            composition={composition}
          />
          {hasLastDraft && (
            <>
              <div className="my-3 border-t border-dashed border-line" />
              <SquadBlock
                title="Last Draft"
                when="Se recompone antes de cada carrera"
                composition={composition}
              />
              <div className="mt-3 border-t border-dashed border-line pt-3 text-center font-display text-xs tracking-wide text-verde-deep">
                {baseSize} + {baseSize} = {totalSize} CORREDORES EN TU
                PLANTILLA
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
  accent: "verde" | "amarillo" | "rosa";
  children: React.ReactNode;
}) {
  const borderColor =
    accent === "verde"
      ? "border-t-verde"
      : accent === "amarillo"
      ? "border-t-amarillo"
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
  rosa: "bg-gradient-to-br from-[#f58fb0] to-[#d16c93] text-on-accent",
  verde: "bg-gradient-to-br from-[#3f8663] to-[#1a4c36] text-white",
};

const CATEGORY_DESCRIPTION: Record<RiderCategory, string> = {
  amarillo:
    "Top élite y favoritos indiscutibles. Ganan a menudo, pero apenas multiplican.",
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
        {(Object.keys(composition) as RiderCategory[]).map((cat) => {
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
