# Comparateur d'assurance-vie

Simulateur qui compare six contrats d'assurance-vie français sur un seul critère : le
capital net rendu après impôt, à versements et allocation identiques.

La fiscalité de l'assurance-vie est la même pour tous les contrats. Ce qui les distingue,
ce sont les frais — de versement, de gestion, des supports eux-mêmes — et c'est ce que
l'outil chiffre.

## Fonctionnement

Un même plan (versement initial, versement programmé, durée, part d'unités de compte,
classe d'actifs) est projeté dans les six contrats. Chacun applique sa propre structure de
frais et son propre fonds en euros ; le rendement brut des unités de compte, lui, est
identique pour tous, pour que la comparaison ne porte que sur les frais.

Le tableau comparatif décompose le taux de frais annuel de chaque contrat en une barre à
échelle commune : plus elle est longue, plus le contrat coûte cher à détenir. C'est ce qui
rend visible d'un coup d'œil le résultat central — chez AFER et Macif, les frais des
supports pèsent plus lourd que ceux du contrat lui-même.

Le détail d'un contrat distingue ensuite :

- **frais réellement prélevés** (versement, gestion, supports, arbitrages) ;
- **coût avant impôt**, qui ajoute le rendement que ces frais n'ont pas produit ;
- **manque à gagner net**, qui retire l'impôt que ces frais ont indirectement épargné.

Les déductions sont classées par nature — `frais`, `penalite`, `impot` — parce que chacune
répond à une contrefactuelle différente. La réserve de fidélité perdue avant huit ans est
un `penalite` : un contrat sans aucun frais la perdrait tout autant, donc elle n'entre pas
dans ce que les frais coûtent, et elle est affichée à part.

## Contrats couverts

| Contrat | Assureur | Frais versement | Gestion UC | Fonds euros 2025 | Supports |
| --- | --- | --- | --- | --- | --- |
| Afer Multisupport | Abeille | 0,50 % euros / 0 % UC | 0,475 % | 2,65 %, sans barème | OPCVM de distribution |
| Afer Génération | Abeille | 0,50 % euros / 0 % UC | 1,175 % | 4,05 %, bloqué 8 ans | OPCVM *clean* |
| Macif Épargne Vie | Macif Vie | 0 % | 0,60 % | 2,70 → 2,90 % | 17 UC, ni ETF ni SCPI |
| Linxea Spirit 2 | Spirica | 0 % | 0,50 % | 3,08 % | ETF, SCPI |
| Fortuneo Vie | Suravenir | 0 % | 0,75 % | 3,00 → 4,50 % | ETF, SCPI |
| BoursoVie | Generali | 0 % | 0,75 % | 3,00 % | ETF (catalogue restreint) |

Chaque entrée du catalogue (`src/lib/contrats.ts`) porte ses sources et leur date de
consultation. Les taux de fonds euros sont annoncés chaque janvier et les grilles
tarifaires changent par avenant : ces données périment et doivent être revérifiées
périodiquement.

## Fiscalité modélisée

Seule la part de plus-value contenue dans un rachat est taxée, proportionnellement à la
valeur du contrat. Après huit ans : abattement de 4 600 € (9 200 € pour un couple), puis
7,5 % au prorata des primes sous 150 000 € et 12,8 % au-delà. Avant huit ans : 12,8 % sans
abattement. Les prélèvements sociaux (17,2 %) sont retenus chaque année sur les intérêts du
fonds en euros, à la sortie seulement sur les unités de compte.

## Ce que le simulateur ne fait pas

- Il ne fait pas varier le rendement brut selon le contrat : un ETF et un fonds géré
  activement partent de la même hypothèse, pour ne comparer que les frais.
- Il n'affiche pas de chiffre pour un contrat qui ne propose pas la classe d'actifs
  demandée ; il sort du tableau avec le motif.
- Il ne projette pas les taux promotionnels au-delà de leur échéance ; il calcule
  séparément ce qu'une offre en cours vaudrait si elle était structurelle.
- Il ne modélise pas l'inflation : tous les montants sont en **euros courants**, et la
  revalorisation des versements est une augmentation nominale que l'utilisateur choisit,
  pas un suivi automatique des prix. Cela ne change aucun classement — l'inflation frappe
  tous ces contrats à l'identique — mais un capital affiché à vingt ans vaut nettement moins
  que le même nombre aujourd'hui.
- Il ne conseille pas et ne recommande aucun contrat.

## Démarrer

```bash
npm install
npm run dev      # serveur de développement
npm test         # moteur, catalogues, fiscalité, adresse, caractère statique
npm run build
npm run lint
```

## Architecture

Application statique : aucune dépendance d'exécution hors React, aucun appel réseau,
aucun stockage navigateur. L'état complet du plan vit dans l'adresse. Cette propriété est
vérifiée par `src/lib/statique.test.ts`, qui fait échouer le build si `fetch`,
`localStorage` ou un accès à l'horloge apparaissent en dehors du point d'entrée.

```
src/lib/
  supports.ts      catalogue des supports, frais courants, rendement par classe d'actifs
  contrats.ts       catalogue des six contrats, fonds en euros, barèmes, réserves, sources
  fiscalite.ts      prélèvements sociaux, abattement, assiette proportionnelle
  assuranceVie.ts   hypothèses, bornes, projection année par année, résultat
  url.ts            encodage de l'état dans l'adresse
  format.ts         mise en forme des nombres
```

Chaque catalogue (contrats, supports, postes de frais) est un tableau de données typées
avec ses propres tests d'invariants (bornes plausibles, unicité des clés, sources datées).
Ajouter un contrat est une entrée de tableau ; le reste de l'application s'ajuste
automatiquement.

Les composants ne nomment jamais une donnée du modèle. Le catalogue `POSTES` est déclaré
`as const satisfies Record<keyof CoutsPreleves, …>` : ajouter un poste de frais sans le
décrire **ne compile pas**, et `src/lib/vocabulaire.test.ts` interdit d'indexer
`coutsPreleves.` hors du moteur. Les deux gardes ont été vérifiées en les cassant
volontairement.

## Tests

- Bouclage comptable de la projection sur une grille exhaustive de scénarios.
- Monotonies (plus de frais ⇒ moins de capital, dans tous les cas).
- Cas limites : 0 % et 100 % d'unités de compte, horizon d'un an, versements nuls, marché
  baissier.
- Fiscalité vérifiée en forme close.
- Invariants de catalogue (bornes, unicité, fraîcheur des sources).
- Caractère statique de l'application, et vocabulaire du modèle non dupliqué.

## Déploiement

Site statique déployé sur GitHub Pages via GitHub Actions (`.github/workflows/deploy.yml`) :
lint, tests et build sur chaque push, déploiement sur `main`.
