import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { getDecharges } from '../../api/decharge';
import { getDemandes } from '../../api/requests';

function SignatureBadge({ value }) {
  const tones = {
    non_generee: { bg: '#e5e7eb', color: '#374151' },
    en_attente: { bg: '#fde68a', color: '#78350f' },
    signe: { bg: '#bfdbfe', color: '#1e3a8a' },
    valide: { bg: '#bbf7d0', color: '#14532d' },
    rejete: { bg: '#fecaca', color: '#991b1b' },
  };
  const tone = tones[value] || tones.non_generee;
  return (
    <span style={{ borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 600, background: tone.bg, color: tone.color }}>
      {(value || 'non_generee').replaceAll('_', ' ')}
    </span>
  );
}

export default function DechargesListPage() {
  const navigate = useNavigate();
  const [filterStatut, setFilterStatut] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const dechargesQuery = useQuery({
    queryKey: ['decharge', 'list'],
    queryFn: getDecharges,
    staleTime: 30000,
  });
  const demandesQuery = useQuery({
    queryKey: ['demandes', 'for-decharge-list'],
    queryFn: () => getDemandes(),
    staleTime: 30000,
  });

  const serviceByDemande = useMemo(() => {
    const map = new Map();
    (demandesQuery.data?.data || []).forEach((d) => {
      map.set(Number(d.id_demande), d.service?.nom_service || '—');
    });
    return map;
  }, [demandesQuery.data?.data]);

  const rows = useMemo(() => {
    const raw = dechargesQuery.data?.data || [];
    return raw
      .filter((row) => (filterStatut ? row.statut_signature === filterStatut : true))
      .filter((row) => (dateFrom ? new Date(row.date_generation) >= new Date(dateFrom) : true))
      .filter((row) => (dateTo ? new Date(row.date_generation) <= new Date(`${dateTo}T23:59:59`) : true))
      .sort((a, b) => new Date(b.date_generation || 0) - new Date(a.date_generation || 0));
  }, [dechargesQuery.data?.data, filterStatut, dateFrom, dateTo]);

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <h1 style={{ margin: 0 }}>Décharges</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <select value={filterStatut} onChange={(e) => setFilterStatut(e.target.value)} style={inputStyle}>
          <option value="">Tous statuts signature</option>
          <option value="non_generee">non_generee</option>
          <option value="en_attente">en_attente</option>
          <option value="signe">signe</option>
          <option value="valide">valide</option>
          <option value="rejete">rejete</option>
        </select>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={inputStyle} />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={inputStyle} />
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
        {dechargesQuery.isLoading ? (
          <div style={{ padding: 14 }}><div style={{ height: 180, borderRadius: 8, background: '#f3f4f6' }} /></div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                <th style={thStyle}>N° Décharge</th>
                <th style={thStyle}>Service</th>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Statut signature</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 16, color: '#6b7280' }}>Aucune décharge.</td></tr>
              ) : rows.map((row) => (
                <tr
                  key={row.id_decharge}
                  style={{ borderTop: '1px solid #f3f4f6', cursor: 'pointer' }}
                  onClick={() => navigate(`/gestionnaire/decharges/${row.id_decharge}`)}
                >
                  <td style={tdStyle}>{row.numero_decharge}</td>
                  <td style={tdStyle}>{serviceByDemande.get(Number(row.id_demande)) || '—'}</td>
                  <td style={tdStyle}>{row.date_generation ? new Date(row.date_generation).toLocaleDateString('fr-FR') : '—'}</td>
                  <td style={tdStyle}><SignatureBadge value={row.statut_signature} /></td>
                  <td style={tdStyle}>Voir détail</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const inputStyle = {
  border: '1px solid #d1d5db',
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 14,
};

const thStyle = { padding: 10, fontWeight: 600 };
const tdStyle = { padding: 10 };
