# Nomenclature des propriétés et des layers

Une convention clé en main pour nommer vos composants dans Figma, afin qu'ils puissent être
transformés en données (JSON) de façon fiable, sans rattrapage manuel. **La donnée qui sort
mesure la qualité du composant qui entre.**

## Les noms de props

Les props Figma deviennent l'API du composant, dans la donnée puis dans le code. Écrivez-les
en kebab-case, sans emoji ni préfixe décoratif (`hierarchy`, pas `[🎨] Hierarchy`), avec des
valeurs en minuscules (`primary`, pas `Primary`), et réutilisez exactement le même vocabulaire
sur tous vos composants : c'est ce qui rend la donnée prévisible et le mapping vers le code
identique partout.

| Prop | Ce qu'elle pilote | Valeurs | Côté code |
|---|---|---|---|
| `state` | L'état d'interaction | `enabled`, `hover`, `focus`, `press`, `disabled` | Les états d'interaction de la techno (`press` : souvent `active`) |
| `is-*` | Un état booléen (`is-selected`, `is-loading`, `is-open`) | `true` / `false` | L'attribut d'état correspondant (`selected`, `expanded`, `loading`) |
| `size` | L'échelle | `xs`, `sm`, `md`, `lg`, `xl` | Prop `size`, quasi universelle |
| `hierarchy` | Le poids visuel d'une action | `primary`, `secondary`, `tertiary` | Prop `hierarchy` ; alias `variant`, `appearance` |
| `tone` | La couleur sémantique d'un composant d'affichage (Tag, Badge, Alert) | `neutral`, `brand`, `success`, `warning`, `error`, `info` | Alias `status`, `severity`, `intent` |
| `type` | La déclinaison structurelle propre au composant | Valeurs métier (`search` / `text` pour un Input) | Prop `type` |
| `show-*` | La visibilité d'un sous-élément (`show-icon`, `show-label`) | `true` / `false` | Rendu conditionnel |
| `{layer texte}` | Le contenu éditable d'un texte | Du texte libre | Prop du même nom (`label`, `title`) |
| `{instance}` | Le composant qui remplace une instance imbriquée | Une instance de la bibliothèque | Prop du même nom (`icon`, `avatar`) |
| `{zone}` | Une zone de contenu libre, qui accepte plusieurs enfants | Plusieurs enfants | La zone de contenu (slot) |
| `selection` | La sélection d'un contrôle cochable à trois états | `unchecked`, `checked`, `indeterminate` | `aria-checked` : `true` / `false` / `mixed` |
| `validation` | Le retour de validation d'un champ (Input, Select) | `default`, `error`, `success` | L'état d'erreur du champ ; alias `status` |
| `status` | La phase du cycle de vie d'un composant à processus (Upload, Stepper) | Les phases métier : `default`, `processing`, `completed`, `filled`, `error` | Prop `status` (un Upload : `uploading`, `done`) |
| `shape` | La forme du contour (Button, Avatar, Skeleton) | `square`, `rounded`, `pill`, `circle` | Prop `shape` ; alias `radius` |
| `placement` | Où le composant s'ancre (Tooltip, Popover) | `top`, `bottom`, `left`, `right` | Prop `placement` ; alias `position`, `side` |
| `orientation` | La disposition | `horizontal`, `vertical` | Prop `orientation` ; alias `direction` |

La colonne « Côté code », ici comme dans les tableaux suivants, décrit la correspondance dans
son principe, avec les alias les plus répandus : chaque techno (web, mobile natif…) a ses
propres constructions, à traduire dans le vocabulaire de votre stack. Deux alias méritent une
mise en garde. `variant` est le nom le plus courant de `hierarchy` en code, mais il est ambigu
dans Figma, où « variante » désigne déjà autre chose. Et `mode`, parfois employé pour `tone`,
entre en collision avec les modes de variables. Quant au suffixe que Figma ajoute tout seul
aux props (`#4:12`), il ne dépend pas de vous : c'est à l'outil d'extraction de le retirer.

