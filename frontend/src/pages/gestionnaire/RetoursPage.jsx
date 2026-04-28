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
    <div className="page-stack">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="page-title">Retours</h1>
      </div>

      <section className="section-shell">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <label className="field-label">
            Motif
            <select className="field-input" value={motifFilter} onChange={(e) => setMotifFilter(e.target.value)}>
              <option value="tous">Tous</option>
              <option value="panne">Panne</option>
              <option value="inutilise">Inutilisé</option>
              <option value="endommage">Endommagé</option>
              <option value="autre">Autre</option>
            </select>
          </label>

          <label className="field-label">
            Décision
            <select className="field-input" value={decisionFilter} onChange={(e) => setDecisionFilter(e.target.value)}>
              <option value="tous">Tous</option>
              <option value="en_attente">En attente</option>
              <option value="traite">Traité</option>
            </select>
          </label>
        </div>
      </section>

      <section className="section-shell">
        {retoursQuery.isLoading ? (
          <div style={{ height: 180, borderRadius: 10, background: '#f3f4f6' }} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Ressource</th>
                  <th>N° inventaire</th>
                  <th>Motif</th>
                  <th>Décision</th>
                  <th>Retourné par</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty-state">
                      Aucun retour.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id_retour}>
                      <td>
                        {row.date_retour ? new Date(row.date_retour).toLocaleDateString('fr-FR') : '—'}
                      </td>
                      <td>{row.ressource?.designation || '—'}</td>
                      <td>{row.instance_ressource?.numero_inventaire || '—'}</td>
                      <td>{row.motif_retour || '—'}</td>
                      <td>{row.decision || 'en_attente'}</td>
                      <td>{row.retourne_par?.nom_complet || '—'}</td>
                      <td>
                        {!row.decision ? (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {DECISION_ACTIONS.map((action) => (
                              <button
                                key={action.key}
                                onClick={() => openConfirm(row, action.key)}
                                className="btn"
                                style={{ background: action.color, color: '#fff' }}
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
          <div className="section-shell" style={modalStyle}>
            <h3 style={{ marginTop: 0, marginBottom: 10 }}>Confirmer la décision</h3>
            <div style={{ display: 'grid', gap: 8 }}>
              <label className="field-label">
                Justification (obligatoire)
                <textarea
                  className="field-input"
                  style={{ minHeight: 90, resize: 'vertical' }}
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="Saisissez une justification..."
                />
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setConfirmState(null);
                  setJustification('');
                }}
              >
                Annuler
              </button>
              <button
                className="btn btn-primary"
                style={{ opacity: justification.trim() ? 1 : 0.5 }}
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
  padding: 16,
};
