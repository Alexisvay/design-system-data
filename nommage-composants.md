# Nommage des composants

Complète la [nomenclature](nomenclature-composants.md) (qui couvre props et layers) sur ce
qu'elle ne traite pas : le nom des composants eux-mêmes. Même fil conducteur : le nom Figma
devient la clé du composant dans la donnée, puis dans le code.

La casse, elle, se sépare en deux selon ce que le nom sert à faire. Un composant porte une
**majuscule initiale, puis des minuscules et des tirets** (`Bottom-bar`), parce que c'est un
nom que des gens lisent toute la journée dans le panneau des calques. Les props et les
calques restent en **kebab-case intégral** (`hierarchy`, `icon-left`), parce qu'eux ne se
lisent pas, ils s'appellent : ce sont l'API du composant.

## Les neuf règles

| ID | Règle | À faire | À éviter |
|---|---|---|---|
| **NOMC-01** | Composant public à majuscule initiale, puis minuscules et tirets | `Search-bar` | `search-bar`, `Search Bar`, `SearchBar` |
| **NOMC-02** | Pas de slash de rangement dans le nom | `Input` | `forms/Input` |
| **NOMC-03** | Le set porte le nom du composant, et rien d'autre | `Button` | `⭐ Button v2 (WIP)` |
| **NOMC-04** | Les variants gardent le nom généré par Figma | `size=md, type=primary` | `Primary medium` |
| **NOMC-05** | Composant interne préfixé par un tiret bas | `_Button-base` | `Button-base` |
| **NOMC-06** | Une déclinaison structurelle passe par la prop `type` | `Card` + `type=horizontal` | `Card-horizontal` |
| **NOMC-07** | L'icône porte la clé exacte utilisée par le code, sans majuscule | `arrow-right` | `Arrow-right`, `icon/arrow` |
| **NOMC-08** | Le statut ne va jamais dans le nom | `[deprecated] remplacé par x` en tête de description | `Button (deprecated)` |
| **NOMC-09** | Le fichier Figma porte le contexte : `<type> - <produit> - <surface>` | `composants - acme - web` | `Composants V2 FINAL` |

## Pourquoi ces règles

### Le nom est une clé de données (NOMC-01, NOMC-02, NOMC-07)

Le nom d'un composant dans Figma ne sert pas seulement à le retrouver dans le panneau des
calques : c'est lui qui devient la clé du composant dans la donnée extraite, puis dans le
code. Ce qu'une clé réclame, c'est d'être prévisible, et une seule chose la rend
imprévisible : que la même librairie écrive tantôt `SearchBar`, tantôt `Search Bar`, tantôt
`search-bar`. Une casse unique tenue de bout en bout suffit donc, et la correspondance vers
le code reste mécanique dans un sens comme dans l'autre (`Search-bar` devient `SearchBar` en
React, et ainsi de suite).

On pourrait pousser la stabilité jusqu'au kebab intégral, y compris sur les noms de
composants. C'est une exigence de trop : elle ne protège rien que la majuscule menace, et elle
va contre ce que font tous les kits Figma publics, de Material à Polaris, où l'on lit
« Button » et « Text field ». Un nom de composant garde donc sa majuscule initiale.

Un slash, lui, reste exclu : il ajouterait à la clé un niveau de rangement qui n'a rien à y
faire, puisque le rangement vit dans les pages et les sections du fichier. Les icônes suivent
la même logique avec une contrainte de plus, puisque leur nom n'est pas vraiment un nom mais
la clé que le code appelle réellement : il doit correspondre au caractère près à ce qu'attend
la librairie d'icônes dédiée. C'est pourquoi une icône et un asset échappent à la majuscule
de NOMC-01, et gardent le kebab intégral. La convention exacte varie d'une librairie d'icônes
à l'autre : c'est celle de votre stack qui tranche.

Bénéfice de bord, qui répond à une question qu'on se pose souvent : puisque les composants
portent la majuscule et les icônes non, les deux se distinguent d'un coup d'œil dans le
panneau des calques. Attention toutefois, cette distinction visuelle est une conséquence, pas
un mécanisme. Ce qui dit à l'outillage ce qu'un objet est, c'est son rangement, jamais sa
casse.

### Le set et ses variants appartiennent à Figma (NOMC-03, NOMC-04)

Un ComponentSet porte le nom du composant, un point c'est tout. Tout ce qu'on ajoute autour,
un emoji, un numéro de version, une mention de statut, un suffixe décoratif, se retrouve tel
quel dans la donnée extraite, et il faut ensuite l'en retirer à la main.

