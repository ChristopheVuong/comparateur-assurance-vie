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
rend visible d'un coup d'œil le résultat central — chez Afer Multisupport et Macif, les frais
des supports pèsent plus lourd que ceux du contrat lui-même. Afer Génération fait exactement
l'inverse, pour un coût total presque identique : c'est tout l'intérêt de le voir.

Le détail d'un contrat distingue ensuite :

- **frais réellement prélevés** (versement et droits d'adhésion, gestion du contrat, frais
  courants des supports, frais sur encours, arbitrages) ;
- **coût avant impôt**, qui ajoute le rendement que ces frais n'ont pas produit ;
- **manque à gagner net**, qui retire l'impôt que ces frais ont indirectement épargné.

Les déductions sont classées par nature — `frais`, `penalite`, `impot` — parce que chacune
répond à une contrefactuelle différente. La réserve de fidélité perdue avant huit ans est
un `penalite` : un contrat sans aucun frais la perdrait tout autant, donc elle n'entre pas
dans ce que les frais coûtent, et elle est affichée à part.

## Contrats couverts

| Contrat | Assureur | Frais versement | Gestion UC | Fonds euros 2025 | Supports |
| --- | --- | --- | --- | --- | --- |
| Afer Multisupport | Abeille | 0,50 % euros / 0 % UC | 0,475 % | 2,65 %, sans barème | OPCVM de distribution, fonds immobilier |
| Afer Génération | Abeille | 0,50 % euros / 0 % UC | 1,175 % | 4,05 %, bloqué 8 ans | OPCVM *clean* |
| Macif Épargne Vie | Macif Vie | 0 % | 0,60 % | 2,70 → 2,90 % | 17 UC, ni ETF ni SCPI |
| Linxea Spirit 2 | Spirica | 0 % | 0,50 % | 3,08 % | ETF, SCPI, OPCVM |
| Fortuneo Vie | Suravenir | 0 % | 0,75 % | 3,00 → 4,50 % | ETF, SCPI, OPCVM |
| BoursoVie | Generali | 0 % | 0,75 % | 3,00 % | ETF (catalogue restreint), SCPI, OPCVM |

Chaque entrée du catalogue (`src/lib/contrats.ts`) porte ses sources et leur date de
consultation. Les taux de fonds euros sont annoncés chaque janvier et les grilles
tarifaires changent par avenant : ces données périment et doivent être revérifiées
périodiquement.

À ces tarifs s'ajoutent deux postes que le tableau ci-dessus ne montre pas mais que le moteur
facture : les **20 € de droits d'adhésion** à l'association Afer, et les **0,01 % de frais sur
encours** de Macif Épargne Vie.

## Deux façons de finir

Le même plan peut se dénouer de deux manières, et l'outil chiffre les deux. Tout ce qui
précède le dernier jour est identique — mêmes frais, mêmes poches, mêmes années, ce qu'un
invariant vérifie année par année. Ce qui change est le dernier paragraphe.

**Rachat.** Seule la part de plus-value contenue dans le rachat est taxée,
proportionnellement à la valeur du contrat. Après huit ans : abattement de 4 600 €
(9 200 € pour un couple), puis 7,5 % au prorata des primes sous 150 000 € et 12,8 % au-delà.
Avant huit ans : 12,8 % sans abattement. Les prélèvements sociaux (17,2 %) sont retenus
chaque année sur les intérêts du fonds en euros, à la sortie seulement sur les unités de
compte.

**Décès.** La plus-value ne rencontre jamais l'impôt sur le revenu. Restent les
prélèvements sociaux, puis les droits de succession — sur une règle qui ne dépend pas de
l'âge du contrat mais de **celui du souscripteur au moment de chaque versement** :

| | Primes versées avant 70 ans (art. 990 I) | Primes versées après 70 ans (art. 757 B) |
| --- | --- | --- |
| Abattement | 152 500 € **par bénéficiaire** | 30 500 € **au total**, tous bénéficiaires confondus |
| Porte sur | capital **et** gains | les **primes** seulement |
| Au-delà | 20 %, puis 31,25 % au-delà de 700 000 € de part taxable | barème ordinaire des successions |

Le contrat est coupé en deux au prorata des primes de part et d'autre de l'anniversaire.
Le taux du barème ordinaire est une **hypothèse réglable**, jamais un calcul : ce que
coûtent les primes versées après 70 ans dépend du lien de parenté et de tout ce que le
bénéficiaire reçoit par ailleurs, dont un contrat d'assurance-vie ne sait rien. L'assiette
est affichée à part pour que la multiplication soit refaisable.

Un test défend le résultat le moins intuitif du lot : « verser avant 70 ans » est une règle
de pouce et non une loi. Avec un seul bénéficiaire et une plus-value importante, l'article
757 B — qui **exonère les gains** — peut coûter moins cher que le 990 I qui les taxe. La
règle de pouce redevient vraie dès que plusieurs bénéficiaires sont nommés, puisque leurs
abattements se multiplient et que celui du 757 B, lui, se partage.

