import Image from "next/image";
import Link from "next/link";
import type { SessionPayload } from "@/lib/auth";
import type { Competition } from "@/lib/competitions-data";
import LogoutButton from "@/components/logout-button";
import MobileNav from "@/components/mobile-nav";

type NavItem = { href: string; label: string; icon?: string };

export default function SiteHeader({
  session,
  competitions,
}: {
  session: SessionPayload | null;
  competitions: Competition[];
}) {
  // El reglamento ya no es un enlace global: cada competición tiene el
  // suyo propio (distinto entre UKT, Mundial y grandes vueltas), así que
  // vive dentro de su subnav (ver [slug]/layout.tsx) y no aquí.
  const navItems: NavItem[] = [];
  if (session?.status === "approved") {
    for (const c of competitions) {
      navItems.push({
        href: `/${c.slug}`,
        label: c.short_name ?? c.name,
        icon: c.logo_path ?? undefined,
      });
    }
  }
  if (session?.role === "admin") {
    navItems.push({ href: "/admin", label: "Admin" });
  }

  return (
    <header className="sticky top-0 z-20 relative border-b border-line bg-[var(--bg)]/92 backdrop-blur-sm">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-5 py-2.5">
        <Link
          href="/"
          aria-label="txirrindulariAPP — Inicio"
          className="flex shrink-0 items-center gap-1.5 font-logo text-lg leading-none text-text sm:text-xl"
        >
          <Image
            src="/tx-identity/logo/tx-icon-square.svg"
            alt=""
            width={28}
            height={28}
            className="shrink-0"
          />
          txirrindulari<span className="logo-app">APP</span>
        </Link>

        <nav className="hidden items-center gap-1 sm:flex">
          {navItems.map((item) => (
            <NavLink key={item.href} href={item.href} icon={item.icon}>
              {item.label}
            </NavLink>
          ))}
          <AuthActions session={session} />
        </nav>

        <MobileNav items={navItems}>
          <AuthActions session={session} />
        </MobileNav>
      </div>
    </header>
  );
}

function AuthActions({ session }: { session: SessionPayload | null }) {
  if (session) {
    return <LogoutButton />;
  }
  return (
    <div className="flex items-center gap-2 sm:gap-2">
      <NavLink href="/login">Entrar</NavLink>
      <Link
        href="/signup"
        className="rounded-full bg-[var(--accent)] px-4 py-2.5 text-center font-display text-xs uppercase tracking-wide text-on-accent hover:brightness-110 sm:ml-1 sm:px-3.5 sm:py-2"
      >
        Crear cuenta
      </Link>
    </div>
  );
}

function NavLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-1.5 rounded-full px-3.5 py-2 font-display text-xs uppercase tracking-wide text-text hover:bg-surface-2"
    >
      {icon && <Image src={icon} alt="" width={16} height={16} className="rounded-full" />}
      {children}
    </Link>
  );
}
