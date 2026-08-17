const CONTRATOS = [
  { n: 1, nombre: "Dos tríos" },
  { n: 2, nombre: "Un trío y una escala" },
  { n: 3, nombre: "Dos escalas" },
  { n: 4, nombre: "Tres tríos" },
  { n: 5, nombre: "Dos tríos y una escala" },
  { n: 6, nombre: "Dos escalas y un trío" },
  { n: 7, nombre: "Tres escalas" },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-10 px-6 py-16">
      <header className="flex flex-col gap-3">
        <h1 className="text-5xl font-semibold tracking-tight">Mazo</h1>
        <p className="text-muted-foreground text-lg text-balance">
          Juegos de cartas. Empezando por{" "}
          <span className="text-foreground font-medium">Carioca</span>.
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          Los contratos
        </h2>
        <ol className="flex flex-col gap-px overflow-hidden rounded-lg border">
          {CONTRATOS.map((c) => (
            <li
              key={c.n}
              className="bg-card flex items-baseline gap-3 px-4 py-3 text-sm"
            >
              <span className="text-muted-foreground tabular-nums">{c.n}</span>
              <span>{c.nombre}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          Mientras se construye
        </h2>
        <nav className="flex flex-col gap-px overflow-hidden rounded-lg border">
          <a
            href="/mesa"
            className="bg-card hover:bg-accent flex flex-col gap-0.5 px-4 py-3 transition-colors"
          >
            <span className="text-sm font-medium">La mesa</span>
            <span className="text-muted-foreground text-xs">
              Una partida entera jugada por bots, paso a paso
            </span>
          </a>
          <a
            href="/pruebas"
            className="bg-card hover:bg-accent flex flex-col gap-0.5 px-4 py-3 transition-colors"
          >
            <span className="text-sm font-medium">Banco de pruebas</span>
            <span className="text-muted-foreground text-xs">
              Repartos con semilla y validación de grupos
            </span>
          </a>
        </nav>
      </section>

      <footer className="text-muted-foreground mt-auto text-sm">
        En construcción. Todavía no se puede jugar.
      </footer>
    </main>
  );
}
