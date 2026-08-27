import { describe, expect, it } from 'vitest';
import {
  CONTRATS,
  CONTRAT_PAR_DEFAUT,
  DATE_RELEVE,
  TICKET_MAXIMAL,
  TOUS_FONDS,
  avecPromotion,
  avecSupport,
  contrat,
  estCleContrat,
  fondsEuros,
  promotionExpiree,
  sansFrais,
  sansPromotion,
  tauxDeBase,
} from './contrats';
import { SUPPORTS, estCleSupport, meilleurSupport, support } from './supports';

describe('the catalogue of supports', () => {
  it('gives every support a key of its own', () => {
    const cles = SUPPORTS.map((s) => s.cle);
    expect(new Set(cles).size).toBe(cles.length);
  });

  it('keeps every ongoing charge inside a plausible range', () => {
    for (const s of SUPPORTS) {
      expect(s.ter).toBeGreaterThanOrEqual(0);
      expect(s.ter).toBeLessThan(0.03);
    }
  });

  it('explains itself: no support ships without a note worth reading', () => {
    for (const s of SUPPORTS) expect(s.note.length).toBeGreaterThan(40);
  });

  it('holds the central lesson in the data: a tracker beats every retail unit', () => {
    // Not a stylistic check. If this ever fails, the comparison stops meaning
    // what the whole project claims it means.
    const etf = support('etf-actions-monde').ter;
    for (const s of SUPPORTS.filter((x) => x.partage === 'retrocession')) {
      expect(etf).toBeLessThan(s.ter);
    }
  });

  it('returns the cheapest unit of the class asked for', () => {
    const trouve = meilleurSupport(
      ['opcvm-actions-retrocession', 'etf-actions-monde', 'opcvm-actions-clean'],
      'actions-monde',
    );
    expect(trouve?.cle).toBe('etf-actions-monde');
  });

  it('returns nothing rather than a neighbour when the class is absent', () => {
    expect(meilleurSupport(['opcvm-actions-retrocession'], 'immobilier')).toBeNull();
  });

  it('falls back rather than throwing on a key it does not know', () => {
    // @ts-expect-error deliberately outside the union
    expect(support('inexistant')).toBe(SUPPORTS[0]);
    expect(estCleSupport('inexistant')).toBe(false);
  });
});

