/**
 * What the unit-linked pocket is actually invested in, and what that costs.
 *
 * This is the catalogue the whole comparison turns on, and it is deliberately
 * separate from the contracts. Three reasons, in order of importance:
 *
 *  - **The ongoing charge belongs to the fund, not to the wrapper.** A world
 *    equity ETF costs the same 0,20 % a year whether it is held at Linxea or
 *    anywhere else. Carrying that figure on the contract would mean copying the
 *    same number into every entry, and — far worse — it would make the question
 *    this simulator exists to answer *inexpressible*: what would AFER be worth
 *    if it gave access to ETFs? Kept separate, that is a one-line counterfactual
 *    (`avecSupport`), not a rewrite.
 *  - **Access is a relation**, contract ↔ support, so it lives as a list of keys
 *    on the contract and nowhere else.
 *  - **The share class is part of the support's identity.** AFER Génération
 *    distributes *clean* units of the same asset classes at ~0,50 % instead of
 *    ~1,05 %, because they pay the insurer no retrocession. That could have been
 *    a per-contract override on the charge — an options bag, and a guaranteed
 *    one. Instead there are two distinct entries of the same `classe`, and no
 *    override anywhere.
 *
 * **The honesty rule, made structural.** The gross expected return is not a
 * field of `Support`. It is indexed by asset class, so it is *impossible to
 * write* that an actively managed equity fund is expected to earn more than a
 * world ETF. A test could have said the same thing, but a test can be deleted
 * and a type cannot. What separates two contracts holding the same asset class
 * is therefore only what is taken out along the way — which is precisely the
 * claim this project is here to put a number on.
 */

export type ClasseActif =
  | 'actions-monde'
  | 'obligations'
  | 'immobilier'
  | 'diversifie'
  | 'monetaire';

/**
 * How the fund is packaged, which is what decides its ongoing charge.
 *
 *  - `etf` — index tracker, no retrocession, the cheapest thing an insurer can
 *    put in front of you.
 *  - `clean` — actively managed but stripped of the retrocession paid back to
 *    the distributor. Cheaper for the saver, and it forces the insurer to
 *    charge visibly instead.
 *  - `retrocession` — the ordinary retail unit, out of whose charge a share
 *    flows back to whoever sold it. Roughly two thirds of the cost of an AFER
 *    equity fund is that share.
 *  - `pierre-papier` — property, whose published return is already net of the
 *    vehicle's own costs. See the note on `scpi`.
 */
export type ClassePart = 'etf' | 'clean' | 'retrocession' | 'pierre-papier';

export type CleSupport =
  | 'etf-actions-monde'
  | 'opcvm-actions-clean'
  | 'opcvm-actions-retrocession'
  | 'etf-obligations'
  | 'opcvm-obligations-clean'
  | 'opcvm-obligations-retrocession'
  | 'opcvm-diversifie-retrocession'
  | 'fonds-immobilier'
  | 'scpi'
  | 'monetaire';

export type Support = {
  cle: CleSupport;
  classe: ClasseActif;
  /** Share class: the same asset class does not cost the same in every wrapper. */
  partage: ClassePart;
  libelle: string;
  /** Ongoing charges of the fund itself, as a yearly fraction of assets. */
  ter: number;
  note: string;
};

/**
 * Gross expected return per asset class, before the fund's own charges and
 * before anything the insurer takes.
 *
 * One figure per class, never per support: see the header. These are starting
 * hypotheses, not forecasts, and the interface lets them be moved.
 */
export const RENDEMENT_BRUT: Record<ClasseActif, number> = {
  'actions-monde': 0.07,
  obligations: 0.03,
  immobilier: 0.04,
  diversifie: 0.05,
  monetaire: 0.02,
};

export const LIBELLES_CLASSES: Record<ClasseActif, string> = {
  'actions-monde': 'Actions monde',
  obligations: 'Obligations',
  immobilier: 'Immobilier',
  diversifie: 'Fonds diversifié',
  monetaire: 'Monétaire',
};

export const CLASSES: ClasseActif[] = [
  'actions-monde',
  'obligations',
  'diversifie',
  'immobilier',
  'monetaire',
];

