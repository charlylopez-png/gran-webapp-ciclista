import postgres from "postgres";

// Supabase's own Postgres connection string. Supabase's Vercel integration
// (or a manual env var) injects one of these names depending on how it was
// set up, so we accept any of them to keep setup forgiving.
function getConnectionString() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.POSTGRES_URL_NON_POOLING
  );
}

export type Sql = postgres.Sql;
// El `sql` que recibe el callback de una transacción es un subtipo interno
// de postgres.js (TransactionSql) con la misma forma de uso (tagged
// template + helpers) que el `Sql` normal, así que lo tratamos igual desde
// fuera de este fichero.
export type TxSql = postgres.TransactionSql;

let client: Sql | null = null;

// Lazy singleton: we must NOT call postgres() at module-evaluation time,
// because Next.js evaluates route modules while collecting build metadata —
// before any env vars from a not-yet-connected database are available.
// Building the client on first real query keeps the build green either way
// and gives a clear runtime error if DATABASE_URL is still missing.
function getClient(): Sql {
  if (client) return client;
  const connectionString = getConnectionString();
  if (!connectionString) {
    throw new Error(
      "Falta DATABASE_URL (o POSTGRES_URL). Añade la cadena de conexión de tu proyecto de Supabase (Project Settings → Database → Connection string) a las variables de entorno, o defínela en .env.local para desarrollo."
    );
  }
  // prepare: false — Supabase's pooler (pgbouncer en modo transaction) no
  // soporta sentencias preparadas persistentes entre conexiones; postgres.js
  // las desactiva de todas formas en modo pooled, pero lo dejamos explícito.
  client = postgres(connectionString, { prepare: false });
  return client;
}

// Tagged-template proxy so call sites keep writing `sql`...``` unchanged.
/* eslint-disable @typescript-eslint/no-explicit-any */
export const sql: Sql = ((strings: TemplateStringsArray, ...values: any[]) =>
  (getClient() as any)(strings, ...values)) as Sql;
/* eslint-enable @typescript-eslint/no-explicit-any */

export function hasDatabase() {
  return Boolean(getConnectionString());
}

// Para operaciones que deben ser todo-o-nada (p.ej. sustituir las fichas de
// un equipo): ejecuta el callback dentro de una transacción real
// (BEGIN/COMMIT) de postgres.js. A diferencia del `sql` de arriba, el `sql`
// que recibe el callback está atado a la MISMA conexión de la transacción:
// las consultas deben construirse con ESE `sql`, no con el de fuera.
export function transaction<T>(fn: (tx: TxSql) => Promise<T>): Promise<T> {
  return getClient().begin((tx) => fn(tx)) as Promise<T>;
}
