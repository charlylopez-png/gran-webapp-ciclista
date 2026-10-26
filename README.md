# GRAN WEB APP PORRA CICLISTA

Web app única para todas las porras ciclistas de Carlos: GIRO ITALIA, TOUR DE
FRANCIA, VUELTA A ESPAÑA, MUNDIAL y LIGA CLÁSICAS (y las que se añadan
después), con cuenta única, un maestro de corredores World Tour + Pro Team
compartido, y una sección con apariencia propia por competición. Next.js
(App Router) + Tailwind v4, desplegada en Vercel, con base de datos Postgres
en **Supabase**.

Este repo parte del código de `clasicas-de-primavera` (identidad visual
UKT), que sigue siendo la base de la Liga Clásicas y del patrón de "sección
con tema propio" (heredado de su apartado `/mundial`).

## Estado actual

- ✅ Modelo de datos unificado y generalizado en `db/schema.sql`
  (`competitions`, `riders` como maestro único, `competition_riders`,
  `competition_real_teams`, `competition_events`, `teams`, `team_squad`,
  `team_squad_real_teams`, `team_event_draft`, `team_event_kopman`,
  `event_results`, `stage_result_lists`, `event_result_history`,
  `competition_result_history`, `race_editions`, `competition_rest_days`,
  `team_substitutions`; `sprint_pairings` está creada pero su mecánica
  todavía no tiene UI/ruta). Rutas y páginas (`src/app/[slug]/...`,
  `src/app/api/competitions/[slug]/...`) ya leen y escriben contra este
  esquema, con sección genérica por `slug` y tema visual propio
  (`src/lib/competition-theme.ts`).
- ✅ Liga Clásicas y Mundial dadas de alta con su calendario;
  Giro ya tiene su juego de presupuesto con suplentes, etapas,
  clasificación y pestaña Data (`budget_draft`).
- ✅ `db/seed-mundial-riders.sql`: los 194 corredores del Mundial de
  Montreal 2026.
- ⏳ Pendiente: Tour y Vuelta por cargar (calendario + corredores con
  coste) cuando toque; módulo de Duelos Sprint de Clásicas
  (`has_sprint_duels`, tabla `sprint_pairings`) sin implementar.
- ❗ El listado real de corredores de la Liga Clásicas (con su
  clasificación de color ya hecha) vive solo en la base de datos en vivo
  de Neon de `clasicas-de-primavera`, no en este repositorio: hace falta
  exportarlo (o dar acceso a esa base) para fusionarlo con el maestro
  antes de cerrarlo.

## Desarrollo local

```bash
npm install
cp .env.example .env.local   # y rellena DATABASE_URL (Supabase) / JWT_SECRET
npm run dev
```

Aplica el esquema a la base de datos una vez tengas `DATABASE_URL` de
Supabase:

```bash
psql "$DATABASE_URL" -f db/schema.sql
psql "$DATABASE_URL" -f db/seed-mundial-riders.sql
```

## Despliegue

Pensado para desplegarse en Vercel conectado a este repositorio de GitHub,
con la base de datos de Supabase y las variables de entorno
(`DATABASE_URL`, `JWT_SECRET`, `ADMIN_EMAIL`) configuradas en
**Project Settings → Environment Variables**.
