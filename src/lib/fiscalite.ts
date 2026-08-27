/**
 * What the taxman takes when money comes out of a life insurance policy.
 *
 * This module knows about numbers and nothing else — no contract, no insurer,
 * no support. That is what makes the rule that matters testable on its own:
 * **only the gain contained in a withdrawal is taxed, never the capital paid
 * in**, and that gain is worked out proportionally, `rachat × plus-value /
 * valeur`. The twin simulator taxes the whole withdrawal and says so in its
 * TODO as its worst known bias; there is no reason to inherit it.
 *
 * Four rules carry the model, and three of them are the ones people get wrong:
 *
 *  - **The €150,000 threshold is a pro rata, not a cliff.** Premiums below it
 *    have their share of the gain taxed at 7,5 %, the rest at 12,8 %. Treating
 *    it as a cliff misprices every large policy.
 *  - **The allowance bites on income tax and never on social levies.** €4,600
 *    (€9,200 for a couple) comes off the base for the 7,5 %, while the 17,2 %
 *    is charged on the gain in full. This is the classic mistake.
 *  - **Social levies already paid on the euro fund are not paid twice — and the
 *    settlement compares like with like.** They are taken every year on that
 *    pocket's interest, withdrawal or no withdrawal, so the settlement only
 *    owes what has never been levied. The subtlety, and it was got wrong here
 *    once: the yearly levy is charged on the interest *credited*, while the
 *    gain a policy finally shows is already *net* of those levies. Netting the
 *    second against the first hands back 17,2 % of every levy ever taken — a
 *    small, systematic refund that no insurer makes, and which stayed invisible
 *    for as long as income tax was there to swallow the sign. The base is
 *    therefore reconstituted gross before anything is compared to it.
 *  - **A genuine refund is still allowed, and is not clamped away.** When the
 *    unit-linked pocket sinks far enough that the policy's whole gain falls
 *    short of what the euro pocket was already levied on, the insurer really
 *    does refund the difference. That refund cannot exceed what was taken, and
 *    the formula bounds it there on its own rather than by a `Math.max`.
 *  - **Entry fees do not reduce the taxable base.** Premiums count gross, so a
 *    front-end load is paid twice over: once in capital that was never
 *    invested, once in tax on a gain it prevented. Association dues are not a
 *    premium at all and leave the base on both sides.
 *
 * Nothing is rounded here. Formatting belongs at the edge of the application.
 */

export type Foyer = 'seul' | 'couple';

/** Social levies, on gains. */
export const PRELEVEMENTS_SOCIAUX = 0.172;

/** Income tax on gains, policy held under eight years. */
export const TAUX_AVANT_8_ANS = 0.128;

/**
 * Income tax on gains after eight years, on the share of premiums under the
 * threshold. Life insurance did not follow the 2026 rise.
 */
export const TAUX_APRES_8_ANS = 0.075;

/** Premiums beyond this are taxed at the ordinary rate even after eight years. */
export const SEUIL_PRIMES = 150_000;

/** Years the policy must run before the reduced rate and the allowance apply. */
export const ANCIENNETE_FAVORABLE = 8;

/** Yearly allowance on the gain, once the policy is over eight years old. */
export const ABATTEMENT: Record<Foyer, number> = { seul: 4_600, couple: 9_200 };

export const LIBELLES_FOYER: Record<Foyer, string> = {
  seul: 'Une personne',
  couple: 'Un couple',
};

export function estFoyer(valeur: unknown): valeur is Foyer {
  return valeur === 'seul' || valeur === 'couple';
}

/**
 * The gain contained in a withdrawal.
 *
 * French rule, and it is genuinely proportional: a withdrawal of a tenth of the
 * policy carries a tenth of its gain. On a full surrender `rachat === valeur`
 * and this degenerates into the whole gain — so it is, strictly speaking,
 * unnecessary for the headline figure. It is written and tested anyway, because
 * it starts doing real work the moment withdrawals are spread over several
 * years, and because a spread exit is the only way the yearly allowance ever
 * earns its keep.
 */
export function assietteRachat(rachat: number, valeur: number, plusValue: number): number {
  if (!Number.isFinite(valeur) || valeur <= 0) return 0;
  if (plusValue <= 0) return 0;
  const part = Math.min(Math.max(rachat, 0), valeur) / valeur;
  return plusValue * part;
}

