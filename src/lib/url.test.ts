import { describe, expect, it } from 'vitest';
import { DEFAUTS, borner, type Hypotheses } from './assuranceVie';
import { decoderDetail, decoderEtat, encoderEtat } from './url';

const etat = (sur: Partial<Hypotheses> = {}): Hypotheses => borner({ ...DEFAUTS, ...sur });

describe('what the address carries', () => {
  it('stays empty when nothing has been changed', () => {
    expect(encoderEtat(DEFAUTS)).toBe('');
  });

  it('writes only what differs from the defaults', () => {
    const requete = encoderEtat(etat({ horizon: 30 }));
    expect(requete).toBe('?duree=30');
  });

  it('writes rates as percentage points, because a link is read by people too', () => {
    expect(encoderEtat(etat({ partUC: 0.35 }))).toContain('uc=35');
    expect(encoderEtat(etat({ rendementUC: 0.055 }))).toContain('rendement=5.5');
  });

  it('makes the round trip without loss', () => {
    const depart = etat({
      versementInitial: 125_000,
      versementProgramme: 450,
      periodicite: 'trimestrielle',
      revalorisationVersements: 0.02,
      horizon: 27,
      partUC: 0.35,
      classeUC: 'obligations',
      rendementUC: 0.031,
      sourceTaux: 'moyenne-historique',
      rebalancement: 'aucun',
      foyer: 'couple',
    });
    expect(decoderEtat(encoderEtat(depart))).toEqual(depart);
  });

  it('makes the round trip on every corner of the grid', () => {
    for (const partUC of [0, 0.2, 0.5, 1]) {
      for (const horizon of [1, 8, 40]) {
        for (const foyer of ['seul', 'couple'] as const) {
          const depart = etat({ partUC, horizon, foyer });
          expect(decoderEtat(encoderEtat(depart))).toEqual(depart);
        }
      }
    }
  });
});

describe('reading an address back', () => {
  it('clamps what it carries, the address being untrusted input', () => {
    const lu = decoderEtat('?uc=400&duree=900&rendement=-90&initial=-5');
    expect(lu.partUC).toBe(1);
    expect(lu.horizon).toBe(40);
    expect(lu.rendementUC).toBe(-0.05);
    expect(lu.versementInitial).toBe(0);
  });

  it('falls back to the defaults on nonsense rather than producing a NaN', () => {
    const lu = decoderEtat('?uc=beaucoup&duree=&classe=inexistante&foyer=chat&rythme=parfois');
    expect(lu.partUC).toBe(DEFAUTS.partUC);
    expect(lu.horizon).toBe(DEFAUTS.horizon);
    expect(lu.classeUC).toBe(DEFAUTS.classeUC);
    expect(lu.foyer).toBe(DEFAUTS.foyer);
    expect(lu.periodicite).toBe('mensuelle');
  });

  it('ignores keys it does not know', () => {
    expect(decoderEtat('?inconnu=1&utm_source=quelquepart')).toEqual(borner(DEFAUTS));
  });

  it('accepts a comma as a decimal separator, since that is what people type', () => {
    expect(decoderEtat('?rendement=5,5').rendementUC).toBeCloseTo(0.055, 9);
  });

  it('reads back the contract whose detail was open, and only a real one', () => {
    expect(decoderDetail('?detail=afer-generation')).toBe('afer-generation');
    expect(decoderDetail('?detail=inexistant')).toBeNull();
    expect(decoderDetail('')).toBeNull();
  });
});
