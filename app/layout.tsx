import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ProveedorDeIdentidad } from "@/components/identidad";
import { ProveedorDeTema, SelectorDeTema } from "@/components/tema";
import { parsearAlias } from "@/lib/alias";

/**
 * The alias list is the file (Phase 32), read here so every page shares one
 * identity. Curating it is editing `public/candidatos/alias.txt` and pushing —
 * the same workflow as the comodín gallery.
 */
function leerAliases(): string[] {
  try {
    return parsearAlias(
      readFileSync(
        join(process.cwd(), "public", "candidatos", "alias.txt"),
        "utf8",
      ),
    );
  } catch {
    return [];
  }
}

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mazo",
  description: "Juegos de cartas. Empezando por Carioca.",
};

// `cover` lets the table reach the notch's row instead of living in a
// letterbox; the game pads its own safe areas so no card hides behind it.
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ProveedorDeTema>
          <ProveedorDeIdentidad aliases={leerAliases()}>
            <div className="mx-auto flex w-full max-w-3xl justify-end px-4 pt-3">
              <SelectorDeTema />
            </div>
            {children}
          </ProveedorDeIdentidad>
        </ProveedorDeTema>
      </body>
    </html>
  );
}
