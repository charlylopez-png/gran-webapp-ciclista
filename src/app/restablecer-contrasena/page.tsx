"use client";

import Spinner from "@/components/spinner";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== password2) {
      setError("Las dos contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo cambiar la contraseña.");
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/login"), 2000);
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="mx-auto max-w-sm px-5 py-14">
        <h1 className="text-2xl text-verde-deep">Enlace no válido</h1>
        <p className="mt-2 text-sm text-text-soft">
          Falta el código de recuperación. Pide un enlace nuevo desde{" "}
          <Link href="/olvide-contrasena" className="text-verde underline">
            ¿Olvidaste tu contraseña?
          </Link>
          .
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mx-auto max-w-sm px-5 py-14">
        <h1 className="text-2xl text-verde-deep">Contraseña actualizada</h1>
        <p className="mt-2 text-sm text-text-soft">
          Ya puedes entrar con tu contraseña nueva. Te llevamos a entrar…
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm px-5 py-14">
      <h1 className="text-2xl text-verde-deep">Elige una contraseña nueva</h1>

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
        <Field label="Contraseña nueva">
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm"
          />
          <span className="text-[11px] text-text-soft">Mínimo 8 caracteres.</span>
        </Field>
        <Field label="Repite la contraseña">
          <input
            type="password"
            required
            minLength={8}
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm"
          />
        </Field>

        {error && <p className="text-sm text-rosa">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-full bg-[var(--accent)] px-5 py-2.5 font-display text-xs uppercase tracking-wide text-on-accent hover:brightness-110 disabled:opacity-60"
        >
          {loading ? <><Spinner />Guardando…</> : "Cambiar contraseña"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-display text-[11px] uppercase tracking-wide text-text-soft">
        {label}
      </span>
      {children}
    </label>
  );
}
