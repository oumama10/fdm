import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { getImports } from '../../api/procurement';
import { IMPORT_STATUT_LABELS, StatusBadge } from '@/constants/statuts.jsx';

// ── Design tokens ──────────────────────────────────────────────────────────
const T = {
  blue: '#0C447C', lightBlue: '#1a7abf',
  textDark: '#0f172a', textMid: '#374151', textMuted: '#64748b',
  border: '#e2e8f0', bgWhite: '#ffffff', bgSubtle: '#f8fafc',
  radius: 12, radiusSm: 8,
};

// Only imports that have been sent to the gestionnaire belong here.
const POST_ENVOI = new Set(['en_revision', 'valide', 'rejete', 'non_conforme', 'autre']);
const ACTIONABLE = new Set(['en_revision']);

export default function DonneesExtraitesPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('');

  const importsQuery = useQuery({
    queryKey: ['procurement', 'imports', 'donnees-extraites'],
    queryFn: () => getImports({ scope: 'extraites' }),
    staleTime: 0,
    refetchOnMount: true,
  });

  const imports = useMemo(() => {
    // Backend already scopes to POST_ENVOI; client guard keeps it clean on stale cache.
    const all = (importsQuery.data?.data || []).filter(
      (r) => POST_ENVOI.has(r.statutImport ?? r.statut_import)
    );
    if (!statusFilter) return all;
    return all.filter((r) => (r.statutImport ?? r.statut_import) === statusFilter);
  }, [importsQuery.data?.data, statusFilter]);

  return (
    <div style={{ display: 'grid', gap: 16, paddingBottom: 40 }}>
      {/* ── Filter toolbar ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <select
          style={{ ...selectStyle, width: 200 }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Tous statuts</option>
          <option value="en_revision">En révision</option>
          <option value="valide">Validé</option>
          <option value="rejete">Rejeté</option>
        </select>
      </div>

      {/* ── Table shell ── */}
      <div style={tableShell}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['ID import', 'Référence', 'Fournisseur', 'Statut', 'Articles', 'Date import', 'Date traitement', 'Action'].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {importsQuery.isLoading ? (
                <tr><td colSpan={8} style={{ padding: '16px 12px', color: T.textMuted }}>Chargement…</td></tr>
              ) : imports.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: '16px 12px', color: T.textMuted }}>Aucune donnée extraite.</td></tr>
              ) : imports.map((row) => {
                const rowId = row.idImport ?? row.id_import;
                const ref = row.referenceDocument ?? row.reference_document;
                const titre = row.titreFichier ?? row.titre_fichier;
                const fournisseur = row.fournisseurDenomination ?? row.fournisseur_denomination;
                const statut = row.statutImport ?? row.statut_import;
                const count = row.stagingItemsCount ?? row.staging_items_count ?? 0;
                const dateImport = row.dateImport ?? row.date_import;
                const dateTraitement = row.dateTraitement ?? row.date_traitement ?? dateImport;
                const isActionable = ACTIONABLE.has(statut);
                return (
                  <tr
                    key={rowId}
                    style={{ borderTop: `1px solid ${T.border}` }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = T.bgSubtle; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
                  >
                    <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12, color: T.textMuted }}>
                      #{rowId}
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 600, color: T.textDark }}>{ref || titre || '—'}</td>
                    <td style={{ ...tdStyle, color: T.textMid }}>{fournisseur || '—'}</td>
                    <td style={tdStyle}>
                      <StatusBadge map={IMPORT_STATUT_LABELS} value={statut} />
                    </td>
                    <td style={{ ...tdStyle, color: T.textMid }}>{count}</td>
                    <td style={{ ...tdStyle, color: T.textMid }}>
                      {dateImport ? new Date(dateImport).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td style={{ ...tdStyle, color: T.textMid }}>
                      {dateTraitement ? new Date(dateTraitement).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td style={tdStyle}>
                      <button
                        type="button"
                        style={isActionable ? btnReviser : btnVoir}
                        onClick={() => navigate(`/gestionnaire/donnees-extraites/${rowId}`)}
                      >
                        {isActionable ? 'Réviser →' : 'Voir →'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const tableShell  = { border: `1px solid ${T.border}`, borderRadius: T.radius, overflow: 'hidden', background: T.bgWhite };
const thStyle     = { padding: '9px 12px', fontSize: 12, fontWeight: 700, color: T.textMuted, textAlign: 'left', borderBottom: `1px solid ${T.border}`, background: T.bgSubtle };
const tdStyle     = { padding: '10px 12px', fontSize: 13, color: T.textMid, verticalAlign: 'middle' };
const selectStyle = { border: `1px solid ${T.border}`, borderRadius: T.radiusSm, padding: '7px 10px', fontSize: 13, color: T.textDark, background: T.bgWhite };
const btnReviser  = { border: `1px solid ${T.lightBlue}`, borderRadius: T.radiusSm, padding: '5px 12px', background: T.bgWhite, color: T.lightBlue, cursor: 'pointer', fontWeight: 600, fontSize: 12 };
const btnVoir     = { border: `1px solid ${T.border}`, borderRadius: T.radiusSm, padding: '5px 12px', background: T.bgWhite, color: T.textMuted, cursor: 'pointer', fontWeight: 600, fontSize: 12 };
