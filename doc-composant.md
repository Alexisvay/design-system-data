# Convention de doc composant

Un composant en données a deux sources. Figma fournit le mesurable — props, styles, états,
structure — tout ce qu'une extraction sait lire. Mais la moitié d'une fiche complète ne se
mesure pas : à quoi sert le composant, quand le choisir, ses règles d'accessibilité, ce qu'il
ne faut jamais en faire. Cette couche de jugement, personne ne peut la deviner — ni un outil,
ni une IA sans source. Elle s'écrit.

Cette convention lui donne un format : **un fichier Markdown par composant**, versionné dans
votre repo, et fusionné dans le JSON au moment de la génération (plugin, étape 3 « Doc »,
zone de dépôt). Nom conseillé : `{composant}-doc.md` (`button-doc.md`) — n'importe quel
`.md` marche, c'est le contenu qui compte. Le contenu est copié **tel quel** : le plugin
fusionne, il n'édite pas, et le fichier reste la source de vérité.

## La convention

Des titres `##` en anglais — les mêmes mots que les champs JSON — et un contenu libre, dans
la langue de votre équipe :

| Titre `##` | Champ JSON | Forme attendue |
|---|---|---|
| `## Description` | `meta.description` | prose : ce que c'est, quand le choisir plutôt qu'un voisin |
| `## Role` | `meta.role` | un mot : le rôle abstrait/ARIA (`button`, `dialog`, `tag`…) |
| `## Platforms` | `platforms` | liste, ou une ligne à virgules (`web, ios, android`) |
| `## States` | `states.list` | liste : les états runtime que Figma ne dessine pas (`loading`, `error`, `empty`…) |
| `## Interaction` | `interaction.pattern` | prose courte : le pattern de référence (ARIA APG, HIG, Material) |
| `## A11y` | `rules.a11y` | liste : focus, labels, clavier, contrastes |
| `## Behavior` | `rules.behavior` | liste : ce que fait le composant (clic, clavier, dismiss…) |
| `## Writing` | `rules.writing` | liste : la microcopie (ton du label, messages d'erreur, états vides). Alias : `## UX Writing`, `## Microcopy` |
| `## Forbidden` | `rules.forbidden` **+** `api.invalidCombinations` | liste : ce qu'il ne faut jamais en faire. Une ligne écrite `axe=valeur + axe=valeur : raison` est **aussi** extraite en donnée structurée (voir ci-dessous) |
| `## Examples` | `examples` | liste, deux minimum : des usages réels, config à l'appui |

Les règles de lecture, toutes déterministes :

- **Les listes `- item` deviennent des tableaux JSON.** Un item peut continuer sur la ligne
  suivante : la suite est rattachée à l'item précédent, rien n'est perdu. Un champ de prose
  garde ses retours à la ligne.
- **Le titre `#` de niveau 1 est ignoré** — c'est le titre du document (`# Button`). **Tout
  autre titre est lu comme un champ** : pas de sous-titres à l'intérieur d'une section, un
  `### Cas nominal` dans Examples serait signalé comme titre inconnu et couperait la section.
- **Strict sur les mots, tolérant sur la forme.** La casse est indifférente, et la
  décoration est retirée avant lecture : `## **description**`, `## A11y :`, `## 1. Examples`
  ou un `## Description\` d'export (Notion et consorts) sont tous reconnus. Deux alias
  tolérés : `## Accessibility` (= A11y) et `## Behaviour` (= Behavior).
- **Un titre inconnu est signalé, jamais avalé en silence** : le plugin liste les sections
  qu'il ignore, et **suggère** le titre connu le plus proche (« did you mean
  `## Description`? ») — il ne devine jamais à votre place.
- **En cas de conflit, le doc gagne.** Une description écrite dans Figma et dans le doc →
  le doc l'emporte (c'est la version curée), et le plugin le signale.
- **La mise en forme voyage telle quelle** : un `**gras**` ou un lien Markdown arrive
  verbatim dans la chaîne JSON — les consommateurs de la donnée doivent s'y attendre.

La convention est **fermée volontairement** : un titre libre n'a pas de clé JSON stable, donc
pas de valeur pour une machine. Si un besoin réel exige un champ de plus, étendez la table —
et le mapping de l'outil — plutôt que d'inventer des titres au fil de l'eau.

## Les interdits : lisibles ET vérifiables

Une règle en prose se lit, elle ne se vérifie pas. Un interdit qui porte sur une
**combinaison de props** peut faire les deux, sans rien écrire en double : il suffit de
l'écrire dans une forme que la machine reconnaît.

