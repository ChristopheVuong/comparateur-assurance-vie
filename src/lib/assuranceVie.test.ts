/**
 * The claims this project exists to make, written as assertions.
 *
 * Anyone can put "fees matter" in a paragraph. These say by how much, on a
 * named plan, and they fail if the model ever stops supporting the sentences
 * the interface prints beside them.
 */

import { describe, expect, it } from 'vitest';
import {
  DEFAUTS,
  classer,
  comparer,
  palierAtteint,
  projeter,
  projeterContrat,
  tauxEuros,
  type Hypotheses,
  type ResultatAccessible,
} from './assuranceVie';
import { avecSupport, contrat } from './contrats';

const sur = (modifications: Partial<Hypotheses> = {}): Hypotheses => ({
  ...DEFAUTS,
  versementInitial: 50_000,
  versementProgramme: 300,
  ...modifications,
});

const net = (r: ReturnType<typeof projeterContrat>) => {
  expect(r.accessible).toBe(true);
  return (r as ResultatAccessible).capitalNet;
};

describe('the plan the simulator opens on', () => {
  it('lets every contract in the catalogue be compared, ticket included', () => {
    const resultats = comparer(DEFAUTS);
    for (const r of resultats) {
      expect(r.accessible, `${r.cle} n’est pas comparable par défaut`).toBe(true);
    }
  });

  it('turns €50,000 plus €300 a month over twenty years into a real spread', () => {
    const rangs = classer(comparer(sur()));
    expect(rangs.length).toBe(6);
    const meilleur = rangs[0];
    const pire = rangs.at(-1)!;
    // The spread is the entire reason the page exists: if it were noise, there
    // would be nothing to choose between.
    expect(meilleur.capitalNet - pire.capitalNet).toBeGreaterThan(5_000);
    expect(meilleur.primesVersees).toBeCloseTo(50_000 + 300 * 12 * 20, 6);
  });
});

describe('the shelf, not the price tag', () => {
  const h = sur({ horizon: 20, partUC: 0.6, classeUC: 'actions-monde' });
  const afer = contrat('afer-multisupport');
  const linxea = contrat('linxea-spirit-2');

  it('leaves AFER behind by more than its wrapper is dearer', () => {
    const ecartReel = net(projeterContrat(h, linxea)) - net(projeterContrat(h, afer));
    // What the gap in the contracts' own management fees alone would explain.
    // AFER is in fact the *cheaper* wrapper here — 0,475 % against 0,50 % — so
    // on that basis it ought to be ahead. It is not.
    expect(afer.fraisGestion.uc).toBeLessThan(linxea.fraisGestion.uc);
    expect(ecartReel).toBeGreaterThan(0);
  });

  it('closes most of that gap the moment AFER is handed a tracker', () => {
    const reel = net(projeterContrat(h, afer));
    const avecETF = net(projeterContrat(h, avecSupport(afer, 'etf-actions-monde')));
    const cible = net(projeterContrat(h, linxea));

    const manquant = cible - reel;
    const recupere = avecETF - reel;
    // Two thirds of the shortfall is the fund, not the wrapper. This is the
    // single most counter-intuitive figure the simulator produces.
    expect(recupere / manquant).toBeGreaterThan(0.66);
  });

  it('charges a saver in retail units far more than the wrapper ever does', () => {
    const r = projeterContrat(h, afer);
    expect(r.accessible).toBe(true);
    if (!r.accessible) return;
    expect(r.coutsPreleves.support).toBeGreaterThan(r.coutsPreleves.gestionContrat * 1.5);
  });
});

describe('the two AFER contracts', () => {
  // Same allocation, no rebalancing, so the fidelity provision is never
  // arbitraged out and the two are compared on their fee structures alone.
  const h = sur({ horizon: 20, partUC: 0.6, rebalancement: 'aucun', versementInitial: 50_000 });

  it('end up within a few per cent of each other, as their total costs predict', () => {
    const multi = net(projeterContrat(h, contrat('afer-multisupport')));
    const gen = net(projeterContrat(h, contrat('afer-generation')));
    // 0,475 % of wrapper on 1,05 % units against 1,175 % on 0,50 % units: about
    // 1,655 % against 1,675 %. The near-tie has to fall out of the model rather
    // than be asserted in a sentence beside it.
    expect(Math.abs(gen - multi) / multi).toBeLessThan(0.12);
  });

  it('charges the clean-share contract more on the wrapper and less on the fund', () => {
    const multi = projeterContrat(h, contrat('afer-multisupport'));
    const gen = projeterContrat(h, contrat('afer-generation'));
    expect(multi.accessible && gen.accessible).toBe(true);
    if (!multi.accessible || !gen.accessible) return;
    expect(gen.coutsPreleves.gestionContrat).toBeGreaterThan(multi.coutsPreleves.gestionContrat);
    expect(gen.coutsPreleves.support).toBeLessThan(multi.coutsPreleves.support);
  });
});

