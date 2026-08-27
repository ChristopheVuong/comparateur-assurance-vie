import { useEffect, useMemo, useState } from 'react'
import { comparer, type Hypotheses, type ResultatAccessible } from './lib/assuranceVie'
import { contrat, type CleContrat } from './lib/contrats'
import { decoderDetail, decoderEtat, encoderEtat, lienPartage } from './lib/url'
import { annees, eur, taux } from './lib/format'
import { Avertissement, Entete, Pied } from './components/Cadre'
import { Comparaison } from './components/Comparaison'
import { Detail } from './components/Detail'
import { Graphique } from './components/Graphique'
import { Methode } from './components/Methode'
import { Saisie } from './components/Saisie'

/**
 * One page, one question.
 *
 * There is no router and no tab strip: everything the visitor decides lives in
 * a handful of `useState` and travels in the address, which is the only place
 * the plan is written down. That is also the whole of the privacy story — no
 * storage, no request, no analytics.
 */
export default function App() {
  const [h, setH] = useState<Hypotheses>(() => decoderEtat(window.location.search))
  const [detail, setDetail] = useState<CleContrat | null>(() =>
    decoderDetail(window.location.search),
  )
  const [survole, setSurvole] = useState<string | null>(null)

  const maj = <K extends keyof Hypotheses>(cle: K, valeur: Hypotheses[K]) =>
    setH((e) => ({ ...e, [cle]: valeur }))

  const resultats = useMemo(() => comparer(h), [h])
  const classes = useMemo(
    () =>
      resultats
        .filter((r): r is ResultatAccessible => r.accessible)
        .sort((a, b) => b.capitalNet - a.capitalNet),
    [resultats],
  )

  // Debounced, and a replace rather than a push: a link should be shareable
  // without every notch of a slider becoming an entry in the back button.
  useEffect(() => {
    const minuteur = setTimeout(() => {
      const requete = encoderEtat(h, { detail })
      const { pathname, hash } = window.location
      window.history.replaceState(null, '', `${pathname}${requete}${hash}`)
    }, 250)
    return () => clearTimeout(minuteur)
  }, [h, detail])

  const ouvert = detail ? (classes.find((r) => r.cle === detail) ?? null) : null
  const tete = classes[0]
  const queue = classes.at(-1)
  const ecart = tete && queue ? tete.capitalNet - queue.capitalNet : 0

  return (
    <>
      <Entete lienPartage={lienPartage(h, { detail })} />

      <main>
        {/* ------------------------------------- Hero */}

        <section className="border-b border-ink-200/70 bg-white">
          <div className="mx-auto max-w-6xl px-5 py-12 sm:py-16">
            <h1 className="max-w-3xl text-3xl font-semibold leading-[1.1] tracking-tight text-ink-900 sm:text-5xl">
              Deux contrats, le même versement, et {tete ? eur(ecart) : 'des milliers d’euros'}{' '}
              d’écart.
            </h1>
            <p className="mt-5 max-w-2xl leading-relaxed text-ink-500">
              La fiscalité de l’assurance-vie est la même partout. Ce qui change d’un contrat à
              l’autre, ce sont les frais — et pas ceux qu’on met en avant. Un tiers de l’écart
              vient du tarif de l’enveloppe ; les deux autres tiers viennent de ce qu’on vous
              laisse acheter avec.
            </p>
            <div className="mt-6 max-w-3xl">
              <Avertissement />
            </div>
          </div>
        </section>

        {/* ------------------------------------- Simulateur */}

        <section className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-5 xl:col-span-4">
              <div className="lg:sticky lg:top-20">
                <Saisie h={h} onChange={maj} />
              </div>
            </div>

            <div className="space-y-6 lg:col-span-7 xl:col-span-8">
              {tete ? (
                <div className="card overflow-hidden">
                  <div className="bg-brand-700 px-6 py-6 text-white sm:px-8">
                    <div className="text-sm text-brand-100">
                      Le meilleur des six vous rend, net d’impôt, après {annees(h.horizon)}
                    </div>
                    <div className="tabular mt-1 text-4xl font-semibold sm:text-5xl">
                      {eur(tete.capitalNet)}
                    </div>
                    <div className="mt-2 text-sm text-brand-100">
                      {contrat(tete.cle).libelle} — pour {eur(tete.primesVersees)} versés, et{' '}
                      {eur(tete.manqueAGagner)} laissés en frais malgré tout.
                    </div>
                  </div>
                  {queue && queue !== tete && (
                    <p className="px-6 py-4 text-sm leading-relaxed text-ink-600 sm:px-8">
                      Le dernier, {contrat(queue.cle).libelle}, en rend{' '}
                      <strong className="font-semibold text-brique-600">{eur(ecart)}</strong> de
                      moins — soit {taux(ecart / Math.max(1, tete.primesVersees))} de tout ce que
                      vous aurez versé, pour exactement le même effort d’épargne.
                    </p>
                  )}
                </div>
              ) : (
                <div className="card px-6 py-8 text-sm leading-relaxed text-ink-500">
                  Aucun contrat ne peut être comparé avec ces paramètres. Augmentez le versement
                  initial, ou choisissez une classe d’actifs que ces contrats proposent.
                </div>
              )}

              <Comparaison
                resultats={resultats}
                detail={detail}
                onDetail={setDetail}
              />

              {ouvert && <Detail r={ouvert} />}

              <Graphique resultats={classes} survole={survole} onSurvol={setSurvole} />
            </div>
          </div>
        </section>
      </main>

      <Methode />
      <Pied />
    </>
  )
}
