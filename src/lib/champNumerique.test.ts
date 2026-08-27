/**
 * What a keystroke means, tested without a DOM.
 *
 * The hook itself is a ten-line shell around these two functions, so there is
 * nothing left in it worth mounting a browser for. What is worth testing is the
 * parsing: it once turned `1.2.3` into `NaN`, and that `NaN` travelled all the
 * way into the React state and into the shared link.
 */

import { describe, expect, it } from 'vitest';
import { analyser, formater } from './champNumerique';

describe('reading what was typed', () => {
  it('accepts both decimal marks, since both keyboards produce one', () => {
    expect(analyser('5,5', 1).valeur).toBe(5.5);
    expect(analyser('5.5', 1).valeur).toBe(5.5);
  });

  it('ignores a second decimal mark instead of choking on it', () => {
    // A typo, not an attack — and the naive parse produced NaN, which reached
    // the address bar as `?rendement=NaN`.
    expect(analyser('1.2.3', 1).valeur).toBe(1.23);
    expect(analyser('1,2,3', 1).valeur).toBe(1.23);
    expect(Number.isFinite(analyser('....', 1).valeur)).toBe(true);
  });

  it('never returns anything but a finite number', () => {
    for (const saisie of ['', '.', ',', 'abc', '..', '1..', '-', '1e5', '∞']) {
      for (const decimales of [0, 1]) {
        expect(Number.isFinite(analyser(saisie, decimales).valeur), saisie).toBe(true);
      }
    }
  });

  it('drops everything that is not a digit', () => {
    expect(analyser('50 000 €', 0).valeur).toBe(50_000);
    expect(analyser('1 234,56', 1).valeur).toBe(1234.56);
  });

  it('reads an empty field as nothing, not as a refusal', () => {
    expect(analyser('', 0)).toEqual({ chiffres: '', valeur: 0 });
  });
});

describe('writing a value back into the field', () => {
  it('groups the thousands, including while the amount is being typed', () => {
    const rendu = formater(50_000, 0, false);
    // A separator of some kind, and the digits intact once it is removed.
    expect(rendu).not.toBe('50000');
    expect(rendu.replace(/\D/g, '')).toBe('50000');
  });

  it('leaves an optional field empty rather than showing a zero to erase', () => {
    expect(formater(0, 0, true)).toBe('');
    expect(formater(0, 0, false)).not.toBe('');
  });

  it('keeps the decimals it is allowed, and no more', () => {
    expect(formater(5.5, 1, false)).toBe('5,5');
    expect(formater(5, 1, false)).toBe('5');
  });

  it('makes the round trip on what the field itself produced', () => {
    for (const v of [0, 1, 250, 50_000, 1_000_000]) {
      expect(analyser(formater(v, 0, false), 0).valeur).toBe(v);
    }
    for (const v of [0, 2, 5.5, 7, 12.8]) {
      expect(analyser(formater(v, 1, false), 1).valeur).toBeCloseTo(v, 9);
    }
  });
});
