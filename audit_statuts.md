# Audit complet des statuts et états — Rapport de diagnostic

---

## Modèle 1 — `Demande` (app: requests)

| Champ | Type | Valeurs possibles | Défaut | Nullable |
|---|---|---|---|---|
| `statut` | CharField choices | `en_attente`, `en_cours`, `partielle`, `totale`, `refusee` | `en_attente` | Non |

### Transitions détectées

| De | Vers | Fonction | Déclencheur |
|---|---|---|---|
| `en_attente` | `refusee` | `valider()` — requests/views.py:172 | POST `/demandes/{id}/valider/` avec `decision="refus"` |
| `en_attente` | `totale` | `valider()` — requests/views.py:229 | POST `/demandes/{id}/valider/` avec `decision="total"` |
| `en_attente` | `partielle` | `valider()` — requests/views.py:229 | POST `/demandes/{id}/valider/` avec `decision="partiel"` |
| `en_cours` | `refusee` | `refuser()` — requests/views.py:324 | POST `/demandes/{id}/refuser/` |
| `partielle/totale` | `totale/partielle` | `_update_demande_delivery_on_signature_validated()` — decharge/views.py:78 | Signal `post_save` sur `SignatureDecharge` quand `statut=valide` |

> **Valeur `en_cours`** : acceptée par le guard de `valider()` (ligne 147) et requise par `refuser()` (ligne 315), mais **aucune ligne de code ne la définit jamais sur une demande**. C'est une valeur orpheline en écriture.

---

## Modèle 2 — `SignatureDecharge` (app: decharge)

| Champ | Type | Valeurs possibles | Défaut | Nullable |
|---|---|---|---|---|
| `statut` | CharField choices | `en_attente`, `signe`, `valide`, `rejete` | `en_attente` | Non |

### Transitions détectées

| De | Vers | Fonction | Déclencheur |
|---|---|---|---|
| `en_attente` | `signe` | `upload_scan()` — decharge/views.py:378 | POST `.../signature/upload_scan/` par le chef |
| `signe` | `valide` | `valider()` — decharge/views.py:427 | POST `.../signature/valider/` par le gestionnaire |
| `en_attente` | `valide` | `marquer_signe()` — decharge/views.py:475 | POST `.../signature/marquer_signe/` par le gestionnaire (raccourci sans scan) |
| `signe` ou `en_attente` | `rejete` | `rejeter()` — decharge/views.py:532 | POST `.../signature/rejeter/` par le gestionnaire |

> **État final `rejete` bloqué** : après un rejet, `upload_scan()` ne permet le re-upload que si `statut == "en_attente"` (ligne 356). Une signature `rejete` ne peut **jamais** repasser en `en_attente`. Le flux de correction est donc cassé côté backend — le frontend affiche pourtant un bouton "Soumettre un nouveau scan" pour ce cas.

> **Notification sémantiquement incorrecte** : `rejeter()` envoie `NotificationType.DECHARGE_SIGNEE` pour notifier un rejet (ligne 540). Le type devrait être distinct (rejet ≠ signature).

---

## Modèle 3 — `RetourMateriel` (app: returns)

| Champ | Type | Valeurs possibles | Défaut | Nullable |
|---|---|---|---|---|
| `statut` | CharField choices | `en_attente`, `receptione` | `en_attente` | Non |
| `motif_retour` | CharField choices | `panne`, `inutilise`, `endommage`, `autre` | — | Non |
| `decision` | CharField choices | `""`, `hors_service`, `en_stock`, `repare`, `non_repare`, `rebut`, `reaffecte` | `""` | Non |

### Transitions `statut`

| De | Vers | Fonction | Déclencheur |
|---|---|---|---|
| `en_attente` | `receptione` | `receptionner()` — returns/views.py:132 | POST `/retours/{id}/receptionner/` par le gestionnaire |

### Transitions `decision` (via signal `on_retour_decision`)

| Valeur `decision` | Nouvel `etat` instance | Nouveau `statut` instance | Mouvement stock |
|---|---|---|---|
| `hors_service` | `hors_service` | `hors_service` | `retour` |
| `en_stock` | `retourne` | `en_stock` | `retour` |
| `repare` | `bon_etat` | `en_stock` | `retour` |
| `non_repare` | `endommage` | `en_maintenance` | `retour` |
| `rebut` | `hors_service` | `retire` | `rebut` |
| `reaffecte` | *(inchangé)* | `en_stock` | `retour` |