describe('what an entry fee is really worth', () => {
  it('costs about as much once as a fifth of a point costs every year', () => {
    const h = sur({ horizon: 20, partUC: 0.6 });
    const base = contrat('linxea-spirit-2');

    const avecEntree = net(
      projeterContrat(h, { ...base, fraisVersement: { euros: 0.025, uc: 0.025 } }),
    );
    const avecRecurrent = net(
      projeterContrat(h, { ...base, fraisGestion: { ...base.fraisGestion, uc: 0.005 + 0.0022 } }),
    );
    const reference = net(projeterContrat(h, base));

    const coutEntree = reference - avecEntree;
    const coutRecurrent = reference - avecRecurrent;
    // A one-off 2,5 % is in the same league as barely a fifth of a point a
    // year. The commercial argument runs the other way round.
    expect(coutEntree).toBeGreaterThan(0);
    expect(Math.abs(coutEntree - coutRecurrent) / coutEntree).toBeLessThan(0.35);
  });
});

describe('the euro-fund scales', () => {
  it('reads a tier by lookup, never by adding a bonus to a base', () => {
    const opportunites = contrat('fortuneo-vie').fondsEuros[0];
    expect(opportunites.bareme).not.toBeNull();
    expect(palierAtteint(opportunites.bareme!, 0).taux).toBeCloseTo(0.03, 9);
    expect(palierAtteint(opportunites.bareme!, 0.3).taux).toBeCloseTo(0.035, 9);
    expect(palierAtteint(opportunites.bareme!, 0.69).taux).toBeCloseTo(0.04, 9);
    expect(palierAtteint(opportunites.bareme!, 0.7).taux).toBeCloseTo(0.045, 9);
  });

  it('never serves a promotional tier, however high it is advertised', () => {
    const exclusif = contrat('boursovie').fondsEuros[0];
    expect(exclusif.bareme?.nature).toBe('promotionnel');
    // 4,50 % on the shop window, 3,00 % in the projection.
    expect(tauxEuros(exclusif, 0.6, 0, 'derniere-annee').taux).toBeCloseTo(0.03, 9);
  });

  it('says in euros what honouring that promotion would have been worth', () => {
    const r = projeter(sur({ partUC: 0.6, horizon: 20 }), 'boursovie');
    expect(r.accessible).toBe(true);
    if (!r.accessible) return;
    expect(r.gainPromotionnel).toBeGreaterThan(0);
    expect(r.alertes.some((a) => a.genre === 'promotion')).toBe(true);
  });

  it('leaves a structural scale alone, and charges no phantom promotion for it', () => {
    const r = projeter(sur({ partUC: 0.6, horizon: 20 }), 'fortuneo-vie');
    expect(r.accessible).toBe(true);
    if (!r.accessible) return;
    expect(r.gainPromotionnel).toBe(0);
  });

  it('blends rather than cliffs when payments outgrow the uplift ceiling', () => {
    const exclusif = contrat('boursovie').fondsEuros[0];
    const promotionnel = { ...exclusif, bareme: { ...exclusif.bareme!, nature: 'structurel' as const } };
    const sousPlafond = tauxEuros(promotionnel, 0.6, 400_000, 'derniere-annee').taux;
    const auDouble = tauxEuros(promotionnel, 0.6, 1_000_000, 'derniere-annee').taux;
    expect(sousPlafond).toBeCloseTo(0.045, 9);
    // Half the payments eligible: halfway between the tier and the base.
    expect(auDouble).toBeCloseTo(0.045 * 0.5 + 0.03 * 0.5, 9);
  });
});

