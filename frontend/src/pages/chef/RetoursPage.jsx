import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { getRetours } from '../../api/returns';
import RetourCreateModal from './RetourCreateModal';

// ── Design tokens ──────────────────────────────────────────────────────────
const T = {
  green: '#0F6E56', lightGreen: '#1D9E75',
  textDark: '#0f172a', textMid: '#374151', textMuted: '#64748b',
  border: '#e2e8f0', bgWhite: '#ffffff', bgSubtle: '#f8fafc',
  radius: 12, radiusSm: 8,
};

const MOTIF_BADGE = {
  panne:      { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5', label: 'Panne' },
  inutilise:  { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1', label: 'Inutilisée' },
  endommage:  { bg: '#fef3c7', color: '#92400e', border: '#fcd34d', label: 'Endommagé' },
  autre:      { bg: '#ede9fe', color: '#5b21b6', border: '#c4b5fd', label: 'Autre' },
};

const DECISION_BADGE = {
  repare:    { bg: '#bbf7d0', color: '#14532d', border: '#86efac', label: 'Réparé' },
  debarras:  { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5', label: 'Débarras' },
  reaffecte: { bg: '#dbeafe', color: '#1e3a8a', border: '#93c5fd', label: 'Réaffecté' },
};

function MotifBadge({ value }) {
  const s = MOTIF_BADGE[value] || { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1', label: value };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      {s.label}
    </span>
  );
}

function EtatBadge({ decision }) {
  if (!decision) {
    return (
      <span style={{ fontSize: 12, color: T.textMuted, fontStyle: 'italic' }}>En attente</span>
    );
  }
  const s = DECISION_BADGE[decision] || { bg: '#bbf7d0', color: '#14532d', border: '#86efac', label: decision };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      {s.label}
    </span>
  );
}

export default function RetoursPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [motifFilter, setMotifFilter] = useState('');
  const [etatFilter,  setEtatFilter]  = useState('');

  const retoursQuery = useQuery({
    queryKey: ['chef', 'retours'],
    queryFn: getRetours,
    staleTime: 30000,
  });

  // Helper: access camelCase or snake_case keys
  const _v = (row, camel, snake) => row[camel] ?? row[snake];

  const rows = useMemo(() => {
    const data = retoursQuery.data?.data?.results ?? retoursQuery.data?.data ?? [];
    return [...data]
      .filter((r) => (motifFilter ? (_v(r,'motifRetour','motif_retour')) === motifFilter : true))
      .filter((r) => {
        if (!etatFilter) return true;
        if (etatFilter === 'en_attente') return !r.decision;
        if (etatFilter === 'traite')     return Boolean(r.decision);
        return true;
      })
      .sort((a, b) => new Date(_v(b,'dateRetour','date_retour') || 0) - new Date(_v(a,'dateRetour','date_retour') || 0));
  }, [retoursQuery.data, motifFilter, etatFilter]);

  return (
    <div style={{ display: 'grid', gap: 16, paddingBottom: 40 }}>
      {/* ── Action bar ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button style={btnPrimary} onClick={() => setShowCreateModal(true)}>
          + Soumettre un retour
        </button>
      </div>

      {/* ── Table shell ── */}
      <div style={tableShell}>

        {/* Toolbar / filters */}
        <div style={toolbar}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={filterLabel}>Motif</span>
              <select value={motifFilter} onChange={(e) => setMotifFilter(e.target.value)} style={selectStyle}>
                <option value="">Tous</option>
                <option value="panne">Panne</option>
                <option value="inutilise">Inutilisée</option>
                <option value="endommage">Endommagé</option>
                <option value="autre">Autre</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={filterLabel}>État</span>
              <select value={etatFilter} onChange={(e) => setEtatFilter(e.target.value)} style={selectStyle}>
                <option value="">Tous</option>
                <option value="en_attente">En attente</option>
                <option value="traite">Traité</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        {retoursQuery.isLoading ? (
          <div style={{ padding: 20 }}>
            <div style={{ height: 180, borderRadius: T.radiusSm, background: T.bgSubtle }} />
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Date', 'Ressource', 'N° inventaire', 'Motif', 'État', 'Décision — Justification', 'Observation'].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '24px 12px', color: T.textMuted, fontSize: 13, textAlign: 'center' }}>
                      Aucun retour trouvé.
                    </td>
                  </tr>
                ) : rows.map((row) => {
                  const dateRetour = _v(row,'dateRetour','date_retour');
                  const motif = _v(row,'motifRetour','motif_retour');
                  const inst = row.instanceRessource ?? row.instance_ressource;
                  const numInv = inst?.numeroInventaire ?? inst?.numero_inventaire;
                  return (
                  <tr
                    key={row.idRetour ?? row.id_retour}
                    style={{ borderTop: `1px solid ${T.border}` }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = T.bgSubtle; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
                  >
                    <td style={{ ...tdStyle, color: T.textMid }}>
                      {dateRetour ? new Date(dateRetour).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 600, color: T.textDark }}>
                      {row.ressource?.designation || '—'}
                    </td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12, color: T.textMuted }}>
                      {numInv || '—'}
                    </td>
                    <td style={tdStyle}><MotifBadge value={motif} /></td>
                    <td style={tdStyle}><EtatBadge decision={row.decision} /></td>
                    <td style={{ ...tdStyle, color: T.textMid, maxWidth: 240 }}>
                      {row.decision && (row.justificationDecision ?? row.justification_decision)
                        ? <span style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontStyle: 'italic', color: T.textMid }}>
                            {row.justificationDecision ?? row.justification_decision}
                          </span>
                        : <span style={{ color: T.textMuted }}>—</span>
                      }
                    </td>
                    <td style={{ ...tdStyle, color: T.textMid, maxWidth: 220 }}>
                      {row.observation
                        ? <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{row.observation}</span>
                        : <span style={{ color: T.textMuted }}>—</span>
                      }
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreateModal ? (
        <RetourCreateModal onClose={() => setShowCreateModal(false)} onCreated={() => retoursQuery.refetch()} />
      ) : null}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const tableShell  = { border: `1px solid ${T.border}`, borderRadius: T.radius, overflow: 'hidden', background: T.bgWhite };
const toolbar     = { padding: '12px 16px', background: T.bgSubtle, borderBottom: `1px solid ${T.border}` };
const thStyle     = { padding: '9px 12px', fontSize: 12, fontWeight: 700, color: T.textMuted, textAlign: 'left', borderBottom: `1px solid ${T.border}`, background: T.bgSubtle };
const tdStyle     = { padding: '10px 12px', fontSize: 13, color: T.textMid, verticalAlign: 'middle' };
const selectStyle = { border: `1px solid ${T.border}`, borderRadius: T.radiusSm, padding: '7px 10px', fontSize: 13, color: T.textDark, background: T.bgWhite };
const filterLabel = { fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' };
const btnPrimary  = {
  border: 'none', borderRadius: T.radiusSm, padding: '9px 16px',
  background: T.green, color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer',
};
