/**
 * The same savings plan, run through every contract in the catalogue.
 *
 * One question, and only one: **given the same payments, the same allocation
 * and the same market, how much does each contract hand back?** Everything the
 * user types is held identical across the six; what differs is only what is
 * taken out along the way. That is what makes the answer a price tag on fees
 * rather than a forecast.
 *
 * Four decisions carry the model, and each of them changes the figure:
 *
 *  - **Entry fees come off before any return.** You cannot earn a return on
 *    money the insurer kept. Capitalising first would hand every front-loaded
 *    contract exactly one year's growth on its own fee — small, systematic, and
 *    in the seller's favour.
 *  - **Fees compound multiplicatively, never additively.** `(1 − ter) × (1 − fg)`
 *    and not `1 − ter − fg`, because charges are levied on the value rather
 *    than on the payment. The gap is a basis point or two a year, and adding
 *    would overstate the fees — wrong in the flattering direction is still
 *    wrong.
 *  - **Instalments are credited mid-year.** Crediting monthly payments on the
 *    first of January hands them a full year of growth they never had. The
 *    actuarial half-year convention is exact to second order for an even flow,
 *    fits in one factor, and keeps the yearly accounting identity closed and
 *    testable. A monthly inner loop costs twelve times as much and improves
 *    nothing anyone can see.
 *  - **Social levies are deducted from the euro pocket, not accrued off to one
 *    side.** That is what actually happens, and it makes the cost of those
 *    levies compound — which is the entire point of showing them.
 *
 * Promotional rates are **not projected**. A campaign covering two vintages,
 * carried out twenty years, is an error rather than an option, so the engine
 * always serves the base tier. While such an offer is still open it runs the
 * plan a second time with the promotion honoured, so the caveat arrives as an
 * amount of money rather than a sentence; once the campaign has closed there is
 * nothing left to quote and the caveat says so instead.
 */

import {
  ABATTEMENT,
  PRELEVEMENTS_SOCIAUX,
  estFoyer,
  imposer,
  imposerDeces,
  type Foyer,
  type Imposition,
} from './fiscalite';
import {
  ABATTEMENT_990I,
  AGE_PIVOT,
  TAUX_DROITS_DEFAUT,
  imposerSuccession,
  type Succession,
} from './succession';
import {
  ANNEE_REFERENCE,
  CONTRATS,
  DATE_RELEVE,
  TICKET_MAXIMAL,
  avecPromotion,
  contrat as contratDe,
  promotionExpiree,
  sansFrais,
  tauxDeBase,
  type Bareme,
  type CleContrat,
  type CleFondsEuros,
  type Contrat,
  type FondsEuros,
  type Reserve,
} from './contrats';
import {
  RENDEMENT_BRUT,
  estClasseActif,
  meilleurSupport,
  type ClasseActif,
  type CleSupport,
  type Support,
} from './supports';

// ---------------------------------------------------------------------------
// Hypotheses
// ---------------------------------------------------------------------------

export type Periodicite = 'aucune' | 'mensuelle' | 'trimestrielle' | 'annuelle';

/**
 * How the target allocation is kept — or not.
 *
 *  - `aucun` — the split is set on each payment and never touched again.
 *  - `versements` — new payments are steered towards the target. Realistic, and
 *    free: no arbitrage is charged.
 *  - `annuel` — the pockets are brought back to target every year, and the
 *    arbitrage is charged for.
 */
export type Rebalancement = 'aucun' | 'versements' | 'annuel';

/** Which euro-fund rate is carried forward over the whole horizon. */
export type SourceTaux = 'derniere-annee' | 'moyenne-historique';

/**
 * How the policy ends at the horizon — and it ends, one way or the other.
 *
 * Not a detail of the settlement but a fork in what the plan *is for*, and the
 * two branches disagree about almost everything that happens on the last day:
 *
 *  - `rachat` — the saver surrenders the policy and spends the money. Income
 *    tax on the gain, the eight-year allowance, and any fidelity reserve not
 *    yet acquired is forfeited.
 *  - `deces` — the policy is settled to the beneficiaries. **The gain never
 *    meets income tax at all**; succession duties take its place, on a rule
 *    that turns on the saver's age at each payment rather than on the age of
 *    the policy. A fidelity reserve is handed over rather than forfeited,
 *    though without the uplift only the term earns.
 *
 * Modelled as a dimension of the plan and not as a second simulator, because
 * every figure before the last day is identical: the same fees, on the same
 * pockets, for the same years. Splitting it in two would have duplicated the
 * engine to change its final paragraph.
 */
export type Denouement = 'rachat' | 'deces';

/**
 * One withdrawal taken along the way, before the policy is finally settled.
 *
 * **One, and not a schedule.** A plan of recurring withdrawals doubles the
 * state the engine has to carry — three counters that must all decrease in step
 * — and buys very little the single event does not already show. The question
 * people actually have is *what if we need thirty thousand in year five*, and
 * that is this shape.
 *
 * It is `null` by default and, when null, the engine takes no branch at all:
 * an invariant checks that a withdrawal of zero reproduces the plain projection
 * to the last centime, which is what makes the rest of this safe to add.
 */
export type RachatIntermediaire = {
  /** Year it is taken, at the close of that year. Never the horizon itself. */
  annee: number;
  /** Amount asked for. Served up to what the policy can actually release. */
  montant: number;
};

export type Hypotheses = {
  /** V₀ — initial payment, in euros. Weighed against each contract's ticket. */
  versementInitial: number;
  /** Amount of one instalment, in euros. */
  versementProgramme: number;
  periodicite: Periodicite;
  /**
   * Yearly uprating of the instalments, as a fraction. Nominal, and chosen by
   * the user: it tracks inflation only if they set it to.
   */
  revalorisationVersements: number;
  /**
   * i — expected inflation, used to restate the final capital in today's euros.
   *
   * **It drives nothing.** The whole projection is nominal, and this only ever
   * divides the answer at the very end. That is not a shortcut: inflation hits
   * all six contracts identically, so it can move no ranking — it changes what
   * the figure *means*, never which contract wins. A test pins that.
   */
  inflation: number;
  /** N — horizon, in years. */
  horizon: number;
  /** Target share of unit-linked funds, as a fraction of the policy. */
  partUC: number;
  /** Asset class held in the UC pocket. Each contract resolves its own support. */
  classeUC: ClasseActif;
  /**
   * Gross expected return of that asset class, before the fund's own charges
   * and before anything the insurer takes.
   *
   * Deliberately a *user hypothesis*, and deliberately identical for every
   * contract: an index tracker and an actively managed fund start from the same
   * figure here. Letting them differ would be prejudging the active-versus-
   * passive argument instead of pricing the fees, which is the one thing this
   * simulator claims to do.
   */
  rendementUC: number;
  sourceTaux: SourceTaux;
  rebalancement: Rebalancement;
  /** Decides the €4,600 / €9,200 allowance on withdrawal after eight years. */
  foyer: Foyer;
  denouement: Denouement;
  /**
   * Age of the assured on the first payment.
   *
   * Read only when the policy ends in a death, and then it decides more than
   * any fee in the catalogue: it places every payment on one side or the other
   * of the seventieth birthday, and with it an allowance of €152,500 per
   * beneficiary or one of €30,500 for everybody together.
   *
   * Carried even under `rachat`, where it changes no figure, because a field
   * that appears and disappears with another one is a field that arrives
   * undefined in a link somebody shared before the switch existed.
   */
  ageSouscription: number;
  /** How many people share the death benefit — and therefore how many allowances. */
  beneficiaires: number;
  /**
   * Marginal succession rate assumed for premiums paid after seventy.
   *
   * A hypothesis and not a computation: what those premiums actually cost
   * depends on the relationship to the deceased and on the rest of the estate,
   * neither of which is a property of an insurance contract. See `succession.ts`.
   */
  tauxDroitsSuccession: number;
  /**
   * A single withdrawal taken before the end, or `null` for a plan left alone.
   *
   * Placed at the close of its year and **before** the yearly rebalancing, so
   * that the year still ends on the allocation the user asked for and the
   * accounting identity closes on a single withdrawal rather than on a
   * withdrawal plus the drift it caused.
   *
   * That ordering makes one interaction visible rather than hiding it: on a
   * contract whose euro fund locks interest away, taking money out and then
   * putting the allocation back costs the reserve **twice** — once for what
   * leaves the euro pocket, once for what the arbitrage moves back out of it.
   * That is what the contract does, and there is already an alert saying so.
   */
  rachatIntermediaire: RachatIntermediaire | null;
};

