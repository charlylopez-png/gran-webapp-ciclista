// Registro de temas visuales por competición: qué clase CSS aplica cada
// una (ver src/app/globals.css) para que la apariencia cambie al entrar
// en cada sección. Clave = `competitions.theme_color`.
//
// Clásicas (UKT) no está aquí: al no tener preset, se queda con el tema
// por defecto de :root (verde/amarillo/rosa UKT), que es también la
// identidad general de TXapp.
export type CompetitionTheme = {
  scopeClassName?: string;
  stripeClassName?: string;
};

const THEMES: Record<string, CompetitionTheme> = {
  mundial: {
    scopeClassName: "competition-mundial",
    stripeClassName: "competition-mundial-stripe",
  },
  giro: {
    scopeClassName: "competition-giro",
    stripeClassName: "competition-giro-stripe",
  },
  tour: {
    scopeClassName: "competition-tour",
    stripeClassName: "competition-tour-stripe",
  },
  vuelta: {
    scopeClassName: "competition-vuelta",
    stripeClassName: "competition-vuelta-stripe",
  },
};

export function getCompetitionTheme(themeColor: string | null): CompetitionTheme {
  if (!themeColor) return {};
  return THEMES[themeColor] ?? {};
}
