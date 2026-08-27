import type { ResultatAccessible } from '../lib/assuranceVie';
import { RESERVES_FISCALES } from '../lib/fiscalite';
import { contrat, type GenreReserve } from '../lib/contrats';
import { support } from '../lib/supports';
import { eur, taux } from '../lib/format';

/**
 * Where the money went, for one contract.
 *
 * Two figures for the cost, and deliberately not one. `coutsPreleves` is the
 * sum of what was actually deducted and reconciles exactly; `manqueAGagner` is
 * what those deductions finally cost once the return they never made — and the
 * tax they incidentally saved — are both counted. Showing only the first
 * understates; showing only the second cannot be checked against anything.
 *
 * The reservations come from the catalogue, the alerts from this particular
 * plan. Keeping them apart is what stops a warning about an eight-year lock
 * being printed for somebody saving for twenty years.
 */

const TONS: Record<GenreReserve, { fond: string; texte: string; titre: string }> = {
  promotion: { fond: 'bg-ambre-100', texte: 'text-ambre-700', titre: 'Offre temporaire' },
  contrainte: { fond: 'bg-azur-100', texte: 'text-azur-600', titre: 'Contrainte' },
  liquidite: { fond: 'bg-brique-100', texte: 'text-brique-700', titre: 'Disponibilité' },
  univers: { fond: 'bg-brand-100', texte: 'text-brand-700', titre: 'Catalogue' },
  donnee: { fond: 'bg-ink-100', texte: 'text-ink-600', titre: 'Réserve sur la donnée' },
  fermeture: { fond: 'bg-ink-100', texte: 'text-ink-600', titre: 'Souscription' },
};

