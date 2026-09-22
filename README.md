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

- ✅ Driver de base de datos cambiado de Neon a Supabase (`src/lib/db.ts`,
  paquete `postgres`), incluidas las transacciones reales de las 4 rutas
  que hacían fichajes (`team-base`, `races/[id]/draft`, `mundial/picks`,
  `mundial/results`).
- ✅ `db/schema.sql`: esquema unificado y generalizado (`competitions`,
  `riders` como maestro único, `competition_riders`,
  `competition_real_teams`, `competition_events`, `teams`, `team_squad`,
  `team_squad_real_teams`, `team_event_draft`, `event_results`,
  `stage_result_lists`, `sprint_pairings`). Da de alta Clásicas y Mundial
  con su calendario; Giro/Tour/Vuelta se crean desde el admin cuando
  tengan calendario y corredores con coste.
- ✅ `db/seed-mundial-riders.sql`: los 194 corredores del Mundial de
  Montreal 2026, adaptados al esquema nuevo.
- ⏳ Pendiente (no hecho todavía): generalizar `src/lib/{mundial,riders,
  teams}.ts` y las rutas/páginas para leer de las tablas nuevas en vez de
  las de clásicas/Mundial a medida; motor de puntuación `budget_draft`
  para las grandes vueltas; tema visual por competición; portada con las
  5 secciones; panel de admin ampliado. El código de rutas/páginas
  todavía asume el modelo antiguo (tablas `races`, `team_base`,
  `special_event_*`) — **no ejecutes todavía `db/schema.sql` como única
  fuente de verdad sin generalizar antes ese código**, o dejará de
  compilar/funcionar contra las tablas viejas que ya no existen.
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
