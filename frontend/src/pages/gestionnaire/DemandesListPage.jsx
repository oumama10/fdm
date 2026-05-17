import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { getDemandes } from '../../api/requests';

// ── Design tokens ──────────────────────────────────────────────────────────
const T = {
  blue: '#0C447C', lightBlue: '#1a7abf',
  textDark: '#0f172a', textMid: '#374151', textMuted: '#64748b',
  border: '#e2e8f0', bgWhite: '#ffffff', bgSubtle: '#f8fafc',
  radius: 12, radiusSm: 8,
};

// camelCase-first helpers (djangorestframework_camel_case is global)
const _id      = (d) => d.idDemande      ?? d.id_demande;
const _statut  = (d) => d.statut;
const _urgence = (d) => d.urgence;
const _date    = (d) => d.dateDemande    ?? d.date_demande;
const _chef    = (d) => (d.chefDemandeur ?? d.chef_demandeur)?.nomComplet
                     ?? (d.chefDemandeur ?? d.chef_demandeur)?.nom_complet
                     ?? '—';
const _svcId   = (d) => d.service?.idService  ?? d.service?.id_service  ?? d.idService  ?? d.id_service;
const _svcNom  = (d) => d.service?.nomService ?? d.service?.nom_service ?? '—';

const URGENCE_BADGE = {
  normal: { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
  moyen:  { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  urgent: { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
};
const STATUT_BADGE = {
  en_cours:  { bg: '#dbeafe', color: '#1e3a8a', border: '#93c5fd' },
  partielle: { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  totale:    { bg: '#bbf7d0', color: '#14532d', border: '#86efac' },
  refusee:   { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
};

function Badge({ value, type }) {
  const palette = type === 'urgence' ? URGENCE_BADGE : STATUT_BADGE;
  const s = palette[value] || { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      {String(value || '').replaceAll('_', ' ')}
    </span>
  );
}

export default function DemandesListPage() {
  const navigate = useNavigate();
  const [statut,   setStatut]   = useState('');
  const [urgence,  setUrgence]  = useState('');
  const [service,  setService]  = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');

  const demandesQuery = useQuery({
    queryKey: ['demandes', 'list'],
    queryFn:  () => getDemandes(),
    staleTime: 30000,
  });

  const services = useMemo(() => {
    const map = new Map();
    (demandesQuery.data?.data || []).forEach((row) => {
      const sid = _svcId(row);
      if (sid) map.set(String(sid), _svcNom(row));
    });
    return Array.from(map.entries()).map(([id, nom]) => ({ id, nom }));
  }, [demandesQuery.data?.data]);

  const rows = useMemo(() => {
    const raw = demandesQuery.data?.data || [];
    return [...raw]
      .filter((row) => (statut   ? _statut(row)        === statut              : true))
      .filter((row) => (urgence  ? _urgence(row)        === urgence             : true))
      .filter((row) => (service  ? String(_svcId(row)) === service             : true))
      .filter((row) => (dateFrom ? new Date(_date(row)) >= new Date(dateFrom)  : true))
      .filter((row) => (dateTo   ? new Date(_date(row)) <= new Date(`${dateTo}T23:59:59`) : true))
      .sort((a, b) => new Date(_date(b) || 0) - new Date(_date(a) || 0));
  }, [demandesQuery.data?.data, statut, urgence, service, dateFrom, dateTo]);

  return (
    <div style={{ display: 'grid', gap: 16, paddingBottom: 40 }}>
      {/* ── Table shell ── */}
      <div style={tableShell}>

        {/* Toolbar / filters */}
        <div style={toolbar}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
            <select value={statut} onChange={(e) => setStatut(e.target.value)} style={selectStyle}>
              <option value="">Tous statuts</option>
              <option value="en_cours">En cours</option>
              <option value="partielle">Partielle</option>
              <option value="totale">Totale</option>
              <option value="refusee">Refusée</option>
            </select>

            <select value={urgence} onChange={(e) => setUrgence(e.target.value)} style={selectStyle}>
              <option value="">Toutes urgences</option>
              <option value="normal">Normal</option>
              <option value="moyen">Moyen</option>
              <option value="urgent">Urgent</option>
            </select>

            <select value={service} onChange={(e) => setService(e.target.value)} style={selectStyle}>
              <option value="">Tous services</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.nom}</option>
              ))}
            </select>

            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={selectStyle}
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={selectStyle}
            />
          </div>
        </div>

        {/* Table */}
        {demandesQuery.isLoading ? (
          <div style={{ padding: 20 }}>
            <div style={{ height: 180, borderRadius: T.radiusSm, background: T.bgSubtle }} />
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['N°', 'Chef demandeur', 'Service', 'Urgence', 'Statut', 'Date', 'Actions'].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '16px 12px', color: T.textMuted, fontSize: 13 }}>
                      Aucune demande trouvée.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={_id(row)}
                      style={{ borderTop: `1px solid ${T.border}`, cursor: 'pointer' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = T.bgSubtle; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
                      onClick={() => navigate(`/gestionnaire/demandes/${_id(row)}`)}
                    >
                      <td style={{ ...tdStyle, fontFamily: 'monospace', color: T.textMuted, fontSize: 12 }}>
                        #{_id(row)}
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 600, color: T.textDark }}>{_chef(row)}</td>
                      <td style={{ ...tdStyle, color: T.textMid }}>{_svcNom(row)}</td>
                      <td style={tdStyle}><Badge type="urgence" value={_urgence(row)} /></td>
                      <td style={tdStyle}><Badge type="statut"  value={_statut(row)}  /></td>
                      <td style={{ ...tdStyle, color: T.textMid }}>
                        {_date(row) ? new Date(_date(row)).toLocaleDateString('fr-FR') : '—'}
                      </td>
                      <td
                        style={tdStyle}
                        onClick={(e) => { e.stopPropagation(); navigate(`/gestionnaire/demandes/${_id(row)}`); }}
                      >
                        <span style={linkStyle}>Voir détail →</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const tableShell  = { border: `1px solid ${T.border}`, borderRadius: T.radius, overflow: 'hidden', background: T.bgWhite };
const toolbar     = { padding: '12px 16px', background: T.bgSubtle, borderBottom: `1px solid ${T.border}` };
const thStyle     = { padding: '9px 12px', fontSize: 12, fontWeight: 700, color: T.textMuted, textAlign: 'left', borderBottom: `1px solid ${T.border}`, background: T.bgSubtle };
const tdStyle     = { padding: '10px 12px', fontSize: 13, color: T.textMid, verticalAlign: 'middle' };
const selectStyle = { border: `1px solid ${T.border}`, borderRadius: T.radiusSm, padding: '7px 10px', fontSize: 13, color: T.textDark, background: T.bgWhite, width: '100%' };
const linkStyle   = { color: T.lightBlue, fontWeight: 600, fontSize: 12, cursor: 'pointer' };
