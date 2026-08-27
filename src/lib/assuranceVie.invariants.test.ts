/**
 * The engine, checked against itself on an exhaustive grid.
 *
 * The worked examples in `assuranceVie.test.ts` say what the answer should be
 * on a handful of plans. These say what has to hold on *every* plan, which is
 * the only way to catch the class of bug that hides in a corner nobody looked
 * at — a hundred-per-cent allocation, a one-year horizon, a market that fell.
 */

import { describe, expect, it } from 'vitest';
import {
  DEFAUTS,
  borner,
  comparer,
  projeterContrat,
  type Hypotheses,
  type ResultatAccessible,
} from './assuranceVie';
import { CONTRATS, contrat, sansFrais, type Contrat } from './contrats';
import { support } from './supports';

const sur = (modifications: Partial<Hypotheses> = {}): Hypotheses => ({
  ...DEFAUTS,
  versementInitial: 50_000,
  ...modifications,
});

const GRILLE: Hypotheses[] = [];
for (const partUC of [0, 0.2, 0.5, 0.6, 0.8, 1]) {
  for (const horizon of [1, 5, 8, 12, 20, 40]) {
    for (const rendementUC of [-0.05, 0, 0.07, 0.15]) {
      for (const rebalancement of ['aucun', 'versements', 'annuel'] as const) {
        GRILLE.push(sur({ partUC, horizon, rendementUC, rebalancement }));
      }
    }
  }
}

/** Every accessible projection on the grid, across every contract. */
function toutes(): { h: Hypotheses; c: Contrat; r: ResultatAccessible }[] {
  const sortie: { h: Hypotheses; c: Contrat; r: ResultatAccessible }[] = [];
  for (const h of GRILLE) {
    for (const c of CONTRATS) {
      const r = projeterContrat(h, c);
      if (r.accessible) sortie.push({ h, c, r });
    }
  }
  return sortie;
}

const TOUTES = toutes();

describe('the accounting identity of a year', () => {
  it('closes, on every year of every plan', () => {
    for (const { r } of TOUTES) {
      for (const a of r.annees) {
        const attendu =
          a.valeurDebut +
          a.versementsBruts -
          a.fraisVersement +
          a.gainsBruts -
          a.fraisGestionContrat -
          a.fraisSupport -
          a.fraisEncours -
          a.prelevementsSociaux -
          a.fraisArbitrage -
          a.perteProvision;
        expect(Math.abs(a.valeurFin - attendu)).toBeLessThan(1e-6 * Math.max(1, a.valeurFin));
      }
    }
  });

  it('carries each year into the next without losing anything on the way', () => {
    for (const { r } of TOUTES) {
      for (let i = 1; i < r.annees.length; i++) {
        expect(r.annees[i].valeurDebut).toBeCloseTo(r.annees[i - 1].valeurFin, 6);
        expect(r.annees[i].pocheEurosDebut).toBeCloseTo(r.annees[i - 1].pocheEurosFin, 6);
        expect(r.annees[i].pocheUCDebut).toBeCloseTo(r.annees[i - 1].pocheUCFin, 6);
      }
    }
  });

  it('runs for exactly as many years as the horizon asks, from one to forty', () => {
    for (const horizon of [1, 2, 3, 7, 8, 9, 20, 39, 40]) {
      const r = projeterContrat(sur({ horizon }), contrat('linxea-spirit-2'));
      expect(r.accessible && r.annees.length).toBe(horizon);
    }
  });

  it('never lets a pocket, a provision or a premium count go negative', () => {
    for (const { r } of TOUTES) {
      for (const a of r.annees) {
        expect(a.pocheEurosFin).toBeGreaterThanOrEqual(-1e-9);
        expect(a.pocheUCFin).toBeGreaterThanOrEqual(-1e-9);
        expect(a.provisionFin).toBeGreaterThanOrEqual(-1e-9);
        expect(a.primesCumulees).toBeGreaterThan(0);
      }
    }
  });

  it('accumulates premiums strictly, and to the closed-form total', () => {
    for (const { h, r } of TOUTES) {
      for (let i = 1; i < r.annees.length; i++) {
        expect(r.annees[i].primesCumulees).toBeGreaterThan(r.annees[i - 1].primesCumulees);
      }
      const echeances = h.periodicite === 'mensuelle' ? 12 : 0;
      let attendu = h.versementInitial;
      for (let n = 1; n <= h.horizon; n++) {
        attendu += h.versementProgramme * echeances * (1 + h.revalorisationVersements) ** (n - 1);
      }
      expect(r.primesVersees).toBeCloseTo(attendu, 6);
    }
  });

  it('produces a finite number everywhere, never a NaN', () => {
    for (const { r } of TOUTES) {
      for (const valeur of [r.capitalNet, r.valeurBrute, r.plusValue, r.manqueAGagner]) {
        expect(Number.isFinite(valeur)).toBe(true);
      }
    }
  });
});

