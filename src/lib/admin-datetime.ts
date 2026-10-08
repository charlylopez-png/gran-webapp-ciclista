// Conversión entre los `timestamptz` de Postgres (picks_lock_at) y el valor
// que entiende <input type="datetime-local"> ("YYYY-MM-DDTHH:mm", sin zona).
// Siempre en hora de Madrid, no en la del navegador ni la del servidor: el
// formulario se pinta primero en el servidor (UTC en Vercel) y luego en el
// navegador, y los dos tienen que dar el mismo valor — y el admin piensa los
// cierres en hora peninsular ("el sábado a las 23:59"). Sin acceso a base de
// datos, así que se puede importar desde componentes cliente.

const TIME_ZONE = "Europe/Madrid";

const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function madridParts(date: Date) {
  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

// Diferencia (ms) entre la hora de Madrid y UTC en ese instante (+1h en
// invierno, +2h en verano).
function madridOffsetMs(date: Date) {
  const p = madridParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function toLocalInputValue(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const p = madridParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

// Devuelve un ISO en UTC listo para guardar, o null si el campo está vacío
// (= sin cierre).
export function fromLocalInputValue(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value.trim());
  if (!m) return null;
  const wallAsUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  // Dos pasadas: la primera estima el offset con la hora "de pared"; la
  // segunda lo corrige si justo cae en el cambio de hora.
  let ts = wallAsUtc - madridOffsetMs(new Date(wallAsUtc));
  ts = wallAsUtc - madridOffsetMs(new Date(ts));
  return new Date(ts).toISOString();
}
