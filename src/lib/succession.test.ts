/**
 * The rules that decide what a beneficiary keeps, checked one at a time.
 *
 * Worked examples rather than a re-implementation of the formula: every figure
 * below can be arrived at with a pen, which is the only kind of test worth
 * having on a tax rule. Where a number looks arbitrary it is a bracket
 * boundary, and it is named as such.
 */

import { describe, expect, it } from 'vitest';
import {
  ABATTEMENT_757B,
  ABATTEMENT_990I,
  SEUIL_990I,
  TAUX_990I_BAS,
  TAUX_990I_HAUT,
  droits990I,
  imposerSuccession,
} from './succession';

const avant70 = (capital: number, beneficiaires = 1) =>
  imposerSuccession({
    capital,
    primesAvant70: 100_000,
    primesApres70: 0,
    beneficiaires,
    tauxDroits: 0.2,
  });

describe('article 990 I, per beneficiary', () => {
  it('takes nothing up to the allowance', () => {
    expect(droits990I(ABATTEMENT_990I)).toBe(0);
    expect(droits990I(0)).toBe(0);
    expect(droits990I(-1)).toBe(0);
  });

  it('taxes the next euro at 20 %, and only that euro', () => {
    expect(droits990I(ABATTEMENT_990I + 1_000)).toBeCloseTo(1_000 * TAUX_990I_BAS, 9);
  });

  it('steps up to 31,25 % only beyond the taxable threshold', () => {
    const juste = droits990I(ABATTEMENT_990I + SEUIL_990I);
    expect(juste).toBeCloseTo(SEUIL_990I * TAUX_990I_BAS, 6);
    const audela = droits990I(ABATTEMENT_990I + SEUIL_990I + 10_000);
    expect(audela - juste).toBeCloseTo(10_000 * TAUX_990I_HAUT, 6);
  });

  it('gives each beneficiary their own allowance, and their own threshold', () => {
    // The whole point of naming several people. One beneficiary on 300 000 €
    // pays; two on 150 000 € each pay nothing at all.
    const seul = avant70(300_000, 1);
    const deux = avant70(300_000, 2);
    expect(seul.droits990I).toBeCloseTo((300_000 - ABATTEMENT_990I) * TAUX_990I_BAS, 6);
    expect(deux.droits990I).toBe(0);
  });

  it('shelters no more than there is to shelter', () => {
    const petit = avant70(40_000);
    expect(petit.abattement990I).toBeCloseTo(40_000, 6);
    expect(petit.droits990I).toBe(0);
  });
});

describe('article 757 B, on premiums and never on gains', () => {
  const apres70 = (capital: number, primesApres70: number, tauxDroits = 0.2) =>
    imposerSuccession({
      capital,
      primesAvant70: 0,
      primesApres70,
      beneficiaires: 1,
      tauxDroits,
    });

  it('leaves the shared allowance untaxed', () => {
    expect(apres70(200_000, ABATTEMENT_757B).droits757B).toBe(0);
  });

  it('taxes the premiums beyond it, whatever the policy earned', () => {
    const pauvre = apres70(60_000, 100_000);
    const riche = apres70(400_000, 100_000);
    const attendu = (100_000 - ABATTEMENT_757B) * 0.2;
    expect(pauvre.droits757B).toBeCloseTo(attendu, 6);
    // The gain is exempt: quadrupling the capital moves this figure by nothing.
    expect(riche.droits757B).toBeCloseTo(attendu, 6);
  });

  it('honours a rate of zero, which is what an exempt beneficiary is', () => {
    expect(apres70(400_000, 100_000, 0).total).toBe(0);
  });
});

