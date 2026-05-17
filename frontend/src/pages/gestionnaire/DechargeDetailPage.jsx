import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

import {
  getDechargeById,
  getSignatureDetail,
  marquerSigne,
} from '../../api/decharge';
import DechargePrintModal from './DechargePrintModal';

// ── Design tokens ─────────────────────────────────────────────────────────
const T = {
  blue: '#0C447C', lightBlue: '#1a7abf', green: '#16a34a',
  amber: '#f59e0b', red: '#dc2626',
  textDark: '#0f172a', textMid: '#374151', textMuted: '#64748b',
  border: '#e2e8f0', bgWhite: '#ffffff', bgSubtle: '#f8fafc',
  radius: 12, radiusSm: 8,
};

// ── Helpers ────────────────────────────────────────────────────────────────
const _id    = (d) => d.idDecharge     ?? d.id_decharge;
const _num   = (d) => d.numeroDecharge ?? d.numero_decharge ?? '—';
const _demId = (d) => d.demande?.idDemande ?? d.demande?.id_demande ?? d.idDemande ?? d.id_demande;
const _svc   = (d) => d.demande?.service?.nomService ?? d.demande?.service?.nom_service ?? '—';
const _chef  = (d) => d.demande?.chefDemandeur?.nomComplet ?? d.demande?.chef_demandeur?.nom_complet ?? '—';

