import { describe, expect, it } from 'vitest';
import { annees, eur, eurSigne, nombre, points, taux } from './format';

describe('amounts', () => {
  it('are written to the euro, because cents on a capital figure are noise', () => {
    expect(eur(218_701.44)).toBe('218 701 €');
    expect(eur(0)).toBe('0 €');
  });

  it('use a real minus sign, so a column of figures stays straight', () => {
    expect(eur(-1_500)).toContain('−');
    expect(eur(-1_500)).not.toContain('-');
  });

  it('survive a NaN rather than printing one', () => {
    expect(eur(Number.NaN)).toBe('0 €');
    expect(nombre(Number.POSITIVE_INFINITY)).toBe('0');
  });

  it('never print a minus sign in front of nothing', () => {
    // Negative zero survives Math.round and Intl renders it faithfully, which
    // reads as a bug every time it lands on a reconciliation line.
    expect(eur(-0)).toBe(eur(0));
    expect(eur(-0.2)).toBe(eur(0));
    expect(eur(-0)).not.toContain('−');
  });
});

describe('differences', () => {
  it('always carry their sign, so a gain cannot be read as a loss', () => {
    expect(eurSigne(2_400)).toMatch(/^\+/);
    expect(eurSigne(-2_400)).toMatch(/^−/);
    expect(eurSigne(0)).toBe('0 €');
  });

  it('round to the euro before deciding they are nothing', () => {
    expect(eurSigne(0.4)).toBe('0 €');
  });
});

describe('rates', () => {
  it('use a comma and an unbreakable space, as French typography wants', () => {
    expect(taux(0.0475)).toBe('4,75 %');
  });

  it('drop trailing zeros rather than pretending to a precision they lack', () => {
    expect(taux(0.03)).toBe('3 %');
    expect(taux(0.005)).toBe('0,5 %');
  });

  it('go to three decimals when asked, for a blended rate', () => {
    expect(taux(0.04125, 3)).toBe('4,125 %');
  });
});

describe('points and years', () => {
  it('call a gap between two rates points, never per cent', () => {
    expect(points(0.0025)).toBe('0,25 point');
    expect(points(0.025)).toBe('2,5 points');
  });

  it('pluralise years from two, as French does', () => {
    expect(annees(1)).toBe('1 an');
    expect(annees(20)).toBe('20 ans');
  });
});
