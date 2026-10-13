"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import Spinner from "@/components/spinner";

// En la pantalla de "cuenta pendiente": comprueba al entrar (y con el
// botón) si el admin ya te ha aprobado. Si es así, renueva la sesión y te
// lleva a la portada, sin tener que cerrar sesión y volver a entrar.
export default function ApprovalCheck() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function check(manual: boolean) {
    setMessage(null);
    startTransition(async () => {
      const res = await fetch("/api/auth/refresh", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.status === "approved") {
        router.replace("/");
        router.refresh();
        return;
      }
      if (manual) setMessage("Todavía no está aprobada. Prueba un poco más tarde.");
    });
  }

  useEffect(() => {
    check(false);
    // Solo al entrar en la pantalla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={() => check(true)}
        disabled={isPending}
        className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-on-accent hover:brightness-110 disabled:opacity-50"
      >
        {isPending ? (
          <>
            <Spinner />
            Comprobando…
          </>
        ) : (
          "Comprobar de nuevo"
        )}
      </button>
      {message && <p className="mt-2 text-sm text-text-soft">{message}</p>}
    </div>
  );
}
