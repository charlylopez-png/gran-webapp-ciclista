import type { Metadata, Viewport } from "next";
import { Oswald, Nunito, Archivo_Black } from "next/font/google";
import "./globals.css";
import { getSession, getImpersonationAdmin } from "@/lib/auth";
import { listVisibleCompetitions } from "@/lib/competitions-data";
import SiteHeader from "@/components/site-header";
import ImpersonationBar from "@/components/impersonation-bar";

const oswald = Oswald({
  variable: "--font-oswald",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  weight: ["400", "600", "700"],
  subsets: ["latin"],
});

const archivoBlack = Archivo_Black({
  variable: "--font-archivo",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TXapp",
  description:
    "TXapp: todas tus porras ciclistas (UKT, Mundial, Giro, Tour y Vuelta) en una sola cuenta.",
  manifest: "/manifest.json",
  icons: {
    icon: [
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
    statusBarStyle: "black-translucent",
    title: "TXapp",
  },
};

export const viewport: Viewport = {
  themeColor: "#0d2c20",
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
    <html
      lang="es"
      className={`${oswald.variable} ${nunito.variable} ${archivoBlack.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg text-text">
        {impersonationAdmin && session && (
          <ImpersonationBar actingAsName={session.displayName} />
        )}
        <SiteHeader session={session} competitions={competitions} />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