export const SUPPORTS: Support[] = [
  {
    cle: 'etf-actions-monde',
    classe: 'actions-monde',
    partage: 'etf',
    libelle: 'ETF actions monde',
    ter: 0.002,
    note:
      'Un tracker qui réplique un indice mondial. Rien à décider, presque rien à payer : ' +
      'c’est le support le moins cher qu’un assureur puisse proposer, et tous ne le proposent pas.',
  },
  {
    cle: 'opcvm-actions-clean',
    classe: 'actions-monde',
    partage: 'clean',
    libelle: 'OPCVM actions, part clean',
    ter: 0.005,
    note:
      'Une part nettoyée de la rétrocession versée au distributeur. Le fonds coûte moins cher, ' +
      'mais l’assureur se rattrape sur les frais de gestion du contrat : regardez le total, pas la ligne.',
  },
  {
    cle: 'opcvm-actions-retrocession',
    classe: 'actions-monde',
    partage: 'retrocession',
    libelle: 'OPCVM actions, part de distribution',
    ter: 0.0105,
    note:
      'La part de détail ordinaire. Sur 1,05 % de frais courants, environ 0,74 % repartent en ' +
      'rétrocession vers celui qui vous a vendu le contrat — vous les payez sans les voir passer.',
  },
  {
    cle: 'etf-obligations',
    classe: 'obligations',
    partage: 'etf',
    libelle: 'ETF obligations',
    ter: 0.002,
    note:
      'Un tracker obligataire. Sur une classe d’actifs qui rapporte peu, l’écart de frais pèse ' +
      'proportionnellement bien plus lourd que sur des actions.',
  },
  {
    cle: 'opcvm-obligations-clean',
    classe: 'obligations',
    partage: 'clean',
    libelle: 'OPCVM obligations, part clean',
    ter: 0.004,
    note:
      'Une part obligataire sans rétrocession. Sur un rendement attendu de 3 %, les frais courants ' +
      'en prennent déjà plus du huitième.',
  },
  {
    cle: 'opcvm-obligations-retrocession',
    classe: 'obligations',
    partage: 'retrocession',
    libelle: 'OPCVM obligations, part de distribution',
    ter: 0.0091,
    note:
      'Près d’un point de frais courants sur une classe d’actifs qui vise 3 %. C’est le tiers du ' +
      'rendement espéré qui part avant même les frais du contrat.',
  },
  {
    cle: 'opcvm-diversifie-retrocession',
    classe: 'diversifie',
    partage: 'retrocession',
    libelle: 'Fonds diversifié, part de distribution',
    ter: 0.0126,
    note:
      'Un fonds qui mélange actions et obligations et facture le prix des actions. Commode à ' +
      'souscrire, cher à détenir : c’est le support que les réseaux placent le plus volontiers.',
  },
  {
    cle: 'fonds-immobilier',
    classe: 'immobilier',
    partage: 'retrocession',
    libelle: 'OPCI ou fonds immobilier',
    ter: 0.0145,
    note:
      'De l’immobilier logé dans un OPCVM, avec une poche de liquidité qui en dilue le rendement. ' +
      'Le support le plus cher du catalogue, et de loin.',
  },
  {
    cle: 'scpi',
    classe: 'immobilier',
    partage: 'pierre-papier',
    libelle: 'SCPI',
    ter: 0,
    note:
      'Frais courants portés à zéro, et ce n’est pas une faveur faite à la SCPI : son rendement ' +
      'publié est déjà net de ses propres frais de gestion. Les compter ici les compterait deux fois. ' +
      'En revanche, certains contrats ne reversent qu’une partie des loyers — cela se lit dans leurs réserves.',
  },
  {
    cle: 'monetaire',
    classe: 'monetaire',
    partage: 'clean',
    libelle: 'Fonds monétaire',
    ter: 0.001,
    note:
      'De la trésorerie rémunérée au jour le jour. Utile pour attendre, ruineux pour durer une fois ' +
      'l’inflation payée.',
  },
];

export function estClasseActif(valeur: unknown): valeur is ClasseActif {
  return typeof valeur === 'string' && valeur in RENDEMENT_BRUT;
}

export function estCleSupport(valeur: unknown): valeur is CleSupport {
  return SUPPORTS.some((s) => s.cle === valeur);
}

/** Falls back to the first entry rather than throwing: a bad key is a display bug, not a crash. */
export function support(cle: CleSupport): Support {
  return SUPPORTS.find((s) => s.cle === cle) ?? SUPPORTS[0];
}

export function supportsDe(cles: CleSupport[]): Support[] {
  return cles.map(support);
}

/**
 * The cheapest support of that asset class among the ones a contract offers,
 * or `null` when it offers none.
 *
 * `null` is the whole point of this function. A contract that does not carry
 * the asset class being compared must drop out of the table with a reason
 * given — substituting a neighbouring class would print a figure for a product
 * that cannot be bought, which is exactly the kind of claim this simulator was
 * built to contradict.
 */
export function meilleurSupport(cles: CleSupport[], classe: ClasseActif): Support | null {
  const candidats = supportsDe(cles).filter((s) => s.classe === classe);
  if (candidats.length === 0) return null;
  return candidats.reduce((a, b) => (b.ter < a.ter ? b : a));
}
