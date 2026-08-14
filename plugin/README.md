# Le plugin Figma

Le code source du plugin est **fourni dans ce dossier** (`manifest.json`, `code.js`, `ui.html`) :
il s'installe en local, en trois clics, sans build ni dépendance. Il est **gratuit et open
source**, sous [licence MIT](../LICENSE) comme le reste du kit.

Il transforme un composant Figma en fichier de données JSON — ses props, ses styles en tokens, ses
états, sa structure — avec un vérificateur de nomenclature qui propose les renommages et les
applique d'un clic. Tout tourne en local, sans aucun accès réseau.

## Ce qu'il fait

| Étape | Ce qu'il fait | Comment |
|---|---|---|
| Vérifier | Lint de la nomenclature (props, `state`, booléens, valeurs, layers, `status` fourre-tout, `tone` sur un champ de formulaire…) + propositions de renommage avant/après, appliquées d'un clic sur toutes les variantes — y compris **l'instance jamais renommée**, restée au nom de son composant source | Local, rien n'est modifié sans votre validation |
| Documenter | Fusionne le `doc.md` du composant (couche de jugement : description, règles, a11y, exemples) dans le JSON, **verbatim** | Local, déterministe — [la convention](../doc-composant.md) |
| Extraire | Props, styles liés aux tokens, états, structure et composition | Déterministe, local, **sans IA** |
| Auditer | Checklist de complétude (13 points, cochés ou non, avec où agir), lint de nomenclature, rapport Markdown copiable | Local |
| Tokens | Exporte la table des tokens **du fichier Figma entier** avec leurs valeurs résolues (les noms et les valeurs voyagent ensemble) | Local |

L'extraction est déterministe **exprès** : même composant, même donnée, à chaque fois. C'est ce qui
permet de regénérer sans crainte quand le Figma évolue, et de traiter la donnée comme une référence
d'audit plutôt que comme une interprétation.

La couche de jugement (description, règles, accessibilité) ne s'extrait pas de Figma : le JSON
liste les champs à compléter, à écrire vous-même ou avec votre IA, hors du plugin.

## Installation

**Ce qu'il faut** : Figma **Desktop** (l'import d'un plugin en développement n'existe pas dans
le navigateur) et un droit d'édition sur le fichier. Rien d'autre : pas de Node, pas de `npm
install`, pas de build. Le plugin est fait de trois fichiers que Figma lit directement.

**1. Récupérez les fichiers.** En clonant :

```bash
git clone https://github.com/Alexisvay/design-system-data.git
```