```markdown
## Forbidden
- deux primary côte à côte dans une même vue
- tone=error + hierarchy=tertiary : une action destructive en rouge discret, sans poids
  visuel — le fond transparent la fait lire comme une action anodine
```

La première ligne reste de la prose (elle porte sur la **composition d'une page**, pas sur
une combinaison de props du composant). La seconde est reconnue et produit, **en plus** de
son entrée dans `rules.forbidden` :

```json
"api": {
  "invalidCombinations": [
    {
      "when": { "tone": "error", "hierarchy": "tertiary" },
      "reason": "une action destructive en rouge discret, sans poids visuel — le fond transparent la fait lire comme une action anodine"
    }
  ]
}
```

La forme reconnue, volontairement étroite :

- **`axe=valeur`**, séparés par `+`, deux termes minimum ;
- un **`:`** puis la raison, en clair — c'est elle qui reste lisible par un humain ;
- les axes doivent **exister dans `api.props`**, et les valeurs dans leur `enum`. Sinon la
  ligne reste en prose et le plugin le signale — une faute de frappe ne crée pas une règle
  fantôme ;
- **les axes s'écrivent nus, sans mise en forme.** Contrairement aux titres `##`, cette ligne
  n'est pas nettoyée avant lecture : un backtick fait partie de la valeur lue, et
  `` `tone=error` `` donne `` error` ``, qui n'est dans aucun `enum`. La ligne retombe en
  prose et le plugin l'annonce comme une quasi-correspondance. La raison, après le `:`,
  accepte au contraire toute la mise en forme que vous voulez. Le cas est visible en vrai
  dans [`examples/button-doc.md`](examples/button-doc.md).

Ce qui n'entre pas dans cette forme n'a pas à y entrer. Un interdit de composition (« deux
primary côte à côte »), un interdit d'usage (« ne pas l'employer pour une confirmation ») ou
un renvoi vers un autre composant restent de la prose : ils ne portent pas sur une
combinaison de props, donc rien ne peut les vérifier automatiquement.

**Ce n'est pas une matrice de variantes manquantes.** Une combinaison que Figma ne dessine
pas n'est pas un interdit — c'est presque toujours une variante que personne n'a faite.
L'interdit se déclare ici, à la main, parce qu'il relève du jugement ; le trou de dessin se
dérive de la matrice, ailleurs, et n'a pas sa place dans le composant.

## Un doc complet, prêt à copier

```markdown
# Button

## Description
Bouton d'action principal. À préférer au lien quand l'action modifie l'état
du système, pas quand elle navigue.

## Role
button

## Platforms
web, ios, android

## States
- loading : spinner, le label reste visible
- disabled : jamais pour masquer une permission manquante

## Interaction
ARIA APG « Button » ; activation à Entrée et Espace.

## A11y
- focus visible obligatoire (ring 2 px minimum)
- le label nomme l'action (« Enregistrer »), pas le mécanisme (« Cliquez ici »)

## Behavior
- un clic = une action, jamais de double effet
- pendant loading, le bouton ignore les clics

## Writing
- le label est un verbe d'action (« Enregistrer »), jamais « Cliquez ici »
- pas de ponctuation finale, pas de majuscules à chaque mot

## Forbidden
- deux primary côte à côte dans une même vue
- remplacer le label par une icône seule sans alternative accessible
- tone=error + state=disabled : le destructif grisé perd son signal de danger — laisser
  le bouton actif et confirmer

## Examples
- CTA de formulaire : hierarchy=primary, size=md, label « Enregistrer »
- action secondaire de dialog : hierarchy=secondary, size=md
```

## Ce que ça change dans la chaîne

Chaque section remplit un champ que l'extraction ne peut pas deviner : la checklist de
complétude du plugin passe ses ✗ « by hand » en ✓, et `_todo_ai` (nom historique) — la liste
de ce qui reste à écrire — rétrécit d'autant. `_doc_source` trace le fichier utilisé dans le
JSON produit. La regénération devient rejouable : Figma peut changer, la couche de jugement
suit, rien n'est perdu ni recopié à la main.

Une précision de flux : le plugin lit le fichier **au moment où vous l'attachez**. Si vous
éditez le doc ensuite, ré-attachez-le avant de regénérer, sinon c'est l'ancienne version qui
est fusionnée.

La nomenclature et la doc sont les deux moitiés du même contrat :
[la nomenclature](nomenclature-composants.md) rend le mesurable extractible, la doc rend le jugement
fusionnable. Le [processus](processus.md) les met en musique, étape par étape.
