import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { downloadPdf, getDecharges } from '../../api/decharge';

function StatutBadge({ statut }) {
  const map = {
    non_generee: { bg: '#fef3c7', color: '#92400e', label: 'Non signé' },
    en_attente:  { bg: '#fef3c7', color: '#92400e', label: 'Non signé' },
    signe:       { bg: '#d1fae5', color: '#065f46', label: 'Signé' },
    valide:      { bg: '#d1fae5', color: '#065f46', label: 'Validé' },
    rejete:      { bg: '#fee2e2', color: '#991b1b', label: 'Rejeté' },
  };
  const tone = map[statut] || map.non_generee;
  return (
    <span className="status-chip" style={{ background: tone.bg, color: tone.color }}>
      {tone.label}
    </span>
  );
}

function articlesSummary(lignes) {
  if (!lignes?.length) return '—';
  if (lignes.length === 1) return lignes[0].ressource?.designation || '1 article';
  return `${lignes.length} articles`;
}

export default function DechargesPage() {
  const navigate = useNavigate();

  const dechargesQuery = useQuery({
    queryKey: ['decharge', 'chef-list'],
    queryFn: getDecharges,
    staleTime: 30000,
  });

  const rows = useMemo(() => {
    const raw = dechargesQuery.data?.data || [];
    return [...raw].sort((a, b) => new Date(b.date_generation || 0) - new Date(a.date_generation || 0));
  }, [dechargesQuery.data?.data]);

  async function handleDownload(id, e) {
    e.stopPropagation();
    try {
      const response = await downloadPdf(id);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `decharge-${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('PDF non disponible.');
    }
  }

  return (
    <div className="page-stack">
      <h1 className="page-title">Mes Décharges</h1>

      <div className="data-table-wrap">
        {dechargesQuery.isLoading ? (
          <div style={{ padding: 14 }}>
            <div style={{ height: 180, borderRadius: 8, background: '#f3f4f6' }} />
          </div>
        ) : (
          <table className="data-table" style={{ fontSize: 14 }}>
            <thead>
              <tr>
                <th>Référence</th>
                <th>Date</th>
                <th>Articles</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-state">Aucune décharge.</td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id_decharge}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/chef/decharges/${row.id_decharge}`)}
                  >
                    <td style={{ fontWeight: 600 }}>{row.numero_decharge}</td>
                    <td>{row.date_generation ? new Date(row.date_generation).toLocaleDateString('fr-FR') : '—'}</td>
                    <td style={{ color: '#6b7280' }}>{articlesSummary(row.lignes)}</td>
                    <td><StatutBadge statut={row.statut_signature} /></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: 12, padding: '4px 8px' }}
                          onClick={(e) => { e.stopPropagation(); navigate(`/chef/decharges/${row.id_decharge}`); }}
                        >
                          Voir
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: 12, padding: '4px 8px' }}
                          onClick={(e) => handleDownload(row.id_decharge, e)}
                        >
                          Imprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