export const BORNES = {
  versementInitial: { min: 0, max: 5_000_000 },
  versementProgramme: { min: 0, max: 100_000 },
  revalorisationVersements: { min: 0, max: 0.1 },
  // Deflation is allowed, barely: it has happened, and refusing to represent it
  // would be an opinion rather than a bound.
  inflation: { min: -0.02, max: 0.1 },
  // One year is allowed, and on purpose: the degenerate case has to be
  // representable rather than silently rounded up to something comfortable.
  horizon: { min: 1, max: 40 },
  partUC: { min: 0, max: 1 },
  rendementUC: { min: -0.05, max: 0.15 },
  // Wide enough to cover a policy opened for a child and one opened at ninety,
  // because both exist and both sit on the interesting side of the pivot.
  ageSouscription: { min: 0, max: 95 },
  beneficiaires: { min: 1, max: 10 },
  tauxDroitsSuccession: { min: 0, max: 0.6 },
  rachatIntermediaire: { min: 0, max: 5_000_000 },
} as const;

export const DEFAUTS: Hypotheses = {
  // Composed from the catalogue, not written down: this is the smallest amount
  // at which all six contracts can actually be compared, so the table opens
  // without any of them already dropped for want of a ticket.
  versementInitial: TICKET_MAXIMAL,
  versementProgramme: 200,
  periodicite: 'mensuelle',
  revalorisationVersements: 0,
  // The ECB's stated objective, which is the only defensible default here: any
  // other figure would be this simulator forecasting, which it does not do.
  inflation: 0.02,
  // Twenty years, because half a point of fees needs time to become visible and
  // making it visible is the whole exercise. The eight-year mark, where the tax
  // regime turns, is one click away.
  horizon: 20,
  partUC: 0.6,
  classeUC: 'actions-monde',
  rendementUC: RENDEMENT_BRUT['actions-monde'],
  sourceTaux: 'derniere-annee',
  rebalancement: 'annuel',
  foyer: 'seul',
  // The page opens on the question it was built to answer — what does this
  // contract cost to hold — and a death benefit is a different question. It is
  // one click away, not the greeting.
  denouement: 'rachat',
  // Old enough for the seventieth birthday to be inside a twenty-year horizon,
  // so that switching to a death does not silently hide the rule that matters.
  ageSouscription: 60,
  beneficiaires: 1,
  tauxDroitsSuccession: TAUX_DROITS_DEFAUT,
  rachatIntermediaire: null,
};

export const ECHEANCES: Record<Periodicite, number> = {
  aucune: 0,
  mensuelle: 12,
  trimestrielle: 4,
  annuelle: 1,
};

export const LIBELLES_PERIODICITE: Record<Periodicite, string> = {
  aucune: 'Aucun',
  mensuelle: 'Par mois',
  trimestrielle: 'Par trimestre',
  annuelle: 'Par an',
};

export const LIBELLES_REBALANCEMENT: Record<Rebalancement, string> = {
  aucun: 'Jamais',
  versements: 'Par les versements',
  annuel: 'Chaque année',
};

export const LIBELLES_SOURCE_TAUX: Record<SourceTaux, string> = {
  'derniere-annee': `Taux servi en ${ANNEE_REFERENCE}`,
  'moyenne-historique': 'Moyenne des années connues',
};

export const LIBELLES_DENOUEMENT: Record<Denouement, string> = {
  rachat: 'Vous récupérez l’argent',
  deces: 'Vos bénéficiaires le reçoivent',
};

function borne(valeur: number, { min, max }: { min: number; max: number }): number {
  if (!Number.isFinite(valeur)) return min;
  return Math.min(max, Math.max(min, valeur));
}

/**
 * The gate every public function goes through, so that no formula downstream
 * has to defend itself against a NaN or a negative horizon.
 *
 * `rendementUC` is clamped but never re-derived from `classeUC`: pinning it
 * back to the class default would make any sensitivity analysis impossible and
 * would stop this function being idempotent. Re-deriving belongs to the
 * interface, at the moment the user changes class.
 */
export function borner(hypotheses: Hypotheses): Hypotheses {
  // Clamped first, because the withdrawal's year is held inside it.
  const horizon = Math.round(borne(hypotheses.horizon, BORNES.horizon));
  return {
    versementInitial: borne(hypotheses.versementInitial, BORNES.versementInitial),
    versementProgramme: borne(hypotheses.versementProgramme, BORNES.versementProgramme),
    periodicite: hypotheses.periodicite in ECHEANCES ? hypotheses.periodicite : 'mensuelle',
    revalorisationVersements: borne(
      hypotheses.revalorisationVersements,
      BORNES.revalorisationVersements,
    ),
    inflation: borne(hypotheses.inflation, BORNES.inflation),
    horizon,
    partUC: borne(hypotheses.partUC, BORNES.partUC),
    classeUC: estClasseActif(hypotheses.classeUC) ? hypotheses.classeUC : 'actions-monde',
    rendementUC: borne(hypotheses.rendementUC, BORNES.rendementUC),
    sourceTaux:
      hypotheses.sourceTaux === 'moyenne-historique' ? 'moyenne-historique' : 'derniere-annee',
    rebalancement:
      hypotheses.rebalancement === 'aucun' || hypotheses.rebalancement === 'versements'
        ? hypotheses.rebalancement
        : 'annuel',
    foyer: estFoyer(hypotheses.foyer) ? hypotheses.foyer : 'seul',
    denouement: hypotheses.denouement === 'deces' ? 'deces' : 'rachat',
    ageSouscription: Math.round(borne(hypotheses.ageSouscription, BORNES.ageSouscription)),
    beneficiaires: Math.round(borne(hypotheses.beneficiaires, BORNES.beneficiaires)),
    tauxDroitsSuccession: borne(
      hypotheses.tauxDroitsSuccession,
      BORNES.tauxDroitsSuccession,
    ),
    rachatIntermediaire: bornerRachat(hypotheses.rachatIntermediaire, horizon),
  };
}

/**
 * A mid-course withdrawal, held strictly inside the horizon.
 *
 * The last year is excluded on purpose, and it removes an edge case rather than
 * a feature: a withdrawal on the closing day is arithmetically the same event
 * as settling for less, but it would claim a second yearly allowance in the
 * same tax year — which is precisely the trick the allowance rule exists to
 * prevent. A one-year plan therefore has nowhere to put one, and gets `null`.
 */
function bornerRachat(
  rachat: RachatIntermediaire | null | undefined,
  horizon: number,
): RachatIntermediaire | null {
  if (!rachat || horizon < 2) return null;
  const montant = borne(rachat.montant, BORNES.rachatIntermediaire);
  if (montant <= 0) return null;
  return { annee: Math.round(borne(rachat.annee, { min: 1, max: horizon - 1 })), montant };
}

/**
 * Whether the payments of a given year were made before the seventieth
 * birthday.
 *
 * One age for the whole year, and the pivot therefore falls on a year boundary
 * rather than on an anniversary. That is a real approximation and it is stated
 * as a reservation, but the alternative is worse: crediting instalments month
 * by month to place them either side of a birthday would put a precision on the
 * *date* of a payment that no other part of this engine claims — the whole
 * projection credits a year's payments at its midpoint.
 */
export function avantSoixanteDix(h: Hypotheses, annee: number): boolean {
  return h.ageSouscription + annee - 1 < AGE_PIVOT;
}

// ---------------------------------------------------------------------------
// The euro-fund rate
// ---------------------------------------------------------------------------

/**
 * The tier a given UC share reaches.
 *
 * Tiers are absolute rates, never "base plus bonus", so reading one is a lookup
 * and not an addition — which is also why a promotional scale can be ignored by
 * simply falling back to `paliers[0]`.
 */
export function palierAtteint(bareme: Bareme, partUC: number): { taux: number; rang: number } {
  if (bareme.nature === 'promotionnel') return { taux: bareme.paliers[0].taux, rang: 0 };
  let retenu = { taux: bareme.paliers[0].taux, rang: 0 };
  bareme.paliers.forEach((p, rang) => {
    if (partUC >= p.partUCMinimale - 1e-9) retenu = { taux: p.taux, rang };
  });
  return retenu;
}

