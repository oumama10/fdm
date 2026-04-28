import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { getDemandes } from '../../api/requests';
import NouvelleDemandeModal from './NouvelleDemandeModal';

function Badge({ value, type }) {
  const urgencyColors = {
    normal: { bg: '#e5e7eb', color: '#111827' },
    moyen: { bg: '#fcd34d', color: '#78350f' },
    urgent: { bg: '#fecaca', color: '#991b1b' },
  };
  const statusColors = {
    en_cours: { bg: '#dbeafe', color: '#1e3a8a' },
    partielle: { bg: '#fde68a', color: '#78350f' },
    totale: { bg: '#bbf7d0', color: '#14532d' },
    refusee: { bg: '#fecaca', color: '#991b1b' },
  };

  const palette = type === 'urgence' ? urgencyColors : statusColors;
  const tone = palette[value] || { bg: '#e5e7eb', color: '#374151' };

  return (
    <span style={{ borderRadius: 999, padding: '4px 8px', fontSize: 12, fontWeight: 600, background: tone.bg, color: tone.color }}>
      {String(value || '').replaceAll('_', ' ')}
    </span>
  );
}

export default function DemandesPage() {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);

  const demandesQuery = useQuery({
    queryKey: ['chef', 'demandes'],
    queryFn: () => getDemandes(),
    staleTime: 30000,
  });

  const rows = useMemo(() => {
    return [...(demandesQuery.data?.data || [])].sort(
      (a, b) => new Date(b.date_demande || 0) - new Date(a.date_demande || 0)
    );
  }, [demandesQuery.data?.data]);

  function progression(row) {
    const lignes = row.lignes || [];
    const total = lignes.length;
    const delivered = lignes.filter((l) => Number(l.quantite_accordee || 0) > 0).length;
    return `${delivered} articles livrés / ${total} total`;
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Mes Demandes</h1>
        <button style={primaryButton} onClick={() => setShowModal(true)}>Nouvelle demande</button>
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
        {demandesQuery.isLoading ? (
          <div style={{ padding: 14 }}><div style={{ height: 180, borderRadius: 8, background: '#f3f4f6' }} /></div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                <th style={thStyle}>N°</th>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Urgence</th>
                <th style={thStyle}>Statut</th>
                <th style={thStyle}>Progression</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 16, color: '#6b7280' }}>Aucune demande.</td></tr>
              ) : rows.map((row) => (
                <tr
                  key={row.id_demande}
                  style={{ borderTop: '1px solid #f3f4f6', cursor: 'pointer' }}
                  onClick={() => navigate(`/chef/demandes/${row.id_demande}`)}
                >
                  <td style={tdStyle}>#{row.id_demande}</td>
                  <td style={tdStyle}>{row.date_demande ? new Date(row.date_demande).toLocaleDateString('fr-FR') : '—'}</td>
                  <td style={tdStyle}><Badge type="urgence" value={row.urgence} /></td>
                  <td style={tdStyle}><Badge type="statut" value={row.statut} /></td>
                  <td style={tdStyle}>{progression(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal ? (
        <NouvelleDemandeModal onClose={() => setShowModal(false)} onCreated={() => demandesQuery.refetch()} />
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
