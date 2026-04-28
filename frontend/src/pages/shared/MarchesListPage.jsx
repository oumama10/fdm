import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { getMarches } from '../../api/procurement';
import { useAuthStore } from '../../store/authStore';
import {
  MARCHE_STATUT_LABELS,
  StatusBadge,
  TYPE_ACQUISITION_LABELS,
} from '../../constants/statuts';

function pickValue(obj, keys, fallback = '') {
  if (!obj) return fallback;
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && `${value}`.trim() !== '') {
      return value;
    }
  }
  return fallback;
}

function daysRemaining(dateString) {
  if (!dateString) return null;
  const today = new Date();
  const target = new Date(dateString);
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

function DelaiCell({ value }) {
  if (value === null) return <span>—</span>;
  let color = 'var(--brand-700)';
  if (value < 10) color = '#dc2626';
  else if (value <= 30) color = '#d97706';
  return <span className="ref-mono" style={{ color, fontWeight: 500 }}>{value} j</span>;
}

function isValidatedForMarches(row) {
  const statutMarche = String(row?.statut || '').toLowerCase();
  const isInStock = statutMarche === 'receptionne_et_stocke';
  if (!isInStock) return false;

  const importExcel = row?.import_excel ?? row?.importExcel ?? null;
  if (!importExcel) {
    // Manual/legacy marches are visible once they are actually in stock.
    return true;
  }

  const statutImport = importExcel?.statut_import ?? importExcel?.statutImport ?? '';
  return String(statutImport).toLowerCase() === 'valide';
}

export default function MarchesListPage({ fixedType = '', pageTitle = 'Marchés' }) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  const [filterType, setFilterType] = useState(fixedType || '');
  const [filterStatut, setFilterStatut] = useState('');
  const [filterFournisseur, setFilterFournisseur] = useState('');

  const marchesQuery = useQuery({
    queryKey: ['procurement', 'marches'],
    queryFn: getMarches,
    staleTime: 30000,
  });

  const role = user?.id_role?.nom_role || user?.role;
  const canCreate = role === 'gestionnaire_magasin' || role === 'service_financiere';
  const basePrefix = location.pathname.startsWith('/financiere') ? '/financiere' : '/gestionnaire';

  const effectiveTypeFilter = fixedType || filterType;
  const createLabel = fixedType === 'bon_commande'
    ? 'Ajouter un bon de commande'
    : fixedType === 'donation'
      ? 'Ajouter un don'
      : 'Ajouter un marché';

  const createHref = fixedType
    ? `${basePrefix}/marches/nouveau?type=${fixedType}`
    : `${basePrefix}/marches/nouveau`;

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
      .filter((m) => isValidatedForMarches(m))
      .filter((m) => (effectiveTypeFilter ? m.type_acquisition === effectiveTypeFilter : true))
      .filter((m) => (filterStatut ? m.statut === filterStatut : true))
      .filter((m) => (filterFournisseur ? String(m.id_fournisseur || '') === filterFournisseur : true))
      .map((m) => ({ ...m, delai_restant: daysRemaining(m.date_livraison_prevue) }));
  }, [marchesQuery.data?.data, effectiveTypeFilter, filterStatut, filterFournisseur]);

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
      if (fournisseurId && fournisseurNom) {
        map.set(String(fournisseurId), fournisseurNom);
      }
    });
    return Array.from(map.entries()).map(([id, nom]) => ({ id, nom }));
  }, [marchesQuery.data?.data]);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>{pageTitle}</h1>
        {canCreate ? (
          <button
            className="btn btn-primary"
            onClick={() => navigate(createHref)}
          >
            {createLabel}
          </button>
        ) : null}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: fixedType ? '1fr 1fr' : '1fr 1fr 1fr', gap: 10, marginBottom: 4 }}>
        {!fixedType ? (
          <div>
            <label htmlFor="filter-type" style={labelStyle}>Type</label>
            <select id="filter-type" style={inputStyle} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="">Tous types</option>
              <option value="marche">Marché</option>
              <option value="bon_commande">Bon commande</option>
              <option value="donation">Don</option>
            </select>
          </div>
        ) : null}

        <div>
          <label htmlFor="filter-statut" style={labelStyle}>Statut</label>
          <select id="filter-statut" style={inputStyle} value={filterStatut} onChange={(e) => setFilterStatut(e.target.value)}>
            <option value="">Tous statuts</option>
            <option value="en_attente_livraison">En attente livraison</option>
            <option value="receptionne_et_stocke">Réceptionné et stocké</option>
            <option value="non_conforme">Non conforme</option>
          </select>
        </div>

        <div>
          <label htmlFor="filter-fournisseur" style={labelStyle}>Fournisseur</label>
          <select
            id="filter-fournisseur"
            style={inputStyle}
            value={filterFournisseur}
            onChange={(e) => setFilterFournisseur(e.target.value)}
          >
            <option value="">Tous fournisseurs</option>
            {fournisseurs.map((f) => (
              <option key={f.id} value={f.id}>{f.nom}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="data-table-wrap" aria-label="Tableau des marchés">
        {marchesQuery.isLoading ? (
          <div style={{ padding: 14 }}>
            <div style={{ height: 180, borderRadius: 8, background: '#f3f4f6' }} />
          </div>
        ) : (
          <table className="data-table" style={{ fontSize: 14 }}>
            <thead>
              <tr>
                <th>Titre</th>
                <th>Type</th>
                <th>Fournisseur</th>
                {fixedType === 'donation' ? <th>Donateur</th> : null}
                <th>Statut</th>
                <th>Date création</th>
                <th>Délai restant</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {marchesWithExtractedInfo.length === 0 ? (
                <tr>
                  <td colSpan={fixedType === 'donation' ? 8 : 7} style={{ padding: 16, color: '#6b7280' }}>Aucun marché validé et stocké trouvé.</td>
                </tr>
              ) : (
                marchesWithExtractedInfo.map((m) => (
                  <tr key={m.id_marche}>
                    <td>{m.titre_extrait}</td>
                    <td><StatusBadge map={TYPE_ACQUISITION_LABELS} value={m.type_acquisition} /></td>
                    <td>{m.fournisseur_extrait}</td>
                    {fixedType === 'donation' ? (
                      <td className="px-4 py-3">
                        <div className="text-[13px] font-medium text-ink">
                          {m.nom_donateur || '—'}
                        </div>
                        <div className="text-[10px] text-black/40 mt-0.5">
                          {m.type_donateur === 'interne' ? 'Interne' : m.type_donateur === 'externe' ? 'Externe' : '—'}
                        </div>
                      </td>
                    ) : null}
                    <td><StatusBadge map={MARCHE_STATUT_LABELS} value={m.statut} /></td>
                    <td><span className="ref-mono">{m.date_creation ? new Date(m.date_creation).toLocaleDateString('fr-FR') : '—'}</span></td>
                    <td><DelaiCell value={m.delai_restant} /></td>
                    <td>
                      <button
                        className="btn btn-secondary"
                        onClick={() => {
                          if (!m.id_marche) return;
                          navigate(`${basePrefix}/marches/${m.id_marche}`);
                        }}
                      >
                        Voir détails
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const labelStyle = {
  display: 'block',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'rgba(0,0,0,0.5)',
  marginBottom: 6,
};

const inputStyle = {
  border: '1px solid rgba(0,0,0,0.08)',
  borderRadius: 12,
  padding: '9px 12px',
  fontSize: 14,
  width: '100%',
  background: '#fff',
};
