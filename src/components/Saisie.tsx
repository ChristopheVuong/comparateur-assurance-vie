import {
  BORNES,
  ECHEANCES,
  LIBELLES_PERIODICITE,
  LIBELLES_REBALANCEMENT,
  LIBELLES_SOURCE_TAUX,
  type Hypotheses,
  type Periodicite,
  type Rebalancement,
  type SourceTaux,
} from '../lib/assuranceVie';
import { CONTRATS } from '../lib/contrats';
import { LIBELLES_FOYER, type Foyer } from '../lib/fiscalite';
import { CLASSES, LIBELLES_CLASSES, RENDEMENT_BRUT, type ClasseActif } from '../lib/supports';
import { annees, eur, points, taux } from '../lib/format';
import { Curseur, CurseurLog, Montant, Segments } from './Champs';

/**
 * The plan, as the visitor describes it.
 *
 * Ordered the way somebody actually thinks about it — how much, for how long,
 * how exposed — with the two adjustments that reward a second look (the gross
 * return and the rebalancing rule) folded away at the bottom rather than
 * greeting anyone on arrival.
 *
 * One control here is not a preference but a claim about the world, and it is
 * flagged as such: the gross expected return applies identically to all six
 * contracts. Letting it vary per contract would smuggle the active-versus-index
 * argument into what is meant to be a comparison of fees.
 */
