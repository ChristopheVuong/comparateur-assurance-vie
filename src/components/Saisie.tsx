import {
  BORNES,
  ECHEANCES,
  LIBELLES_DENOUEMENT,
  LIBELLES_PERIODICITE,
  LIBELLES_REBALANCEMENT,
  LIBELLES_SOURCE_TAUX,
  type Denouement,
  type Hypotheses,
  type Periodicite,
  type Rebalancement,
  type SourceTaux,
} from '../lib/assuranceVie';
import { CONTRATS } from '../lib/contrats';
import { LIBELLES_FOYER, TMI, type Foyer, type TauxMarginal } from '../lib/fiscalite';
import { ABATTEMENT_757B, ABATTEMENT_990I, AGE_PIVOT } from '../lib/succession';
import { CLASSES, LIBELLES_CLASSES, RENDEMENT_BRUT, type ClasseActif } from '../lib/supports';
import { annees, eur, points, taux } from '../lib/format';
import { Curseur, CurseurLog, Montant, Segments } from './Champs';

/**
 * The plan, as the visitor describes it.
 *
 * Ordered the way somebody actually thinks about it — how much, for how long,
 * how exposed — with the assumptions that reward a second look (the gross
 * return, the rebalancing rule, the euro-rate source, inflation, the household
 * and the uprating) folded away at the bottom rather than greeting anyone on
 * arrival.
 *
 * One control here is not a preference but a claim about the world, and it is
 * flagged as such: the gross expected return applies identically to every
 * contract in the catalogue. Letting it vary per contract would smuggle the active-versus-index
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

        <Segments<Denouement>
          label="À l’arrivée"
          valeur={h.denouement}
          onChange={(v) => onChange('denouement', v)}
          options={(['rachat', 'deces'] as const).map((d) => ({
            valeur: d,
            label: LIBELLES_DENOUEMENT[d].replace('Vous récupérez l’argent', 'Vous rachetez').replace(
              'Vos bénéficiaires le reçoivent',
              'Transmission',
            ),
          }))}
          hint={
            h.denouement === 'rachat'
              ? 'Un rachat total au terme : la plus-value est imposée, et une réserve de fidélité non encore acquise est perdue.'
              : `Le capital est réglé aux bénéficiaires. La plus-value échappe alors totalement à l’impôt sur le revenu — ce sont les droits de succession qui prennent le relais, sur une règle qui dépend de votre âge à chaque versement.`
          }
        />

        {h.denouement === 'deces' && <Transmission h={h} onChange={onChange} />}

        <Retrait h={h} onChange={onChange} />

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
              hint="Sans rééquilibrage, les unités de compte prenant plus de valeur, la part réelle s’éloigne de votre cible au fil des ans — ce qui avantagerait mécaniquement les contrats à barème. Le détail d’un contrat donne la part atteinte à l’arrivée."
            />

            <Segments<SourceTaux>
              label="Taux du fonds en euros"
              valeur={h.sourceTaux}
              onChange={(v) => onChange('sourceTaux', v)}
              options={(['derniere-annee', 'moyenne-historique'] as const).map((s) => ({
                valeur: s,
                label: LIBELLES_SOURCE_TAUX[s].replace('Taux servi en ', ''),
              }))}
              hint="Un taux unique reconduit sur tout l’horizon, dans les deux cas. Aucun assureur ne s’engage sur le taux de l’an prochain : c’est l’hypothèse la plus fragile du calcul."
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

            {/* A bracket list and not a checkbox. "Intégrer à l'impôt sur le
                revenu" reads as "and therefore pay nothing", which is true in
                one bracket out of five: past eight years the flat rate is
                7,5 %, so the option costs more from 11 % upwards. Naming the
                bracket is what makes that visible instead of surprising. */}
            <Segments<string>
              label="Imposition de la plus-value"
              valeur={h.baremeIR === null ? 'forfaitaire' : String(Math.round(h.baremeIR * 100))}
              onChange={(v) =>
                onChange('baremeIR', v === 'forfaitaire' ? null : (Number(v) / 100) as TauxMarginal)
              }
              options={[
                { valeur: 'forfaitaire', label: 'Forfaitaire' },
                ...TMI.map((t) => ({
                  valeur: String(Math.round(t * 100)),
                  label: `${Math.round(t * 100)} %`,
                })),
              ]}
              hint={
                h.baremeIR === null
                  ? 'Le prélèvement forfaitaire s’applique par défaut : 7,5 % après huit ans sous 150 000 € de primes, 12,8 % sinon. Sélectionnez votre tranche marginale pour chiffrer l’option pour le barème à la place.'
                  : `Option pour le barème, à votre tranche de ${Math.round(h.baremeIR * 100)} %. Elle remplace le forfaitaire qu’elle vous soit favorable ou non — l’abattement, lui, reste dû. L’option est globale : elle s’applique la même année à tous vos revenus de capitaux mobiliers.`
              }
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

/**
 * The withdrawal taken along the way — off by default, and folded away until
 * somebody asks for it.
 *
 * A checkbox would have been a third state to carry; instead the amount *is*
 * the switch, because a withdrawal of nothing is no withdrawal, and the engine
 * already reads it that way. Setting it back to zero turns the branch off
 * completely, which an invariant pins.
 */
