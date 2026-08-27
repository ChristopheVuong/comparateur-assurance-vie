import { LIBELLES_MOTIF, type Resultat, type ResultatAccessible } from '../lib/assuranceVie';
import { contrat, type CleContrat } from '../lib/contrats';
import { support } from '../lib/supports';
import { eur, taux } from '../lib/format';

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
        <table className="w-full min-w-[46rem] text-sm">
          <caption className="sr-only">
            Capital net rendu par chaque contrat, à versements et allocation identiques
          </caption>
          <thead>
            <tr className="border-b border-ink-200 text-left text-xs uppercase tracking-wide text-ink-400">
              <th scope="col" className="px-5 py-3 font-medium">
                Contrat
              </th>
              <th scope="col" className="px-5 py-3 text-right font-medium">
                Frais annuels
              </th>
              <th scope="col" className="px-5 py-3 text-right font-medium">
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
                      <span className="mt-0.5 block max-w-sm text-xs leading-relaxed text-ink-500">
                        {c.assureur} · {s.libelle}
                      </span>
                    </button>
                  </th>

                  <td className="tabular px-5 py-3 text-right align-top">
                    <span className="text-ink-700">{taux(r.fraisAnnuelsUC)}</span>
                    <span className="mt-0.5 block text-[11px] text-ink-400">
                      dont {taux(s.ter)} de support
                    </span>
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

      <p className="border-t border-ink-200/70 bg-ink-50 px-5 py-4 text-xs leading-relaxed text-ink-500">
        La colonne « frais annuels » additionne ce que prélève le contrat et ce que prélève le fonds
        lui-même. C’est la seconde qui fait l’essentiel de l’écart, et c’est celle que les brochures
        ne mettent jamais en avant. Cliquez une ligne pour voir où part l’argent.
      </p>
    </div>
  );
}