describe('what fees cost', () => {
  const preleves = (r: ResultatAccessible) =>
    r.coutsPreleves.versement +
    r.coutsPreleves.adhesion +
    r.coutsPreleves.gestionContrat +
    r.coutsPreleves.support +
    r.coutsPreleves.encours +
    r.coutsPreleves.arbitrage;

  it('never leaves a contract better off than the same contract with no fees', () => {
    for (const { r } of TOUTES) {
      expect(r.capitalNet).toBeLessThanOrEqual(r.capitalNetSansFrais + 1e-6);
      expect(r.manqueAGagner).toBeGreaterThanOrEqual(-1e-6);
      expect(r.coutFraisAvantImpot).toBeGreaterThanOrEqual(-1e-6);
    }
  });

  it('costs, before tax, more than what was deducted — compounding, backwards', () => {
    // Only asserted on a rising market, and the exception is real rather than a
    // tolerance: when returns are negative, money the insurer took early is
    // money that never went on to lose value, so the fee-free path ends up
    // further behind than the charges alone. Fees are a small consolation in a
    // crash, which is not an argument for paying them.
    for (const { h, r } of TOUTES) {
      if (h.rendementUC < 0) continue;
      const somme = preleves(r);
      if (somme > 1) expect(r.coutFraisAvantImpot).toBeGreaterThan(somme * 0.999);
    }
  });

  it('reconciles: what was deducted, plus the lost return, less the tax saved', () => {
    // The breakdown the detail panel prints, line for line. A financial figure
    // whose parts do not add back up to the total is worse than no breakdown,
    // so the arithmetic is pinned here rather than trusted to the component.
    for (const { r } of TOUTES) {
      const rendementPerdu = r.coutFraisAvantImpot - preleves(r);
      const impotEpargne = r.coutFraisAvantImpot - r.manqueAGagner;
      expect(preleves(r) + rendementPerdu - impotEpargne).toBeCloseTo(r.manqueAGagner, 6);
    }
  });

  it('costs the saver less than that once tax has had its say', () => {
    // Worth asserting rather than assuming: a euro the insurer takes is a euro
    // the taxman never taxes, so part of every charge comes back through a
    // smaller gain. The two measures exist precisely so that neither claim has
    // to be fudged into the other.
    for (const { r } of TOUTES) {
      if (r.plusValue <= 0 || r.coutFraisAvantImpot < 1) continue;
      expect(r.manqueAGagner).toBeLessThanOrEqual(r.coutFraisAvantImpot + 1e-6);
    }
  });

  it('falls when a management fee rises, all else held equal', () => {
    const base = contrat('linxea-spirit-2');
    const h = sur({ horizon: 20, partUC: 0.6 });
    let precedent = Infinity;
    for (const uc of [0.002, 0.005, 0.0075, 0.012]) {
      const r = projeterContrat(h, { ...base, fraisGestion: { ...base.fraisGestion, uc } });
      expect(r.accessible).toBe(true);
      if (r.accessible) {
        expect(r.capitalNet).toBeLessThan(precedent);
        precedent = r.capitalNet;
      }
    }
  });

  it('falls when the fund’s own charge rises, all else held equal', () => {
    const h = sur({ horizon: 20, partUC: 1 });
    const avecETF = projeterContrat(h, contrat('linxea-spirit-2'));
    const avecOPCVM = projeterContrat(h, {
      ...contrat('linxea-spirit-2'),
      supports: ['opcvm-actions-retrocession'],
    });
    expect(avecETF.accessible && avecOPCVM.accessible).toBe(true);
    if (avecETF.accessible && avecOPCVM.accessible) {
      expect(avecOPCVM.capitalNet).toBeLessThan(avecETF.capitalNet);
    }
  });

  it('falls when an entry fee rises, all else held equal', () => {
    const base = contrat('macif-epargne-vie');
    const h = sur({ horizon: 10, partUC: 0.5 });
    const sans = projeterContrat(h, base);
    const avec = projeterContrat(h, {
      ...base,
      fraisVersement: { euros: 0.025, uc: 0.025 },
    });
    expect(sans.accessible && avec.accessible).toBe(true);
    if (sans.accessible && avec.accessible) {
      expect(avec.capitalNet).toBeLessThan(sans.capitalNet);
    }
  });

  it('charges none of the contract’s own fees once they are stripped', () => {
    for (const c of CONTRATS) {
      const r = projeterContrat(sur({ horizon: 10 }), sansFrais(c));
      if (!r.accessible) continue;
      for (const poste of [
        'versement',
        'adhesion',
        'gestionContrat',
        'encours',
        'arbitrage',
      ] as const) {
        expect(r.coutsPreleves[poste]).toBeCloseTo(0, 6);
      }
      // The fund's own charge survives, and must: it belongs to the support,
      // not to the wrapper. That is exactly why the yardstick zeroes it
      // separately instead of relying on `sansFrais`.
      if (c.supports.some((s) => support(s).ter > 0)) {
        expect(r.coutsPreleves.support).toBeGreaterThan(0);
      }
    }
  });
});

