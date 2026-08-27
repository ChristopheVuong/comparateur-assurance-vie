/**
 * Six French life insurance policies, as their own paperwork describes them.
 *
 * Every figure here was read off a note d'information, a fee transparency
 * sheet, a paritary management report or an insurer's own rate page in August
 * 2026, and each entry carries the addresses it was read from together with the
 * date. That last part is not politeness: **this data expires.** Rates are
 * announced each January, fee schedules change by amendment, and a comparison
 * built on a stale schedule is worse than no comparison at all.
 *
 * Two rules decide what becomes a field and what does not:
 *
 *  - **A mechanism earns a field read by the engine only if it moves the final
 *    capital, is parameterised by a number that differs between contracts, and
 *    is carried by at least two of them** — or by one, with a plausible variant
 *    at the next entrant. Everything else does not become a `boolean?`; it
 *    becomes a structured `Reserve`, which the interface can print and a test
 *    can check. A field nobody can put a number on is a typed lie: the Macif
 *    clause letting the insurer throttle payments into the euro fund at its own
 *    discretion is real, consequential, and unquantified, so it is a reserve.
 *  - **A published euro-fund rate in France is net of management fees and gross
 *    of social levies.** Subtracting `fraisGestion.euros` from it charges those
 *    fees twice and invents a third of a point a year of gap between AFER and
 *    the online contracts. `conventionTaux` is therefore mandatory and has no
 *    default value, so that nobody can add a contract without answering the
 *    question.
 *
 * What the catalogue is meant to show, and does show without any commentary:
 * the AFER wrapper, at 0,475 % on units, is **cheaper than Fortuneo or
 * BoursoVie**. What costs its savers money is the list in `supports` — no ETF,
 * so retail units at 1,05 % instead of a tracker at 0,20 %. The wrapper's price
 * tag is a third of the story; the shelf is the rest.
 */

import type { CleSupport } from './supports';

/** When the catalogue was last checked against its sources. */
export const DATE_RELEVE = '2026-08-27';

/** The year the reference rates were earned. They are served the January after. */
export const ANNEE_REFERENCE = 2025;

/**
 * Why a figure deserves a caveat. The genre is what lets the interface group
 * them and a test demand that a mechanism and its warning travel together.
 */
export type GenreReserve =
  | 'promotion'
  | 'contrainte'
  | 'liquidite'
  | 'univers'
  | 'donnee'
  | 'fermeture';

export type Reserve = { genre: GenreReserve; texte: string };

export type Source = {
  libelle: string;
  url: string;
  /** AAAA-MM-JJ. Never later than DATE_RELEVE, and that is tested. */
  consulteLe: string;
};

/** Tiers ordered by increasing UC share; rates are absolute, never "base + bonus". */
export type Palier = { partUCMinimale: number; taux: number };

export type Bareme = {
  paliers: Palier[];
  /**
   * A promotional scale does not survive the horizon; a structural one does.
   * The engine ignores promotional tiers outright — projecting a two-vintage
   * campaign over twenty years is an error, not an option — and reports what
   * ignoring them cost, in euros, so the warning is a figure rather than a
   * paragraph.
   */
  nature: 'structurel' | 'promotionnel';
  /**
   * ISO date after which the campaign no longer accepts new payments; null on
   * a structural scale, and mandatory on a promotional one (there is a test).
   *
   * Without it the catalogue can describe an offer but never know it has
   * lapsed, so a page would go on advertising a campaign nobody can subscribe
   * to and quoting what it "would be worth". An offer with no end date is not
   * an offer, it is a tariff.
   */
  dateFin: string | null;
  /** Payments eligible for the uplift, in euros; null when uncapped. */
  plafondVersements: number | null;
};

/**
 * Has the campaign closed by the given date?
 *
 * The date is an argument rather than a call to the clock, so that the engine
 * stays pure and a shared link keeps projecting the same figures tomorrow as
 * today. The wall clock enters at the edge of the application, like formatting
 * does — never in `lib/`.
 */
export function promotionExpiree(bareme: Bareme | null, aLaDate: string): boolean {
  if (!bareme || bareme.nature !== 'promotionnel' || bareme.dateFin === null) return false;
  return aLaDate > bareme.dateFin;
}

