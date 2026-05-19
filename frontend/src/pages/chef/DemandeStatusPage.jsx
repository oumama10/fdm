import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { downloadDechargeAuto, getDecharges } from '../../api/decharge';
import { getNotifications } from '../../api/alerts';
import { getDemandeById } from '../../api/requests';

// ── Design tokens ──────────────────────────────────────────────────────────
const T = {
  green:     '#0F6E56',
  lightGreen:'#1D9E75',
  textDark:  '#0f172a',
  textMid:   '#374151',
  textMuted: '#64748b',
  border:    '#e2e8f0',
  bgWhite:   '#ffffff',
  bgSubtle:  '#f8fafc',
  radius:    12,
  radiusSm:  8,
};

// ── Helpers ────────────────────────────────────────────────────────────────
const _sig  = (d) => d?.statutSignature ?? d?.statut_signature;
const _did  = (d) => d?.idDecharge      ?? d?.id_decharge;
const _dnum = (d) => d?.numeroDecharge  ?? d?.numero_decharge;

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── Step definitions ───────────────────────────────────────────────────────
const STEPS = [
  { label: 'Soumise',          key: 0 },
  { label: 'En traitement',    key: 1 },
  { label: 'Validée',          key: 2 },
  { label: 'Décharge générée', key: 3 },
  { label: 'Scan soumis',      key: 4 },
  { label: 'Livraison confirmée', key: 5 },
];

function getStepIndex(demande, decharge) {
  if (!demande) return -1;
  if (!decharge) {
    if (demande.statut === 'totale' || demande.statut === 'partielle') return 2;
    if (demande.statut === 'en_cours' || demande.statut === 'en_attente') return 1;
    if (demande.statut === 'refusee') return 1;
    return 0;
  }
  const sig = _sig(decharge);
  if (sig === 'valide') return 5;
  if (sig === 'signe')  return 4;
  return 3;
}

