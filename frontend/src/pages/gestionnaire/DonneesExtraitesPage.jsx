import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';

import {
  bulkValidateStagingItems,
  getImports,
  getStagingItems,
  rejectItem,
} from '../../api/procurement';
import { getCategories } from '../../api/resources';
import {
  IMPORT_STATUT_LABELS,
  STAGING_ITEM_LABELS,
  StatusBadge,
} from '../../constants/statuts';

function pickValue(obj, keys, fallback = '') {
  if (!obj) return fallback;
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && `${value}`.trim() !== '') {
      return value;
    }
  }
  return fallback;
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('fr-FR');
}

const TYPE_LABELS = {
  consommable: 'Consommable',
  bien_inventaire: 'Bien Inventaire',
};

const TYPE_TAXONOMY = {
  consommable: {
    'Fourniture De Bureau': [],
    Toners: [],
    'Papiers Et Enveloppes': [],
    'Produits Hygieniques': [],
    'Accessoires Electriques': [],
    'Accessoires Plomberies': [],
    'Accessoires De Sports': [],
    'Consommation Et Pause': [],
  },
  bien_inventaire: {
    MATERIEL_INFORMATIQUE: [
      'Ordinateur de bureau',
      'All In One',
      'Ordinateur Portable',
      'Imprimante',
      'Imprimante couleur',
      'Photocopieuse',
      'Scanner',
      'Appareil photo',
      'Tablette',
      'Scanner Onduleur',
      'CAMERA',
      'FAX',
      'Imprimante multifonction',
    ],
    MATERIEL_ENSEIGNEMENT: [
      'Videoprojecteur',
      'Ecran de projection',
      'Micro cravatte',
      'Microbaladeur',
      'Tableau magnetique GF',
      "Tableau d'affichage GF",
      'Tableau magnetique PF',
      'Tableau magnetique MF',
      'TV',
      'TABLEAU INTERACTIF',
      "TABLE D'EXAMEN",
      'ESCABEAU INOX',
    ],
    MOBILIER_DE_BUREAU: [
      'Chaise roulante',
      'Bureau simple',
      'Table basse',
      'Chaise visiteur',
      'Climatiseur',
      'Chaise iso',
      'Chaise ecritoire',
      'Fauteuil president',
      'Porte manteau',
      'Armoire metallique GF',
      'Armoire metallique PF',
      'CLAPET a 10 cases',
      'CLAPET a 4cases',
      'Bain huile',
      'Table',
      'TABOURET',
      'Réfrigérateur',
      'Congélateur',
      'Escabeau',
      'ARMOIRE COULISSANTE',
    ],
    FOURNITURE_INFORMATIQUE: [
      'Switch',
      'Pointeur',
      'Ralonge 5M',
      'Ralonge 5 ports',
      'Cable VGA',
      'Cable HDMI',
      'STREAMING',
      'Data show',
      'Data show 4X3',
      'Aspirateur',
      'Film plastifieur 80 Mic',
      'Film plastifieur 125 Mic',
      'Film plastifieur 150 Mic',
      'Film plastifieur 175 Mic',
      'Film plastifieur 250 Mic',
      'Disque dur externe',
      'Support affiche',
    ],
  },
};

function getCategoryOptionsByType(type) {
  return Object.keys(TYPE_TAXONOMY[type] || {});
}

function getSousCategoryOptions(type, category) {
  if (!type || !category) return [];
  return TYPE_TAXONOMY[type]?.[category] || [];
}

