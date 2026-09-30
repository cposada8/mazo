import Link from "next/link";
import { ETIQUETA_DE_VERSION } from "@/lib/version";
import { BookOpen, LayoutList } from "lucide-react";
import { AliasEditable } from "@/components/identidad";
import { Puerta } from "@/components/puerta";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-10 px-6 py-16">
      <header className="flex flex-col gap-3">
        <h1 className="text-5xl font-semibold tracking-tight">Mazo</h1>
        <p className="text-muted-foreground text-lg text-balance">
          Juegos de cartas. Empezando por{" "}
          <span className="text-foreground font-medium">Carioca</span>.
        </p>
        <AliasEditable />
      </header>

      <Puerta />

      {/*
        The contracts used to be listed here, seven of them, hard-coded —
        until the catalog grew to twelve and which ones a partida plays
        became the host's choice (Phase 61). There is no one list to show,
        so the home page shows none; «Cómo se juega» explains them.
      */}
      <nav className="flex flex-col gap-px overflow-hidden rounded-lg border">
        <Link
          href="/como-se-juega"
          className="bg-card hover:bg-accent flex items-center gap-3 px-4 py-3 transition-colors"
        >
          <BookOpen className="size-4 shrink-0" aria-hidden />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm font-medium">Cómo se juega</span>
            <span className="text-muted-foreground text-xs">
              Los contratos, el turno, los grupos, los comodines y el puntaje
            </span>
          </span>
        </Link>
        {/*
          Visible to everyone (Phase 62): the panel keeps its key, so a
          visitor who follows this meets the key screen and its way back.
        */}
        <Link
          href="/panel"
          className="bg-card hover:bg-accent flex items-center gap-3 px-4 py-3 transition-colors"
        >
          <LayoutList className="size-4 shrink-0" aria-hidden />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm font-medium">Panel</span>
            <span className="text-muted-foreground text-xs">
              Las partidas abiertas, con clave
            </span>
          </span>
        </Link>
      </nav>

      <footer className="text-muted-foreground mt-auto flex flex-col gap-1 text-sm">
        <p className="tabular-nums">Mazo {ETIQUETA_DE_VERSION}</p>
        <p>
          Por{" "}
          <a
            href="https://github.com/cposada8"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground hover:text-muted-foreground font-medium underline underline-offset-2 transition-colors"
          >
            Esteban Posada
          </a>
        </p>
      </footer>
    </main>
  );
}
