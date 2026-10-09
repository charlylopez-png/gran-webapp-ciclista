// Motor de puntos de las grandes vueltas (budget_draft: Giro, Tour,
// Vuelta). Constantes y funciones puras, sin base de datos — se puede
// importar desde componentes cliente. Los datos se cargan aparte en
// ./grand-tour-data.ts.
//
// Mismo baremo que la app anterior (vuelta-txirridulariak/motor-puntos.js):
// cada etapa reparte puntos por etapa, general, regularidad, montaña y
// equipos; al acabar la vuelta, un bonus final por las clasificaciones
// definitivas. La diferencia es que aquí cada participante puede meter un
// suplente cuando se retira un titular, así que la plantilla que puntúa
// depende de la etapa.

export type StageListKind = "etapa" | "general" | "puntos" | "montana" | "equipos" | "etapa_equipos";
export type FinalListKind = "general_final" | "puntos_final" | "montana_final" | "equipos_final";
export type ListKind = StageListKind | FinalListKind;

// Los cinco listados de cada etapa (los que se enseñan siempre).
export const STAGE_LIST_KINDS: StageListKind[] = ["etapa", "general", "puntos", "montana", "equipos"];
// Más el de la contrarreloj por equipos (CRE): en esas etapas el resultado
// lo protagonizan los equipos, que se llevan la escala grande de "etapa"
// (como en la app anterior). Solo tiene datos en etapas de ese tipo.
export const SCORING_STAGE_KINDS: StageListKind[] = [...STAGE_LIST_KINDS, "etapa_equipos"];
export const FINAL_LIST_KINDS: FinalListKind[] = [
  "general_final",
  "puntos_final",
  "montana_final",
  "equipos_final",
];

// Puntos por puesto (índice 0 = 1º). La longitud marca cuántos puntúan.
export const POINTS_TABLE: Record<ListKind, number[]> = {
  etapa: [100, 80, 70, 60, 50, 40, 30, 20, 10, 5],
  general: [50, 45, 40, 35, 30, 25, 20, 15, 10, 5],
  puntos: [25, 20, 15, 10, 5],
  montana: [25, 20, 15, 10, 5],
  equipos: [25, 20, 15, 10, 5],
  etapa_equipos: [100, 80, 70, 60, 50, 40, 30, 20, 10, 5],
  general_final: [600, 400, 200, 125, 100, 80, 70, 60, 50, 40],
  puntos_final: [125, 75, 50, 30, 15],
  montana_final: [125, 75, 50, 30, 15],
  equipos_final: [125, 75, 50, 30, 15],
};

export const LIST_LABEL: Record<ListKind, string> = {
  etapa: "Etapa",
  general: "Clasificación general",
  puntos: "Regularidad / puntos",
  montana: "KOM / montaña",
  equipos: "Equipos",
  etapa_equipos: "Etapa (equipos · CRE)",
  general_final: "General final",
  puntos_final: "Regularidad final",
  montana_final: "Montaña final",
  equipos_final: "Equipos final",
};

export const LIST_ICON: Record<ListKind, string> = {
  etapa: "🚴",
  general: "👑",
  puntos: "🟢",
  montana: "🔴",
  equipos: "🚩",
  etapa_equipos: "👥",
  general_final: "👑",
  puntos_final: "🟢",
  montana_final: "🔴",
  equipos_final: "🚩",
};

// Qué listas son de equipos ciclistas (puntúan a los 3 equipos elegidos)
// y cuáles de corredores.
export function isTeamList(kind: ListKind) {
  return kind === "equipos" || kind === "equipos_final" || kind === "etapa_equipos";
}

export function pointsAt(kind: ListKind, position: number) {
  return POINTS_TABLE[kind][position - 1] ?? 0;
}

// Tipos de etapa (mismos que la app anterior) — icono y nombre.
export const STAGE_TYPES = {
  llana: { icon: "➖", label: "Llana" },
  ondulada: { icon: "〰️", label: "Ondulada" },
  ondulada_final_alto: { icon: "↗️", label: "Ondulada con final en alto" },
  media: { icon: "⛰️", label: "Media montaña" },
  montana: { icon: "🏔️", label: "Alta montaña" },
  contrarreloj_individual: { icon: "⏱️", label: "Contrarreloj individual" },
  contrarreloj_equipos: { icon: "👥", label: "Contrarreloj por equipos" },
} as const;
export type StageType = keyof typeof STAGE_TYPES;

export function stageTypeInfo(type: string | null | undefined) {
  return (type && STAGE_TYPES[type as StageType]) || { icon: "🚴", label: "" };
}

// ── Datos que necesita el motor ─────────────────────────────────────────

export type GtStage = {
  id: string;
  order: number;
  cancelled: boolean;
};

// Una entrada de una lista oficial (puesto `position`). riderId/teamId
// enlazan con el corredor/equipo de la competición; si no hay enlace, esa
// fila no da puntos a nadie (alguien que ningún participante pudo fichar).
export type GtListEntry = {
  position: number;
  name: string;
  riderId: string | null;
  teamId: string | null;
};

