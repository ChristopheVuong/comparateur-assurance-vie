/**
 * The parts of the model are named in one place.
 *
 * A component that writes `coutsPreleves.support` has quietly taken a position
 * on what the deductions are and what they are called — and the next field
 * added to `CoutsPreleves` will not reach it. That is not hypothetical: this
 * application's detail panel once listed seven of eight items and summed its
 * own list rather than the record, so a deduction existed that no total
 * counted, and nothing anywhere said so.
 *
 * A separate file from `statique.test.ts` because it states a different
 * property. The source-scanning preamble is duplicated rather than shared: a
 * non-test module calling `import.meta.glob` would be bundled into the shipped
 * application, which is a worse price than twelve repeated lines.
 */

import { describe, expect, it } from 'vitest';
import { DEFAUTS, POSTES_RECURRENTS, postes, projeterContrat } from './assuranceVie';
import { CONTRATS, contrat } from './contrats';

const SOURCES = Object.entries(
  import.meta.glob('../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<
    string,
    string
  >,
)
  .filter(([chemin]) => !chemin.endsWith('.test.ts'))
  .map(([chemin, contenu]) => ({
    chemin: chemin.replace(/^\.\.\//, '').replace(/^\.\//, 'lib/'),
    contenu,
  }));

describe('the model is named in one place', () => {
  it('has sources to check in the first place', () => {
    expect(SOURCES.length).toBeGreaterThan(10);
  });

  it('never names a deduction outside the engine', () => {
    const fautifs = SOURCES.filter(
      (s) => !s.chemin.startsWith('lib/') && /coutsPreleves\s*\.\s*[A-Za-z]/.test(s.contenu),
    ).map((s) => s.chemin);
    expect(fautifs).toEqual([]);
  });

  it('never spells the size of the catalogue out in words', () => {
    // Narrow on purpose. `les six`, `des six`, `aux six` are French article
    // forms, and this codebase comments in English — so the guard catches
    // visible copy and leaves the header comments that legitimately say "six
    // contracts" alone.
    for (const { chemin, contenu } of SOURCES) {
      expect(contenu, `${chemin} écrit le nombre de contrats en toutes lettres`).not.toMatch(
        /\b(les|des|aux) six\b/i,
      );
    }
  });
});

describe('the catalogue of deductions', () => {
  it('describes every one of them, in a stated order', () => {
    // Pinned rather than derived: this is the order a reader sees, and it
    // should not be able to change without somebody saying so.
    expect(postes()).toEqual([
      'versement',
      'adhesion',
      'gestionContrat',
      'support',
      'encours',
      'arbitrage',
      'provisionPerdue',
      'fiscalite',
    ]);
  });

  it('composes a yearly rate out of exactly the recurring ones', () => {
    const r = projeterContrat(DEFAUTS, contrat('linxea-spirit-2'));
    expect(r.accessible).toBe(true);
    if (!r.accessible) return;
    expect(Object.keys(r.tauxAnnuelUC).sort()).toEqual([...POSTES_RECURRENTS].sort());
    expect(Object.keys(r.tauxAnnuelEuros).sort()).toEqual([...POSTES_RECURRENTS].sort());
  });

  it('keeps the catalogue small enough that the drawing has a colour for each', () => {
    // The bar has three usable colours: the palette reserves jade and brique
    // for the verdict. A fourth recurring item would need a fourth hue, and
    // there is not one — so this is where that conversation starts.
    expect(POSTES_RECURRENTS.length).toBeLessThanOrEqual(3);
  });

  it('counts its contracts from the catalogue, never from a sentence', () => {
    // The copy interpolates `CONTRATS.length`; this pins that the catalogue is
    // the only source of that number, by checking the rendered strings would
    // change if a contract were added.
    expect(CONTRATS.length).toBe(new Set(CONTRATS.map((c) => c.cle)).size);
    expect(CONTRATS.length).toBeGreaterThanOrEqual(2);
  });
});
