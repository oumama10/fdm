import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { downloadDechargeAuto, getDecharges, marquerSigne } from '../../api/decharge';

// ── SVG icons ─────────────────────────────────────────────────────────────
const IconEye = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);
const IconDownload = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

// ── Design tokens ─────────────────────────────────────────────────────────
const T = {
  blue: '#0C447C', lightBlue: '#1a7abf', green: '#16a34a',
  red: '#dc2626', textDark: '#0f172a', textMid: '#374151', textMuted: '#64748b',
  border: '#e2e8f0', bgWhite: '#ffffff', bgSubtle: '#f8fafc', radius: 12, radiusSm: 8,
};

// ── Helpers ────────────────────────────────────────────────────────────────
const _id       = (r) => r.idDecharge       ?? r.id_decharge;
const _num      = (r) => r.numeroDecharge   ?? r.numero_decharge   ?? '—';
const _date     = (r) => r.dateGeneration   ?? r.date_generation;
const _statut   = (r) => r.statutSignature  ?? r.statut_signature  ?? 'non_generee';
const _sigDate  = (r) => r.dateSignature    ?? r.date_signature;
const _demId  = (r) => r.demande?.idDemande  ?? r.demande?.id_demande  ?? r.idDemande ?? r.id_demande;
const _svc    = (r) => r.demande?.service?.nomService ?? r.demande?.service?.nom_service ?? '—';
const _demRef = (r) => {
  const id = _demId(r);
  if (!id) return '—';
  const iso = r.demande?.dateDemande ?? r.demande?.date_demande;
  const yr  = iso ? new Date(iso).getFullYear() : new Date().getFullYear();
  return `DEM-${yr}-${String(id).padStart(4, '0')}`;
};

