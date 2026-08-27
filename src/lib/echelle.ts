/**
 * The logarithmic track behind the payment slider.
 *
 * A thousand euros and half a million are both ordinary answers to "how much
 * are you putting in", and a linear track would crush every realistic plan into
 * its first centimetre. So the slider carries a position and this module turns
 * it into an amount.
 *
 * Positions are integers, which is what makes the control feel like a control:
 * every notch lands on a round-ish number instead of on €4,873.
 */

export const POSITION_MIN = 0;
export const POSITION_MAX = 200;

const VALEUR_MIN = 100;
const VALEUR_MAX = 1_000_000;

/**
 * Rounds onto the 1 / 2 / 5 step of the decade.
 *
 * Finer than a notch of the slider on purpose: a value arriving from the field
 * or from the address should not be dragged to the nearest notch, only tidied.
 */
export function arrondiLisible(valeur: number): number {
  if (valeur <= 0) return 0;
  const decade = 10 ** Math.floor(Math.log10(valeur));
  const rapport = valeur / decade;
  const pas = rapport < 1.5 ? 0.1 : rapport < 3 ? 0.2 : rapport < 7 ? 0.5 : 1;
  return Math.round(valeur / (pas * decade)) * pas * decade;
}

export function valeurDePosition(position: number): number {
  if (position <= POSITION_MIN) return 0;
  const t = (position - POSITION_MIN) / (POSITION_MAX - POSITION_MIN);
  const brut = VALEUR_MIN * (VALEUR_MAX / VALEUR_MIN) ** t;
  return arrondiLisible(brut);
}

export function positionDeValeur(valeur: number): number {
  if (valeur <= 0) return POSITION_MIN;
  const borne = Math.min(VALEUR_MAX, Math.max(VALEUR_MIN, valeur));
  const t = Math.log(borne / VALEUR_MIN) / Math.log(VALEUR_MAX / VALEUR_MIN);
  return Math.round(POSITION_MIN + t * (POSITION_MAX - POSITION_MIN));
}
