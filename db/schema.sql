-- GRAN WEB APP PORRA CICLISTA — esquema unificado
-- Ejecutar una vez contra la base de datos de Supabase:
--   psql "$DATABASE_URL" -f db/schema.sql
--
-- Sustituye al esquema de clasicas-de-primavera (una tabla riders/races
-- fija para las clásicas + un juego de tablas special_event_* copiado a
-- mano por cada prueba nueva) por un modelo dirigido por datos: añadir o
-- quitar una competición es una fila en `competitions`, no un despliegue
-- de código.

create extension if not exists pgcrypto;

-- ── Usuarios ─────────────────────────────────────────────────────────────
-- Transversal a toda la app: una cuenta, muchas competiciones. Se
-- mantiene tal cual estaba en clasicas-de-primavera (alta con aprobación
-- manual, Sanedrín, jugadores "manuales" sin cuenta propia).
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  display_name text not null,
  role text not null default 'participant' check (role in ('admin', 'participant')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  is_sanedrin boolean not null default false,
  is_manual boolean not null default false,
  created_at timestamptz not null default now()
);

-- ── Competiciones ────────────────────────────────────────────────────────
-- Cada fila es una sección/juego de la portada (Giro, Tour, Vuelta,
-- Mundial, Liga Clásicas, y cualquiera que se añada después).
--
-- game_type determina la mecánica:
--   'squad_color'  — equipo fijo de N corredores por categoría de color
--                     (amarillo/rosa/verde), como hoy Clásicas y Mundial.
--                     Usa `squad_composition`.
--   'budget_draft' — equipo de corredores (y opcionalmente equipos reales)
--                     dentro de un presupuesto en puntos, para las
--                     grandes vueltas. Usa `budget_squad_size`,
--                     `budget_cap`, `real_team_pick_size`.
create table if not exists competitions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  short_name text,
  game_type text not null check (game_type in ('squad_color', 'budget_draft')),
  season int not null,
  status text not null default 'upcoming' check (status in ('upcoming', 'active', 'finished', 'hidden')),
  sort_order int not null default 0,
  -- Identidad visual de la sección (color principal del tema, logo de
  -- portada) — lo que hace que cambie la apariencia al entrar.
  theme_color text,
  logo_path text,
  has_sprint_duels boolean not null default false,
  -- squad_color: si true, además del Equipo Base cada equipo puede
  -- re-fichar (Last Draft) para cada competition_event por separado
  -- (como las 12 clásicas). Si false, la plantilla vale para toda la
  -- competición y se ficha una sola vez (como el Mundial, prueba única).
  allows_event_draft boolean not null default false,
  picks_lock_at timestamptz,
  squad_composition jsonb,
  budget_squad_size int,
  budget_cap numeric(8, 2),
  real_team_pick_size int,
  created_at timestamptz not null default now()
);

-- ── Maestro de corredores ────────────────────────────────────────────────
-- Único, compartido por todas las competiciones (World Tour + Pro Team).
-- Se actualiza cada temporada desde el panel de admin; no pertenece a
-- ninguna competición en concreto — eso lo decide `competition_riders`.
create table if not exists riders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  team text,
  division text check (division in ('worldtour', 'proteam')),
  created_at timestamptz not null default now()
);

-- ── Participación de corredores por competición ─────────────────────────
-- Qué corredores del maestro juegan en cada competición y su
-- clasificación específica de ESA competición: `category` (color) si la
-- competición es squad_color, `point_cost` si es budget_draft. Sustituye
-- a la relación implícita riders↔clásicas y a special_event_riders.
create table if not exists competition_riders (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions (id) on delete cascade,
  rider_id uuid not null references riders (id) on delete cascade,
  category text check (category in ('amarillo', 'rosa', 'verde')),
  point_cost numeric(6, 2),
  multiplier numeric(3, 2) not null default 2.00,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (competition_id, rider_id)
);

create index if not exists idx_competition_riders_competition on competition_riders (competition_id);

-- ── Equipos ciclistas reales participantes (solo budget_draft) ──────────
-- Para el juego de grandes vueltas, además de corredores se fichan hasta
-- `real_team_pick_size` equipos ciclistas reales (p.ej. "UAE Team
-- Emirates"). No aplica a squad_color (clásicas/mundial no fichan
-- equipos).
create table if not exists competition_real_teams (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions (id) on delete cascade,
  name text not null,
  point_cost numeric(6, 2),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (competition_id, name)
);