export function Detail({ r }: { r: ResultatAccessible }) {
  const c = contrat(r.cle);
  const s = support(r.supportRetenu);
  const fonds = c.fondsEuros.find((f) => f.cle === r.fondsRetenu) ?? c.fondsEuros[0];
  const derniere = r.annees.at(-1);

  const tous = [
    { libelle: 'Frais sur versement et adhésion', montant: r.coutsPreleves.versement + r.coutsPreleves.adhesion },
    { libelle: 'Frais de gestion du contrat', montant: r.coutsPreleves.gestionContrat },
    { libelle: 'Frais courants des supports', montant: r.coutsPreleves.support },
    { libelle: 'Frais sur encours', montant: r.coutsPreleves.encours },
    { libelle: 'Arbitrages', montant: r.coutsPreleves.arbitrage },
    { libelle: 'Réserve de fidélité perdue', montant: r.coutsPreleves.provisionPerdue },
  ];

  // The total is taken over every line, including the ones too small to be
  // worth a row: hiding a line and quietly dropping it from the sum is how a
  // breakdown stops adding up.
  const totalFrais = tous.reduce((s, p) => s + p.montant, 0);
  const postes = tous.filter((p) => p.montant > 0.5);

  return (
    <div className="card p-6 sm:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-xl font-semibold tracking-tight text-ink-900">{c.libelle}</h3>
        <span className="text-sm text-ink-500">
          {c.assureur}
          {c.distributeur && c.distributeur !== c.assureur ? ` · ${c.distributeur}` : ''}
        </span>
      </div>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-500">{c.note}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Chiffre libelle="Vous avez versé" valeur={eur(r.primesVersees)} />
        <Chiffre libelle="Vous récupérez, net d’impôt" valeur={eur(r.capitalNet)} fort />
        <Chiffre
          libelle="Les frais vous ont coûté"
          valeur={eur(r.manqueAGagner)}
          ton="brique"
        />
      </div>

      {/* ------------------------------------- Où part l'argent */}

      <h4 className="mt-8 text-sm font-semibold text-ink-900">Où part l’argent</h4>
      <dl className="mt-3 space-y-2 text-sm">
        {postes.map((p) => (
          <div key={p.libelle} className="flex items-baseline gap-3">
            <dt className="shrink-0 text-ink-600">{p.libelle}</dt>
            <span className="h-px min-w-4 flex-1 self-end border-b border-dotted border-ink-200" />
            <dd className="tabular shrink-0 font-medium text-ink-900">{eur(p.montant)}</dd>
          </div>
        ))}
        <div className="flex items-baseline gap-3 border-t border-ink-200 pt-2">
          <dt className="shrink-0 font-medium text-ink-700">Total prélevé</dt>
          <span className="h-px min-w-4 flex-1 self-end" />
          <dd className="tabular shrink-0 font-semibold text-ink-900">{eur(totalFrais)}</dd>
        </div>
        <div className="flex items-baseline gap-3">
          <dt className="shrink-0 text-ink-600">
            Et le rendement que cet argent n’a pas produit
          </dt>
          <span className="h-px min-w-4 flex-1 self-end border-b border-dotted border-ink-200" />
          <dd className="tabular shrink-0 font-medium text-ink-900">
            {eur(r.coutFraisAvantImpot - totalFrais)}
          </dd>
        </div>
        <div className="flex items-baseline gap-3">
          <dt className="shrink-0 text-ink-600">Moins l’impôt que ces frais vous ont épargné</dt>
          <span className="h-px min-w-4 flex-1 self-end border-b border-dotted border-ink-200" />
          <dd className="tabular shrink-0 font-medium text-jade-600">
            {eur(-(r.coutFraisAvantImpot - r.manqueAGagner))}
          </dd>
        </div>
      </dl>
      <p className="field-hint mt-3">
        Un euro pris par l’assureur est un euro que le fisc ne taxe pas : une part de chaque frais
        vous revient par une plus-value plus faible. Le coût final est donc inférieur à la somme
        prélevée augmentée du rendement perdu — sans cesser d’être un coût.
      </p>

      {/* ------------------------------------- Composition */}

      <h4 className="mt-8 text-sm font-semibold text-ink-900">Ce que le contrat a retenu</h4>
      <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        <Ligne terme="Fonds en euros" valeur={fonds.libelle} note={fonds.note} />
        <Ligne
          terme="Support en unités de compte"
          valeur={`${s.libelle} — ${taux(s.ter)} de frais courants`}
          note={s.note}
        />
        <Ligne
          terme="Taux servi retenu"
          valeur={taux(derniere?.tauxEurosApplique ?? 0, 3)}
          note={
            derniere && derniere.rangPalier > 0
              ? `Palier atteint grâce à votre part d’unités de compte.`
              : fonds.bareme
                ? 'Palier de base : votre part d’unités de compte n’atteint aucun seuil.'
                : 'Ce fonds sert le même taux à tous, sans condition d’allocation.'
          }
        />
        <Ligne
          terme="Part d’UC à l’arrivée"
          valeur={taux(r.partUCFinale)}
          note={
            r.partUCFinale > 0.001
              ? 'Les unités de compte montent plus vite que le fonds en euros : sans rééquilibrage, la cible dérive.'
              : undefined
          }
        />
      </dl>

      {/* ------------------------------------- Réserves */}

      {(r.alertes.length > 0 || c.reserves.length > 0) && (
        <>
          <h4 className="mt-8 text-sm font-semibold text-ink-900">Ce qu’il faut savoir</h4>
          <ul className="mt-3 space-y-2.5">
            {[...r.alertes, ...c.reserves].map((res, i) => (
              <li key={`${res.genre}-${i}`} className="flex gap-3 text-sm leading-relaxed">
                <span
                  className={[
                    'mt-0.5 h-fit shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium',
                    TONS[res.genre].fond,
                    TONS[res.genre].texte,
                  ].join(' ')}
                >
                  {TONS[res.genre].titre}
                </span>
                <span className="text-ink-600">{res.texte}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <details className="mt-6">
        <summary className="cursor-pointer text-sm font-medium text-ink-500 transition hover:text-brand-700">
          Réserves valables pour tous les contrats
        </summary>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-500">
          {RESERVES_FISCALES.map((texte) => (
            <li key={texte} className="border-l-2 border-ink-200 pl-3">
              {texte}
            </li>
          ))}
        </ul>
      </details>

      {/* ------------------------------------- Sources */}

      <div className="mt-6 border-t border-ink-200/70 pt-4">
        <span className="text-xs font-medium uppercase tracking-wide text-ink-400">Sources</span>
        <ul className="mt-2 space-y-1.5">
          {c.sources.map((s) => (
            <li key={s.url} className="text-sm">
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="text-ink-700 underline decoration-ink-300 underline-offset-2 transition hover:text-brand-700"
              >
                {s.libelle}
              </a>
              <span className="ml-2 text-xs text-ink-400">
                consultée le {s.consulteLe.split('-').reverse().join('/')} ↗
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Chiffre({
  libelle,
  valeur,
  fort = false,
  ton,
}: {
  libelle: string;
  valeur: string;
  fort?: boolean;
  ton?: 'brique';
}) {
  return (
    <div
      className={[
        'rounded-xl border px-4 py-3',
        fort ? 'border-brand-200 bg-brand-50' : 'border-ink-200 bg-ink-50/60',
      ].join(' ')}
    >
      <div className="text-xs text-ink-500">{libelle}</div>
      <div
        className={[
          'tabular mt-1 text-2xl font-semibold',
          ton === 'brique' ? 'text-brique-600' : fort ? 'text-brand-700' : 'text-ink-900',
        ].join(' ')}
      >
        {valeur}
      </div>
    </div>
  );
}

function Ligne({ terme, valeur, note }: { terme: string; valeur: string; note?: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink-400">{terme}</dt>
      <dd className="mt-0.5 font-medium text-ink-900">{valeur}</dd>
      {note && <p className="mt-1 text-xs leading-relaxed text-ink-500">{note}</p>}
    </div>
  );
}
