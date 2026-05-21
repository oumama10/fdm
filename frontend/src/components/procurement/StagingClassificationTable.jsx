import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getStagingItems, updateStagingItem } from '../../api/procurement';
import { getCategories, getSousCategories } from '../../api/resources';
import { STAGING_ITEM_LABELS, StatusBadge } from '@/constants/statuts.jsx';

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

export default function StagingClassificationTable({ importId }) {
  const queryClient = useQueryClient();

  const [editingRowId, setEditingRowId] = useState(null);
  const [rowDrafts, setRowDrafts] = useState({});

  const stagingQuery = useQuery({
    queryKey: ['procurement', 'staging', importId],
    queryFn: () => getStagingItems(importId),
    enabled: !!importId,
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

  const patchStagingMutation = useMutation({
    mutationFn: ({ id, data }) => updateStagingItem(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['procurement', 'staging', importId] }),
  });

  const items = stagingQuery.data?.data || [];
  const categories = categoriesQuery.data?.data || [];
  const allSousCategories = sousCategoriesQuery.data?.data || [];

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

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            <th style={thStyle}>Désignation</th>
            <th style={{ ...thStyle, width: 80 }}>Qté</th>
            <th style={{ ...thStyle, width: 130 }}>Type</th>
            <th style={{ ...thStyle, width: 160 }}>Catégorie</th>
            <th style={{ ...thStyle, width: 160 }}>Sous-catégorie</th>
            <th style={{ ...thStyle, width: 140 }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {stagingQuery.isLoading ? (
            <tr><td colSpan={6} style={{ padding: '16px 12px', color: T.textMuted }}>Chargement des articles...</td></tr>
          ) : items.length === 0 ? (
            <tr><td colSpan={6} style={{ padding: '16px 12px', color: T.textMuted }}>Aucun article extrait.</td></tr>
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
                  {isEditing ? (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button style={btnPrimary} onClick={() => saveRow(itemId)} disabled={patchStagingMutation.isPending}>
                        Enregistrer
                      </button>
                      <button style={btnOutline} onClick={cancelEdit}>Annuler</button>
                    </div>
                  ) : (
                    <button style={btnSecondary} onClick={() => startEdit(item)}>Modifier (Classer)</button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const thStyle      = { padding: '9px 12px', fontSize: 12, fontWeight: 700, color: T.textMuted, textAlign: 'left', borderBottom: `1px solid ${T.border}`, background: T.bgSubtle };
const tdStyle      = { padding: '10px 12px', fontSize: 13, color: T.textMid, verticalAlign: 'middle' };
const inputStyle   = { border: `1px solid ${T.border}`, borderRadius: T.radiusSm, padding: '6px 10px', fontSize: 13, color: T.textDark, background: T.bgWhite, width: '100%', boxSizing: 'border-box' };
const btnBase      = { border: 'none', borderRadius: T.radiusSm, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' };
const btnPrimary   = { ...btnBase, background: T.blue, color: '#fff' };
const btnSecondary = { ...btnBase, border: `1px solid ${T.border}`, background: T.bgWhite, color: T.textMid };
const btnOutline   = { ...btnBase, border: `1px solid ${T.border}`, background: T.bgWhite, color: T.textMid };
