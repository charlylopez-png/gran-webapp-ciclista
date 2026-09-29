import Image from "next/image";
import Link from "next/link";
import { listVisibleCompetitions } from "@/lib/competitions-data";

// Portada: tarjetas por competición activa, leídas de la tabla
// `competitions` en vez de tener el Mundial cableado a mano como sección
// especial (mundial-home-banner.tsx). Añadir o quitar una competición de
// aquí es una fila en la base de datos, no un cambio de código.
export default async function Home() {
  const competitions = await listVisibleCompetitions();

  return (
    <>
      <div className="peloton-stripe" />
      <section className="relative overflow-hidden px-5 py-14 sm:py-20">
        <div className="relative mx-auto max-w-3xl">
          <span className="inline-block rounded-full border border-line px-3 py-1 font-display text-[11px] uppercase tracking-[0.16em] text-text-soft">
            Temporada 2027
          </span>
          <h1 className="mt-5 font-logo text-5xl leading-none sm:text-6xl">
            txirrindulari<span className="logo-app">APP</span>
          </h1>
          <p className="mt-3 font-display text-xl normal-case text-text-soft">
            Todas tus porras ciclistas, en un solo sitio
          </p>
          <p className="mt-5 max-w-xl border-l-2 border-[var(--accent)] pl-4 text-sm leading-relaxed text-text-soft">
            Una cuenta, un maestro de corredores World Tour y ProTeam, y una
            competición por cada carrera — UKT, Mundial, Giro, Tour y
            Vuelta: elige la tuya, arma tu equipo y pelea la general con la
            cuadrilla.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="rounded-full bg-[var(--accent)] px-5 py-2.5 font-display text-xs uppercase tracking-wide text-on-accent hover:brightness-110"
            >
              Apuntarme a la porra
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-12">
        <h2 className="font-display text-sm text-verde-deep">Competiciones</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {competitions.map((c) => (
            <Link
              key={c.id}
              href={`/${c.slug}`}
              className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 hover:border-verde-deep/50"
            >
              {c.logo_path ? (
                <Image
                  src={c.logo_path}
                  alt=""
                  width={44}
                  height={44}
                  className="h-11 w-11 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div
                  aria-hidden
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--pill-bg)] font-display text-xs text-text-soft"
                >
                  {(c.short_name ?? c.name).slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <div className="font-display text-[11px] uppercase tracking-wide text-text-soft">
                  {c.season} · {c.status === "active" ? "En marcha" : "Próximamente"}
                </div>
                <div className="mt-1 font-display text-lg text-verde-deep">{c.name}</div>
              </div>
            </Link>
          ))}
          {competitions.length === 0 && (
            <p className="text-sm text-text-soft">
              Todavía no hay ninguna competición dada de alta.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
