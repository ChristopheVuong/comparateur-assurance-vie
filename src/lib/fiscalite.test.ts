import { describe, expect, it } from 'vitest';
import {
  ABATTEMENT,
  ANCIENNETE_FAVORABLE,
  PRELEVEMENTS_SOCIAUX,
  SEUIL_PRIMES,
  TAUX_APRES_8_ANS,
  TAUX_AVANT_8_ANS,
  assietteRachat,
  imposer,
  tauxImpotRevenu,
} from './fiscalite';

const cas = (sur: Partial<Parameters<typeof imposer>[0]> = {}) =>
  imposer({
    rachat: 300_000,
    valeur: 300_000,
    primes: 200_000,
    anciennete: 20,
    foyer: 'seul',
    psDejaPayes: 0,
    assiettePSPayee: 0,
    ...sur,
  });

/**
 * A coherent pair: the levies taken, and the interest they were taken on.
 *
 * Passing one without the other is what the settlement got wrong, so the tests
 * below never write either by hand.
 */
const leve = (assiette: number) => ({
  psDejaPayes: PRELEVEMENTS_SOCIAUX * assiette,
  assiettePSPayee: assiette,
});

describe('the gain contained in a withdrawal', () => {
  it('is the whole gain on a full surrender', () => {
    expect(assietteRachat(300_000, 300_000, 100_000)).toBeCloseTo(100_000, 9);
  });

  it('is proportional to the share withdrawn', () => {
    expect(assietteRachat(30_000, 300_000, 100_000)).toBeCloseTo(10_000, 9);
  });

  it('adds up: ten partial withdrawals carry the same gain as one full one', () => {
    const total = Array.from({ length: 10 }, () =>
      assietteRachat(30_000, 300_000, 100_000),
    ).reduce((s, x) => s + x, 0);
    expect(total).toBeCloseTo(100_000, 9);
  });

  it('carries nothing when the policy is under water', () => {
    expect(assietteRachat(300_000, 300_000, -20_000)).toBe(0);
  });

  it('survives a worthless policy without dividing by zero', () => {
    expect(assietteRachat(0, 0, 0)).toBe(0);
    expect(Number.isFinite(assietteRachat(10, 0, 5))).toBe(true);
  });
});

describe('the rate applied to the gain', () => {
  it('is the ordinary rate before eight years, whatever the premiums', () => {
    expect(tauxImpotRevenu(50_000, 7)).toBe(TAUX_AVANT_8_ANS);
    expect(tauxImpotRevenu(500_000, 7)).toBe(TAUX_AVANT_8_ANS);
  });

  it('turns exactly at eight years, not at nine', () => {
    expect(tauxImpotRevenu(100_000, ANCIENNETE_FAVORABLE)).toBe(TAUX_APRES_8_ANS);
    expect(tauxImpotRevenu(100_000, ANCIENNETE_FAVORABLE - 1)).toBe(TAUX_AVANT_8_ANS);
  });

  it('is the reduced rate in full while premiums stay under the threshold', () => {
    expect(tauxImpotRevenu(SEUIL_PRIMES, 20)).toBeCloseTo(TAUX_APRES_8_ANS, 9);
  });

  it('blends pro rata rather than falling off a cliff', () => {
    // Twice the threshold: half the gain at 7,5 %, half at 12,8 %.
    const attendu = (TAUX_APRES_8_ANS + TAUX_AVANT_8_ANS) / 2;
    expect(tauxImpotRevenu(2 * SEUIL_PRIMES, 20)).toBeCloseTo(attendu, 9);
  });
});

