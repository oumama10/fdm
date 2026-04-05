import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { getMarches } from '../../api/procurement';
import { useAuthStore } from '../../store/authStore';

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
  let color = '#15803d';
  if (value <= 7) color = '#b91c1c';
  else if (value <= 14) color = '#b45309';
  return <span style={{ color, fontWeight: 600 }}>{value} j</span>;
}

export default function MarchesListPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  const [filterType, setFilterType] = useState('');
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
      .filter((m) => (filterType ? m.type_acquisition === filterType : true))
      .filter((m) => (filterStatut ? m.statut === filterStatut : true))
      .filter((m) => (filterFournisseur ? String(m.id_fournisseur || '') === filterFournisseur : true))
      .map((m) => ({ ...m, delai_restant: daysRemaining(m.date_livraison_prevue) }));
  }, [marchesQuery.data?.data, filterType, filterStatut, filterFournisseur]);

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
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Marchés</h1>
        {canCreate ? (
          <button style={primaryButton} onClick={() => navigate(`${basePrefix}/marches/nouveau`)}>
            Nouveau Marché
          </button>
        ) : null}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <select style={inputStyle} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="">Tous types</option>
          <option value="marche">marche</option>
          <option value="bon_commande">bon_commande</option>
          <option value="donation">donation</option>
        </select>

        <select style={inputStyle} value={filterStatut} onChange={(e) => setFilterStatut(e.target.value)}>
          <option value="">Tous statuts</option>
          <option value="en_attente_livraison">en_attente_livraison</option>
          <option value="receptionne_et_stocke">receptionne_et_stocke</option>
          <option value="non_conforme">non_conforme</option>
        </select>

        <select
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

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
        {marchesQuery.isLoading ? (
          <div style={{ padding: 14 }}>
            <div style={{ height: 180, borderRadius: 8, background: '#f3f4f6' }} />
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                <th style={thStyle}>Titre</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Fournisseur</th>
                <th style={thStyle}>Statut</th>
                <th style={thStyle}>Date création</th>
                <th style={thStyle}>Délai restant</th>
              </tr>
            </thead>
            <tbody>
              {marchesWithExtractedInfo.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 16, color: '#6b7280' }}>Aucun marché trouvé.</td>
                </tr>
              ) : (
                marchesWithExtractedInfo.map((m) => (
                  <tr
                    key={m.id_marche}
                    style={{ cursor: 'pointer', borderTop: '1px solid #f3f4f6' }}
                    onClick={() => {
                      if (!m.id_marche) return;
                      navigate(`${basePrefix}/marches/${m.id_marche}`);
                    }}
                  >
                    <td style={tdStyle}>{m.titre_extrait}</td>
                    <td style={tdStyle}>{m.type_acquisition}</td>
                    <td style={tdStyle}>{m.fournisseur_extrait}</td>
                    <td style={tdStyle}>{m.statut}</td>
                    <td style={tdStyle}>{m.date_creation ? new Date(m.date_creation).toLocaleDateString('fr-FR') : '—'}</td>
                    <td style={tdStyle}><DelaiCell value={m.delai_restant} /></td>
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

const inputStyle = {
  border: '1px solid #d1d5db',
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 14,
};

const primaryButton = {
  border: 'none',
  borderRadius: 8,
  padding: '8px 12px',
  background: '#111827',
  color: '#fff',
  cursor: 'pointer',
};

const thStyle = { padding: 10, fontWeight: 600 };
const tdStyle = { padding: 10 };