-- ── Calendario de cada competición ──────────────────────────────────────
-- Generaliza las 12 clásicas (event_kind='race'), las 21 etapas de una
-- gran vuelta (event_kind='stage') o la prueba única del Mundial.
create table if not exists competition_events (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions (id) on delete cascade,
  order_num int not null,
  name text not null,
  event_date date,
  event_kind text not null default 'race' check (event_kind in ('race', 'stage')),
  stars int check (stars between 1 and 5),
  multiplier numeric(3, 2),
  logo_path text,
  created_at timestamptz not null default now(),
  unique (competition_id, order_num)
);

-- ── Equipos de los jugadores ─────────────────────────────────────────────
-- Un jugador puede tener varios equipos, uno o más POR COMPETICIÓN
-- (p.ej. dos equipos en el Tour y uno en Clásicas). `teams` es la entidad
-- real de "entrada en la porra"; `users` sigue siendo solo la cuenta.
create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  competition_id uuid not null references competitions (id) on delete cascade,
  name text not null default 'Mi equipo',
  created_at timestamptz not null default now()
);

-- El nombre debe ser distinto entre los equipos de un mismo jugador EN LA
-- MISMA competición (puede repetir nombre en otra competición distinta).
create unique index if not exists idx_teams_user_competition_name
  on teams (user_id, competition_id, lower(name));
create index if not exists idx_teams_competition on teams (competition_id);

-- ── Plantilla de cada equipo ─────────────────────────────────────────────
-- Plantilla fija para toda la competición: el Equipo Base de squad_color,
-- o el draft por presupuesto de budget_draft.
create table if not exists team_squad (
  team_id uuid not null references teams (id) on delete cascade,
  competition_rider_id uuid not null references competition_riders (id) on delete cascade,
  primary key (team_id, competition_rider_id)
);

-- Equipos ciclistas reales fichados por un equipo de la porra (solo
-- budget_draft).
create table if not exists team_squad_real_teams (
  team_id uuid not null references teams (id) on delete cascade,
  competition_real_team_id uuid not null references competition_real_teams (id) on delete cascade,
  primary key (team_id, competition_real_team_id)
);

-- Re-fichaje por carrera (Last Draft de clásicas): la alineación de un
-- equipo para UNA carrera concreta, distinta de su Equipo Base. Solo lo
-- usan las competiciones squad_color que lo activen.
create table if not exists team_event_draft (
  team_id uuid not null references teams (id) on delete cascade,
  event_id uuid not null references competition_events (id) on delete cascade,
  competition_rider_id uuid not null references competition_riders (id) on delete cascade,
  primary key (team_id, event_id, competition_rider_id)
);

create index if not exists idx_team_event_draft_event on team_event_draft (event_id);

-- ── Resultados oficiales (squad_color) ───────────────────────────────────
-- Puesto de cada corredor en cada carrera/prueba (1-20). Sustituye a
-- race_results y special_event_results.
create table if not exists event_results (
  event_id uuid not null references competition_events (id) on delete cascade,
  competition_rider_id uuid not null references competition_riders (id) on delete cascade,
  position int not null check (position between 1 and 20),
  primary key (event_id, competition_rider_id)
);

create index if not exists idx_event_results_event on event_results (event_id);

-- ── Resultados oficiales (budget_draft) ──────────────────────────────────
-- Listas de clasificación por etapa (etapa/general/puntos/montaña/
-- equipos), tal como se introducen hoy a mano en tour-txirridulariak26.
-- Se guarda el nombre normalizado del corredor o equipo real de la lista
-- tal cual lo mete el admin (no siempre coincide 1:1 con `riders`, porque
-- el resultado real de la carrera incluye a corredores que nadie fichó:
-- esa fila simplemente no dará puntos a nadie) y su puesto en esa lista.
create table if not exists stage_result_lists (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references competition_events (id) on delete cascade,
  list_kind text not null check (
    list_kind in ('etapa', 'general', 'puntos', 'montana', 'equipos', 'etapa_equipos')
  ),
  position int not null,
  entry_name text not null,
  entry_kind text not null default 'rider' check (entry_kind in ('rider', 'team')),
  created_at timestamptz not null default now(),
  unique (event_id, list_kind, position)
);

create index if not exists idx_stage_result_lists_event on stage_result_lists (event_id);

-- Clasificaciones definitivas (Bonus final del Tour/Vuelta): igual que
-- stage_result_lists pero sin event_id de una etapa concreta — se cuelga
-- de un pseudo-evento "final" que el admin crea al cierre de la
-- competición (order_num más alto, event_kind='stage', name='Final').
-- No hace falta tabla aparte: usa stage_result_lists sobre ese evento.

-- ── Duelos Sprint (módulo opcional, hoy solo Liga Clásicas) ─────────────
create table if not exists sprint_pairings (
  event_id uuid not null references competition_events (id) on delete cascade,
  user_a_id uuid not null references users (id) on delete cascade,
  user_b_id uuid not null references users (id) on delete cascade,
  winner_id uuid references users (id) on delete set null,
  primary key (event_id, user_a_id, user_b_id)
);

