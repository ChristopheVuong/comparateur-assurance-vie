import { CONTRATS, DATE_RELEVE } from '../lib/contrats';
import { RESERVES_FISCALES } from '../lib/fiscalite';
import { RENDEMENT_BRUT, SUPPORTS, LIBELLES_CLASSES, CLASSES } from '../lib/supports';
import { taux } from '../lib/format';

/**
 * How the figures are arrived at, and what they are worth.
 *
 * Written out because a comparison of named products that will not show its
 * working is advertising. Everything a reader would need to disagree with a
 * row of the table is here: the order of operations, the charges assumed, and
 * the things the model refuses to pretend it knows.
 */
export function Methode() {
  return (
    <section id="methode" className="border-t border-ink-200/70 bg-white">
      <div className="mx-auto max-w-6xl px-5 py-12 sm:py-16">
        <h2 className="text-2xl font-semibold tracking-tight text-ink-900">Méthode et sources</h2>
        <p className="mt-2 max-w-3xl leading-relaxed text-ink-500">
          Le même plan est passé dans les {CONTRATS.length} contrats. Tout ce que vous saisissez leur est
          appliqué à l’identique ; ce qui diffère n’est que ce qu’on vous prélève. C’est ce qui
          fait de la réponse un prix, et non une prévision.
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="card p-6 sm:p-8">
            <h3 className="text-base font-semibold text-ink-900">Une année, dans l’ordre</h3>
            <ol className="mt-4 space-y-3 text-sm leading-relaxed text-ink-500">
              <Etape n={1}>
                Les versements de l’année arrivent, revalorisés s’il y a lieu. Les droits
                d’adhésion sortent du premier et ne sont jamais investis.
              </Etape>
              <Etape n={2}>
                Les frais sur versement sont prélevés <strong>avant tout rendement</strong>. On ne
                gagne rien sur l’argent que l’assureur a gardé — l’inverse offrirait à chaque
                contrat une année de rendement sur ses propres frais.
              </Etape>
              <Etape n={3}>
                Les frais annuels se composent <strong>multiplicativement</strong>, jamais par
                addition : ils sont prélevés sur la valeur, pas sur le versement.
              </Etape>
              <Etape n={4}>
                Les versements sont crédités <strong>en milieu d’année</strong>. Les porter au 1
                <sup>er</sup> janvier leur offrirait une année pleine de rendement qu’ils n’ont pas
                eue.
              </Etape>
              <Etape n={5}>
                Les prélèvements sociaux de 17,2 % sont retenus <strong>chaque année</strong> sur
                les intérêts du fonds en euros, et déduits de la poche — donc leur coût se compose
                lui aussi. Sur les unités de compte, ils n’interviennent qu’à la sortie.
              </Etape>
              <Etape n={6}>
                À la sortie, seule la <strong>part de plus-value</strong> contenue dans le rachat
                est taxée : abattement de 4 600 € ou 9 200 € après huit ans, puis 7,5 % au prorata
                des primes sous 150 000 € et 12,8 % au-delà.
              </Etape>
            </ol>
          </div>

          <div className="card p-6 sm:p-8">
            <h3 className="text-base font-semibold text-ink-900">
              Ce que ce simulateur refuse de faire
            </h3>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-ink-500">
              <Limite titre="Projeter un taux promotionnel.">
                Les 4,50 % ou 5 % affichés en vitrine supposent une part d’unités de compte, un
                versement neuf et une fenêtre de deux millésimes. Le calcul retient le taux
                structurel, et chiffre à part ce que la promotion vaudrait si elle durait.
              </Limite>
              <Limite titre="Faire varier le rendement selon le contrat.">
                Un ETF et un fonds géré activement partent du même rendement brut. Leur donner des
                espérances différentes trancherait le débat gestion active contre indicielle au
                lieu de chiffrer les frais.
              </Limite>
              <Limite titre="Substituer un support voisin.">
                Un contrat qui ne propose pas la classe d’actifs demandée sort du tableau avec son
                motif, plutôt que d’afficher un chiffre pour un produit qu’on ne peut pas acheter
                chez lui.
              </Limite>
              <Limite titre="Chiffrer une clause non chiffrée.">
                La MACIF se réserve le droit de limiter les versements sur son fonds en euros sans
                publier de seuil. C’est une réserve affichée, pas un plafond inventé.
              </Limite>
              <Limite titre="Prétendre que les taux durent.">
                Un taux unique est reconduit sur tout l’horizon. Aucun fonds en euros n’a servi le
                même taux deux ans de suite.
              </Limite>
            </ul>
          </div>
        </div>

        {/* ------------------------------------- Supports */}

        <h3 className="mt-12 text-base font-semibold text-ink-900">
          Les frais courants retenus par support
        </h3>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-500">
          C’est ici que se joue l’essentiel, et c’est la ligne que les brochures ne mettent pas en
          avant. Le rendement brut ne dépend que de la classe d’actifs, jamais de l’emballage —
          c’est ce qui garantit que la comparaison ne porte que sur les frais.
        </p>
        <div className="card mt-4 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-left text-xs uppercase tracking-wide text-ink-400">
                  <th scope="col" className="px-5 py-3 font-medium">Support</th>
                  <th scope="col" className="px-5 py-3 font-medium">Classe</th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">Frais courants</th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">Rendement brut</th>
                </tr>
              </thead>
              <tbody>
                {SUPPORTS.map((s) => (
                  <tr key={s.cle} className="border-b border-ink-100 last:border-0">
                    <th scope="row" className="px-5 py-2.5 text-left font-normal text-ink-900">
                      {s.libelle}
                    </th>
                    <td className="px-5 py-2.5 text-ink-500">{LIBELLES_CLASSES[s.classe]}</td>
                    <td className="tabular px-5 py-2.5 text-right font-medium text-ink-900">
                      {taux(s.ter)}
                    </td>
                    <td className="tabular px-5 py-2.5 text-right text-ink-500">
                      {taux(RENDEMENT_BRUT[s.classe])}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-ink-200/70 bg-ink-50 px-5 py-3 text-xs leading-relaxed text-ink-500">
            Les rendements bruts par défaut —{' '}
            {CLASSES.map((c) => `${LIBELLES_CLASSES[c].toLowerCase()} ${taux(RENDEMENT_BRUT[c])}`).join(
              ', ',
            )}{' '}
            — sont des hypothèses de départ, modifiables dans le panneau de saisie. Ils ne sont pas
            des prévisions.
          </p>
        </div>

        {/* ------------------------------------- Sources */}

        <h3 className="mt-12 text-base font-semibold text-ink-900">D’où viennent les chiffres</h3>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-500">
          Notes d’information, fiches de transparence des frais, comptes-rendus de gestion et pages
          de taux des assureurs, relevés le {DATE_RELEVE.split('-').reverse().join('/')}.{' '}
          <strong className="font-medium text-ink-700">Ces données périment :</strong> les taux sont
          annoncés chaque janvier et les grilles changent par avenant.
        </p>
        <ul className="mt-4">
          {CONTRATS.map((c) => (
            <li key={c.cle} className="border-b border-ink-200/70 py-4 last:border-0">
              <div className="text-sm font-semibold text-ink-900">{c.libelle}</div>
              <ul className="mt-1.5 space-y-1">
                {c.sources.map((s) => (
                  <li key={s.url} className="text-sm">
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-ink-600 underline decoration-ink-300 underline-offset-2 transition hover:text-brand-700"
                    >
                      {s.libelle}
                    </a>
                    <span className="ml-2 text-xs text-ink-400">
                      {new URL(s.url).hostname.replace('www.', '')} ↗
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>

        <h3 className="mt-10 text-base font-semibold text-ink-900">Réserves d’ordre général</h3>
        <ul className="mt-3 max-w-3xl space-y-2.5 text-sm leading-relaxed text-ink-500">
          {RESERVES_FISCALES.map((texte) => (
            <li key={texte} className="border-l-2 border-ink-200 pl-3">
              {texte}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Etape({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="tabular mt-0.5 h-fit shrink-0 rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}

function Limite({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <li>
      <strong className="font-semibold text-ink-800">{titre}</strong> {children}
    </li>
  );
}