function demRef(d) {
  if (!d) return '—';
  const id  = _demId(d);
  const iso = d.demande?.dateDemande ?? d.demande?.date_demande;
  const yr  = iso ? new Date(iso).getFullYear() : new Date().getFullYear();
  return id ? `DEM-${yr}-${String(id).padStart(4, '0')}` : '—';
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const STATUT_BADGE = {
  non_generee: { label: 'Non généré', bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
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
      padding: '5px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      {s.label}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────
export default function DechargeDetailPage() {
  const { id }      = useParams();
  const queryClient = useQueryClient();
  const [showPrintModal, setShowPrintModal] = useState(false);

  const dechargeQuery = useQuery({
    queryKey: ['decharge', 'detail', id],
    queryFn:  () => getDechargeById(id),
    staleTime: 30000,
  });
  const signatureQuery = useQuery({
    queryKey: ['decharge', 'signature', id],
    queryFn:  () => getSignatureDetail(id),
    staleTime: 30000,
  });

  const marquerMutation = useMutation({
    mutationFn: () => marquerSigne(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['decharge', 'detail', id] });
      queryClient.invalidateQueries({ queryKey: ['decharge', 'signature', id] });
      queryClient.invalidateQueries({ queryKey: ['decharge', 'list'] });
    },
  });

  if (dechargeQuery.isLoading) {
    return <div style={{ padding: '32px 0', color: T.textMuted, fontSize: 14 }}>Chargement…</div>;
  }

  const decharge = dechargeQuery.data?.data;
  if (!decharge) {
    return <div style={{ color: T.red, padding: 24 }}>Décharge introuvable.</div>;
  }

  const sig     = signatureQuery.data?.data;
  const statut  = decharge.statutSignature ?? decharge.statut_signature ?? 'non_generee';
  const sigDate = decharge.dateSignature ?? decharge.date_signature
    ?? (sig ? (sig.dateValidationSysteme ?? sig.date_validation_systeme ?? sig.dateSignature ?? sig.date_signature) : null);

  return (
    <div style={{ display: 'grid', gap: 16, paddingBottom: 40 }}>

      {/* ── Header ── */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20, color: T.blue }}>&#9641;</span>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: T.blue }}>
              Décharge {_num(decharge)}
            </h1>
          </div>
          <Link
            to={`/gestionnaire/demandes/${_demId(decharge)}`}
            style={{ fontSize: 13, color: T.lightBlue, textDecoration: 'none', fontWeight: 500 }}
          >
            ← Demande {demRef(decharge)}
          </Link>
        </div>
        <div style={{ height: 3, background: T.lightBlue, borderRadius: 2, margin: '0 -24px' }} />
      </div>

      {/* ── Info grid ── */}
      <div style={card}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <InfoField label="Service demandeur" value={_svc(decharge)} />
          <InfoField label="Chef demandeur"    value={_chef(decharge)} />
          <InfoField label="Date de création"  value={fmtDate(decharge.dateGeneration ?? decharge.date_generation)} />
          <InfoField label="Référence demande" value={demRef(decharge)} />
        </div>
      </div>

      {/* ── Articles ── */}
      <div style={card}>
        <h3 style={sectionTitle}>Articles de la décharge</h3>
        <div style={{ marginTop: 14, overflowX: 'auto', borderRadius: T.radiusSm, border: `1px solid ${T.border}` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: T.bgSubtle }}>
                {['Désignation', 'N° Inventaire', 'Qté', 'Affectation'].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(decharge.lignes || []).length === 0 ? (
                <tr key="empty">
                  <td colSpan={4} style={{ padding: 14, color: T.textMuted }}>Aucun article.</td>
                </tr>
              ) : (decharge.lignes || []).map((l, i) => {
                const lid    = l.idLigneDecharge ?? l.id_ligne_decharge ?? i;
                const inst   = l.instanceRessource ?? l.instance_ressource;
                const invNo  = inst?.numeroInventaire ?? inst?.numero_inventaire ?? '—';
                const svc    = _svc(decharge);
                return (
                  <tr key={lid} style={{ borderTop: `1px solid ${T.border}` }}>
                    <td style={{ ...tdStyle, fontWeight: 600, color: T.textDark }}>{l.ressource?.designation ?? '—'}</td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 13 }}>{invNo}</td>
                    <td style={tdStyle}>{l.quantite}</td>
                    <td style={{ ...tdStyle, fontSize: 13, color: T.textMid }}>{svc}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Signature ── */}
      <div style={card}>
        <h3 style={sectionTitle}>Statut de la signature</h3>
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <StatutBadge value={statut} />
          {sigDate && (
            <span style={{ fontSize: 13, color: T.textMuted }}>
              le {fmtDateTime(sigDate)}
            </span>
          )}
        </div>

        {statut === 'en_attente' && (
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: 13, color: T.textMuted, margin: '0 0 12px' }}>
              Imprimez la décharge, obtenez la signature physique du chef de service, puis marquez-la comme signée.
            </p>
            {marquerMutation.isError && (
              <p style={{ fontSize: 13, color: T.red, margin: '0 0 8px' }}>
                {marquerMutation.error?.response?.data?.detail || 'Erreur lors de l\'opération.'}
              </p>
            )}
            <button
              style={{ ...btnPrimary, opacity: marquerMutation.isPending ? 0.6 : 1 }}
              onClick={() => marquerMutation.mutate()}
              disabled={marquerMutation.isPending}
            >
              {marquerMutation.isPending ? 'Enregistrement…' : '✓ Marquer comme signé'}
            </button>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <Link
          to="/gestionnaire/decharges"
          style={{ ...btnOutline, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
        >
          ← Retour
        </Link>
        <button
          style={{ ...btnDownload, display: 'inline-flex', alignItems: 'center', gap: 7 }}
          onClick={() => setShowPrintModal(true)}
        >
          <Download size={15} />
          Télécharger PDF
        </button>
      </div>

      {showPrintModal && (
        <DechargePrintModal dechargeId={id} onClose={() => setShowPrintModal(false)} />
      )}
    </div>
  );
}

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

// ── Styles ─────────────────────────────────────────────────────────────────
const card        = { background: T.bgWhite, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: '20px 24px' };
const sectionTitle = { margin: 0, fontSize: 15, fontWeight: 600, color: T.textDark };
const thStyle     = { padding: '9px 12px', fontSize: 12, fontWeight: 600, color: T.textMuted, textAlign: 'left', borderBottom: `1px solid ${T.border}` };
const tdStyle     = { padding: '10px 12px', color: T.textMid, verticalAlign: 'middle' };
const btnBase     = { border: 'none', borderRadius: T.radiusSm, padding: '9px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer', lineHeight: '20px' };
const btnOutline  = { ...btnBase, border: `1px solid ${T.border}`, background: T.bgWhite, color: T.textMuted };
const btnPrimary  = { ...btnBase, background: T.green, color: '#fff' };
const btnDownload = { ...btnBase, background: T.blue, color: '#fff' };