/**
 * A euro fund whose interest is locked away until a term, and topped up if you
 * stay.
 *
 * One contract in the catalogue does this, which by the rule above would make
 * it a reserve rather than a field. It gets a discriminated variant instead,
 * because it is not an option but a whole mechanism: four numbers that only
 * mean anything together, and which change the capital by a lot in both
 * directions. Four optional fields on `Contrat` would have been the options bag
 * the rule exists to prevent.
 */
export type ProvisionFidelite = {
  /** Years before the provision is definitively acquired. */
  termeAnnees: number;
  /**
   * Share of the year's interest housed in the provision rather than acquired.
   *
   * A number and not a flag, and that pays for itself immediately: what is not
   * acquired is not subject to the yearly social levies either, so that rule
   * falls straight out of `1 − partProvisionnee` without a second field.
   */
  partProvisionnee: number;
  /** Minimum uplift on the capitalised interest, credited at the term. */
  bonusAuTerme: number;
  /** What an exit before the term costs. */
  perteAvantTerme: 'totale' | 'prorata-temporis';
};

export type CleFondsEuros =
  | 'afer-garanti'
  | 'afer-eurogeneration'
  | 'macif-euro'
  | 'nouvelle-generation'
  | 'suravenir-rendement-2'
  | 'suravenir-opportunites-2'
  | 'euro-exclusif';

export type FondsEuros = {
  cle: CleFondsEuros;
  libelle: string;
  /** Published rates, oldest first. The last one is the reference year. */
  historique: { annee: number; taux: number }[];
  conventionTaux: 'net-de-frais-de-gestion' | 'brut';
  /** null when the same rate is served to everyone, whatever the UC share. */
  bareme: Bareme | null;
  /** Minimum UC share on every payment to reach this fund; null when free. */
  partUCMinimale: number | null;
  provisionFidelite: ProvisionFidelite | null;
  note: string;
};

export type CleContrat =
  | 'afer-multisupport'
  | 'afer-generation'
  | 'macif-epargne-vie'
  | 'linxea-spirit-2'
  | 'fortuneo-vie'
  | 'boursovie';

export type Contrat = {
  cle: CleContrat;
  libelle: string;
  assureur: string;
  distributeur: string | null;
  ouvertALaSouscription: boolean;
  /** Entry ticket, in euros. */
  versementMinimal: number;
  /** One-off flat cost, not a premium: it is never invested and never taxed. */
  droitsAdhesion: number;
  fraisVersement: { euros: number; uc: number };
  fraisGestion: { euros: number; uc: number };
  /** Yearly levy on the whole managed savings, both pockets. */
  fraisSurEncours: number;
  arbitrage: { gratuitsParAn: number; taux: number };
  /** Per-order cost charged on ETF supports only. */
  fraisOperationETF: number;
  fondsEuros: FondsEuros[];
  supports: CleSupport[];
  reserves: Reserve[];
  sources: Source[];
  note: string;
};

// ---------------------------------------------------------------------------
// Euro funds
// ---------------------------------------------------------------------------

const AFER_GARANTI: FondsEuros = {
  cle: 'afer-garanti',
  libelle: 'Fonds Garanti en euros Afer',
  historique: [
    { annee: 2021, taux: 0.017 },
    { annee: 2022, taux: 0.0201 },
    { annee: 2023, taux: 0.0222 },
    { annee: 2024, taux: 0.0251 },
    { annee: 2025, taux: 0.0265 },
  ],
  conventionTaux: 'net-de-frais-de-gestion',
  bareme: null,
  partUCMinimale: null,
  provisionFidelite: null,
  note:
    'Le même taux pour tous les adhérents, quelle que soit la part d’unités de compte. ' +
    'C’est un principe revendiqué par l’association, et c’est devenu une singularité : ' +
    'presque tout le marché conditionne désormais son taux à une prise de risque.',
};