describe('the split between the two regimes', () => {
  it('follows the premiums, not the gains', () => {
    const s = imposerSuccession({
      capital: 300_000,
      primesAvant70: 75_000,
      primesApres70: 25_000,
      beneficiaires: 1,
      tauxDroits: 0.2,
    });
    expect(s.partAvant70).toBeCloseTo(0.75, 9);
    expect(s.capital990I).toBeCloseTo(225_000, 6);
    expect(s.capital757B).toBeCloseTo(75_000, 6);
  });

  it('accounts for the whole capital and nothing more', () => {
    for (const avant of [0, 10_000, 50_000, 100_000]) {
      const s = imposerSuccession({
        capital: 250_000,
        primesAvant70: avant,
        primesApres70: 100_000 - avant,
        beneficiaires: 3,
        tauxDroits: 0.2,
      });
      expect(s.capital990I + s.capital757B).toBeCloseTo(250_000, 6);
      expect(s.total).toBeCloseTo(s.droits990I + s.droits757B, 9);
    }
  });

  it('treats an empty policy as falling under the favourable article', () => {
    const s = imposerSuccession({
      capital: 0,
      primesAvant70: 0,
      primesApres70: 0,
      beneficiaires: 1,
      tauxDroits: 0.2,
    });
    expect(s.partAvant70).toBe(1);
    expect(s.total).toBe(0);
  });

  it('never owes duties on a policy worth less than its allowances', () => {
    for (const capital of [0, 1_000, 50_000, ABATTEMENT_990I]) {
      expect(avant70(capital).total).toBe(0);
    }
  });
});

/**
 * The rule of thumb, and where it stops being true.
 *
 * "Pay in before seventy" is repeated everywhere, and this is the test that
 * says why it is a rule of thumb rather than a law: article 990 I taxes the
 * *gains* along with the capital, article 757 B exempts them. A policy that has
 * multiplied its premiums can therefore be cheaper to transmit under the
 * regime everyone calls the punitive one — which is exactly the kind of claim
 * a simulator should be able to make and defend.
 */
describe('the pivot, and which side of it is actually cheaper', () => {
  const seul = (capital: number, avant: boolean, primes = 100_000) =>
    imposerSuccession({
      capital,
      primesAvant70: avant ? primes : 0,
      primesApres70: avant ? 0 : primes,
      beneficiaires: 1,
      tauxDroits: 0.2,
    });

  it('favours paying before seventy while the policy has grown little', () => {
    // 100 000 € paid in, 160 000 € at death. Under 990 I the whole 160 000 sits
    // in the base but the allowance covers most of it; under 757 B the
    // allowance is a twentieth of the size.
    const avant = seul(160_000, true);
    const apres = seul(160_000, false);
    expect(avant.total).toBeCloseTo((160_000 - ABATTEMENT_990I) * TAUX_990I_BAS, 6);
    expect(apres.total).toBeCloseTo((100_000 - ABATTEMENT_757B) * 0.2, 6);
    expect(avant.total).toBeLessThan(apres.total);
  });

  it('reverses once the gains are large enough, because 757 B exempts them', () => {
    // Same premiums, tripled. The gains are now the bulk of the capital, and
    // they are taxed under 990 I and exempt under 757 B.
    const avant = seul(300_000, true);
    const apres = seul(300_000, false);
    expect(apres.total).toBeLessThan(avant.total);
  });

  it('leaves the 757 B duty untouched by the market, which is what causes the reversal', () => {
    expect(seul(160_000, false).total).toBeCloseTo(seul(300_000, false).total, 6);
    expect(seul(160_000, true).total).toBeLessThan(seul(300_000, true).total);
  });

  it('restores the rule of thumb as soon as beneficiaries are named', () => {
    // Three allowances of €152,500 shelter the whole thing under 990 I, while
    // the €30,500 of article 757 B is shared and does not multiply.
    const avant = imposerSuccession({
      capital: 300_000,
      primesAvant70: 100_000,
      primesApres70: 0,
      beneficiaires: 3,
      tauxDroits: 0.2,
    });
    const apres = imposerSuccession({
      capital: 300_000,
      primesAvant70: 0,
      primesApres70: 100_000,
      beneficiaires: 3,
      tauxDroits: 0.2,
    });
    expect(avant.total).toBe(0);
    expect(apres.total).toBeGreaterThan(0);
  });
});
