import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Pencil } from 'lucide-react';

import {
  approveItem,
  getImportById,
  getStagingItems,
  rejectItem,
  updateStagingItem,
} from '../../api/procurement';
import { getCategories, getRessources } from '../../api/resources';

function ProgressBar({ current, total }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div>
      <div style={{ fontSize: 13, color: '#374151', marginBottom: 6 }}>
        {current}/{total} approuvés
      </div>
      <div style={{ height: 10, background: '#e5e7eb', borderRadius: 999 }}>
        <div
          style={{
            height: 10,
            width: `${pct}%`,
            borderRadius: 999,
            background: '#10b981',
          }}
        />
      </div>
    </div>
  );
}

export default function StagingReviewPage() {
  const { import_id } = useParams();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [editingRowId, setEditingRowId] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [resourceSearch, setResourceSearch] = useState('');

  const importQuery = useQuery({
    queryKey: ['procurement', 'import', import_id],
    queryFn: () => getImportById(import_id),
    staleTime: 30000,
  });

  const stagingQuery = useQuery({
    queryKey: ['procurement', 'staging', import_id],
    queryFn: () => getStagingItems(import_id),
    staleTime: 0,
  });

  const categoriesQuery = useQuery({
    queryKey: ['resources', 'categories'],
    queryFn: getCategories,
    staleTime: 30000,
  });

  const resourcesQuery = useQuery({
    queryKey: ['resources', 'ressources', 'search', resourceSearch],
    queryFn: () => getRessources({ search: resourceSearch }),
    enabled: editingRowId !== null,
    staleTime: 15000,
  });

  const approveMutation = useMutation({
    mutationFn: approveItem,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['procurement', 'staging', import_id] }),
  });

  const rejectMutation = useMutation({
    mutationFn: rejectItem,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['procurement', 'staging', import_id] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateStagingItem(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['procurement', 'staging', import_id] }),
  });

  const items = stagingQuery.data?.data || [];

  const stats = useMemo(() => {
    const total = items.length;
    const pending = items.filter((item) => item.statut === 'en_attente').length;
    const approved = items.filter((item) => item.statut === 'approuve').length;
    const avgConfidence =
      total > 0
        ? items.reduce((acc, item) => acc + Number(item.confiance_ia || 0), 0) / total
        : 0;
    const lowConfidence = items.filter((item) => Number(item.confiance_ia || 0) < 0.7);
    return {
      total,
      pending,
      approved,
      avgConfidence,
      lowConfidence,
    };
  }, [items]);

  async function approveAll() {
    const targets = items.filter((item) => item.statut !== 'approuve' && item.id_ressource_liee);
    await Promise.all(targets.map((item) => approveMutation.mutateAsync(item.id_staging)));
  }

  function startEdit(item) {
    setEditingRowId(item.id_staging);
    setResourceSearch(item.designation_normalisee || item.designation_brute || '');
    setDrafts((prev) => ({
      ...prev,
      [item.id_staging]: {
        designation_normalisee: item.designation_normalisee || '',
        quantite: item.quantite,
        id_type_suggeree: item.id_type_suggeree || '',
        id_ressource_liee: item.id_ressource_liee || null,
      },
    }));
  }

  function updateDraft(id, patch) {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        ...patch,
      },
    }));
  }

  async function saveEdit(item) {
    const draft = drafts[item.id_staging] || {};
    await updateMutation.mutateAsync({ id: item.id_staging, data: draft });
    setEditingRowId(null);
    setResourceSearch('');
  }

  async function linkResource(itemId, resourceId) {
    const normalizedId = resourceId ? Number(resourceId) : null;
    await updateMutation.mutateAsync({
      id: itemId,
      data: { id_ressource_liee: normalizedId },
    });
    updateDraft(itemId, { id_ressource_liee: normalizedId });
  }

  const canBulkApprove =
    stats.lowConfidence.length === 0 &&
    items.every((item) => item.statut === 'approuve' || Boolean(item.id_ressource_liee));

  if (stagingQuery.isLoading || importQuery.isLoading) {
    return <div style={{ height: 220, borderRadius: 10, background: '#f3f4f6' }} />;
  }

  const importData = importQuery.data?.data;
  const categories = categoriesQuery.data?.data || [];
  const resources = resourcesQuery.data?.data || [];

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h1 style={{ margin: 0 }}>Révision staging IA</h1>
        <button style={secondaryButton} onClick={() => navigate('/gestionnaire/marches')}>
          Retour Marchés
        </button>
      </div>

      <section style={sectionStyle}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10 }}>
          <Metric label="Marché" value={`#${importData?.id_marche || '—'}`} />
          <Metric label="Total items" value={stats.total} />
          <Metric label="Pending" value={stats.pending} />
          <Metric label="Confiance avg" value={stats.avgConfidence.toFixed(2)} />
        </div>
        <div style={{ marginTop: 12 }}>
          <ProgressBar current={stats.approved} total={stats.total} />
        </div>
      </section>

      <section style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>Staging items</h3>
          <button
            style={{ ...primaryButton, opacity: canBulkApprove ? 1 : 0.5 }}
            disabled={!canBulkApprove}
            onClick={approveAll}
            title={canBulkApprove ? '' : "Liez d'abord une ressource existante"}
          >
            Tout approuver
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                <th style={thStyle}>Désignation brute</th>
                <th style={thStyle}>Désignation normalisée</th>
                <th style={thStyle}>Qté</th>
                <th style={thStyle}>Catégorie suggérée</th>
                <th style={thStyle}>Ressource</th>
                <th style={thStyle}>Confiance IA</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const isLow = Number(item.confiance_ia || 0) < 0.7;
                const hasLinkedResource = Boolean(item.id_ressource_liee);

                return (
                  <tr
                    key={item.id_staging}
                    style={{
                      borderTop: '1px solid #f3f4f6',
                      background: isLow ? '#fffbeb' : '#fff',
                    }}
                  >
                    <td style={tdStyle}>{item.designation_brute}</td>
                    <td style={tdStyle}>{item.designation_normalisee || '—'}</td>
                    <td style={tdStyle}>{item.quantite}</td>
                    <td style={tdStyle}>
                      {categories.find((cat) => cat.id_type_article === item.id_type_suggeree)?.nom_categorie || '—'}
                    </td>
                    <td style={tdStyle}>
                      {hasLinkedResource ? (
                        <span>#{item.id_ressource_liee}</span>
                      ) : (
                        <span
                          title="Liez d'abord une ressource existante"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#b45309' }}
                        >
                          <AlertTriangle size={14} />
                          Non liée
                        </span>
                      )}
                    </td>
                    <td style={tdStyle}>{Number(item.confiance_ia || 0).toFixed(2)}</td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          style={{ ...approveButton, opacity: hasLinkedResource ? 1 : 0.5 }}
                          disabled={!hasLinkedResource}
                          title={hasLinkedResource ? '' : "Liez d'abord une ressource existante"}
                          onClick={() => approveMutation.mutate(item.id_staging)}
                        >
                          Approuver
                        </button>
                        <button style={rejectButton} onClick={() => rejectMutation.mutate(item.id_staging)}>
                          Rejeter
                        </button>
                        <button style={secondaryButton} onClick={() => startEdit(item)}>
                          <Pencil size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {editingRowId !== null && (() => {
        const item = items.find((row) => row.id_staging === editingRowId);
        if (!item) return null;
        const draft = drafts[item.id_staging] || {};
        return (
          <div style={modalOverlayStyle}>
            <div style={modalStyle}>
              <h3 style={{ marginTop: 0 }}>Éditer l'article staging</h3>
              <div style={{ display: 'grid', gap: 10 }}>
                <label style={labelStyle}>
                  Désignation normalisée
                  <input
                    style={inputStyle}
                    value={draft.designation_normalisee ?? ''}
                    onChange={(e) => updateDraft(item.id_staging, { designation_normalisee: e.target.value })}
                  />
                </label>

                <label style={labelStyle}>
                  Quantité
                  <input
                    style={inputStyle}
                    type="number"
                    value={draft.quantite ?? item.quantite}
                    onChange={(e) => updateDraft(item.id_staging, { quantite: Number(e.target.value) })}
                  />
                </label>

                <label style={labelStyle}>
                  Catégorie suggérée
                  <select
                    style={inputStyle}
                    value={draft.id_type_suggeree ?? item.id_type_suggeree ?? ''}
                    onChange={(e) =>
                      updateDraft(item.id_staging, {
                        id_type_suggeree: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  >
                    <option value="">—</option>
                    {categories.map((cat) => (
                      <option key={cat.id_type_article} value={cat.id_type_article}>
                        {cat.nom_categorie}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={labelStyle}>
                  Rechercher ressource
                  <input
                    style={inputStyle}
                    value={resourceSearch}
                    onChange={(e) => setResourceSearch(e.target.value)}
                    placeholder="Tapez une désignation..."
                  />
                </label>

                <label style={labelStyle}>
                  Lier une ressource existante
                  <select
                    style={inputStyle}
                    value={draft.id_ressource_liee ?? item.id_ressource_liee ?? ''}
                    onChange={(e) => linkResource(item.id_staging, e.target.value || null)}
                  >
                    <option value="">—</option>
                    {resources.map((resource) => (
                      <option key={resource.id_ressource} value={resource.id_ressource}>
                        {resource.designation}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
                <button
                  style={secondaryButton}
                  onClick={() => {
                    setEditingRowId(null);
                    setResourceSearch('');
                  }}
                >
                  Annuler
                </button>
                <button style={primaryButton} onClick={() => saveEdit(item)}>
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
      <div style={{ fontSize: 12, color: '#6b7280' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>{value}</div>
    </div>
  );
}

const sectionStyle = {
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  background: '#fff',
  padding: 12,
};

const thStyle = { padding: 8, fontWeight: 600 };
const tdStyle = { padding: 8 };

const inputStyle = {
  border: '1px solid #d1d5db',
  borderRadius: 8,
  padding: '6px 8px',
  fontSize: 13,
};

const labelStyle = {
  display: 'grid',
  gap: 6,
  fontSize: 13,
  color: '#374151',
};

const modalOverlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(17, 24, 39, 0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 40,
  padding: 16,
};

const modalStyle = {
  width: 'min(620px, 100%)',
  background: '#fff',
  borderRadius: 12,
  border: '1px solid #e5e7eb',
  padding: 16,
};

const primaryButton = {
  border: 'none',
  borderRadius: 8,
  padding: '6px 10px',
  background: '#111827',
  color: '#fff',
  cursor: 'pointer',
};

const secondaryButton = {
  border: '1px solid #d1d5db',
  borderRadius: 8,
  padding: '6px 10px',
  background: '#fff',
  color: '#111827',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
};

const approveButton = {
  border: 'none',
  borderRadius: 8,
  padding: '6px 10px',
  background: '#16a34a',
  color: '#fff',
  cursor: 'pointer',
};

const rejectButton = {
  border: 'none',
  borderRadius: 8,
  padding: '6px 10px',
  background: '#dc2626',
  color: '#fff',
  cursor: 'pointer',
};
