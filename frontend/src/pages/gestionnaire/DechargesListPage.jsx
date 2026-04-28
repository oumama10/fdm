import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, Download, CheckCircle } from 'lucide-react';

import { downloadPdf, getDecharges, validerSignature } from '../../api/decharge';
import { getDemandes } from '../../api/requests';

function StatutBadge({ statut, dateSignature }) {
  const map = {
    non_generee: { bg: '#fef3c7', color: '#92400e', label: 'Non signé' },
    en_attente:  { bg: '#fef3c7', color: '#92400e', label: 'Non signé' },
    signe:       { bg: '#d1fae5', color: '#065f46', label: 'Signé' },
    valide:      { bg: '#d1fae5', color: '#065f46', label: 'Validé' },
    rejete:      { bg: '#fee2e2', color: '#991b1b', label: 'Rejeté' },
  };
  const tone = map[statut] || map.non_generee;
  const showDate = (statut === 'signe' || statut === 'valide') && dateSignature;

  return (
    <div>
      <span className="status-chip" style={{ background: tone.bg, color: tone.color, whiteSpace: 'nowrap' }}>
        {tone.label}
      </span>
      {showDate && (
        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3, paddingLeft: 2 }}>
          {new Date(dateSignature).toLocaleDateString('fr-FR')}
        </div>
      )}
    </div>
  );
}

function dechargeType(lignes) {
  if (!lignes?.length) return '—';
  const types = new Set(lignes.map((l) => l.type_ligne));
  if (types.size === 1) return types.has('bien_inventaire') ? 'Bien inventaire' : 'Consommable';
  return 'Mixte';
}

const iconBtn = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 30,
  height: 30,
  borderRadius: 6,
  border: '1px solid #e5e7eb',
  background: 'transparent',
  cursor: 'pointer',
  color: '#6b7280',
  flexShrink: 0,
};

const pillBtn = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '4px 11px',
  borderRadius: 999,
  border: 'none',
  background: '#0f6e56',
  color: '#fff',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

export default function DechargesListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filterStatut, setFilterStatut] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [markingId, setMarkingId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);

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

  const markMutation = useMutation({
    mutationFn: (id) => validerSignature(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['decharge', 'list'] });
      setMarkingId(null);
    },
    onError: () => setMarkingId(null),
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

  async function handleDownload(id, e) {
    e.stopPropagation();
    try {
      const response = await downloadPdf(id);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `decharge-${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('PDF non disponible. Veuillez régénérer le PDF depuis le détail de la décharge.');
    }
  }

  function handleMarkSigne(id, e) {
    e.stopPropagation();
    setMarkingId(id);
    markMutation.mutate(id);
  }

  return (
    <div className="page-stack">
      <h1 className="page-title">Décharges</h1>

      <div className="section-shell">
        <div className="grid-split" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
          <label className="field-label" style={{ display: 'grid', gap: 4 }}>
            Statut
            <select name="filter-statut" value={filterStatut} onChange={(e) => setFilterStatut(e.target.value)} className="field-input">
              <option value="">Tous statuts</option>
              <option value="non_generee">PDF en attente</option>
              <option value="en_attente">Non signé</option>
              <option value="signe">Signé</option>
              <option value="valide">Validé</option>
              <option value="rejete">Rejeté</option>
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
        {dechargesQuery.isLoading ? (
          <div style={{ padding: 14 }}>
            <div style={{ height: 180, borderRadius: 8, background: '#f3f4f6' }} />
          </div>
        ) : (
          <table className="data-table" style={{ fontSize: 14 }}>
            <thead>
              <tr>
                <th>Réf. décharge</th>
                <th>Réf. demande</th>
                <th>Service demandeur</th>
                <th>Date création</th>
                <th>Type</th>
                <th>Statut signature</th>
                <th style={{ width: 110 }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-state">Aucune décharge.</td>
                </tr>
              ) : (
                rows.map((row) => {
                  const isHovered = hoveredId === row.id_decharge;
                  const isMarking = markingId === row.id_decharge;
                  const canMark = row.statut_signature === 'en_attente';

                  return (
                    <tr
                      key={row.id_decharge}
                      style={{
                        cursor: 'pointer',
                        background: isHovered ? '#edf7f3' : 'transparent',
                        transition: 'background 0.15s',
                      }}
                      onClick={() => navigate(`/gestionnaire/decharges/${row.id_decharge}`)}
                      onMouseEnter={() => setHoveredId(row.id_decharge)}
                      onMouseLeave={() => setHoveredId(null)}
                    >
                      <td style={{ fontWeight: 600 }}>{row.numero_decharge}</td>
                      <td style={{ color: '#6b7280' }}>#{row.id_demande}</td>
                      <td>{serviceByDemande.get(Number(row.id_demande)) || '—'}</td>
                      <td>{row.date_generation ? new Date(row.date_generation).toLocaleDateString('fr-FR') : '—'}</td>
                      <td>{dechargeType(row.lignes)}</td>
                      <td>
                        <StatutBadge statut={row.statut_signature} dateSignature={row.date_signature} />
                      </td>
                      <td>
                        <div
                          style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            title="Voir détails"
                            style={iconBtn}
                            onClick={(e) => { e.stopPropagation(); navigate(`/gestionnaire/decharges/${row.id_decharge}`); }}
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            title="Télécharger PDF"
                            style={iconBtn}
                            onClick={(e) => handleDownload(row.id_decharge, e)}
                          >
                            <Download size={14} />
                          </button>

                          {isHovered && canMark && (
                            <button
                              style={{ ...pillBtn, opacity: isMarking ? 0.7 : 1, cursor: isMarking ? 'wait' : 'pointer' }}
                              onClick={(e) => handleMarkSigne(row.id_decharge, e)}
                              disabled={isMarking}
                            >
                              <CheckCircle size={13} />
                              {isMarking ? '…' : 'Marquer signé'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