### Les trois props qui reprennent un nom

Les props de texte, d'instance et de slot n'inventent pas leur nom : elles reprennent celui de
ce qu'elles remplissent. La prop qui remplit le layer `button-label` s'appelle `label`, celle
qui remplace l'instance `icon` s'appelle `icon`, celle qui ouvre la zone `content` s'appelle
`content`. C'est ce lien de nom à nom qui permet de relier la prop à son élément sans deviner.

### Quatre axes qu'on confond

`state`, `tone`, `validation` et `status` se ressemblent assez pour se mélanger, et c'est la
confusion la plus fréquente d'une librairie à l'autre.

- **`state`** est l'interaction, et il vit à part des trois autres : un champ peut être
  `error` **et** `hover`, un Upload peut être `processing` **et** `hover`.
- **`tone`** est une couleur sémantique, rien de plus. Selon les libs, `brand` s'y appelle
  `accent` et `error` s'y appelle `danger`.
- **`validation`** est le retour d'un champ de formulaire : un état fonctionnel, pas une
  couleur, même s'il se peint souvent comme `tone`.
- **`status`** est une phase de cycle de vie, sur un composant à processus. Ce n'est pas un
  fourre-tout, et c'est l'axe qui dérive le plus vite.

Quand la valeur de `status` ne décrit pas une phase, c'est qu'un autre axe est demandé :

| Ce que la valeur décrit | ✅ / ❌ | L'axe juste |
|---|---|---|
| Une déclinaison structurelle | ❌ `status=avatar/icon`, `status=main-menu/secondary-menu` | `type` |
| Une ouverture / un repli | ❌ `status=open/close` | `is-open` |
| Un ancrage, un alignement | ❌ `status=left-aligned/right-aligned` | `placement` ou `orientation` |
| Une phase de processus | ✅ `status=processing/completed` | `status` |

Cinq règles d'usage de ce vocabulaire :

- **Un axe = une décision.** Quand une prop mélange deux choses (`style=primary-large`), on
  la sépare en deux axes, `hierarchy` et `size`.
- **Mêmes noms partout.** Un `size` qui s'appelle `size` sur le Button et `scale` sur le Tag
  casse la prévisibilité. C'est l'homonymie inverse, tout aussi coûteuse.
- **Un état ne vit qu'à un seul endroit** — plus généralement, **des valeurs mutuellement
  exclusives vivent sur un seul axe**. C'est la règle qui explique `state` comme `selection`.
  Un élément désactivé ne peut pas être `hover` : `disabled` est donc une valeur de `state`,
  pas un booléen `is-disabled` qui ferait exister la combinaison.
  Un contrôle cochable ne peut pas être à la fois coché et indéterminé **à l'écran** : les
  trois états vont sur `selection`. À l'inverse, une sélection binaire n'exclut rien — une
  pill sélectionnée se survole — donc `is-selected` reste un booléen. **L'arité de l'axe suit
  celle du domaine**, et c'est le rôle ARIA qui l'arbitre : `aria-selected` est binaire,
  `aria-checked` admet `mixed`.
- **Le nom ne porte pas le type.** Pas de `icon-swap` ni de `label-text`. Dans la donnée
  extraite, chaque prop est déjà typée (`"type": "instance-swap"`), la machine sait à quoi elle
  a affaire. Le nom, lui, reste celui de la prop du code, et c'est ce qui permet à une IA
  d'utiliser la prop `icon` juste, du premier coup.
- **Les noms côté code varient d'une lib à l'autre** (`variant`, `tone`, `severity`…). Peu
  importe le camp que votre équipe choisit. Ce qui compte, c'est une correspondance stable entre
  Figma et le code, écrite une fois et appliquée partout.

### Deux booléens qui se recouvrent : la précédence, pas l'interdit

