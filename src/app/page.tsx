import Image from "next/image";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { listVisibleCompetitions } from "@/lib/competitions-data";
import { formatLockDate, isPicksLocked } from "@/lib/competitions";

// Portada: una cabecera de marca (logo grande, nombre y lema sobre fondo
// de tinta con los colores del pelotón) y, debajo, una tarjeta por
// competición leída de la tabla `competitions` — añadir o quitar una es
// una fila en la base de datos, no un cambio de código.

// Color de acento de cada competición (el mismo que su tema en
// globals.css), para la franja de su tarjeta.
const ACCENT: Record<string, string> = {
  ukt: "#e9c03a",
  mundial: "#4fa8e6",
  giro: "#f06aa0",
  tour: "#f2c230",
  vuelta: "#e5514a",
  europeo: "#ffcc00",
  lombardia: "#00da86",
};

export default async function Home() {
  const [competitions, session] = await Promise.all([listVisibleCompetitions(), getSession()]);
  const firstName = session?.displayName?.split(" ")[0];

  return (
    <>
      {/* ── Cabecera de marca ─────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden bg-[#15140f] text-[#f3f1ec]">
        {/* Brillo de los colores del pelotón y líneas de carretera muy suaves */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(60% 55% at 15% 10%, rgba(95,199,155,0.22), transparent 70%)," +
              "radial-gradient(55% 50% at 90% 20%, rgba(240,106,160,0.20), transparent 70%)," +
              "radial-gradient(70% 60% at 50% 110%, rgba(79,168,230,0.22), transparent 70%)," +
              "radial-gradient(40% 40% at 75% 85%, rgba(242,194,48,0.14), transparent 70%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(115deg, #f3f1ec 0 1px, transparent 1px 22px)",
          }}
        />

        <div className="mx-auto flex max-w-3xl flex-col items-center px-6 pb-14 pt-12 text-center sm:pb-20 sm:pt-16">
          <span className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1 font-display text-[11px] uppercase tracking-[0.22em] text-white/70">
            Temporada 2027
          </span>

          <div className="mt-7 rounded-[28px] bg-white/5 p-2 shadow-[0_20px_60px_rgba(0,0,0,0.55)] ring-1 ring-white/10">
            <Image
              src="/tx-identity/logo/tx-icon-square.svg"
              alt="txirrindulariAPP"
              width={128}
              height={128}
              priority
              className="h-24 w-24 rounded-[22px] sm:h-32 sm:w-32"
            />
          </div>

          <h1 className="mt-6 font-logo text-[44px] leading-none tracking-tight sm:text-7xl">
            txirrindulari<span className="text-[#7b8cff]">APP</span>
          </h1>
          <p className="mt-4 max-w-sm font-display text-lg uppercase leading-snug tracking-wide text-white/75 sm:max-w-none sm:text-xl">
            Todas tus porras ciclistas,
            <br className="sm:hidden" /> en un solo sitio
          </p>

          {session ? (
            <div className="mt-8 flex flex-col items-center gap-2">
              <p className="text-base text-white/85">
                Hola{firstName ? `, ${firstName}` : ""} 👋
              </p>
              <a
                href="#competiciones"
                className="rounded-full bg-[#f3f1ec] px-7 py-3 font-display text-sm uppercase tracking-wide text-[#15140f] shadow-lg hover:bg-white"
              >
                Ver mis porras
              </a>
            </div>
          ) : (
            <div className="mt-8 flex w-full max-w-xs flex-col gap-2.5 sm:max-w-none sm:flex-row sm:justify-center">
              <Link
                href="/signup"
                className="rounded-full bg-[#3346d3] px-7 py-3.5 font-display text-sm uppercase tracking-wide text-white shadow-[0_10px_30px_rgba(51,70,211,0.45)] hover:brightness-110"
              >
                Apuntarme a la porra
              </Link>
              <Link
                href="/login"
                className="rounded-full border border-white/25 px-7 py-3.5 font-display text-sm uppercase tracking-wide text-white hover:bg-white/10"
              >
                Ya tengo cuenta
              </Link>
            </div>
          )}
        </div>

        <div className="peloton-stripe" />
      </section>

      {/* ── Competiciones ─────────────────────────────────────────── */}
      <section id="competiciones" className="mx-auto max-w-3xl scroll-mt-4 px-5 py-10 sm:py-14">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl text-text">Competiciones</h2>
          <span className="font-display text-xs uppercase tracking-[0.16em] text-text-soft">
            {competitions.length} porras
          </span>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {competitions.map((c) => {
            const accent = (c.theme_color && ACCENT[c.theme_color]) || "#15140f";
            const active = c.status === "active";
            const lockOpen = c.picks_lock_at && !isPicksLocked(c.picks_lock_at);
            return (
              <Link
                key={c.id}
                href={`/${c.slug}`}
                className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-line bg-surface p-4 pl-5 shadow-[0_1px_2px_rgba(21,20,15,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(21,20,15,0.12)]"
              >
                <span aria-hidden className="absolute inset-y-0 left-0 w-1.5" style={{ background: accent }} />
                {c.logo_path ? (
                  <Image
                    src={c.logo_path}
                    alt=""
                    width={56}
                    height={56}
                    className="h-14 w-14 shrink-0 rounded-2xl object-cover ring-1 ring-black/5"
                  />
                ) : (
                  <div
                    aria-hidden
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl font-display text-sm text-white"
                    style={{ background: accent }}
                  >
                    {(c.short_name ?? c.name).slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 font-display text-[10px] uppercase tracking-wide ${
                        active ? "bg-[#5fc79b]/20 text-[#1f7a52]" : "bg-[var(--line)] text-text-soft"
                      }`}
                    >
                      {active ? "● En marcha" : "Próximamente"}
                    </span>
                    <span className="font-display text-[11px] text-text-soft">{c.season}</span>
                  </div>
                  <div className="mt-1 truncate font-display text-lg leading-tight text-text">{c.name}</div>
                  {lockOpen && (
                    <div className="mt-0.5 truncate text-xs text-text-soft">
                      Fichajes hasta el {formatLockDate(c.picks_lock_at!, "short")}
                    </div>
                  )}
                </div>
                <span aria-hidden className="shrink-0 text-xl text-text-soft transition group-hover:translate-x-0.5 group-hover:text-text">
                  ›
                </span>
              </Link>
            );
          })}
          {competitions.length === 0 && (
            <p className="text-sm text-text-soft">Todavía no hay ninguna competición dada de alta.</p>
          )}
        </div>
      </section>
    </>
  );
}