function formatTaxonomyLabel(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  return raw
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatSousCategoryLabel(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  return raw
    .replaceAll('_', ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatMoney(value) {
  if (value === null || value === undefined || value === '') return '—';
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) return '—';
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericValue);
}

function extractArrayPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

function normalizeRevisionRow(item) {
  const id = Number(pickValue(item, ['id_staging', 'idStaging', 'id'], 0));
  const designationNormalisee = pickValue(item, ['designation_normalisee', 'designationNormalisee'], '');
  const description = pickValue(item, ['description'], '');
  const quantite = pickValue(item, ['quantite'], '');
  const prixUnitaireHt = pickValue(item, ['prix_unitaire_ht', 'prixUnitaireHt'], '');
  const prixTotalHt = pickValue(item, ['prix_total_ht', 'prixTotalHt'], '');
  const unite = pickValue(item, ['unite'], 'U');
  const typeDetecte = pickValue(item, ['type_detecte', 'typeDetecte'], '');
  const idCategorieSuggeree = pickValue(item, ['id_categorie_suggeree', 'idCategorieSuggeree'], '');
  const idRessourceLiee = pickValue(item, ['id_ressource_liee', 'idRessourceLiee'], '');
  const correctionGestionnaire = pickValue(item, ['correction_gestionnaire', 'correctionGestionnaire'], '');
  const typeDetecteNormalized = typeDetecte || 'consommable';
  const categoryOptions = getCategoryOptionsByType(typeDetecteNormalized);
  const fallbackCategory = categoryOptions[0] || '';
  const sousOptions = getSousCategoryOptions(typeDetecteNormalized, fallbackCategory);

  return {
    id_staging: id,
    designation_brute: pickValue(item, ['designation_brute', 'designationBrute'], '—'),
    designation_normalisee: designationNormalisee,
    description,
    quantite: quantite === null || quantite === undefined ? '' : String(quantite),
    prix_unitaire_ht: prixUnitaireHt === null || prixUnitaireHt === undefined ? '' : String(prixUnitaireHt),
    prix_total_ht: prixTotalHt === null || prixTotalHt === undefined ? '' : String(prixTotalHt),
    unite,
    type_detecte: typeDetecte,
    categorie_taxonomy: fallbackCategory,
    sous_categorie: sousOptions[0] || '',
    id_categorie_suggeree: idCategorieSuggeree === null || idCategorieSuggeree === undefined ? '' : String(idCategorieSuggeree),
    id_ressource_liee: idRessourceLiee === null || idRessourceLiee === undefined ? '' : String(idRessourceLiee),
    correction_gestionnaire: correctionGestionnaire,
    statut: pickValue(item, ['statut'], 'en_attente'),
    motif_rejet: pickValue(item, ['motif_rejet', 'motifRejet'], ''),
    commentaire_rejet: pickValue(item, ['commentaire_rejet', 'commentaireRejet'], ''),
    __original: {
      designation_normalisee: designationNormalisee,
      description,
      quantite: quantite === null || quantite === undefined ? '' : String(quantite),
      prix_unitaire_ht: prixUnitaireHt === null || prixUnitaireHt === undefined ? '' : String(prixUnitaireHt),
      prix_total_ht: prixTotalHt === null || prixTotalHt === undefined ? '' : String(prixTotalHt),
      unite,
      type_detecte: typeDetecte,
      categorie_taxonomy: fallbackCategory,
      sous_categorie: sousOptions[0] || '',
      id_categorie_suggeree: idCategorieSuggeree === null || idCategorieSuggeree === undefined ? '' : String(idCategorieSuggeree),
      id_ressource_liee: idRessourceLiee === null || idRessourceLiee === undefined ? '' : String(idRessourceLiee),
      correction_gestionnaire: correctionGestionnaire,
    },
  };
}

function hasRowChanged(row) {
  const fields = [
    'designation_normalisee',
    'description',
    'quantite',
    'prix_unitaire_ht',
    'prix_total_ht',
    'unite',
    'type_detecte',
    'categorie_taxonomy',
    'sous_categorie',
    'id_categorie_suggeree',
    'id_ressource_liee',
    'correction_gestionnaire',
  ];

  return fields.some((field) => String(row?.[field] ?? '') !== String(row?.__original?.[field] ?? ''));
}

function serializeRevisionRow(row) {
  return {
    id_staging: row.id_staging,
    designation_normalisee: row.designation_normalisee,
    description: row.description,
    quantite: row.quantite === '' ? null : Number(row.quantite),
    prix_unitaire_ht: row.prix_unitaire_ht === '' ? null : Number(row.prix_unitaire_ht),
    prix_total_ht: row.prix_total_ht === '' ? null : Number(row.prix_total_ht),
    unite: row.unite,
    type_detecte: row.type_detecte,
    correction_gestionnaire: JSON.stringify({
      ...(row.correction_gestionnaire ? { note: row.correction_gestionnaire } : {}),
      categorie: row.categorie_taxonomy,
      sous_categorie: row.sous_categorie,
    }),
    id_categorie_suggeree: row.id_categorie_suggeree === '' ? null : Number(row.id_categorie_suggeree),
    id_ressource_liee: row.id_ressource_liee === '' ? null : Number(row.id_ressource_liee),
  };
}

const REJECTION_REASONS = [
  {
    value: 'non_conforme',
    label: 'Non conforme',
    subtitle: 'Les données extraites ne correspondent pas au document source',
    color: '#b91c1c',
  },
  {
    value: 'document_invalide',
    label: 'Document invalide',
    subtitle: 'Mauvais format, document illisible ou données incomplètes',
    color: '#b45309',
  },
  {
    value: 'autre',
    label: 'Autre',
    subtitle: 'Préciser le motif dans le commentaire ci-dessous',
    color: 'rgba(17, 24, 39, 0.5)',
  },
];

function getHeaderFromImport(item) {
  return {
    titre: item?.titre || '',
    reference: item?.reference || '',
    fournisseur: item?.fournisseur || '',
    telephone: item?.telephone || '',
    email: item?.email || '',
    adresse: item?.adresse || '',
    delai_livraison: item?.delai_livraison || '',
  };
}

export default function DonneesExtraitesPage() {
  const queryClient = useQueryClient();
  const [selectedImportId, setSelectedImportId] = useState('');
  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);
  const [revisionRows, setRevisionRows] = useState([]);
  const [editingRowId, setEditingRowId] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectComment, setRejectComment] = useState('');
  const [headerDraft, setHeaderDraft] = useState(getHeaderFromImport(null));
  const [headerSaved, setHeaderSaved] = useState(getHeaderFromImport(null));
  const [isHeaderEditing, setIsHeaderEditing] = useState(false);
  const [isHeaderModified, setIsHeaderModified] = useState(false);
  const [modalWidth, setModalWidth] = useState(860);
  const [isValidationProcessing, setIsValidationProcessing] = useState(false);
  const [validationNotice, setValidationNotice] = useState('');

  const resizeRef = useRef({
    active: false,
    side: null,
    startX: 0,
    startWidth: 860,
  });

  const importsQuery = useQuery({
    queryKey: ['procurement', 'imports', 'gestionnaire-staging'],
    queryFn: getImports,
    staleTime: 30000,
  });

  const imports = useMemo(() => {
    const rows = extractArrayPayload(importsQuery.data?.data);

    return rows.map((item) => {
      const id = item.id_import ?? item.idImport;
      return {
        id,
        titre: pickValue(item, ['titre_fichier', 'titreFichier'], `Import #${id || '—'}`),
        reference: pickValue(item, ['reference_document', 'referenceDocument'], '—'),
        fournisseur: pickValue(item, ['fournisseur_denomination', 'fournisseurDenomination'], '—'),
        telephone: pickValue(item, ['fournisseur_telephone', 'fournisseurTelephone'], ''),
        email: pickValue(item, ['fournisseur_email', 'fournisseurEmail'], ''),
        adresse: pickValue(item, ['fournisseur_adresse', 'fournisseurAdresse'], ''),
        delai_livraison: pickValue(item, ['delai_execution', 'delaiExecution'], ''),
        statut: String(pickValue(item, ['statut_import', 'statutImport'], '')).toLowerCase(),
        dateCreation: pickValue(item, ['date_creation', 'dateCreation'], ''),
      };
    });
  }, [importsQuery.data?.data]);

  const effectiveImportId = selectedImportId || imports[0]?.id || '';

  const stagingQuery = useQuery({
    queryKey: ['procurement', 'staging', 'gestionnaire-page', effectiveImportId],
    queryFn: () => getStagingItems(effectiveImportId),
    enabled: Boolean(effectiveImportId),
    staleTime: 0,
  });

  const stagingItems = useMemo(() => extractArrayPayload(stagingQuery.data?.data), [stagingQuery.data?.data]);

  const selectedImport = imports.find((item) => String(item.id) === String(effectiveImportId)) || null;
  const isSelectedImportValidated = selectedImport?.statut === 'valide';

  const categoriesQuery = useQuery({
    queryKey: ['resources', 'categories', 'donnees-extraites'],
    queryFn: getCategories,
    enabled: isRevisionModalOpen,
    staleTime: 30000,
  });

  const resourcesQuery = useQuery({
    queryKey: ['resources', 'ressources', 'donnees-extraites-disabled'],
    queryFn: async () => ({ data: [] }),
    enabled: false,
    staleTime: 15000,
  });

  const categories = useMemo(() => extractArrayPayload(categoriesQuery.data?.data), [categoriesQuery.data?.data]);
  const resources = useMemo(() => extractArrayPayload(resourcesQuery.data?.data), [resourcesQuery.data?.data]);

  const bulkValidateMutation = useMutation({
    mutationFn: (rows) => bulkValidateStagingItems(rows),
    onMutate: () => {
      setIsValidationProcessing(true);
    },
    onSuccess: async (response) => {
      const approvedCount = response?.data?.approved_items ?? 0;
      toast.success(`Validation terminée (${approvedCount} ligne(s)).`);
      closeRevisionModal();
      await refreshQueries();
    },
    onError: (error) => {
      const errorData = error?.response?.data;
      let message = errorData?.detail;
      if (!message && errorData && typeof errorData === 'object') {
        const firstEntry = Object.values(errorData)[0];
        if (Array.isArray(firstEntry) && firstEntry.length > 0) {
          message = String(firstEntry[0]);
        } else if (firstEntry) {
          message = String(firstEntry);
        }
      }
      if (!message) message = 'Échec de la validation.';
      toast.error(message);
      setIsRevisionModalOpen(true);
    },
    onSettled: () => {
      setIsValidationProcessing(false);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ itemId, data }) => rejectItem(itemId, data),
  });

  useEffect(() => {
    function handleMouseMove(event) {
      if (!resizeRef.current.active) return;

      const minWidth = 680;
      const maxWidth = Math.floor(window.innerWidth * 0.95);
      const deltaX = event.clientX - resizeRef.current.startX;
      const direction = resizeRef.current.side === 'left' ? -1 : 1;
      const nextWidth = resizeRef.current.startWidth + (direction * deltaX);
      const clamped = Math.max(minWidth, Math.min(maxWidth, nextWidth));
      setModalWidth(clamped);
    }

    function handleMouseUp() {
      resizeRef.current.active = false;
      resizeRef.current.side = null;
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  function refreshQueries() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: ['procurement', 'imports', 'gestionnaire-staging'] }),
      queryClient.invalidateQueries({ queryKey: ['procurement', 'staging', 'gestionnaire-page', effectiveImportId] }),
      queryClient.invalidateQueries({ queryKey: ['procurement', 'marches'] }),
      queryClient.invalidateQueries({ queryKey: ['resources', 'stocks'] }),
      queryClient.invalidateQueries({ queryKey: ['resources', 'instances'] }),
      queryClient.invalidateQueries({ queryKey: ['resources', 'ressources'] }),
      queryClient.invalidateQueries({ queryKey: ['resources', 'stock'] }),
      importsQuery.refetch(),
      stagingQuery.refetch(),
    ]);
  }

  function openRevisionModal() {
    if (!effectiveImportId) return;
    setRevisionRows(stagingItems.map(normalizeRevisionRow));
    const importHeader = getHeaderFromImport(selectedImport);
    setHeaderDraft(importHeader);
    setHeaderSaved(importHeader);
    setIsHeaderEditing(false);
    setIsHeaderModified(false);
    setEditingRowId(null);
    setValidationNotice('');
    setIsRevisionModalOpen(true);
  }

  function closeRevisionModal() {
    setIsRevisionModalOpen(false);
    setRevisionRows([]);
    setIsHeaderEditing(false);
    setEditingRowId(null);
    setValidationNotice('');
  }

  function hideRevisionModal() {
    setIsRevisionModalOpen(false);
    setIsHeaderEditing(false);
    setEditingRowId(null);
  }

  function beginModalResize(side, event) {
    event.preventDefault();
    event.stopPropagation();
    resizeRef.current = {
      active: true,
      side,
      startX: event.clientX,
      startWidth: modalWidth,
    };
  }

  function closeRejectModal() {
    setRejectTarget(null);
    setRejectReason('');
    setRejectComment('');
  }

  function updateRevisionRow(rowId, patch) {
    setValidationNotice('');
    setRevisionRows((prev) => prev.map((row) => (row.id_staging === rowId ? { ...row, ...patch } : row)));
  }

  function openRejectModal(row) {
    setRejectTarget(row);
    setRejectReason('');
    setRejectComment('');
  }

  function beginRowEdit(rowId) {
    setEditingRowId(rowId);
  }

  function endRowEdit() {
    setEditingRowId(null);
  }

  function cancelRowEdit(rowId) {
    setRevisionRows((prev) =>
      prev.map((row) => {
        if (row.id_staging !== rowId) return row;
        return {
          ...row,
          designation_normalisee: row.__original?.designation_normalisee ?? row.designation_normalisee,
          description: row.__original?.description ?? row.description,
          quantite: row.__original?.quantite ?? row.quantite,
          prix_unitaire_ht: row.__original?.prix_unitaire_ht ?? row.prix_unitaire_ht,
          prix_total_ht: row.__original?.prix_total_ht ?? row.prix_total_ht,
          unite: row.__original?.unite ?? row.unite,
          type_detecte: row.__original?.type_detecte ?? row.type_detecte,
          categorie_taxonomy: row.__original?.categorie_taxonomy ?? row.categorie_taxonomy,
          sous_categorie: row.__original?.sous_categorie ?? row.sous_categorie,
          id_categorie_suggeree: row.__original?.id_categorie_suggeree ?? row.id_categorie_suggeree,
          id_ressource_liee: row.__original?.id_ressource_liee ?? row.id_ressource_liee,
          correction_gestionnaire: row.__original?.correction_gestionnaire ?? row.correction_gestionnaire,
        };
      })
    );
    setEditingRowId(null);
  }

  async function confirmReject() {
    if (!rejectTarget || !rejectReason) return;
    if (rejectReason === 'autre' && !rejectComment.trim()) {
      toast.error("Le commentaire est obligatoire pour le statut 'Autre'.");
      return;
    }

    const rowsToReject = revisionRows.filter((row) => row.statut !== 'approuve' && row.statut !== 'rejete');
    if (rowsToReject.length === 0) {
      toast.error("Aucune ligne rejetable dans cette extraction.");
      return;
    }

    try {
      for (const row of rowsToReject) {
        await rejectMutation.mutateAsync({
          itemId: row.id_staging,
          data: {
            motif_rejet: rejectReason,
            commentaire_rejet: rejectComment,
          },
        });
      }

      setRevisionRows((prev) =>
        prev.map((row) =>
          rowsToReject.some((candidate) => candidate.id_staging === row.id_staging)
            ? {
                ...row,
                statut: 'rejete',
                motif_rejet: rejectReason,
                commentaire_rejet: rejectComment,
              }
            : row
        )
      );

      toast.success(`Extraction rejetée (${rowsToReject.length} ligne(s)).`);
      closeRejectModal();
      await refreshQueries();
    } catch (error) {
      const message = error?.response?.data?.detail || 'Échec du rejet.';
      toast.error(message);
    }
  }

  const dirtyCount = revisionRows.filter((row) => hasRowChanged(row)).length;
  const readyRows = revisionRows.filter((row) => row.statut !== 'rejete');
  const readyCount = readyRows.filter((row) => {
    const designationOk = String(row.designation_normalisee || '').trim().length > 0;
    return designationOk;
  }).length;
  const canBulkValidate = readyRows.length > 0 && readyCount === readyRows.length && !bulkValidateMutation.isPending;
  const rejectableRows = revisionRows.filter((row) => row.statut !== 'approuve' && row.statut !== 'rejete');
  const canRejectExtraction = rejectableRows.length > 0 && !rejectMutation.isPending;

  function openRejectExtractionModal() {
    openRejectModal({
      id_import: effectiveImportId,
      total_count: revisionRows.length,
      rejectable_count: rejectableRows.length,
    });
  }

  async function submitBulkValidation() {
    const rowsToValidate = readyRows.map(serializeRevisionRow);
    if (readyRows.length === 0 || readyCount !== readyRows.length) {
      const message =
        'Complétez toutes les lignes avant validation. Chaque ligne doit avoir une désignation normalisée.';
      setValidationNotice(message);
      toast.error(message);
      return;
    }

    setValidationNotice('');
    hideRevisionModal();
    bulkValidateMutation.mutate({
      titre: headerDraft.titre,
      reference: headerDraft.reference,
      fournisseur: headerDraft.fournisseur,
      telephone: headerDraft.telephone,
      email: headerDraft.email,
      adresse: headerDraft.adresse,
      delai_livraison: headerDraft.delai_livraison,
      articles: rowsToValidate,
    });
  }

  function renderHeaderInfoField(label, value) {
    return (
      <div style={{ display: 'grid', gap: 4 }}>
        <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6, color: '#6b7280' }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{value || '—'}</span>
      </div>
    );
  }

  function updateHeaderDraft(field, value) {
    setHeaderDraft((prev) => ({ ...prev, [field]: value }));
  }

  function saveHeaderDraft() {
    setHeaderSaved(headerDraft);
    setIsHeaderEditing(false);
    setIsHeaderModified(true);
  }

  function cancelHeaderEdit() {
    setHeaderDraft(headerSaved);
    setIsHeaderEditing(false);
  }

  return (
    <div className="page-stack">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h1 className="page-title">Données Extraites</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {!isSelectedImportValidated ? (
            <button
              className="btn btn-secondary"
              onClick={openRevisionModal}
              disabled={!effectiveImportId || stagingQuery.isLoading || isValidationProcessing}
            >
              Ouvrir la révision
            </button>
          ) : null}
        </div>
      </div>

      <div className="section-shell" style={{ display: 'grid', gap: 10 }}>
        <label className="field-label">Import</label>
        <select
          className="field-input"
          value={effectiveImportId}
          onChange={(e) => setSelectedImportId(e.target.value)}
          disabled={imports.length === 0}
        >
          {imports.length === 0 ? (
            <option value="">Aucun import</option>
          ) : (
            imports.map((item) => (
              <option key={item.id} value={item.id}>
                #{item.id} — {item.titre}
              </option>
            ))
          )}
        </select>

        {effectiveImportId ? (
          <div className="data-table-wrap">
            <table className="data-table" style={{ fontSize: 14 }}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Titre</th>
                  <th>Référence</th>
                  <th>Fournisseur</th>
                  <th>Statut</th>
                  <th>Date création</th>
                </tr>
              </thead>
              <tbody>
                {imports
                  .filter((item) => String(item.id) === String(effectiveImportId))
                  .map((item) => (
                    <tr key={item.id}>
                      <td>{item.id}</td>
                      <td>{item.titre}</td>
                      <td>{item.reference}</td>
                      <td>{item.fournisseur}</td>
                      <td><StatusBadge map={IMPORT_STATUT_LABELS} value={item.statut} /></td>
                      <td>{formatDate(item.dateCreation)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <div className="section-shell" style={{ display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 24 }}>Informations extraites</h2>
        {selectedImport ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 12, fontSize: 14 }}>
            <div><strong>Titre:</strong> {selectedImport.titre}</div>
            <div><strong>Référence:</strong> {selectedImport.reference || '—'}</div>
            <div><strong>Fournisseur:</strong> {selectedImport.fournisseur || '—'}</div>
            <div><strong>Téléphone:</strong> {selectedImport.telephone || '—'}</div>
            <div><strong>Email:</strong> {selectedImport.email || '—'}</div>
            <div><strong>Adresse:</strong> {selectedImport.adresse || '—'}</div>
            <div><strong>Délai livraison:</strong> {selectedImport.delai_livraison ? `${selectedImport.delai_livraison} jour(s)` : '—'}</div>
            <div><strong>Statut:</strong> <StatusBadge map={IMPORT_STATUT_LABELS} value={selectedImport.statut} /></div>
          </div>
        ) : null}

        {stagingQuery.isLoading ? (
          <div style={{ height: 140, borderRadius: 10, background: '#f3f4f6' }} />
        ) : (
          <div className="data-table-wrap">
            <table className="data-table" style={{ fontSize: 14 }}>
              <thead>
                <tr>
                  <th>Désignation brute</th>
                  <th>Désignation normalisée</th>
                  <th>Description</th>
                  <th>Qté</th>
                  <th>PU HT</th>
                  <th>PT HT</th>
                </tr>
              </thead>
              <tbody>
                {stagingItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty-state">Aucune donnée extraite.</td>
                  </tr>
                ) : (
                  stagingItems.map((item, index) => (
                    <tr key={item.id_staging ?? item.idStaging ?? item.id ?? `row-${index}`}>
                      <td>{pickValue(item, ['designation_brute', 'designationBrute'], '—')}</td>
                      <td>{pickValue(item, ['designation_normalisee', 'designationNormalisee'], '—')}</td>
                      <td>{pickValue(item, ['description'], '—')}</td>
                      <td>{pickValue(item, ['quantite'], '—')}</td>
                      <td>{formatMoney(pickValue(item, ['prix_unitaire_ht', 'prixUnitaireHt'], null))}</td>
                      <td>{formatMoney(pickValue(item, ['prix_total_ht', 'prixTotalHt'], null))}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isRevisionModalOpen ? (
        <div
          style={modalOverlayStyle}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeRevisionModal();
          }}
        >
          <div style={{ ...revisionModalStyle, width: `${modalWidth}px` }} onClick={(e) => e.stopPropagation()}>
            <div
              style={resizeHandleLeftStyle}
              onMouseDown={(event) => beginModalResize('left', event)}
              role="presentation"
            />
            <div
              style={resizeHandleRightStyle}
              onMouseDown={(event) => beginModalResize('right', event)}
              role="presentation"
            />
            <div style={modalHeaderStyle}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: '#1a1a2e' }}>Révision des articles extraits</h2>
                  <p style={{ fontSize: 12, color: 'rgba(0, 0, 0, 0.4)', margin: '4px 0 0' }}>
                    Vérifiez et corrigez les informations avant intégration.
                  </p>
                </div>
                <button
                  onClick={closeRevisionModal}
                  style={modalCloseButtonStyle}
                  aria-label="Fermer"
                >
                  <X size={16} />
                </button>
              </div>
              <div style={revisionSummaryStyle}>
                <div><strong>Import</strong> #{effectiveImportId || '—'}</div>
                <div><strong>Modifiées</strong> {dirtyCount}</div>
                <div><strong>Prêtes</strong> {readyCount}/{readyRows.length}</div>
              </div>
            </div>

            <div style={modalBodyStyle}>
              <div className="revision-header-grid">
              <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <strong style={{ fontSize: 14 }}>Informations import</strong>
                  {isHeaderModified ? (
                    <span className="badge" style={{ background: '#fef3c7', color: '#92400e' }}>Modifié</span>
                  ) : null}
                </div>
                {!isHeaderEditing ? (
                  <button className="btn btn-secondary" onClick={() => setIsHeaderEditing(true)}>
                    Modifier les informations
                  </button>
                ) : null}
              </div>

              {isHeaderEditing ? (
                <>
                  <input className="revision-header-input" value={headerDraft.titre} onChange={(e) => updateHeaderDraft('titre', e.target.value)} placeholder="Titre" />
                  <input className="revision-header-input" value={headerDraft.reference} onChange={(e) => updateHeaderDraft('reference', e.target.value)} placeholder="Référence" />
                  <input className="revision-header-input" value={headerDraft.fournisseur} onChange={(e) => updateHeaderDraft('fournisseur', e.target.value)} placeholder="Fournisseur" />
                  <input className="revision-header-input" value={headerDraft.telephone} onChange={(e) => updateHeaderDraft('telephone', e.target.value)} placeholder="Téléphone" />
                  <input className="revision-header-input" value={headerDraft.email} onChange={(e) => updateHeaderDraft('email', e.target.value)} placeholder="Email" />
                  <input className="revision-header-input" value={headerDraft.adresse} onChange={(e) => updateHeaderDraft('adresse', e.target.value)} placeholder="Adresse" />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="number"
                      className="revision-header-input"
                      value={headerDraft.delai_livraison}
                      onChange={(e) => updateHeaderDraft('delai_livraison', e.target.value)}
                      placeholder="Délai livraison"
                    />
                    <span style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>jour(s)</span>
                  </div>
                  <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button className="btn btn-secondary" onClick={cancelHeaderEdit}>Annuler</button>
                    <button className="btn btn-primary" style={{ background: '#15803d', borderColor: '#15803d' }} onClick={saveHeaderDraft}>
                      Enregistrer
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {renderHeaderInfoField('Titre', headerDraft.titre)}
                  {renderHeaderInfoField('Référence', headerDraft.reference)}
                  {renderHeaderInfoField('Fournisseur', headerDraft.fournisseur)}
                  {renderHeaderInfoField('Téléphone', headerDraft.telephone)}
                  {renderHeaderInfoField('Email', headerDraft.email)}
                  {renderHeaderInfoField('Adresse', headerDraft.adresse)}
                  {renderHeaderInfoField('Délai livraison', headerDraft.delai_livraison ? `${headerDraft.delai_livraison} jour(s)` : '')}
                </>
              )}
              </div>

              <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                    <th style={thStyle}>Désignation brute</th>
                    <th style={thStyle}>Désignation normalisée</th>
                    <th style={thStyle}>Description</th>
                    <th style={thStyle}>Qté</th>
                    <th style={thStyle}>PU HT</th>
                    <th style={thStyle}>PT HT</th>
                    <th style={thStyle}>Unité</th>
                    <th style={thStyle}>Type</th>
                    <th style={thStyle}>Catégorie</th>
                    <th style={thStyle}>Sous-Catégorie</th>
                    <th style={thStyle}>Statut</th>
                    <th style={thStyle}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {revisionRows.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="empty-state">
                        Aucune donnée extraite.
                      </td>
                    </tr>
                  ) : (
                    revisionRows.map((row) => {
                      const isEditing = editingRowId === row.id_staging;
                      const selectedCategory = categories.find((category) => String(category.id_categorie) === String(row.id_categorie_suggeree));
                      const taxonomyCategories = getCategoryOptionsByType(row.type_detecte || 'consommable');
                      const subCategories = getSousCategoryOptions(row.type_detecte || 'consommable', row.categorie_taxonomy);

                      return (
                        <tr
                          key={row.id_staging}
                          style={{
                            borderTop: '1px solid #f1f5f9',
                            background: row.statut === 'rejete' ? '#fef2f2' : isEditing ? '#ecfdf5' : '#fff',
                          }}
                        >
                          <td style={tdStyle}>{row.designation_brute}</td>
                          <td style={tdStyle}>
                            {isEditing ? (
                              <input
                                className="field-input"
                                style={editableInputStyle}
                                value={row.designation_normalisee}
                                onChange={(e) => updateRevisionRow(row.id_staging, { designation_normalisee: e.target.value })}
                              />
                            ) : (
                              row.designation_normalisee || '—'
                            )}
                          </td>
                          <td style={tdStyle}>
                            {isEditing ? (
                              <input
                                className="field-input"
                                style={editableInputStyle}
                                value={row.description}
                                onChange={(e) => updateRevisionRow(row.id_staging, { description: e.target.value })}
                              />
                            ) : (
                              row.description || '—'
                            )}
                          </td>
                          <td style={tdStyle}>
                            {isEditing ? (
                              <input
                                className="field-input"
                                style={editableInputStyle}
                                type="number"
                                value={row.quantite}
                                onChange={(e) => updateRevisionRow(row.id_staging, { quantite: e.target.value })}
                              />
                            ) : (
                              row.quantite || '—'
                            )}
                          </td>
                          <td style={tdStyle}>
                            {isEditing ? (
                              <input
                                className="field-input"
                                style={editableInputStyle}
                                type="number"
                                value={row.prix_unitaire_ht}
                                onChange={(e) => updateRevisionRow(row.id_staging, { prix_unitaire_ht: e.target.value })}
                              />
                            ) : (
                              formatMoney(row.prix_unitaire_ht)
                            )}
                          </td>
                          <td style={tdStyle}>
                            {isEditing ? (
                              <input
                                className="field-input"
                                style={editableInputStyle}
                                type="number"
                                value={row.prix_total_ht}
                                onChange={(e) => updateRevisionRow(row.id_staging, { prix_total_ht: e.target.value })}
                              />
                            ) : (
                              formatMoney(row.prix_total_ht)
                            )}
                          </td>
                          <td style={tdStyle}>
                            {isEditing ? (
                              <input
                                className="field-input"
                                style={editableInputStyle}
                                value={row.unite}
                                onChange={(e) => updateRevisionRow(row.id_staging, { unite: e.target.value })}
                              />
                            ) : (
                              row.unite || '—'
                            )}
                          </td>
                          <td style={tdStyle}>
                            {isEditing ? (
                              <select
                                className="field-input"
                                style={editableInputStyle}
                                value={row.type_detecte || ''}
                                onChange={(e) => {
                                  const nextType = e.target.value || 'consommable';
                                  const nextCategories = getCategoryOptionsByType(nextType);
                                  const nextCategory = nextCategories[0] || '';
                                  const nextSousCategories = getSousCategoryOptions(nextType, nextCategory);
                                  updateRevisionRow(row.id_staging, {
                                    type_detecte: nextType,
                                    categorie_taxonomy: nextCategory,
                                    sous_categorie: nextSousCategories[0] || '',
                                  });
                                }}
                              >
                                <option value="">—</option>
                                <option value="consommable">Consommable</option>
                                <option value="bien_inventaire">Bien Inventaire</option>
                              </select>
                            ) : (
                              TYPE_LABELS[row.type_detecte] || row.type_detecte || '—'
                            )}
                          </td>
                          <td style={tdStyle}>
                            {isEditing ? (
                              <select
                                className="field-input"
                                style={editableInputStyle}
                                value={row.categorie_taxonomy || ''}
                                onChange={(e) => {
                                  const nextCategory = e.target.value;
                                  const nextSousCategories = getSousCategoryOptions(row.type_detecte || 'consommable', nextCategory);
                                  const categoryId = categories.find((category) => {
                                    const isCons = (row.type_detecte || 'consommable') === 'consommable';
                                    return isCons ? category.nom_categorie === 'Consommable' : category.nom_categorie === 'Bien Inventaire';
                                  })?.id_categorie;

                                  updateRevisionRow(row.id_staging, {
                                    categorie_taxonomy: nextCategory,
                                    sous_categorie: nextSousCategories[0] || '',
                                    id_categorie_suggeree: categoryId ? String(categoryId) : row.id_categorie_suggeree,
                                  });
                                }}
                              >
                                <option value="">—</option>
                                {taxonomyCategories.map((categoryName) => (
                                  <option key={categoryName} value={categoryName}>
                                    {formatTaxonomyLabel(categoryName)}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              formatTaxonomyLabel(row.categorie_taxonomy) || selectedCategory?.nom_categorie || row.id_categorie_suggeree || '—'
                            )}
                          </td>
                          <td style={tdStyle}>
                            {isEditing ? (
                              <select
                                className="field-input"
                                style={editableInputStyle}
                                value={row.sous_categorie || ''}
                                onChange={(e) => updateRevisionRow(row.id_staging, { sous_categorie: e.target.value })}
                              >
                                <option value="">—</option>
                                {subCategories.map((subName) => (
                                  <option key={subName} value={subName}>
                                    {formatSousCategoryLabel(subName)}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              formatSousCategoryLabel(row.sous_categorie) || '—'
                            )}
                          </td>
                          <td style={tdStyle}><StatusBadge map={STAGING_ITEM_LABELS} value={row.statut} /></td>
                          <td style={tdStyle}>
                            {row.statut === 'rejete' ? (
                              <StatusBadge map={STAGING_ITEM_LABELS} value={row.statut} />
                            ) : (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {isEditing ? (
                                  <>
                                    <button className="btn btn-secondary" onClick={endRowEdit}>
                                      Terminer
                                    </button>
                                    <button className="btn btn-secondary" onClick={() => cancelRowEdit(row.id_staging)}>
                                      Annuler
                                    </button>
                                  </>
                                ) : (
                                  <button className="btn btn-secondary" onClick={() => beginRowEdit(row.id_staging)}>
                                    Modifier
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
              </div>
            </div>

            <div style={modalFooterStyle}>
              <div style={{ fontSize: 13, color: '#6b7280' }}>
                {dirtyCount} ligne(s) modifiée(s). {readyCount}/{readyRows.length} ligne(s) prêtes à valider.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-secondary"
                  style={{ borderColor: '#fca5a5', color: '#b91c1c', background: '#fff1f2' }}
                  onClick={openRejectExtractionModal}
                  disabled={!canRejectExtraction}
                >
                  {rejectMutation.isPending ? 'Rejet...' : "Rejeter l'extraction"}
                </button>
                <button className="btn btn-primary" onClick={submitBulkValidation} disabled={bulkValidateMutation.isPending || isValidationProcessing}>
                  {bulkValidateMutation.isPending || isValidationProcessing ? 'Processing...' : 'Valider'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {rejectTarget ? (
        <div
          style={modalOverlayStyle}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeRejectModal();
          }}
        >
          <div style={{ ...rejectModalStyle, width: `${modalWidth}px` }} onClick={(e) => e.stopPropagation()}>
            <div
              style={resizeHandleLeftStyle}
              onMouseDown={(event) => beginModalResize('left', event)}
              role="presentation"
            />
            <div
              style={resizeHandleRightStyle}
              onMouseDown={(event) => beginModalResize('right', event)}
              role="presentation"
            />
            <div style={modalHeaderStyle}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: '#1a1a2e' }}>Rejeter l'extraction</h2>
                  <p style={{ fontSize: 12, color: 'rgba(0, 0, 0, 0.4)', margin: '4px 0 0' }}>
                    Cette action rejettera toutes les lignes encore non approuvées.
                  </p>
                </div>
                <button
                  onClick={closeRejectModal}
                  style={modalCloseButtonStyle}
                  aria-label="Fermer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div style={modalBodyStyle}>

            <div style={rejectSummaryStyle}>
              <div><strong>Import</strong> #{rejectTarget.id_import || effectiveImportId || '—'}</div>
              <div><strong>Lignes rejetables</strong> {rejectTarget.rejectable_count ?? 0} / {rejectTarget.total_count ?? 0}</div>
            </div>

            <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
              {REJECTION_REASONS.map((reason) => (
                <label key={reason.value} style={rejectRadioStyle}>
                  <input
                    type="radio"
                    name="reject-reason"
                    value={reason.value}
                    checked={rejectReason === reason.value}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                  <div style={{ display: 'grid', gap: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{reason.label}</span>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>{reason.subtitle}</span>
                  </div>
                </label>
              ))}
            </div>

            <label className="field-label" style={{ display: 'grid', gap: 6, marginTop: 14 }}>
              Commentaire {rejectReason === 'autre' ? <span style={{ color: '#dc2626' }}>*</span> : 'optionnel'}
              <textarea
                className="field-input"
                style={{ ...editableInputStyle, minHeight: 100, resize: 'vertical' }}
                value={rejectComment}
                onChange={(e) => setRejectComment(e.target.value)}
                placeholder="Ajoutez une précision si nécessaire"
              />
            </label>
            </div>

            <div style={modalFooterStyle}>
              <div style={{ fontSize: 13, color: '#6b7280' }}>
                Statut sélectionné:{' '}
                {rejectReason === 'non_conforme' ? (
                  <span className="text-red-700" style={{ color: '#b91c1c' }}>non_conforme</span>
                ) : null}
                {rejectReason === 'document_invalide' ? (
                  <span className="text-amber-700" style={{ color: '#b45309' }}>document_invalide</span>
                ) : null}
                {rejectReason === 'autre' ? (
                  <span className="text-black/50" style={{ color: 'rgba(17, 24, 39, 0.5)' }}>autre</span>
                ) : null}
                {!rejectReason ? '—' : null}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary" onClick={closeRejectModal} disabled={rejectMutation.isPending}>
                  Annuler
                </button>
                <button className="btn btn-danger" onClick={confirmReject} disabled={!rejectReason || rejectMutation.isPending}>
                  {rejectMutation.isPending ? 'Rejet...' : 'Rejeter'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {validationNotice && isRevisionModalOpen ? (
        <div
          style={{
            marginTop: 10,
            padding: '10px 14px',
            borderRadius: 12,
            border: '1px solid #fcd34d',
            background: '#fffbeb',
            color: '#92400e',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {validationNotice}
        </div>
      ) : null}

      {isValidationProcessing ? (
        <div
          style={{
            position: 'fixed',
            left: '50%',
            bottom: 24,
            transform: 'translateX(-50%)',
            zIndex: 2200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            minWidth: 340,
            maxWidth: '92vw',
            padding: '12px 16px',
            borderRadius: 999,
            border: '1px solid #bfdbfe',
            background: 'linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%)',
            color: '#1e40af',
            fontSize: 13,
            fontWeight: 600,
            boxShadow: '0 12px 28px rgba(37, 99, 235, 0.18)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#2563eb', display: 'inline-block' }} />
            Traitement en cours... les articles sont en train d'être validés et synchronisés.
          </div>
          <span style={{ fontSize: 12, color: '#1d4ed8', whiteSpace: 'nowrap' }}>Veuillez patienter</span>
        </div>
      ) : null}
    </div>
  );
}

const thStyle = { padding: 8, fontWeight: 600, whiteSpace: 'nowrap' };
const tdStyle = { padding: 8, verticalAlign: 'top' };

const modalOverlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 2000,
  padding: 16,
};

const revisionModalStyle = {
  background: '#fff',
  borderRadius: 16,
  border: '1px solid rgba(0, 0, 0, 0.06)',
  maxHeight: 'calc(100vh - 2rem)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  minWidth: 680,
  maxWidth: '95vw',
  position: 'relative',
};

const rejectModalStyle = {
  background: '#fff',
  borderRadius: 16,
  border: '1px solid rgba(0, 0, 0, 0.06)',
  maxHeight: 'calc(100vh - 2rem)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  minWidth: 680,
  maxWidth: '95vw',
  position: 'relative',
};

const resizeHandleLeftStyle = {
  position: 'absolute',
  left: -6,
  top: 0,
  width: 12,
  height: '100%',
  cursor: 'ew-resize',
  zIndex: 2,
};

const resizeHandleRightStyle = {
  position: 'absolute',
  right: -6,
  top: 0,
  width: 12,
  height: '100%',
  cursor: 'ew-resize',
  zIndex: 2,
};

const modalHeaderStyle = {
  padding: '24px 24px 16px',
  borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
  flexShrink: 0,
};

const revisionSummaryStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
  fontSize: 13,
  color: '#374151',
  marginTop: 10,
};

const modalBodyStyle = {
  flex: 1,
  overflowY: 'auto',
  padding: '16px 24px',
};

const modalFooterStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'center',
  padding: '16px 24px',
  borderTop: '1px solid rgba(0, 0, 0, 0.05)',
  background: '#fafaf8',
  flexShrink: 0,
};

const modalCloseButtonStyle = {
  width: 32,
  height: 32,
  borderRadius: 8,
  border: 'none',
  background: 'transparent',
  color: 'rgba(0, 0, 0, 0.35)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
};

const rejectSummaryStyle = {
  display: 'grid',
  gap: 6,
  padding: 10,
  borderRadius: 10,
  background: '#f9fafb',
  border: '1px solid #e5e7eb',
  fontSize: 13,
  color: '#374151',
};

const rejectRadioStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #e5e7eb',
  background: '#fff',
};

const editableInputStyle = {
  border: '1px solid #86efac',
  background: '#f0fdf4',
  borderRadius: 8,
  padding: '6px 8px',
  width: '100%',
  minWidth: 0,
  fontSize: 13,
};