Les variants, eux, ne se renomment jamais. Leur nom est la liste `axe=valeur` que Figma
génère et tient à jour tout seul. Renommer un variant le coupe de ses axes, et l'extraction
ne sait plus dire quelle combinaison elle a sous les yeux.

### La frontière entre public et interne (NOMC-05, NOMC-06)

Le préfixe `_` dit d'un coup d'œil qu'un composant est une sous-partie ou une base
technique, quelque chose qu'un consommateur du DS n'a pas à instancier.

Publier ou non ces composants internes est une **décision de gouvernance**, pas une règle de
nommage, et elle dépend de votre organisation. Les masquer garde la librairie propre pour ceux qui la
consomment. Les publier a une raison tout aussi valable : c'est souvent la seule façon pour
un outil de les voir par l'API, donc de les extraire, de les auditer et de rattacher un
composant final à la base dont il hérite. Ce qui compte, quelle que soit la décision, c'est
que le préfixe soit là : c'est lui qui porte l'information, et c'est à lui que l'outillage se
fie pour distinguer une base d'un composant.

La question voisine se pose dès qu'un composant se décline : faut-il un deuxième composant,
ou une variante de plus ? Par défaut, une déclinaison structurelle s'exprime par la prop
`type` à l'intérieur du set, parce que deux composants séparés dupliquent la doc, les tokens
et les tickets. On ne crée un composant distinct que si l'API diverge réellement,
c'est-à-dire si la majorité des props ne sont plus les mêmes. Dans ce cas `Card-horizontal`
est parfaitement légitime : ce n'est plus une déclinaison de `Card`, c'est un autre
composant, et il porte alors un vrai nom complet plutôt qu'un suffixe collé au nom du voisin.

### Ce qu'une librairie contient en plus des composants

Une librairie publiée ne contient pas que des composants. Elle porte aussi les bases dont ils
héritent, ses icônes, ses logos et illustrations, et parfois ses layouts, ses templates et ses
patterns. Ces objets n'ont pas la même API, ne se documentent pas de la même façon et ne
s'auditent pas selon les mêmes critères : réclamer deux exemples d'usage à une icône n'a pas
de sens, et compter quatre cents icônes comme autant de composants à documenter rend
n'importe quelle mesure d'avancement fausse.

Sept natures méritent donc d'être distinguées : le **composant**, la **base**, l'**icône**,
l'**asset** (logo, illustration), le **layout**, le **template** et le **pattern**.

Deux signaux les séparent, dans cet ordre. Le préfixe `_` dit une base, et il gagne toujours.
Le rangement Figma dit le reste : la page ou la section qui porte l'objet. Ce second signal
n'a de valeur que si vos noms de pages sont posés et connus de votre outillage — aucun outil
ne devine qu'une page nommée « Fondations » contient des assets. À défaut, tout est un
composant.

Corollaire pratique, et il vaut la peine d'être dit : **rangez par page ou par section, pas
par nom**. C'est déjà ce qu'impose NOMC-02, qui refuse le slash dans un nom précisément parce
que le classement vit ailleurs.

La nature commande aussi la casse. Un composant, une base, un layout, un template et un
pattern portent des noms que des gens lisent, donc la majuscule de NOMC-01. Une icône et un
asset portent la clé exacte appelée par le code, donc le kebab intégral de NOMC-07 : leur casse
n'est pas une faute.

Ces natures sont une distinction de **votre** rangement et de votre documentation : le plugin
fourni ici ne les enregistre pas dans la donnée (son `meta.type` dit tout autre chose — si le
composant est un atome, un composé ou piloté par des données). C'est à votre outillage de s'en
servir, pour ne pas compter quatre cents icônes comme autant de composants à documenter.

### Ce qui n'a rien à faire dans un nom (NOMC-08, NOMC-09)

Le statut d'un composant change bien plus souvent que son nom, et un nom qui change casse
tout ce qui pointait dessus. La dépréciation se marque donc en tête de description, sous une
forme extractible (`[deprecated] remplacé par x`), qu'un outil comme une IA peuvent lire sans
avoir à deviner.

Le nom du fichier Figma joue le rôle inverse : il porte le contexte que le composant ne
porte pas, à savoir le type de fichier, le produit et la surface, ce qui permet à un outil de
reconnaître automatiquement ce qu'il a ouvert. Le format `<type> - <produit> - <surface>`
n'est qu'une proposition par défaut : si votre équipe en a déjà une, gardez la vôtre.
