// Registro de temas visuales por competición: qué clase CSS aplica cada
// una (ver src/app/globals.css) para que la apariencia cambie al entrar
// en cada sección. Clave = `competitions.theme_color`.
//
// :root ya no es el tema de UKT: es la identidad general clara de
// txirrindulariAPP (portada, login, admin…). UKT necesita su propio
// theme_color = 'ukt' en la base de datos para verse igual que antes;
// si una competición no tiene theme_color, hereda esa identidad general.
export type CompetitionTheme = {
  scopeClassName?: string;
  stripeClassName?: string;
};

const THEMES: Record<string, CompetitionTheme> = {
  ukt: {
    scopeClassName: "competition-ukt",
    stripeClassName: "competition-ukt-stripe",
  },
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