Reste un cas de bord : un contrôle déjà modélisé en `is-selected` + `is-indeterminate`, que
personne n'a envie de refondre dans Figma pour passer à `selection`. Il n'y a pas besoin
d'interdire la combinaison — il suffit de dire **qui gagne**.

C'est exactement ce que fait la plateforme : dans le DOM, `checked` et `indeterminate` sont
deux propriétés **indépendantes**, et `:indeterminate` l'emporte à l'écran. La combinaison
n'est donc pas impossible, elle est **résolue**.

Dans la donnée, la résolution s'écrit une fois, dans `styles.precedence` : l'axe le plus à
droite gagne.

```json
"precedence": ["type", "size", "state", "is-selected", "is-indeterminate", "show-label"]
```

Conséquence sur les `when` : un override ou un arbre que la précédence décide déjà **ne doit
pas épingler l'axe perdant**. `{"is-indeterminate": "true"}` se suffit — écrire
`{"is-selected": "false", "is-indeterminate": "true"}` laisse la moitié des cas sans rendu,
et fait passer un trou de cascade pour une combinaison interdite.

Il reste alors un seul vrai interdit à déclarer, et il vient du standard : `type=radio` +
`is-indeterminate=true`, parce qu'ARIA n'admet pas `mixed` sur un radio. Au rendu,
`is-indeterminate=true` s'annonce `aria-checked="mixed"` quelle que soit la valeur de
`is-selected`.

Cette liste couvre les axes récurrents, pas l'exhaustivité : vos composants métier en
ajouteront. Les cinq règles ci-dessus s'appliquent alors aux nouveaux axes.

## Les noms de layers

Le nom d'un layer devient la clé de l'élément dans la donnée. Deux impératifs, valables partout.
Le même élément porte **le même nom dans toutes les variantes** du set, et **aucun layer stylé
ne garde un nom générique** (`Vector`, `Rectangle 2`) ni ne partage son nom avec un autre.