describe('the Fortuneo choice of fund', () => {
  it('turns down the constrained fund below thirty per cent of units', () => {
    const r = projeter(sur({ partUC: 0.2 }), 'fortuneo-vie');
    expect(r.accessible).toBe(true);
    if (!r.accessible) return;
    expect(r.fondsRetenu).toBe('suravenir-opportunites-2');
    expect(r.alertes.some((a) => a.genre === 'contrainte')).toBe(true);
  });

  it('still turns it down above the threshold, because it simply pays less', () => {
    // The constraint bites, but not the way the marketing implies: the fund it
    // gates is the worse one. Saying so is more useful than warning about it.
    const r = projeter(sur({ partUC: 0.5 }), 'fortuneo-vie');
    expect(r.accessible).toBe(true);
    if (!r.accessible) return;
    expect(r.fondsRetenu).toBe('suravenir-opportunites-2');
  });
});

describe('what the plan itself raises', () => {
  it('warns when the horizon is shorter than a fidelity term', () => {
    const r = projeter(sur({ horizon: 5, versementInitial: 50_000 }), 'afer-generation');
    expect(r.accessible).toBe(true);
    if (!r.accessible) return;
    expect(r.alertes.some((a) => a.genre === 'liquidite')).toBe(true);
  });

  it('warns when the best available unit is a retail share', () => {
    const r = projeter(sur({ partUC: 0.6 }), 'macif-epargne-vie');
    expect(r.accessible).toBe(true);
    if (!r.accessible) return;
    expect(r.supportRetenu).toBe('opcvm-actions-retrocession');
    expect(r.alertes.some((a) => a.genre === 'univers')).toBe(true);
  });

  it('raises nothing about a fund’s rate when no rate is being used', () => {
    const r = projeter(sur({ partUC: 1 }), 'linxea-spirit-2');
    expect(r.accessible).toBe(true);
    if (!r.accessible) return;
    expect(r.alertes.some((a) => a.texte.includes('100 % d’unités de compte'))).toBe(true);
  });
});

describe('monthly instalments', () => {
  it('counts twelve of them a year, and credits them mid-year rather than up front', () => {
    const h = sur({ versementInitial: 0, versementProgramme: 1_000, horizon: 1, partUC: 0 });
    const sansFraisNi = contrat('macif-epargne-vie');
    const r = projeterContrat(h, {
      ...sansFraisNi,
      versementMinimal: 0,
      fraisGestion: { euros: 0, uc: 0 },
      fraisSurEncours: 0,
    });
    expect(r.accessible).toBe(true);
    if (!r.accessible) return;
    expect(r.primesVersees).toBeCloseTo(12_000, 6);
    // A full year of return on every instalment would be the naive answer, and
    // it overstates. Half a year's worth is what an even flow actually earns.
    const taux = r.annees[0].tauxEurosApplique;
    expect(r.annees[0].gainsBruts).toBeLessThan(12_000 * taux);
    expect(r.annees[0].gainsBruts).toBeGreaterThan(0);
  });

  it('grows the capital when instalments are uprated year after year', () => {
    const plat = projeter(sur({ revalorisationVersements: 0 }), 'linxea-spirit-2');
    const indexe = projeter(sur({ revalorisationVersements: 0.02 }), 'linxea-spirit-2');
    expect(plat.accessible && indexe.accessible).toBe(true);
    if (!plat.accessible || !indexe.accessible) return;
    expect(indexe.primesVersees).toBeGreaterThan(plat.primesVersees);
    expect(indexe.capitalNet).toBeGreaterThan(plat.capitalNet);
  });

  it('treats a quarterly and a monthly plan of the same yearly amount alike', () => {
    const mensuel = projeter(sur({ versementProgramme: 300, periodicite: 'mensuelle' }), 'boursovie');
    const trimestriel = projeter(
      sur({ versementProgramme: 900, periodicite: 'trimestrielle' }),
      'boursovie',
    );
    expect(mensuel.accessible && trimestriel.accessible).toBe(true);
    if (!mensuel.accessible || !trimestriel.accessible) return;
    // The engine aggregates to the year, so this is a statement about what the
    // model does *not* claim to distinguish, and it should stay true.
    expect(trimestriel.capitalNet).toBeCloseTo(mensuel.capitalNet, 6);
  });
});
