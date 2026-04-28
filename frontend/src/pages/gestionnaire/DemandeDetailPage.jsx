import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Edit2, Check, BarChart, X } from 'lucide-react';

import {
  imprimerDemande,
  getDemandeById,
  refuserDemande,
  validerDemande,
} from '../../api/requests';
import { getInstancesEnStock, getStock } from '../../api/resources';

// ── Styles ────────────────────────────────────────────────────────────────────

const labelStyle = { fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 6, display: 'block' };
const inputStyle = { border: '1px solid #d1d5db', borderRadius: 6, padding: '10px 12px', fontSize: 15, width: '100%', background: '#f9fafb', outline: 'none', minHeight: 42, color: '#111827' };
const textareaStyle = { ...inputStyle, resize: 'none' };

const cardStyle = {
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  padding: '16px',
  background: '#fff',
};

const urgencyColors = {
  normal: { bg: '#e5e7eb', color: '#111827' },
  moyen: { bg: '#fcd34d', color: '#78350f' },
  urgent: { bg: '#fee2e2', color: '#dc2626' },
  extrême: { bg: '#fef2f2', color: '#ef4444' },
};

const thSmall = { padding: '7px 10px', fontWeight: 600, color: '#475569', textAlign: 'left', fontSize: 12, whiteSpace: 'nowrap' };
const tdSmall = { padding: '7px 10px', color: '#374151', fontSize: 13 };

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d)) return String(val);
  return d.toLocaleDateString('fr-FR');
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DemandeDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [selectedStatut, setSelectedStatut] = useState('');
  const [motifRefus, setMotifRefus] = useState('');

  // Per-ligne allocation state: { [id_ligne]: { quantite_accordee, selected_instances: number[] } }
  const [ligneStates, setLigneStates] = useState({});

  // ── Queries ─────────────────────────────────────────────────────────────────

  const demandeQuery = useQuery({
    queryKey: ['demandes', 'detail', id],
    queryFn: () => getDemandeById(id),
    staleTime: 30000,
  });

  const stockQuery = useQuery({
    queryKey: ['resources', 'stocks'],
    queryFn: getStock,
    staleTime: 30000,
  });

  const instancesQuery = useQuery({
    queryKey: ['resources', 'instances', 'en_stock'],
    queryFn: getInstancesEnStock,
    staleTime: 30000,
  });

  // ── Mutations ────────────────────────────────────────────────────────────────

  const validateMutation = useMutation({
    mutationFn: ({ demandeId, lignes }) => validerDemande(demandeId, { lignes }),
    onSuccess: () => {
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['demandes', 'detail', id] });
      queryClient.invalidateQueries({ queryKey: ['demandes', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['resources', 'instances', 'en_stock'] });
      queryClient.invalidateQueries({ queryKey: ['resources', 'stocks'] });
    },
  });

  const refuseMutation = useMutation({
    mutationFn: ({ demandeId, commentaire }) => refuserDemande(demandeId, commentaire),
    onSuccess: () => {
      setIsEditing(false);
      setMotifRefus('');
      queryClient.invalidateQueries({ queryKey: ['demandes', 'detail', id] });
      queryClient.invalidateQueries({ queryKey: ['demandes', 'list'] });
    },
  });

  // ── Derived data ─────────────────────────────────────────────────────────────

  const demande = demandeQuery.data?.data;

  const stockMap = useMemo(() => {
    const map = new Map();
    (stockQuery.data?.data || []).forEach((row) => {
      map.set(Number(row.id_ressource), Number(row.quantite_disponible || 0));
    });
    return map;
  }, [stockQuery.data?.data]);

  const instancesByRessource = useMemo(() => {
    const map = new Map();
    (instancesQuery.data?.data || []).forEach((inst) => {
      const key = Number(inst.id_ressource);
      const list = map.get(key) || [];
      list.push(inst);
      map.set(key, list);
    });
    map.forEach((list) => {
      list.sort((a, b) => {
        const da = new Date(a.date_acquisition_display || a.date_acquisition || 0);
        const db = new Date(b.date_acquisition_display || b.date_acquisition || 0);
        return da - db;
      });
    });
    return map;
  }, [instancesQuery.data?.data]);

  // ── Effects ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (demande && !selectedStatut) setSelectedStatut(demande.statut);
  }, [demande, selectedStatut]);

  useEffect(() => {
    if (!demande || Object.keys(ligneStates).length > 0) return;
    const init = {};
    (demande.lignes || []).forEach((ligne) => {
      const isConsommable = ligne.ressource?.categorie_nom === 'Consommable';
      if (isConsommable) {
        const stockDispo = stockMap.get(Number(ligne.id_ressource)) || 0;
        init[ligne.id_ligne] = {
          quantite_accordee: Math.min(stockDispo, ligne.quantite_demandee),
          selected_instances: [],
        };
      } else {
        init[ligne.id_ligne] = { quantite_accordee: 0, selected_instances: [] };
      }
    });
    if (Object.keys(init).length > 0) setLigneStates(init);
  }, [demande, stockMap]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function updateLigneQty(id_ligne, qty) {
    setLigneStates((prev) => ({
      ...prev,
      [id_ligne]: { ...prev[id_ligne], quantite_accordee: qty },
    }));
  }

  function toggleInstance(id_ligne, id_instance, max) {
    setLigneStates((prev) => {
      const cur = prev[id_ligne] || { quantite_accordee: 0, selected_instances: [] };
      const sel = cur.selected_instances;
      let updated;
      if (sel.includes(id_instance)) {
        updated = sel.filter((i) => i !== id_instance);
      } else {
        if (sel.length >= max) return prev;
        updated = [...sel, id_instance];
      }
      return { ...prev, [id_ligne]: { quantite_accordee: updated.length, selected_instances: updated } };
    });
  }

  async function handleImprimer() {
    const response = await imprimerDemande(demande.id_demande);
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `decharge-${demande.id_demande}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleToggleEdit() {
    if (isEditing) {
      setIsEditing(false);
      setSelectedStatut(demande.statut);
      setMotifRefus('');
    } else {
      setIsEditing(true);
    }
  }

  function handleEnregistrer() {
    if (!isEditing || selectedStatut === demande.statut) return;
    if (selectedStatut === 'en_cours') return;

    if (selectedStatut === 'refusee') {
      refuseMutation.mutate({ demandeId: demande.id_demande, commentaire: motifRefus });
      return;
    }

    const lignes = (demande.lignes || []).map((ligne) => {
      const state = ligneStates[ligne.id_ligne] || { quantite_accordee: 0, selected_instances: [] };
      return {
        id_ligne: ligne.id_ligne,
        quantite_accordee: state.quantite_accordee,
        instances: state.selected_instances,
      };
    });

    validateMutation.mutate({ demandeId: demande.id_demande, lignes });
  }

  // ── Render guards ─────────────────────────────────────────────────────────────

  if (demandeQuery.isLoading) {
    return <div style={{ height: 240, background: '#f3f4f6', borderRadius: 12 }} />;
  }
  if (!demande) {
    return <div style={{ color: '#b91c1c' }}>Demande introuvable.</div>;
  }

  const canEdit = demande.statut === 'en_cours';
  const selectEnabled = isEditing && canEdit;
  const isPending = validateMutation.isPending || refuseMutation.isPending;
  const canSave = isEditing && selectedStatut !== demande.statut && selectedStatut !== 'en_cours'
    && !(selectedStatut === 'refusee' && !motifRefus.trim());

  const categoriesList = [...new Set(
    (demande.lignes || []).map((l) => {
      const r = l.ressource;
      return r?.sous_categorie_parent_nom || r?.sous_categorie_nom || '';
    }).filter(Boolean)
  )].join(', ') || '—';

  const sousCategoriesList = [...new Set(
    (demande.lignes || []).map((l) => {
      const r = l.ressource;
      return r?.sous_categorie_parent_nom ? (r?.sous_categorie_nom || '') : '';
    }).filter(Boolean)
  )].join(', ') || '—';

  const tone = urgencyColors[demande.urgence?.toLowerCase()] || urgencyColors.normal;

  return (
    <div className="page-stack" style={{ paddingBottom: 60 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #60a5fa', paddingBottom: 16, marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: 10 }}>
          <BarChart /> Détails de la Demande
        </h1>
        <div style={{ background: '#e0f2fe', color: '#0284c7', padding: '8px 16px', borderRadius: 6, fontSize: 14, fontWeight: 600 }}>
          # Référence: DEM-{new Date(demande.date_demande).getFullYear()}-{String(demande.id_demande).padStart(4, '0')}
        </div>
      </div>

      {/* ── Metadata Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 24 }}>
        <div>
          <label style={labelStyle}>Demandeur</label>
          <div style={inputStyle}>{demande.chef_demandeur?.nom_complet || 'Fonctionnaire'}</div>
        </div>
        <div>
          <label style={labelStyle}>Date de demande</label>
          <div style={inputStyle}>{demande.date_demande ? new Date(demande.date_demande).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</div>
        </div>
        <div>
          <label style={labelStyle}>Catégorie</label>
          <div style={inputStyle}>{categoriesList}</div>
        </div>
        <div>
          <label style={labelStyle}>Sous-Catégorie</label>
          <div style={inputStyle}>{sousCategoriesList}</div>
        </div>
      </div>

      {/* ── Articles ── */}
      <div style={{ marginTop: 32 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#374151', marginBottom: 12 }}>Articles demandés</h3>
        <div style={{ display: 'grid', gap: 16 }}>
          {(demande.lignes || []).map((ligne) => {
            const isConsommable = ligne.ressource?.categorie_nom === 'Consommable';
            const serverPct = Math.max(0, Math.min(100, Number(ligne.disponibilite_pct || 0)));
            const barColor = serverPct >= 50 ? '#10b981' : serverPct >= 20 ? '#f59e0b' : '#ef4444';
            const state = ligneStates[ligne.id_ligne] || { quantite_accordee: 0, selected_instances: [] };
            const stockDispo = stockMap.get(Number(ligne.id_ressource)) || 0;
            const instances = instancesByRessource.get(Number(ligne.id_ressource)) || [];

            return (
              <div key={ligne.id_ligne} style={cardStyle}>

                {/* Article header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: '#111827', fontSize: 15 }}>
                      {ligne.ressource?.designation || '—'}
                      {ligne.ressource?.description ? ` — ${ligne.ressource.description}` : ''}
                    </div>
                    <div style={{ fontSize: 13, color: '#4b5563', marginTop: 2 }}>
                      Qté demandée: <strong>{ligne.quantite_demandee}</strong>
                      {!selectEnabled && ligne.quantite_accordee > 0 && (
                        <span style={{ marginLeft: 12 }}>
                          Qté accordée: <strong style={{ color: '#059669' }}>{ligne.quantite_accordee}</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', minWidth: 120, flexShrink: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Disponibilité</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                      <span style={{ fontSize: 13, color: '#4b5563', fontWeight: 600 }}>{serverPct}%</span>
                      <div style={{ width: 64, height: 12, background: '#f3f4f6', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ width: `${serverPct}%`, height: '100%', background: barColor, borderRadius: 999 }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Allocation block (only in edit mode) ── */}
                {selectEnabled && (
                  isConsommable ? (
                    <div style={{ marginTop: 14, padding: '12px 14px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 10 }}>
                        Stock disponible: <strong style={{ color: stockDispo > 0 ? '#059669' : '#dc2626' }}>{stockDispo}</strong> unité(s)
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>
                          Quantité accordée:
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={Math.min(stockDispo, ligne.quantite_demandee)}
                          value={state.quantite_accordee}
                          onChange={(e) => {
                            const max = Math.min(stockDispo, ligne.quantite_demandee);
                            const val = Math.max(0, Math.min(parseInt(e.target.value) || 0, max));
                            updateLigneQty(ligne.id_ligne, val);
                          }}
                          style={{ width: 80, padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, textAlign: 'center' }}
                        />
                        <span style={{ fontSize: 13, color: '#64748b' }}>/ {ligne.quantite_demandee} demandée(s)</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ marginTop: 14 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                        Instances disponibles en stock —{' '}
                        <span style={{ color: state.selected_instances.length >= ligne.quantite_demandee ? '#059669' : '#2563eb' }}>
                          {state.selected_instances.length} / {ligne.quantite_demandee} sélectionnée(s)
                        </span>
                      </div>

                      {instancesQuery.isLoading ? (
                        <div style={{ fontSize: 13, color: '#9ca3af' }}>Chargement des instances…</div>
                      ) : instances.length === 0 ? (
                        <div style={{ fontSize: 13, color: '#ef4444', padding: '8px 0' }}>Aucune instance disponible en stock pour cet article.</div>
                      ) : (
                        <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 6 }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                              <tr style={{ background: '#f1f5f9' }}>
                                <th style={{ ...thSmall, width: 36 }}></th>
                                <th style={thSmall}>N° Inventaire</th>
                                <th style={thSmall}>Désignation</th>
                                <th style={thSmall}>Date acquisition</th>
                                <th style={thSmall}>État</th>
                              </tr>
                            </thead>
                            <tbody>
                              {instances.map((inst) => {
                                const isSelected = state.selected_instances.includes(inst.id_instance);
                                const isDisabled = !isSelected && state.selected_instances.length >= ligne.quantite_demandee;
                                return (
                                  <tr
                                    key={inst.id_instance}
                                    style={{ borderTop: '1px solid #f1f5f9', background: isSelected ? '#eff6ff' : '#fff', cursor: isDisabled ? 'not-allowed' : 'pointer' }}
                                    onClick={() => !isDisabled && toggleInstance(ligne.id_ligne, inst.id_instance, ligne.quantite_demandee)}
                                  >
                                    <td style={{ ...tdSmall, width: 36 }}>
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        disabled={isDisabled}
                                        onChange={() => {}}
                                        style={{ cursor: isDisabled ? 'not-allowed' : 'pointer', width: 15, height: 15 }}
                                      />
                                    </td>
                                    <td style={{ ...tdSmall, fontFamily: '"JetBrains Mono", Consolas, "Courier New", monospace', fontWeight: 600, letterSpacing: '0.03em' }}>
                                      {inst.numero_inventaire}
                                    </td>
                                    <td style={tdSmall}>{inst.ressource?.designation || ligne.ressource?.designation || '—'}</td>
                                    <td style={tdSmall}>{formatDate(inst.date_acquisition_display || inst.date_acquisition)}</td>
                                    <td style={tdSmall}>
                                      <span style={{
                                        padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                                        background: inst.etat === 'neuf' ? '#dcfce7' : inst.etat === 'bon_etat' ? '#dbeafe' : '#fef9c3',
                                        color: inst.etat === 'neuf' ? '#166534' : inst.etat === 'bon_etat' ? '#1e40af' : '#713f12',
                                      }}>
                                        {inst.etat?.replace('_', ' ') || '—'}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Justification & Urgence ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 24, marginTop: 32 }}>
        <div>
          <label style={labelStyle}>Justification / Commentaires</label>
          <textarea style={{ ...textareaStyle, minHeight: 80, fontSize: 14 }} value={demande.justification || '—'} readOnly />
        </div>
        <div>
          <label style={labelStyle}>Urgence</label>
          <div style={{ ...inputStyle, display: 'flex', alignItems: 'center' }}>
            <span style={{ background: tone.bg, color: tone.color, padding: '4px 12px', borderRadius: 4, fontWeight: 600, fontSize: 14 }}>
              {demande.urgence?.charAt(0).toUpperCase() + demande.urgence?.slice(1)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Statut & Motif ── */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '20px 24px', marginTop: 32, background: '#f8fafc' }}>
        <label style={labelStyle}>Statut de la demande</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <select
            style={{ ...inputStyle, maxWidth: 300, background: selectEnabled ? '#fff' : '#f9fafb' }}
            value={selectedStatut}
            onChange={(e) => setSelectedStatut(e.target.value)}
            disabled={!selectEnabled}
          >
            <option value="en_cours">en cours</option>
            <option value="partielle">partielle</option>
            <option value="totale">totale</option>
            <option value="refusee">refusée</option>
          </select>
          <span style={{ color: '#0284c7', fontSize: 14, fontWeight: 600 }}>
            {selectedStatut === 'en_cours' ? 'En cours de traitement'
              : selectedStatut === 'refusee' ? 'Traitement refusé'
              : 'Traitement validé'}
          </span>
        </div>

        {/* Motif de refus — shown inline when refusee is selected in edit mode */}
        {isEditing && selectedStatut === 'refusee' && (
          <div style={{ marginTop: 16 }}>
            <label style={{ ...labelStyle, color: '#b91c1c' }}>
              Motif du refus <span style={{ fontWeight: 400 }}>(obligatoire)</span>
            </label>
            <textarea
              value={motifRefus}
              onChange={(e) => setMotifRefus(e.target.value)}
              rows={3}
              placeholder="Saisissez le motif du refus…"
              style={{ ...textareaStyle, border: '1px solid #fca5a5', background: '#fff5f5', fontSize: 14, minHeight: 80 }}
            />
            {!motifRefus.trim() && (
              <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>Ce champ est obligatoire pour refuser la demande.</div>
            )}
          </div>
        )}

        {/* Display existing refusal reason (read mode) */}
        {!isEditing && demande.statut === 'refusee' && demande.commentaire_validation && (
          <div style={{ marginTop: 14, padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#991b1b', marginBottom: 4 }}>Motif du refus</div>
            <div style={{ fontSize: 14, color: '#b91c1c' }}>{demande.commentaire_validation}</div>
          </div>
        )}
      </div>

      {/* ── Buttons ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
        <button
          onClick={handleImprimer}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontWeight: 600, cursor: 'pointer' }}
        >
          <Download size={16} /> Imprimer
        </button>

        {/* Modifier / Annuler toggle */}
        <button
          onClick={handleToggleEdit}
          disabled={!canEdit}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 16px', borderRadius: 6,
            border: isEditing ? '1px solid #ef4444' : '1px solid #3b82f6',
            background: '#fff',
            color: isEditing ? '#ef4444' : '#3b82f6',
            fontWeight: 600,
            cursor: canEdit ? 'pointer' : 'not-allowed',
            opacity: canEdit ? 1 : 0.5,
          }}
        >
          {isEditing ? <><X size={16} /> Annuler</> : <><Edit2 size={16} /> Modifier</>}
        </button>

        {/* Enregistrer — only visible in edit mode */}
        {isEditing && (
          <button
            onClick={handleEnregistrer}
            disabled={!canSave || isPending}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 20px', borderRadius: 6, border: 'none',
              background: '#2563eb', color: '#fff', fontWeight: 600,
              cursor: (!canSave || isPending) ? 'not-allowed' : 'pointer',
              opacity: (!canSave || isPending) ? 0.6 : 1,
            }}
          >
            <Check size={18} /> {isPending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        )}
      </div>
    </div>
  );
}
