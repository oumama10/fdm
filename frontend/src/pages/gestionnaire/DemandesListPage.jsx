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
    partielle: { bg: '#fde68a', color: '#78350f' },
    totale: { bg: '#bbf7d0', color: '#14532d' },
    refusee: { bg: '#fecaca', color: '#991b1b' },
  };

  const palette = type === 'urgence' ? urgencyColors : statusColors;
  const tone = palette[value] || { bg: '#e5e7eb', color: '#374151' };

  return (
    <span className="status-chip" style={{ background: tone.bg, color: tone.color }}>
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
    <div className="page-stack">
      <h1 className="page-title">Demandes</h1>

      <div className="section-shell">
        <div className="filter-grid">
        <label className="field-label" style={{ display: 'grid', gap: 4 }}>
          Statut
          <select name="filter-statut" value={statut} onChange={(e) => setStatut(e.target.value)} className="field-input">
            <option value="">Tous statuts</option>
            <option value="en_cours">en_cours</option>
            <option value="partielle">partielle</option>
            <option value="totale">totale</option>
            <option value="refusee">refusee</option>
          </select>
        </label>

        <label className="field-label" style={{ display: 'grid', gap: 4 }}>
          Urgence
          <select name="filter-urgence" value={urgence} onChange={(e) => setUrgence(e.target.value)} className="field-input">
            <option value="">Toutes urgences</option>
            <option value="normal">normal</option>
            <option value="moyen">moyen</option>
            <option value="urgent">urgent</option>
          </select>
        </label>

        <label className="field-label" style={{ display: 'grid', gap: 4 }}>
          Service
          <select name="filter-service" value={service} onChange={(e) => setService(e.target.value)} className="field-input">
            <option value="">Tous services</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.nom}</option>
            ))}
          </select>
        </label>

        <label className="field-label" style={{ display: 'grid', gap: 4 }}>
          Date début
          <input type="date" name="filter-date-from" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="field-input" />
        </label>
        <label className="field-label" style={{ display: 'grid', gap: 4 }}>
          Date fin
          <input type="date" name="filter-date-to" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="field-input" />
        </label>
        </div>
      </div>

      <div className="data-table-wrap">
        {demandesQuery.isLoading ? (
          <div style={{ padding: 14 }}><div style={{ height: 180, borderRadius: 8, background: '#f3f4f6' }} /></div>
        ) : (
          <table className="data-table" style={{ fontSize: 14 }}>
            <thead>
              <tr>
                <th>N°</th>
                <th>Chef demandeur</th>
                <th>Service</th>
                <th>Urgence</th>
                <th>Statut</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={7} className="empty-state">Aucune demande trouvée.</td></tr>
              ) : rows.map((row) => (
                <tr
                  key={row.id_demande}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/gestionnaire/demandes/${row.id_demande}`)}
                >
                  <td>#{row.id_demande}</td>
                  <td>{row.chef_demandeur?.nom_complet || '—'}</td>
                  <td>{row.service?.nom_service || '—'}</td>
                  <td><Badge type="urgence" value={row.urgence} /></td>
                  <td><Badge type="statut" value={row.statut} /></td>
                  <td>{row.date_demande ? new Date(row.date_demande).toLocaleDateString('fr-FR') : '—'}</td>
                  <td>Voir détail</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
