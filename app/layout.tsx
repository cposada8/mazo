import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ProveedorDeTema, SelectorDeTema } from "@/components/tema";

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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ProveedorDeTema>
          <div className="mx-auto flex w-full max-w-3xl justify-end px-4 pt-3">
            <SelectorDeTema />
          </div>
          {children}
        </ProveedorDeTema>
      </body>
    </html>
  );
}