/**
 * The marginal income-tax brackets a household can sit in.
 *
 * Offered as a closed list rather than a free rate, because these are the only
 * values that exist: a bracket is not a preference to be tuned, and letting
 * somebody type 18 % would invite them to invent a household that the tax code
 * does not have.
 */
export const TMI = [0, 0.11, 0.3, 0.41, 0.45] as const;

export type TauxMarginal = (typeof TMI)[number];

export function estTauxMarginal(valeur: unknown): valeur is TauxMarginal {
  return TMI.includes(valeur as TauxMarginal);
}

/**
 * The income tax rate actually applied, blended when premiums straddle the
 * €150,000 threshold.
 *
 * Under eight years there is nothing to blend: the ordinary rate applies to the
 * whole gain.
 *
 * `bareme` is the household's marginal bracket, taken when it has opted out of
 * the flat rate — and it is `null`, not zero, when there is no option. Zero is
 * a real bracket, and the one the whole feature exists for: a household that
 * owes nothing must be expressible without meaning "no option chosen".
 *
 * **The option is not automatically the cheaper of the two.** It replaces the
 * flat rate whether that helps or hurts, because it does exactly that in real
 * life: past eight years the flat rate is 7,5 %, so every bracket from 11 %
 * upwards pays *more* under the option. Silently picking the minimum would turn
 * a simulator into an optimiser and hide the trap this control exists to make
 * visible.
 */
export function tauxImpotRevenu(
  primes: number,
  anciennete: number,
  bareme: TauxMarginal | null = null,
): number {
  if (bareme !== null) return bareme;
  if (anciennete < ANCIENNETE_FAVORABLE) return TAUX_AVANT_8_ANS;
  if (primes <= 0) return TAUX_APRES_8_ANS;
  const sousLeSeuil = Math.min(SEUIL_PRIMES, primes) / primes;
  return TAUX_APRES_8_ANS * sousLeSeuil + TAUX_AVANT_8_ANS * (1 - sousLeSeuil);
}

/**
 * The gain the exit social levy is actually owed on.
 *
 * Two corrections in one line, and both matter:
 *
 *  - **the gain is reconstituted gross.** `plusValue` is what the policy shows
 *    *after* the euro pocket was levied year after year; adding those levies
 *    back is what makes it comparable to the base they were charged on.
 *  - **what has already been levied comes off the base, not off the tax.**
 *    Subtracting the levies themselves would net a rate against an amount and
 *    hand back a fraction of every levy ever taken.
 *
 * The result is signed on purpose. Negative means a refund is owed, and it
 * cannot exceed what was taken: with a flat rate the worst case is a policy
 * that gained nothing at all, which returns exactly `−assiettePSPayee`.
 */
export function assiettePSALaSortie(
  plusValue: number,
  psDejaPayes: number,
  assiettePSPayee: number,
): number {
  const gainBrut = plusValue + psDejaPayes;
  return Math.max(0, gainBrut) - Math.max(0, assiettePSPayee);
}

export type Imposition = {
  /** The gain contained in the withdrawal, and the base income tax is charged on. */
  assiette: number;
  /**
   * The base the exit social levy is charged on: the gain never yet levied.
   *
   * A second base and not a second rate, because it is genuinely a different
   * quantity from `assiette` — one is net of the yearly levies and the other is
   * not. Reporting it is what lets a reader check the settlement rather than
   * take it on faith.
   */
  assiettePS: number;
  /** What the allowance actually shelters, never more than the base itself. */
  abattement: number;
  /** Blended, when premiums straddle the €150,000 threshold. */
  tauxApplique: number;
  impotRevenu: number;
  /** What is still owed, once what was levied yearly is credited. May be negative. */
  prelevementsSociaux: number;
  total: number;
};