// ── Badges ─────────────────────────────────────────────────────────────────
const STATUT_MAP = {
  en_attente: { label: 'En attente',    bg: '#f0f9ff', color: '#0369a1', border: '#bae6fd' },
  en_cours:   { label: 'En cours',      bg: '#dbeafe', color: '#1e3a8a', border: '#bfdbfe' },
  partielle:  { label: 'Partiellement traitée', bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  totale:     { label: 'Totalement traitée',    bg: '#bbf7d0', color: '#14532d', border: '#86efac' },
  refusee:    { label: 'Refusée',       bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
};
const URGENCE_MAP = {
  normal: { label: 'Normal', bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
  moyen:  { label: 'Moyen',  bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  urgent: { label: 'Urgent', bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
};
const SIG_MAP = {
  non_generee: { label: 'Non générée', bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
  en_attente:  { label: 'En attente',  bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  signe:       { label: 'Scan soumis', bg: '#dbeafe', color: '#1e3a8a', border: '#bfdbfe' },
  valide:      { label: 'Confirmée',   bg: '#bbf7d0', color: '#14532d', border: '#86efac' },
  rejete:      { label: 'Rejeté',      bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
};

function Pill({ map, value }) {
  const s = map[value] || map.non_generee || { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' };
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

// ── Line status label ──────────────────────────────────────────────────────
function lineStatusLabel(accordee, livree, isValide) {
  if (isValide) {
    if (livree >= accordee && livree > 0) return { label: 'Livré',                bg: '#bbf7d0', color: '#14532d' };
    if (livree > 0)                       return { label: 'Partiellement livré',  bg: '#fef3c7', color: '#92400e' };
    return                                       { label: 'Non disponible',       bg: '#f1f5f9', color: '#6b7280' };
  }
  if (accordee > 0) return { label: 'Accordé',       bg: '#dbeafe', color: '#1e3a8a' };
  return               { label: 'Non disponible', bg: '#f1f5f9', color: '#6b7280' };
}

// ── Component ──────────────────────────────────────────────────────────────
export default function DemandeStatusPage() {
  const { id }   = useParams();
  const navigate = useNavigate();

  const demandeQuery = useQuery({
    queryKey: ['chef', 'demande', id],
    queryFn:  () => getDemandeById(id),
    staleTime: 30000,
  });
  const dechargesQuery = useQuery({
    queryKey: ['decharge', 'for-demande', id],
    queryFn:  getDecharges,
    staleTime: 30000,
  });
  const notificationsQuery = useQuery({
    queryKey: ['alerts', 'notifications'],
    queryFn:  getNotifications,
    staleTime: 30000,
  });

  const demande  = demandeQuery.data?.data;
  const decharge = useMemo(() => {
    const rows = dechargesQuery.data?.data || [];
    return rows.find((d) => Number(d.idDemande ?? d.id_demande) === Number(id));
  }, [dechargesQuery.data?.data, id]);

  const stepIndex = getStepIndex(demande, decharge);

  const notifHistory = useMemo(() => {
    const rows = notificationsQuery.data?.data || [];
    return rows
      .filter((n) => Number(n.objectId ?? n.object_id) === Number(id))
      .sort((a, b) => new Date(b.dateEnvoi ?? b.date_envoi ?? 0) - new Date(a.dateEnvoi ?? a.date_envoi ?? 0));
  }, [notificationsQuery.data?.data, id]);

  function handleDownload() {
    const did = _did(decharge);
    if (!did) return;
    downloadDechargeAuto(did);
  }

  // ── Guards ────────────────────────────────────────────────────────────────
  if (demandeQuery.isLoading) {
    return (
      <div style={{ display: 'grid', gap: 16 }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ height: 120, borderRadius: T.radius, background: T.bgSubtle }} />
        ))}
      </div>
    );
  }
  if (!demande) {
    return <div style={{ color: '#b91c1c', padding: 24, fontSize: 14 }}>Demande introuvable.</div>;
  }

  const sig        = decharge ? _sig(decharge) : 'non_generee';
  const isValide   = sig === 'valide';
  const statut     = demande.statut || 'en_attente';
  const urgence    = demande.urgence || 'normal';
  const nom        = demande.numero ?? `DEM-${demande.idDemande ?? demande.id_demande}`;
  const dateD      = demande.dateDemande ?? demande.date_demande;
  const service    = demande.service?.nomService ?? demande.service?.nom_service
                  ?? demande.idService?.nomService ?? '—';

  return (
    <div style={{ display: 'grid', gap: 16, paddingBottom: 40 }}>

      {/* ── Header ── */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 20, color: T.green }}>&#9641;</span>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: T.green }}>{nom}</h1>
            </div>
            <div style={{ fontSize: 13, color: T.textMuted }}>
              Soumise le {fmtDate(dateD)} · Service : {service}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Pill map={URGENCE_MAP} value={urgence} />
            <Pill map={STATUT_MAP}  value={statut}  />
          </div>
        </div>
        <div style={{ height: 3, background: T.lightGreen, borderRadius: 2, margin: '14px -24px 0' }} />
      </div>

      {/* ── Stepper ── */}
      <div style={card}>
        <h3 style={sectionTitle}>Progression</h3>
        <div style={{ marginTop: 20, position: 'relative' }}>
          {/* connector line */}
          <div style={{
            position: 'absolute', top: 14, left: '8.33%', right: '8.33%', height: 2,
            background: T.border, borderRadius: 1,
          }} />
          <div style={{
            position: 'absolute', top: 14, left: '8.33%',
            width: `${Math.min(stepIndex / (STEPS.length - 1), 1) * 83.34}%`,
            height: 2, background: T.lightGreen, borderRadius: 1,
            transition: 'width 0.4s ease',
          }} />

          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${STEPS.length}, 1fr)`, gap: 0, position: 'relative' }}>
            {STEPS.map(({ label }, index) => {
              const done    = index <= stepIndex;
              const current = index === stepIndex;
              return (
                <div key={label} style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: done ? T.green : T.bgWhite,
                    border: `2px solid ${done ? T.green : T.border}`,
                    color: done ? '#fff' : T.textMuted,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                    boxShadow: current ? `0 0 0 3px ${T.lightGreen}33` : 'none',
                    zIndex: 1, position: 'relative',
                  }}>
                    {done ? '✓' : index + 1}
                  </div>
                  <div style={{
                    fontSize: 11, fontWeight: current ? 700 : 500,
                    color: done ? T.green : T.textMuted,
                    lineHeight: '14px', maxWidth: 72, textAlign: 'center',
                  }}>
                    {label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Articles ── */}
      <div style={card}>
        <h3 style={sectionTitle}>Articles demandés</h3>
        <div style={{ marginTop: 14, borderRadius: T.radiusSm, border: `1px solid ${T.border}`, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: T.bgSubtle }}>
                {['Article', 'Qté demandée', 'Qté accordée', 'Statut livraison'].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(demande.lignes || []).length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: '20px 12px', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>
                    Aucun article.
                  </td>
                </tr>
              ) : (demande.lignes || []).map((line) => {
                const accordee = Number(line.quantiteAccordee ?? line.quantite_accordee ?? 0);
                const livree   = Number(line.quantiteLivree   ?? line.quantite_livree   ?? 0);
                const demandee = Number(line.quantiteDemandee ?? line.quantite_demandee ?? 0);
                const lid      = line.idLigne ?? line.id_ligne;
                const { label: lbl, bg, color } = lineStatusLabel(accordee, livree, isValide);
                return (
                  <tr key={lid} style={{ borderTop: `1px solid ${T.border}` }}>
                    <td style={{ ...tdStyle, fontWeight: 600, color: T.textDark }}>
                      {line.ressource?.designation || '—'}
                    </td>
                    <td style={{ ...tdStyle, color: T.textMid }}>{demandee}</td>
                    <td style={{ ...tdStyle, color: T.textMid }}>{accordee}</td>
                    <td style={tdStyle}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center',
                        padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                        background: bg, color,
                      }}>
                        {lbl}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Décharge ── */}
      {decharge ? (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ ...sectionTitle, marginBottom: 6 }}>Décharge</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: T.green, fontSize: 14 }}>
                  {_dnum(decharge) || '—'}
                </span>
                <Pill map={SIG_MAP} value={sig} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button style={btnOutline} onClick={handleDownload}>
                ⬇ Télécharger PDF
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Justification ── */}
      {demande.justification ? (
        <div style={card}>
          <h3 style={sectionTitle}>Justification</h3>
          <div style={{
            marginTop: 12, padding: '10px 14px',
            background: T.bgSubtle, borderRadius: T.radiusSm,
            border: `1px solid ${T.border}`,
            fontSize: 14, color: T.textMid, lineHeight: '20px',
            whiteSpace: 'pre-wrap',
          }}>
            {demande.justification}
          </div>
        </div>
      ) : null}

      {/* ── Notifications ── */}
      <div style={card}>
        <h3 style={sectionTitle}>Historique des notifications</h3>
        {notifHistory.length === 0 ? (
          <p style={{ marginTop: 12, fontSize: 13, color: T.textMuted }}>Aucune notification liée à cette demande.</p>
        ) : (
          <ul style={{ margin: '12px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
            {notifHistory.map((n) => {
              const nid  = n.idNotification ?? n.id_notification;
              const date = n.dateEnvoi      ?? n.date_envoi;
              return (
                <li key={nid} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                  padding: '10px 14px', borderRadius: T.radiusSm,
                  background: T.bgSubtle, border: `1px solid ${T.border}`,
                  gap: 12,
                }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: T.lightGreen, marginTop: 4, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: T.textDark }}>{n.titre ?? n.title ?? '—'}</span>
                  </div>
                  <span style={{ fontSize: 12, color: T.textMuted, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {fmtDateTime(date)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────
const card         = { background: T.bgWhite, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: '20px 24px' };
const sectionTitle = { margin: 0, fontSize: 15, fontWeight: 600, color: T.textDark };
const thStyle      = { padding: '9px 12px', fontSize: 12, fontWeight: 600, color: T.textMuted, textAlign: 'left', borderBottom: `1px solid ${T.border}` };
const tdStyle      = { padding: '10px 12px', verticalAlign: 'middle' };
const btnBase      = { border: 'none', borderRadius: T.radiusSm, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', lineHeight: '20px' };
const btnPrimary   = { ...btnBase, background: T.green, color: '#fff' };
const btnOutline   = { ...btnBase, border: `1px solid ${T.border}`, background: T.bgWhite, color: T.textMid };
