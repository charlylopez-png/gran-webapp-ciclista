"use client";

import Spinner from "@/components/spinner";
import Link from "next/link";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      // Se muestra el mismo mensaje exista o no la cuenta, para no dar
      // pistas de qué emails están registrados.
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="mx-auto max-w-sm px-5 py-14">
        <h1 className="text-2xl text-verde-deep">Revisa tu email</h1>
        <p className="mt-2 text-sm text-text-soft">
          Si <strong>{email}</strong> tiene una cuenta, te hemos enviado un
          enlace para elegir una contraseña nueva. Caduca en 1 hora.
        </p>
        <p className="mt-5 text-sm text-text-soft">
          <Link href="/login" className="text-verde underline">
            Volver a entrar
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm px-5 py-14">
      <h1 className="text-2xl text-verde-deep">¿Olvidaste tu contraseña?</h1>
      <p className="mt-2 text-sm text-text-soft">
        Escribe el email de tu cuenta y te mandamos un enlace para elegir una
        contraseña nueva.
      </p>

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
        <Field label="Email">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm"
          />
        </Field>

        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-full bg-[var(--accent)] px-5 py-2.5 font-display text-xs uppercase tracking-wide text-on-accent hover:brightness-110 disabled:opacity-60"
        >
          {loading ? <><Spinner />Enviando…</> : "Enviar enlace"}
        </button>
      </form>

      <p className="mt-5 text-sm text-text-soft">
        <Link href="/login" className="text-verde underline">
          Volver a entrar
        </Link>
      </p>
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
