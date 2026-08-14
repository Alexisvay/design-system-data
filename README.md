# design-system-data

Un kit open source pour transformer votre design system Figma en données JSON lisibles par les
IA et le code. Nomenclature, plugin, documentation et processus inclus.

[![GitHub](https://img.shields.io/badge/GitHub-design--system--data-181717?logo=github)](https://github.com/Alexisvay/design-system-data/)
[![Licence MIT](https://img.shields.io/badge/Licence-MIT-yellow.svg)](LICENSE)

## À propos

Ce kit est publié dans le cadre de l'article **Composants en données : passer son design system
en JSON (2/2)**, disponible sur
[Medium](https://medium.com/@alex.vaysse/composants-en-donn%C3%A9es-passer-son-design-system-en-json-2-2-5b1703c40a53).

L'article raconte le pourquoi et les résultats mesurés ; ce repo contient le matériel : les
conventions, le processus, l'outil et un exemple complet, à prendre tels quels ou à adapter.

## Introduction

Un design system est presque toujours un **catalogue visuel** : des composants dessinés dans
Figma, une doc dans un outil à côté, des règles d'usage dans la tête de l'équipe. Ça marche tant
que le lecteur est humain. Dès qu'une machine lit le système — une IA qui génère un écran, un
script qui audite la cohérence, un pipeline qui produit du code — le catalogue ne suffit plus. Il
faut interpréter des pixels, deviner l'intention, retrouver quelle couleur est un token et
laquelle est une valeur en dur.

Le frein n'est pas le modèle, qui lit même le Figma brut. C'est la **forme** sous laquelle on lui
donne le design system.

La solution tient en une phrase : **tout passer en données**. Un fichier par composant, qui réunit
ce que Figma sait (props, styles reliés à leurs tokens, états, structure) et ce que Figma ne sait
pas (à quoi sert le composant, ses règles d'accessibilité, ce qu'il ne faut jamais en faire).
Quatre briques rendent ce passage praticable :

- une **nomenclature** qui rapproche les noms Figma de ceux du code, pour que l'extraction soit
  fiable et vérifiable automatiquement ;
- une **convention de doc**, un Markdown par composant, qui rend la couche de jugement fusionnable
  dans la donnée ;
- un **processus** en trois étapes qui dit qui fait quoi, du designer au plugin ;
- un **plugin Figma** qui fait tout le mesurable : lint de nomenclature, renommages proposés,
  extraction déterministe, audit de complétude.

Le kit part du principe qu'aucun design system n'est parfait. Rien n'est bloquant, rien n'est
deviné, tout est signalé : un design system imparfait peut produire des erreurs ou des données
plus pauvres, mais le processus continue — le plugin les signale et fournit une liste de tâches
précises pour les corriger. Le score de complétude est une jauge de maturité, pas une barrière.

## Contenu du kit

| Pièce | Ce que c'est |
|---|---|
| [`nomenclature-composants.md`](nomenclature-composants.md) | Le socle : comment nommer les **props et les layers** pour qu'un composant soit extractible, avec les alias côté code et les pièges |
| [`nommage-composants.md`](nommage-composants.md) | Ce que la nomenclature ne couvre pas : le nom des **composants eux-mêmes**, en neuf règles |
| [`doc-composant.md`](doc-composant.md) | La convention du `doc.md` par composant : la couche de jugement (description, règles, a11y, exemples), fusionnée telle quelle dans la donnée |
| [`processus.md`](processus.md) | Les trois étapes — structurer, documenter, extraire — et qui fait quoi, du designer au plugin |
| [`plugin/`](plugin/) | Le plugin Figma : lint, autofix, extraction déterministe, audit, export des tokens. 100 % local, sans réseau |
| [`examples/`](examples/) | La chaîne complète sur un Button réel : le [`doc.md`](examples/button-doc.md) écrit à la main, le [JSON](examples/button.json) que le plugin en produit, et la [table des tokens](examples/tokens.json) cités |

## Démarrage rapide

### 1. Structurer

Nommez le composant selon la [nomenclature](nomenclature-composants.md) : props en kebab-case,
mêmes noms partout, un axe = une décision, aucun layer stylé nommé `Rectangle 5`. Le composant
lui-même suit [ses propres règles](nommage-composants.md) (`Search-bar`, pas `SearchBar` ni
`forms/Input`).

```
❌  [🎨] Hierarchy      is-disabled        Rectangle 5
✅  hierarchy           state=disabled     button-content
```

Le plugin liste les écarts et applique les renommages sur toutes les variantes d'un clic — ce
n'est pas à faire à la main.

### 2. Documenter

Écrivez un Markdown par composant, versionné dans votre repo. Des titres `##` en anglais (les
mêmes mots que les champs JSON), un contenu libre dans votre langue :

```markdown
# Button

## Description
Bouton d'action principal. À préférer au lien quand l'action modifie l'état
du système, pas quand elle navigue.

## Forbidden
- deux primary côte à côte dans une même vue
- tone=error + state=disabled : le destructif grisé perd son signal de danger
```

La convention complète et la table des titres reconnus : [`doc-composant.md`](doc-composant.md).

### 3. Extraire

Installez le plugin — c'est trois clics, sans build ni dépendance :

```bash
git clone https://github.com/Alexisvay/design-system-data.git
```

Puis, dans **Figma Desktop** (le mode développement n'existe pas dans le navigateur) :
**Plugins → Development → Import plugin from manifest…** et choisissez
`design-system-data/plugin/manifest.json`. Le plugin apparaît sous **Plugins → Development →
Component as Data**. Détail et dépannage : [`plugin/README.md`](plugin/README.md).

Sélectionnez le composant, glissez son `doc.md` sur l'étape 3, lancez **Generate JSON**. Vous
obtenez un fichier qui réunit les deux sources :

```json
{
  "meta": { "name": "Button", "role": "button", "description": "Déclenche une action…" },
  "api": { "props": { "hierarchy": { "type": "enum", "enum": ["primary", "secondary", "tertiary"] } } },
  "styles": {
    "default": { "root": { "background": { "token": "color/bg/brand/mid/enabled" } } }
  },
  "rules": { "forbidden": ["deux primary côte à côte"] }
}
```

L'exemple complet, sur un vrai composant : [`examples/button.json`](examples/button.json).

## Les articles

Ce kit accompagne une série en deux parties :

1. [**Composants en données : un design system lisible par l'IA (1/2)**](https://medium.com/@alex.vaysse/composants-en-donn%C3%A9es-un-design-system-lisible-par-lia-1-2-96748dce26e8?sharedUserId=alex.vaysse)
   — ce qu'une IA fait d'un design system selon la forme sous laquelle on le lui donne, et ce
   qu'on gagne à le passer en données.
   *En anglais :* [Components as Data: a Design System AI Can Read (1/2)](https://medium.com/@alex.vaysse/components-as-data-a-design-system-ai-can-read-1-2-785e0a24ee7b?sharedUserId=alex.vaysse)
2. [**Composants en données : passer son design system en JSON (2/2)**](https://medium.com/@alex.vaysse/composants-en-donn%C3%A9es-passer-son-design-system-en-json-2-2-5b1703c40a53)
   — le guide pratique : la nomenclature, le processus, le plugin, et la preuve mesurée. **C'est
   l'article que ce repo accompagne.**

## Licence

Ce projet est publié sous licence **MIT** — voir le fichier [LICENSE](LICENSE). Utilisez,
modifiez, partagez librement.
