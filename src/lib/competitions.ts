// Constantes y funciones puras, compartidas por CUALQUIER competición
// squad_color (Clásicas, Mundial, y las que se añadan). Sin acceso a base
// de datos, así que es seguro importar este fichero desde componentes
// cliente ("use client"). El acceso a datos vive aparte, en
// ./competitions-data.ts, marcado "server-only".
//
// Sustituye a los antiguos lib/riders.ts + lib/mundial.ts: antes cada
// competición tenía su propia copia de estas constantes (SQUAD_SIZE fijo
// a 6, categorías fijas a amarillo/rosa/verde); ahora la composición del
// equipo la define cada competición en `competitions.squad_composition`
// y estas funciones son genéricas sobre esa composición.

export type RiderCategory = "amarillo" | "rosa" | "verde";
export type GameType = "squad_color" | "budget_draft";

export type SquadComposition = Record<RiderCategory, number>;

export const CATEGORY_LABEL: Record<RiderCategory, string> = {
  amarillo: "Amarillo",
  rosa: "Rosa",
  verde: "Verde",
};

// Multiplicador por defecto si una competición no fija uno propio por
// corredor (competition_riders.multiplier ya trae el suyo normalmente).
export const DEFAULT_CATEGORY_MULTIPLIER: Record<RiderCategory, number> = {
  amarillo: 1,
  rosa: 1.5,
  verde: 2,
};

export function squadSizeOf(composition: SquadComposition) {
  return composition.amarillo + composition.rosa + composition.verde;
}

export function squadCounts(categories: RiderCategory[]): SquadComposition {
  const counts: SquadComposition = { amarillo: 0, rosa: 0, verde: 0 };
  for (const c of categories) counts[c]++;
  return counts;
}

export function isValidSquad(
  categories: RiderCategory[],
  composition: SquadComposition
) {
  if (categories.length !== squadSizeOf(composition)) return false;
  const counts = squadCounts(categories);
  return (
    counts.amarillo === composition.amarillo &&
    counts.rosa === composition.rosa &&
    counts.verde === composition.verde
  );
}

export function isPicksLocked(picksLockAt: string | Date | null) {
  if (!picksLockAt) return false;
  return new Date(picksLockAt).getTime() <= Date.now();
}

// Tabla de puntos por puesto (1º-20º), igual para todas las competiciones
// squad_color (clásicas, mundial, y las que se añadan de ese tipo).
export const POINTS_BY_POSITION: Record<number, number> = {
  1: 100, 2: 50, 3: 30, 4: 20, 5: 16, 6: 15, 7: 14, 8: 13, 9: 12, 10: 11,
  11: 10, 12: 9, 13: 8, 14: 7, 15: 6, 16: 5, 17: 4, 18: 3, 19: 2, 20: 1,
};

export function pointsForPosition(position: number | null | undefined) {
  if (!position) return 0;
  return POINTS_BY_POSITION[position] ?? 0;
}

// ── Fechas ────────────────────────────────────────────────────────────
// La columna `event_date` es un `date` de Postgres: según la versión del
// driver puede llegar como string "YYYY-MM-DD" o ya como objeto Date (en
// cuyo caso usamos los getters UTC, porque un `date` sin hora se
// interpreta en UTC y los getters locales podrían restar/sumar un día
// según la zona horaria del servidor).
const MONTHS_ES_LONG = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const MONTHS_ES_SHORT = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

export function formatEventDate(
  value: string | Date,
  style: "long" | "short" = "long"
) {
  let year: number;
  let month: number; // 1-12
  let day: number;
  if (value instanceof Date) {
    year = value.getUTCFullYear();
    month = value.getUTCMonth() + 1;
    day = value.getUTCDate();
  } else {
    [year, month, day] = value.split("-").map(Number);
  }
  if (style === "short") return `${day} ${MONTHS_ES_SHORT[month - 1]} ${year}`;
  return `${day} de ${MONTHS_ES_LONG[month - 1]} de ${year}`;
}

// Los valores numeric de Postgres llegan como string; formatea "1.5" como
// "×1,5".
export function formatCoefficient(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null;
  const num = typeof value === "string" ? Number(value) : value;
  const text = Number.isInteger(num) ? String(num) : String(num).replace(".", ",");
  return `×${text}`;
}

// ── Banderas de país ─────────────────────────────────────────────────────
// País (tal como se guarda en riders.team para competiciones por
// selecciones, en español) → código ISO 3166-1 alfa-2, para pintar la
// bandera antes del nombre. Los dos casos sin código real (atletas
// neutrales y el Equipo de Refugiados) se quedan sin bandera a propósito.
const COUNTRY_ISO: Record<string, string> = {
  Argelia: "DZ",
  Australia: "AU",
  Austria: "AT",
  Bélgica: "BE",
  Bermudas: "BM",
  Belice: "BZ",
  Brasil: "BR",
  Canadá: "CA",
  Chile: "CL",
  China: "CN",
  Colombia: "CO",
  "Costa Rica": "CR",
  Chipre: "CY",
  Chequia: "CZ",
  Dinamarca: "DK",
  Dominica: "DM",
  Ecuador: "EC",
  Eritrea: "ER",
  España: "ES",
  Estonia: "EE",
  Francia: "FR",
  "Gran Bretaña": "GB",
  "Guinea-Bisáu": "GW",
  Alemania: "DE",
  Grecia: "GR",
  Guatemala: "GT",
  Honduras: "HN",
  Hungría: "HU",
  Irlanda: "IE",
  Israel: "IL",
  Italia: "IT",
  Japón: "JP",
  Kazajistán: "KZ",
  "Arabia Saudí": "SA",
  Letonia: "LV",
  Luxemburgo: "LU",
  México: "MX",
  Mongolia: "MN",
  Mónaco: "MC",
  Mauricio: "MU",
  "Países Bajos": "NL",
  Noruega: "NO",
  "Nueva Zelanda": "NZ",
  Panamá: "PA",
  Polonia: "PL",
  Portugal: "PT",
  Rumanía: "RO",
  Sudáfrica: "ZA",
  Eslovenia: "SI",
  Serbia: "RS",
  Suiza: "CH",
  Eslovaquia: "SK",
  Suecia: "SE",
  Tailandia: "TH",
  Ucrania: "UA",
  Uruguay: "UY",
  "Estados Unidos": "US",
  Uzbekistán: "UZ",
  Venezuela: "VE",
};

// Código ISO en minúsculas, listo para usar como clase de la librería
// flag-icons (p.ej. "es" → clase CSS "fi-es"). Se usa una imagen real en
// vez de un emoji de bandera porque muchos Windows/Chrome no dibujan los
// emoji de bandera.
export function countryIso(team: string | null | undefined): string | null {
  if (!team) return null;
  const iso = COUNTRY_ISO[team.trim()];
  return iso ? iso.toLowerCase() : null;
}