describe('what is owed on a full surrender', () => {
  it('reproduces a worked example', () => {
    // €300,000 for €200,000 paid in, twenty years, single household.
    // Gain 100,000 · allowance 4,600 · premiums straddle 150,000, so
    // 0,75 at 7,5 % and 0,25 at 12,8 % → 8,825 %.
    const r = cas();
    expect(r.assiette).toBeCloseTo(100_000, 6);
    expect(r.abattement).toBeCloseTo(4_600, 6);
    expect(r.tauxApplique).toBeCloseTo(0.08825, 9);
    expect(r.impotRevenu).toBeCloseTo(95_400 * 0.08825, 6);
    expect(r.prelevementsSociaux).toBeCloseTo(17_200, 6);
  });

  it('never lets the allowance touch the social levies', () => {
    const seul = cas({ foyer: 'seul' });
    const couple = cas({ foyer: 'couple' });
    expect(couple.prelevementsSociaux).toBeCloseTo(seul.prelevementsSociaux, 9);
    expect(couple.abattement).toBeCloseTo(ABATTEMENT.couple, 6);
    expect(couple.impotRevenu).toBeLessThan(seul.impotRevenu);
  });

  it('grants no allowance before eight years', () => {
    expect(cas({ anciennete: 7 }).abattement).toBe(0);
  });

  it('never shelters more than the gain itself', () => {
    const r = cas({ valeur: 201_000 });
    expect(r.abattement).toBeCloseTo(1_000, 6);
    expect(r.impotRevenu).toBe(0);
  });

  it('charges no income tax on a policy under water', () => {
    const r = cas({ valeur: 180_000 });
    expect(r.assiette).toBe(0);
    expect(r.impotRevenu).toBe(0);
  });

  it('credits what has already been levied by taking it off the base, not the tax', () => {
    // €40,000 of euro interest was levied along the way, and the policy shows a
    // €100,000 gain *after* those levies. The gain never levied is therefore
    // 100,000 + 6,880 − 40,000, and that is what the settlement owes on.
    const deja = leve(40_000);
    const r = cas(deja);
    const gainBrut = 100_000 + deja.psDejaPayes;
    expect(r.assiettePS).toBeCloseTo(gainBrut - 40_000, 6);
    expect(r.prelevementsSociaux).toBeCloseTo(PRELEVEMENTS_SOCIAUX * (gainBrut - 40_000), 6);
  });

  it('owes nothing more when the whole gain came from the pocket already levied', () => {
    // The regression this correction exists for. A policy holding only a euro
    // fund has been levied on every euro it ever earned, so the settlement owes
    // exactly zero — and used to hand back 17,2 % of every levy ever taken,
    // because it compared a gain net of those levies to the base they were
    // charged on.
    for (const interets of [1_000, 25_000, 100_000]) {
      const deja = leve(interets);
      // What the policy shows is the interest minus the levies already taken.
      const valeur = 200_000 + interets - deja.psDejaPayes;
      const r = cas({ rachat: valeur, valeur, ...deja });
      expect(r.assiettePS).toBeCloseTo(0, 6);
      expect(r.prelevementsSociaux).toBeCloseTo(0, 6);
    }
  });

  it('refunds when more was levied than the policy finally gained', () => {
    // The euro pocket paid levies year after year while the unit-linked pocket
    // sank. The settlement owes a refund, and a negative figure here is the
    // right answer rather than a bug to clamp away.
    const deja = leve(40_000);
    const r = cas({ valeur: 210_000, ...deja });
    expect(r.prelevementsSociaux).toBeLessThan(0);
    expect(r.prelevementsSociaux).toBeCloseTo(
      PRELEVEMENTS_SOCIAUX * (10_000 + deja.psDejaPayes - 40_000),
      6,
    );
  });

  it('never refunds more than was taken, however badly the policy did', () => {
    const deja = leve(40_000);
    for (const valeur of [200_000, 150_000, 100_000, 0]) {
      const r = cas({ rachat: valeur, valeur, ...deja });
      expect(r.prelevementsSociaux).toBeGreaterThanOrEqual(-deja.psDejaPayes - 1e-6);
    }
    // The bound is reached exactly when the policy ends up having gained
    // nothing at all, gross: everything taken comes back, and not a euro more.
    const rien = cas({ rachat: 200_000 - deja.psDejaPayes, valeur: 200_000 - deja.psDejaPayes, ...deja });
    expect(rien.prelevementsSociaux).toBeCloseTo(-deja.psDejaPayes, 6);
  });

  it('closes: levies paid plus levies owed equal the levy on the whole gross gain', () => {
    for (const valeur of [180_000, 200_000, 240_000, 300_000, 1_000_000]) {
      for (const assiettePSPayee of [0, 5_000, 40_000]) {
        const deja = leve(assiettePSPayee);
        const r = cas({ rachat: valeur, valeur, ...deja });
        const gainBrut = valeur - 200_000 + deja.psDejaPayes;
        const attendu = PRELEVEMENTS_SOCIAUX * Math.max(0, gainBrut);
        expect(deja.psDejaPayes + r.prelevementsSociaux).toBeCloseTo(attendu, 6);
      }
    }
  });
});
