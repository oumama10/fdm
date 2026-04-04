import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { getRetours } from '../../api/returns';
import RetourCreateModal from './RetourCreateModal';

export default function RetoursPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);

  const retoursQuery = useQuery({
    queryKey: ['chef', 'retours'],
    queryFn: getRetours,
    staleTime: 30000,
  });

  const rows = useMemo(() => {
    return [...(retoursQuery.data?.data || [])].sort(
      (a, b) => new Date(b.date_retour || 0) - new Date(a.date_retour || 0)
    );
  }, [retoursQuery.data?.data]);

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Mes Retours</h1>
        <button style={primaryButton} onClick={() => setShowCreateModal(true)}>
          Signaler un retour
        </button>
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
        {retoursQuery.isLoading ? (
          <div style={{ padding: 14 }}><div style={{ height: 180, borderRadius: 8, background: '#f3f4f6' }} /></div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Ressource</th>
                <th style={thStyle}>Motif</th>
                <th style={thStyle}>Décision</th>
                <th style={thStyle}>Observation</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 16, color: '#6b7280' }}>Aucun retour.</td></tr>
              ) : rows.map((row) => (
                <tr key={row.id_retour} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={tdStyle}>{row.date_retour ? new Date(row.date_retour).toLocaleDateString('fr-FR') : '—'}</td>
                  <td style={tdStyle}>{row.ressource?.designation || '—'}</td>
                  <td style={tdStyle}>{row.motif_retour || '—'}</td>
                  <td style={tdStyle}>{row.decision || '—'}</td>
                  <td style={tdStyle}>{row.observation || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreateModal ? (
        <RetourCreateModal onClose={() => setShowCreateModal(false)} onCreated={() => retoursQuery.refetch()} />
      ) : null}
    </div>
  );
}

const primaryButton = {
  border: 'none',
  borderRadius: 8,
  padding: '8px 12px',
  background: '#111827',
  color: '#fff',
  cursor: 'pointer',
};

const thStyle = { padding: 10, fontWeight: 600 };
const tdStyle = { padding: 10 };
