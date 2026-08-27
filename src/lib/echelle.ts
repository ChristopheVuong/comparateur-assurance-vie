import { BORNES } from './assuranceVie';

/**
 * The logarithmic track behind the payment slider.
 *
 * A thousand euros and half a million are both ordinary answers to "how much
 * are you putting in", and a linear track would crush every realistic plan into
 * its first centimetre. So the slider carries an integer position and this
 * module owns the conversion both ways.
 *
 * **The rounding step is derived from the notch, not posed.** That is the whole
 * difficulty, and getting it wrong is invisible until you drag the control: if
 * the step is coarser than one notch, neighbouring positions collapse onto the
 * same amount and the slider appears stuck for a while, then jumps. An earlier
 * version of this file fixed the step at a tenth of the decade, which is 10 %
 * of the amount at the bottom of each decade against a notch worth 4,7 % — so
 * **107 of the 200 positions did nothing at all**, and half the round trips
 * position → amount → position landed somewhere else. Hence `ECART_CRAN`, and
 * hence the tests that pin strict growth and the round trip.
 *
 * The top of the range is read from the field's own bound rather than declared
 * here: a slider that stops before the field accepts is a slider that silently
 * overwrites what somebody typed.
 */

export const POSITION_MIN = 0;
export const POSITION_MAX = 200;

/**
 * Where the track starts. Below this the field still accepts anything — the
 * slider is a convenience, not the only way in.
 */
const VALEUR_MIN = 100;

export const VALEUR_MAX = BORNES.versementInitial.max;

const DECADES = Math.log(VALEUR_MAX / VALEUR_MIN);

/** One notch of the slider, as a fraction of the amount. */
const ECART_CRAN = Math.exp(DECADES / (POSITION_MAX - 1)) - 1;

/**
 * Rounds to an amount one can read out loud — 52 000 € rather than 52 346 €.
 *
 * The step sits on the usual 1 / 2 / 5 ladder and is always **finer than one
 * notch**, which is what the `ECART_CRAN × 0.6` is for. Rounding to a fixed
 * number of significant digits would look tidier and would merge neighbouring
 * notches at the bottom of each decade.
 */
export function arrondiLisible(valeur: number): number {
  if (!Number.isFinite(valeur) || valeur <= 0) return 0;
  const cible = valeur * ECART_CRAN * 0.6;
  const magnitude = 10 ** Math.floor(Math.log10(cible));
  const normalise = cible / magnitude;
  const pas = (normalise >= 5 ? 5 : normalise >= 2 ? 2 : 1) * magnitude;
  // Rounding the quotient too: the product of two floats routinely lands on
  // 110.00000000000001, which then travels into the address and the field.
  return Math.round(Math.round(valeur / pas) * pas * 1e6) / 1e6;
}

export function valeurDePosition(position: number): number {
  if (!Number.isFinite(position) || position <= POSITION_MIN) return 0;
  const p = Math.min(POSITION_MAX, position);
  const valeur = VALEUR_MIN * Math.exp((DECADES * (p - 1)) / (POSITION_MAX - 1));
  // The top of the track must land exactly on the bound rather than on a
  // rounding of it, or the field and the slider disagree at the maximum.
  return p >= POSITION_MAX ? VALEUR_MAX : arrondiLisible(valeur);
}

export function positionDeValeur(valeur: number): number {
  if (!Number.isFinite(valeur) || valeur < VALEUR_MIN) return POSITION_MIN;
  if (valeur >= VALEUR_MAX) return POSITION_MAX;
  const position = 1 + ((POSITION_MAX - 1) * Math.log(valeur / VALEUR_MIN)) / DECADES;
  return Math.round(position);
}
