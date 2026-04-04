import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { getDemandes } from '../../api/requests';

function Badge({ value, type }) {
  const urgencyColors = {
    normal: { bg: '#e5e7eb', color: '#111827' },
    moyen: { bg: '#fcd34d', color: '#78350f' },
    urgent: { bg: '#fecaca', color: '#991b1b' },
  };
  const statusColors = {
    en_cours: { bg: '#dbeafe', color: '#1e3a8a' },
    validee: { bg: '#bbf7d0', color: '#14532d' },
    refusee: { bg: '#fecaca', color: '#991b1b' },
    complete: { bg: '#99f6e4', color: '#134e4a' },
    complete_avec_decharge: { bg: '#99f6e4', color: '#134e4a' },
  };

  const palette = type === 'urgence' ? urgencyColors : statusColors;
  const tone = palette[value] || { bg: '#e5e7eb', color: '#374151' };

  return (
    <span style={{ borderRadius: 999, padding: '4px 8px', background: tone.bg, color: tone.color, fontSize: 12, fontWeight: 600 }}>
      {String(value || '').replaceAll('_', ' ')}
    </span>
  );
}

export default function DemandesListPage() {
  const navigate = useNavigate();
  const [statut, setStatut] = useState('');
  const [urgence, setUrgence] = useState('');
  const [service, setService] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const demandesQuery = useQuery({
    queryKey: ['demandes', 'list'],
    queryFn: () => getDemandes(),
    staleTime: 30000,
  });

  const services = useMemo(() => {
    const map = new Map();
    (demandesQuery.data?.data || []).forEach((row) => {
      if (row.service?.id_service) {
        map.set(String(row.service.id_service), row.service.nom_service);
      }
    });
    return Array.from(map.entries()).map(([id, nom]) => ({ id, nom }));
  }, [demandesQuery.data?.data]);

  const rows = useMemo(() => {
    const raw = demandesQuery.data?.data || [];
    return [...raw]
      .filter((row) => (statut ? row.statut === statut : true))
      .filter((row) => (urgence ? row.urgence === urgence : true))
      .filter((row) => (service ? String(row.id_service) === service : true))
      .filter((row) => (dateFrom ? new Date(row.date_demande) >= new Date(dateFrom) : true))
      .filter((row) => (dateTo ? new Date(row.date_demande) <= new Date(`${dateTo}T23:59:59`) : true))
      .sort((a, b) => new Date(b.date_demande || 0) - new Date(a.date_demande || 0));
  }, [demandesQuery.data?.data, statut, urgence, service, dateFrom, dateTo]);

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <h1 style={{ margin: 0 }}>Demandes</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 10 }}>
        <select value={statut} onChange={(e) => setStatut(e.target.value)} style={inputStyle}>
          <option value="">Tous statuts</option>
          <option value="en_cours">en_cours</option>
          <option value="validee">validee</option>
          <option value="refusee">refusee</option>
          <option value="complete">complete</option>
          <option value="complete_avec_decharge">complete_avec_decharge</option>
        </select>

        <select value={urgence} onChange={(e) => setUrgence(e.target.value)} style={inputStyle}>
          <option value="">Toutes urgences</option>
          <option value="normal">normal</option>
          <option value="moyen">moyen</option>
          <option value="urgent">urgent</option>
        </select>

        <select value={service} onChange={(e) => setService(e.target.value)} style={inputStyle}>
          <option value="">Tous services</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>{s.nom}</option>
          ))}
        </select>

        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={inputStyle} />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={inputStyle} />
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
        {demandesQuery.isLoading ? (
          <div style={{ padding: 14 }}><div style={{ height: 180, borderRadius: 8, background: '#f3f4f6' }} /></div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                <th style={thStyle}>N°</th>
                <th style={thStyle}>Chef demandeur</th>
                <th style={thStyle}>Service</th>
                <th style={thStyle}>Urgence</th>
                <th style={thStyle}>Statut</th>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 16, color: '#6b7280' }}>Aucune demande trouvée.</td></tr>
              ) : rows.map((row) => (
                <tr
                  key={row.id_demande}
                  style={{ borderTop: '1px solid #f3f4f6', cursor: 'pointer' }}
                  onClick={() => navigate(`/gestionnaire/demandes/${row.id_demande}`)}
                >
                  <td style={tdStyle}>#{row.id_demande}</td>
                  <td style={tdStyle}>{row.chef_demandeur?.nom_complet || '—'}</td>
                  <td style={tdStyle}>{row.service?.nom_service || '—'}</td>
                  <td style={tdStyle}><Badge type="urgence" value={row.urgence} /></td>
                  <td style={tdStyle}><Badge type="statut" value={row.statut} /></td>
                  <td style={tdStyle}>{row.date_demande ? new Date(row.date_demande).toLocaleDateString('fr-FR') : '—'}</td>
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
