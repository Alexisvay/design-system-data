# Exemples

Les trois fichiers de ce dossier forment **une seule chaîne**, celle du
[processus](../processus.md) : un composant Figma + un `doc.md` → un JSON, plus la table des
tokens qui l'accompagne.

| Fichier | Ce que c'est |
|---|---|
| [`button-doc.md`](button-doc.md) | L'**entrée écrite à la main** : la couche de jugement du Button |
| [`button.json`](button.json) | La **sortie du plugin**, doc fusionnée comprise |
| [`tokens.json`](tokens.json) | La table des tokens cités, avec leurs valeurs résolues |

## `button.json`

La sortie du plugin sur un **Button de production** — celui qui sert de fil rouge à l'article,
choisi précisément parce qu'il n'avait rien d'exemplaire au départ.

C'est un **extrait** : le fichier réel fait plus de 200 Ko et porte l'intégralité de la cascade
du component set, sans échantillonnage — 294 overrides sur ce ré-export (plugin 2.16, tracé par `_tool`). Ici, 7
overrides représentatifs ont été gardés — un par axe (taille, état, hiérarchie, tonalité,
icon-only) — pour que le fichier reste lisible d'un coup d'œil. **Tout le reste est la sortie
brute, telle que le plugin la produit** : rien n'a été réécrit à la main.

Ce qu'il faut y regarder :

| Section | Ce qu'elle porte | D'où elle vient |
|---|---|---|
| `meta` | Nom, type, rôle, description | Figma + `## Description` du doc |
| `api.props` | L'API du composant : chaque axe, ses valeurs, son défaut, et pour `state` le mapping runtime (`hover` → `:hover`) | Figma |
| `structure` | Slots, enfants, composants **référencés** (`uses`) et l'arbre réel par variante. Les composants cités sont à extraire eux aussi : leurs styles vivent dans leur propre JSON | Figma |
| `styles.precedence` | L'ordre qui arbitre la cascade : l'axe le plus à droite gagne | Figma |
| `styles.default` | Le rendu de la variante par défaut, tokens à l'appui | Figma |
| `styles.overrides` | Ce que chaque combinaison change, avec son `when` | Figma |
| `platforms`, `states`, `interaction`, `rules`, `examples` | La couche de jugement : plateformes, états runtime, pattern APG, a11y, comportement, microcopie, interdits, usages | `button-doc.md`, fusionné verbatim |
| `_doc_source`, `_tool` | La traçabilité : quel doc, quelle version du plugin | Le plugin |

Aucune couleur en dur : chaque valeur peinte cite un token
(`{"token": "color/bg/brand/mid/hover"}`).

## `button-doc.md`

Le Markdown que le plugin a fusionné pour produire le JSON ci-dessus — c'est lui que trace
`_doc_source`. Comparez les deux fichiers section par section : `## A11y` devient `rules.a11y`,
`## Forbidden` devient `rules.forbidden`, chaque `- item` devient une entrée de tableau. Rien
n'est édité, résumé ni inventé au passage.

**Un piège, visible ici même.** La ligne d'interdit du Button est écrite avec des backticks :

```markdown
- `tone=error` + `state=disabled` : le destructif grisé perd son signal de danger…
```

Elle **ressemble** à la forme parsable décrite dans [`doc-composant.md`](../doc-composant.md),
mais les backticks font partie de la valeur lue : le plugin cherche `error` et trouve
`` error` ``. La ligne reste donc de la prose dans `rules.forbidden` — c'est pourquoi ce
`button.json` n'a **pas** de `api.invalidCombinations` — et le plugin le signale dans son lint
plutôt que d'inventer une règle. Écrite sans backticks, la même ligne produirait en plus :

```json
"invalidCombinations": [
  { "when": { "tone": "error", "state": "disabled" }, "reason": "le destructif grisé perd son signal de danger…" }
]
```

C'est exactement le comportement annoncé — **une faute de frappe ne crée jamais une règle
fantôme** — et la raison pour laquelle les axes s'écrivent nus dans un `## Forbidden`.

## `tokens.json`

La table des tokens **cités dans l'extrait**, avec leurs valeurs résolues. C'est le second export
du plugin (bouton « Tokens .json », étape 1), et c'est ce qui rend la donnée autoportante : les
noms et les valeurs voyagent ensemble, une IA en aval n'a pas à deviner ce que vaut
`color/bg/brand/mid/enabled`.

Sur un vrai corpus, l'export porte sur **tout le fichier Figma** (variables + styles de texte,
par mode) : une table pour le design system entier, pas une par composant.
