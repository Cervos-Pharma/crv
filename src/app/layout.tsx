import type { Metadata } from "next";
import { Outfit, Inter } from "next/font/google";
import Providers from "@/providers";
import MockModeBar from "@/components/MockModeBar";
import { getLang } from "@/lib/i18n/server";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
  weight: ["400", "600", "700", "900"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "Cervos — Pharmacy OS",
  description:
    "Precision logistics for the modern pharmacy. Secure, offline-first, FEFO-optimised.",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const lang = await getLang();
  return (
    <html lang={lang === "SW" ? "sw" : "en"} className={`${outfit.variable} ${inter.variable}`} suppressHydrationWarning>
      {/* No explicit <head> needed — Material Symbols loaded via globals.css @import
          to avoid third-party devtools <script> injection causing a React hydration mismatch */}
      <body className="bg-surface text-on-surface font-body-md antialiased">
        <Providers initialLang={lang}>{children}</Providers>
        <MockModeBar />
      </body>
    </html>
  );
}