const AFER_EUROGENERATION: FondsEuros = {
  cle: 'afer-eurogeneration',
  libelle: 'Afer EuroGénération',
  historique: [{ annee: 2025, taux: 0.0405 }],
  conventionTaux: 'net-de-frais-de-gestion',
  bareme: null,
  partUCMinimale: null,
  provisionFidelite: {
    termeAnnees: 8,
    partProvisionnee: 1,
    bonusAuTerme: 0.1,
    perteAvantTerme: 'totale',
  },
  note:
    'Ce n’est pas un fonds en euros ordinaire, et son 4,05 % ne se compare pas au 2,65 % du fonds ' +
    'classique. Les intérêts ne sont pas versés : ils sont mis en réserve, majorés d’au moins 10 % ' +
    'au bout de huit ans — et perdus si vous sortez avant.',
};

const MACIF_EURO: FondsEuros = {
  cle: 'macif-euro',
  libelle: 'Support en euros Macif Épargne Vie',
  historique: [
    { annee: 2023, taux: 0.025 },
    { annee: 2024, taux: 0.027 },
    { annee: 2025, taux: 0.027 },
  ],
  conventionTaux: 'net-de-frais-de-gestion',
  bareme: {
    paliers: [
      { partUCMinimale: 0, taux: 0.027 },
      { partUCMinimale: 0.2, taux: 0.029 },
    ],
    nature: 'structurel',
    dateFin: null,
    plafondVersements: null,
  },
  partUCMinimale: null,
  provisionFidelite: null,
  note:
    'Deux paliers seulement, et un écart modeste : vingt centièmes de point pour vingt pour cent ' +
    'du portefeuille exposé au marché. Le fonds reste accessible sans aucune contrainte d’unités de compte.',
};

const NOUVELLE_GENERATION: FondsEuros = {
  cle: 'nouvelle-generation',
  libelle: 'Nouvelle Génération (Spirica)',
  historique: [
    { annee: 2021, taux: 0.0165 },
    { annee: 2022, taux: 0.023 },
    { annee: 2023, taux: 0.0313 },
    { annee: 2024, taux: 0.0313 },
    { annee: 2025, taux: 0.0308 },
  ],
  conventionTaux: 'net-de-frais-de-gestion',
  bareme: null,
  partUCMinimale: null,
  provisionFidelite: null,
  note:
    'Un fonds euros de nouvelle génération, accessible sans quota d’unités de compte, et dont le ' +
    'taux affiché est déjà net des frais de gestion — le « jusqu’à 2 % de frais » qu’on lit ailleurs ' +
    'ne s’ajoute pas à ce chiffre, il en est déjà retiré.',
};

const SURAVENIR_RENDEMENT_2: FondsEuros = {
  cle: 'suravenir-rendement-2',
  libelle: 'Suravenir Rendement 2',
  historique: [{ annee: 2025, taux: 0.021 }],
  conventionTaux: 'net-de-frais-de-gestion',
  bareme: null,
  partUCMinimale: 0.3,
  provisionFidelite: null,
  note:
    'Le fonds le mieux garanti de la gamme (99,4 % du capital), mais chaque versement doit comporter ' +
    'au moins 30 % d’unités de compte. C’est la seule contrainte d’accès dure du panel, et elle ' +
    'coûte plus qu’elle ne rapporte : 2,10 % contre 3,00 % sur l’autre fonds, sans contrainte.',
};

const SURAVENIR_OPPORTUNITES_2: FondsEuros = {
  cle: 'suravenir-opportunites-2',
  libelle: 'Suravenir Opportunités 2',
  historique: [{ annee: 2025, taux: 0.03 }],
  conventionTaux: 'net-de-frais-de-gestion',
  bareme: {
    paliers: [
      { partUCMinimale: 0, taux: 0.03 },
      { partUCMinimale: 0.3, taux: 0.035 },
      { partUCMinimale: 0.5, taux: 0.04 },
      { partUCMinimale: 0.7, taux: 0.045 },
    ],
    nature: 'structurel',
    dateFin: null,
    plafondVersements: null,
  },
  partUCMinimale: null,
  provisionFidelite: null,
  note:
    'Le barème le plus généreux du panel, et le plus structurel : quatre paliers reconduits d’une ' +
    'année sur l’autre, pas une campagne. En contrepartie la garantie tombe à 97 % du capital.',
};