| Élément | Nom recommandé | ✅ / ❌ | Côté code |
|---|---|---|---|
| Les frames de structure (box, header, footer) | `{composant}-{zone}` | ✅ `checkbox-box`, `card-header` · ❌ `Rectangle 5`, `Frame 27` | Le sous-élément ou la balise de structure du même nom |
| Les textes | `{composant}-label` pour le nom accessible, `{composant}-hint` pour l'aide, le rôle pour les autres (`{composant}-title`, `{composant}-description`…) | ✅ `checkbox-label`, `alert-title` · ❌ `Text 3` | Le libellé, le titre, le texte d'aide relié pour l'accessibilité |
| Les instances imbriquées (icône, avatar, logo…) | leur rôle, côté position si besoin (c'est ce nom que la prop de swap reprend) | ✅ `icon-left`, `avatar` · ❌ `Vector`, `Component 3` | Le composant enfant |
| Les zones de contenu libre | le nom de la zone (c'est ce nom que la prop de slot reprend) | ✅ `content`, `actions` · ❌ `Frame 12` | La zone d'enfants (slot) |

### Le piège de l'instance jamais renommée

Quand vous posez l'instance d'un composant dans un autre, Figma nomme le calque d'après le
composant d'origine, et ce nom reste tel quel tant que personne n'y touche. Une `Bottom-bar`
bâtie sur le master `_Bottom-bar-item` se retrouve donc avec des calques `_Bottom-bar-item`
que vous n'avez jamais nommés vous-même.

Ces noms sont à reprendre, et pas seulement pour une question de casse. Un calque dit **ce
qu'il fait dans le composant qui l'accueille**, pas ce qu'il est ailleurs dans la librairie :
c'est `item` ou `bottom-bar-item`, exactement comme une icône imbriquée s'appelle `icon-left`
et non `Arrow-right`. Le tiret bas, lui, n'a rien à faire sur un calque : il ne veut dire
qu'une chose, qu'un composant est interne (voir [le nommage des composants](nommage-composants.md)),
et un calque n'est ni public ni interne.

Le plugin repère ce cas et propose le renommage en un clic. Le signal est déterministe : le
calque porte **exactement** le nom de son composant source, donc personne ne l'a nommé. Quand la
source est une sous-partie de l'hôte, le rôle se déduit et la proposition arrive cochée
(`_Bottom-bar-item` dans `Bottom-bar` → `item`) ; sinon elle attend votre arbitrage. Un nom que
vous avez choisi, lui, n'est jamais touché — `card-header` sur un master `_Card-header` est
conforme, et le plugin le laisse tranquille.

## Un composant nommé de bout en bout

Le même Button, passé par toute la nomenclature :

| Ce qu'on nomme | Le choix |
|---|---|
| Les axes de variantes | `state` (`enabled`, `hover`, `focus`, `press`, `disabled`), `size` (`sm`, `md`, `lg`), `hierarchy` (`primary`, `secondary`, `tertiary`) |
| Le booléen de visibilité | `show-icon` |
| La prop d'instance swap | `icon`, le nom de l'instance qu'elle remplace |
| La prop de texte | `label` (remplit le layer `button-label`) |
| Les layers | `button-content`, `button-label`, `icon` |

## La correspondance Figma → données → code

Chaque convention côté Figma a un équivalent direct côté code, et c'est le fil conducteur de
toute la nomenclature. Nommer au plus près du code rend le passage en données utile aux deux
mondes.

| Côté Figma | Dans la donnée | Côté code |
|---|---|---|
| Prop `hierarchy` (kebab-case) | `props.hierarchy` | La prop du composant, même nom |
| Axe `state` (`hover`, `focus`…) | `states`, avec les overrides de chaque état | Les états d'interaction de la techno |
| Booléen `show-icon` | Prop de visibilité | Rendu conditionnel |
| Booléen `is-open` | État booléen | L'attribut d'état correspondant (`expanded`) |
| Booléen `is-selected` | État booléen | `aria-selected` (sélection binaire entre pairs) |
| Axe `selection` | Axe à trois valeurs | `aria-checked` : `true` / `false` / `mixed` |
| Prop de texte `label` | `props.label`, typée texte | La prop de contenu du même nom |
| Prop de swap `icon` | `props.icon`, typée instance-swap | Le composant enfant injecté |
| Prop de slot `content` | `props.content`, typée slot | La zone d'enfants |
| Layer `checkbox-box` | La clé de l'élément dans les styles | Le sous-élément stylable du même nom |

## Pourquoi cette nomenclature

Transformer un composant Figma en données, c'est extraire ses propriétés, ses styles, ses
états et sa structure vers un fichier qu'une machine peut lire. La qualité de cette
extraction dépend directement de la façon dont le composant est construit : un composant mal
nommé peut produire une donnée fausse — deux calques homonymes donnent des clés qui changent
d'une extraction à l'autre — ou, au mieux, une donnée plus pauvre qu'il faut ensuite corriger à
la main.

C'est aussi ce qui rend la chose vérifiable. Chaque convention de ce document se contrôle
automatiquement, donc l'outil qui transforme vos composants en données peut du même geste
faire le contrôle qualité, en pointant ce qui est à corriger directement dans Figma.

## Ce que la nomenclature ne corrige pas

La couche de jugement (accessibilité, comportement clavier, règles d'usage, intention produit)
n'est pas dans Figma, quel que soit le nommage. Elle vient des standards (WCAG, APG) et de votre
documentation. Bien structurer le Figma rend l'extraction propre ; ça ne fait pas apparaître
« Espace coche la case ».

Cette couche a sa propre convention : [la doc de composant](doc-composant.md), un Markdown par
composant fusionné dans la donnée à la génération. Les deux documents sont les deux moitiés du
même contrat.