export type GtStageResult = {
  stageId: string;
  lists: Partial<Record<ListKind, GtListEntry[]>>;
};

export type GtSubstitution = {
  outRiderId: string;
  inRiderId: string;
  fromOrder: number; // etapa (incluida) desde la que puntúa el suplente
};

export type GtRoster = {
  teamId: string;
  teamName: string;
  ownerName: string;
  starters: string[]; // competition_riders.id de los 9 titulares
  bench: string[]; // los 2 suplentes
  realTeams: string[]; // competition_real_teams.id de los 3 equipos
  substitutions: GtSubstitution[];
};

// Corredores que puntúan para un participante en la etapa `order`: los
// titulares, menos los sustituidos a partir de su etapa de cambio, más los
// suplentes que entraron.
export function activeRidersAt(roster: GtRoster, order: number): string[] {
  const out = new Set(
    roster.substitutions.filter((s) => s.fromOrder <= order).map((s) => s.outRiderId)
  );
  const inn = roster.substitutions.filter((s) => s.fromOrder <= order).map((s) => s.inRiderId);
  return [...roster.starters.filter((id) => !out.has(id)), ...inn];
}

export type Contribution = { kind: "rider" | "team"; id: string; points: number };

// Puntos de UNA etapa (y, si se pasan, de las listas finales) para UN
// participante, con el desglose por corredor/equipo.
export function scoreStage(
  roster: GtRoster,
  stageOrder: number,
  result: GtStageResult | undefined,
  kinds: ListKind[] = SCORING_STAGE_KINDS
): { total: number; contributions: Contribution[] } {
  if (!result) return { total: 0, contributions: [] };
  const riders = new Set(activeRidersAt(roster, stageOrder));
  const teams = new Set(roster.realTeams);
  const byKey = new Map<string, Contribution>();

  for (const kind of kinds) {
    for (const entry of result.lists[kind] ?? []) {
      const pts = pointsAt(kind, entry.position);
      if (!pts) continue;
      const id = isTeamList(kind) ? entry.teamId : entry.riderId;
      if (!id) continue;
      const owned = isTeamList(kind) ? teams.has(id) : riders.has(id);
      if (!owned) continue;
      const k = isTeamList(kind) ? "team" : "rider";
      const key = `${k}:${id}`;
      const c = byKey.get(key) ?? { kind: k, id, points: 0 };
      c.points += pts;
      byKey.set(key, c);
    }
  }
  const contributions = Array.from(byKey.values()).sort((a, b) => b.points - a.points);
  return { total: contributions.reduce((s, c) => s + c.points, 0), contributions };
}

export type StandingRow = {
  teamId: string;
  teamName: string;
  ownerName: string;
  total: number;
  bonus: number;
  byStage: { stageId: string; order: number; points: number; cumulative: number }[];
  // Aporte total de cada corredor/equipo (incluye a los que llevan 0).
  contributions: Contribution[];
  position: number;
};

// Clasificación general de la porra: total por participante, evolución
// etapa a etapa y desglose por corredor/equipo. El bonus final se lee de
// las listas *_final de la última etapa, con la plantilla activa en ella.
export function computeStandings(
  rosters: GtRoster[],
  stages: GtStage[],
  results: GtStageResult[]
): StandingRow[] {
  const resultByStage = new Map(results.map((r) => [r.stageId, r]));
  const ordered = [...stages].sort((a, b) => a.order - b.order);
  const lastStage = ordered[ordered.length - 1];

  const rows: StandingRow[] = rosters.map((roster) => {
    const totals = new Map<string, Contribution>();
    const seed = (kind: "rider" | "team", id: string) => {
      const key = `${kind}:${id}`;
      if (!totals.has(key)) totals.set(key, { kind, id, points: 0 });
    };
    [...roster.starters, ...roster.substitutions.map((s) => s.inRiderId)].forEach((id) =>
      seed("rider", id)
    );
    roster.realTeams.forEach((id) => seed("team", id));

    let cumulative = 0;
    const byStage: StandingRow["byStage"] = [];
    for (const stage of ordered) {
      const result = resultByStage.get(stage.id);
      if (!result || !hasStageResults(result)) continue;
      const { total, contributions } = scoreStage(roster, stage.order, result);
      contributions.forEach((c) => {
        seed(c.kind, c.id);
        totals.get(`${c.kind}:${c.id}`)!.points += c.points;
      });
      cumulative += total;
      byStage.push({ stageId: stage.id, order: stage.order, points: total, cumulative });
    }

    let bonus = 0;
    if (lastStage) {
      const finals = scoreStage(roster, lastStage.order, resultByStage.get(lastStage.id), FINAL_LIST_KINDS);
      bonus = finals.total;
      finals.contributions.forEach((c) => {
        seed(c.kind, c.id);
        totals.get(`${c.kind}:${c.id}`)!.points += c.points;
      });
    }

    return {
      teamId: roster.teamId,
      teamName: roster.teamName,
      ownerName: roster.ownerName,
      total: cumulative + bonus,
      bonus,
      byStage,
      contributions: Array.from(totals.values()).sort((a, b) => b.points - a.points),
      position: 0,
    };
  });

  return rankRows(rows, (r) => r.total);
}

