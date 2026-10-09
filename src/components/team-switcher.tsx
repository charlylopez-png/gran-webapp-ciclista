"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import Spinner from "@/components/spinner";

export type TeamOption = { id: string; name: string };

// Nombre por defecto con el que se crea solo el primer equipo de cada
// competición (ver DEFAULT_TEAM_NAME en lib/teams.ts): si sigue así, se
// invita a ponerle nombre.
const DEFAULT_TEAM_NAME = "Mi equipo";

// Cabecera de "tu equipo" en las pantallas de fichaje: el nombre del
// equipo abierto (con lápiz para cambiarlo), el cambio entre equipos si el
// jugador tiene varios, y "+ Nuevo equipo" para crear más, sin límite.
export default function TeamSwitcher({
  teams,
  activeTeamId,
  competitionId,
}: {
  teams: TeamOption[];
  activeTeamId: string;
  competitionId: string;
}) {
  const router = useRouter();
  const active = teams.find((t) => t.id === activeTeamId) ?? teams[0];
  const unnamed = active?.name === DEFAULT_TEAM_NAME;
  const [isPending, startTransition] = useTransition();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(unnamed ? "" : active?.name ?? "");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Al cambiar de equipo (o tras renombrar), el campo vuelve a su nombre.
  useEffect(() => {
    setName(active?.name === DEFAULT_TEAM_NAME ? "" : active?.name ?? "");
    setRenaming(false);
  }, [active?.id, active?.name]);

  function post(url: string, method: "POST" | "PATCH", body: unknown, done: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "No se pudo guardar.");
        return;
      }
      done();
      router.refresh();
    });
  }

  function switchTo(teamId: string) {
    if (teamId === activeTeamId || isPending) return;
    post("/api/teams/switch", "POST", { teamId, competitionId }, () => {
      setRenaming(false);
      setCreating(false);
    });
  }

  function rename() {
    const trimmed = name.trim();
    if (!trimmed || !active) return;
    post(`/api/teams/${active.id}`, "PATCH", { name: trimmed }, () => setRenaming(false));
  }

  function createTeam() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    post("/api/teams", "POST", { name: trimmed, competitionId }, () => {
      setCreating(false);
      setNewName("");
    });
  }

  const showNameForm = renaming || unnamed;

  return (
    <div className="mb-4 rounded-2xl border border-line bg-surface p-4">
      <div className="font-display text-[11px] uppercase tracking-[0.16em] text-text-soft">
        {teams.length > 1 ? `Tu equipo · ${teams.length} equipos` : "Tu equipo"}
      </div>

      {showNameForm ? (
        <div className="mt-2">
          {unnamed && !renaming && (
            <p className="mb-2 text-sm text-text">Ponle nombre a tu equipo: así saldrá en la clasificación.</p>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              autoFocus={renaming}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") rename();
                if (e.key === "Escape" && renaming) setRenaming(false);
              }}
              maxLength={60}
              placeholder="Nombre de tu equipo"
              className="min-w-0 flex-1 rounded-xl border border-line bg-[var(--bg)] px-3.5 py-2.5 text-base outline-none focus:border-[var(--accent)]"
            />
            <button
              type="button"
              disabled={!name.trim() || isPending}
              onClick={rename}
              className="shrink-0 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-on-accent hover:brightness-110 disabled:opacity-40"
            >
              {isPending ? <Spinner /> : "Guardar"}
            </button>
          </div>
          {renaming && (
            <button
              type="button"
              onClick={() => setRenaming(false)}
              className="mt-1.5 text-xs text-text-soft underline underline-offset-2"
            >
              Cancelar
            </button>
          )}
        </div>
      ) : (
        <div className="mt-1 flex items-center gap-2">
          <h2 className="min-w-0 flex-1 truncate font-display text-2xl text-text">{active?.name}</h2>
          <button
            type="button"
            onClick={() => {
              setName(active?.name ?? "");
              setRenaming(true);
            }}
            aria-label="Cambiar el nombre del equipo"
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-line px-3 text-sm text-text-soft hover:border-[var(--accent)] hover:text-text"
          >
            ✏️ <span className="hidden sm:inline">Cambiar nombre</span>
          </button>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
        {teams.length > 1 &&
          teams.map((team) => (
            <button
              key={team.id}
              type="button"
              disabled={isPending}
              onClick={() => switchTo(team.id)}
              aria-pressed={team.id === activeTeamId}
              className={`max-w-full truncate rounded-full px-3.5 py-2 text-sm font-semibold transition disabled:opacity-50 ${
                team.id === activeTeamId
                  ? "bg-[var(--accent)] text-on-accent"
                  : "border border-line bg-[var(--bg)] text-text-soft hover:border-[var(--accent)]"
              }`}
            >
              {team.name}
            </button>
          ))}

        {creating ? (
          <div className="flex w-full gap-2">
            <input
              type="text"
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") createTeam();
                if (e.key === "Escape") {
                  setCreating(false);
                  setNewName("");
                }
              }}
              maxLength={60}
              placeholder="Nombre del equipo nuevo"
              className="min-w-0 flex-1 rounded-xl border border-line bg-[var(--bg)] px-3.5 py-2.5 text-base outline-none focus:border-[var(--accent)]"
            />
            <button
              type="button"
              disabled={!newName.trim() || isPending}
              onClick={createTeam}
              className="shrink-0 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-on-accent hover:brightness-110 disabled:opacity-40"
            >
              Crear
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setNewName("");
              }}
              className="shrink-0 px-1 text-sm text-text-soft underline underline-offset-2"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded-full border border-dashed border-line px-3.5 py-2 text-sm text-text-soft hover:border-[var(--accent)] hover:text-text"
          >
            + Nuevo equipo
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-rosa">{error}</p>}
    </div>
  );
}