> **Motifs `endommage` et `autre` bloqués** : `receptionner()` utilise `_MOTIF_ETAT` qui ne contient que `panne` et `inutilise`. Pour les deux autres motifs, l'endpoint retourne `400 "Motif non géré"`. Il est donc **impossible** de réceptionner un retour `endommage` ou `autre`. Le frontend ne les propose plus mais le modèle les garde encore.

> **Nommage** : `receptione` (une seule `n`) alors que `MarcheBC` utilise `receptionne_et_stocke`. Pas de bug, mais incohérent.

---

## Modèle 4 — `InstanceRessource` (app: resources)

| Champ | Type | Valeurs possibles | Défaut | Nullable |
|---|---|---|---|---|
| `statut` | CharField choices | `en_stock`, `en_service`, `en_maintenance`, `hors_service`, `retire` | `en_stock` | Non |
| `etat` | CharField choices | `neuf`, `bon_etat`, `usage_normal`, `endommage`, `hors_service`, `retourne` | `neuf` | Non |

### Transitions `statut`

| De | Vers | Fonction | Déclencheur |
|---|---|---|---|
| *(création)* | `en_stock` | `_integrate_item_into_stock()` — procurement/signals.py:86 | Approbation d'un StagingItem |
| `en_stock` | `en_service` | `on_signature_valide` signal — decharge/signals.py:30 | Validation signature décharge (bien inventaire) |
| `en_service` | `hors_service` | `receptionner()` — returns/views.py:120 (motif `panne`) | Réception retour `panne` |
| `en_service` | `en_stock` | `receptionner()` — returns/views.py:120 (motif `inutilise`) | Réception retour `inutilise` |
| *(via decision)* | `hors_service` | `on_retour_decision` signal — returns/signals.py:27 | decision=hors_service |
| *(via decision)* | `en_stock` | `on_retour_decision` — returns/signals.py:27 | decision=en_stock / repare / reaffecte |
| *(via decision)* | `en_maintenance` | `on_retour_decision` — returns/signals.py:27 | decision=non_repare |
| *(via decision)* | `retire` | `on_retour_decision` — returns/signals.py:27 | decision=rebut |

### Transitions `etat`

| De | Vers | Déclencheur |
|---|---|---|
| *(création)* | `neuf` | Nouveau bien inventaire via procurement |
| *(via decision)* | `retourne` | decision=en_stock |
| *(via decision)* | `hors_service` | decision=hors_service ou receptionner(panne) |
| *(via decision)* | `bon_etat` | decision=repare |
| *(via decision)* | `endommage` | decision=non_repare |

> **`usage_normal` jamais assigné** : défini dans les choices mais aucun code ne l'écrit.

---

## Modèle 5 — `MarcheBC` (app: procurement)

| Champ | Type | Valeurs possibles | Défaut | Nullable |
|---|---|---|---|---|
| `statut` | CharField choices | `en_attente_livraison`, `receptionne_et_stocke`, `non_conforme` | `en_attente_livraison` | Non |

### Transitions détectées

| De | Vers | Fonction | Déclencheur |
|---|---|---|---|
| *(création)* | `en_attente_livraison` | `DirectImportView`, `ManualImportView` | Upload ou saisie manuelle |
| `en_attente_livraison` | `receptionne_et_stocke` | `_check_import_complete()` — procurement/signals.py:137 | Tous les StagingItems approuvés |
| `en_attente_livraison` | `receptionne_et_stocke` | `bulk_validate()` — procurement/views.py:725 | Validation en lot |
| `en_attente_livraison` | `receptionne_et_stocke` | `ManualImportView` — views.py:560 | Import manuel direct avec `statut_livraison="receptionne_et_stocke"` |

> **`non_conforme` jamais assigné** : présent dans les choices mais aucune ligne de code ne le définit. Il sert uniquement de garde-fou dans `_check_import_complete()` et `bulk_validate()` pour ne pas écraser un statut existant.

---

## Modèle 6 — `MarcheEtape` (app: procurement)

| Champ | Type | Valeurs possibles | Défaut | Nullable |
|---|---|---|---|---|
| `statut` | CharField choices | `en_attente`, `en_cours`, `complete`, `bloque` | `en_attente` | Non |

### Transitions détectées

| De | Vers | Fonction | Déclencheur |
|---|---|---|---|
| *(création ordre=1)* | `complete` | `create_default_etapes()` | Création d'un MarcheBC |
| *(création ordre 2-8)* | `en_attente` | `create_default_etapes()` | Création d'un MarcheBC |
| *(toute valeur)* | *(toute valeur)* | `MarcheEtapeViewSet.perform_update()` | PATCH manuel par gestionnaire |

