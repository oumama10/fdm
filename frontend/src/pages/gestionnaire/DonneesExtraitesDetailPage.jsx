import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  bulkValidateStaging,
  getImportById,
  getStagingItems,
  rejectItem,
  updateImport,
  updateStagingItem,
} from '../../api/procurement';
import { getCategories, getSousCategories } from '../../api/resources';
import { MOTIFS_REJET, STAGING_ITEM_LABELS, StatusBadge } from '@/constants/statuts.jsx';

// ── Design tokens ──────────────────────────────────────────────────────────
const T = {
  blue: '#0C447C', lightBlue: '#1a7abf', green: '#16a34a', red: '#dc2626',
  textDark: '#0f172a', textMid: '#374151', textMuted: '#64748b',
  border: '#e2e8f0', bgWhite: '#ffffff', bgSubtle: '#f8fafc',
  radius: 12, radiusSm: 8,
};

const TYPE_OPTIONS = [
  { value: '', label: '—' },
  { value: 'bien_inventaire', label: 'Bien Inventaire' },
  { value: 'consommable', label: 'Consommable' },
];

export default function DonneesExtraitesDetailPage() {
  const { import_id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [rejectReason, setRejectReason] = useState('');
  const [rejectComment, setRejectComment] = useState('');
  const [editingRowId, setEditingRowId] = useState(null);
  const [rowDrafts, setRowDrafts] = useState({});

  const importQuery = useQuery({
    queryKey: ['procurement', 'import', import_id],
    queryFn: () => getImportById(import_id),
    staleTime: 15000,
  });

  const stagingQuery = useQuery({
    queryKey: ['procurement', 'staging', import_id],
    queryFn: () => getStagingItems(import_id),
    staleTime: 0,
  });

  const categoriesQuery = useQuery({
    queryKey: ['resources', 'categories'],
    queryFn: () => getCategories(),
    staleTime: 60000,
  });

  const sousCategoriesQuery = useQuery({
    queryKey: ['resources', 'sous-categories', 'all'],
    queryFn: () => getSousCategories(),
    staleTime: 60000,
  });

  const importData = importQuery.data?.data;
  const importId = importData?.idImport ?? importData?.id_import ?? import_id;
  const importStatut = importData?.statutImport ?? importData?.statut_import;
  const isReadOnly = importStatut === 'valide' || importStatut === 'rejete';

  const [headerDraft, setHeaderDraft] = useState(null);

  const draft = headerDraft ?? {
    titre_fichier: importData?.titreFichier ?? importData?.titre_fichier ?? '',
    reference_document: importData?.referenceDocument ?? importData?.reference_document ?? '',
    fournisseur_denomination: importData?.fournisseurDenomination ?? importData?.fournisseur_denomination ?? '',
    fournisseur_telephone: importData?.fournisseurTelephone ?? importData?.fournisseur_telephone ?? '',
    fournisseur_email: importData?.fournisseurEmail ?? importData?.fournisseur_email ?? '',
    fournisseur_adresse: importData?.fournisseurAdresse ?? importData?.fournisseur_adresse ?? '',
    delai_execution: importData?.delaiExecution ?? importData?.delai_execution ?? '',
    date_attribution: importData?.date_attribution ?? '',
    marque: importData?.marque ?? '',
    comite_conformite: importData?.comite_conformite ?? '',
  };

  const patchImportMutation = useMutation({
    mutationFn: ({ id, data }) => updateImport(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement', 'import', import_id] });
      queryClient.invalidateQueries({ queryKey: ['procurement', 'imports', 'donnees-extraites'] });
    },
  });

  const patchStagingMutation = useMutation({
    mutationFn: ({ id, data }) => updateStagingItem(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['procurement', 'staging', import_id] }),
  });

  const rejectOneMutation = useMutation({
    mutationFn: ({ id, data }) => rejectItem(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['procurement', 'staging', import_id] }),
  });

  const bulkMutation = useMutation({
    mutationFn: bulkValidateStaging,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['procurement', 'staging', import_id] });
      queryClient.invalidateQueries({ queryKey: ['procurement', 'imports', 'donnees-extraites'] });
      if (variables.statut === 'approuve') {
        queryClient.invalidateQueries({ queryKey: ['resources', 'stocks'] });
        queryClient.invalidateQueries({ queryKey: ['resources', 'instances'] });
        queryClient.invalidateQueries({ queryKey: ['resources', 'stock-summary'] });
        queryClient.invalidateQueries({ queryKey: ['resources', 'ressources'] });
        queryClient.invalidateQueries({ queryKey: ['procurement', 'marches'] });
      }
      navigate('/gestionnaire/donnees-extraites');
    },
  });

  const items = stagingQuery.data?.data || [];
  const categories = categoriesQuery.data?.data || [];
  const allSousCategories = sousCategoriesQuery.data?.data || [];

  const stats = useMemo(() => {
    const total = items.length;
    const approved = items.filter((i) => i.statut === 'approuve').length;
    const rejected = items.filter((i) => i.statut === 'rejete').length;
    const pending = items.filter((i) => i.statut === 'en_attente').length;
    const modified = items.filter((i) => i.statut === 'modifie').length;
    return { total, approved, rejected, pending, modified };
  }, [items]);

  // Returns Categorie objects for a given type
  function getCategoriesForRow(itemId) {
    const type = rowDrafts[itemId]?.type_detecte;
    if (!type) return [];
    return categories.filter((c) => {
      const ta = c.typeArticle ?? c.type_article;
      return (ta?.nomCategorie ?? ta?.nom_categorie ?? '') === type;
    });
  }

  // Returns SousCategorie objects for the selected Categorie
  function getSousCategoriesForRow(itemId) {
    const catId = rowDrafts[itemId]?.id_root_sous_categorie;
    if (!catId) return [];
    return allSousCategories.filter((sc) =>
      String(sc.idCategorie ?? sc.id_categorie) === String(catId)
    );
  }

  function startEdit(item) {
    const itemId = item.idStaging ?? item.id_staging;
    const scId = String(item.idSousCategorieSuggeree ?? item.id_sous_categorie_suggeree ?? '');
    const sc = scId ? allSousCategories.find(
      (s) => String(s.idSousCategorie ?? s.id_sous_categorie) === scId
    ) : null;
    // Derive the Categorie ID from the SousCategorie's id_categorie FK
    const catId = sc ? String(sc.idCategorie ?? sc.id_categorie ?? '') : '';
    setEditingRowId(itemId);
    setRowDrafts((prev) => ({
      ...prev,
      [itemId]: {
        designation_normalisee: item.designationNormalisee ?? item.designation_normalisee ?? '',
        quantite: item.quantite ?? 1,
        type_detecte: item.typeDetecte ?? item.type_detecte ?? '',
        id_root_sous_categorie: catId,
        id_sous_categorie_suggeree: scId,
      },
    }));
  }

  function cancelEdit() { setEditingRowId(null); }

  function saveRow(itemId) {
    const d = rowDrafts[itemId];
    patchStagingMutation.mutate(
      {
        id: itemId,
        data: {
          designation_normalisee: d.designation_normalisee,
          quantite: Number(d.quantite) || 1,
          type_detecte: d.type_detecte || '',
          id_sous_categorie_suggeree: d.id_sous_categorie_suggeree || null,
        },
      },
      { onSuccess: () => setEditingRowId(null) },
    );
  }

  function updateRowDraft(itemId, key, value) {
    setRowDrafts((prev) => {
      const current = prev[itemId] || {};
      const updated = { ...current, [key]: value };
      if (key === 'type_detecte') {
        updated.id_root_sous_categorie = '';
        updated.id_sous_categorie_suggeree = '';
      }
      if (key === 'id_root_sous_categorie') {
        updated.id_sous_categorie_suggeree = '';
      }
      return { ...prev, [itemId]: updated };
    });
  }

  // Display label: the parent Categorie name of the saved SousCategorie
  function getCategoryLabel(item) {
    const scId = String(item.idSousCategorieSuggeree ?? item.id_sous_categorie_suggeree ?? '');
    if (!scId) return '—';
    const sc = allSousCategories.find((s) => String(s.idSousCategorie ?? s.id_sous_categorie) === scId);
    if (!sc) return '—';
    const catId = String(sc.idCategorie ?? sc.id_categorie ?? '');
    const cat = categories.find((c) => String(c.idCategorie ?? c.id_categorie) === catId);
    return cat ? (cat.nomCategorie ?? cat.nom_categorie ?? '—') : '—';
  }

  // Display label: the SousCategorie name
  function getSousCategoryLabel(item) {
    const scId = String(item.idSousCategorieSuggeree ?? item.id_sous_categorie_suggeree ?? '');
    if (!scId) return '—';
    const sc = allSousCategories.find((s) => String(s.idSousCategorie ?? s.id_sous_categorie) === scId);
    return sc ? (sc.nomSousCategorie ?? sc.nom_sous_categorie ?? scId) : '—';
  }

  function getTypeLabel(item) {
    const t = item.typeDetecte ?? item.type_detecte;
    if (t === 'bien_inventaire') return 'Bien Inventaire';
    if (t === 'consommable') return 'Consommable';
    return '—';
  }

  async function saveHeader() {
    await patchImportMutation.mutateAsync({ id: importId, data: draft });
  }

  async function validateImport() {
    await bulkMutation.mutateAsync({
      id_import: importId,
      statut: 'approuve',
      item_ids: items.filter((i) => i.statut !== 'approuve').map((i) => i.idStaging ?? i.id_staging),
    });
  }

  async function rejectImport() {
    await bulkMutation.mutateAsync({
      id_import: importId,
      statut: 'rejete',
      item_ids: items.filter((i) => i.statut !== 'rejete').map((i) => i.idStaging ?? i.id_staging),
      motif_rejet: rejectReason,
      commentaire_rejet: rejectComment,
    });
  }

  if (importQuery.isLoading) {
    return (
      <div style={{ padding: '32px 0', color: T.textMuted, fontSize: 14 }}>Chargement...</div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 16, paddingBottom: 40 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: T.blue }}>
          {isReadOnly ? `Import #${importId}` : `Révision import #${importId}`}
        </h1>
        <button style={btnOutline} onClick={() => navigate('/gestionnaire/donnees-extraites')}>
          ← Retour
        </button>
      </div>

      {/* ── Header form ── */}
      <div style={card}>
        <h3 style={sectionTitle}>Informations du document</h3>
        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {[
            ['Titre', 'titre_fichier'],
            ['Référence', 'reference_document'],
            ['Fournisseur', 'fournisseur_denomination'],
            ['Téléphone', 'fournisseur_telephone'],
            ['Email', 'fournisseur_email'],
            ['Délai exécution', 'delai_execution'],
            ['Date attribution', 'date_attribution'],
            ['Marque', 'marque'],
          ].map(([label, key]) => (
            <FieldLabel key={key} label={label}>
              {isReadOnly
                ? <span style={readOnlyValue}>{draft[key] || '—'}</span>
                : <input style={inputStyle} type={key === 'date_attribution' ? 'date' : 'text'} value={draft[key]} onChange={(e) => setHeaderDraft({ ...draft, [key]: e.target.value })} />
              }
            </FieldLabel>
          ))}
          <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <FieldLabel label="Comité de conformité (Observation/Commentaire)">
              {isReadOnly
                ? <span style={readOnlyValue}>{draft.comite_conformite || '—'}</span>
                : <textarea style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }} rows={2} value={draft.comite_conformite} onChange={(e) => setHeaderDraft({ ...draft, comite_conformite: e.target.value })} />
              }
            </FieldLabel>
            <FieldLabel label="Adresse fournisseur">
              {isReadOnly
                ? <span style={readOnlyValue}>{draft.fournisseur_adresse || '—'}</span>
                : <textarea style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }} rows={2} value={draft.fournisseur_adresse} onChange={(e) => setHeaderDraft({ ...draft, fournisseur_adresse: e.target.value })} />
              }
            </FieldLabel>
          </div>
        </div>
        {!isReadOnly && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
            <button style={btnSecondary} onClick={saveHeader} disabled={patchImportMutation.isPending}>
              {patchImportMutation.isPending ? 'Enregistrement...' : 'Enregistrer entête'}
            </button>
          </div>
        )}
      </div>

      {/* ── Articles table ── */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={sectionTitle}>Articles extraits</h3>
          <span style={{ fontSize: 13, color: T.textMuted }}>
            {stats.approved}/{stats.total} approuvés
            {stats.modified > 0 && <span style={{ color: '#ea580c' }}> — {stats.modified} modifiés</span>}
            {' '}— {stats.pending} en attente — {stats.rejected} rejetés
          </span>
        </div>

        <div style={{ overflowX: 'auto', border: `1px solid ${T.border}`, borderRadius: T.radiusSm }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={thStyle}>Désignation</th>
                <th style={{ ...thStyle, width: 80 }}>Quantité</th>
                <th style={{ ...thStyle, width: 130 }}>Type</th>
                <th style={{ ...thStyle, width: 160 }}>Catégorie</th>
                <th style={{ ...thStyle, width: 160 }}>Sous-catégorie</th>
                <th style={{ ...thStyle, width: 80 }}>Statut</th>
                <th style={{ ...thStyle, width: 190 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {stagingQuery.isLoading ? (
                <tr><td colSpan={7} style={{ padding: '16px 12px', color: T.textMuted }}>Chargement des articles...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: '16px 12px', color: T.textMuted }}>Aucun article extrait.</td></tr>
              ) : items.map((item) => {
                const itemId = item.idStaging ?? item.id_staging;
                const isEditing = editingRowId === itemId;
                const d = rowDrafts[itemId] || {};
                return (
                  <tr key={itemId} style={{ borderTop: `1px solid ${T.border}` }}>
                    <td style={tdStyle}>
                      {isEditing ? (
                        <input
                          style={inputStyle}
                          value={d.designation_normalisee}
                          onChange={(e) => updateRowDraft(itemId, 'designation_normalisee', e.target.value)}
                        />
                      ) : (
                        <span title={item.designationBrute ?? item.designation_brute} style={{ fontWeight: 500, color: T.textDark }}>
                          {(item.designationNormalisee ?? item.designation_normalisee) || (item.designationBrute ?? item.designation_brute)}
                        </span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      {isEditing ? (
                        <input
                          style={{ ...inputStyle, width: 64 }}
                          type="number" min={1}
                          value={d.quantite}
                          onChange={(e) => updateRowDraft(itemId, 'quantite', e.target.value)}
                        />
                      ) : item.quantite}
                    </td>
                    <td style={tdStyle}>
                      {isEditing ? (
                        <select style={inputStyle} value={d.type_detecte} onChange={(e) => updateRowDraft(itemId, 'type_detecte', e.target.value)}>
                          {TYPE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                      ) : getTypeLabel(item)}
                    </td>
                    <td style={tdStyle}>
                      {isEditing ? (
                        <select
                          style={inputStyle}
                          value={d.id_root_sous_categorie || ''}
                          onChange={(e) => updateRowDraft(itemId, 'id_root_sous_categorie', e.target.value)}
                          disabled={!d.type_detecte}
                        >
                          <option value="">—</option>
                          {getCategoriesForRow(itemId).map((c) => {
                            const cId = c.idCategorie ?? c.id_categorie;
                            return <option key={cId} value={cId}>{c.nomCategorie ?? c.nom_categorie}</option>;
                          })}
                        </select>
                      ) : getCategoryLabel(item)}
                    </td>
                    <td style={tdStyle}>
                      {isEditing ? (
                        <select
                          style={inputStyle}
                          value={d.id_sous_categorie_suggeree || ''}
                          onChange={(e) => updateRowDraft(itemId, 'id_sous_categorie_suggeree', e.target.value)}
                          disabled={!d.id_root_sous_categorie}
                        >
                          <option value="">—</option>
                          {getSousCategoriesForRow(itemId).map((sc) => {
                            const scId = sc.idSousCategorie ?? sc.id_sous_categorie;
                            return <option key={scId} value={scId}>{sc.nomSousCategorie ?? sc.nom_sous_categorie}</option>;
                          })}
                        </select>
                      ) : getSousCategoryLabel(item)}
                    </td>
                    <td style={tdStyle}>
                      <StatusBadge map={STAGING_ITEM_LABELS} value={item.statut} />
                    </td>
                    <td style={tdStyle}>
                      {isReadOnly ? null : isEditing ? (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button style={btnPrimary} onClick={() => saveRow(itemId)} disabled={patchStagingMutation.isPending}>
                            Enregistrer
                          </button>
                          <button style={btnOutline} onClick={cancelEdit}>Annuler</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button style={btnSecondary} onClick={() => startEdit(item)}>Modifier</button>
                          <button
                            style={btnDanger}
                            onClick={() => rejectOneMutation.mutate({
                              id: itemId,
                              data: { motif_rejet: rejectReason, commentaire_rejet: rejectComment },
                            })}
                          >
                            Rejeter
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Footer actions — hidden for read-only imports ── */}
      {!isReadOnly && (
        <div style={card}>
          <h3 style={{ ...sectionTitle, marginBottom: 14 }}>Actions globales</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
            <FieldLabel label="Motif de rejet">
              <select style={inputStyle} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}>
                <option value="">— Choisir un motif —</option>
                {MOTIFS_REJET.map((m) => (
                  <option key={m.value} value={m.value} title={m.sub}>{m.label}</option>
                ))}
              </select>
            </FieldLabel>
            <FieldLabel label="Commentaire">
              <input
                style={inputStyle}
                placeholder="Commentaire (optionnel)"
                value={rejectComment}
                onChange={(e) => setRejectComment(e.target.value)}
              />
            </FieldLabel>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button style={btnDanger} onClick={rejectImport} disabled={bulkMutation.isPending}>
              Rejeter tout
            </button>
            <button style={btnPrimary} onClick={validateImport} disabled={bulkMutation.isPending}>
              {bulkMutation.isPending ? 'Traitement...' : 'Valider tout'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FieldLabel({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </span>
      {children}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const card         = { background: T.bgWhite, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: '20px 24px' };
const sectionTitle = { margin: 0, fontSize: 15, fontWeight: 600, color: T.textDark };
const thStyle      = { padding: '9px 12px', fontSize: 12, fontWeight: 700, color: T.textMuted, textAlign: 'left', borderBottom: `1px solid ${T.border}`, background: T.bgSubtle };
const tdStyle      = { padding: '10px 12px', fontSize: 13, color: T.textMid, verticalAlign: 'middle' };
const inputStyle   = { border: `1px solid ${T.border}`, borderRadius: T.radiusSm, padding: '6px 10px', fontSize: 13, color: T.textDark, background: T.bgWhite, width: '100%', boxSizing: 'border-box' };
const btnBase      = { border: 'none', borderRadius: T.radiusSm, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' };
const btnPrimary   = { ...btnBase, background: T.blue, color: '#fff' };
const btnSecondary = { ...btnBase, border: `1px solid ${T.border}`, background: T.bgWhite, color: T.textMid };
const btnOutline   = { ...btnBase, border: `1px solid ${T.border}`, background: T.bgWhite, color: T.textMid };
const btnDanger    = { ...btnBase, background: T.red, color: '#fff' };
const readOnlyValue = { fontSize: 13, color: T.textDark, padding: '6px 0', display: 'block' };