const EURO_EXCLUSIF: FondsEuros = {
  cle: 'euro-exclusif',
  libelle: 'Euro Exclusif (Generali)',
  historique: [
    { annee: 2021, taux: 0.0135 },
    { annee: 2022, taux: 0.023 },
    { annee: 2023, taux: 0.031 },
    { annee: 2024, taux: 0.03 },
    { annee: 2025, taux: 0.03 },
  ],
  conventionTaux: 'net-de-frais-de-gestion',
  bareme: {
    paliers: [
      { partUCMinimale: 0, taux: 0.03 },
      { partUCMinimale: 0.3, taux: 0.045 },
    ],
    nature: 'promotionnel',
    // L'offre porte sur les versements effectués pendant l'année civile 2026.
    dateFin: '2026-12-31',
    plafondVersements: 500_000,
  },
  partUCMinimale: null,
  provisionFidelite: null,
  note:
    'Le taux de base est de 3 %. Le 4,50 % mis en avant suppose 30 % d’unités de compte, un versement ' +
    'neuf dans la fenêtre de l’offre, et ne vaut que deux millésimes : le simulateur ne le projette pas.',
};

// ---------------------------------------------------------------------------
// Contracts
// ---------------------------------------------------------------------------

export const CONTRATS: Contrat[] = [
  {
    cle: 'afer-multisupport',
    libelle: 'Afer Multisupport',
    assureur: 'Abeille Assurances Vie',
    distributeur: 'Association Afer',
    ouvertALaSouscription: true,
    versementMinimal: 100,
    droitsAdhesion: 20,
    fraisVersement: { euros: 0.005, uc: 0 },
    fraisGestion: { euros: 0.00475, uc: 0.00475 },
    fraisSurEncours: 0,
    arbitrage: { gratuitsParAn: Infinity, taux: 0 },
    fraisOperationETF: 0,
    fondsEuros: [AFER_GARANTI],
    supports: [
      'opcvm-actions-retrocession',
      'opcvm-obligations-retrocession',
      'opcvm-diversifie-retrocession',
      'fonds-immobilier',
      'monetaire',
    ],
    reserves: [
      {
        genre: 'univers',
        texte:
          'Le contrat est très pauvre en ETF : l’essentiel de son catalogue est fait de fonds maison ' +
          'à parts de distribution, dont environ les deux tiers des frais courants repartent en ' +
          'rétrocession. C’est là que le contrat coûte cher, pas dans son tarif d’enveloppe.',
      },
      {
        genre: 'univers',
        texte:
          'Aucune SCPI en direct. L’immobilier n’est accessible que par des OPCI et fonds immobiliers, ' +
          'dont les frais courants sont les plus élevés du catalogue.',
      },
      {
        genre: 'donnee',
        texte:
          'Les frais courants moyens par catégorie viennent de la fiche de transparence de mai 2024. ' +
          'Une édition plus récente existe probablement et n’a pas été retrouvée.',
      },
      {
        genre: 'donnee',
        texte:
          'La gestion sous mandat ajoute 0,25 % par an, et donne accès à deux orientations 100 % ETF. ' +
          'Ce mode de gestion n’est pas modélisé : le simulateur suppose une gestion libre.',
      },
    ],
    sources: [
      {
        libelle: 'Fiche de transparence des frais Afer Multisupport (mai 2024)',
        url: 'https://www.afer.fr/content/uploads/2024/07/60142c-05-2024-fiche-transparence-des-frais-afer-multisupport-3-1.pdf',
        consulteLe: '2026-08-27',
      },
      {
        libelle: 'Performances des supports à capital garanti — afer.fr',
        url: 'https://www.afer.fr/performances-des-supports-a-capital-garanti/',
        consulteLe: '2026-08-27',
      },
    ],
    note:
      'Le contrat associatif historique, et un cas d’école : à 0,475 % de frais de gestion sur les ' +
      'unités de compte, son enveloppe est moins chère que celle de la plupart des contrats en ligne. ' +
      'Ce qui coûte à ses adhérents, c’est ce qu’il y a sur l’étagère.',
  },

  {
    cle: 'afer-generation',
    libelle: 'Afer Génération',
    assureur: 'Abeille Assurances Vie',
    distributeur: 'Association Afer',
    ouvertALaSouscription: true,
    versementMinimal: 1_000,
    droitsAdhesion: 20,
    fraisVersement: { euros: 0.005, uc: 0 },
    fraisGestion: { euros: 0.00625, uc: 0.01175 },
    fraisSurEncours: 0,
    arbitrage: { gratuitsParAn: Infinity, taux: 0 },
    fraisOperationETF: 0,
    fondsEuros: [AFER_EUROGENERATION, AFER_GARANTI],
    supports: ['opcvm-actions-clean', 'opcvm-obligations-clean', 'monetaire'],
    reserves: [
      {
        genre: 'liquidite',
        texte:
          'Les intérêts du fonds Afer EuroGénération sont mis en réserve et ne vous sont acquis qu’au ' +
          'terme de huit ans, majorés d’au moins 10 %. Tout rachat ou arbitrage sortant avant ce terme ' +
          'fait perdre cette réserve. Le rendement affiché est donc conditionnel à un blocage effectif.',
      },
      {
        genre: 'donnee',
        texte:
          'La notice ne dit pas explicitement si une sortie anticipée fait perdre la réserve en totalité ' +
          'ou au prorata du temps écoulé. La lecture prudente — perte totale — a été retenue, ce qui ' +
          'désavantage le contrat sur les horizons courts.',
      },
      {
        genre: 'donnee',
        texte:
          'Le fonds Afer EuroGénération est né avec le contrat en 2025 : il n’a qu’une seule année ' +
          'd’historique, et rien ne permet d’en dégager une tendance.',
      },
      {
        genre: 'univers',
        texte:
          'Contrat entièrement en parts clean : les fonds ne versent aucune rétrocession, et l’assureur ' +
          'facture visiblement à la place. Le coût total ressort quasi identique au Multisupport — ce ' +
          'qui change est la transparence, pas le prix. Aucune SCPI ni fonds immobilier.',
      },
    ],
    sources: [
      {
        libelle: 'Les frais du contrat Afer Génération — afer.fr',
        url: 'https://www.afer.fr/frais/',
        consulteLe: '2026-08-27',
      },
      {
        libelle: 'Notice contractuelle Afer Génération, édition janvier 2025',
        url: 'https://www.credit-et-banque.com/wp-content/uploads/2025/01/AFER-Generation.pdf',
        consulteLe: '2026-08-27',
      },
    ],
    note:
      'La version clean share du contrat Afer, lancée en 2025. Frais de gestion trois fois plus élevés ' +
      'sur les unités de compte, mais des supports deux fois moins chers : le total se compense presque ' +
      'exactement. Sa vraie particularité est ailleurs — un fonds en euros qui paie mieux, à condition ' +
      'de ne pas y toucher pendant huit ans.',
  },

  {
    cle: 'macif-epargne-vie',
    libelle: 'Macif Épargne Vie',
    assureur: 'Macif Vie SE',
    distributeur: 'Macif',
    ouvertALaSouscription: true,
    versementMinimal: 50,
    droitsAdhesion: 0,
    fraisVersement: { euros: 0, uc: 0 },
    fraisGestion: { euros: 0.006, uc: 0.006 },
    fraisSurEncours: 0.0001,
    arbitrage: { gratuitsParAn: 1, taux: 0.005 },
    fraisOperationETF: 0,
    fondsEuros: [MACIF_EURO],
    supports: [
      'opcvm-actions-retrocession',
      'opcvm-obligations-retrocession',
      'opcvm-diversifie-retrocession',
    ],
    reserves: [
      {
        genre: 'univers',
        texte:
          'Dix-sept unités de compte au total, gérées quasi exclusivement par Ofi Invest, la société de ' +
          'gestion du groupe. Aucun ETF coté, aucune SCPI : le seul support indiciel est un OPCVM ' +
          'indiciel, ce qui n’est pas la même chose et ne coûte pas le même prix.',
      },
      {
        genre: 'contrainte',
        texte:
          'La note d’information autorise l’assureur à limiter ou suspendre temporairement les versements ' +
          'sur le support en euros, et à moduler les montants acceptés. Aucun seuil n’est publié : ' +
          'c’est une habilitation, pas un plafond en vigueur, et elle n’est donc pas chiffrée ici.',
      },
      {
        genre: 'contrainte',
        texte:
          'En gestion pilotée, la part investie en euros n’est pas choisie : elle est fixée par le mandat ' +
          '(70 à 100 % en profil Prudent, 40 à 60 % en Équilibre, 20 à 40 % en Dynamique) et révisée par ' +
          'l’assureur. Le simulateur modélise la gestion libre.',
      },
      {
        genre: 'donnee',
        texte:
          'Les taux servis avant 2023 n’ont pas pu être vérifiés sur source primaire et ne figurent pas ' +
          'dans l’historique. Les contrats Multi Vie, Livret Vie et Actiplus sont fermés depuis juin 2024.',
      },
    ],
    sources: [
      {
        libelle: 'Note d’information Macif Épargne Vie (juin 2026)',
        url: 'https://www.macif.fr/files/live/sites/maciffr/files/conditions_generales_banque/NI-MacifEpargneVie.pdf',
        consulteLe: '2026-08-27',
      },
      {
        libelle: 'Compte-rendu de gestion paritaire 2025 (26 mars 2026)',
        url: 'https://www.macif.fr/files/live/sites/maciffr/files/maciffr/Particuliers/BanqueCreditEpargne/Epargne/compte-rendu-de-gestion-paritaire.pdf',
        consulteLe: '2026-08-27',
      },
    ],
    note:
      'Le seul contrat MACIF grand public encore ouvert, assuré par ce qui s’appelait Mutavie jusqu’en ' +
      'mars 2026. Zéro frais d’entrée, un tarif d’enveloppe honnête, et un catalogue de dix-sept fonds ' +
      'maison sans le moindre ETF — c’est là que se joue l’écart.',
  },

  {
    cle: 'linxea-spirit-2',
    libelle: 'Linxea Spirit 2',
    assureur: 'Spirica (Crédit Agricole)',
    distributeur: 'Linxea',
    ouvertALaSouscription: true,
    versementMinimal: 500,
    droitsAdhesion: 0,
    fraisVersement: { euros: 0, uc: 0 },
    fraisGestion: { euros: 0, uc: 0.005 },
    fraisSurEncours: 0,
    arbitrage: { gratuitsParAn: Infinity, taux: 0 },
    fraisOperationETF: 0.001,
    fondsEuros: [NOUVELLE_GENERATION],
    supports: [
      'etf-actions-monde',
      'etf-obligations',
      'opcvm-actions-retrocession',
      'scpi',
      'monetaire',
    ],
    reserves: [
      {
        genre: 'donnee',
        texte:
          'Les frais de gestion du fonds en euros sont portés à zéro parce que le taux publié en est déjà ' +
          'net. Le « jusqu’à 2 % » qui figure dans la documentation du fonds est prélevé en amont du taux ' +
          'annoncé, et le déduire une seconde fois fausserait la comparaison.',
      },
      {
        genre: 'donnee',
        texte:
          'Le nombre exact d’ETF disponibles varie de 80 à plus de 200 selon les sources consultées, sans ' +
          'qu’il soit possible de trancher. Ce qui compte pour le calcul est qu’il y en ait, et il y en a.',
      },
      {
        genre: 'univers',
        texte:
          'Les SCPI reversent 100 % des loyers, mais l’allocation est plafonnée à la moitié de chaque ' +
          'versement. Des frais d’opération s’appliquent aussi aux SCPI, SCI, FCPR et titres vifs.',
      },
    ],
    sources: [
      {
        libelle: 'Linxea Spirit 2 — conditions et frais',
        url: 'https://www.linxea.com/assurance-vie/linxea-spirit-2/',
        consulteLe: '2026-08-27',
      },
    ],
    note:
      'La référence des contrats à frais réduits : 0,50 % sur les unités de compte, rien à l’entrée, ' +
      'rien à l’arbitrage, et surtout un accès aux ETF. C’est cette dernière ligne, plus que le tarif, ' +
      'qui creuse l’écart sur vingt ans.',
  },

  {
    cle: 'fortuneo-vie',
    libelle: 'Fortuneo Vie',
    assureur: 'Suravenir (Crédit Mutuel Arkéa)',
    distributeur: 'Fortuneo',
    ouvertALaSouscription: true,
    versementMinimal: 100,
    droitsAdhesion: 0,
    fraisVersement: { euros: 0, uc: 0 },
    fraisGestion: { euros: 0, uc: 0.0075 },
    fraisSurEncours: 0,
    arbitrage: { gratuitsParAn: Infinity, taux: 0 },
    fraisOperationETF: 0,
    fondsEuros: [SURAVENIR_OPPORTUNITES_2, SURAVENIR_RENDEMENT_2],
    supports: ['etf-actions-monde', 'etf-obligations', 'opcvm-actions-retrocession', 'scpi'],
    reserves: [
      {
        genre: 'contrainte',
        texte:
          'Le fonds Suravenir Rendement 2, le mieux garanti des deux, exige au moins 30 % d’unités de ' +
          'compte à chaque versement. En dessous de ce seuil, seul Suravenir Opportunités 2 reste ' +
          'accessible — ce qui, en pratique, sert un meilleur taux de toute façon.',
      },
      {
        genre: 'donnee',
        texte:
          'Le nombre d’ETF disponibles n’est publié nulle part : Fortuneo annonce « plus de 200 supports » ' +
          'sans les détailler. Leur présence est établie, leur profondeur ne l’est pas.',
      },
      {
        genre: 'donnee',
        texte:
          'La gestion sous mandat porte les frais sur unités de compte à 0,85 %. Le simulateur modélise ' +
          'la gestion libre, à 0,75 %.',
      },
    ],
    sources: [
      {
        libelle: 'Fortuneo Vie — frais et supports',
        url: 'https://www.fortuneo.fr/assurance-vie',
        consulteLe: '2026-08-27',
      },
      {
        libelle: 'Fonds euros Suravenir Opportunités 2 — barème 2025',
        url: 'https://www.fortuneo.fr/assurance-vie/fonds-euros-opportunites-2',
        consulteLe: '2026-08-27',
      },
    ],
    note:
      'Deux fonds en euros aux logiques opposées, et c’est le seul contrat du panel où le choix du fonds ' +
      'dépend de votre allocation. Frais de gestion à 0,75 %, soit une moitié de point de plus que Linxea ' +
      'sur vingt ans — ce qui se voit.',
  },

  {
    cle: 'boursovie',
    libelle: 'BoursoVie',
    assureur: 'Generali Vie',
    distributeur: 'BoursoBank',
    ouvertALaSouscription: true,
    versementMinimal: 300,
    droitsAdhesion: 0,
    fraisVersement: { euros: 0, uc: 0 },
    fraisGestion: { euros: 0.0075, uc: 0.0075 },
    fraisSurEncours: 0,
    arbitrage: { gratuitsParAn: Infinity, taux: 0 },
    fraisOperationETF: 0,
    fondsEuros: [EURO_EXCLUSIF],
    supports: [
      'etf-actions-monde',
      'opcvm-actions-retrocession',
      'opcvm-diversifie-retrocession',
      'scpi',
    ],
    reserves: [
      {
        genre: 'promotion',
        texte:
          'Le bonus de 1,50 % au-delà de 30 % d’unités de compte est une offre commerciale : elle vise ' +
          'les versements d’un millésime, ne s’applique que deux ans, et plafonne à 500 000 €. Le ' +
          'simulateur ne la projette pas sur l’horizon — il chiffre séparément ce qu’elle vaudrait.',
      },
      {
        genre: 'univers',
        texte:
          'Le catalogue d’ETF est nettement plus pauvre que celui des autres contrats en ligne, et les ' +
          'sources le chiffrent entre 33 et 49 sans s’accorder. Trois SCPI seulement.',
      },
      {
        genre: 'donnee',
        texte:
          'Attention au 2,484 % qui circule pour 2025 : c’est le taux net de prélèvements sociaux, pas net ' +
          'de frais. Le chiffre comparable aux autres contrats est 3,00 %.',
      },
      {
        genre: 'donnee',
        texte:
          'La gestion sous mandat est proposée sans surcoût, ce qui est rare. Le simulateur modélise la ' +
          'gestion libre, au même tarif.',
      },
    ],
    sources: [
      {
        libelle: 'BoursoBank — assurance-vie',
        url: 'https://www.boursobank.com/epargne/assurance-vie',
        consulteLe: '2026-08-27',
      },
    ],
    note:
      'Zéro frais d’entrée mais 0,75 % de frais de gestion appliqués aux deux poches, fonds en euros ' +
      'compris. Le taux vitrine de 4,50 % suppose une promotion qui ne dure pas ; le taux durable est 3 %.',
  },
];

