// Color principal (aproximado) del maillot de cada equipo ciclista, para
// pintar la franja de su bloque en "Mi equipo". Se busca por palabras clave
// del nombre, así que sirve aunque cambie el patrocinador secundario
// ("Alpecin–Deceuninck" / "Alpecin–Premier Tech"). Sin acceso a datos:
// se puede importar desde componentes cliente.
const TEAM_COLORS: [RegExp, string][] = [
  [/uae|emirates/i, "#d71920"],
  [/visma|jumbo/i, "#ffd200"],
  [/red bull|bora/i, "#1b3a6b"],
  [/lidl|trek/i, "#0a3c8c"],
  [/soudal|quick/i, "#1d4ed8"],
  [/ineos|netcompany/i, "#a6192e"],
  [/decathlon|ag2r/i, "#4a9fd8"],
  [/alpecin/i, "#1f2a44"],
  [/\bef\b|easypost/i, "#ff2b8c"],
  [/movistar/i, "#00a7e1"],
  [/bahrain/i, "#c8102e"],
  [/groupama|fdj/i, "#2d63c8"],
  [/astana|xds/i, "#00aeef"],
  [/jayco|alula/i, "#f37021"],
  [/uno-x|uno x/i, "#e4002b"],
  [/tudor/i, "#b91c1c"],
  [/lotto|intermarch/i, "#e2001a"],
  [/q36|pinarello/i, "#475569"],
  [/picnic|postnl|dsm/i, "#ff6b00"],
  [/nsn|israel/i, "#0f766e"],
  [/cofidis/i, "#d6001c"],
  [/totalenergies/i, "#0072ce"],
  [/arkéa|arkea/i, "#e30613"],
  [/unibet|rockets/i, "#16a34a"],
  [/burgos/i, "#7c3aed"],
  [/kern/i, "#0ea5e9"],
  [/caja rural/i, "#15803d"],
  [/euskaltel/i, "#f97316"],
];

export function teamColor(name: string | null | undefined): string {
  if (!name) return "#64748b";
  return TEAM_COLORS.find(([re]) => re.test(name))?.[1] ?? "#64748b";
}

// Escalón de precio → color de la etiqueta (de "estrella" a "gregario").
export function priceTone(price: number): { bg: string; fg: string } {
  if (price >= 400) return { bg: "#f2c230", fg: "#1f1a0a" };
  if (price >= 250) return { bg: "#f06aa0", fg: "#1d0f18" };
  if (price >= 150) return { bg: "#a78bfa", fg: "#1e1236" };
  if (price >= 100) return { bg: "#5fc79b", fg: "#0b2a1d" };
  return { bg: "rgba(148,163,184,0.25)", fg: "currentColor" };
}