// Ordena de más a menos puntos y pone el puesto (empates comparten puesto).
export function rankRows<T extends { position: number }>(rows: T[], score: (r: T) => number): T[] {
  const sorted = [...rows].sort((a, b) => score(b) - score(a));
  sorted.forEach((row, i) => {
    row.position = i > 0 && score(sorted[i - 1]) === score(row) ? sorted[i - 1].position : i + 1;
  });
  return sorted;
}

export function hasStageResults(result: GtStageResult | undefined) {
  return Boolean(result && SCORING_STAGE_KINDS.some((k) => (result.lists[k]?.length ?? 0) > 0));
}

export function hasFinalResults(result: GtStageResult | undefined) {
  return Boolean(result && FINAL_LIST_KINDS.some((k) => (result.lists[k]?.length ?? 0) > 0));
}

// Puntos que ha dado cada corredor/equipo real en toda la carrera, sea de
// quien sea (pestaña Data: ranking, sorpresa, rentabilidad, equipo ideal).
export function pointsByEntry(results: GtStageResult[]): {
  riders: Map<string, number>;
  teams: Map<string, number>;
} {
  const riders = new Map<string, number>();
  const teams = new Map<string, number>();
  for (const result of results) {
    for (const kind of [...SCORING_STAGE_KINDS, ...FINAL_LIST_KINDS]) {
      for (const entry of result.lists[kind] ?? []) {
        const pts = pointsAt(kind, entry.position);
        if (!pts) continue;
        if (isTeamList(kind)) {
          if (entry.teamId) teams.set(entry.teamId, (teams.get(entry.teamId) ?? 0) + pts);
        } else if (entry.riderId) {
          riders.set(entry.riderId, (riders.get(entry.riderId) ?? 0) + pts);
        }
      }
    }
  }
  return { riders, teams };
}

// ── Sustituciones ───────────────────────────────────────────────────────

// Un suplente puede entrar por un titular retirado si vale MENOS que él; si
// el titular está en el escalón más bajo de precio, vale otro de ese mismo
// escalón. Nunca uno de más valor.
export function canSubstitute(outPrice: number, inPrice: number, lowestTier: number) {
  if (outPrice <= lowestTier) return inPrice <= lowestTier;
  return inPrice < outPrice;
}

// ── Equipo ideal (pestaña Data) ─────────────────────────────────────────

// Los `size` corredores que más puntos suman sin pasar de `budget`
// (mochila con límite de cantidad). Los precios van en escalones de 25, así
// que se trabaja en unidades de 25 para que la tabla sea pequeña.
export function idealSquad(
  candidates: { id: string; price: number; points: number }[],
  budget: number,
  size: number
): { ids: string[]; points: number; cost: number } {
  const unit = 25;
  const cap = Math.floor(budget / unit);
  const items = candidates
    .filter((c) => c.points > 0 && c.price > 0)
    .map((c) => ({ ...c, w: Math.ceil(c.price / unit) }));
  // best[k][w] = mejor puntuación con k corredores y peso w; choice para reconstruir.
  // dp[i][k][w]: mejores puntos usando los i primeros candidatos, con k
  // corredores y peso total w (-1 = imposible). Tabla completa (~150k
  // celdas con 180 corredores) para poder reconstruir la elección.
  const n = items.length;
  const K = size + 1;
  const W = cap + 1;
  const dp = new Int32Array((n + 1) * K * W).fill(-1);
  const at = (i: number, k: number, w: number) => (i * K + k) * W + w;
  dp[at(0, 0, 0)] = 0;
  for (let i = 0; i < n; i++) {
    const it = items[i];
    for (let k = 0; k < K; k++) {
      for (let w = 0; w < W; w++) {
        const skip = dp[at(i, k, w)];
        let take = -1;
        if (k > 0 && w >= it.w && dp[at(i, k - 1, w - it.w)] >= 0) {
          take = dp[at(i, k - 1, w - it.w)] + it.points;
        }
        dp[at(i + 1, k, w)] = Math.max(skip, take);
      }
    }
  }
  let bestK = 0;
  let bestW = 0;
  for (let k = 0; k < K; k++) {
    for (let w = 0; w < W; w++) {
      if (dp[at(n, k, w)] > dp[at(n, bestK, bestW)]) {
        bestK = k;
        bestW = w;
      }
    }
  }
  const ids: string[] = [];
  let k = bestK;
  let w = bestW;
  for (let i = n; i > 0 && k > 0; i--) {
    if (dp[at(i, k, w)] === dp[at(i - 1, k, w)]) continue; // el i-ésimo no entra
    const it = items[i - 1];
    ids.push(it.id);
    k -= 1;
    w -= it.w;
  }
  const chosen = items.filter((it) => ids.includes(it.id));
  return {
    ids,
    points: chosen.reduce((s, c) => s + c.points, 0),
    cost: chosen.reduce((s, c) => s + c.price, 0),
  };
}

// Normaliza un nombre para emparejar listas pegadas a mano con los
// corredores/equipos de la competición ("Pogačar" = "POGACAR").
export function normalizeName(text: string) {
  return text
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}