create index if not exists idx_sprint_pairings_event on sprint_pairings (event_id);

-- ── Competiciones iniciales ───────────────────────────────────────────────
-- Clásicas y Mundial ya funcionan hoy con su mecánica actual; se dan de
-- alta aquí. Giro, Tour y Vuelta (game_type 'budget_draft') se crean
-- desde el panel de admin cuando se cargue su calendario y su lista de
-- corredores con coste — no se insertan aquí con datos de relleno.
insert into competitions
  (slug, name, short_name, game_type, season, status, sort_order, theme_color, has_sprint_duels, allows_event_draft, squad_composition)
values
  ('clasicas', 'Liga Clásicas', 'Clásicas', 'squad_color', 2027, 'active', 1, 'clasicas',
    true, true, '{"amarillo":1,"rosa":2,"verde":3}'),
  ('mundial', 'Mundial de Montreal 2026', 'Mundial', 'squad_color', 2026, 'active', 4, 'mundial',
    false, false, '{"amarillo":1,"rosa":2,"verde":3}')
on conflict (slug) do nothing;

-- Calendario de las 12 clásicas para la competición 'clasicas' (mismo
-- calendario y coeficientes que db/schema.sql de clasicas-de-primavera).
insert into competition_events (competition_id, order_num, name, stars, multiplier, logo_path, event_kind)
select c.id, v.order_num, v.name, v.stars, v.multiplier, v.logo_path, 'race'
from competitions c, (values
  (1, 'Omloop Het Nieuwsblad', 3, 1.5, '/logos/01-omloop-het-nieuwsblad.jpg'),
  (2, 'Strade Bianche', 4, 1.75, '/logos/02-strade-bianche.png'),
  (3, 'Milano-Sanremo', 5, 2, '/logos/03-milano-sanremo.png'),
  (4, 'Ronde van Brugge', 2, 1, '/logos/04-ronde-van-brugge.jpg'),
  (5, 'E3 Saxo Classic', 3, 1.5, '/logos/05-e3-saxo-classic.png'),
  (6, 'In Flanders Fields', 2, 1, '/logos/06-gent-wevelgem-in-flanders-fields.png'),
  (7, 'Dwars door Vlaanderen', 2, 1, '/logos/07-dwars-door-vlaanderen.png'),
  (8, 'Ronde van Vlaanderen', 5, 2, '/logos/08-ronde-van-vlaanderen.png'),
  (9, 'Paris-Roubaix', 5, 2, '/logos/09-paris-roubaix.png'),
  (10, 'Amstel Gold Race', 3, 1.5, '/logos/10-amstel-gold-race.png'),
  (11, 'La Flèche Wallonne', 3, 1.5, '/logos/11-la-fleche-wallonne.png'),
  (12, 'Liège-Bastogne-Liège', 5, 2, '/logos/12-liege-bastogne-liege.png')
) as v(order_num, name, stars, multiplier, logo_path)
where c.slug = 'clasicas'
on conflict (competition_id, order_num) do nothing;

-- Prueba única del Mundial de Montreal 2026.
insert into competition_events (competition_id, order_num, name, event_date, logo_path, event_kind)
select c.id, 1, c.name, '2026-09-27', '/mundial-logos/montreal-2026.png', 'race'
from competitions c
where c.slug = 'mundial'
on conflict (competition_id, order_num) do nothing;

-- ── Row Level Security ───────────────────────────────────────────────────
-- No usamos Supabase Auth ni supabase-js: la app conecta siempre con el
-- connection string directo (rol `postgres`/`postgres.<ref>`, que tiene
-- BYPASSRLS), así que activar RLS sin políticas no afecta a la app. Su
-- único efecto es bloquear el acceso a estas tablas desde la API REST
-- automática de Supabase (PostgREST) a través de los roles `anon` y
-- `authenticated`, que si no tendrían lectura/escritura libre de todo
-- (incluidos los hashes de contraseña de `users`) con solo la anon key
-- del proyecto, aunque nunca la usemos desde el código.
alter table users enable row level security;
alter table competitions enable row level security;
alter table riders enable row level security;
alter table competition_riders enable row level security;
alter table competition_real_teams enable row level security;
alter table competition_events enable row level security;
alter table teams enable row level security;
alter table team_squad enable row level security;
alter table team_squad_real_teams enable row level security;
alter table team_event_draft enable row level security;
alter table event_results enable row level security;
alter table stage_result_lists enable row level security;
alter table sprint_pairings enable row level security;
