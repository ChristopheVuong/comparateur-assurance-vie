import {
  LIBELLES_GROUPE,
  LIBELLES_MOTIF,
  POSTES,
  POSTES_RECURRENTS,
  sommeTaux,
  type Resultat,
  type ResultatAccessible,
  type TauxAnnuel,
} from '../lib/assuranceVie';
import { contrat, type CleContrat } from '../lib/contrats';
import { support } from '../lib/supports';
import { eur, taux } from '../lib/format';
import { BarreFrais, COULEURS_POSTES } from './BarreFrais';

/**
 * Which pocket the fee column is about.
 *
 * The column reports the unit-linked charge, because that is where fees are
 * visible and where contracts actually differ. A plan holding no units would
 * then be shown a rate it does not pay, so those rows report the euro pocket
 * instead — not a dash, because `fraisSurEncours` is genuinely levied there and
 * "small, so we hid it" is the move this whole tool exists to contradict.
 *
 * Deliberately not a blended rate. Every contract in the catalogue publishes
 * its euro rate net of management fees, so the euro leg's zero is a fact about paperwork
 * rather than about price: blending would print 0,00 % for a euro-only plan on
 * a contract that does charge, and would make the column a property of the plan
 * instead of a property of the contract.
 */
const tauxAnnuel = (r: ResultatAccessible): TauxAnnuel =>
  r.partUCVisee === 0 ? r.tauxAnnuelEuros : r.tauxAnnuelUC;

/**
 * The answer, one row per contract.
 *
 * The component knows nothing about any particular contract: it walks whatever
 * the engine hands back, in catalogue order but sorted by outcome. Adding a
 * seventh contract adds a row and touches nothing here.
 *
 * Contracts that drop out stay on the page, greyed, with the reason spelled
 * out. A missing row reads as an oversight; a row saying "this contract does
 * not sell what you asked for" is an answer, and often the most useful one.
 */
export function Comparaison({
  resultats,
  detail,
  onDetail,
}: {
  resultats: Resultat[];
  detail: CleContrat | null;
  onDetail: (cle: CleContrat | null) => void;
}) {
  const accessibles = resultats
    .filter((r): r is ResultatAccessible => r.accessible)
    .sort((a, b) => b.capitalNet - a.capitalNet);
  const ecartes = resultats.filter((r) => !r.accessible);
  const tete = accessibles[0]?.capitalNet ?? 0;

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[42rem] text-sm">
          <caption className="sr-only">
            Capital net rendu par chaque contrat, à versements et allocation identiques, avec le
            détail de leurs frais annuels
          </caption>
          <thead>
            <tr className="border-b border-ink-200 text-left text-xs uppercase tracking-wide text-ink-400">
              <th scope="col" className="px-5 py-3 font-medium">
                Contrat
              </th>
              <th scope="col" className="whitespace-nowrap px-5 py-3 text-right font-medium">
                Frais annuels des UC
              </th>
              <th scope="col" className="whitespace-nowrap px-5 py-3 text-right font-medium">
                Capital net
              </th>
              <th scope="col" className="px-5 py-3 text-right font-medium">
                Écart
              </th>
            </tr>
          </thead>

          <tbody>
            {accessibles.map((r) => {
              const c = contrat(r.cle);
              const s = support(r.supportRetenu);
              const ouvert = detail === r.cle;
              const premier = r.capitalNet === tete;
              return (
                <tr
                  key={r.cle}
                  className={[
                    'border-b border-ink-100 transition last:border-0',
                    ouvert ? 'bg-brand-50' : 'hover:bg-ink-50',
                  ].join(' ')}
                >
                  <th scope="row" className="px-5 py-3 text-left font-normal">
                    <button
                      type="button"
                      onClick={() => onDetail(ouvert ? null : r.cle)}
                      aria-expanded={ouvert}
                      className="text-left"
                    >
                      <span
                        className={[
                          'font-semibold',
                          ouvert ? 'text-brand-700' : 'text-ink-900',
                        ].join(' ')}
                      >
                        {c.libelle}
                      </span>
                      {premier && (
                        <span className="ml-2 rounded-full bg-jade-100 px-2 py-0.5 text-[11px] font-medium text-jade-700">
                          en tête
                        </span>
                      )}
                      {/* Material even when it does not move a figure: a
                          contract you cannot subscribe to is still worth
                          comparing if you already hold it, and worth marking
                          if you do not. */}
                      {!c.ouvertALaSouscription && (
                        <span className="ml-2 rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-medium text-ink-600">
                          fermé
                        </span>
                      )}
                      <span className="mt-0.5 block max-w-sm text-xs leading-relaxed text-ink-500">
                        {c.assureur} · {s.libelle}
                      </span>
                    </button>
                  </th>

                  <td className="tabular px-5 py-3 text-right align-top">
                    <span className="text-ink-700">{taux(sommeTaux(tauxAnnuel(r)))}</span>
                    {r.partUCVisee === 0 && (
                      <span className="mt-0.5 block text-[11px] text-ink-400">
                        sur le fonds en euros
                      </span>
                    )}
                    <BarreFrais
                      cle={r.cle}
                      tauxAnnuel={tauxAnnuel(r)}
                      contexte={
                        r.partUCVisee === 0
                          ? 'Frais annuels du fonds en euros'
                          : 'Frais annuels des unités de compte'
                      }
                    />
                  </td>

                  <td className="tabular px-5 py-3 text-right align-top font-semibold text-ink-900">
                    {eur(r.capitalNet)}
                  </td>

                  <td className="tabular px-5 py-3 text-right align-top">
                    {premier ? (
                      <span className="text-ink-300">—</span>
                    ) : (
                      <span className="text-brique-600">{eur(r.capitalNet - tete)}</span>
                    )}
                  </td>
                </tr>
              );
            })}

            {ecartes.map((r) => (
              <tr key={r.cle} className="border-b border-ink-100 bg-ink-50/60 last:border-0">
                <th scope="row" className="px-5 py-3 text-left font-normal">
                  <span className="font-semibold text-ink-400">{contrat(r.cle).libelle}</span>
                  <span className="mt-0.5 block max-w-sm text-xs leading-relaxed text-ink-400">
                    {!r.accessible && LIBELLES_MOTIF[r.motif]}
                  </span>
                </th>
                <td colSpan={3} className="px-5 py-3 text-right align-top text-xs text-ink-300">
                  hors comparaison
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-ink-200/70 bg-ink-50 px-5 py-4">
        <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
          {POSTES_RECURRENTS.map((p) => (
            <li key={p} className="flex items-center gap-1.5 text-xs text-ink-600">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: COULEURS_POSTES[p] }}
              />
              {LIBELLES_GROUPE[POSTES[p].groupe]}
            </li>
          ))}
        </ul>
        <p className="mt-2.5 text-xs leading-relaxed text-ink-500">
          Les barres partagent une même échelle : plus elle est longue, plus le contrat coûte cher à
          détenir. Ce sont les frais des supports qui font l’essentiel de l’écart — la ligne que les
          brochures ne mettent jamais en avant. Sur le fonds en euros, tous ces contrats déduisent
          déjà leurs frais du taux qu’ils publient : un taux proche de zéro n’y est donc pas une
          bonne nouvelle. Cliquez une ligne pour voir où part l’argent.
        </p>
      </div>
    </div>
  );
}
