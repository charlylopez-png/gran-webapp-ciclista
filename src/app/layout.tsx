import type { Metadata, Viewport } from "next";
import {
  Barlow,
  Barlow_Condensed,
  Oswald,
  Archivo_Black,
  Bodoni_Moda,
  Alfa_Slab_One,
  Anton,
  Unbounded,
} from "next/font/google";
import "./globals.css";
import { getSession, getImpersonationAdmin } from "@/lib/auth";
import { listVisibleCompetitions } from "@/lib/competitions-data";
import SiteHeader from "@/components/site-header";
import ImpersonationBar from "@/components/impersonation-bar";
import BusyBar from "@/components/busy-bar";

// Identidad general: Barlow (cuerpo) + Barlow Condensed (display, wordmark).
const barlow = Barlow({
  variable: "--font-barlow",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  weight: ["600", "700", "800"],
  style: ["normal", "italic"],
  subsets: ["latin"],
});

// Tipografías de tema por competición (ver competition-theme.ts / globals.css).
const oswald = Oswald({
  variable: "--font-oswald",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
}); // UKT

const archivoBlack = Archivo_Black({
  variable: "--font-archivo",
  weight: "400",
  subsets: ["latin"],
}); // UKT

const bodoni = Bodoni_Moda({
  variable: "--font-bodoni",
  weight: ["700"],
  style: ["italic"],
  subsets: ["latin"],
}); // Giro

const alfa = Alfa_Slab_One({
  variable: "--font-alfa",
  weight: "400",
  subsets: ["latin"],
}); // Tour

const anton = Anton({
  variable: "--font-anton",
  weight: "400",
  subsets: ["latin"],
}); // Vuelta

const unbounded = Unbounded({
  variable: "--font-unbounded",
  weight: ["700"],
  subsets: ["latin"],
}); // Mundial

const fontVars = [
  barlow,
  barlowCondensed,
  oswald,
  archivoBlack,
  bodoni,
  alfa,
  anton,
  unbounded,
]
  .map((f) => f.variable)
  .join(" ");

export const metadata: Metadata = {
  title: "txirrindulariAPP",
  description:
    "txirrindulariAPP: todas tus porras ciclistas (UKT, Mundial, Giro, Tour y Vuelta) en una sola cuenta.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/tx-identity/logo/tx-icon-favicon.svg", type: "image/svg+xml" },
      { url: "/tx-identity/png/tx-icon-32-favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/tx-identity/png/tx-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/tx-identity/png/tx-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/tx-identity/png/tx-icon-180-apple.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "txirrindulari",
  },
};

export const viewport: Viewport = {
  themeColor: "#f3f1ec",
  // Para que el iPhone dé los márgenes de seguridad (env(safe-area-inset-*))
  // y la barra de pestañas de las competiciones no quede bajo la rayita de
  // inicio, sobre todo con la app añadida a la pantalla de inicio.
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const impersonationAdmin = await getImpersonationAdmin();
  const competitions = await listVisibleCompetitions();

  return (
    <html lang="es" className={`${fontVars} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-bg text-text">
        {impersonationAdmin && session && (
          <ImpersonationBar actingAsName={session.displayName} />
        )}
        <BusyBar />
        <SiteHeader session={session} competitions={competitions} />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
