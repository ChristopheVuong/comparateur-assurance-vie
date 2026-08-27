import {
  LIBELLES_GROUPE,
  grouper,
  totalFrais,
  type ResultatAccessible,
} from '../lib/assuranceVie';
import { RESERVES_FISCALES } from '../lib/fiscalite';
import { LIBELLES_GENRE_RESERVE, contrat, type GenreReserve } from '../lib/contrats';
import { support } from '../lib/supports';
import { SEUIL_EUR_VISIBLE, eur, taux } from '../lib/format';

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

/** Presentation only — what each kind of reservation is *called* lives in the catalogue. */
const TONS: Record<GenreReserve, { fond: string; texte: string }> = {
  promotion: { fond: 'bg-ambre-100', texte: 'text-ambre-700' },
  contrainte: { fond: 'bg-azur-100', texte: 'text-azur-600' },
  liquidite: { fond: 'bg-brique-100', texte: 'text-brique-700' },
  univers: { fond: 'bg-brand-100', texte: 'text-brand-700' },
  donnee: { fond: 'bg-ink-100', texte: 'text-ink-600' },
  fermeture: { fond: 'bg-ink-100', texte: 'text-ink-600' },
};

export function Detail({ r }: { r: ResultatAccessible }) {
  const c = contrat(r.cle);
  const s = support(r.supportRetenu);
  const fonds = c.fondsEuros.find((f) => f.cle === r.fondsRetenu) ?? c.fondsEuros[0];
  const derniere = r.annees.at(-1);

  // The lines come from the catalogue, not from a list written here: this panel
  // once enumerated seven of eight items and summed its own list rather than
  // the record, so a deduction existed that no total counted.
  //
  // The total is taken over every item, including the ones too small to earn a
  // row — hiding a line and quietly dropping it from the sum is how a breakdown
  // stops adding up.
  const visible = (l: { montant: number }) => l.montant > SEUIL_EUR_VISIBLE;
  const lignes = grouper(r.coutsPreleves, ['frais']).filter(visible);
  const total = totalFrais(r.coutsPreleves);
  // Kept out of the reconciliation below, and on purpose: a fee-free version of
  // the same contract forfeits this reserve too, so it is not part of what the
  // fees cost. Money lost all the same, hence its own line.
  const penalites = grouper(r.coutsPreleves, ['penalite']).filter(visible);
  const impots = grouper(r.coutsPreleves, ['impot']).filter(visible);

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
        {lignes.map((l) => (
          <div key={l.groupe} className="flex items-baseline gap-3">
            <dt className="shrink-0 text-ink-600">{LIBELLES_GROUPE[l.groupe]}</dt>
            <span className="h-px min-w-4 flex-1 self-end border-b border-dotted border-ink-200" />
            <dd className="tabular shrink-0 font-medium text-ink-900">{eur(l.montant)}</dd>
          </div>
        ))}
        <div className="flex items-baseline gap-3 border-t border-ink-200 pt-2">
          <dt className="shrink-0 font-medium text-ink-700">Total prélevé</dt>
          <span className="h-px min-w-4 flex-1 self-end" />
          <dd className="tabular shrink-0 font-semibold text-ink-900">{eur(total)}</dd>
        </div>
        <div className="flex items-baseline gap-3">
          <dt className="shrink-0 text-ink-600">
            Et le rendement que cet argent n’a pas produit
          </dt>
          <span className="h-px min-w-4 flex-1 self-end border-b border-dotted border-ink-200" />
          <dd className="tabular shrink-0 font-medium text-ink-900">
            {eur(r.coutFraisAvantImpot - total)}
          </dd>
        </div>
        <div className="flex items-baseline gap-3">
          <dt className="shrink-0 text-ink-600">Moins l’impôt que ces frais vous ont épargné</dt>
          <span className="h-px min-w-4 flex-1 self-end border-b border-dotted border-ink-200" />
          <dd className="tabular shrink-0 font-medium text-jade-600">
            {eur(-(r.coutFraisAvantImpot - r.manqueAGagner))}
          </dd>
        </div>
        {/* The tax has a line of its own, outside the reconciliation above: it
            is not what the contract costs, and it is the same for all of them —
            but a breakdown of where the money went that never mentioned the
            state would be a strange thing to publish. */}
        {impots.map((l) => (
          <div key={l.groupe} className="flex items-baseline gap-3 border-t border-ink-200 pt-2">
            <dt className="shrink-0 text-ink-600">{LIBELLES_GROUPE[l.groupe]}</dt>
            <span className="h-px min-w-4 flex-1 self-end border-b border-dotted border-ink-200" />
            <dd className="tabular shrink-0 font-medium text-ink-900">{eur(l.montant)}</dd>
          </div>
        ))}
      </dl>
      <p className="field-hint mt-3">
        Un euro pris par l’assureur est un euro que le fisc ne taxe pas : une part de chaque frais
        vous revient par une plus-value plus faible. Le coût final est donc inférieur à la somme
        prélevée augmentée du rendement perdu — sans cesser d’être un coût.
      </p>

      {penalites.length > 0 && (
        <div className="mt-4 rounded-xl border border-brique-100 bg-brique-50 px-4 py-3">
          <dl className="space-y-1.5 text-sm">
            {penalites.map((l) => (
              <div key={l.groupe} className="flex items-baseline gap-3">
                <dt className="shrink-0 font-medium text-brique-700">
                  {LIBELLES_GROUPE[l.groupe]}
                </dt>
                <span className="h-px min-w-4 flex-1 self-end border-b border-dotted border-brique-200" />
                <dd className="tabular shrink-0 font-semibold text-brique-700">
                  {eur(l.montant)}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs leading-relaxed text-ink-600">
            Compté à part, et ce n’est pas une faveur faite au contrat : ce ne sont pas des frais.
            Le même contrat sans aucun frais perdrait cette réserve tout autant, puisqu’elle tient
            à la règle des huit ans et non à un tarif. Ce sont des intérêts que vous avez vu
            s’accumuler et que vous ne toucherez pas — le taux mis en avant à la souscription
            supposait que vous restiez.
          </p>
        </div>
      )}

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
                  {LIBELLES_GENRE_RESERVE[res.genre]}
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
