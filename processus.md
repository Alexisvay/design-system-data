# Processus : passer son design system en données

Un composant fini ne se résume pas à ce qu'on voit dans Figma. Ses informations vivent à **deux
endroits** : **Figma** pour le visuel, la **documentation** pour le non-visuel — intention,
comportement, accessibilité, règles d'usage. Le processus les réunit en un seul fichier par
composant, en trois étapes.

| Étape | Qui travaille | Ce qui sort |
|---|---|---|
| 1. Structurer | Le designer : [nomenclature](nomenclature-composants.md) appliquée, styles liés à des tokens publiés, variante par défaut alignée, combinaisons impossibles exclues | Un composant extractible |
| 2. Documenter | Le designer : un `doc.md` par composant selon [la convention](doc-composant.md), adossé aux standards, versionné dans le repo | La couche de jugement : description, règles d'usage, accessibilité, comportement |
| 3. Extraire | Le [plugin](plugin/) : extraction déterministe, fusion du doc telle quelle, audit de complétude | La donnée prête à servir (IA, code, audit) |

La règle de partage tient en une phrase : **la machine fait le mesurable, l'humain écrit le
jugement**, et aucune étape ne demande aux deux la même chose.

## 1. Structurer

Le composant est préparé pour être lu par une machine, dans Figma.

- La [nomenclature](nomenclature-composants.md) est appliquée : props en kebab-case, mêmes noms
  d'un composant à l'autre, un axe par décision, layers nommés par leur rôle. Le composant
  lui-même suit [ses propres règles](nommage-composants.md).
- Les styles sont liés à des **tokens publiés**, pas à des valeurs en dur.
- La variante par défaut est celle qu'on veut voir sortir comme référence.
- Les combinaisons impossibles sont exclues par construction (`disabled` est une valeur de
  `state`, jamais un booléen à part).

C'est l'étape qui décide de tout le reste : **la donnée qui sort mesure le composant qui entre**.
Un composant mal nommé peut produire une donnée fausse — des clés instables d'une extraction à
l'autre — ou, au mieux, une donnée plus pauvre qu'il faudra corriger à la main.

Bonne nouvelle : l'essentiel de ces conventions se vérifie automatiquement. Le plugin liste les
écarts et propose les renommages en avant/après, appliqués d'un clic sur **toutes** les variantes
du set. C'est la réponse à l'objection « on ne va pas renommer tout ça à la main » : justement,
ce n'est plus à la main.

## 2. Documenter

La moitié d'une fiche complète ne se mesure pas : à quoi sert le composant, quand le choisir
plutôt qu'un voisin, ses règles d'accessibilité, ce qu'il ne faut jamais en faire. Cette couche de
jugement n'est écrite nulle part dans Figma, quel que soit le nommage — ni un outil ni une IA sans
source ne peuvent la deviner. Elle s'écrit.

Rarement de zéro d'ailleurs : les standards fournissent le comportement clavier et les exigences
d'accessibilité du pattern (ARIA APG, WCAG). Reste à écrire ce qui n'appartient qu'à votre design
system.

Le format est minimal : **un fichier Markdown par composant**, versionné dans votre repo, avec des
titres `##` en anglais qui reprennent les champs de la donnée et un contenu libre, dans la langue
de l'équipe. Voir [la convention](doc-composant.md) — et
[`examples/button-doc.md`](examples/button-doc.md) pour un cas réel.

## 3. Extraire

Le plugin lit le composant, fusionne le `doc.md` tel quel, produit le JSON et affiche l'audit :
une checklist de complétude qui dit ce que la donnée couvre, ce qui manque, et **où** agir — dans
Figma ou dans le doc. Il joint la table des tokens avec leurs valeurs résolues, pour que les noms
et les valeurs voyagent ensemble.

L'extraction est **déterministe, sans IA** : même composant, même donnée, à chaque fois. C'est ce
qui permet de regénérer sereinement quand le Figma évolue, et de traiter la donnée comme une
référence d'audit plutôt que comme une interprétation.

## Qui fait quoi

| | Le designer | Le plugin |
|---|---|---|
| **Structurer** | Nomme les props et les layers, relie les styles aux tokens, choisit la variante par défaut | Linte la nomenclature, propose les renommages et les applique sur toutes les variantes |
| **Documenter** | Écrit le `doc.md` : description, règles d'usage, a11y, comportement, interdits, exemples | Fusionne le fichier **verbatim** — il n'édite pas, n'invente pas, ne résume pas. Un titre inconnu est signalé, jamais avalé en silence |
| **Extraire** | Sélectionne le composant, attache le doc, relit et valide les règles | Extrait props, styles en tokens, états, structure et composition ; audite la complétude et exporte les tokens |

## Rien ne bloque

Le kit part du principe qu'aucun design system n'est parfait. Une imperfection produit une donnée
plus pauvre et une tâche précise pour l'enrichir, jamais un mur.

| Imperfection | Ce qui se passe |
|---|---|
| Nomenclature non conforme | L'extraction marche, la donnée est juste plus pauvre ; le lint pointe quoi corriger, l'autofix propose les renommages |
| Doc absente ou incomplète | Génération normale ; la checklist montre les points manquants et où agir (Figma ou doc) |
| Doc mal structurée | Refusée avec suggestions de titres : rien n'est fusionné, rien n'est inventé |
| Couleurs en dur (HEX) | Capturées quand même, comptées et signalées |
| Dégradés, images, effets non tokenisés | Signalés `{unsupported}` au lieu de disparaître |
| Composant très gros | Capture plafonnée avec note explicite, jamais de troncature muette |

Le score de complétude est une **jauge de maturité, pas une barrière**.

## La boucle

Une fois le premier composant passé, le cycle se referme : Figma évolue → on regénère ; une règle
manque → on l'écrit dans le `doc.md` → on regénère. La boucle d'amélioration a un seul endroit,
**la source**. Ce qui est écrit protège ; ce qui ne l'est pas n'existe pas.
