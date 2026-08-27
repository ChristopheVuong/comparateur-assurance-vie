/**
 * The slider's scale, pinned by the two properties that matter.
 *
 * Both were violated when this file did not exist: 107 of the 200 positions
 * produced the same amount as their neighbour, and 108 of the 200 round trips
 * landed somewhere else. Neither shows up in a screenshot — you have to drag
 * the control to see it, and then it feels broken rather than wrong.
 */

import { describe, expect, it } from 'vitest';
import { BORNES } from './assuranceVie';
import {
  POSITION_MAX,
  POSITION_MIN,
  VALEUR_MAX,
  arrondiLisible,
  positionDeValeur,
  valeurDePosition,
} from './echelle';

describe('the slider track', () => {
  it('rises strictly, with no plateau and no step backwards', () => {
    for (let p = POSITION_MIN + 2; p <= POSITION_MAX; p++) {
      expect(
        valeurDePosition(p),
        `la position ${p} rend la même valeur que la précédente`,
      ).toBeGreaterThan(valeurDePosition(p - 1));
    }
  });

  it('finds again the position of a value the slider itself produced', () => {
    for (let p = POSITION_MIN + 1; p <= POSITION_MAX; p++) {
      expect(positionDeValeur(valeurDePosition(p)), `aller-retour cassé en ${p}`).toBe(p);
    }
  });

  it('reserves position zero for nothing at all', () => {
    expect(valeurDePosition(POSITION_MIN)).toBe(0);
    expect(positionDeValeur(0)).toBe(POSITION_MIN);
  });

  it('stops exactly where the field stops', () => {
    // A slider that tops out below what the field accepts silently overwrites
    // whatever somebody typed the moment they nudge it.
    expect(valeurDePosition(POSITION_MAX)).toBe(BORNES.versementInitial.max);
    expect(VALEUR_MAX).toBe(BORNES.versementInitial.max);
    expect(positionDeValeur(BORNES.versementInitial.max)).toBe(POSITION_MAX);
  });

  it('clamps beyond either end rather than running off', () => {
    expect(valeurDePosition(POSITION_MAX + 50)).toBe(VALEUR_MAX);
    expect(valeurDePosition(-10)).toBe(0);
    expect(positionDeValeur(VALEUR_MAX * 10)).toBe(POSITION_MAX);
  });
});

describe('reading an amount out loud', () => {
  it('rounds onto the 1 / 2 / 5 step of the decade', () => {
    expect(arrondiLisible(52_346)).toBe(52_000);
    expect(arrondiLisible(1_037)).toBe(1_040);
  });

  it('never leaves a float tail behind', () => {
    // `110.00000000000001` used to reach the address bar and the field.
    for (let p = POSITION_MIN + 1; p <= POSITION_MAX; p++) {
      const v = valeurDePosition(p);
      expect(Number.isInteger(v * 100), `${v} traîne des décimales`).toBe(true);
    }
  });

  it('survives a NaN rather than propagating one', () => {
    expect(arrondiLisible(Number.NaN)).toBe(0);
    expect(arrondiLisible(Number.POSITIVE_INFINITY)).toBe(0);
    expect(valeurDePosition(Number.NaN)).toBe(0);
    expect(positionDeValeur(Number.NaN)).toBe(POSITION_MIN);
  });

  it('rounds nothing to nothing', () => {
    expect(arrondiLisible(0)).toBe(0);
    expect(arrondiLisible(-5)).toBe(0);
  });
});
