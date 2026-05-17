import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getRetours, updateDecision } from '../../api/returns';

// ── Design tokens ──────────────────────────────────────────────────────────
const T = {
  blue: '#0C447C', lightBlue: '#1a7abf', green: '#16a34a',
  amber: '#f59e0b', red: '#dc2626',
  textDark: '#0f172a', textMid: '#374151', textMuted: '#64748b',
  border: '#e2e8f0', bgWhite: '#ffffff', bgSubtle: '#f8fafc',
  radius: 12, radiusSm: 8,
};

const DECISION_ACTIONS = [
  { key: 'repare',      label: 'Réparé',     bg: '#16a34a' },
  { key: 'non_repare',  label: 'Non réparé', bg: '#d97706' },
  { key: 'rebut',       label: 'Rebut',      bg: '#dc2626' },
  { key: 'reaffecte',   label: 'Réaffecter', bg: '#0C447C' },
];

const MOTIF_BADGE = {
  panne:      { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
  inutilise:  { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
  endommage:  { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  autre:      { bg: '#ede9fe', color: '#5b21b6', border: '#c4b5fd' },
};
const DECISION_BADGE = {
  repare:     { bg: '#bbf7d0', color: '#14532d', border: '#86efac', label: 'Réparé' },
  non_repare: { bg: '#fef3c7', color: '#92400e', border: '#fcd34d', label: 'Non réparé' },
  rebut:      { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5', label: 'Rebut' },
  reaffecte:  { bg: '#dbeafe', color: '#1e3a8a', border: '#93c5fd', label: 'Réaffecté' },
};

function MotifBadge({ value }) {
  const s = MOTIF_BADGE[value] || { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' };
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

function DecisionBadge({ value }) {
  const s = DECISION_BADGE[value];
  if (!s) return <span style={{ color: T.textMuted, fontSize: 12 }}>—</span>;
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
  const queryClient = useQueryClient();
  const [motifFilter, setMotifFilter] = useState('tous');
  const [decisionFilter, setDecisionFilter] = useState('en_attente');
  const [confirmState, setConfirmState] = useState(null);
  const [justification, setJustification] = useState('');

  const retoursQuery = useQuery({
    queryKey: ['gestionnaire', 'retours'],
    queryFn: () => getRetours(),
    staleTime: 0,
  });

  const decisionMutation = useMutation({
    mutationFn: ({ id, data }) => updateDecision(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gestionnaire', 'retours'] });
      setConfirmState(null);
      setJustification('');
    },
  });

  const rows = useMemo(() => {
    const data = retoursQuery.data?.data || [];
    const filtered = data.filter((row) => {
      const matchesMotif = motifFilter === 'tous' || row.motif_retour === motifFilter;
      const matchesDecision =
        decisionFilter === 'tous' ||
        (decisionFilter === 'en_attente' ? !row.decision : Boolean(row.decision));
      return matchesMotif && matchesDecision;
    });
    return [...filtered].sort((a, b) => {
      const aPending = !a.decision;
      const bPending = !b.decision;
      if (aPending !== bPending) return aPending ? -1 : 1;
      return new Date(b.date_retour || 0) - new Date(a.date_retour || 0);
    });
  }, [retoursQuery.data?.data, motifFilter, decisionFilter]);

  function openConfirm(row, decision) {
    setConfirmState({ id: row.id_retour, decision });
    setJustification('');
  }

  async function submitDecision() {
    if (!confirmState || !justification.trim()) return;
    await decisionMutation.mutateAsync({
      id: confirmState.id,
      data: {
        decision: confirmState.decision,
        justification_decision: justification.trim(),
      },
    });
  }

  return (
    <div style={{ display: 'grid', gap: 16, paddingBottom: 40 }}>
      {/* ── Table shell ── */}
      <div style={tableShell}>

        {/* Toolbar / filters */}
        <div style={toolbar}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Motif</span>
              <select style={selectStyle} value={motifFilter} onChange={(e) => setMotifFilter(e.target.value)}>
                <option value="tous">Tous</option>
                <option value="panne">Panne</option>
                <option value="inutilise">Inutilisé</option>
                <option value="endommage">Endommagé</option>
                <option value="autre">Autre</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Décision</span>
              <select style={selectStyle} value={decisionFilter} onChange={(e) => setDecisionFilter(e.target.value)}>
                <option value="tous">Tous</option>
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
                  {['Date', 'Ressource', 'N° inventaire', 'Motif', 'Décision', 'Retourné par', 'Actions'].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '16px 12px', color: T.textMuted, fontSize: 13 }}>
                      Aucun retour.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id_retour} style={{ borderTop: `1px solid ${T.border}` }}>
                      <td style={{ ...tdStyle, color: T.textMid }}>
                        {row.date_retour ? new Date(row.date_retour).toLocaleDateString('fr-FR') : '—'}
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 600, color: T.textDark }}>
                        {row.ressource?.designation || '—'}
                      </td>
                      <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12, color: T.textMuted }}>
                        {row.instance_ressource?.numero_inventaire || '—'}
                      </td>
                      <td style={tdStyle}><MotifBadge value={row.motif_retour} /></td>
                      <td style={tdStyle}>
                        {row.decision
                          ? <DecisionBadge value={row.decision} />
                          : <span style={{ fontSize: 12, color: T.textMuted, fontStyle: 'italic' }}>En attente</span>
                        }
                      </td>
                      <td style={{ ...tdStyle, color: T.textMid }}>
                        {row.retourne_par?.nom_complet || '—'}
                      </td>
                      <td style={tdStyle}>
                        {!row.decision ? (
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                            {DECISION_ACTIONS.map((action) => (
                              <button
                                key={action.key}
                                onClick={() => openConfirm(row, action.key)}
                                style={{ ...actionBtn, background: action.bg }}
                              >
                                {action.label}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: T.textMuted }}>Traité</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Confirm modal ── */}
      {confirmState && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: T.textDark }}>
              Confirmer la décision
            </h3>
            <div style={{ height: 2, background: T.lightBlue, borderRadius: 2, margin: '0 -20px 16px' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Justification (obligatoire)
              </span>
              <textarea
                style={{
                  border: `1px solid ${T.border}`, borderRadius: T.radiusSm,
                  padding: '8px 10px', fontSize: 13, color: T.textDark,
                  minHeight: 90, resize: 'vertical', outline: 'none',
                }}
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Saisissez une justification..."
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button
                style={btnOutline}
                onClick={() => { setConfirmState(null); setJustification(''); }}
              >
                Annuler
              </button>
              <button
                style={{ ...btnConfirm, opacity: justification.trim() ? 1 : 0.5 }}
                disabled={!justification.trim() || decisionMutation.isPending}
                onClick={submitDecision}
              >
                {decisionMutation.isPending ? 'Enregistrement…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const tableShell  = { border: `1px solid ${T.border}`, borderRadius: T.radius, overflow: 'hidden', background: T.bgWhite };
const toolbar     = { padding: '12px 16px', background: T.bgSubtle, borderBottom: `1px solid ${T.border}` };
const thStyle     = { padding: '9px 12px', fontSize: 12, fontWeight: 700, color: T.textMuted, textAlign: 'left', borderBottom: `1px solid ${T.border}`, background: T.bgSubtle };
const tdStyle     = { padding: '10px 12px', fontSize: 13, color: T.textMid, verticalAlign: 'middle' };
const selectStyle = { border: `1px solid ${T.border}`, borderRadius: T.radiusSm, padding: '7px 10px', fontSize: 13, color: T.textDark, background: T.bgWhite };
const actionBtn   = { border: 'none', borderRadius: 6, padding: '4px 10px', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 };
const btnBase     = { border: 'none', borderRadius: T.radiusSm, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const btnOutline  = { ...btnBase, border: `1px solid ${T.border}`, background: T.bgWhite, color: T.textMid };
const btnConfirm  = { ...btnBase, background: T.blue, color: '#fff' };
const overlayStyle = {
  position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40, padding: 16,
};
const modalStyle = {
  width: 'min(520px, 100%)', background: T.bgWhite,
  borderRadius: T.radius, border: `1px solid ${T.border}`,
  padding: '20px', boxShadow: '0 8px 32px rgba(12,68,124,0.12)',
};