## Ce qui est réellement rachetable

Sur un fonds à garantie de fidélité, la valeur affichée sur le relevé et la somme que l'on
peut retirer sont deux nombres différents : la réserve n'est **pas rachetable**. Le moteur
reporte les deux à chaque année (`valeurFin` et `valeurRachat`) plutôt que de laisser
quelqu'un faire la soustraction.

`coutRachatPartiel` chiffre alors ce qu'un retrait en cours de route coûterait, sur deux
règles contractuelles et non arithmétiques :

- **le retrait est servi dans l'ordre où le contrat le sert** — Afer Génération l'impute par
  défaut sur tout sauf le fonds bloqué, donc une poche d'unités de compte détenue à côté
  encaisse le choc en premier et la réserve n'en sait rien ;
- **ce qui atteint la poche euros ampute la réserve au prorata de cette poche**, jamais en
  totalité. C'est la sortie **complète** du fonds qui détruit tout, et l'écart entre les
  deux est la seule question qui compte si un besoin d'argent survient avant le terme.

## Ce que le simulateur ne fait pas

- Il ne fait pas varier le rendement brut selon le contrat : un ETF et un fonds géré
  activement partent de la même hypothèse, pour ne comparer que les frais.
- Il n'affiche pas de chiffre pour un contrat qui ne propose pas la classe d'actifs
  demandée ; il sort du tableau avec le motif.
- Il ne projette **jamais** un taux promotionnel, même pendant la fenêtre de l'offre ; il
  calcule séparément ce qu'une offre encore ouverte vaudrait si elle durait, et cesse de le
  calculer une fois la date de fin passée.
- Il ne projette pas en pouvoir d'achat : toute la projection est en **euros courants**.
  L'inflation attendue sert uniquement à retraduire le capital final en euros d'aujourd'hui,
  sous le bandeau de résultat — elle n'entre dans aucun calcul et ne peut déplacer aucun
  classement, ce qu'un invariant vérifie. La revalorisation des versements est, elle, une
  augmentation nominale que l'utilisateur choisit, pas un suivi automatique des prix.
- Il ne devine pas qui hérite : le conjoint survivant et le partenaire de PACS sont exonérés
  de tout, et le calcul suppose des bénéficiaires qui ne le sont pas plutôt que de demander
  un lien de parenté pour répondre zéro.
- Il ne modélise pas ce qui suit le terme d'une garantie de fidélité — l'arbitrage vers le
  Fonds Garanti et le support fidélisant suivant. Au-delà de huit ans, il flatte donc Afer
  Génération, et le dit dans les réserves du contrat.
- Il ne conseille pas et ne recommande aucun contrat.

## Démarrer

```bash
npm install
npm run dev      # serveur de développement
npm test         # moteur, catalogues, fiscalité, formats, adresse, échelle, saisie, gardes
npm run build
npm run lint
```

## Architecture

Application statique : aucune dépendance d'exécution hors React, **aucun appel réseau, aucune
police distante, aucun stockage navigateur**. L'état complet du plan vit dans l'adresse.

`src/lib/statique.test.ts` fait échouer la suite si `fetch`, `localStorage` ou une lecture de
l'horloge apparaissent ailleurs que dans `App.tsx` — **et si `index.html` référence un hôte
quelconque**. Cette dernière garde a été ajoutée après coup : la page chargeait une feuille de
style Google Fonts, ce qui envoyait l'adresse IP de chaque visiteur à Google avant le premier
pixel, sur une page dont le pied promettait le contraire. Le garde-fou ne balayait que `src/`.

```
src/lib/
  supports.ts      catalogue des supports, frais courants, rendement par classe d'actifs
  contrats.ts       catalogue des six contrats, fonds en euros, barèmes, réserves, sources
  fiscalite.ts      prélèvements sociaux, abattement, assiette proportionnelle
  assuranceVie.ts   hypothèses, bornes, projection année par année, résultat
  url.ts            encodage de l'état dans l'adresse
  format.ts         mise en forme des nombres
  echelle.ts        échelle logarithmique du curseur de versement
  champNumerique.ts logique de frappe des champs numériques
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
- Échelle du curseur : croissance stricte, aller-retour position ↔ montant, bornes accordées
  avec celles du champ.
- Saisie numérique : virgule et point acceptés, second séparateur ignoré plutôt que produisant
  un `NaN`.
- Caractère statique de l'application — code **et** page livrée — et vocabulaire du modèle non
  dupliqué.

## Déploiement

Site statique déployé sur GitHub Pages via GitHub Actions (`.github/workflows/deploy.yml`) :
lint, tests et build sur chaque push, déploiement sur `main`.

## Crédits

Design inspiré de [fire-simulator](https://github.com/Commutator-IO/fire-simulator),
par mycaule ([mycaule](https://github.com/mycaule)).
