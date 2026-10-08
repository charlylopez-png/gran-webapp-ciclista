"use client";

import { useEffect, useState } from "react";

// Barra fina con la franja del pelotón arriba del todo mientras hay alguna
// petición a nuestro propio servidor en marcha: guardar un fichaje, elegir
// Kopman, cambiar de equipo, el refresco de la página después de guardar…
// En vez de tocar botón a botón, se engancha una sola vez a `fetch` y
// cuenta las peticiones abiertas. Solo aparece si tardan más de 150 ms,
// para que lo que es instantáneo no parpadee.
const SHOW_DELAY_MS = 150;

export default function BusyBar() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const originalFetch = window.fetch;
    let inFlight = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const update = () => {
      if (inFlight > 0) {
        if (!timer) timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
      } else {
        if (timer) clearTimeout(timer);
        timer = null;
        setVisible(false);
      }
    };

    const isOwnRequest = (input: RequestInfo | URL) => {
      try {
        const url =
          typeof input === "string" || input instanceof URL ? new URL(input, location.href) : new URL(input.url);
        return url.origin === location.origin;
      } catch {
        return false;
      }
    };

    // Next.js precarga en segundo plano los enlaces que se ven en pantalla
    // (cabecera Next-Router-Prefetch / Next-Router-Segment-Prefetch): eso no
    // lo ha pedido nadie pulsando nada, así que no cuenta.
    const isPrefetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(
        init?.headers ?? (input instanceof Request ? input.headers : undefined)
      );
      for (const name of headers.keys()) {
        if (name.includes("prefetch")) return true;
      }
      return false;
    };

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      if (!isOwnRequest(input) || isPrefetch(input, init)) return originalFetch(input, init);
      inFlight++;
      update();
      try {
        return await originalFetch(input, init);
      } finally {
        inFlight--;
        update();
      }
    };

    return () => {
      window.fetch = originalFetch;
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (!visible) return null;
  return (
    <div
      role="progressbar"
      aria-label="Cargando"
      className="tx-loader-track pointer-events-none fixed inset-x-0 top-0 z-[100] h-1 overflow-hidden"
    >
      <div className="tx-loader-bar h-full w-1/3" />
    </div>
  );
}
