// Registro de temas visuales por competición: qué clase CSS aplica cada
// una (ver src/app/globals.css) para que la apariencia cambie al entrar
// en cada sección. Clave = `competitions.theme_color`.
//
// Clásicas no está aquí: al no tener preset, se queda con el tema por
// defecto de :root (verde/amarillo/rosa UKT). Cuando se den de alta
// Giro/Tour/Vuelta (Tarea pendiente: motor budget_draft) hay que añadir
// aquí su preset y las clases correspondientes en globals.css.
export type CompetitionTheme = {
  scopeClassName?: string;
  stripeClassName?: string;
};

const THEMES: Record<string, CompetitionTheme> = {
  mundial: {
    scopeClassName: "competition-mundial",
    stripeClassName: "competition-mundial-stripe",
  },
};

export function getCompetitionTheme(themeColor: string | null): CompetitionTheme {
  if (!themeColor) return {};
  return THEMES[themeColor] ?? {};
}
