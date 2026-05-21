import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { getDemandes } from '../../api/requests';
import NouvelleDemandeModal from './NouvelleDemandeModal';

// ── Design tokens ──────────────────────────────────────────────────────────
const T = {
  green: '#0F6E56', lightGreen: '#1D9E75',
  textDark: '#0f172a', textMid: '#374151', textMuted: '#64748b',
  border: '#e2e8f0', bgWhite: '#ffffff', bgSubtle: '#f8fafc',
  radius: 12, radiusSm: 8,
};

const URGENCE_BADGE = {
  normal: { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
  moyen:  { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  urgent: { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
};
const STATUT_BADGE = {
  en_cours:    { bg: '#dbeafe', color: '#1e3a8a', border: '#93c5fd' },
  traite:      { bg: '#bbf7d0', color: '#14532d', border: '#86efac' },
  en_instance: { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
  refuse:      { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
};

const STATUT_LABELS = {
  en_cours:    'En cours',
  traite:      'Traité',
  en_instance: 'En instance',
  refuse:      'Refusé',
};
const URGENCE_LABELS = {
  normal: 'Normal',
  moyen: 'Moyen',
  urgent: 'Urgent',
};

function Badge({ value, type }) {
  const palette = type === 'urgence' ? URGENCE_BADGE : STATUT_BADGE;
  const labels  = type === 'urgence' ? URGENCE_LABELS : STATUT_LABELS;
  const s = palette[value] || { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      {labels[value] ?? String(value || '').replaceAll('_', ' ')}
    </span>
  );
}

export default function DemandesPage() {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [statut,   setStatut]   = useState('');
  const [urgence,  setUrgence]  = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');

  const demandesQuery = useQuery({
    queryKey: ['chef', 'demandes'],
    queryFn: () => getDemandes(),
    staleTime: 30000,
  });

  const rows = useMemo(() => {
    const raw = demandesQuery.data?.data || [];
    return [...raw]
      .filter((r) => (statut   ? r.statut  === statut  : true))
      .filter((r) => (urgence  ? r.urgence === urgence : true))
      .filter((r) => {
        const d = r.dateDemande ?? r.date_demande;
        return dateFrom ? new Date(d) >= new Date(dateFrom) : true;
      })
      .filter((r) => {
        const d = r.dateDemande ?? r.date_demande;
        return dateTo ? new Date(d) <= new Date(`${dateTo}T23:59:59`) : true;
      })
      .sort((a, b) => {
        const da = a.dateDemande ?? a.date_demande ?? 0;
        const db = b.dateDemande ?? b.date_demande ?? 0;
        return new Date(db) - new Date(da);
      });
  }, [demandesQuery.data?.data, statut, urgence, dateFrom, dateTo]);

  const _rid   = (r) => r.idDemande     ?? r.id_demande;
  const _rdate = (r) => r.dateDemande   ?? r.date_demande;
  const _rnum  = (r) => r.numero        ?? `#${_rid(r)}`;

  function progression(row) {
    const lignes = row.lignes || [];
    const total = lignes.length;
    const delivered = lignes.filter(
      (l) => Number(l.quantiteAccordee ?? l.quantite_accordee ?? 0) > 0
    ).length;
    if (total === 0) return '—';
    return `${delivered} / ${total} articles`;
  }

  return (
    <div style={{ display: 'grid', gap: 16, paddingBottom: 40 }}>
      {/* ── Action bar ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button style={btnPrimary} onClick={() => setShowModal(true)}>
          + Nouvelle demande
        </button>
      </div>

      {/* ── Info banner ── */}
      <div style={{
        background: '#f0f9ff',
        border: '1px solid #bae6fd',
        borderRadius: T.radius,
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <span style={{ fontSize: 18 }}>ℹ️</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#0369a1' }}>
          Toutes les demandes sont traitées d'après leurs disponibilités.
        </span>
      </div>

      {/* ── Table shell ── */}
      <div style={tableShell}>

        {/* Toolbar / filters */}
        <div style={toolbar}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            <select value={statut} onChange={(e) => setStatut(e.target.value)} style={selectStyle}>
              <option value="">Tous statuts</option>
              <option value="en_cours">En cours</option>
              <option value="traite">Traité</option>
              <option value="en_instance">En instance</option>
              <option value="refuse">Refusé</option>
            </select>

            <select value={urgence} onChange={(e) => setUrgence(e.target.value)} style={selectStyle}>
              <option value="">Toutes urgences</option>
              <option value="normal">Normal</option>
              <option value="moyen">Moyen</option>
              <option value="urgent">Urgent</option>
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
                  {['N°', 'Date', 'Urgence', 'Statut', 'Progression', 'Actions'].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '24px 12px', color: T.textMuted, fontSize: 13, textAlign: 'center' }}>
                      Aucune demande trouvée.
                    </td>
                  </tr>
                ) : rows.map((row) => {
                  const rid  = _rid(row);
                  const date = _rdate(row);
                  const num  = _rnum(row);
                  return (
                    <tr
                      key={rid}
                      style={{ borderTop: `1px solid ${T.border}`, cursor: 'pointer' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = T.bgSubtle; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
                      onClick={() => navigate(`/chef/demandes/${rid}`)}
                    >
                      <td style={{ ...tdStyle, fontFamily: 'monospace', color: T.textMuted, fontSize: 12 }}>
                        {num}
                      </td>
                      <td style={{ ...tdStyle, color: T.textMid }}>
                        {date ? new Date(date).toLocaleDateString('fr-FR') : '—'}
                      </td>
                      <td style={tdStyle}><Badge type="urgence" value={row.urgence} /></td>
                      <td style={tdStyle}><Badge type="statut"  value={row.statut}  /></td>
                      <td style={{ ...tdStyle, color: T.textMid }}>{progression(row)}</td>
                      <td
                        style={tdStyle}
                        onClick={(e) => { e.stopPropagation(); navigate(`/chef/demandes/${rid}`); }}
                      >
                        <span style={linkStyle}>Voir détail →</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal ? (
        <NouvelleDemandeModal onClose={() => setShowModal(false)} onCreated={() => demandesQuery.refetch()} />
      ) : null}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const tableShell  = { border: `1px solid ${T.border}`, borderRadius: T.radius, overflow: 'hidden', background: T.bgWhite };
const toolbar     = { padding: '12px 16px', background: T.bgSubtle, borderBottom: `1px solid ${T.border}` };
const thStyle     = { padding: '9px 12px', fontSize: 12, fontWeight: 700, color: T.textMuted, textAlign: 'left', borderBottom: `1px solid ${T.border}`, background: T.bgSubtle };
const tdStyle     = { padding: '10px 12px', fontSize: 13, color: T.textMid, verticalAlign: 'middle' };
const selectStyle = { border: `1px solid ${T.border}`, borderRadius: T.radiusSm, padding: '7px 10px', fontSize: 13, color: T.textDark, background: T.bgWhite, width: '100%' };
const linkStyle   = { color: T.lightGreen, fontWeight: 600, fontSize: 12, cursor: 'pointer' };
const btnPrimary  = {
  border: 'none', borderRadius: T.radiusSm, padding: '9px 16px',
  background: T.green, color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer',
};
