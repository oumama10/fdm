import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { downloadDechargePdf, getDecharges } from '../../api/decharge';

// ── Design tokens ─────────────────────────────────────────────────────────
const T = {
  blue: '#0C447C', lightBlue: '#1a7abf', green: '#16a34a',
  amber: '#f59e0b', red: '#dc2626',
  textDark: '#0f172a', textMid: '#374151', textMuted: '#64748b',
  border: '#e2e8f0', bgWhite: '#ffffff', bgSubtle: '#f8fafc',
  radius: 12, radiusSm: 8,
};

// ── Helpers ────────────────────────────────────────────────────────────────
const _id      = (r) => r.idDecharge      ?? r.id_decharge;
const _num     = (r) => r.numeroDecharge  ?? r.numero_decharge   ?? '—';
const _date    = (r) => r.dateGeneration  ?? r.date_generation;
const _statut  = (r) => r.statutSignature ?? r.statut_signature  ?? 'non_generee';
const _sigDate = (r) => r.dateSignature   ?? r.date_signature;

function articleResume(lignes) {
  if (!lignes || lignes.length === 0) return '—';
  const types = new Set(lignes.map((l) => l.typeLigne ?? l.type_ligne));
  const label = types.size > 1
    ? 'Mixte'
    : [...types][0] === 'consommable' ? 'Consommable'
    : [...types][0] === 'bien_inventaire' ? 'Bien inventaire'
    : [...types][0] ?? '—';
  return `${lignes.length} article${lignes.length > 1 ? 's' : ''} · ${label}`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
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
      padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      {s.label}
    </span>
  );
}



export default function DechargesPage() {
  const navigate = useNavigate();

  const dechargesQuery = useQuery({
    queryKey: ['decharge', 'chef-list'],
    queryFn:  getDecharges,
    staleTime: 30000,
  });

  const rows = useMemo(() => {
    const raw = dechargesQuery.data?.data || [];
    return [...raw].sort((a, b) => new Date(_date(b) ?? 0) - new Date(_date(a) ?? 0));
  }, [dechargesQuery.data?.data]);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ border: `1px solid ${T.border}`, borderRadius: T.radius, background: T.bgWhite, overflow: 'hidden' }}>
        {dechargesQuery.isLoading ? (
          <div style={{ padding: 16 }}><div style={{ height: 180, borderRadius: 8, background: T.bgSubtle }} /></div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: T.bgSubtle, textAlign: 'left' }}>
                {['Référence', 'Date', 'Articles', 'Statut signature', 'Actions'].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr key="empty">
                  <td colSpan={5} style={{ padding: 16, color: T.textMuted }}>Aucune décharge.</td>
                </tr>
              ) : rows.map((row) => {
                const did    = _id(row);
                const statut = _statut(row);

                return (
                  <tr
                    key={did}
                    style={{ borderTop: `1px solid ${T.border}`, cursor: 'pointer' }}
                    onClick={() => navigate(`/chef/decharges/${did}`)}
                  >
                    <td style={{ ...tdStyle, fontWeight: 600, fontFamily: 'monospace', color: T.blue }}>{_num(row)}</td>
                    <td style={tdStyle}>{fmtDate(_date(row))}</td>
                    <td style={{ ...tdStyle, fontSize: 13, color: T.textMuted }}>{articleResume(row.lignes)}</td>
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
                    <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button style={btnLink} onClick={() => navigate(`/chef/decharges/${did}`)}>
                          Voir
                        </button>
                        <button
                          style={btnOutline}
                          onClick={(e) => { e.stopPropagation(); downloadDechargePdf(did); }}
                        >
                          Imprimer
                        </button>
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
const thStyle    = { padding: '10px 12px', fontWeight: 600, color: T.textMuted, fontSize: 13 };
const tdStyle    = { padding: '10px 12px', color: T.textMid };
const btnBase    = { border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', lineHeight: '18px' };
const btnLink    = { ...btnBase, background: 'transparent', color: T.lightBlue, textDecoration: 'underline' };
const btnOutline = { ...btnBase, border: `1px solid ${T.border}`, background: T.bgWhite, color: T.textMid };