> Toutes les transitions sont manuelles (PATCH). `bloque` et `en_cours` peuvent être définis manuellement mais aucune logique automatique ne les déclenche.

---

## Modèle 7 — `ImportExcelBC` (app: procurement)

| Champ | Type | Valeurs possibles | Défaut | Nullable |
|---|---|---|---|---|
| `statut_import` | CharField choices | `en_attente`, `brouillon`, `en_revision`, `valide`, `non_conforme`, `autre`, `rejete` | `brouillon` | Non |

### Transitions détectées

| De | Vers | Fonction | Déclencheur |
|---|---|---|---|
| *(création via DirectImport)* | `en_attente` | `DirectImportView` — views.py:368 | Upload fichier (OCR déclenché) |
| *(création via ManualImport)* | `brouillon` | `ManualImportView` — views.py:461 | Saisie manuelle |
| `en_attente` / `brouillon` | `en_revision` | `envoyer_gestionnaire()` — views.py:302 | Envoi au gestionnaire |
| `en_revision` | `valide` | `_check_import_complete()` — signals.py:131 | Tous items approuvés |
| `en_revision` | `rejete` | `_check_import_complete()` — signals.py:132 | Certains items rejetés |
| `en_revision` | `valide` | `bulk_validate()` — views.py:721 | Validation en lot (tous approuvés) |
| `en_revision` | `non_conforme` / `autre` | `bulk_validate()` — views.py:729 | Rejet en lot |
| `en_attente` | `valide` | `ManualImportView` — views.py:559 | Import direct sans revue |

---

## Modèle 8 — `StagingItem` (app: procurement)

| Champ | Type | Valeurs possibles | Défaut | Nullable |
|---|---|---|---|---|
| `statut` | CharField choices | `en_attente`, `approuve`, `rejete`, `modifie` | `en_attente` | Non |

### Transitions détectées

| De | Vers | Fonction | Déclencheur |
|---|---|---|---|
| *(création)* | `en_attente` | OCR tasks, `ManualImportView` | Upload ou saisie |
| `en_attente` | `approuve` | `approve()` — views.py:642 | Approbation individuelle |
| `en_attente` | `rejete` | `reject()` — views.py:664 | Rejet individuel |
| `en_attente` | `approuve` / `rejete` | `bulk_validate()` — views.py:703 | Validation en lot |
| `en_attente` | `approuve` | `ManualImportView` — views.py:558 | Import direct |

> **`modifie` jamais assigné** : défini dans les choices mais aucun code ne l'écrit jamais.

---

## Modèle 9 — `AlerteDelai` (app: alerts)

| Champ | Type | Valeurs possibles | Défaut | Nullable |
|---|---|---|---|---|
| `acquitte` | BooleanField | `True` / `False` | `False` | Non |
| `niveau_alerte` | CharField choices | `info`, `warning`, `critique` | — | Non |

> `acquitte` n'a pas de transition automatique détectée dans le code. Il n'est jamais passé à `True` programmatiquement — uniquement accessible via admin Django ou PATCH direct.

---

---

# Récapitulatif des incohérences

---

## CRITIQUE

### C-1 — `SignatureDecharge` : flux de re-upload impossible après rejet

**Problème** : `upload_scan()` n'accepte que `statut == "en_attente"` (decharge/views.py:356). Or `rejeter()` passe à `rejete` sans reset. Résultat : une décharge rejetée est **définitivement bloquée** — le chef ne peut plus soumettre de nouveau scan.

**Correction proposée** : Dans `upload_scan()`, ajouter `"rejete"` aux statuts acceptés, ET dans `rejeter()` optionnellement remettre à `en_attente` pour forcer un nouveau cycle propre. Aucune migration nécessaire.

---

### C-2 — `Demande.statut` : valeur `en_cours` jamais attribuée

**Problème** : `en_cours` est dans les choices, accepté comme statut actionnable par `valider()`, et **exigé** par `refuser()` (qui retourne 400 si le statut est autre). Mais aucune ligne de code ne définit `statut = "en_cours"` sur une demande. Conséquence : l'endpoint `refuser()` est **totalement inaccessible** en pratique.

**Correction proposée** : Supprimer `en_cours` des choices ET supprimer l'endpoint `refuser()` (doublon de `valider(decision=refus)`). Migration `AlterField` sur `Demande.statut` nécessaire.

---

### C-3 — `RetourMateriel` : motifs `endommage` et `autre` bloquent la réception

