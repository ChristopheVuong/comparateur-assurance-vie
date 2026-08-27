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
  POSTES_RECURRENTS,
  borner,
  comparer,
  coutRachatPartiel,
  postes,
  projeterContrat,
  sommeTaux,
  totalFrais,
  totalPreleve,
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
  // The engine's own total rather than a hand-written sum. The hand-written one
  // silently dropped `provisionPerdue`, which is exactly the failure the
  // catalogue exists to prevent — a list of items that can disagree with the
  // record it claims to cover.
  const preleves = (r: ResultatAccessible) => totalFrais(r.coutsPreleves);

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

  it('leaves nothing out of the totals it splits the deductions into', () => {
    // What makes `nature` mean something: every item is a fee, a penalty or the
    // tax, and adding a fourth kind without deciding which fails here rather
    // than quietly falling out of every total.
    for (const { r } of TOUTES) {
      const tout = postes().reduce((s, p) => s + r.coutsPreleves[p], 0);
      expect(totalPreleve(r.coutsPreleves) + r.coutsPreleves.fiscalite).toBeCloseTo(tout, 6);
      expect(totalFrais(r.coutsPreleves)).toBeLessThanOrEqual(
        totalPreleve(r.coutsPreleves) + 1e-9,
      );
    }
  });

  it('keeps a forfeited reserve out of what the fees cost', () => {
    // The distinction the third nature exists for, asserted rather than
    // assumed: `sansFrais` keeps the fidelity mechanism, so the yardstick
    // forfeits the reserve too and the loss cancels. Counting it as a fee made
    // this suite fail on Afer Génération at short horizons — correctly.
    const court = sur({ horizon: 5, partUC: 0, rebalancement: 'aucun' });
    const r = projeterContrat(court, contrat('afer-generation'));
    expect(r.accessible).toBe(true);
    if (!r.accessible) return;
    expect(r.coutsPreleves.provisionPerdue).toBeGreaterThan(0);
    expect(totalPreleve(r.coutsPreleves) - totalFrais(r.coutsPreleves)).toBeCloseTo(
      r.coutsPreleves.provisionPerdue,
      6,
    );
    expect(r.coutFraisAvantImpot).toBeLessThan(r.coutsPreleves.provisionPerdue);
  });

  it('breaks the yearly rate into parts that add back up to it', () => {
    for (const { r } of TOUTES) {
      expect(sommeTaux(r.tauxAnnuelUC)).toBeCloseTo(r.fraisAnnuelsUC, 12);
      for (const p of POSTES_RECURRENTS) {
        expect(r.tauxAnnuelUC[p]).toBeGreaterThanOrEqual(0);
        expect(r.tauxAnnuelEuros[p]).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('lets inflation change what a figure means, and nothing else', () => {
    // The property that keeps inflation a lens rather than a parameter. It
    // divides the answer once, at the end, so it can move no nominal figure and
    // no ranking — and if that ever stops being true, this simulator has
    // started forecasting instead of comparing.
    const sans = comparer(sur({ inflation: 0 }));
    for (const taux of [0.02, 0.05, -0.01]) {
      const avec = comparer(sur({ inflation: taux }));
      expect(avec.map((r) => r.cle)).toEqual(sans.map((r) => r.cle));
      avec.forEach((r, i) => {
        const reference = sans[i];
        expect(r.accessible).toBe(reference.accessible);
        if (!r.accessible || !reference.accessible) return;
        expect(r.capitalNet).toBeCloseTo(reference.capitalNet, 9);
        expect(r.valeurBrute).toBeCloseTo(reference.valeurBrute, 9);
        expect(r.manqueAGagner).toBeCloseTo(reference.manqueAGagner, 9);
      });
    }
  });

  it('restates the final capital in today’s euros, and only that', () => {
    for (const { h, r } of TOUTES) {
      expect(r.capitalNetReel * (1 + h.inflation) ** h.horizon).toBeCloseTo(r.capitalNet, 6);
      // Ratios between contracts survive the division untouched — which is why
      // this figure belongs beside the headline and nowhere in the table.
      if (h.inflation > 0) expect(r.capitalNetReel).toBeLessThan(r.capitalNet);
    }
  });

  it('renews the free arbitrage allowance every year, as the contract says', () => {
    // The engine used to carry the counter across the whole horizon, so a
    // contract offering one free arbitrage *per year* got exactly one, ever.
    // Macif is the only contract in the catalogue that charges for arbitrage,
    // which is why nothing noticed.
    const macif = contrat('macif-epargne-vie');
    expect(macif.arbitrage.gratuitsParAn).toBeGreaterThanOrEqual(1);
    const r = projeterContrat(sur({ horizon: 20, partUC: 0.6, rebalancement: 'annuel' }), macif);
    expect(r.accessible).toBe(true);
    if (!r.accessible) return;
    expect(r.coutsPreleves.arbitrage).toBe(0);

    // And a contract with no free allowance is still charged.
    const payant = { ...macif, arbitrage: { gratuitsParAn: 0, taux: 0.005 } };
    const s = projeterContrat(sur({ horizon: 20, partUC: 0.6, rebalancement: 'annuel' }), payant);
    expect(s.accessible && s.coutsPreleves.arbitrage).toBeGreaterThan(0);
  });

  it('never charges the euro pocket for a unit it does not hold', () => {
    // The euro fund has no support whose ongoing charge could apply, so that
    // term is structurally zero — not merely small.
    for (const { r } of TOUTES) expect(r.tauxAnnuelEuros.support).toBe(0);
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

/**
 * The settlement, once the engine learned that a policy can end in two ways.
 *
 * These say what has to hold on *every* plan under a death, and — more useful —
 * what has to stay identical between the two branches. Everything before the
 * last day is the same plan: the same fees, on the same pockets, for the same
 * years. A difference anywhere in that stretch would mean the death branch had
 * quietly become a second simulator.
 */
describe('a death and a withdrawal are the same plan until the last day', () => {
  const paires = () =>
    GRILLE.slice(0, 24).flatMap((h) =>
      CONTRATS.map((c) => ({
        rachat: projeterContrat({ ...h, denouement: 'rachat' }, c),
        deces: projeterContrat({ ...h, denouement: 'deces' }, c),
      })),
    ).filter((p) => p.rachat.accessible && p.deces.accessible);

  it('runs the same years, fee for fee', () => {
    for (const { rachat, deces } of paires()) {
      if (!rachat.accessible || !deces.accessible) continue;
      expect(deces.annees).toEqual(rachat.annees);
      expect(deces.psPayes).toBeCloseTo(rachat.psPayes, 9);
      expect(deces.primesVersees).toBeCloseTo(rachat.primesVersees, 9);
      expect(deces.fraisAnnuelsUC).toBeCloseTo(rachat.fraisAnnuelsUC, 12);
    }
  });

  it('never charges income tax on a death', () => {
    for (const { deces } of paires()) {
      if (!deces.accessible) continue;
      expect(deces.imposition.impotRevenu).toBe(0);
      expect(deces.imposition.abattement).toBe(0);
      expect(deces.imposition.tauxApplique).toBe(0);
    }
  });

  it('reports duties on a death and nothing at all on a withdrawal', () => {
    for (const { rachat, deces } of paires()) {
      if (!rachat.accessible || !deces.accessible) continue;
      expect(rachat.succession).toBeNull();
      expect(rachat.coutsPreleves.succession).toBe(0);
      expect(deces.succession).not.toBeNull();
      expect(deces.coutsPreleves.succession).toBeCloseTo(deces.succession?.total ?? -1, 9);
    }
  });

  it('settles the same social levies either way, since a death owes them too', () => {
    for (const { rachat, deces } of paires()) {
      if (!rachat.accessible || !deces.accessible) continue;
      // Only where the reserve does not make the two gross values differ.
      if (Math.abs(deces.valeurBrute - rachat.valeurBrute) > 1e-6) continue;
      expect(deces.imposition.prelevementsSociaux).toBeCloseTo(
        rachat.imposition.prelevementsSociaux,
        6,
      );
    }
  });
});

describe('the fidelity reserve, settled by a death', () => {
  const generation = contrat('afer-generation');
  const plan = { partUC: 0, rebalancement: 'aucun' } as const;

  it('is handed over rather than forfeited, which a withdrawal cannot say', () => {
    const sept = projeterContrat(sur({ ...plan, horizon: 7, denouement: 'deces' }), generation);
    const rachete = projeterContrat(sur({ ...plan, horizon: 7, denouement: 'rachat' }), generation);
    expect(sept.accessible && rachete.accessible).toBe(true);
    if (!sept.accessible || !rachete.accessible) return;

    expect(rachete.provisionAcquise).toBe(0);
    expect(sept.provisionAcquise).toBeCloseTo(sept.provisionFin, 9);
    expect(sept.valeurBrute).toBeGreaterThan(rachete.valeurBrute);
    // And nothing was taken: a reserve handed over is not a penalty.
    expect(sept.coutsPreleves.provisionPerdue).toBe(0);
  });

  it('costs exactly the uplift the term would have paid, and not a euro more', () => {
    const r = projeterContrat(sur({ ...plan, horizon: 7, denouement: 'deces' }), generation);
    expect(r.accessible).toBe(true);
    if (!r.accessible) return;
    const provision = r.annees.at(-1)!.provisionFin;
    // The reserve is there; the 10 % is not.
    expect(r.provisionAcquise).toBeCloseTo(provision, 6);
    expect(r.provisionAcquise).toBeLessThan(provision * 1.1);
  });

  it('still pays the uplift when the term is reached, death or not', () => {
    for (const denouement of ['rachat', 'deces'] as const) {
      const r = projeterContrat(sur({ ...plan, horizon: 8, denouement }), generation);
      expect(r.accessible).toBe(true);
      if (!r.accessible) continue;
      expect(r.provisionAcquise).toBeCloseTo(r.provisionFin * 1.1, 6);
    }
  });
});

describe('what could actually be withdrawn', () => {
  it('never reports more available than the policy is worth', () => {
    for (const { r } of TOUTES) {
      for (const a of r.annees) {
        expect(a.valeurRachat).toBeLessThanOrEqual(a.valeurFin + 1e-9);
        expect(a.valeurRachat).toBeGreaterThanOrEqual(-1e-9);
        expect(a.valeurFin - a.valeurRachat).toBeCloseTo(a.provisionFin, 6);
      }
    }
  });

  it('equals the value itself on every contract without a reserve', () => {
    for (const { c, r } of TOUTES) {
      if (c.fondsEuros.some((f) => f.provisionFidelite)) continue;
      for (const a of r.annees) expect(a.valeurRachat).toBeCloseTo(a.valeurFin, 6);
    }
  });

  it('cuts the reserve in proportion, and only for what leaves the euro pocket', () => {
    const r = projeterContrat(
      sur({ horizon: 7, partUC: 0, rebalancement: 'aucun', versementInitial: 100_000 }),
      contrat('afer-generation'),
    );
    expect(r.accessible).toBe(true);
    if (!r.accessible) return;
    const a = r.annees.at(-1)!;

    const rien = coutRachatPartiel(r, 7, 0);
    expect(rien.reservePerdue).toBe(0);

    const moitie = coutRachatPartiel(r, 7, a.valeurRachat / 2);
    expect(moitie.reservePerdue).toBeCloseTo(a.provisionFin / 2, 6);
    expect(moitie.reserveConservee).toBeCloseTo(a.provisionFin / 2, 6);

    const tout = coutRachatPartiel(r, 7, a.valeurRachat);
    expect(tout.reservePerdue).toBeCloseTo(a.provisionFin, 6);
    expect(tout.manqueAuTerme).toBeCloseTo(tout.solderCouterait, 6);
  });

  it('lets a unit-linked pocket absorb the blow first, where the contract says so', () => {
    const r = projeterContrat(
      sur({ horizon: 7, partUC: 0.5, rebalancement: 'aucun', versementInitial: 100_000 }),
      contrat('afer-generation'),
    );
    expect(r.accessible).toBe(true);
    if (!r.accessible) return;
    const a = r.annees.at(-1)!;

    // Anything the units can cover leaves the reserve untouched. That is the
    // buffer, and it is the practical advice this figure exists to support.
    const petit = coutRachatPartiel(r, 7, a.pocheUCFin / 2);
    expect(petit.prisSurEuros).toBeCloseTo(0, 6);
    expect(petit.reservePerdue).toBeCloseTo(0, 6);

    const gros = coutRachatPartiel(r, 7, a.pocheUCFin + a.pocheEurosFin / 4);
    expect(gros.prisSurUnites).toBeCloseTo(a.pocheUCFin, 6);
    expect(gros.reservePerdue).toBeCloseTo(a.provisionFin / 4, 6);
  });

  it('refuses to pretend more is available than there is', () => {
    const r = projeterContrat(sur({ horizon: 5 }), contrat('linxea-spirit-2'));
    expect(r.accessible).toBe(true);
    if (!r.accessible) return;
    const trop = coutRachatPartiel(r, 5, 10_000_000);
    expect(trop.possible).toBe(false);
    expect(trop.disponible).toBeCloseTo(r.annees.at(-1)!.valeurRachat, 6);
  });
});

describe('the seventieth birthday', () => {
  const plan = (ageSouscription: number) =>
    sur({
      denouement: 'deces',
      ageSouscription,
      horizon: 10,
      partUC: 0,
      versementInitial: 10_000,
      versementProgramme: 10_000,
      periodicite: 'annuelle',
    });

  it('splits the premiums on the year, and accounts for all of them', () => {
    for (const age of [50, 65, 68, 70, 75]) {
      const r = projeterContrat(plan(age), contrat('linxea-spirit-2'));
      expect(r.accessible).toBe(true);
      if (!r.accessible || !r.succession) continue;
      expect(r.succession.partAvant70).toBeGreaterThanOrEqual(0);
      expect(r.succession.partAvant70).toBeLessThanOrEqual(1);
      expect(r.succession.capital990I + r.succession.capital757B).toBeCloseTo(
        r.valeurBrute - r.imposition.total,
        6,
      );
    }
  });

  it('puts everything under the favourable article when the pivot never arrives', () => {
    const r = projeterContrat(plan(50), contrat('linxea-spirit-2'));
    expect(r.accessible).toBe(true);
    if (r.accessible) expect(r.succession?.partAvant70).toBeCloseTo(1, 9);
  });

  it('puts nothing under it when the saver was already past seventy', () => {
    const r = projeterContrat(plan(75), contrat('linxea-spirit-2'));
    expect(r.accessible).toBe(true);
    if (r.accessible) expect(r.succession?.partAvant70).toBeCloseTo(0, 9);
  });

  it('moves more money than any fee in the catalogue does', () => {
    // The claim the whole death branch is here to make. Six years of birthday
    // against every fee schedule in the catalogue, on the same plan.
    const jeune = projeterContrat(plan(60), contrat('linxea-spirit-2'));
    const vieux = projeterContrat(plan(70), contrat('linxea-spirit-2'));
    expect(jeune.accessible && vieux.accessible).toBe(true);
    if (!jeune.accessible || !vieux.accessible) return;
    const ecartAge = jeune.capitalNet - vieux.capitalNet;

    const tous = comparer(plan(60)).filter((r): r is ResultatAccessible => r.accessible);
    const ecartContrats = tous[0].capitalNet - tous.at(-1)!.capitalNet;
    expect(ecartAge).toBeGreaterThan(Math.abs(ecartContrats));
  });
});

/**
 * The social levies, settled against the base they were charged on.
 *
 * The correction these guard was invisible for as long as income tax sat on top
 * of it: on a euro-only plan the settlement handed back 17,2 % of every levy
 * ever taken, because it compared a gain already net of those levies to the
 * gross interest they were charged on. It surfaced the day a death benefit —
 * which owes no income tax at all — started reporting a net above its own
 * gross.
 */
describe('the social levies at settlement', () => {
  it('owes nothing more when every euro of gain was already levied', () => {
    // A euro-only plan on a contract that withholds nothing on the way in and
    // locks nothing away: the yearly levies have already covered the whole
    // gain, so the settlement owes exactly zero. This used to hand back 17,2 %
    // of every levy ever taken.
    const nets = CONTRATS.filter(
      (c) =>
        c.fraisVersement.euros === 0 &&
        c.droitsAdhesion === 0 &&
        !c.fondsEuros.some((f) => f.provisionFidelite),
    );
    expect(nets.length).toBeGreaterThan(0);
    for (const denouement of ['rachat', 'deces'] as const) {
      for (const horizon of [1, 5, 8, 20, 40]) {
        for (const c of nets) {
          const r = projeterContrat(
            sur({ partUC: 0, horizon, denouement, rebalancement: 'aucun' }),
            c,
          );
          if (!r.accessible) continue;
          expect(Math.abs(r.imposition.prelevementsSociaux)).toBeLessThan(
            1e-6 * Math.max(1, r.valeurBrute),
          );
        }
      }
    }
  });

  it('hands a little back where an entry fee shrank the gain it never levied', () => {
    // Not a leftover of the defect but a real consequence of the rule: the
    // taxable gain is measured against *gross* premiums, so money withheld on
    // the way in lowers the gain without ever having been levied. The exit
    // settles the difference, and it settles it as a refund.
    const r = projeterContrat(
      sur({ partUC: 0, horizon: 20, rebalancement: 'aucun' }),
      contrat('afer-multisupport'),
    );
    expect(r.accessible).toBe(true);
    if (!r.accessible) return;
    expect(r.imposition.prelevementsSociaux).toBeLessThan(0);
    // Small, and bounded by what the entry actually cost.
    expect(-r.imposition.prelevementsSociaux).toBeLessThan(r.coutsPreleves.versement);
  });

  it('levies the fidelity reserve when it is attributed, and not before', () => {
    const r = projeterContrat(
      sur({ partUC: 0, horizon: 20, rebalancement: 'aucun' }),
      contrat('afer-generation'),
    );
    expect(r.accessible).toBe(true);
    if (!r.accessible) return;
    // Nothing was levied along the way, because nothing was acquired.
    expect(r.psPayes).toBeCloseTo(0, 9);
    // And the whole gain meets the levy at the settlement, reserve included.
    expect(r.imposition.assiettePS).toBeCloseTo(r.plusValue, 6);
    expect(r.imposition.prelevementsSociaux).toBeGreaterThan(0);
  });

  it('never hands back more than it took', () => {
    for (const { r } of TOUTES) {
      expect(r.imposition.prelevementsSociaux).toBeGreaterThanOrEqual(-r.psPayes - 1e-6);
    }
  });

  it('never settles a policy above its value by more than the levies it returns', () => {
    // What made the defect visible: a death benefit reporting a net above its
    // own gross. A refund can still put it there — legitimately — but never by
    // more than what was levied in the first place.
    const verifier = (r: ResultatAccessible) => {
      expect(r.capitalNet - r.valeurBrute).toBeLessThanOrEqual(r.psPayes + 1e-6);
    };
    for (const { r } of TOUTES) verifier(r);
    for (const h of GRILLE.slice(0, 24)) {
      for (const c of CONTRATS) {
        const r = projeterContrat({ ...h, denouement: 'deces' }, c);
        if (r.accessible) verifier(r);
      }
    }
  });
});

/**
 * The one withdrawal taken along the way.
 *
 * The first test here is the one that made the rest safe to write: a plan with
 * no withdrawal, and a plan whose withdrawal is zero, have to be the same
 * projection to the last centime. Everything else is allowed to be interesting
 * only because that one is not.
 */
describe('a withdrawal taken before the end', () => {
  const base = (sur_: Partial<Hypotheses> = {}) =>
    sur({ versementInitial: 100_000, horizon: 12, partUC: 0.3, ...sur_ });

  it('changes nothing at all when there is none to take', () => {
    for (const h of GRILLE.slice(0, 30)) {
      for (const c of CONTRATS) {
        const sans = projeterContrat(h, c);
        const zero = projeterContrat({ ...h, rachatIntermediaire: { annee: 3, montant: 0 } }, c);
        expect(zero).toEqual(sans);
      }
    }
  });

  it('is refused a year it cannot happen in, rather than silently moved', () => {
    // The closing year would claim a second yearly allowance in the same tax
    // year, and a one-year plan has nowhere to put one at all.
    expect(borner(base({ horizon: 1, rachatIntermediaire: { annee: 1, montant: 10_000 } })).rachatIntermediaire).toBeNull();
    const serre = borner(base({ horizon: 5, rachatIntermediaire: { annee: 9, montant: 10_000 } }));
    expect(serre.rachatIntermediaire?.annee).toBe(4);
  });

  it('closes the accounting identity of its own year', () => {
    for (const annee of [1, 4, 8]) {
      for (const c of CONTRATS) {
        const r = projeterContrat(
          base({ rachatIntermediaire: { annee, montant: 20_000 } }),
          c,
        );
        if (!r.accessible) continue;
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
            a.perteProvision -
            a.rachatBrut;
          expect(Math.abs(a.valeurFin - attendu)).toBeLessThan(1e-6 * Math.max(1, a.valeurFin));
        }
      }
    }
  });

  it('takes the money out once, in the year asked for', () => {
    const r = projeterContrat(base({ rachatIntermediaire: { annee: 5, montant: 20_000 } }), contrat('linxea-spirit-2'));
    expect(r.accessible).toBe(true);
    if (!r.accessible) return;
    for (const a of r.annees) expect(a.rachatBrut).toBeCloseTo(a.annee === 5 ? 20_000 : 0, 6);
  });

  it('never releases more than the policy can actually surrender', () => {
    for (const c of CONTRATS) {
      const r = projeterContrat(base({ rachatIntermediaire: { annee: 2, montant: 5_000_000 } }), c);
      if (!r.accessible) continue;
      const a = r.annees[1];
      // Everything redeemable went, and the reserve — which is not — stayed.
      expect(a.rachatBrut).toBeGreaterThan(0);
      expect(a.valeurRachat).toBeCloseTo(0, 4);
      expect(a.valeurFin).toBeCloseTo(a.provisionFin, 4);
    }
  });

  it('leaves the saver worse off than not touching it, but better off than losing it', () => {
    for (const c of CONTRATS) {
      const sans = projeterContrat(base(), c);
      const avec = projeterContrat(base({ rachatIntermediaire: { annee: 4, montant: 20_000 } }), c);
      if (!sans.accessible || !avec.accessible) continue;
      // The money taken stopped compounding, so the total is smaller…
      expect(avec.capitalNet).toBeLessThan(sans.capitalNet);
      // …but it was not lost: it is in their pocket, net of the tax withheld.
      expect(avec.capitalNet).toBeGreaterThan(sans.capitalNet - 20_000);
      expect(avec.rachatIntermediaireNet).toBeGreaterThan(0);
      expect(avec.rachatIntermediaireNet).toBeLessThanOrEqual(20_000 + 1e-6);
    }
  });

  it('lowers the premium base it still carries, without rewriting what was paid in', () => {
    const c = contrat('linxea-spirit-2');
    const sans = projeterContrat(base(), c);
    const avec = projeterContrat(base({ rachatIntermediaire: { annee: 4, montant: 20_000 } }), c);
    expect(sans.accessible && avec.accessible).toBe(true);
    if (!sans.accessible || !avec.accessible) return;
    // What the saver handed over is a matter of record and does not move.
    expect(avec.primesVersees).toBeCloseTo(sans.primesVersees, 6);
    // The tax base the policy still carries does.
    expect(avec.valeurBrute - avec.plusValue).toBeLessThan(sans.valeurBrute - sans.plusValue);
  });

  it('does not tax the same capital twice', () => {
    // Withdraw the lot in year four, then let the rump run. The settlement must
    // not tax a gain the withdrawal already settled.
    const c = contrat('linxea-spirit-2');
    const r = projeterContrat(base({ rachatIntermediaire: { annee: 4, montant: 5_000_000 } }), c);
    expect(r.accessible).toBe(true);
    if (!r.accessible) return;
    const apres = r.annees.slice(4);
    // Whatever the rump earned afterwards is all there is left to tax.
    const gagneApres = (apres.at(-1)?.valeurFin ?? 0) - (r.annees[3].valeurFin - r.annees[3].rachatBrut);
    expect(r.plusValue).toBeLessThanOrEqual(Math.max(0, gagneApres) + 1e-3);
  });

  it('grants the yearly allowance twice when the two exits fall in different years', () => {
    // The reservation the simulator used to carry as a limitation: spreading an
    // exit lets the allowance be claimed again. Eight years and more, so both
    // exits reach the favourable regime.
    const c = contrat('linxea-spirit-2');
    const plan = (rachat: Hypotheses['rachatIntermediaire']) =>
      sur({ versementInitial: 200_000, horizon: 20, partUC: 1, rendementUC: 0.07, rachatIntermediaire: rachat });
    const dun_coup = projeterContrat(plan(null), c);
    const etale = projeterContrat(plan({ annee: 10, montant: 60_000 }), c);
    expect(dun_coup.accessible && etale.accessible).toBe(true);
    if (!dun_coup.accessible || !etale.accessible) return;
    // Two allowances instead of one: the spread plan keeps more of its gain,
    // measured against what the same money would have earned untouched.
    expect(etale.annees[9].impotRachat).toBeGreaterThan(0);
    expect(dun_coup.imposition.abattement).toBeGreaterThan(0);
    expect(etale.imposition.abattement).toBeGreaterThan(0);
  });

  it('cuts the reserve only for what left the euro pocket', () => {
    const c = contrat('afer-generation');
    const plan = (montant: number) =>
      sur({ versementInitial: 100_000, horizon: 7, partUC: 0.5, rebalancement: 'aucun', rachatIntermediaire: { annee: 5, montant } });
    const temoin = projeterContrat(sur({ versementInitial: 100_000, horizon: 7, partUC: 0.5, rebalancement: 'aucun' }), c);
    expect(temoin.accessible).toBe(true);
    if (!temoin.accessible) return;
    const uc = temoin.annees[4].pocheUCFin;

    // Served from the units first, so nothing reaches the reserve.
    const abrite = projeterContrat(plan(uc / 2), c);
    if (abrite.accessible) expect(abrite.annees[4].perteProvision).toBeCloseTo(0, 6);

    // Beyond the buffer, the reserve is cut in the proportion taken from euros.
    const mordu = projeterContrat(plan(uc + temoin.annees[4].pocheEurosFin / 4), c);
    if (mordu.accessible) {
      expect(mordu.annees[4].perteProvision).toBeGreaterThan(0);
      expect(mordu.coutsPreleves.provisionPerdue).toBeGreaterThan(0);
    }
  });
});
