# Comparateur d'assurance-vie

« À versements égaux, combien chaque contrat me rend-il vraiment ? »

La fiscalité de l'assurance-vie est la même pour tout le monde. Ce qui sépare deux
contrats, ce sont les frais — et pas ceux que les brochures mettent en avant.

Ce simulateur passe **le même plan dans six contrats français** et rend, pour chacun,
le capital net après impôt. Tout ce que vous saisissez leur est appliqué à l'identique ;
ce qui diffère n'est que ce qu'on vous prélève. C'est ce qui fait de la réponse un prix
plutôt qu'une prévision.

## Ce qu'il montre, et qui est contre-intuitif

**Le différenciateur n'est pas le tarif de l'enveloppe, c'est le catalogue de supports.**

À 0,475 % de frais de gestion sur les unités de compte, **l'enveloppe AFER est moins chère
que celle de Fortuneo ou de BoursoVie**. Elle finit pourtant dernière. Ce qui coûte à ses
adhérents, ce n'est pas le contrat : c'est l'absence d'ETF, qui les laisse avec des OPCVM
maison à 1,05 % de frais courants là où un tracker mondial en coûte 0,20 %.

Sur le plan par défaut — 1 000 € d'apport, 200 € par mois, vingt ans, 60 % d'unités de
compte — le premier rend **6 310 € de plus** que le dernier, pour exactement le même effort
d'épargne. Et dans le détail d'AFER Multisupport, les frais des supports (2 150 €) pèsent
plus du double des frais du contrat lui-même.

Corollaire : **les frais sur versement, très mis en avant commercialement, sont
marginaux.** 2,5 % une fois coûtent à peu près ce que coûte un cinquième de point par an.
L'argument commercial court dans l'autre sens.

## Les six contrats

| Contrat | Assureur | Versement | Gestion UC | Fonds euros 2025 | Supports |
| --- | --- | --- | --- | --- | --- |
| Afer Multisupport | Abeille | 0,50 % euros / 0 % UC | 0,475 % | 2,65 %, sans barème | OPCVM de distribution |
| Afer Génération | Abeille | 0,50 % euros / 0 % UC | 1,175 % | 4,05 %, bloqué 8 ans | OPCVM *clean* |
| Macif Épargne Vie | Macif Vie | 0 % | 0,60 % | 2,70 → 2,90 % | 17 UC, ni ETF ni SCPI |
| Linxea Spirit 2 | Spirica | 0 % | 0,50 % | 3,08 % | ETF, SCPI |
| Fortuneo Vie | Suravenir | 0 % | 0,75 % | 3,00 → 4,50 % | ETF, SCPI |
| BoursoVie | Generali | 0 % | 0,75 % | 3,00 % | ETF (catalogue pauvre) |

Données relevées le **27 août 2026** sur les notes d'information, fiches de transparence
des frais, comptes-rendus de gestion paritaire et pages de taux des assureurs. Chaque
entrée du catalogue porte ses sources et leur date de consultation. **Ces données
périment** : les taux sont annoncés chaque janvier, les grilles changent par avenant.

Trois faits que la recherche a corrigés au passage : *Multi Vie*, *Livret Vie* et
*Actiplus* sont **fermés à la souscription** depuis juin 2024 ; *Mutavie* s'appelle **Macif
Vie SE** depuis mars 2026 ; et les « plafonds MACIF » qui circulent n'existent pas dans la
note d'information de juin 2026. La seule contrainte d'allocation dure du panel est celle
de **Fortuneo**, dont le fonds *Suravenir Rendement 2* exige 30 % d'UC à chaque versement.

## Démarrer

```bash
npm install
npm run dev      # serveur de développement
npm test         # 115 tests sur le moteur, les catalogues, la fiscalité et l'adresse
npm run build
npm run lint
```

## Comment le calcul marche

Deux poches suivies séparément — le fonds en euros et les unités de compte — chacune avec
sa base de versements pour la fiscalité proportionnelle. **L'ordre des opérations dans
l'année change le résultat**, il est donc arbitré explicitement :

1. Les versements arrivent, revalorisés s'il y a lieu. Les droits d'adhésion sortent du
   premier et ne sont jamais investis.
2. Les frais sur versement sont prélevés **avant tout rendement**. On ne gagne rien sur
   l'argent que l'assureur a gardé ; l'inverse offrirait à chaque contrat une année de
   rendement sur ses propres frais.
3. Les frais annuels se composent **multiplicativement** : `(1 − ter) × (1 − fg)`, pas
   `1 − ter − fg`. Ils sont prélevés sur la valeur, pas sur le versement.