describe('the catalogue of contracts', () => {
  it('gives every contract and every euro fund a key of its own', () => {
    const cles = CONTRATS.map((c) => c.cle);
    expect(new Set(cles).size).toBe(cles.length);
    // TOUS_FONDS is flattened across contracts, so a fund shared by two of them
    // appears twice — legitimately. What must not happen is two *different*
    // funds under one key: `fondsEuros(cle)` does a `.find()` and would hand
    // back the wrong one, silently. So: same key implies same object.
    const parCle = new Map<string, (typeof TOUS_FONDS)[number]>();
    for (const f of TOUS_FONDS) {
      const vu = parCle.get(f.cle);
      if (vu) expect(f, `deux fonds différents sous la clé ${f.cle}`).toBe(vu);
      else parCle.set(f.cle, f);
    }
  });

  it('keeps every fee rate inside a plausible range', () => {
    for (const c of CONTRATS) {
      for (const taux of [
        c.fraisVersement.euros,
        c.fraisVersement.uc,
        c.fraisGestion.euros,
        c.fraisGestion.uc,
        c.fraisSurEncours,
        c.fraisOperationETF,
      ]) {
        expect(taux).toBeGreaterThanOrEqual(0);
        expect(taux).toBeLessThanOrEqual(0.05);
      }
      expect(c.versementMinimal).toBeGreaterThan(0);
      expect(c.droitsAdhesion).toBeGreaterThanOrEqual(0);
    }
  });

  it('offers at least one euro fund and one support per contract', () => {
    for (const c of CONTRATS) {
      expect(c.fondsEuros.length).toBeGreaterThan(0);
      expect(c.supports.length).toBeGreaterThan(0);
      expect(new Set(c.supports).size).toBe(c.supports.length);
      for (const cle of c.supports) expect(estCleSupport(cle)).toBe(true);
    }
  });

  it('explains itself: notes and reservations are sentences, not labels', () => {
    for (const c of CONTRATS) {
      expect(c.note.length).toBeGreaterThan(40);
      for (const r of c.reserves) expect(r.texte.length).toBeGreaterThan(40);
    }
  });

  it('cites where each figure was read, and when', () => {
    for (const c of CONTRATS) {
      expect(c.sources.length).toBeGreaterThan(0);
      for (const s of c.sources) {
        expect(s.url).toMatch(/^https:\/\//);
        expect(s.libelle.length).toBeGreaterThan(5);
        // Data cannot have been read from the future, and a reading date later
        // than the survey means the catalogue was edited without being resurveyed.
        expect(s.consulteLe <= DATE_RELEVE).toBe(true);
      }
    }
  });

  it('composes the largest ticket rather than hard-coding it', () => {
    expect(TICKET_MAXIMAL).toBe(Math.max(...CONTRATS.map((c) => c.versementMinimal)));
    expect(CONTRATS.filter((c) => c.versementMinimal <= TICKET_MAXIMAL)).toHaveLength(
      CONTRATS.length,
    );
  });

  it('points its default at a contract that exists', () => {
    expect(estCleContrat(CONTRAT_PAR_DEFAUT)).toBe(true);
    expect(contrat(CONTRAT_PAR_DEFAUT).cle).toBe(CONTRAT_PAR_DEFAUT);
  });

  it('falls back rather than throwing on a key it does not know', () => {
    // @ts-expect-error deliberately outside the union
    expect(contrat('inexistant')).toBe(CONTRATS[0]);
    // @ts-expect-error deliberately outside the union
    expect(fondsEuros('inexistant')).toBeNull();
  });
});

describe('the euro funds', () => {
  it('orders every scale by increasing UC share, starting at zero', () => {
    for (const f of TOUS_FONDS) {
      if (!f.bareme) continue;
      expect(f.bareme.paliers[0].partUCMinimale).toBe(0);
      for (let i = 1; i < f.bareme.paliers.length; i++) {
        expect(f.bareme.paliers[i].partUCMinimale).toBeGreaterThan(
          f.bareme.paliers[i - 1].partUCMinimale,
        );
        expect(f.bareme.paliers[i].taux).toBeGreaterThanOrEqual(f.bareme.paliers[i - 1].taux);
      }
    }
  });

  it('records the base tier as the published rate, never the uplifted one', () => {
    for (const f of TOUS_FONDS) {
      const dernier = f.historique.at(-1);
      expect(dernier).toBeDefined();
      expect(tauxDeBase(f)).toBeCloseTo(dernier!.taux, 9);
    }
  });

  it('keeps histories sorted, gapless and inside a plausible range', () => {
    for (const f of TOUS_FONDS) {
      expect(f.historique.length).toBeGreaterThan(0);
      f.historique.forEach((h, i) => {
        expect(h.taux).toBeGreaterThan(-0.02);
        expect(h.taux).toBeLessThan(0.1);
        expect(h.annee).toBeLessThanOrEqual(2025);
        if (i > 0) expect(h.annee).toBe(f.historique[i - 1].annee + 1);
      });
    }
  });

  it('dates the end of every campaign, and never dates a tariff', () => {
    // An offer with no end date is not an offer, it is a tariff — and a
    // catalogue that cannot tell the two apart goes on advertising a campaign
    // nobody can subscribe to.
    for (const f of TOUS_FONDS) {
      if (!f.bareme) continue;
      if (f.bareme.nature === 'promotionnel') {
        expect(f.bareme.dateFin, `${f.cle} : promotion sans date de fin`).toMatch(
          /^\d{4}-\d{2}-\d{2}$/,
        );
      } else {
        expect(f.bareme.dateFin, `${f.cle} : un barème structurel ne finit pas`).toBeNull();
      }
    }
  });

  it('knows when a campaign has closed, and never says so of a tariff', () => {
    const promo = TOUS_FONDS.find((f) => f.bareme?.nature === 'promotionnel')!;
    const fin = promo.bareme!.dateFin!;
    expect(promotionExpiree(promo.bareme, fin)).toBe(false);
    expect(promotionExpiree(promo.bareme, '2099-01-01')).toBe(true);
    expect(promotionExpiree(promo.bareme, '2020-01-01')).toBe(false);

    const structurel = TOUS_FONDS.find((f) => f.bareme?.nature === 'structurel')!;
    expect(promotionExpiree(structurel.bareme, '2099-01-01')).toBe(false);
    expect(promotionExpiree(null, '2099-01-01')).toBe(false);
  });

  it('publishes every rate net of management fees, as French practice has it', () => {
    // Not a check on the union — the type already guarantees that, so asserting
    // it proves nothing. What is worth pinning is the state of the data: all
    // seven funds publish net, which is why the euro-pocket bar is empty and
    // why the table says so. The day a fund publishes gross, this fails and the
    // `'brut'` branch of the engine runs in production for the first time.
    for (const f of TOUS_FONDS) {
      expect(f.conventionTaux, `${f.cle}`).toBe('net-de-frais-de-gestion');
    }
  });
});

describe('a mechanism and its warning travel together', () => {
  const reservesDe = (cle: string) =>
    CONTRATS.find((c) => c.cle === cle)?.reserves.map((r) => r.genre) ?? [];

  it('warns whenever a scale is only a campaign', () => {
    for (const c of CONTRATS) {
      const promo = c.fondsEuros.some((f) => f.bareme?.nature === 'promotionnel');
      if (promo) expect(reservesDe(c.cle)).toContain('promotion');
    }
  });

  it('warns whenever interest is locked away until a term', () => {
    for (const c of CONTRATS) {
      if (c.fondsEuros.some((f) => f.provisionFidelite)) {
        expect(reservesDe(c.cle)).toContain('liquidite');
      }
    }
  });

  it('warns whenever a euro fund demands a minimum in units', () => {
    for (const c of CONTRATS) {
      if (c.fondsEuros.some((f) => f.partUCMinimale !== null)) {
        expect(reservesDe(c.cle)).toContain('contrainte');
      }
    }
  });

  it('warns whenever a contract is closed to new savers', () => {
    for (const c of CONTRATS) {
      if (!c.ouvertALaSouscription) expect(reservesDe(c.cle)).toContain('fermeture');
    }
  });

  it('warns whenever the shelf carries no tracker', () => {
    for (const c of CONTRATS) {
      const aDesETF = c.supports.some((s) => support(s).partage === 'etf');
      if (!aDesETF) expect(reservesDe(c.cle)).toContain('univers');
    }
  });
});

describe('the counterfactuals', () => {
  const afer = contrat('afer-multisupport');
  const bourso = contrat('boursovie');

  it('strips every fee without touching anything else', () => {
    const nu = sansFrais(afer);
    expect(nu.fraisGestion).toEqual({ euros: 0, uc: 0 });
    expect(nu.fraisVersement).toEqual({ euros: 0, uc: 0 });
    expect(nu.droitsAdhesion).toBe(0);
    expect(nu.supports).toEqual(afer.supports);
    expect(nu.fondsEuros).toEqual(afer.fondsEuros);
  });

  it('leaves the catalogue entry it was handed untouched', () => {
    const copie = structuredClone(afer);
    sansFrais(afer);
    avecPromotion(afer);
    avecSupport(afer, 'etf-actions-monde');
    expect(afer).toEqual(copie);
  });

  it('collapses a campaign onto its base tier, and can restore it', () => {
    expect(sansPromotion(bourso).fondsEuros[0].bareme).toBeNull();
    expect(avecPromotion(bourso).fondsEuros[0].bareme?.nature).toBe('structurel');
  });

  it('adds a support only once', () => {
    const enrichi = avecSupport(afer, 'etf-actions-monde');
    expect(enrichi.supports).toContain('etf-actions-monde');
    expect(avecSupport(enrichi, 'etf-actions-monde').supports).toEqual(enrichi.supports);
  });
});