function dechargeType(lignes) {
  if (!lignes || lignes.length === 0) return '—';
  const types = new Set((lignes).map((l) => l.typeLigne ?? l.type_ligne));
  if (types.size > 1) return 'Mixte';
  const t = [...types][0];
  return t === 'consommable' ? 'Consommable' : t === 'bien_inventaire' ? 'Bien inventaire' : t ?? '—';
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUT_BADGE = {
  non_generee: { label: 'Non généré', bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
  non_signe:   { label: 'Non signé',  bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  en_attente:  { label: 'Non signé',  bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  signe:       { label: 'Signé',      bg: '#bbf7d0', color: '#14532d', border: '#86efac' },
  valide:      { label: 'Signé',      bg: '#bbf7d0', color: '#14532d', border: '#86efac' },
  rejete:      { label: 'Rejeté',     bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
};

function StatutBadge({ value }) {
  const s = STATUT_BADGE[value] || STATUT_BADGE.non_generee;
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

async function triggerDownload(id) {
  await downloadDechargeAuto(id);
}

export default function DechargesListPage() {
  const navigate     = useNavigate();
  const queryClient  = useQueryClient();
  const [filterStatut, setFilterStatut] = useState('');
  const [dateFrom,     setDateFrom]     = useState('');
  const [dateTo,       setDateTo]       = useState('');
  const [showFilters,  setShowFilters]  = useState(false);
  const [pendingId,    setPendingId]    = useState(null);
  const [hoveredId,    setHoveredId]    = useState(null);

  const dechargesQuery = useQuery({
    queryKey: ['decharge', 'list'],
    queryFn:  getDecharges,
    staleTime: 30000,
  });

  const marquerMutation = useMutation({
    mutationFn: (dechargeId) => marquerSigne(dechargeId),
    onSettled: () => setPendingId(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['decharge', 'list'] });
    },
  });

  const rows = useMemo(() => {
    const raw = dechargesQuery.data?.data || [];
    return [...raw]
      .filter((r) => (filterStatut ? _statut(r) === filterStatut : true))
      .filter((r) => (dateFrom ? new Date(_date(r)) >= new Date(dateFrom) : true))
      .filter((r) => (dateTo ? new Date(_date(r)) <= new Date(`${dateTo}T23:59:59`) : true))
      .sort((a, b) => new Date(_date(b) ?? 0) - new Date(_date(a) ?? 0));
  }, [dechargesQuery.data?.data, filterStatut, dateFrom, dateTo]);

  const IconFilter = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
    </svg>
  );

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Header action */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: T.textDark, margin: 0 }}>Bons de décharge</h2>
        <button
          style={{
            border: `1px solid ${T.border}`,
            borderRadius: T.radiusSm,
            padding: '8px 16px',
            background: showFilters ? '#e2e8f0' : '#fff',
            color: T.textDark,
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 13,
            display: 'inline-flex',
            alignItems: 'center',
          }}
          onClick={() => setShowFilters(!showFilters)}
        >
          <IconFilter /> {showFilters ? 'Masquer filtres' : 'Filtres'}
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '12px 16px', background: T.bgSubtle, borderRadius: T.radius, border: `1px solid ${T.border}` }}>
          <select value={filterStatut} onChange={(e) => setFilterStatut(e.target.value)} style={filterInput}>
            <option value="">Tous statuts</option>
            <option value="non_generee">Non généré</option>
            <option value="en_attente">Non signé</option>
            <option value="valide">Signé</option>
            <option value="rejete">Rejeté</option>
          </select>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={filterInput} />
          <input type="date" value={dateTo}   onChange={(e) => setDateTo(e.target.value)}   style={filterInput} />
        </div>
      )}

      {/* Table */}
      <div style={{ border: `1px solid ${T.border}`, borderRadius: T.radius, background: T.bgWhite, overflow: 'hidden' }}>
        {dechargesQuery.isLoading ? (
          <div style={{ padding: 16 }}><div style={{ height: 180, borderRadius: 8, background: T.bgSubtle }} /></div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: T.bgSubtle, textAlign: 'left' }}>
                {['Réf. décharge', 'Réf. demande', 'Service demandeur', 'Date création', 'Type', 'Statut signature', 'Actions'].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr key="empty"><td colSpan={7} style={{ padding: 16, color: T.textMuted }}>Aucune décharge trouvée.</td></tr>
              ) : rows.map((row) => {
                const did       = _id(row);
                const statut    = _statut(row);
                const isHovered = hoveredId === did;
                const isLoading = pendingId === did && marquerMutation.isPending;
                const hasPdf    = Boolean(row.fichierPdf ?? row.fichier_pdf);

                return (
                  <tr
                    key={did}
                    style={{
                      borderTop: `1px solid ${T.border}`,
                      cursor: 'pointer',
                      background: isHovered ? '#f0f7ff' : T.bgWhite,
                      transition: 'background 120ms',
                    }}
                    onMouseEnter={() => setHoveredId(did)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => navigate(`/gestionnaire/decharges/${did}`)}
                  >
                    <td style={{ ...tdStyle, fontWeight: 600, fontFamily: 'monospace', color: T.blue }}>{_num(row)}</td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 13 }}>{_demRef(row)}</td>
                    <td style={tdStyle}>{_svc(row)}</td>
                    <td style={tdStyle}>{fmtDate(_date(row))}</td>
                    <td style={{ ...tdStyle, fontSize: 13, color: T.textMuted }}>{dechargeType(row.lignes)}</td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <StatutBadge value={statut} />
                        {statut === 'valide' && _sigDate(row) && (
                          <span style={{ fontSize: 11, color: T.textMuted }}>
                            {fmtDate(_sigDate(row))}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ ...tdStyle, width: 140, minWidth: 140 }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {/* Eye — always visible */}
                        <button
                          title="Voir le détail"
                          style={btnIcon}
                          onClick={() => navigate(`/gestionnaire/decharges/${did}`)}
                        >
                          <IconEye />
                        </button>
                        {/* Download — always visible, dimmed when no PDF */}
                        <button
                          title="Télécharger le PDF"
                          style={{ ...btnIcon, opacity: hasPdf ? 1 : 0.3, cursor: hasPdf ? 'pointer' : 'not-allowed' }}
                          disabled={!hasPdf}
                          onClick={() => hasPdf && triggerDownload(did)}
                        >
                          <IconDownload />
                        </button>
                        {/* Marquer signé — pill, appears on row hover only */}
                        {(statut === 'non_signe' || statut === 'en_attente') && (
                          <button
                            style={{
                              ...btnPill,
                              opacity: isHovered ? (isLoading ? 0.6 : 1) : 0,
                              pointerEvents: isHovered ? 'auto' : 'none',
                              transition: 'opacity 150ms',
                            }}
                            disabled={isLoading}
                            onClick={() => { setPendingId(did); marquerMutation.mutate(did); }}
                          >
                            {isLoading ? '…' : 'Marquer signé'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const filterInput = { border: `1px solid ${T.border}`, borderRadius: T.radiusSm, padding: '8px 10px', fontSize: 14, background: T.bgWhite };
const thStyle     = { padding: '10px 12px', fontWeight: 600, color: T.textMuted, fontSize: 13 };
const tdStyle     = { padding: '10px 12px', color: T.textMid };
const btnIcon     = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 28, height: 28, padding: 0, border: 'none', borderRadius: 6,
  background: 'transparent', color: T.textMuted, cursor: 'pointer',
};
const btnPill     = {
  display: 'inline-flex', alignItems: 'center',
  padding: '3px 10px', border: 'none', borderRadius: 999,
  fontSize: 11, fontWeight: 600, cursor: 'pointer', lineHeight: '18px',
  background: '#16a34a', color: '#fff', whiteSpace: 'nowrap',
};