export function imposer(args: {
  rachat: number;
  valeur: number;
  /** Gross premiums paid in, before any front-end load and excluding dues. */
  primes: number;
  anciennete: number;
  foyer: Foyer;
  /** Social levies already taken, year after year, on the euro pocket. */
  psDejaPayes: number;
  /** The interest those levies were charged on, gross. Not the levies themselves. */
  assiettePSPayee: number;
  /** Marginal bracket when the household opted for the scale; `null` under the flat rate. */
  bareme?: TauxMarginal | null;
}): Imposition {
  const { rachat, valeur, primes, anciennete, foyer, psDejaPayes, assiettePSPayee } = args;
  const plusValue = valeur - primes;
  const assiette = assietteRachat(rachat, valeur, plusValue);

  // The allowance survives the option: it is a rule of the life-insurance
  // regime, not a feature of the flat rate, and it applies to a gain taxed on
  // the scale exactly as it applies to one taxed at 7,5 %.
  const abattement =
    anciennete >= ANCIENNETE_FAVORABLE ? Math.min(ABATTEMENT[foyer], assiette) : 0;

  const tauxApplique = tauxImpotRevenu(primes, anciennete, args.bareme ?? null);
  const impotRevenu = Math.max(0, assiette - abattement) * tauxApplique;

  // A settlement figure, and deliberately not prorated by the share withdrawn:
  // the refund the negative branch describes happens when the policy is wound
  // up, not when a slice of it is taken.
  const assiettePS = assiettePSALaSortie(plusValue, psDejaPayes, assiettePSPayee);
  const prelevementsSociaux = PRELEVEMENTS_SOCIAUX * assiettePS;

  return {
    assiette,
    assiettePS,
    abattement,
    tauxApplique,
    impotRevenu,
    prelevementsSociaux,
    total: impotRevenu + prelevementsSociaux,
  };
}

/**
 * What is owed when the policy is settled by a death instead of a withdrawal.
 *
 * A function of its own rather than a flag on `imposer`, because the two differ
 * in kind and not in degree: **a death is not an income event**. The gain
 * escapes income tax entirely — no rate, no allowance, no eight-year cliff —
 * and what replaces it is a duty on the capital that this module knows nothing
 * about, computed in `succession.ts`.
 *
 * What survives is the social levy, and only the part of it not already taken:
 * the euro pocket has been levied year after year regardless, so the settlement
 * owes the difference on the unit-linked gain. Returning the same `Imposition`
 * shape as a withdrawal is deliberate — everything downstream reconciles the
 * two settlements identically, and the zeroes say plainly which lines a death
 * does not reach.
 */
export function imposerDeces(args: {
  valeur: number;
  primes: number;
  psDejaPayes: number;
  assiettePSPayee: number;
}): Imposition {
  const { valeur, primes, psDejaPayes, assiettePSPayee } = args;
  const plusValue = valeur - primes;
  const assiettePS = assiettePSALaSortie(plusValue, psDejaPayes, assiettePSPayee);
  const prelevementsSociaux = PRELEVEMENTS_SOCIAUX * assiettePS;
  return {
    assiette: assietteRachat(valeur, valeur, plusValue),
    assiettePS,
    abattement: 0,
    tauxApplique: 0,
    impotRevenu: 0,
    prelevementsSociaux,
    total: prelevementsSociaux,
  };
}

/**
 * Reservations that hold for every contract in the catalogue, because they are
 * properties of the tax regime rather than of any one insurer. Repeating them
 * on each entry would be six copies of the same sentence.
 *
 * These are the ones a *withdrawal* answers to. A policy settled by a death is
 * governed by another regime and carries its own list, in `succession.ts`:
 * printing the eight-year allowance beside a death benefit would be describing
 * a rule that does not apply.
 */
export const RESERVES_FISCALES: string[] = [
  'L’abattement de 4 600 € (9 200 € pour un couple) est annuel et commun à tous vos contrats. ' +
    'Une comparaison contrat par contrat le prête à chacun d’eux : si vous en détenez plusieurs, ' +
    'vous ne l’aurez qu’une fois.',
  'Le simulateur suppose un rachat total au terme. Étaler la sortie sur plusieurs années permet ' +
    'de reprendre l’abattement chaque année, et change franchement l’impôt dû.',
  'Les taux retenus sont ceux de 2026. La fiscalité de l’assurance-vie a déjà changé plusieurs ' +
    'fois, et les primes versées avant le 27 septembre 2017 relèvent d’un régime différent, non modélisé.',
  'L’option pour le barème est **globale** : elle s’applique la même année à tous les revenus de ' +
    'capitaux mobiliers du foyer — dividendes, intérêts, plus-values de cession. Le simulateur ne ' +
    'connaît que ce contrat : il chiffre ce que l’option fait ici, jamais si elle est bonne pour vous.',
  'Sous le barème, 6,8 points de CSG deviennent déductibles du revenu de l’année suivante. Ce ' +
    'gain n’est pas modélisé : l’option est donc légèrement sous-estimée pour un foyer imposable, ' +
    'et inchangée pour un foyer non imposable, qui n’a rien à déduire.',
];