describe('the degenerate allocations', () => {
  it('holds nothing in units at zero per cent, whatever the unit market does', () => {
    const h = (rendementUC: number, ter: number) =>
      projeterContrat(sur({ partUC: 0, horizon: 20, rendementUC }), {
        ...contrat('linxea-spirit-2'),
        supports: ter > 0 ? ['opcvm-actions-retrocession'] : ['etf-actions-monde'],
        fraisGestion: { euros: 0, uc: ter },
      });

    const reference = h(0.07, 0);
    for (const [rdt, ter] of [
      [-0.05, 0],
      [0.15, 0],
      [0.07, 0.03],
      [-0.05, 0.03],
    ] as const) {
      const r = h(rdt, ter);
      expect(r.accessible && reference.accessible).toBe(true);
      if (r.accessible && reference.accessible) {
        // The single most likely leak in the engine: unit-linked parameters
        // bleeding into a plan that holds no units at all.
        expect(r.capitalNet).toBeCloseTo(reference.capitalNet, 6);
      }
    }

    for (const { h: plan, r } of TOUTES) {
      if (plan.partUC !== 0) continue;
      for (const a of r.annees) expect(a.pocheUCFin).toBeCloseTo(0, 9);
    }
  });

  it('holds nothing in euros at a hundred per cent, and pays no yearly levy', () => {
    for (const { h, r } of TOUTES) {
      if (h.partUC !== 1) continue;
      for (const a of r.annees) expect(a.pocheEurosFin).toBeCloseTo(0, 9);
      expect(r.psPayes).toBeCloseTo(0, 9);
    }
  });

  it('ignores the euro rate and its scale entirely at a hundred per cent', () => {
    const h = sur({ partUC: 1, horizon: 20 });
    const base = contrat('boursovie');
    const trafique = {
      ...base,
      fondsEuros: [{ ...base.fondsEuros[0], historique: [{ annee: 2025, taux: 0.09 }] }],
    };
    const a = projeterContrat(h, base);
    const b = projeterContrat(h, trafique);
    expect(a.accessible && b.accessible).toBe(true);
    if (a.accessible && b.accessible) expect(a.capitalNet).toBeCloseTo(b.capitalNet, 6);
  });
});

