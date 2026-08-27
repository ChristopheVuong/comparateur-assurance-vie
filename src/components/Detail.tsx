import {
  LIBELLES_GROUPE,
  coutRachatPartiel,
  grouper,
  tauxActuariel,
  totalFrais,
  type ResultatAccessible,
} from '../lib/assuranceVie';
import { RESERVES_FISCALES } from '../lib/fiscalite';
import { ABATTEMENT_990I, RESERVES_SUCCESSION } from '../lib/succession';
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
        <Chiffre
          libelle={
            r.denouement === 'deces'
              ? 'Vos bénéficiaires reçoivent, net de droits'
              : 'Vous récupérez, net d’impôt'
          }
          valeur={eur(r.capitalNet)}
          // Only where it means what it looks like it means: against zero
          // versé the ratio is either undefined or an artefact of the ticket
          // minimum, never a return on anything the reader put in.
          complement={r.primesVersees > 0 ? taux((r.capitalNet - r.primesVersees) / r.primesVersees) : undefined}
          // The Livret A comparison: a constant yearly rate, not the total
          // gain above. `tauxActuariel` is `null` only on a plan no fee
          // schedule in the catalogue actually produces — nothing is shown
          // rather than a number that would not mean what it claims.
          sousLigne={
            (() => {
              const tri = tauxActuariel(r);
              return tri === null ? undefined : `≈ ${taux(tri, 2)} par an, taux actuariel`;
            })()
          }
          fort
        />
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

      <Retrait r={r} />

      {r.succession && <Transmission r={r} />}

      <Liquidite r={r} />

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
        {/* The regime decides the list. Printing the eight-year allowance under
            a death benefit would describe a rule that does not apply to it, and
            printing both would leave the reader to work out which. */}
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-500">
          {(r.denouement === 'deces' ? RESERVES_SUCCESSION : RESERVES_FISCALES).map((texte) => (
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

/**
 * The withdrawal taken along the way, shown because otherwise the headline
 * figure stops adding up.
 *
 * `capitalNet` counts the cash already pocketed, and a reader who cannot see
 * that line has no way to reconcile a total that exceeds what the policy is
 * finally worth. The reserve forfeited to it is named here too, next to the
 * event that caused it, rather than only in the penalty box further down.
 */
function Retrait({ r }: { r: ResultatAccessible }) {
  const a = r.annees.find((x) => x.rachatBrut > 0);
  if (!a) return null;
  const demande = a.rachatBrut;

  return (
    <>
      <h4 className="mt-8 text-sm font-semibold text-ink-900">
        Le retrait de l’année {a.annee}
      </h4>
      <dl className="mt-3 space-y-2 text-sm">
        <Poste terme="Retiré du contrat" montant={demande} />
        <Poste terme="Impôt et prélèvements retenus dessus" montant={a.impotRachat} sourdine />
        {a.perteProvision > SEUIL_EUR_VISIBLE && (
          <Poste terme="Réserve de fidélité amputée au passage" montant={a.perteProvision} sourdine />
        )}
        <Poste terme="Encaissé, net" montant={r.rachatIntermediaireNet} ton="jade" />
      </dl>
      <p className="field-hint mt-3">
        Cette somme est comptée dans le total ci-dessus, à sa valeur faciale : le simulateur ne
        sait pas ce qu’elle est devenue ensuite et n’allait pas l’inventer. Ce qu’elle coûte
        vraiment est le rendement qu’elle n’a plus produit jusqu’au terme — visible en comparant
        avec un plan qu’on ne touche pas.
      </p>
    </>
  );
}

/**
 * How the death benefit is taxed, which is a story about dates rather than
 * about money.
 *
 * The split between the two articles is printed even when it is one hundred per
 * cent on one side, because *that* is the answer worth reading: a reader who
 * sees "100 % sous l'article 990 I" learns that the seventieth birthday never
 * came into it, which no absence of a line could have told them.
 */
function Transmission({ r }: { r: ResultatAccessible }) {
  const s = r.succession;
  if (!s) return null;
  const partApres = 1 - s.partAvant70;

  return (
    <>
      <h4 className="mt-8 text-sm font-semibold text-ink-900">Ce qui revient aux bénéficiaires</h4>
      <dl className="mt-3 space-y-2 text-sm">
        <Poste terme="Capital transmis, avant droits" montant={s.capital990I + s.capital757B} />
        <Poste
          terme={`Sous l’article 990 I — versements avant 70 ans (${taux(s.partAvant70)})`}
          montant={s.capital990I}
          sourdine
        />
        {partApres > 1e-9 && (
          <Poste
            terme={`Sous l’article 757 B — versements après 70 ans (${taux(partApres)})`}
            montant={s.capital757B}
            sourdine
          />
        )}
        <Poste terme="Dont abattements, hors droits" montant={s.abattement990I} ton="jade" />
        <Poste terme="Droits dus au titre du 990 I" montant={s.droits990I} />
        {partApres > 1e-9 && (
          <Poste terme="Droits dus au titre du 757 B" montant={s.droits757B} />
        )}
      </dl>
      <p className="field-hint mt-3">
        {s.droits990I === 0 && s.droits757B === 0
          ? `Rien n’est dû : le capital tient dans les abattements. Tant qu’une part reste sous ${eur(ABATTEMENT_990I)} par bénéficiaire, c’est le contrat qui décide du résultat, pas le fisc.`
          : `Les gains ne rencontrent jamais l’impôt sur le revenu ici : seuls les prélèvements sociaux ont été retenus, puis les droits ci-dessus. C’est ce qui rend la valeur brute — et non le net après rachat — la bonne colonne à comparer dans une logique de transmission.`}
        {s.assiette757B > 0 &&
          ` Les ${eur(s.assiette757B)} de primes versées après 70 ans au-delà de l’abattement sont taxées au taux que vous avez supposé ; leurs gains, eux, sont exonérés.`}
      </p>
    </>
  );
}

/**
 * What could actually be taken out, year by year — on every contract, not
 * only the one whose euro fund locks interest away.
 *
 * A reader comparing six contracts has no way to tell, from the headline
 * figure alone, which of them is even asking the question: silence reads as
 * "not relevant here", not as "verified identical". So this section is shown
 * for every contract, and it says one of two things — never nothing.
 *
 *  - **No reserve at all**: one sentence, because a twenty-row table where
 *    both columns repeat the same number would be noise dressed as rigour.
 *  - **A reserve exists**: the full year-by-year table, because that is
 *    exactly the shape of the thing a reader needs to see — not a single
 *    snapshot, and not a summary that hides the plateau.
 */
function Liquidite({ r }: { r: ResultatAccessible }) {
  const c = contrat(r.cle);
  const fonds = c.fondsEuros.find((f) => f.cle === r.fondsRetenu);
  const provisionDe = fonds?.provisionFidelite;
  const anneesAvecReserve = provisionDe
    ? r.annees.filter((a) => a.provisionFin > SEUIL_EUR_VISIBLE)
    : [];

  if (!provisionDe || anneesAvecReserve.length === 0) {
    return (
      <>
        <h4 className="mt-8 text-sm font-semibold text-ink-900">
          Ce que vous pourriez réellement retirer
        </h4>
        <p className="mt-1 text-sm leading-relaxed text-ink-600">
          Ce contrat n’a aucune réserve non rachetable : la valeur affichée est, chaque année,
          intégralement disponible. Rien n’y distingue le montant du relevé de ce qu’un rachat
          total libérerait.
        </p>
      </>
    );
  }

  const annee = Math.min(r.annees.length, provisionDe.termeAnnees - 1);
  const a = r.annees.find((x) => x.annee === annee);

  // A round tenth of what is redeemable: big enough to matter, small enough
  // that nobody reads it as advice to empty the policy.
  const rachat =
    a && a.provisionFin > SEUIL_EUR_VISIBLE
      ? coutRachatPartiel(r, annee, Math.max(1_000, Math.round(a.valeurRachat / 10_000) * 1_000))
      : null;

  return (
    <>
      <h4 className="mt-8 text-sm font-semibold text-ink-900">
        Ce que vous pourriez réellement retirer
      </h4>
      <p className="mt-1 text-xs leading-relaxed text-ink-500">
        Année par année, tant que la réserve de fidélité n’est pas acquise : la valeur du relevé,
        et ce qu’un rachat total libérerait réellement — la réserve exclue. Les deux
        colonnes se rejoignent au terme.
      </p>
      <div className="mt-3 overflow-x-auto rounded-xl border border-ink-200">
        <table className="w-full min-w-[28rem] text-sm">
          <thead>
            <tr className="border-b border-ink-200 bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-400">
              <th scope="col" className="px-4 py-2 font-medium">
                Fin d’année
              </th>
              <th scope="col" className="px-4 py-2 text-right font-medium">
                Valeur affichée
              </th>
              <th scope="col" className="px-4 py-2 text-right font-medium">
                Réellement disponible
              </th>
              <th scope="col" className="px-4 py-2 text-right font-medium">
                Écart
              </th>
            </tr>
          </thead>
          <tbody>
            {anneesAvecReserve.map((an) => (
              <tr key={an.annee} className="border-b border-ink-100 last:border-0">
                <td className="px-4 py-1.5 text-ink-700">{an.annee}</td>
                <td className="tabular px-4 py-1.5 text-right text-ink-900">{eur(an.valeurFin)}</td>
                <td className="tabular px-4 py-1.5 text-right font-medium text-jade-600">
                  {eur(an.valeurRachat)}
                </td>
                <td className="tabular px-4 py-1.5 text-right text-brique-600">
                  {eur(an.provisionFin)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rachat && (
        <div className="mt-4 rounded-xl border border-ambre-100 bg-ambre-50 px-4 py-3">
          <p className="text-sm leading-relaxed text-ink-700">
            Retirer <strong className="font-semibold">{eur(rachat.montant)}</strong> cette
            année-là coûterait <strong className="font-semibold">{eur(rachat.manqueAuTerme)}</strong>{' '}
            de réserve
            {rachat.prisSurUnites > SEUIL_EUR_VISIBLE
              ? ` — le rachat est d’abord servi par les unités de compte, qui en absorbent ${eur(rachat.prisSurUnites)} avant que le fonds en euros ne soit touché`
              : ''}
            . Solder le fonds au lieu de retirer ce montant en coûterait{' '}
            <strong className="font-semibold">{eur(rachat.solderCouterait)}</strong>.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-ink-600">
            La réserve est amputée à due proportion de ce qui sort du fonds en euros, jamais en
            totalité — c’est la sortie complète qui la détruit. L’écart entre les deux est le seul
            arbitrage qui compte si un besoin d’argent survient avant le terme.
          </p>
        </div>
      )}
    </>
  );
}

/** One line of a breakdown: a term, dots, an amount. */
function Poste({
  terme,
  montant,
  sourdine = false,
  ton,
}: {
  terme: string;
  montant: number;
  sourdine?: boolean;
  ton?: 'jade';
}) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className={['shrink-0', sourdine ? 'pl-4 text-ink-500' : 'text-ink-600'].join(' ')}>
        {terme}
      </dt>
      <span className="h-px min-w-4 flex-1 self-end border-b border-dotted border-ink-200" />
      <dd
        className={[
          'tabular shrink-0 font-medium',
          ton === 'jade' ? 'text-jade-600' : sourdine ? 'text-ink-500' : 'text-ink-900',
        ].join(' ')}
      >
        {eur(montant)}
      </dd>
    </div>
  );
}

function Chiffre({
  libelle,
  valeur,
  complement,
  sousLigne,
  fort = false,
  ton,
}: {
  libelle: string;
  valeur: string;
  /** A rate shown beside the amount — the return the amount represents, when one exists. */
  complement?: string;
  /** A second rate shown underneath — comparable to an external one, not to this figure's own total. */
  sousLigne?: string;
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
      <div className="mt-1 flex items-baseline gap-2">
        <span
          className={[
            'tabular text-2xl font-semibold',
            ton === 'brique' ? 'text-brique-600' : fort ? 'text-brand-700' : 'text-ink-900',
          ].join(' ')}
        >
          {valeur}
        </span>
        {complement && <span className="tabular text-sm font-medium text-ink-500">{complement}</span>}
      </div>
      {sousLigne && <div className="tabular mt-0.5 text-xs text-ink-500">{sousLigne}</div>}
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