**Problème** : `receptionner()` utilise `_MOTIF_ETAT` qui ne contient que `panne` et `inutilise`. Un retour avec motif `endommage` ou `autre` retourne systématiquement une erreur 400, rendant impossible tout changement de statut de `en_attente` vers `receptione`.

**Correction proposée** : Retirer `endommage` et `autre` de `MOTIF_CHOICES` dans le modèle `RetourMateriel` (migration `AlterField` nécessaire). Les données existantes avec ces motifs doivent être migrées vers `panne` ou un autre motif actif avant la migration.

---

## MINEUR

### M-1 — `InstanceRessource.etat` : valeur `usage_normal` jamais assignée

`usage_normal` est dans `ETAT_CHOICES` mais aucun code ne l'écrit. Soit il est destiné à des mises à jour manuelles (à documenter), soit c'est une valeur résiduelle à supprimer (migration `AlterField` nécessaire).

---

### M-2 — `StagingItem.statut` : valeur `modifie` jamais assignée

`modifie` est dans `STATUT_CHOICES` mais jamais utilisé. Le workflow réel est uniquement `en_attente → approuve` ou `en_attente → rejete`. Valeur résiduelle à supprimer (migration `AlterField`).

---

### M-3 — `MarcheBC.statut` : valeur `non_conforme` jamais assignée

`non_conforme` est dans les choices et sert de garde-fou dans les vérifications (`if marche.statut not in (..., "non_conforme")`), mais **aucun code ne le définit**. C'est un statut fantôme inaccessible normalement. À supprimer ou à implémenter si le besoin existe.

---

### M-4 — `ImportExcelBC.statut_import` : deux valeurs par défaut selon la voie de création

- `DirectImportView` crée avec `statut_import="en_attente"` (ligne 368)
- `ManualImportView` crée avec `statut_import="brouillon"` (ligne 461)
- Le modèle déclare `default="brouillon"`

Deux chemins différents, deux statuts initiaux différents pour le même modèle. Il faudrait harmoniser : soit tout commence en `en_attente` (l'OCR est lancé), soit tout commence en `brouillon` (manuel vs. automatique est intentionnel — à documenter).

---

### M-5 — Notification `DECHARGE_SIGNEE` utilisée pour les rejets

`rejeter()` (decharge/views.py:540) envoie `NotificationType.DECHARGE_SIGNEE` pour informer d'un rejet. Sémantiquement faux : un rejet n'est pas une signature. Il faudrait soit créer `DECHARGE_REJETEE` dans `NotificationType`, soit réutiliser `DEMANDE_REJETEE` avec un message clair.

---

### M-6 — `receptione` vs `receptionne` : typo cohérente mais incorrecte

`RetourMateriel.statut` vaut `receptione` (une seule `n`) partout, cohérent en lui-même. Mais `MarcheBC.statut` utilise `receptionne_et_stocke` (deux `n`). Le mot français est « réceptionné ». Pas de bug fonctionnel, mais crée une confusion à la lecture du code. Migration `AlterField` + `RunPython` de data migration nécessaire si on corrige.

---

### M-7 — `AlerteDelai.acquitte` : jamais passé à `True` automatiquement

Le champ existe mais aucun signal, tâche, ou vue ne le met à `True`. Il n'y a pas de mécanisme d'acquittement actif dans le code. À implémenter ou à supprimer si non utilisé.

---

## Tableau de priorité résumé

| ID | Modèle | Problème | Priorité | Migration ? |
|---|---|---|---|---|
| C-1 | SignatureDecharge | Re-upload impossible après rejet | **Critique** | Non |
| C-2 | Demande | `en_cours` jamais atteint + `refuser()` inaccessible | **Critique** | Oui (AlterField) |
| C-3 | RetourMateriel | `endommage`/`autre` bloquent `receptionner()` | **Critique** | Oui (AlterField + data) |
| M-1 | InstanceRessource.etat | `usage_normal` jamais assigné | Mineur | Oui (AlterField) |
| M-2 | StagingItem | `modifie` jamais assigné | Mineur | Oui (AlterField) |
| M-3 | MarcheBC | `non_conforme` jamais assigné | Mineur | Oui (AlterField) |
| M-4 | ImportExcelBC | Deux statuts initiaux incohérents | Mineur | Non |
| M-5 | Notification | Type `DECHARGE_SIGNEE` pour les rejets | Mineur | Non |
| M-6 | RetourMateriel | Typo `receptione` vs `receptionne` | Mineur | Oui (AlterField + data) |
| M-7 | AlerteDelai | `acquitte` jamais activé | Mineur | Non |