describe('the degenerate plans', () => {
  it('drops every contract when nothing is ever paid in, and says why', () => {
    const r = comparer(sur({ versementInitial: 0, versementProgramme: 0 }));
    expect(r).toHaveLength(CONTRATS.length);
    for (const x of r) {
      expect(x.accessible).toBe(false);
      if (!x.accessible) expect(x.motif).toBe('ticket-insuffisant');
    }
  });

  it('drops a contract whose ticket is out of reach, rather than pretending', () => {
    const r = projeterContrat(sur({ versementInitial: 100 }), contrat('afer-generation'));
    expect(r.accessible).toBe(false);
    if (!r.accessible) expect(r.motif).toBe('ticket-insuffisant');
  });

  it('drops a contract that does not sell the asset class asked for', () => {
    const r = projeterContrat(sur({ classeUC: 'immobilier', partUC: 0.5 }), contrat('afer-generation'));
    expect(r.accessible).toBe(false);
    if (!r.accessible) expect(r.motif).toBe('classe-indisponible');
  });

  it('grants no allowance and charges the ordinary rate under eight years', () => {
    for (const { h, r } of TOUTES) {
      if (h.horizon >= 8) continue;
      expect(r.imposition.abattement).toBe(0);
      expect(r.imposition.tauxApplique).toBeCloseTo(0.128, 9);
    }
  });

  it('never turns a flat market into a profit', () => {
    const plat = {
      ...contrat('linxea-spirit-2'),
      fondsEuros: [
        { ...contrat('linxea-spirit-2').fondsEuros[0], historique: [{ annee: 2025, taux: 0 }] },
      ],
    };
    for (const partUC of [0, 0.5, 1]) {
      const r = projeterContrat(sur({ rendementUC: 0, partUC, horizon: 20 }), plat);
      expect(r.accessible).toBe(true);
      if (r.accessible) expect(r.capitalNet).toBeLessThanOrEqual(r.primesVersees + 1e-6);
    }
  });

  it('taxes nothing when the policy ends under water', () => {
    for (const { r } of TOUTES) {
      if (r.plusValue >= 0) continue;
      expect(r.imposition.impotRevenu).toBe(0);
      expect(r.imposition.prelevementsSociaux).toBeLessThanOrEqual(1e-9);
    }
  });
});

describe('the fidelity provision', () => {
  const generation = contrat('afer-generation');

  it('is worth more at eight years than at seven, despite the extra year', () => {
    // The test that proves the mechanism is modelled at all: one year *more* of
    // saving normally means more capital, and here the eighth year is worth a
    // discontinuity because it is the year the reserve becomes yours.
    const sept = projeterContrat(sur({ horizon: 7, partUC: 0, rebalancement: 'aucun' }), generation);
    const huit = projeterContrat(sur({ horizon: 8, partUC: 0, rebalancement: 'aucun' }), generation);
    expect(sept.accessible && huit.accessible).toBe(true);
    if (sept.accessible && huit.accessible) {
      expect(huit.capitalNet).toBeGreaterThan(sept.capitalNet);
      // And the seventh-year figure has to be below what was paid in plus
      // nothing: the reserve is forfeited entirely.
      expect(sept.annees.at(-1)!.provisionFin).toBeGreaterThan(0);
      expect(sept.valeurBrute).toBeLessThan(sept.annees.at(-1)!.valeurFin);
    }
  });

  it('is not levied yearly, because it is not yours yet', () => {
    const r = projeterContrat(sur({ horizon: 7, partUC: 0, rebalancement: 'aucun' }), generation);
    expect(r.accessible).toBe(true);
    if (r.accessible) expect(r.psPayes).toBeCloseTo(0, 9);
  });
});

describe('purity and bounds', () => {
  it('leaves the hypotheses it was handed untouched', () => {
    const h = sur({ partUC: 0.42 });
    const copie = structuredClone(h);
    comparer(h);
    projeterContrat(h, contrat('afer-multisupport'));
    expect(h).toEqual(copie);
  });

  it('answers the same thing twice', () => {
    const h = sur({ horizon: 17, partUC: 0.33 });
    const a = projeterContrat(h, contrat('fortuneo-vie'));
    const b = projeterContrat(h, contrat('fortuneo-vie'));
    expect(a).toEqual(b);
  });

  it('is idempotent, so clamping never drifts', () => {
    for (const h of GRILLE) expect(borner(borner(h))).toEqual(borner(h));
  });

  it('clamps nonsense instead of propagating it', () => {
    const h = borner({
      ...DEFAUTS,
      versementInitial: Number.NaN,
      horizon: 1_000,
      partUC: 4,
      rendementUC: -3,
      // @ts-expect-error deliberately outside the union
      classeUC: 'inexistante',
      // @ts-expect-error deliberately outside the union
      foyer: 'inexistant',
    });
    expect(h.versementInitial).toBe(0);
    expect(h.horizon).toBe(40);
    expect(h.partUC).toBe(1);
    expect(h.rendementUC).toBe(-0.05);
    expect(h.classeUC).toBe('actions-monde');
    expect(h.foyer).toBe('seul');
  });
});