export const CONTRAT_PAR_DEFAUT: CleContrat = 'linxea-spirit-2';

export const TOUS_FONDS: FondsEuros[] = CONTRATS.flatMap((c) => c.fondsEuros);

/**
 * The largest entry ticket in the catalogue.
 *
 * The default initial payment is composed from this rather than written down,
 * so that the simulator opens on a figure where every contract can actually be
 * compared instead of some of them dropping out before the user has touched
 * anything.
 */
export const TICKET_MAXIMAL: number = Math.max(...CONTRATS.map((c) => c.versementMinimal));

export function estCleContrat(valeur: unknown): valeur is CleContrat {
  return CONTRATS.some((c) => c.cle === valeur);
}

/** Falls back to the first entry rather than throwing: a bad key is a display bug. */
export function contrat(cle: CleContrat): Contrat {
  return CONTRATS.find((c) => c.cle === cle) ?? CONTRATS[0];
}

export function fondsEuros(cle: CleFondsEuros): FondsEuros | null {
  return TOUS_FONDS.find((f) => f.cle === cle) ?? null;
}

/** The rate of the base tier, which is what the published history records. */
export function tauxDeBase(f: FondsEuros): number {
  return f.bareme ? f.bareme.paliers[0].taux : (f.historique.at(-1)?.taux ?? 0);
}