Ou, sans Git : bouton **Code → Download ZIP** sur
[la page du repo](https://github.com/Alexisvay/design-system-data), puis dézippez.

**2. Importez le manifeste.** Dans Figma Desktop, menu **Plugins → Development → Import plugin
from manifest…**, puis choisissez `design-system-data/plugin/manifest.json`.

**3. Lancez-le.** Le plugin apparaît dans **Plugins → Development → Component as Data**. Il porte
le nom de l'outil, pas celui du repo — c'est le même.

Quelques précisions utiles :

- **Ne déplacez pas le dossier `plugin/` après l'import** : Figma retient le chemin du manifeste.
  Si vous le bougez, réimportez-le.
- **L'interface du plugin est en anglais**, la documentation du kit est en français. Les titres de
  section du `doc.md` sont en anglais eux aussi (`## Description`, `## A11y`…), leur contenu est
  dans la langue de votre équipe.
- **Après une modification du code**, clic droit sur le canvas → **Plugins → Development →
  Hot reload plugin**, ou relancez simplement le plugin.
- **Version embarquée ici : 2.17**, affichée dans l'en-tête du plugin à côté de son nom.
  L'exemple [`../examples/button.json`](../examples/button.json) a été produit par la 2.16 — son
  champ `_tool` le trace. Les versions suivantes ne touchent qu'au lint et aux propositions de
  renommage, pas à la donnée extraite : la regénérer donne le même fichier.

## Utilisation

Le plugin se navigue au **stepper** (un écran par étape). Hors étape 1, une barre rappelle en
permanence le composant visé et ramène au choix de la cible d'un clic.

1. **Component** : sélectionnez un composant (ou un component set) sur le canvas. Sélectionner une
   instance remonte automatiquement à son master. C'est aussi de cet écran que part l'export
   **Tokens .json** : il porte sur le fichier entier (variables + styles de texte, valeurs
   résolues par mode) et ne demande aucune sélection.
2. **Nomenclature** : la lecture part toute seule à l'arrivée (locale, elle ne modifie rien) ; le
   plugin liste les renommages proposés, vous cochez, il applique. Les règles essentielles sont
   rappelées sur l'écran même.
3. **Doc** : glissez le `doc.md` du composant sur la zone de dépôt (ou cliquez pour parcourir) —
   sa couche de jugement est fusionnée dans le JSON. L'étape est sautable, mais sans elle
   **8 des 13 points** de la checklist restent décochés.
4. **Data** : Generate JSON — extraction + audit, les résultats s'affichent au même endroit
   (checklist de complétude, lint, JSON par sections). **Copy JSON** le met dans le
   presse-papier, **Export .json** télécharge le fichier, **Report .md** produit un rapport de
   santé Markdown prêt à coller dans un ticket.

Chaque étape porte son état dans le stepper : le numéro (à faire), `✓` (fait), `!` (à regarder —
des constats restent, ou le doc attaché n'a aucune section reconnue).

## Doc de composant (`doc.md`)

La couche de jugement (description, règles, exemples) peut vivre dans un Markdown **par
composant**, versionné dans votre repo, et fusionné au moment de « Generate JSON » (déposé à
l'étape 3). Convention : des titres `##` en anglais qui reprennent les champs, contenu libre
(français bienvenu), copié **tel quel** dans le JSON :

| Titre `##` | Champ JSON | Forme |
|---|---|---|
| `## Description` | `meta.description` | prose |
| `## Role` | `meta.role` | un mot (button, dialog…) |
| `## Platforms` | `platforms` | liste (ou une ligne avec virgules) |
| `## States` | `states.list` | liste |
| `## Interaction` | `interaction.pattern` | prose courte (APG/HIG/Material) |
| `## A11y` | `rules.a11y` | liste |
| `## Behavior` | `rules.behavior` | liste |
| `## Writing` | `rules.writing` | liste (microcopie : labels, erreurs, états vides) |
| `## Forbidden` | `rules.forbidden` **+** `api.invalidCombinations` | liste ; une ligne `axe=valeur + axe=valeur : raison` est aussi extraite en donnée vérifiable |
| `## Examples` | `examples` | liste (≥ 2) |

Les listes `- item` deviennent des tableaux JSON. Un titre non reconnu est **signalé, jamais avalé
en silence** ; le titre `#` de niveau 1 est ignoré (c'est le titre du doc). En cas de conflit
(description Figma vs doc), **le doc gagne** — un hint le signale. Le fichier reste la source de
vérité dans votre repo : le plugin fusionne, il n'édite pas. `_doc_source` trace le fichier utilisé
dans le JSON produit.

La convention complète, avec un exemple prêt à copier : [`../doc-composant.md`](../doc-composant.md).

**Les interdits, lisibles et vérifiables.** Une règle en prose se lit, elle ne se vérifie pas. Un
interdit qui porte sur une **combinaison de props**, écrit `tone=error + hierarchy=tertiary :
raison`, reste dans `rules.forbidden` **et** produit une entrée `api.invalidCombinations`
(`{when, reason}`). Les axes et les valeurs sont vérifiés contre `api.props` : une faute de frappe
est signalée, jamais transformée en règle fantôme. Ce qui ne rentre pas dans cette forme (interdit
d'usage, de composition, renvoi vers un autre composant) reste de la prose — rien ne peut le
vérifier automatiquement.

Une combinaison que Figma ne dessine pas n'est **pas** un interdit : c'est presque toujours une
variante que personne n'a faite. L'interdit se déclare à la main, parce qu'il relève du jugement.

Pour de meilleurs résultats, nommez props et layers selon la
[nomenclature](../nomenclature-composants.md) fournie avec ce plugin — le lint vous signale
précisément ce qui s'écarte — et les composants eux-mêmes selon
[le nommage](../nommage-composants.md).

## Les composants composés

Quand un composant en utilise un autre — un Button posé dans une Card, une base dont un composant
hérite — la donnée ne recopie pas l'enfant : elle le **référence**. Le JSON de la Card cite le
Button dans `structure.uses` et `structure.children` ; un composant bâti sur un master porte
`meta.extends`.

Conséquence directe : **les composants référencés doivent être extraits eux aussi**, y compris les
masters et les sous-éléments. Leurs états et leurs styles vivent dans **leur** JSON — sans eux, le
corpus est incomplet. Le plugin ne vous laisse pas l'oublier : il liste les dépendances à exporter
(« Composed by reference: also export … ») et distingue les jeux d'icônes, pour lesquels un export
SVG suffit.

Un master imbriqué non exposé est signalé aussi : sans `isExposedInstance`, le plugin ne peut pas
lire l'héritage (`extends` / `exposed`).

## Confidentialité

Aucun accès réseau (déclaré dans le `manifest.json`), aucune clé, aucune télémétrie : tout tourne
en local dans Figma.

## Limites connues, honnêtement

- La couche de jugement est **à écrire par un humain** : le plugin liste les trous, il ne les
  remplit pas.
- Le `## Anatomy` décrit dans certaines conventions **n'est pas lu** par cette version : la
  section serait signalée comme titre inconnu. Les titres reconnus sont ceux du tableau ci-dessus.
- Les dégradés, images et effets non tokenisés sont signalés, pas convertis.
- Sur les très gros sets, l'extraction prend son temps (progression affichée) — mais elle est
  complète : pas d'échantillonnage de la cascade.
- La donnée d'un gros component set est verbeuse. C'est le prix de l'exhaustivité.

## Licence

MIT — voir [LICENSE](../LICENSE). Utilisez, modifiez, partagez librement.