function Retrait({
  h,
  onChange,
}: {
  h: Hypotheses;
  onChange: <K extends keyof Hypotheses>(cle: K, valeur: Hypotheses[K]) => void;
}) {
  const retrait = h.rachatIntermediaire;
  const maxAnnee = Math.max(1, h.horizon - 1);
  const annee = Math.min(retrait?.annee ?? Math.ceil(maxAnnee / 2), maxAnnee);

  if (h.horizon < 2) return null;

  return (
    <details
      open={retrait !== null}
      className="group rounded-xl border border-ink-200 bg-ink-50/60 px-4 py-3"
    >
      <summary className="cursor-pointer list-none text-sm font-medium text-ink-700 transition hover:text-brand-700">
        <span className="inline-block transition group-open:rotate-90">›</span> Retirer de
        l’argent en cours de route
      </summary>

      <div className="mt-5 space-y-6">
        <Montant
          label="Montant du retrait"
          valeur={retrait?.montant ?? 0}
          onChange={(v) =>
            onChange('rachatIntermediaire', v > 0 ? { annee, montant: v } : null)
          }
          min={BORNES.rachatIntermediaire.min}
          max={BORNES.rachatIntermediaire.max}
          placeholder="0"
          hint="Un seul retrait, servi dans la limite de ce que le contrat peut réellement racheter — une réserve de fidélité n’en fait pas partie. À zéro, il n’y a pas de retrait du tout."
        />

        {retrait && (
          <Curseur
            label="Année du retrait"
            valeur={annee}
            min={1}
            max={maxAnnee}
            pas={1}
            onChange={(v) => onChange('rachatIntermediaire', { annee: v, montant: retrait.montant })}
            rendu={(v) => `année ${v}`}
            hint={`L’argent retiré cesse de travailler, et l’impôt est dû à cette date : avant huit ans d’ancienneté, sans abattement. La sortie finale, elle, tombe une autre année fiscale et reprend le sien.`}
          />
        )}
      </div>
    </details>
  );
}

/**
 * The three things a death benefit needs to know, and that a withdrawal never
 * asks.
 *
 * Grouped in a block of their own rather than folded into the assumptions
 * drawer, and shown only when they bite. The age is first because it is the one
 * that moves the figure: on this rule a birthday is worth more than any fee
 * schedule in the catalogue, and burying it under a fold would misrepresent
 * which decision the reader is actually making.
 */
function Transmission({
  h,
  onChange,
}: {
  h: Hypotheses;
  onChange: <K extends keyof Hypotheses>(cle: K, valeur: Hypotheses[K]) => void;
}) {
  const ageFinal = h.ageSouscription + h.horizon - 1;
  const bascule = AGE_PIVOT - h.ageSouscription + 1;
  const toutAvant = ageFinal < AGE_PIVOT;
  const toutApres = h.ageSouscription >= AGE_PIVOT;

  return (
    <div className="space-y-6 rounded-xl border border-brand-100 bg-brand-50/50 px-4 py-4">
      <Curseur
        label="Votre âge au premier versement"
        valeur={h.ageSouscription}
        min={BORNES.ageSouscription.min}
        max={BORNES.ageSouscription.max}
        pas={1}
        onChange={(v) => onChange('ageSouscription', v)}
        rendu={(v) => `${v} ans`}
        saisie={{ suffixe: 'ans' }}
        reperes={[
          { valeur: 40, label: '40' },
          { valeur: 70, label: '70 ans' },
          { valeur: 90, label: '90' },
        ]}
        hint={
          toutApres
            ? `Tout est versé après 70 ans : l’abattement tombe à ${eur(ABATTEMENT_757B)} pour l’ensemble des bénéficiaires et de vos contrats — mais les gains, eux, sont exonérés de droits.`
            : toutAvant
              ? `Tout est versé avant 70 ans : chaque bénéficiaire reçoit ${eur(ABATTEMENT_990I)} hors droits, gains compris.`
              : `Vos versements changent de régime à la ${bascule}ᵉ année. Avant : ${eur(ABATTEMENT_990I)} d’abattement par bénéficiaire. Après : ${eur(ABATTEMENT_757B)} pour tout le monde.`
        }
      />

      <Curseur
        label="Nombre de bénéficiaires"
        valeur={h.beneficiaires}
        min={BORNES.beneficiaires.min}
        max={BORNES.beneficiaires.max}
        pas={1}
        onChange={(v) => onChange('beneficiaires', v)}
        rendu={(v) => (v > 1 ? `${v} personnes` : '1 personne')}
        hint={`L’abattement de ${eur(ABATTEMENT_990I)} vaut par bénéficiaire : les désigner nommément multiplie ce qui passe hors droits. Le conjoint ou partenaire de PACS, lui, est exonéré de tout — ce calcul suppose qu’ils ne le sont pas.`}
      />

      {!toutAvant && (
        <Curseur
          label="Taux de droits supposé après 70 ans"
          valeur={Math.round(h.tauxDroitsSuccession * 1000) / 10}
          min={BORNES.tauxDroitsSuccession.min * 100}
          max={BORNES.tauxDroitsSuccession.max * 100}
          pas={1}
          onChange={(v) => onChange('tauxDroitsSuccession', v / 100)}
          rendu={(v) => `${v} %`}
          saisie={{ suffixe: '%', decimales: 1 }}
          reperes={[
            { valeur: 0, label: '0 — exonéré' },
            { valeur: 20, label: '20 — enfant' },
            { valeur: 45, label: '45' },
          ]}
          hint="Une hypothèse, jamais un calcul : ce que coûtent les primes versées après 70 ans dépend du lien de parenté et de tout ce que le bénéficiaire reçoit par ailleurs, ce qui n’est pas une propriété du contrat."
        />
      )}
    </div>
  );
}
