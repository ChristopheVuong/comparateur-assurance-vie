/**
 * What the taxman takes when the policy is settled by a death rather than by a
 * withdrawal.
 *
 * A module of its own, and not three more branches inside `fiscalite.ts`,
 * because it answers a different question with a different vocabulary. A
 * withdrawal is taxed as income: only the *gain* is in the base, and the
 * allowance is yearly. A death is not an income event at all — the gain escapes
 * income tax entirely — and what is levied instead is a duty on the *capital*,
 * per beneficiary, under a rule that hinges on one thing the rest of this
 * simulator never had to know: **how old the saver was on the day of each
 * payment**.
 *
 * That pivot is the whole reason this file exists. The same euro, on the same
 * contract, with the same beneficiary, is worth an allowance of €152,500 if it
 * was paid in at 69 and an allowance of €30,500 *shared with every other
 * beneficiary and every other policy* if it was paid in at 71. No fee schedule
 * in the catalogue moves a figure by anything close.
 *
 * Three modelling decisions, in the order they change the answer:
 *
 *  - **The split between the two regimes is pro rata of the premiums**, not of
 *    the gains. That is the administration's own convention: the policy is cut
 *    in two in the proportion of what was paid before and after seventy, and
 *    each half carries its share of the value. Splitting by gain would need to
 *    know which payment earned what, which no insurer tracks and no notice
 *    promises.
 *  - **Under article 990 I the gains are taxed with the capital**; under
 *    article 757 B they are **exempt**, and only the premiums beyond €30,500
 *    are taxed. This asymmetry is not a rounding detail: on a policy held
 *    twenty years it can reverse which regime is the harsher one, and it is why
 *    "pay in before seventy" is a rule of thumb rather than a law.
 *  - **The duty under 757 B is not computed here.** It follows the ordinary
 *    succession scale, which depends on the relationship between the deceased
 *    and each beneficiary and on everything *else* that beneficiary inherits —
 *    neither of which is a property of a life insurance contract. The rate is
 *    therefore a stated hypothesis carried in from the interface, and the base
 *    it applies to is reported separately so that a reader can redo the
 *    multiplication with their own figure.
 *
 * What this file deliberately does not know: that a surviving spouse or PACS
 * partner is exempt from everything, under both articles. Modelling it would
 * mean asking who the beneficiary is, and the answer would be a zero — a whole
 * input to reach a result the reader can predict. It is stated as a reservation
 * instead, next to the figure.
 *
 * Nothing is rounded here. Formatting belongs at the edge of the application.
 */

/** Age on the day of a payment, above which the harsher regime applies. */
export const AGE_PIVOT = 70;

/** Article 990 I — allowance, per beneficiary, on capital *and* gains. */
export const ABATTEMENT_990I = 152_500;

/** Article 990 I — the taxable share above which the rate steps up. */
export const SEUIL_990I = 700_000;

export const TAUX_990I_BAS = 0.2;
export const TAUX_990I_HAUT = 0.3125;

/**
 * Article 757 B — allowance on premiums, shared by every beneficiary and every
 * policy the deceased held. One figure for the whole estate, not one each.
 */
export const ABATTEMENT_757B = 30_500;

/** A defensible default for the succession scale: the bracket a child sits in. */
export const TAUX_DROITS_DEFAUT = 0.2;

export type Succession = {
  /** Share of the premiums paid before the pivot age. Drives the whole split. */
  partAvant70: number;
  /** The policy's value falling under article 990 I, capital and gains together. */
  capital990I: number;
  /** The policy's value falling under article 757 B. Its gains are exempt. */
  capital757B: number;
  /** What the €152,500 allowances actually shelter, summed over beneficiaries. */
  abattement990I: number;
  droits990I: number;
  /** Premiums paid after seventy, beyond the shared €30,500. Gains are not in it. */
  assiette757B: number;
  droits757B: number;
  total: number;
};

/**
 * The duty owed by one beneficiary on their share under article 990 I.
 *
 * Per beneficiary and never on the total, because both the allowance and the
 * €700,000 step are personal. Applying them to the whole capital would shelter
 * one allowance where there are four, and would push a modest inheritance into
 * the 31,25 % bracket it never reaches.
 */
export function droits990I(part: number): number {
  const taxable = Math.max(0, part - ABATTEMENT_990I);
  return (
    Math.min(taxable, SEUIL_990I) * TAUX_990I_BAS +
    Math.max(0, taxable - SEUIL_990I) * TAUX_990I_HAUT
  );
}

export function imposerSuccession(args: {
  /** What the beneficiaries would receive before any succession duty, net of social levies. */
  capital: number;
  primesAvant70: number;
  primesApres70: number;
  /** How many people share the capital, and therefore how many allowances apply. */
  beneficiaires: number;
  /** Marginal succession rate assumed for the article 757 B share. */
  tauxDroits: number;
}): Succession {
  const { capital, primesAvant70, primesApres70, tauxDroits } = args;
  const beneficiaires = Math.max(1, Math.round(args.beneficiaires));
  const primes = primesAvant70 + primesApres70;

  // A policy with no premiums has nothing to split; the favourable regime is
  // the right degenerate answer because it is the one an empty policy inherits.
  const partAvant70 = primes > 0 ? primesAvant70 / primes : 1;

  const valeur = Math.max(0, capital);
  const capital990I = valeur * partAvant70;
  const capital757B = valeur - capital990I;

  const part990I = capital990I / beneficiaires;
  const droits = droits990I(part990I) * beneficiaires;
  const abattement = Math.min(ABATTEMENT_990I, part990I) * beneficiaires;

  // Gains are exempt here, so the base is the premiums themselves — which is
  // why this number does not move when the market does.
  const assiette757B = Math.max(0, primesApres70 - ABATTEMENT_757B);
  const duSous757B = assiette757B * Math.max(0, tauxDroits);

  return {
    partAvant70,
    capital990I,
    capital757B,
    abattement990I: abattement,
    droits990I: droits,
    assiette757B,
    droits757B: duSous757B,
    total: droits + duSous757B,
  };
}

/**
 * Reservations that hold for every contract, because they are properties of the
 * succession regime rather than of any one insurer.
 */
export const RESERVES_SUCCESSION: string[] = [
  'L’abattement de 152 500 € vaut par bénéficiaire et par assuré, tous contrats confondus. ' +
    'Une comparaison contrat par contrat le prête à chacun d’eux : si le défunt détenait plusieurs ' +
    'contrats, il ne joue qu’une fois.',
  'Le conjoint survivant et le partenaire de PACS sont totalement exonérés, sous les deux ' +
    'articles. Le calcul suppose des bénéficiaires qui ne le sont pas — un enfant, typiquement.',
  'Les primes versées après 70 ans relèvent de l’article 757 B : leur taxation suit le barème ' +
    'ordinaire des successions, qui dépend du lien de parenté et de tout ce que le bénéficiaire ' +
    'reçoit par ailleurs. Le taux retenu est une hypothèse que vous pouvez changer, jamais un calcul.',
  'L’âge retenu pour chaque versement est celui de l’année en cours : le simulateur bascule au ' +
    'premier janvier de l’année des 70 ans, là où le fisc bascule au jour anniversaire.',
  'Les prélèvements sociaux de 17,2 % sur les gains sont dus au décès, avant les droits. Ils sont ' +
    'décomptés ici comme sur un rachat.',
];