export function moyenneHistorique(f: FondsEuros): number {
  if (f.historique.length === 0) return 0;
  return f.historique.reduce((s, h) => s + h.taux, 0) / f.historique.length;
}

/**
 * The rate the euro pocket earns this year.
 *
 * The uplift cap (BoursoVie's €500,000) applies to *payments*, not to the
 * balance, so it is a blended rate rather than a cliff: the eligible share gets
 * the tier, the rest gets the base.
 *
 * Under `moyenne-historique` the tier structure is kept and shifted, so that a
 * contract does not lose its scale simply because a longer view of its rates is
 * being taken.
 */
export function tauxEuros(
  f: FondsEuros,
  partUC: number,
  primesCumulees: number,
  source: SourceTaux,
): { taux: number; rang: number } {
  const base = tauxDeBase(f);
  const { taux: tauxPalier, rang } = f.bareme
    ? palierAtteint(f.bareme, partUC)
    : { taux: base, rang: -1 };

  let taux = tauxPalier;
  const plafond = f.bareme?.plafondVersements ?? null;
  if (plafond !== null && primesCumulees > plafond && primesCumulees > 0) {
    const eligible = plafond / primesCumulees;
    taux = tauxPalier * eligible + base * (1 - eligible);
  }

  if (source === 'moyenne-historique') taux += moyenneHistorique(f) - base;
  return { taux, rang };
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

export type Motif = 'ticket-insuffisant' | 'classe-indisponible' | 'fonds-euros-inaccessible';

export const LIBELLES_MOTIF: Record<Motif, string> = {
  'ticket-insuffisant': 'Versement initial inférieur au ticket d’entrée',
  'classe-indisponible': 'Ce contrat ne propose pas cette classe d’actifs',
  'fonds-euros-inaccessible': 'Aucun fonds en euros accessible à cette part d’unités de compte',
};

export type Alerte = Reserve;

export type AnneeContrat = {
  annee: number;
  versementsBruts: number;
  fraisVersement: number;
  valeurDebut: number;
  pocheEurosDebut: number;
  pocheUCDebut: number;
  pocheEurosFin: number;
  pocheUCFin: number;
  provisionFin: number;
  /** UC share once the year's payments are in, before any return: the tier criterion. */
  partUCReference: number;
  tauxEurosApplique: number;
  /** Index of the tier reached, −1 when the fund has no scale. */
  rangPalier: number;
  gainsBruts: number;
  fraisGestionContrat: number;
  fraisSupport: number;
  fraisEncours: number;
  prelevementsSociaux: number;
  fraisArbitrage: number;
  /**
   * Fidelity provision forfeited this year — by arbitraging out of the euro
   * pocket, by withdrawing from it, or by both in the same year.
   */
  perteProvision: number;
  /** Gross amount actually released by the mid-course withdrawal. Zero elsewhere. */
  rachatBrut: number;
  /** Tax withheld on that withdrawal. Paid by the saver, not by the policy. */
  impotRachat: number;
  valeurFin: number;
  /**
   * What could actually be taken out at the close of this year, which is not
   * `valeurFin` whenever a reserve is in play.
   *
   * The gap between the two is the single most misread number on a statement
   * carrying a fidelity guarantee: the reserve is shown, it grows, and it is
   * *not rachetable*. A saver reading `valeurFin` as their money is reading the
   * insurer's liability, not their own liquidity — so the engine reports both
   * and never makes anyone subtract.
   */
  valeurRachat: number;
  primesCumulees: number;
};

export type CoutsPreleves = {
  versement: number;
  adhesion: number;
  gestionContrat: number;
  support: number;
  encours: number;
  arbitrage: number;
  provisionPerdue: number;
  fiscalite: number;
  succession: number;
};

// ---------------------------------------------------------------------------
// What the deductions are, described once
// ---------------------------------------------------------------------------

export type Poste = keyof CoutsPreleves;

/**
 * How a deduction behaves over time, and therefore whether it composes a yearly
 * rate at all.
 *
 * A union rather than a `recurrent: boolean`, because a boolean names one side
 * and leaves the other to be inferred: at a declaration site `cadence:
 * 'ponctuel'` reads as a decision, `recurrent: false` reads as an absence.
 */
export type CadencePoste = 'recurrent' | 'ponctuel';

/**
 * Who took the money, and what would have avoided it.
 *
 * Three kinds and not two, and the third was found by a test rather than by
 * design — which is the useful part:
 *
 *  - `frais` — charged by the insurer, and **exactly what `sansFrais` removes**.
 *    That is the operative definition: the fee-free yardstick these are measured
 *    against is a contract with all of them at zero.
 *  - `penalite` — lost to the contract's own rules rather than to a price list.
 *    The fidelity reserve forfeited before its term is real money the saver
 *    never sees, but a fee-free version of the same contract forfeits it too, so
 *    it cancels out of what the fees cost and must not be counted among them.
 *  - `impot` — taken by the state. Not what the contract costs.
 *
 * Each answers to a different counterfactual, which is why one total could not
 * have covered all three.
 */
export type NaturePoste = 'frais' | 'penalite' | 'impot';

/**
 * What a reader is shown as one line.
 *
 * Entry fees and association dues are one group and not two: nobody who paid
 * €20 to join and 0,5 % on the way in experiences those as separate events, and
 * that decision belongs beside the model rather than inside a component.
 */
export type GroupePoste =
  | 'entree'
  | 'gestion'
  | 'support'
  | 'encours'
  | 'arbitrage'
  | 'fidelite'
  | 'fiscalite'
  | 'succession';

export const LIBELLES_GROUPE: Record<GroupePoste, string> = {
  entree: 'Frais sur versement et adhésion',
  gestion: 'Frais de gestion du contrat',
  support: 'Frais courants des supports',
  encours: 'Frais sur encours',
  arbitrage: 'Arbitrages',
  fidelite: 'Réserve de fidélité perdue',
  fiscalite: 'Impôt et prélèvements sociaux',
  succession: 'Droits de succession',
};

/**
 * Every line of `CoutsPreleves`, described once and in display order.
 *
 * `as const satisfies` buys both halves of what this has to do. `satisfies`
 * makes the record exhaustive over `keyof CoutsPreleves`, so adding a field to
 * the type without describing it here **fails to compile** — which is the whole
 * point, because this table once listed seven of eight items and summed the
 * list rather than the object, leaving a deduction no total counted. And
 * `as const` keeps the literal types, so the recurring subset below is
 * *derived* rather than restated.
 *
 * Declaration order is display order. There is deliberately no separate
 * ordering array: a second list is a second thing that can be wrong, and this
 * literal is already ordered and already exhaustive.
 */
export const POSTES = {
  versement: { groupe: 'entree', cadence: 'ponctuel', nature: 'frais' },
  adhesion: { groupe: 'entree', cadence: 'ponctuel', nature: 'frais' },
  gestionContrat: { groupe: 'gestion', cadence: 'recurrent', nature: 'frais' },
  support: { groupe: 'support', cadence: 'recurrent', nature: 'frais' },
  encours: { groupe: 'encours', cadence: 'recurrent', nature: 'frais' },
  arbitrage: { groupe: 'arbitrage', cadence: 'ponctuel', nature: 'frais' },
  // Not a fee: the same contract with every fee at zero forfeits this reserve
  // just the same, so it cancels out of what the fees cost. Money lost all the
  // same, which is why it has a nature of its own instead of being dropped.
  provisionPerdue: { groupe: 'fidelite', cadence: 'ponctuel', nature: 'penalite' },
  // Settled at the exit, and not a fee: what the state takes is not what the
  // contract costs. `cadence` answers one question only — does this compose the
  // yearly rate — and for tax the answer is no.
  fiscalite: { groupe: 'fiscalite', cadence: 'ponctuel', nature: 'impot' },
  // A second tax line and not an addition to the first, because the two are
  // mutually exclusive and answer to different rules: one is what the saver
  // owes on a gain, the other what a beneficiary owes on a capital. Summing
  // them into a single "impôt" would hide the fact that a death pays no income
  // tax at all — which is the most useful thing the death branch has to say.
  succession: { groupe: 'succession', cadence: 'ponctuel', nature: 'impot' },
} as const satisfies Record<
  Poste,
  { groupe: GroupePoste; cadence: CadencePoste; nature: NaturePoste }
>;

/**
 * The items that compose a yearly rate, read off the catalogue.
 *
 * This is why `cadence` lives on `POSTES` rather than in an array of its own:
 * it *generates* this type, which is the key set of `TauxAnnuel`, which
 * `projeterContrat` must supply a literal for. Marking a new charge `recurrent`
 * therefore breaks the build at the one place that knows what its rate is. A
 * separate list could not do that — it would yield an `undefined` in the
 * drawing and a missing factor in the capitalisation, which is a projection
 * quietly understated in the saver's disfavour.
 */
export type PosteRecurrent = {
  [P in Poste]: (typeof POSTES)[P]['cadence'] extends 'recurrent' ? P : never;
}[Poste];

export function postes(): Poste[] {
  return Object.keys(POSTES) as Poste[];
}

export const POSTES_RECURRENTS: PosteRecurrent[] = postes().filter(
  (p): p is PosteRecurrent => POSTES[p].cadence === 'recurrent',
);

/**
 * The yearly charge borne on one pocket, item by item.
 *
 * This is the *definition* of the annual rate rather than a rendering of it:
 * the engine capitalises with these numbers and the table draws these numbers,
 * so a bar that disagreed with the figure printed beside it is not something
 * the types allow anyone to write.
 */
export type TauxAnnuel = Record<PosteRecurrent, number>;

export function sommeTaux(t: TauxAnnuel): number {
  return POSTES_RECURRENTS.reduce((s, p) => s + t[p], 0);
}

/**
 * Where a fee bar stops, as a yearly rate.
 *
 * A drawing bound and not a claim about the model: bars share one scale so that
 * a longer bar is a dearer contract, full stop. Scaling each to its own total
 * would make every row look alike; scaling to the dearest of the six would
 * rescale the picture whenever the field changes, so a bar could shrink because
 * its neighbours got worse. Two points a year covers the catalogue; the rare
 * contract that runs past it is marked as overflowing rather than accommodated.
 */
export const ECHELLE_FRAIS_ANNUELS = 0.02;

/**
 * The same sum, restated in today's euros.
 *
 * A lens on the answer and never an input to it: the projection is nominal from
 * end to end, and this divides once, at the very end. Which is why it is a free
 * function taking a number rather than something threaded through the
 * capitalisation — there is nothing for it to do in there.
 */
export function enEurosConstants(valeur: number, inflation: number, annees: number): number {
  return valeur / (1 + inflation) ** annees;
}

function total(couts: CoutsPreleves, natures: NaturePoste[]): number {
  return postes().reduce((s, p) => s + (natures.includes(POSTES[p].nature) ? couts[p] : 0), 0);
}

/**
 * What the insurer charged — and nothing else.
 *
 * The figure `coutFraisAvantImpot` is measured against, so it must cover
 * exactly what the fee-free counterfactual removes. Adding the forfeited
 * reserve here would compare a plan to a yardstick that forfeits it too.
 */
export function totalFrais(couts: CoutsPreleves): number {
  return total(couts, ['frais']);
}

/** Everything that left the saver short of the taxman: fees and penalties both. */
export function totalPreleve(couts: CoutsPreleves): number {
  return total(couts, ['frais', 'penalite']);
}

/**
 * What left the saver, folded into the lines a reader is shown, in catalogue
 * order. Tax is excluded: it is reconciled separately, and it is not what the
 * contract costs.
 *
 * A `Map` keeps insertion order, so the grouping inherits the declaration order
 * of `POSTES` and no second ordering has to be maintained anywhere.
 */
export function grouper(
  couts: CoutsPreleves,
  natures: NaturePoste[] = ['frais', 'penalite'],
): { groupe: GroupePoste; montant: number }[] {
  const parGroupe = new Map<GroupePoste, number>();
  for (const p of postes()) {
    if (!natures.includes(POSTES[p].nature)) continue;
    parGroupe.set(POSTES[p].groupe, (parGroupe.get(POSTES[p].groupe) ?? 0) + couts[p]);
  }
  return [...parGroupe].map(([groupe, montant]) => ({ groupe, montant }));
}

export type ResultatAccessible = {
  cle: CleContrat;
  accessible: true;
  fondsRetenu: CleFondsEuros;
  supportRetenu: CleSupport;
  annees: AnneeContrat[];
  valeurBrute: number;
  primesVersees: number;
  plusValue: number;
  partUCFinale: number;
  imposition: Imposition;
  /**
   * Succession duties, and `null` — not zero — when the plan ends in a
   * withdrawal.
   *
   * The distinction is the point: zero would say "no duties were owed", which
   * is a claim about a death that did not happen. `null` says the question was
   * never asked, and it is what lets a panel decide whether to print the
   * seventy-year rule at all instead of inferring it from an amount.
   */
  succession: Succession | null;
  denouement: Denouement;
  psPayes: number;
  capitalNet: number;
  /**
   * `capitalNet` restated in today's euros, under the inflation the user
   * assumed. Purely a lens: every ratio between contracts is unchanged, which
   * is exactly why it belongs beside the headline figure and nowhere in the
   * comparison table.
   */
  capitalNetReel: number;
  /**
   * Total yearly charge borne on the UC pocket: the contract's plus the fund's.
   * Derived from `tauxAnnuelUC` and never added up a second time.
   */
  fraisAnnuelsUC: number;
  /** That same charge, item by item. Its sum is `fraisAnnuelsUC`, and a test says so. */
  tauxAnnuelUC: TauxAnnuel;
  /**
   * The euro pocket's yearly charge. Near zero for almost every contract, and
   * that is the honest figure rather than a flattering one: what the euro fund
   * costs is already deducted from the rate it publishes.
   */
  tauxAnnuelEuros: TauxAnnuel;
  /**
   * The allocation that was projected, echoed back after clamping.
   *
   * Not `partUCFinale`, which is the share after returns and rebalancing have
   * moved it. Telling whether a plan holds units at all needs the target.
   */
  partUCVisee: number;
  /**
   * The fidelity reserve standing at the horizon, before the settlement decides
   * what becomes of it. Zero on every contract that has none.
   */
  provisionFin: number;
  /** What that reserve was finally worth: uplifted, handed over, or forfeited. */
  provisionAcquise: number;
  /**
   * Cash the saver already took, net of the tax withheld on it.
   *
   * Included in `capitalNet`, because a plan that handed over €30,000 in year
   * five has not lost them — and excluding it would make any plan with a
   * withdrawal look strictly worse than one without, which is a comparison of
   * nothing. Counted at face value: the engine does not know what became of it.
   */
  rachatIntermediaireNet: number;
  /**
   * What a full surrender would have released on the last day, reserve
   * excluded — the liquidity figure, as opposed to the settlement figure.
   */
  valeurRachatFin: number;
  coutsPreleves: CoutsPreleves;
  /** The same plan on a contract with every fee at zero: the yardstick. */
  capitalNetSansFrais: number;
  /**
   * What the fees finally cost you, in the money you get to keep.
   *
   * Smaller than the raw cost of the fees, and that is not an error: a euro the
   * insurer takes is a euro the taxman never taxes, so part of every charge is
   * quietly refunded through a smaller gain. This is the figure to show a
   * saver, because it is the one they actually lose.
   */
  manqueAGagner: number;
  /**
   * What the fees cost before any tax enters: the amounts deducted *plus* the
   * return they never produced. Always larger than the sum deducted, and that
   * gap is compounding doing its work in the wrong direction.
   */
  coutFraisAvantImpot: number;
  /** What honouring a promotional tier for the whole horizon would have been worth. */
  gainPromotionnel: number;
  reserves: Reserve[];
  alertes: Alerte[];
};

export type ResultatInaccessible = {
  cle: CleContrat;
  accessible: false;
  motif: Motif;
};

export type Resultat = ResultatAccessible | ResultatInaccessible;

// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------

/**
 * One year of one pocket.
 *
 * `g` is the gross growth factor and `phi` the product of everything taken out.
 * Returning the before-fee and after-fee values separately is what lets the
 * yearly identity close exactly: gains and charges are read off as differences
 * rather than recomputed, so they cannot drift apart from the balance.
 */
function capitaliser(base: number, apport: number, g: number, phi: number) {
  const f = g * phi;
  const racine = (x: number) => (x > 0 ? Math.sqrt(x) : 0);
  const avantFrais = base * g + apport * racine(g);
  const apresFrais = base * f + apport * racine(f);
  return {
    apresFrais,
    gainsBruts: avantFrais - base - apport,
    frais: avantFrais - apresFrais,
  };
}

/**
 * Split an exactly computed charge between the rates that produced it.
 *
 * Multiplicative charges have no exact additive decomposition, so this is a
 * pro rata — and it is deliberately derived from the true total rather than
 * recomputed from the rates, so that the parts always add back up to the whole.
 * A breakdown that does not reconcile is worse than no breakdown at all.
 */
function repartir(total: number, parts: { poste: keyof CoutsPreleves; taux: number }[]) {
  const somme = parts.reduce((s, p) => s + p.taux, 0);
  if (somme <= 0) return parts.map((p) => ({ poste: p.poste, montant: 0 }));
  return parts.map((p) => ({ poste: p.poste, montant: (total * p.taux) / somme }));
}

function versementDeLAnnee(h: Hypotheses, annee: number): number {
  const echeances = ECHEANCES[h.periodicite];
  const programme =
    h.versementProgramme * echeances * (1 + h.revalorisationVersements) ** (annee - 1);
  return (annee === 1 ? h.versementInitial : 0) + programme;
}

function resoudre(h: Hypotheses, c: Contrat):
  | { ok: false; motif: Motif }
  | { ok: true; support: Support; fonds: FondsEuros } {
  const total = h.versementInitial + h.versementProgramme * ECHEANCES[h.periodicite];
  if (total <= 0 || h.versementInitial < c.versementMinimal) {
    return { ok: false, motif: 'ticket-insuffisant' };
  }

  // No substituting a neighbouring asset class: printing a figure for a product
  // a contract does not sell is exactly the claim this simulator exists to
  // contradict.
  const support = meilleurSupport(c.supports, h.classeUC);
  if (h.partUC > 0 && support === null) return { ok: false, motif: 'classe-indisponible' };

  const eligibles = c.fondsEuros.filter(
    (f) => f.partUCMinimale === null || h.partUC >= f.partUCMinimale - 1e-9,
  );
  if (eligibles.length === 0) {
    if (h.partUC >= 1) {
      // Nothing will be held in euros anyway, so the fund never gets used.
      return { ok: true, support: support ?? meilleurSupportForce(c, h), fonds: c.fondsEuros[0] };
    }
    return { ok: false, motif: 'fonds-euros-inaccessible' };
  }

  // Frozen for the whole projection: switching euro fund midway is an
  // arbitrage, not a hypothesis.
  const fonds = eligibles.reduce((a, b) =>
    tauxEuros(b, h.partUC, 0, h.sourceTaux).taux > tauxEuros(a, h.partUC, 0, h.sourceTaux).taux
      ? b
      : a,
  );
  return { ok: true, support: support ?? meilleurSupportForce(c, h), fonds };
}

/** Only reached when nothing is invested in units, where the choice is moot. */
function meilleurSupportForce(c: Contrat, h: Hypotheses): Support {
  return (
    meilleurSupport(c.supports, h.classeUC) ??
    meilleurSupport(c.supports, 'actions-monde') ?? {
      cle: c.supports[0] ?? 'monetaire',
      classe: h.classeUC,
      partage: 'clean',
      libelle: '—',
      ter: 0,
      note: '',
    }
  );
}

type Options = {
  /** Off for the side projections, so the counterfactuals do not recurse. */
  variantes?: boolean;
  /**
   * Force the fund's own ongoing charge to zero.
   *
   * Internal, and used for exactly one thing: the fee-free yardstick. The TER
   * belongs to the fund rather than to the contract, so `sansFrais` cannot
   * reach it — and a yardstick that still carries a 1,05 % retail unit would
   * hide the very cost this simulator exists to expose.
   */
  terNul?: boolean;
  /**
   * The day the plan is being read, ISO, used only to decide whether a
   * promotional campaign has closed.
   *
   * An argument and not a call to the clock: `lib/` has to stay pure, a shared
   * link has to project the same figures tomorrow as today, and a test has to
   * be able to stand on either side of an expiry date. It defaults to the day
   * the catalogue was surveyed, which is the honest fallback — a caller who
   * does not say what day it is gets the answer as of the last time anybody
   * checked the data.
   */
  aLaDate?: string;
};

/**
 * Takes the contract record rather than its key, and that is not incidental:
 * it is what makes `sansFrais`, `avecPromotion`, `sansPromotion` and `avecSupport` usable
 * without seeding the catalogue with phantom entries.
 */
export function projeterContrat(
  hypotheses: Hypotheses,
  c: Contrat,
  options: Options = {},
): Resultat {
  const h = borner(hypotheses);
  const resolution = resoudre(h, c);
  if (!resolution.ok) return { cle: c.cle, accessible: false, motif: resolution.motif };

  const { fonds } = resolution;
  const support = options.terNul ? { ...resolution.support, ter: 0 } : resolution.support;
  const provisionDe = fonds.provisionFidelite;
  const fgEurosApplique = fonds.conventionTaux === 'brut' ? c.fraisGestion.euros : 0;
  const fraisETF = support.partage === 'etf' ? c.fraisOperationETF : 0;

  // Both pockets, priced once. These rates do not vary by year, and they are
  // the single definition of the annual charge: capitalisation, the pro-rata
  // split of what was deducted, and the table all read from here.
  const tauxAnnuelUC: TauxAnnuel = {
    gestionContrat: c.fraisGestion.uc,
    support: support.ter,
    encours: c.fraisSurEncours,
  };
  const tauxAnnuelEuros: TauxAnnuel = {
    gestionContrat: fgEurosApplique,
    // The euro fund holds no unit whose ongoing charge could be levied, and
    // under `net-de-frais-de-gestion` the wrapper's own charge already sits
    // inside the published rate. This zero is a statement, not a gap.
    support: 0,
    encours: c.fraisSurEncours,
  };
  const parts = (t: TauxAnnuel) => POSTES_RECURRENTS.map((poste) => ({ poste, taux: t[poste] }));
  const partsEuros = parts(tauxAnnuelEuros);
  const partsUC = parts(tauxAnnuelUC);

  let pocheE = 0;
  let pocheU = 0;
  let provision = 0;
  let psPayes = 0;
  // The interest those levies were charged on, and not the levies themselves.
  // The settlement needs the base rather than the tax: netting a rate against
  // an amount is exactly the mistake `assiettePSALaSortie` exists to prevent.
  let assiettePSPayee = 0;
  // Cash already in the saver's hands, net of the tax withheld on it. Counted
  // at face value at the end: what they did with it afterwards is not something
  // this simulator can know, and inventing a reinvestment would be a forecast.
  let rachatNetPercu = 0;
  // Two premium counters, and they part company the moment money comes out.
  //
  //  - `primesVersees` is what the saver actually handed over. It only ever
  //    grows, and it is the figure shown next to "vous avez versé".
  //  - `primes` is the tax base the policy still carries. A withdrawal takes
  //    its share of the capital with it, so this one *falls*.
  //
  // They were one variable until a withdrawal could happen, and merging them
  // again would either understate what was paid in or tax a capital twice.
  let primesVersees = 0;
  let primes = 0;
  // Tracked in the loop rather than derived afterwards: the split depends on
  // the year each payment fell in, and once the loop has run that information
  // is gone — `primesVersees` is a single number by then.
  let primesAvant70 = 0;

  const couts: CoutsPreleves = {
    versement: 0,
    adhesion: c.droitsAdhesion,
    gestionContrat: 0,
    support: 0,
    encours: 0,
    arbitrage: 0,
    provisionPerdue: 0,
    fiscalite: 0,
    succession: 0,
  };

  const annees: AnneeContrat[] = [];

  for (let annee = 1; annee <= h.horizon; annee++) {
    const valeurDebut = pocheE + pocheU + provision;
    const pocheEurosDebut = pocheE;
    const pocheUCDebut = pocheU;

    // ① Payments. Association dues are taken out of the first payment and never
    //    invested; they are not a premium, so they stay out of the tax base too.
    const brut = versementDeLAnnee(h, annee);
    primesVersees += brut;
    primes += brut;
    if (avantSoixanteDix(h, annee)) primesAvant70 += brut;
    const investissable = Math.max(0, brut - (annee === 1 ? c.droitsAdhesion : 0));

    // ② Split, then entry fees — strictly before any return.
    let versUC: number;
    if (h.rebalancement === 'versements') {
      const cible = h.partUC * (valeurDebut + investissable);
      versUC = Math.min(investissable, Math.max(0, cible - pocheU));
    } else {
      versUC = investissable * h.partUC;
    }
    const versEuros = investissable - versUC;

    const fraisVers =
      versEuros * c.fraisVersement.euros +
      versUC * (c.fraisVersement.uc + fraisETF);
    const netEuros = versEuros * (1 - c.fraisVersement.euros);
    const netUC = versUC * (1 - c.fraisVersement.uc - fraisETF);
    couts.versement += fraisVers;

    pocheE += netEuros;
    pocheU += netUC;

    // The tier criterion: the UC share once the year's money is in, before any
    // return. The contractual wording is an average over the year, but that is
    // circular — the closing share depends on the rate, which depends on the
    // share. This one is acyclic, exact under yearly rebalancing, and errs on
    // the prudent side.
    const assiettePart = pocheE + pocheU + provision;
    const partUCReference = assiettePart > 0 ? pocheU / assiettePart : h.partUC;
    const { taux, rang } = tauxEuros(fonds, partUCReference, primesVersees, h.sourceTaux);

    // ③ ④ Yearly factors, and capitalisation.
    const phi = (parts: { taux: number }[]) =>
      parts.reduce((p, x) => p * (1 - x.taux), 1);

    const euros = capitaliser(pocheE - netEuros, netEuros, 1 + taux, phi(partsEuros));
    const uc = capitaliser(pocheU - netUC, netUC, 1 + h.rendementUC, phi(partsUC));

    pocheE = euros.apresFrais;
    pocheU = uc.apresFrais;

    let fraisGestionContrat = 0;
    let fraisSupport = 0;
    let fraisEncours = 0;
    for (const { poste, montant } of [
      ...repartir(euros.frais, partsEuros),
      ...repartir(uc.frais, partsUC),
    ]) {
      couts[poste] += montant;
      if (poste === 'gestionContrat') fraisGestionContrat += montant;
      if (poste === 'support') fraisSupport += montant;
      if (poste === 'encours') fraisEncours += montant;
    }

    // ⑤ Fidelity provision. It leaves the pocket, or it would be rebalanced and
    //    taxed as if it were already yours.
    const interetsNets = euros.gainsBruts - euros.frais;
    let acquis = interetsNets;
    if (provisionDe && interetsNets > 0) {
      const mis = interetsNets * provisionDe.partProvisionnee;
      provision += mis;
      pocheE -= mis;
      acquis = interetsNets - mis;
    }

    // ⑥ Social levies, on the acquired share only — what sits in the provision
    //    is not yours yet, so it is not levied yet. That rule falls out of
    //    `partProvisionnee` without a field of its own.
    const assiettePS = Math.max(0, acquis);
    const ps = PRELEVEMENTS_SOCIAUX * assiettePS;
    pocheE -= ps;
    psPayes += ps;
    assiettePSPayee += assiettePS;

    // ⑦ The one withdrawal, if this is its year.
    //
    //    Everything it touches scales by the same fraction, and that is the
    //    whole correctness argument: the slice taken carries its share of the
    //    gain, of the premiums, of the levies already paid and of the base they
    //    were charged on. Letting any one of those drift out of step is how a
    //    settlement quietly stops matching the tax it already collected — the
    //    exact failure this engine has already had once.
    let rachatBrut = 0;
    let impotRachat = 0;
    let perteProvisionRachat = 0;
    if (h.rachatIntermediaire && h.rachatIntermediaire.annee === annee) {
      // The reserve is not redeemable, so it is neither on the table nor in the
      // denominator: every tax rule below reads the *surrender* value, which is
      // what the insurer reports and what the administration proportions on.
      const disponible = pocheE + pocheU;
      rachatBrut = Math.min(h.rachatIntermediaire.montant, disponible);

      if (rachatBrut > 0) {
        const imposition = imposer({
          rachat: rachatBrut,
          valeur: disponible,
          primes,
          anciennete: annee,
          foyer: h.foyer,
          psDejaPayes: psPayes,
          assiettePSPayee,
        });
        impotRachat = imposition.total;
        couts.fiscalite += impotRachat;
        rachatNetPercu += rachatBrut - impotRachat;

        // Served in the order the contract serves it: where the default spares
        // the locked fund, the unit-linked pocket takes the blow first.
        const surUnites =
          provisionDe?.imputationRachat === 'unites-d-abord'
            ? Math.min(rachatBrut, pocheU)
            : Math.min(rachatBrut, Math.max(0, rachatBrut - pocheE));
        const surEuros = rachatBrut - surUnites;

        if (provisionDe && provision > 0 && pocheE > 0) {
          perteProvisionRachat = provision * Math.min(1, surEuros / pocheE);
          provision -= perteProvisionRachat;
          couts.provisionPerdue += perteProvisionRachat;
        }

        pocheU -= surUnites;
        pocheE -= surEuros;

        // The counters follow the slice, on the same denominator the tax used.
        const part = disponible > 0 ? rachatBrut / disponible : 0;
        const reste = 1 - part;
        primes *= reste;
        primesAvant70 *= reste;
        psPayes *= reste;
        assiettePSPayee *= reste;
      }
    }

    // ⑧ Rebalancing, last, so the year closes on the target and the drift
    //    measured during it is real rather than an artefact of ordering.
    let fraisArbitrage = 0;
    let perteProvision = perteProvisionRachat;
    if (h.rebalancement === 'annuel') {
      const total = pocheE + pocheU + provision;
      const cibleUC = h.partUC * total;
      const delta = cibleUC - pocheU;
      if (Math.abs(delta) > 1e-9 && total > 0) {
        // One rebalancing a year, so the allowance resets with the year. A
        // counter carried across the whole horizon would turn a contract's
        // "one free arbitrage per year" into one free arbitrage ever, and
        // charge Macif for nineteen operations it gives away.
        const gratuit = c.arbitrage.gratuitsParAn >= 1;
        fraisArbitrage = gratuit ? 0 : Math.abs(delta) * c.arbitrage.taux;
        fraisArbitrage += Math.abs(delta) * fraisETF;

        let perteRebalancement = 0;
        if (delta > 0 && provision > 0 && pocheE > 0) {
          // Money leaving the euro pocket takes its share of the fidelity
          // provision with it — the hidden cost of rebalancing a contract
          // whose euro fund locks its interest away. Added to what a withdrawal
          // may already have cost this year, never substituted for it.
          perteRebalancement = provision * Math.min(1, delta / pocheE);
          provision -= perteRebalancement;
          perteProvision += perteRebalancement;
        }

        pocheU += delta;
        pocheE -= delta;
        const retenue = Math.min(fraisArbitrage, Math.max(0, pocheU));
        pocheU -= retenue;
        fraisArbitrage = retenue;
        couts.arbitrage += fraisArbitrage;
        couts.provisionPerdue += perteRebalancement;
      }
    }

    annees.push({
      annee,
      versementsBruts: brut,
      fraisVersement: fraisVers + (annee === 1 ? c.droitsAdhesion : 0),
      valeurDebut,
      pocheEurosDebut,
      pocheUCDebut,
      pocheEurosFin: pocheE,
      pocheUCFin: pocheU,
      provisionFin: provision,
      partUCReference,
      tauxEurosApplique: taux,
      rangPalier: rang,
      gainsBruts: euros.gainsBruts + uc.gainsBruts,
      fraisGestionContrat,
      fraisSupport,
      fraisEncours,
      prelevementsSociaux: ps,
      fraisArbitrage,
      perteProvision,
      rachatBrut,
      impotRachat,
      valeurFin: pocheE + pocheU + provision,
      valeurRachat: pocheE + pocheU,
      primesCumulees: primesVersees,
    });
  }

  // Settlement. Three events and not two: reaching the term, dying before it,
  // and walking away before it are governed by three different clauses, and
  // collapsing the last two is what makes a fidelity reserve look like a wager
  // on the saver's health.
  let provisionAcquise = provision;
  if (provisionDe) {
    if (h.horizon >= provisionDe.termeAnnees) {
      provisionAcquise = provision * (1 + provisionDe.bonusAuTerme);
    } else if (h.denouement === 'deces') {
      // Handed to the beneficiaries, but without the uplift: that is owed to
      // whoever reaches the term, and a death does not reach it. The shortfall
      // is not a `provisionPerdue` either — nothing was taken, an upside was
      // simply never earned, and calling it a penalty would double-count it
      // against a fee-free yardstick that does not earn it either.
      provisionAcquise = provisionDe.auDeces === 'acquise-sans-bonus' ? provision : 0;
      if (provisionDe.auDeces === 'perdue') couts.provisionPerdue += provision;
    } else if (provisionDe.perteAvantTerme === 'totale') {
      couts.provisionPerdue += provision;
      provisionAcquise = 0;
    } else {
      const acquiseRatio = h.horizon / provisionDe.termeAnnees;
      couts.provisionPerdue += provision * (1 - acquiseRatio);
      provisionAcquise = provision * acquiseRatio;
    }
  }

  const valeurBrute = pocheE + pocheU + provisionAcquise;
  const plusValue = valeurBrute - primes;

  // A death is not an income event: the gain never meets income tax, and what
  // replaces it is a duty on the capital that turns on the age at each payment
  // rather than on the age of the policy.
  const imposition =
    h.denouement === 'deces'
      ? imposerDeces({
          valeur: valeurBrute,
          primes,
          psDejaPayes: psPayes,
          assiettePSPayee,
        })
      : imposer({
          rachat: valeurBrute,
          valeur: valeurBrute,
          primes,
          anciennete: h.horizon,
          foyer: h.foyer,
          psDejaPayes: psPayes,
          assiettePSPayee,
        });
  // `+=` and not `=`: a mid-course withdrawal has already paid tax into this
  // line, and an assignment here would erase it.
  couts.fiscalite += imposition.total + psPayes;

  // Duties bite on what is left once the social levies are settled, which is
  // the order the two are actually taken in.
  const succession =
    h.denouement === 'deces'
      ? imposerSuccession({
          capital: valeurBrute - imposition.total,
          primesAvant70,
          primesApres70: primes - primesAvant70,
          beneficiaires: h.beneficiaires,
          tauxDroits: h.tauxDroitsSuccession,
        })
      : null;
  couts.succession = succession?.total ?? 0;

  // What the saver — or the beneficiaries — end up with in total: the
  // settlement, plus whatever was already taken out and kept along the way.
  const capitalNet = valeurBrute - imposition.total - couts.succession + rachatNetPercu;
  const valeurFinale = pocheE + pocheU + provisionAcquise;

  const base: Omit<
    ResultatAccessible,
    | 'capitalNetSansFrais'
    | 'manqueAGagner'
    | 'coutFraisAvantImpot'
    | 'gainPromotionnel'
    | 'alertes'
  > = {
    cle: c.cle,
    accessible: true,
    fondsRetenu: fonds.cle,
    supportRetenu: support.cle,
    annees,
    valeurBrute,
    primesVersees,
    plusValue,
    partUCFinale: valeurFinale > 0 ? pocheU / valeurFinale : 0,
    imposition,
    succession,
    denouement: h.denouement,
    psPayes,
    capitalNet,
    capitalNetReel: enEurosConstants(capitalNet, h.inflation, h.horizon),
    fraisAnnuelsUC: sommeTaux(tauxAnnuelUC),
    tauxAnnuelUC,
    tauxAnnuelEuros,
    partUCVisee: h.partUC,
    provisionFin: provision,
    provisionAcquise,
    rachatIntermediaireNet: rachatNetPercu,
    valeurRachatFin: pocheE + pocheU,
    coutsPreleves: couts,
    reserves: c.reserves,
  };

  if (options.variantes === false) {
    return {
      ...base,
      capitalNetSansFrais: capitalNet,
      manqueAGagner: 0,
      coutFraisAvantImpot: 0,
      gainPromotionnel: 0,
      alertes: [],
    };
  }

  const etalon = projeterContrat(h, sansFrais(c), { variantes: false, terNul: true });
  const capitalNetSansFrais = etalon.accessible ? etalon.capitalNet : capitalNet;
  // Adding the yearly levies back on both sides is what isolates the fees from
  // the tax: those levies are charged inside the projection, so a "gross"
  // comparison that left them in would net out part of the fee cost and report
  // charges as cheaper than they were.
  const avantImpot = valeurBrute + psPayes;
  const avantImpotSansFrais = etalon.accessible ? etalon.valeurBrute + etalon.psPayes : avantImpot;

  // A campaign that has closed is worth nothing to ask about: quoting what it
  // "would be worth" for an offer nobody can subscribe to any more would be
  // advertising a dead product.
  const aLaDate = options.aLaDate ?? DATE_RELEVE;
  const expiree = promotionExpiree(fonds.bareme, aLaDate);
  const promo =
    !expiree && c.fondsEuros.some((f) => f.bareme?.nature === 'promotionnel')
      ? projeterContrat(h, avecPromotion(c), { variantes: false })
      : null;
  const gainPromotionnel =
    promo && promo.accessible ? Math.max(0, promo.capitalNet - capitalNet) : 0;

  return {
    ...base,
    capitalNetSansFrais,
    manqueAGagner: capitalNetSansFrais - capitalNet,
    coutFraisAvantImpot: avantImpotSansFrais - avantImpot,
    gainPromotionnel,
    alertes: alerter(h, c, { fonds, support, gainPromotionnel, primes: primesVersees, expiree }),
  };
}

export type RachatPartiel = {
  /** What was asked for. */
  montant: number;
  /** What the policy could actually release that year — reserve excluded. */
  disponible: number;
  /** False when the ask exceeds what is redeemable at all. */
  possible: boolean;
  /** How much of the ask had to come out of the euro pocket. */
  prisSurEuros: number;
  /** How much the unit-linked pocket absorbed first, and therefore shielded. */
  prisSurUnites: number;
  reserveAvant: number;
  reservePerdue: number;
  reserveConservee: number;
  /** The forfeited reserve valued as the term would have paid it, uplift included. */
  manqueAuTerme: number;
  /** What emptying the fund instead would have cost, for scale. */
  solderCouterait: number;
};

/**
 * What taking money out one year early actually costs.
 *
 * This exists because the headline projection cannot answer it. A projection
 * ends once: it surrenders everything on the last day, and every figure it
 * reports is about that day. The question a saver in front of a locked fund
 * actually has — *what if we need thirty thousand in year five?* — is about a
 * day in the middle, and answering it by re-running the whole plan on a shorter
 * horizon would answer a different question: that one gives up the policy for
 * good.
 *
 * Two rules do the work, and both are contractual rather than arithmetic:
 *
 *  - **The withdrawal is served in the order the contract serves it.** Where
 *    the default spares the locked fund, a unit-linked pocket held alongside
 *    absorbs the blow first and the reserve never notices — which is exactly
 *    why holding one is advice rather than decoration.
 *  - **What reaches the euro pocket cuts the reserve pro rata of the pocket, not
 *    of the policy.** The reserve is not part of the redeemable value, so
 *    dividing by the displayed value would understate the damage on every
 *    contract where the reserve has had time to grow.
 *
 * `solderCouterait` sits beside the answer on purpose: the gap between taking
 * what is needed and closing the fund is the whole practical lesson, and a
 * figure with nothing to be compared to teaches none of it.
 */
export function coutRachatPartiel(
  r: ResultatAccessible,
  annee: number,
  montant: number,
): RachatPartiel {
  const fonds = contratDe(r.cle).fondsEuros.find((f) => f.cle === r.fondsRetenu);
  const a = r.annees.find((x) => x.annee === annee) ?? r.annees.at(-1);
  const provisionDe = fonds?.provisionFidelite ?? null;

  const pocheEuros = Math.max(0, (a?.pocheEurosFin ?? 0));
  const pocheUC = Math.max(0, (a?.pocheUCFin ?? 0));
  const disponible = pocheEuros + pocheUC;
  const demande = Math.max(0, montant);
  const servi = Math.min(demande, disponible);

  const prisSurUnites =
    provisionDe?.imputationRachat === 'unites-d-abord' ? Math.min(servi, pocheUC) : 0;
  const prisSurEuros = Math.min(servi - prisSurUnites, pocheEuros);

  const reserveAvant = a?.provisionFin ?? 0;
  // Reaching the term is what the reserve is for, so a loss before it is
  // measured against what the term would have paid — never against the bare
  // provision, which is a number nobody was ever going to receive as such.
  const bonus = 1 + (provisionDe?.bonusAuTerme ?? 0);
  const perdue =
    provisionDe && pocheEuros > 0 ? reserveAvant * Math.min(1, prisSurEuros / pocheEuros) : 0;

  return {
    montant: demande,
    disponible,
    possible: demande <= disponible + 1e-9,
    prisSurEuros,
    prisSurUnites,
    reserveAvant,
    reservePerdue: perdue,
    reserveConservee: reserveAvant - perdue,
    manqueAuTerme: perdue * bonus,
    solderCouterait: reserveAvant * bonus,
  };
}

/**
 * Warnings that depend on the plan rather than on the contract.
 *
 * None of these sentences belongs in the catalogue: whether an eight-year lock
 * matters, or whether a reference rate is flattering, is only decidable once
 * the horizon and the allocation are known.
 */
function alerter(
  h: Hypotheses,
  c: Contrat,
  ctx: {
    fonds: FondsEuros;
    support: Support;
    gainPromotionnel: number;
    primes: number;
    expiree: boolean;
  },
): Alerte[] {
  const alertes: Alerte[] = [];
  const { fonds, support, gainPromotionnel, primes, expiree } = ctx;

  const provisionDe = fonds.provisionFidelite;
  if (provisionDe && h.horizon < provisionDe.termeAnnees) {
    alertes.push(
      h.denouement === 'deces'
        ? {
            genre: 'liquidite',
            texte:
              `Le décès survient avant le terme de ${provisionDe.termeAnnees} ans du fonds ${fonds.libelle}. ` +
              (provisionDe.auDeces === 'acquise-sans-bonus'
                ? `La réserve est reversée aux bénéficiaires — mais sans la majoration de ` +
                  `${Math.round(provisionDe.bonusAuTerme * 100)} %, qui n’est due qu’à qui atteint le terme.`
                : 'La réserve est perdue, et le contrat est ici projeté en conséquence.'),
          }
        : {
            genre: 'liquidite',
            texte:
              `Votre horizon de ${h.horizon} ans est plus court que le terme de ${provisionDe.termeAnnees} ans ` +
              `du fonds ${fonds.libelle} : sortir à cette date solde le fonds, et les intérêts mis en réserve ` +
              'sont perdus en totalité. Un retrait partiel, lui, ne les entame qu’au prorata.',
          },
    );
  }

  // The seventy-year pivot, and only when it actually bit: a plan entirely paid
  // in before the birthday is governed by one article and has nothing to be
  // warned about.
  if (h.denouement === 'deces') {
    const apres70 = h.horizon > 0 && !avantSoixanteDix(h, h.horizon);
    const debutApres70 = !avantSoixanteDix(h, 1);
    if (debutApres70) {
      alertes.push({
        genre: 'contrainte',
        texte:
          `À ${h.ageSouscription} ans, tous les versements relèvent de l’article 757 B : l’abattement ` +
          'tombe à 30 500 € pour l’ensemble des bénéficiaires et de vos contrats, au lieu de ' +
          `${ABATTEMENT_990I.toLocaleString('fr-FR')} € chacun. En revanche, les gains sont exonérés de droits.`,
      });
    } else if (apres70) {
      const bascule = AGE_PIVOT - h.ageSouscription + 1;
      alertes.push({
        genre: 'contrainte',
        texte:
          `Vos versements changent de régime à partir de la ${bascule}ᵉ année, celle de vos 70 ans : ` +
          'ceux d’avant ouvrent 152 500 € d’abattement par bénéficiaire, ceux d’après se partagent ' +
          '30 500 € en tout. Avancer les versements est ici plus rentable que changer de contrat.',
      });
    }
  }

  if (h.rebalancement === 'annuel' && provisionDe && h.partUC > 0 && h.partUC < 1) {
    alertes.push({
      genre: 'liquidite',
      texte:
        'Le rééquilibrage annuel peut faire sortir de l’argent du fonds en euros, et chaque sortie ' +
        'ampute la réserve de fidélité au prorata. Ce contrat s’accommode mal d’une allocation qu’on remet en place.',
    });
  }

  const moyenne = moyenneHistorique(fonds);
  const reference = tauxDeBase(fonds);
  if (h.sourceTaux === 'derniere-annee' && fonds.historique.length > 2 && reference - moyenne > 0.005) {
    alertes.push({
      genre: 'donnee',
      texte:
        `Le taux retenu pour ${fonds.libelle} dépasse de plus d’un demi-point sa moyenne des ` +
        `${fonds.historique.length} dernières années. Le projeter sur ${h.horizon} ans est optimiste.`,
    });
  }

  if (fonds.historique.length <= 1) {
    alertes.push({
      genre: 'donnee',
      texte:
        `${fonds.libelle} n’a qu’une seule année de taux publiée. Rien ne permet d’en dégager une ` +
        'tendance, et le simulateur la reconduit pourtant sur tout l’horizon.',
    });
  }

  if (expiree) {
    alertes.push({
      genre: 'promotion',
      texte:
        `L’offre promotionnelle de ce contrat s’est achevée le ` +
        `${(fonds.bareme?.dateFin ?? '').split('-').reverse().join('/')}. Le taux bonifié qui figure ` +
        'peut-être encore dans sa communication n’est plus souscriptible ; seul le taux de base s’applique.',
    });
  } else if (gainPromotionnel > 0) {
    alertes.push({
      genre: 'promotion',
      texte:
        `Si l’offre promotionnelle de ce contrat durait tout l’horizon — ce qu’elle ne fait pas — ` +
        `elle vaudrait environ ${Math.round(gainPromotionnel)} € de plus. C’est ce que vous compareriez ` +
        'à tort en retenant son taux vitrine.',
    });
  }

  const ecarte = c.fondsEuros.find(
    (f) => f.cle !== fonds.cle && f.partUCMinimale !== null && h.partUC < f.partUCMinimale,
  );
  if (ecarte && h.partUC < 1) {
    alertes.push({
      genre: 'contrainte',
      texte:
        `${ecarte.libelle} vous est fermé : il exige au moins ` +
        `${Math.round((ecarte.partUCMinimale ?? 0) * 100)} % d’unités de compte à chaque versement, ` +
        `et vous en visez ${Math.round(h.partUC * 100)} %.`,
    });
  }

  const plafond = fonds.bareme?.plafondVersements ?? null;
  if (plafond !== null && primes > plafond) {
    alertes.push({
      genre: 'contrainte',
      texte:
        `Vos versements dépassent le plafond de ${plafond.toLocaleString('fr-FR')} € au-delà duquel ` +
        'la bonification ne s’applique plus.',
    });
  }

  if (h.partUC > 0 && support.partage === 'retrocession') {
    alertes.push({
      genre: 'univers',
      texte:
        `Le meilleur support de cette classe dans ce contrat est une part de distribution à ` +
        `${(support.ter * 100).toFixed(2).replace('.', ',')} % de frais courants. Un ETF équivalent en ` +
        'coûterait 0,20 %, et l’écart se compose chaque année.',
    });
  }

  if (h.partUC >= 1) {
    alertes.push({
      genre: 'donnee',
      texte:
        'À 100 % d’unités de compte, le fonds en euros et son barème ne jouent plus aucun rôle : ' +
        'ce que vous comparez ici est le seul coût de détention des supports.',
    });
  }

  if (h.horizon < 8) {
    alertes.push({
      genre: 'donnee',
      texte:
        `Avant huit ans, les gains sont taxés à 12,8 % sans abattement. L’abattement de ` +
        `${ABATTEMENT[h.foyer].toLocaleString('fr-FR')} € n’entre pas dans ce calcul.`,
    });
  }

  return alertes;
}

export function projeter(h: Hypotheses, cle: CleContrat, aLaDate?: string): Resultat {
  return projeterContrat(h, contratDe(cle), { aLaDate });
}

/** Every contract in catalogue order — including the ones that drop out. */
export function comparer(h: Hypotheses, aLaDate?: string): Resultat[] {
  return CONTRATS.map((c) => projeterContrat(h, c, { aLaDate }));
}

/** The accessible ones, best first. */
export function classer(resultats: Resultat[]): ResultatAccessible[] {
  return resultats
    .filter((r): r is ResultatAccessible => r.accessible)
    .sort((a, b) => b.capitalNet - a.capitalNet);
}
