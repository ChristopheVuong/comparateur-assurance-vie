/**
 * The address is the shareable state.
 *
 * Three rules, each of which shows up in what the link looks like:
 *
 *  - **Only what differs from the defaults is written.** A visitor who has
 *    changed nothing gets a clean address, and a link that carries three
 *    parameters is a link about three decisions.
 *  - **Rates travel as percentage points**, `part=60` rather than `part=0.6`,
 *    because a shared link is read by people as well as by parsers.
 *  - **Everything read back is clamped to the same bounds as the fields.** The
 *    address is untrusted input: anyone can type into it, and half of them will
 *    be a search engine.
 */

import {
  BORNES,
  DEFAUTS,
  borner,
  type Hypotheses,
  type Periodicite,
  type Rebalancement,
  type SourceTaux,
} from './assuranceVie';
import { estFoyer } from './fiscalite';
import { estClasseActif, type ClasseActif } from './supports';
import { estCleContrat, type CleContrat } from './contrats';

const CLES = {
  initial: 'initial',
  programme: 'programme',
  periodicite: 'rythme',
  revalorisation: 'revalo',
  inflation: 'inflation',
  horizon: 'duree',
  partUC: 'uc',
  classeUC: 'classe',
  rendementUC: 'rendement',
  sourceTaux: 'taux',
  rebalancement: 'equilibre',
  foyer: 'foyer',
  detail: 'detail',
} as const;

/** Enough for the 20,315-style rates a scale can blend into. */
const DECIMALES_TAUX = 3;

function arrondi(valeur: number, decimales: number): number {
  const facteur = 10 ** decimales;
  return Math.round(valeur * facteur) / facteur;
}

function lireNombre(
  brut: string | null,
  defaut: number,
  bornes: { min: number; max: number },
  decimales = 0,
): number {
  if (brut === null || brut.trim() === '') return defaut;
  const valeur = Number(brut.replace(',', '.'));
  if (!Number.isFinite(valeur)) return defaut;
  return arrondi(Math.min(bornes.max, Math.max(bornes.min, valeur)), decimales);
}

export function encoderEtat(
  etat: Hypotheses,
  contexte: { detail?: CleContrat | null } = {},
  defauts: Hypotheses = DEFAUTS,
): string {
  const p = new URLSearchParams();
  const ajouter = (cle: string, valeur: string | number, defaut: string | number) => {
    if (valeur !== defaut) p.set(cle, String(valeur));
  };

  ajouter(CLES.initial, Math.round(etat.versementInitial), Math.round(defauts.versementInitial));
  ajouter(
    CLES.programme,
    Math.round(etat.versementProgramme),
    Math.round(defauts.versementProgramme),
  );
  ajouter(CLES.periodicite, etat.periodicite, defauts.periodicite);
  ajouter(
    CLES.revalorisation,
    arrondi(etat.revalorisationVersements * 100, DECIMALES_TAUX),
    arrondi(defauts.revalorisationVersements * 100, DECIMALES_TAUX),
  );
  ajouter(
    CLES.inflation,
    arrondi(etat.inflation * 100, DECIMALES_TAUX),
    arrondi(defauts.inflation * 100, DECIMALES_TAUX),
  );
  ajouter(CLES.horizon, etat.horizon, defauts.horizon);
  ajouter(
    CLES.partUC,
    arrondi(etat.partUC * 100, DECIMALES_TAUX),
    arrondi(defauts.partUC * 100, DECIMALES_TAUX),
  );
  ajouter(CLES.classeUC, etat.classeUC, defauts.classeUC);
  ajouter(
    CLES.rendementUC,
    arrondi(etat.rendementUC * 100, DECIMALES_TAUX),
    arrondi(defauts.rendementUC * 100, DECIMALES_TAUX),
  );
  ajouter(CLES.sourceTaux, etat.sourceTaux, defauts.sourceTaux);
  ajouter(CLES.rebalancement, etat.rebalancement, defauts.rebalancement);
  ajouter(CLES.foyer, etat.foyer, defauts.foyer);
  if (contexte.detail) p.set(CLES.detail, contexte.detail);

  const requete = p.toString();
  return requete === '' ? '' : `?${requete}`;
}

export function decoderEtat(recherche: string, defauts: Hypotheses = DEFAUTS): Hypotheses {
  const p = new URLSearchParams(recherche);
  const brut: Hypotheses = {
    versementInitial: lireNombre(
      p.get(CLES.initial),
      defauts.versementInitial,
      BORNES.versementInitial,
    ),
    versementProgramme: lireNombre(
      p.get(CLES.programme),
      defauts.versementProgramme,
      BORNES.versementProgramme,
    ),
    periodicite: (p.get(CLES.periodicite) ?? defauts.periodicite) as Periodicite,
    revalorisationVersements:
      lireNombre(
        p.get(CLES.revalorisation),
        defauts.revalorisationVersements * 100,
        { min: BORNES.revalorisationVersements.min * 100, max: BORNES.revalorisationVersements.max * 100 },
        DECIMALES_TAUX,
      ) / 100,
    inflation:
      lireNombre(
        p.get(CLES.inflation),
        defauts.inflation * 100,
        { min: BORNES.inflation.min * 100, max: BORNES.inflation.max * 100 },
        DECIMALES_TAUX,
      ) / 100,
    horizon: lireNombre(p.get(CLES.horizon), defauts.horizon, BORNES.horizon),
    partUC:
      lireNombre(
        p.get(CLES.partUC),
        defauts.partUC * 100,
        { min: BORNES.partUC.min * 100, max: BORNES.partUC.max * 100 },
        DECIMALES_TAUX,
      ) / 100,
    classeUC: (estClasseActif(p.get(CLES.classeUC)) ? p.get(CLES.classeUC) : defauts.classeUC) as ClasseActif,
    rendementUC:
      lireNombre(
        p.get(CLES.rendementUC),
        defauts.rendementUC * 100,
        { min: BORNES.rendementUC.min * 100, max: BORNES.rendementUC.max * 100 },
        DECIMALES_TAUX,
      ) / 100,
    sourceTaux: (p.get(CLES.sourceTaux) ?? defauts.sourceTaux) as SourceTaux,
    rebalancement: (p.get(CLES.rebalancement) ?? defauts.rebalancement) as Rebalancement,
    foyer: (() => {
      const lu = p.get(CLES.foyer);
      return estFoyer(lu) ? lu : defauts.foyer;
    })(),
  };
  return borner(brut);
}

export function decoderDetail(recherche: string): CleContrat | null {
  const valeur = new URLSearchParams(recherche).get(CLES.detail);
  return estCleContrat(valeur) ? valeur : null;
}

export function lienPartage(
  etat: Hypotheses,
  contexte: { detail?: CleContrat | null } = {},
): string {
  if (typeof window === 'undefined') return encoderEtat(etat, contexte);
  const { origin, pathname } = window.location;
  return `${origin}${pathname}${encoderEtat(etat, contexte)}`;
}