export function Saisie({
  h,
  onChange,
}: {
  h: Hypotheses;
  onChange: <K extends keyof Hypotheses>(cle: K, valeur: Hypotheses[K]) => void;
}) {
  const parAn = h.versementProgramme * ECHEANCES[h.periodicite];
  const totalVerse = h.versementInitial + parAn * h.horizon;

  return (
    <div className="card p-6 sm:p-7">
      <h2 className="text-base font-semibold text-ink-900">Votre plan</h2>

      <div className="mt-5 space-y-6">
        <div>
          <Montant
            label="Versement initial"
            valeur={h.versementInitial}
            onChange={(v) => onChange('versementInitial', v)}
            min={BORNES.versementInitial.min}
            max={BORNES.versementInitial.max}
            hint="Les contrats dont le ticket d’entrée dépasse ce montant sortent de la comparaison."
          />
          <div className="mt-2">
            <CurseurLog
              label="Versement initial"
              valeur={h.versementInitial}
              onChange={(v) => onChange('versementInitial', v)}
              reperes={[
                { valeur: 1_000, label: '1 k€' },
                { valeur: 10_000, label: '10 k€' },
                { valeur: 50_000, label: '50 k€' },
                { valeur: 200_000, label: '200 k€' },
              ]}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Montant
            label="Versement régulier"
            valeur={h.versementProgramme}
            onChange={(v) => onChange('versementProgramme', v)}
            min={BORNES.versementProgramme.min}
            max={BORNES.versementProgramme.max}
            placeholder="0"
          />
          <Segments<Periodicite>
            label="Rythme"
            valeur={h.periodicite}
            onChange={(v) => onChange('periodicite', v)}
            options={(['mensuelle', 'trimestrielle', 'annuelle'] as const).map((p) => ({
              valeur: p,
              label: LIBELLES_PERIODICITE[p].replace('Par ', ''),
            }))}
          />
        </div>
        <p className="-mt-3 field-hint">
          {parAn > 0
            ? `Soit ${eur(parAn)} par an, et ${eur(totalVerse)} versés en tout sur ${annees(h.horizon)}.`
            : `Aucun versement régulier : seul l’apport initial de ${eur(h.versementInitial)} travaille.`}
        </p>

        <Curseur
          label="Durée"
          valeur={h.horizon}
          min={BORNES.horizon.min}
          max={BORNES.horizon.max}
          pas={1}
          onChange={(v) => onChange('horizon', v)}
          rendu={annees}
          saisie={{ suffixe: 'ans' }}
          reperes={[
            { valeur: 5, label: '5' },
            { valeur: 8, label: '8 ans' },
            { valeur: 20, label: '20' },
            { valeur: 40, label: '40' },
          ]}
          hint="La fiscalité bascule à huit ans : abattement annuel et taux réduit."
        />

        <Curseur
          label="Part en unités de compte"
          valeur={Math.round(h.partUC * 100)}
          min={0}
          max={100}
          pas={5}
          onChange={(v) => onChange('partUC', v / 100)}
          rendu={(v) => `${v} %`}
          saisie={{ suffixe: '%' }}
          reperes={[
            { valeur: 0, label: '100 % euros' },
            { valeur: 30, label: '30' },
            { valeur: 60, label: '60' },
            { valeur: 100, label: '100 % UC' },
          ]}
          hint="Le reste va sur le fonds en euros. Plusieurs contrats bonifient leur taux au-delà d’un seuil."
        />

        <Segments<ClasseActif>
          label="Investies en"
          valeur={h.classeUC}
          onChange={(v) => {
            onChange('classeUC', v);
            onChange('rendementUC', RENDEMENT_BRUT[v]);
          }}
          options={CLASSES.filter((c) => c !== 'monetaire').map((c) => ({
            valeur: c,
            label: LIBELLES_CLASSES[c].replace('Actions monde', 'Actions').replace('Fonds diversifié', 'Mixte'),
          }))}
          hint="Un contrat qui ne propose pas cette classe sort de la comparaison plutôt que d’afficher un chiffre."
        />

        <details className="group rounded-xl border border-ink-200 bg-ink-50/60 px-4 py-3">
          <summary className="cursor-pointer list-none text-sm font-medium text-ink-700 transition hover:text-brand-700">
            <span className="inline-block transition group-open:rotate-90">›</span> Hypothèses de
            calcul
          </summary>

          <div className="mt-5 space-y-6">
            <Curseur
              label="Rendement brut attendu des UC"
              valeur={Math.round(h.rendementUC * 1000) / 10}
              min={BORNES.rendementUC.min * 100}
              max={BORNES.rendementUC.max * 100}
              pas={0.5}
              onChange={(v) => onChange('rendementUC', v / 100)}
              rendu={(v) => `${v} %`}
              saisie={{ suffixe: '%', decimales: 1 }}
              reperes={[
                { valeur: 0, label: '0' },
                { valeur: 7, label: '7' },
                { valeur: 15, label: '15' },
              ]}
              hint={`Avant tous frais, et volontairement le même pour les ${CONTRATS.length} contrats : un ETF et un fonds géré partent d’ici du même chiffre. Ce qui les sépare ensuite n’est que ce qu’on vous prélève dessus.`}
            />

            <Segments<Rebalancement>
              label="Remettre l’allocation à sa cible"
              valeur={h.rebalancement}
              onChange={(v) => onChange('rebalancement', v)}
              options={(['aucun', 'versements', 'annuel'] as const).map((r) => ({
                valeur: r,
                label: LIBELLES_REBALANCEMENT[r],
              }))}
              hint="Sans rééquilibrage, une cible de 60 % dérive vers 78 % en vingt ans — ce qui avantagerait mécaniquement les contrats à barème."
            />

            <Segments<SourceTaux>
              label="Taux du fonds en euros"
              valeur={h.sourceTaux}
              onChange={(v) => onChange('sourceTaux', v)}
              options={(['derniere-annee', 'moyenne-historique'] as const).map((s) => ({
                valeur: s,
                label: LIBELLES_SOURCE_TAUX[s].replace('Taux servi en ', ''),
              }))}
              hint="Un taux unique reconduit sur tout l’horizon, dans les deux cas. Aucun fonds en euros ne sert le même taux deux ans de suite."
            />

            <Curseur
              label="Inflation attendue"
              valeur={Math.round(h.inflation * 1000) / 10}
              min={BORNES.inflation.min * 100}
              max={BORNES.inflation.max * 100}
              pas={0.1}
              onChange={(v) => onChange('inflation', v / 100)}
              rendu={(v) => `${v} %`}
              saisie={{ suffixe: '%', decimales: 1 }}
              reperes={[
                { valeur: 0, label: '0' },
                { valeur: 2, label: '2 % — cible BCE' },
                { valeur: 5, label: '5' },
              ]}
              hint="Ne change aucun calcul ni aucun classement : la projection est en euros courants d’un bout à l’autre, et l’inflation frappe tous les contrats à l’identique. Elle sert uniquement à traduire le capital final en euros d’aujourd’hui."
            />

            <Segments<Foyer>
              label="Foyer fiscal"
              valeur={h.foyer}
              onChange={(v) => onChange('foyer', v)}
              options={(['seul', 'couple'] as const).map((f) => ({
                valeur: f,
                label: LIBELLES_FOYER[f],
              }))}
              hint="Décide de l’abattement annuel après huit ans : 4 600 € ou 9 200 €."
            />

            <Curseur
              label="Revalorisation des versements"
              valeur={Math.round(h.revalorisationVersements * 1000) / 10}
              min={BORNES.revalorisationVersements.min * 100}
              max={BORNES.revalorisationVersements.max * 100}
              pas={0.5}
              onChange={(v) => onChange('revalorisationVersements', v / 100)}
              rendu={(v) => `${v} %`}
              saisie={{ suffixe: '%', decimales: 1 }}
              hint={
                Math.abs(h.revalorisationVersements - h.inflation) < 1e-9
                  ? `Vos versements suivent exactement l’inflation que vous avez retenue : leur poids reste le même d’une année sur l’autre.`
                  : h.revalorisationVersements < h.inflation
                    ? `Vos versements augmentent moins vite que l’inflation (${taux(h.inflation)}) : ils perdent ${points(h.inflation - h.revalorisationVersements)} de pouvoir d’achat par an.`
                    : `Vos versements augmentent plus vite que l’inflation (${taux(h.inflation)}) : votre effort d’épargne grandit d’année en année.`
              }
            />
          </div>
        </details>
      </div>
    </div>
  );
}
