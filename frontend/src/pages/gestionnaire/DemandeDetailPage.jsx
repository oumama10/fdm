import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getDemandeById, validerDemande } from '../../api/requests';
import { getInstances, getStock } from '../../api/resources';
import { downloadDechargePdf } from '../../api/decharge';
import DechargePrintModal from './DechargePrintModal';

// ── Design tokens ──────────────────────────────────────────────────────────
const T = {
  blue:      '#0C447C',
  lightBlue: '#1a7abf',
  green:     '#16a34a',
  orange:    '#f97316',
  amber:     '#f59e0b',
  red:       '#dc2626',
  textDark:  '#0f172a',
  textMid:   '#374151',
  textMuted: '#64748b',
  border:    '#e2e8f0',
  bgWhite:   '#ffffff',
  bgSubtle:  '#f8fafc',
  radius:    12,
  radiusSm:  8,
  radiusXs:  6,
};

// ── Helpers ───────────────────────────────────────────────────────────────
const _id      = (d) => d.idDemande        ?? d.id_demande;
const _ligneId = (l) => l.idLigne          ?? l.id_ligne;
const _rid     = (l) => l.idRessource      ?? l.id_ressource;
const _qd      = (l) => l.quantiteDemandee ?? l.quantite_demandee ?? 0;
const _qa      = (l) => l.quantiteAccordee ?? l.quantite_accordee ?? 0;
const _catNom  = (l) => l.ressource?.categorieNom ?? l.ressource?.categorie_nom ?? '';
const _instId  = (i) => i.idInstance       ?? i.id_instance;

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDateShort(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function demandeRef(d) {
  if (!d) return '';
  const iso  = d.dateDemande ?? d.date_demande;
  const year = iso ? new Date(iso).getFullYear() : new Date().getFullYear();
  return `DEM-${year}-${String(_id(d)).padStart(4, '0')}`;
}

// 0% = red, 1–49% = amber, 50–99% = orange, 100% = green
function availColor(pct) {
  if (pct >= 100) return T.green;
  if (pct >= 50)  return T.orange;
  if (pct > 0)    return T.amber;
  return T.red;
}

// ── Constants ─────────────────────────────────────────────────────────────
// Badge display — all possible outcome values
const STATUT_OPTIONS = [
  { value: 'en_cours',    label: 'En cours',    bg: '#dbeafe', color: '#1e3a8a', border: '#bfdbfe' },
  { value: 'traite',      label: 'Traité',      bg: '#bbf7d0', color: '#14532d', border: '#86efac' },
  { value: 'en_instance', label: 'En instance', bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
  { value: 'refuse',      label: 'Refusé',      bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
];


const URGENCE_MAP = {
  normal:  { label: 'Normal',  bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
  moyen:   { label: 'Moyen',   bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  urgent:  { label: 'Urgent',  bg: '#fff7ed', color: '#9a3412', border: '#fdba74' },
  extreme: { label: 'Extrême', bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
};

// ── Atoms ─────────────────────────────────────────────────────────────────
function InfoField({ label, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: T.textMuted }}>{label}</span>
      <div style={{
        height: 42, padding: '0 14px', display: 'flex', alignItems: 'center',
        border: `1px solid ${T.border}`, borderRadius: T.radiusSm,
        fontSize: 14, color: T.textDark, background: T.bgWhite,
      }}>
        {value || '—'}
      </div>
    </div>
  );
}

function AvailBar({ pct }) {
  const color = availColor(pct);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0, marginLeft: 24 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: T.textMuted }}>Disponibilité</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color, minWidth: 38, textAlign: 'right' }}>{pct}%</span>
        <div style={{ width: 80, height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: color, borderRadius: 4 }} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={statLabelStyle}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 700, color, lineHeight: '30px' }}>{value}</span>
    </div>
  );
}

