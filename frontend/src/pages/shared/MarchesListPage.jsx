import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { confirmerReception, getMarches } from '../../api/procurement';
import { useAuthStore } from '../../store/authStore';
import { MARCHE_STATUT_LABELS, TYPE_ACQUISITION_LABELS, StatusBadge } from '@/constants/statuts.jsx';

// ── Design tokens ──────────────────────────────────────────────────────────
const T = {
  blue: '#0C447C', lightBlue: '#1a7abf',
  textDark: '#0f172a', textMid: '#374151', textMuted: '#64748b',
  border: '#e2e8f0', bgWhite: '#ffffff', bgSubtle: '#f8fafc',
  radius: 12, radiusSm: 8,
};

function pickValue(obj, keys, fallback = '') {
  if (!obj) return fallback;
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && `${value}`.trim() !== '') return value;
  }
  return fallback;
}

function receptionDate(etapes) {
  if (!Array.isArray(etapes)) return null;
  const etape = etapes.find((e) => (e.nom_etape ?? e.nomEtape) === 'receptionne_magasin');
  return etape?.date_fin ?? etape?.dateFin ?? null;
}

export default function MarchesListPage({ fixedType = null }) {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  const [filterFournisseur, setFilterFournisseur] = useState('');
  const [filterDateFrom,    setFilterDateFrom]    = useState('');
  const [filterDateTo,      setFilterDateTo]      = useState('');
  const [showFilters,       setShowFilters]       = useState(false);

  const marchesQuery = useQuery({
    queryKey: ['procurement', 'marches', fixedType || ''],
    queryFn: () => getMarches(fixedType ? { type_acquisition: fixedType } : {}),
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const confirmerMutation = useMutation({
    mutationFn: (marcheId) => confirmerReception(marcheId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement', 'marches'] });
      queryClient.invalidateQueries({ queryKey: ['resources', 'stocks'] });
      queryClient.invalidateQueries({ queryKey: ['resources', 'instances'] });
      queryClient.invalidateQueries({ queryKey: ['resources', 'stock-summary'] });
    },
  });

  const role = user?.id_role?.nom_role || user?.role;
  const canCreate = role === 'gestionnaire_magasin' || role === 'service_financiere';
  const basePrefix = location.pathname.startsWith('/financiere') ? '/financiere' : '/gestionnaire';

  const pageTitle =
    fixedType === 'marche' ? 'Marchés' :
    fixedType === 'bon_commande' ? 'Bons de Commande' :
    fixedType === 'donation' ? 'Dons' : 'Marchés';
  const buttonLabel =
    fixedType === 'marche' ? 'Ajouter un marché' :
    fixedType === 'bon_commande' ? 'Ajouter un bon de commande' :
    fixedType === 'donation' ? 'Ajouter un don' : 'Nouveau Marché';

  const marches = useMemo(() => {
    const rows = marchesQuery.data?.data || [];
    const normalized = rows.map((m) => ({
      ...m,
      id_marche: m.id_marche ?? m.idMarche,
      type_acquisition: m.type_acquisition ?? m.typeAcquisition,
      id_fournisseur: m.id_fournisseur ?? m.idFournisseur,
      date_livraison_prevue: m.date_livraison_prevue ?? m.dateLivraisonPrevue,
      date_creation: m.date_creation ?? m.dateCreation,
      fournisseur: m.fournisseur ?? m.id_fournisseur ?? m.idFournisseur,
      import_excel: m.import_excel ?? m.importExcel ?? null,
    }));
    return normalized
      .filter((m) => (filterFournisseur ? String(m.id_fournisseur || '') === filterFournisseur : true))
      .filter((m) => (filterDateFrom ? m.date_creation >= filterDateFrom : true))
      .filter((m) => (filterDateTo   ? m.date_creation <= filterDateTo   : true))
      .map((m) => ({ ...m, date_reception: receptionDate(m.etapes) }));
  }, [marchesQuery.data?.data, filterFournisseur, filterDateFrom, filterDateTo]);

  const marchesWithExtractedInfo = useMemo(
    () =>
      marches.map((m) => ({
        ...m,
        titre_extrait:
          pickValue(m.import_excel, ['titre_fichier', 'titreFichier'], '') ||
          pickValue(m.import_excel, ['reference_document', 'referenceDocument', 'reference'], '') ||
          m.reference,
        fournisseur_extrait:
          pickValue(m.import_excel, ['fournisseur_denomination', 'fournisseurDenomination'], '') ||
          m.fournisseur?.nom_societe ||
          '—',
      })),
    [marches]
  );

  const fournisseurs = useMemo(() => {
    const map = new Map();
    (marchesQuery.data?.data || []).forEach((m) => {
      const fournisseurId = m.id_fournisseur ?? m.idFournisseur;
      const fournisseurNom = m.fournisseur?.nom_societe ?? m.fournisseur?.nomSociete;
      if (fournisseurId && fournisseurNom) map.set(String(fournisseurId), fournisseurNom);
    });
    return Array.from(map.entries()).map(([id, nom]) => ({ id, nom }));
  }, [marchesQuery.data?.data]);

  const IconFilter = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
    </svg>
  );

  return (
    <div style={{ display: 'grid', gap: 16, paddingBottom: 40 }}>
      {/* ── Header action ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: T.textDark, margin: 0 }}>{pageTitle}</h2>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            style={{
              ...btnSecondary,
              background: showFilters ? '#e2e8f0' : '#fff',
              color: T.textDark,
              border: `1px solid ${T.border}`,
              borderRadius: T.radiusSm,
              padding: '8px 16px',
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
          {canCreate && (
            <button
              style={btnPrimary}
              onClick={() => {
                const basePath = fixedType === 'bon_commande' ? 'bons-commande' : fixedType === 'donation' ? 'dons' : 'marches';
                navigate(`${basePrefix}/${basePath}/nouveau?type=${fixedType || 'marche'}`);
              }}
            >
              + {buttonLabel}
            </button>
          )}
        </div>
      </div>

      {/* ── Table shell ── */}
      <div style={tableShell}>

        {/* Toolbar / filters */}
        {showFilters && (
          <div style={toolbar}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <select style={selectStyle} value={filterFournisseur} onChange={(e) => setFilterFournisseur(e.target.value)}>
                <option value="">Tous fournisseurs</option>
                {fournisseurs.map((f) => (
                  <option key={f.id} value={f.id}>{f.nom}</option>
                ))}
              </select>
              <input
                type="date"
                style={selectStyle}
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                placeholder="Date début"
              />
              <input
                type="date"
                style={selectStyle}
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                placeholder="Date fin"
              />
            </div>
          </div>
        )}

        {/* Table */}
        {marchesQuery.isLoading ? (
          <div style={{ padding: '24px 16px', color: T.textMuted, fontSize: 13 }}>
            Chargement…
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Titre', 'Type', 'Fournisseur', 'Statut', 'Date création', 'Date de réception', 'Action'].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {marchesWithExtractedInfo.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '16px 12px', color: T.textMuted, fontSize: 13 }}>
                      Aucun marché trouvé.
                    </td>
                  </tr>
                ) : (
                  marchesWithExtractedInfo.map((m) => {
                    const isPending = m.statut === 'en_attente_livraison';
                    const isConfirming = confirmerMutation.isPending && confirmerMutation.variables === m.id_marche;
                    return (
                      <tr
                        key={m.id_marche}
                        style={{ cursor: 'pointer', borderTop: `1px solid ${T.border}`, transition: 'background 0.1s' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = T.bgSubtle; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
                        onClick={() => {
                          if (m.id_marche) {
                            const basePath = fixedType === 'bon_commande' ? 'bons-commande' : fixedType === 'donation' ? 'dons' : 'marches';
                            navigate(`${basePrefix}/${basePath}/${m.id_marche}`);
                          }
                        }}
                      >
                        <td style={{ ...tdStyle, fontWeight: 600, color: T.textDark }}>{m.titre_extrait || '—'}</td>
                        <td style={tdStyle}><StatusBadge map={TYPE_ACQUISITION_LABELS} value={m.type_acquisition} /></td>
                        <td style={{ ...tdStyle, color: T.textMid }}>{m.fournisseur_extrait}</td>
                        <td style={tdStyle}><StatusBadge map={MARCHE_STATUT_LABELS} value={m.statut} /></td>
                        <td style={{ ...tdStyle, color: T.textMid }}>
                          {m.date_creation ? new Date(m.date_creation).toLocaleDateString('fr-FR') : '—'}
                        </td>
                        <td style={{ ...tdStyle, color: T.textMid }}>
                          {m.date_reception ? new Date(m.date_reception).toLocaleDateString('fr-FR') : '—'}
                        </td>
                        <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                          {isPending && (
                            <button
                              style={btnConfirmer}
                              disabled={isConfirming}
                              onClick={() => confirmerMutation.mutate(m.id_marche)}
                            >
                              {isConfirming ? '…' : 'Confirmer réception'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const tableShell  = { border: `1px solid ${T.border}`, borderRadius: T.radius, overflow: 'hidden', background: T.bgWhite };
const toolbar     = { padding: '12px 16px', background: T.bgSubtle, borderBottom: `1px solid ${T.border}` };
const thStyle     = { padding: '9px 12px', fontSize: 12, fontWeight: 700, color: T.textMuted, textAlign: 'left', borderBottom: `1px solid ${T.border}`, background: T.bgSubtle };
const tdStyle     = { padding: '10px 12px', fontSize: 13, color: T.textMid, verticalAlign: 'middle' };
const selectStyle = { border: `1px solid ${T.border}`, borderRadius: T.radiusSm, padding: '7px 10px', fontSize: 13, color: T.textDark, background: T.bgWhite, width: '100%' };
const btnPrimary  = { border: 'none', borderRadius: T.radiusSm, padding: '8px 16px', background: T.blue, color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 };
const btnSecondary = { border: `1px solid ${T.border}`, borderRadius: T.radiusSm, padding: '8px 16px', background: '#fff', color: T.textDark, cursor: 'pointer', fontWeight: 600, fontSize: 13, display: 'inline-flex', alignItems: 'center' };
const btnConfirmer = { border: `1px solid #15803d`, borderRadius: T.radiusSm, padding: '5px 10px', background: '#f0fdf4', color: '#15803d', cursor: 'pointer', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' };