// ---------------------------------------------------------------------------
// Counterfactuals
// ---------------------------------------------------------------------------

/*
 * Three pure transformations, ten lines each, and they are the reason
 * `projeterContrat` takes a `Contrat` rather than a key: they turn the claim
 * this project rests on into something a test can execute, without polluting
 * the catalogue with phantom entries.
 */

/** The same contract with every fee at zero: the yardstick for what fees cost. */
export function sansFrais(c: Contrat): Contrat {
  return {
    ...c,
    droitsAdhesion: 0,
    fraisVersement: { euros: 0, uc: 0 },
    fraisGestion: { euros: 0, uc: 0 },
    fraisSurEncours: 0,
    arbitrage: { gratuitsParAn: Infinity, taux: 0 },
    fraisOperationETF: 0,
  };
}

/** The same contract with promotional tiers collapsed onto the base tier. */
export function sansPromotion(c: Contrat): Contrat {
  return {
    ...c,
    fondsEuros: c.fondsEuros.map((f) =>
      f.bareme?.nature === 'promotionnel' ? { ...f, bareme: null } : f,
    ),
  };
}

/**
 * The same contract, pretending its promotional tiers were permanent.
 *
 * Never what gets shown as the answer — it is the counterfactual the engine
 * runs on the side so that "do not compare a promotional rate with a
 * structural one" can be stated as a sum of money rather than as a paragraph
 * nobody reads.
 */
export function avecPromotion(c: Contrat): Contrat {
  return {
    ...c,
    fondsEuros: c.fondsEuros.map((f) =>
      f.bareme?.nature === 'promotionnel'
        ? { ...f, bareme: { ...f.bareme, nature: 'structurel' as const } }
        : f,
    ),
  };
}

/** The same contract, given access to one more support. "What if AFER had ETFs?" */
export function avecSupport(c: Contrat, cle: CleSupport): Contrat {
  return c.supports.includes(cle) ? c : { ...c, supports: [...c.supports, cle] };
}