function EtatBadge({ value }) {
  const map = {
    neuf:         { bg: '#dcfce7', color: '#14532d' },
    bon_etat:     { bg: '#dbeafe', color: '#1e3a8a' },
    usage_normal: { bg: '#fef9c3', color: '#713f12' },
    endommage:    { bg: '#fee2e2', color: '#991b1b' },
    hors_service: { bg: '#f3f4f6', color: '#6b7280' },
  };
  const t = map[value] || { bg: '#f3f4f6', color: '#6b7280' };
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: t.bg, color: t.color }}>
      {(value ?? '—').replaceAll('_', ' ')}
    </span>
  );
}

// ── Consommable block ─────────────────────────────────────────────────────
function ConsommableBlock({ ligne, stockMap, selection, onChange, readOnly }) {
  const rid      = Number(_rid(ligne));
  const dispo    = stockMap.get(rid) ?? 0;
  const maxServe = Math.min(_qd(ligne), dispo);
  const qa       = readOnly ? _qa(ligne) : (selection?.quantite_accordee ?? 0);

  return (
    <div style={expandBodyStyle}>
      <div style={{ display: 'flex', gap: 32, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <Stat label="Stock disponible" value={dispo} color={dispo > 0 ? T.green : T.red} />
        <Stat label="Qté demandée" value={_qd(ligne)} color={T.textDark} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={statLabelStyle}>Qté à servir</span>
          {readOnly ? (
            <span style={{ fontSize: 22, fontWeight: 700, color: T.lightBlue, lineHeight: '30px' }}>{qa}</span>
          ) : (
            <input
              type="number" min={0} max={maxServe} value={qa}
              onChange={(e) => {
                const v = Math.max(0, Math.min(Number(e.target.value), maxServe));
                onChange({ quantite_accordee: v, instances: [] });
              }}
              style={{
                width: 80, height: 38, textAlign: 'center',
                fontSize: 15, fontWeight: 700, color: T.lightBlue,
                border: `2px solid ${T.lightBlue}`, borderRadius: T.radiusXs,
                outline: 'none', background: T.bgWhite,
              }}
            />
          )}
        </div>
      </div>
      {!readOnly && dispo === 0 && (
        <p style={{ margin: '10px 0 0', fontSize: 13, color: T.red }}>
          Aucun stock disponible — la quantité accordée sera 0.
        </p>
      )}
    </div>
  );
}

// ── Bien-inventaire block ─────────────────────────────────────────────────
function BienInventaireBlock({ ligne, selection, onChange, readOnly }) {
  const rid    = _rid(ligne);
  const maxQty = _qd(ligne);

  const instancesQuery = useQuery({
    queryKey: ['resources', 'instances', 'available', rid],
    queryFn:  () => getInstances({ id_ressource: rid, statut: 'en_stock', etat__in: ['en_stock', 'retourne'] }),
    enabled:  Boolean(rid) && !readOnly,
    staleTime: 30000,
  });

  const _instDate = (i) => i.dateAcquisition ?? i.dateAcquisitionDisplay ?? i.date_acquisition ?? i.date_acquisition_display;

  const instances = [...(instancesQuery.data?.data || [])].sort((a, b) =>
    new Date(_instDate(a) ?? 0) - new Date(_instDate(b) ?? 0)
  );

  const selectedIds = selection?.instances ?? [];

  function toggle(instId) {
    if (selectedIds.includes(instId)) {
      const next = selectedIds.filter((x) => x !== instId);
      onChange({ instances: next, quantite_accordee: next.length });
    } else if (selectedIds.length < maxQty) {
      const next = [...selectedIds, instId];
      onChange({ instances: next, quantite_accordee: next.length });
    }
  }

  if (readOnly) {
    return (
      <div style={expandBodyStyle}>
        <span style={{ fontSize: 14, color: T.textMuted }}>
          Instances affectées : <strong style={{ color: T.textDark }}>{_qa(ligne)}</strong>
        </span>
      </div>
    );
  }

  return (
    <div style={expandBodyStyle}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: selectedIds.length === maxQty ? T.green : T.lightBlue }}>
          {selectedIds.length} / {maxQty} sélectionnée{maxQty > 1 ? 's' : ''}
        </span>
      </div>

      {instancesQuery.isLoading && (
        <div style={{ padding: '10px 0', fontSize: 13, color: T.textMuted }}>Chargement…</div>
      )}
      {!instancesQuery.isLoading && instances.length === 0 && (
        <div style={{ padding: '10px 0', fontSize: 13, color: T.red }}>Aucune instance disponible en stock.</div>
      )}

      {instances.length > 0 && (
        <div style={{ overflowX: 'auto', borderRadius: T.radiusSm, border: `1px solid ${T.border}` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: T.bgSubtle }}>
                {['', 'N° Inventaire', 'Date acquisition', 'État', 'Observation'].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {instances.map((inst) => {
                const instId  = _instId(inst);
                const checked = selectedIds.includes(instId);
                const blocked = !checked && selectedIds.length >= maxQty;
                return (
                  <tr
                    key={instId}
                    onClick={() => !blocked && toggle(instId)}
                    style={{
                      borderTop: `1px solid ${T.border}`,
                      background: checked ? '#eff6ff' : T.bgWhite,
                      cursor: blocked ? 'not-allowed' : 'pointer',
                      opacity: blocked ? 0.4 : 1,
                    }}
                  >
                    <td style={{ ...tdStyle, width: 40 }}>
                      <input
                        type="checkbox" checked={checked} disabled={blocked}
                        onChange={() => toggle(instId)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ width: 16, height: 16, cursor: blocked ? 'not-allowed' : 'pointer' }}
                      />
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 600, fontFamily: 'monospace', color: T.textDark }}>
                      {inst.numeroInventaire ?? inst.numero_inventaire ?? '—'}
                    </td>
                    <td style={tdStyle}>{fmtDateShort(_instDate(inst))}</td>
                    <td style={tdStyle}><EtatBadge value={inst.etat} /></td>
                    <td style={{ ...tdStyle, color: T.textMuted }}>{inst.observation ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Statut auto-compute ───────────────────────────────────────────────────
function computeStatutFromSelections(lignes, selections) {
  if (!lignes || lignes.length === 0) return 'en_cours';
  let totalServi = 0;
  for (const ligne of lignes) {
    const lid = _ligneId(ligne);
    totalServi += selections[lid]?.quantite_accordee ?? 0;
  }
  if (totalServi === 0) return 'en_cours';
  return 'traite';
}

// ── Page ──────────────────────────────────────────────────────────────────
export default function DemandeDetailPage() {
  const { id }      = useParams();
  const queryClient = useQueryClient();

  const [isEditing,        setIsEditing]        = useState(false);
  const [selectedStatut,   setSelectedStatut]   = useState('');
  const [motifRefus,       setMotifRefus]       = useState('');
  const [selections,       setSelections]       = useState({});
  const [expandedLines,    setExpandedLines]    = useState(new Set());
  const [createdDechargeId, setCreatedDechargeId] = useState(null);
  const [showPrintModal,   setShowPrintModal]   = useState(false);

  function updateSelection(ligneId, patch) {
    setSelections((prev) => ({ ...prev, [ligneId]: { ...(prev[ligneId] || {}), ...patch } }));
  }

  function toggleLine(ligneId) {
    setExpandedLines((prev) => {
      const next = new Set(prev);
      next.has(ligneId) ? next.delete(ligneId) : next.add(ligneId);
      return next;
    });
  }

  // ── Queries ───────────────────────────────────────────────────────────────
  const demandeQuery = useQuery({
    queryKey: ['demandes', 'detail', id],
    queryFn:  () => getDemandeById(id),
    staleTime: 30000,
  });
  const stockQuery = useQuery({
    queryKey: ['resources', 'stocks'],
    queryFn:  getStock,
    staleTime: 30000,
  });

  const demande  = demandeQuery.data?.data;
  const stockMap = new Map(
    (stockQuery.data?.data || []).map((r) => [
      Number(r.idRessource ?? r.id_ressource),
      Number(r.quantiteDisponible ?? r.quantite_disponible ?? 0),
    ])
  );

  // Auto-compute statut from instance/qty selections whenever edit mode is active.
  // Uses functional setState so 'refusee' (manual user choice) is never overridden.
  useEffect(() => {
    if (!isEditing || !demande?.lignes) return;
    setSelectedStatut((current) => {
      if (current === 'refuse' || current === 'en_instance') return current;
      return computeStatutFromSelections(demande.lignes, selections);
    });
  }, [isEditing, selections, demande?.lignes]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mutations ─────────────────────────────────────────────────────────────
  const validateMutation = useMutation({
    mutationFn: ({ demandeId, data }) => validerDemande(demandeId, data),
    onSuccess: (response) => {
      const did = response.data?.dechargeId ?? response.data?.decharge_id ?? null;
      if (did) setCreatedDechargeId(did);
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['demandes', 'detail', id] });
      queryClient.invalidateQueries({ queryKey: ['demandes', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['decharge', 'list'] });
    },
  });

  function handleSave() {
    if (!demande) return;
    let decision;
    if (selectedStatut === 'refuse')        decision = 'refus';
    else if (selectedStatut === 'en_instance') decision = 'en_instance';
    else                                       decision = 'total';

    const lignesData = (demande.lignes || []).map((ligne) => {
      const lid = _ligneId(ligne);
      const sel = selections[lid] || { quantite_accordee: 0, instances: [] };
      return { id_ligne: lid, quantite_accordee: sel.quantite_accordee ?? 0, instances: sel.instances ?? [] };
    });

    validateMutation.mutate({
      demandeId: _id(demande),
      data: {
        decision,
        lignes: lignesData,
        commentaire_validation: motifRefus,
        motif_refus: motifRefus,
      },
    });
  }

  function handleStartEdit() {
    setSelections({});
    // Auto-expand all lines so gestionnaire sees stock info immediately
    const allIds = new Set((demande.lignes || []).map((l) => _ligneId(l)));
    setExpandedLines(allIds);
    setSelectedStatut('en_cours');
    setMotifRefus(demande.motifRefus ?? demande.motif_refus ?? '');
    setCreatedDechargeId(null);
    setIsEditing(true);
  }

  function handleCancelEdit() {
    setExpandedLines(new Set());
    setIsEditing(false);
    // Reset to the server value so the badge stays correct after cancel.
    setSelectedStatut(demande?.statut || 'en_cours');
    setMotifRefus(demande?.motifRefus ?? demande?.motif_refus ?? '');
  }

  // ── Guards ────────────────────────────────────────────────────────────────
  if (demandeQuery.isLoading) {
    return <div style={{ padding: '32px 0', color: T.textMuted, fontSize: 14 }}>Chargement…</div>;
  }
  if (!demande) {
    return <div style={{ color: T.red, padding: 24, fontSize: 14 }}>Demande introuvable.</div>;
  }

  const isEditable    = ['en_cours', 'en_instance'].includes(demande.statut);
  // Badge always tracks the server value; select tracks the in-flight edit value.
  const displayStatut    = isEditing ? selectedStatut : (demande.statut || 'en_cours');
  const currentStatutOpt = STATUT_OPTIONS.find((o) => o.value === displayStatut) || STATUT_OPTIONS[0];
  const urgenceStyle     = URGENCE_MAP[demande.urgence] || URGENCE_MAP.normal;
  const isPending        = validateMutation.isPending;
  const saveDisabled = !isEditing || isPending || selectedStatut === 'en_cours'
    || (selectedStatut === 'refuse' && !motifRefus.trim());
  const canExpand  = true;
  const dechargeId = createdDechargeId ?? demande.decharge_id ?? demande.dechargeId ?? null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={pageStyle}>

      {/* ── Header ── */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20, color: T.blue }}>&#9641;</span>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: T.blue }}>
              Détails de la Demande
            </h1>
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.lightBlue }}>
            # Référence : {demandeRef(demande)}
          </span>
        </div>
        <div style={{ height: 3, background: T.lightBlue, borderRadius: 2, margin: '0 -24px' }} />
      </div>

      {/* ── Décharge auto-créée ── */}
      {createdDechargeId && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderRadius: T.radiusSm,
          background: '#f0fdf4', border: '1px solid #86efac',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18, color: T.green }}>✓</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#14532d' }}>
              Demande traitée — une décharge a été générée automatiquement.
            </span>
          </div>
          <Link
            to={`/gestionnaire/decharges/${createdDechargeId}`}
            style={{
              fontSize: 13, fontWeight: 600, color: T.green,
              textDecoration: 'none', whiteSpace: 'nowrap',
              padding: '6px 14px', border: `1px solid ${T.green}`,
              borderRadius: T.radiusSm, background: T.bgWhite,
            }}
          >
            Voir la décharge →
          </Link>
        </div>
      )}

      {/* ── Demandeur & Hierarchy info ── */}
      <div style={card}>
        <h3 style={sectionTitle}>Informations du demandeur</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 14 }}>
          <InfoField label="Nom complet"
            value={demande.chefDemandeur?.nomComplet ?? demande.chef_demandeur?.nom_complet} />
          <InfoField label="Email"
            value={demande.chefDemandeur?.email ?? demande.chef_demandeur?.email} />
          <InfoField label="Rôle"
            value={demande.chefDemandeur?.roleNom ?? demande.chef_demandeur?.role_nom ?? 'Chef de service'} />
          <InfoField label="Service (utilisateur)"
            value={demande.chefDemandeur?.serviceNom ?? demande.chef_demandeur?.service_nom} />
        </div>
      </div>

      {/* ── Détails de la demande ── */}
      <div style={card}>
        <h3 style={sectionTitle}>Détails de la demande</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 14 }}>
          <InfoField label="Date de demande"
            value={fmtDate(demande.dateDemande ?? demande.date_demande)} />
          <InfoField label="Établissement"
            value={demande.service?.etablissementNom ?? demande.service?.etablissement_nom} />
          <InfoField label="Bâtiment"
            value={demande.service?.batimentNom ?? demande.service?.batiment_nom} />
          <InfoField label="Service demandé"
            value={demande.service?.nomService ?? demande.service?.nom_service} />
          <InfoField label="Bénéficiaire"
            value={demande.beneficiaire ? `${demande.beneficiaire.nom} (${demande.beneficiaire.roleType ?? demande.beneficiaire.role_type ?? ''})` : (demande.beneficiaireNom ?? demande.beneficiaire_nom)} />
        </div>
      </div>

      {/* ── Articles demandés ── */}
      <div style={card}>
        <h3 style={sectionTitle}>Articles demandés</h3>
        <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
          {(demande.lignes || []).map((ligne) => {
            const lid      = _ligneId(ligne);
            const rid      = _rid(ligne);
            const isCons   = _catNom(ligne) === 'Consommable';
            const pct      = Number(ligne.disponibilitePct ?? ligne.disponibilite_pct ?? 0);
            const ref      = ligne.ressource?.reference ?? `ART-${String(rid).padStart(3, '0')}`;
            const expanded = expandedLines.has(lid);

            return (
              <div
                key={lid}
                style={{
                  ...articleCard,
                  borderColor: canExpand && expanded ? T.lightBlue : T.border,
                }}
              >
                <div
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                    cursor: canExpand ? 'pointer' : 'default',
                    userSelect: 'none',
                  }}
                  onClick={() => canExpand && toggleLine(lid)}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: T.textDark }}>
                      {ligne.ressource?.designation || '—'}
                    </div>
                    <div style={{ fontSize: 13, color: T.textMuted, marginTop: 4 }}>Référence : {ref}</div>
                    <div style={{ fontSize: 13, color: T.textMuted, marginTop: 2 }}>
                      Qté demandée : <strong style={{ color: T.textMid }}>{_qd(ligne)}</strong>
                      {isCons && <> · Stock : <strong style={{ color: (stockMap.get(Number(_rid(ligne))) ?? 0) > 0 ? T.green : T.red }}>{stockMap.get(Number(_rid(ligne))) ?? 0}</strong></>}
                    </div>
                  </div>
                  <AvailBar pct={pct} />
                </div>

                {expanded && (
                  isCons
                    ? <ConsommableBlock ligne={ligne} stockMap={stockMap} selection={selections[lid]} onChange={(p) => updateSelection(lid, p)} readOnly={!isEditing} />
                    : <BienInventaireBlock ligne={ligne} selection={selections[lid]} onChange={(p) => updateSelection(lid, p)} readOnly={!isEditing} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Justification + Urgence ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <div style={card}>
          <h3 style={sectionTitle}>Justification / Commentaires</h3>
          <div style={textareaDisplay}>{demande.justification || '—'}</div>
        </div>
        <div style={{ ...card, padding: '12px 16px', display: 'flex', flexDirection: 'column', alignSelf: 'flex-start', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Urgence
          </span>
          <span style={{
            alignSelf: 'flex-start',
            fontSize: 13, fontWeight: 600,
            padding: '5px 14px', borderRadius: 999,
            background: urgenceStyle.bg,
            color: urgenceStyle.color,
            border: `1px solid ${urgenceStyle.border}`,
          }}>
            {urgenceStyle.label}
          </span>
        </div>
      </div>

      {/* ── Decision Summary (visible in edit mode) ── */}
      {isEditing && (() => {
        const lignes = demande.lignes || [];
        let totalDem = 0, totalAcc = 0;
        lignes.forEach((l) => {
          totalDem += _qd(l);
          totalAcc += selections[_ligneId(l)]?.quantite_accordee ?? 0;
        });
        const decisionLabel = selectedStatut === 'refuse' ? 'Refus total'
          : selectedStatut === 'en_instance' ? "En attente d'achat"
          : totalAcc === 0 ? 'Aucune quantité accordée'
          : `Accord (${totalAcc}/${totalDem})`;
        const decisionColor = selectedStatut === 'refuse' ? T.red
          : selectedStatut === 'en_instance' ? T.orange
          : totalAcc === 0 ? T.textMuted
          : T.green;
        return (
          <div style={{
            ...card,
            background: '#f0f9ff',
            border: `1px solid ${decisionColor}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 500, color: T.textMuted }}>Décision : </span>
              <span style={{ fontSize: 15, fontWeight: 700, color: decisionColor }}>{decisionLabel}</span>
            </div>
            <div style={{ display: 'flex', gap: 20 }}>
              <span style={{ fontSize: 13, color: T.textMuted }}>Demandé : <strong style={{ color: T.textDark }}>{totalDem}</strong></span>
              <span style={{ fontSize: 13, color: T.textMuted }}>Accordé : <strong style={{ color: decisionColor }}>{totalAcc}</strong></span>
            </div>
          </div>
        );
      })()}

      {/* ── Statut de la demande ── */}
      <div style={card}>
        <h3 style={sectionTitle}>Statut de la demande</h3>
        <div style={{ marginTop: 14 }}>
          {isEditing ? (
            <>
              <select
                value={selectedStatut}
                onChange={(e) => setSelectedStatut(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: T.radiusSm,
                  border: `1px solid ${currentStatutOpt.border}`,
                  fontSize: 14, fontWeight: 600,
                  color: currentStatutOpt.color,
                  background: currentStatutOpt.bg,
                  outline: 'none', cursor: 'pointer',
                  minWidth: 240,
                }}
              >
                {STATUT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>

              {selectedStatut === 'refuse' && (
                <div style={{ marginTop: 16 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: T.textMuted, display: 'block', marginBottom: 6 }}>
                    Motif du refus *
                  </span>
                  <textarea
                    value={motifRefus}
                    onChange={(e) => setMotifRefus(e.target.value)}
                    rows={3}
                    placeholder="Expliquer la raison du refus…"
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '10px 14px',
                      border: `1px solid ${T.border}`, borderRadius: T.radiusSm,
                      fontSize: 14, color: T.textDark,
                      resize: 'vertical', outline: 'none',
                      fontFamily: 'inherit', lineHeight: '20px',
                    }}
                  />
                </div>
              )}
            </>
          ) : (
            <span style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '5px 14px', borderRadius: 999,
              fontSize: 13, fontWeight: 600,
              background: currentStatutOpt.bg,
              color: currentStatutOpt.color,
              border: `1px solid ${currentStatutOpt.border}`,
            }}>
              {currentStatutOpt.label}
            </span>
          )}
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={footerRow}>
        {validateMutation.isError && (
          <span style={{ fontSize: 13, color: T.red, fontWeight: 500 }}>
            {validateMutation.error?.response?.data?.detail || "Erreur lors de l'opération."}
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>

          <button
            style={{ ...btnOutline, opacity: dechargeId ? 1 : 0.4, cursor: dechargeId ? 'pointer' : 'not-allowed' }}
            disabled={!dechargeId}
            onClick={() => dechargeId && setShowPrintModal(true)}
            title={dechargeId ? 'Télécharger la décharge PDF' : 'Aucune décharge disponible'}
          >
            &#9113; Télécharger décharge
          </button>

          <button
            style={isEditing ? btnAmber : btnOutline}
            onClick={isEditing ? handleCancelEdit : handleStartEdit}
            disabled={isPending || (!isEditing && !isEditable)}
            title={!isEditable && !isEditing ? 'Cette demande est déjà traitée' : undefined}
          >
            &#9998; {isEditing ? 'Annuler' : 'Modifier'}
          </button>

          <button
            style={{ ...btnPrimary, opacity: saveDisabled ? 0.4 : 1, cursor: saveDisabled ? 'not-allowed' : 'pointer' }}
            onClick={handleSave}
            disabled={saveDisabled}
          >
            {isPending ? 'Enregistrement…' : '✓ Enregistrer'}
          </button>
        </div>
      </div>

      {showPrintModal && dechargeId && (
        <DechargePrintModal
          dechargeId={dechargeId}
          onClose={() => setShowPrintModal(false)}
        />
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────
const pageStyle      = { display: 'grid', gap: 16, paddingBottom: 40 };
const card           = { background: T.bgWhite, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: '20px 24px' };
const sectionTitle   = { margin: 0, fontSize: 15, fontWeight: 600, color: T.textDark };
const statLabelStyle = { fontSize: 12, fontWeight: 500, color: T.textMuted };

const articleCard = {
  border: `1px solid ${T.border}`,
  borderRadius: T.radiusSm,
  background: T.bgWhite,
  padding: '14px 18px',
  display: 'flex',
  flexDirection: 'column',
  gap: 0,
  transition: 'border-color 0.15s',
};

const expandBodyStyle = {
  marginTop: 14,
  paddingTop: 14,
  borderTop: `1px solid ${T.border}`,
};

const textareaDisplay = {
  marginTop: 14,
  padding: '10px 14px',
  border: `1px solid ${T.border}`,
  borderRadius: T.radiusSm,
  minHeight: 88,
  fontSize: 14,
  color: T.textDark,
  background: T.bgSubtle,
  whiteSpace: 'pre-wrap',
  lineHeight: '20px',
};

const footerRow = { display: 'flex', alignItems: 'center', gap: 10, paddingTop: 4 };

const thStyle = {
  padding: '9px 12px', fontSize: 12, fontWeight: 600,
  color: T.textMuted, textAlign: 'left', borderBottom: `1px solid ${T.border}`,
};
const tdStyle = { padding: '10px 12px', fontSize: 13, color: T.textMid, verticalAlign: 'middle' };

const btnBase    = { border: 'none', borderRadius: T.radiusSm, padding: '9px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer', lineHeight: '20px' };
const btnOutline = { ...btnBase, border: `1px solid ${T.border}`, background: T.bgWhite, color: T.textMuted };
const btnAmber   = { ...btnBase, border: '1px solid #fcd34d', background: '#fffbeb', color: '#92400e' };
const btnPrimary = { ...btnBase, background: T.lightBlue, color: '#fff' };
