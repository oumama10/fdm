import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getRetours, updateDecision } from '../../api/returns';

const DECISION_ACTIONS = [
  { key: 'repare', label: 'Réparé', color: '#16a34a' },
  { key: 'non_repare', label: 'Non réparé', color: '#d97706' },
  { key: 'rebut', label: 'Rebut', color: '#dc2626' },
  { key: 'reaffecte', label: 'Réaffecter', color: '#2563eb' },
];

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
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Retours</h1>
      </div>

      <section style={sectionStyle}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <label style={labelStyle}>
            Motif
            <select style={inputStyle} value={motifFilter} onChange={(e) => setMotifFilter(e.target.value)}>
              <option value="tous">Tous</option>
              <option value="panne">Panne</option>
              <option value="inutilise">Inutilisé</option>
              <option value="endommage">Endommagé</option>
              <option value="autre">Autre</option>
            </select>
          </label>

          <label style={labelStyle}>
            Décision
            <select style={inputStyle} value={decisionFilter} onChange={(e) => setDecisionFilter(e.target.value)}>
              <option value="tous">Tous</option>
              <option value="en_attente">En attente</option>
              <option value="traite">Traité</option>
            </select>
          </label>
        </div>
      </section>

      <section style={sectionStyle}>
        {retoursQuery.isLoading ? (
          <div style={{ height: 180, borderRadius: 10, background: '#f3f4f6' }} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Ressource</th>
                  <th style={thStyle}>N° inventaire</th>
                  <th style={thStyle}>Motif</th>
                  <th style={thStyle}>Décision</th>
                  <th style={thStyle}>Retourné par</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 16, color: '#6b7280' }}>
                      Aucun retour.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id_retour} style={{ borderTop: '1px solid #f3f4f6' }}>
                      <td style={tdStyle}>
                        {row.date_retour ? new Date(row.date_retour).toLocaleDateString('fr-FR') : '—'}
                      </td>
                      <td style={tdStyle}>{row.ressource?.designation || '—'}</td>
                      <td style={tdStyle}>{row.instance_ressource?.numero_inventaire || '—'}</td>
                      <td style={tdStyle}>{row.motif_retour || '—'}</td>
                      <td style={tdStyle}>{row.decision || 'en_attente'}</td>
                      <td style={tdStyle}>{row.retourne_par?.nom_complet || '—'}</td>
                      <td style={tdStyle}>
                        {!row.decision ? (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {DECISION_ACTIONS.map((action) => (
                              <button
                                key={action.key}
                                onClick={() => openConfirm(row, action.key)}
                                style={{
                                  ...actionButton,
                                  background: action.color,
                                }}
                              >
                                {action.label}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: '#6b7280' }}>Traité</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {confirmState ? (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h3 style={{ marginTop: 0, marginBottom: 10 }}>Confirmer la décision</h3>
            <div style={{ display: 'grid', gap: 8 }}>
              <label style={labelStyle}>
                Justification (obligatoire)
                <textarea
                  style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }}
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="Saisissez une justification..."
                />
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button
                style={secondaryButton}
                onClick={() => {
                  setConfirmState(null);
                  setJustification('');
                }}
              >
                Annuler
              </button>
              <button
                style={{ ...primaryButton, opacity: justification.trim() ? 1 : 0.5 }}
                disabled={!justification.trim() || decisionMutation.isPending}
                onClick={submitDecision}
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const sectionStyle = {
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  background: '#fff',
  padding: 12,
};

const labelStyle = {
  display: 'grid',
  gap: 6,
  fontSize: 13,
  color: '#374151',
};

const inputStyle = {
  border: '1px solid #d1d5db',
  borderRadius: 8,
  padding: '6px 8px',
  fontSize: 13,
};

const thStyle = { padding: 8, fontWeight: 600 };
const tdStyle = { padding: 8 };

const actionButton = {
  border: 'none',
  borderRadius: 8,
  padding: '6px 10px',
  color: '#fff',
  cursor: 'pointer',
};

const secondaryButton = {
  border: '1px solid #d1d5db',
  borderRadius: 8,
  padding: '6px 10px',
  background: '#fff',
  color: '#111827',
  cursor: 'pointer',
};

const primaryButton = {
  border: 'none',
  borderRadius: 8,
  padding: '6px 10px',
  background: '#111827',
  color: '#fff',
  cursor: 'pointer',
};

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(17, 24, 39, 0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 40,
  padding: 16,
};

const modalStyle = {
  width: 'min(520px, 100%)',
  background: '#fff',
  borderRadius: 12,
  border: '1px solid #e5e7eb',
  padding: 16,
};
