import { DATE_RELEVE } from '../lib/contrats';

/**
 * The frame: header, disclaimer, footer.
 *
 * The disclaimer sits near the top rather than in small print at the bottom,
 * and it is not legal throat-clearing. A page that ranks named commercial
 * products by how much money they hand back has to say plainly what it is and
 * what it is not, before anybody acts on a row of it.
 */

export function Entete({ lienPartage }: { lienPartage: string }) {
  return (
    <header className="sticky top-0 z-10 border-b border-ink-200/70 bg-white/90 backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
        <a href="#" className="group flex items-baseline gap-2.5">
          <span className="text-base font-semibold tracking-tight text-ink-900">
            Ce que votre contrat vous laisse
          </span>
          <span className="hidden text-xs text-ink-400 sm:inline">
            comparateur d’assurance-vie
          </span>
        </a>
        <a
          href="#methode"
          className="shrink-0 text-sm font-medium text-brand-600 transition hover:text-brand-700"
        >
          Méthode
        </a>
      </div>
      <span className="sr-only">{lienPartage}</span>
    </header>
  );
}

export function Avertissement() {
  return (
    <div className="rounded-xl border border-ambre-100 bg-ambre-100/40 px-4 py-3 text-sm leading-relaxed text-ink-600">
      <strong className="font-semibold text-ink-800">Ceci n’est pas un conseil.</strong> Cet outil
      compare des grilles tarifaires publiques, relevées le{' '}
      {DATE_RELEVE.split('-').reverse().join('/')}, sous des hypothèses que vous choisissez. Il ne
      connaît ni votre situation, ni votre fiscalité réelle, ni ce que les marchés feront. Un
      contrat qui sort en tête ici peut être le mauvais pour vous.
    </div>
  );
}

export function Pied() {
  return (
    <footer className="border-t border-ink-200/70 bg-white print:hidden">
      <div className="mx-auto max-w-6xl px-5 py-8 text-sm text-ink-400">
        <p>
          Aucune donnée ne quitte votre navigateur : tout le calcul se fait sur cette page, et
          l’adresse est le seul endroit où votre plan est écrit.
        </p>
        <p className="mt-2">
          Design inspiré de{' '}
          <a
            href="https://github.com/Commutator-IO/fire-simulator"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-ink-300 underline-offset-2 transition hover:text-ink-600"
          >
            fire-simulator
          </a>
          , par{' '}
          <a
            href="https://github.com/mycaule"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-ink-300 underline-offset-2 transition hover:text-ink-600"
          >
            Michel Hua
          </a>
          .
        </p>
      </div>
    </footer>
  );
}
