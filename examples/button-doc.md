# Button

## Description
Déclenche une action qui modifie l'état du système. À préférer au lien quand on agit
(enregistrer, supprimer), pas quand on navigue. Icon-only réservé aux actions dont
l'icône est universelle.

## Role
button

## Platforms
web, ios, android

## States
- disabled : jamais pour cacher une permission

## Interaction
ARIA APG « Button » ; activation à Entrée et Espace.

## A11y
- focus visible obligatoire (ring 2px)
- label explicite, pas de « Cliquez ici »

## Behavior
- un clic = une action, jamais de double effet
- une action destructive se protège par une **confirmation** (Dialog `role=alertdialog`),
  jamais en désactivant le bouton

## Writing
- le label est un verbe d'action (« Enregistrer »), jamais « Cliquez ici »
- pas de ponctuation finale, pas de majuscules à chaque mot

## Forbidden
- deux primary côte à côte
- `tone=error` + `state=disabled` : le destructif grisé perd son signal de danger — laisser
  le bouton actif et confirmer

## Examples
- CTA de formulaire : hierarchy=primary, size=md
- action secondaire de dialog : hierarchy=secondary