4. Les versements sont crédités **en milieu d'année**. Les porter au 1ᵉʳ janvier leur
   offrirait une année pleine de rendement qu'ils n'ont pas eue.
5. Les prélèvements sociaux de 17,2 % sont retenus **chaque année** sur les intérêts du
   fonds en euros et déduits de la poche — donc leur coût se compose lui aussi. Sur les
   unités de compte, ils n'interviennent qu'à la sortie.
6. Rééquilibrage en dernier, facturé au tarif d'arbitrage du contrat.

À la sortie, seule la **part de plus-value** contenue dans le rachat est taxée : abattement
de 4 600 € ou 9 200 € après huit ans, puis 7,5 % au prorata des primes sous 150 000 € et
12,8 % au-delà. Le seuil est un prorata, pas une falaise, et l'abattement ne touche jamais
les prélèvements sociaux.

### Deux mesures du coût, et pas une

`coutsPreleves` est la somme de ce qui a réellement été retenu ; elle boucle exactement.
`coutFraisAvantImpot` y ajoute le rendement que cet argent n'a pas produit.
`manqueAGagner` en retire l'impôt que ces frais vous ont épargné — **un euro pris par
l'assureur est un euro que le fisc ne taxe pas**, et ignorer ce retour ferait paraître les
frais plus chers qu'ils ne sont. C'est le troisième chiffre qu'on montre à un épargnant,
parce que c'est celui qu'il perd.

## Ce que le simulateur refuse de faire

- **Projeter un taux promotionnel.** Les 4,50 % de vitrine supposent une part d'UC, un
  versement neuf et deux millésimes. Le calcul retient le taux structurel, et chiffre à
  part ce que la promotion vaudrait si elle durait.
- **Faire varier le rendement selon le contrat.** Un ETF et un fonds géré activement
  partent du même rendement brut, qui n'est pas un champ du support mais de la classe
  d'actifs — le type l'interdit. Leur donner des espérances différentes trancherait le
  débat gestion active contre indicielle au lieu de chiffrer les frais.
- **Substituer un support voisin.** Un contrat qui ne propose pas la classe demandée sort
  du tableau avec son motif, plutôt que d'afficher un chiffre pour un produit qu'on ne peut
  pas acheter chez lui.
- **Chiffrer une clause non chiffrée.** La MACIF se réserve le droit de limiter les
  versements sur son fonds en euros sans publier de seuil : c'est une réserve affichée, pas
  un plafond inventé. Un champ non chiffrable est un mensonge typé.

## Ce qu'il ne prétend pas faire

Il ne conseille pas. Il reconduit un taux de fonds en euros constant, alors qu'aucun n'a
servi le même taux deux ans de suite. Le rendement des unités de compte est **votre
hypothèse**, pas une donnée. Il suppose un rachat total au terme, alors qu'étaler la sortie
permet de reprendre l'abattement chaque année. Et il prête l'abattement de 4 600 € à chaque
contrat, alors qu'il est commun à tous ceux d'un même foyer.

## Architecture

Aucune dépendance d'exécution en dehors de React. Pas de routeur, pas de gestionnaire
d'état, pas de bibliothèque de graphiques — le SVG est écrit à la main. Aucune donnée ne
quitte le navigateur : l'adresse est le seul endroit où votre plan est écrit.

```
src/lib/
  supports.ts      catalogue des supports, frais courants, rendement par classe d'actifs
  contrats.ts      catalogue des six contrats, fonds en euros, barèmes, réserves, sources
  fiscalite.ts     prélèvements sociaux, abattement, assiette proportionnelle
  assuranceVie.ts  hypothèses, bornes, projection année par année, résultat
  url.ts           l'état partageable
  format.ts        la mise en forme, au bord de l'application
```

Le moteur n'arrondit rien : une projection qui arrondirait en chemin dériverait, et
l'identité comptable sur laquelle reposent les tests cesserait de boucler.

Le patron central est le **catalogue de données** : une union littérale de clés, un tableau
de records typés, des accesseurs purs, et un fichier de tests dédié aux invariants du
catalogue. Ajouter un septième contrat, c'est ajouter une entrée — le tableau, le
graphique et l'adresse s'ajustent seuls.

Les tests couvrent le bouclage comptable de chaque année sur une grille exhaustive, les
monotonies, les cas dégénérés (0 % et 100 % d'UC, horizon d'un an, versements nuls,
marché en baisse), la fiscalité en forme fermée, les invariants de catalogue — et **la
thèse elle-même** : qu'AFER perd plus que son tarif ne l'explique, et que lui donner accès
aux ETF referme les deux tiers de l'écart.
