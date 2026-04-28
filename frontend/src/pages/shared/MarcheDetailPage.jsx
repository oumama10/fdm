import { useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import {
  getImports,
  getMarcheDetail,
  getStagingItems,
} from '../../api/procurement';
import PageBackButton from '../../components/ui/PageBackButton';
import { useAuthStore } from '../../store/authStore';

function pickValue(obj, keys, fallback = null) {
  if (!obj) return fallback;
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && `${value}`.trim() !== '') {
      return value;
    }
  }
  return fallback;
}

function formatMoney(value) {
  if (value === null || value === undefined || value === '') return '—';
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) return '—';
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericValue);
}

export default function MarcheDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const location = useLocation();
  const basePrefix = location.pathname.startsWith('/financiere') ? '/financiere' : '/gestionnaire';
  const userRole = user?.id_role?.nom_role || user?.role;
  const isGestionnaire = userRole === 'gestionnaire_magasin' || userRole === 'admin';

  const marcheQuery = useQuery({
    queryKey: ['procurement', 'marche', id],
    queryFn: () => getMarcheDetail(id),
    staleTime: 30000,
  });

  const marche = marcheQuery.data?.data;
  const marcheId = Number(id);

  const importsQuery = useQuery({
    queryKey: ['procurement', 'imports', 'by-marche', marcheId],
    queryFn: () => getImports(),
    staleTime: 30000,
  });

  const relatedImportFromList = useMemo(() => {
    const payload = importsQuery.data?.data;
    const rows = Array.isArray(payload) ? payload : (Array.isArray(payload?.results) ? payload.results : []);
    return rows.find((row) => Number(pickValue(row, ['id_marche', 'idMarche'], 0)) === marcheId) || null;
  }, [importsQuery.data, marcheId]);

  const importExcel = marche?.import_excel || marche?.importExcel || relatedImportFromList || null;
  const importId = Number(pickValue(importExcel, ['id_import', 'idImport'], 0)) || null;

  const stagingQuery = useQuery({
    queryKey: ['procurement', 'staging', 'marche', importId],
    queryFn: () => getStagingItems(importId),
    enabled: Boolean(importId),
    staleTime: 30000,
  });

  const stagingItems = useMemo(() => {
    const payload = stagingQuery.data?.data;
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.results)) return payload.results;
    return [];
  }, [stagingQuery.data]);

  const normalizedRows = useMemo(
    () =>
      stagingItems.map((item, index) => ({
        key: pickValue(item, ['id_staging', 'idStaging', 'id'], `row-${index}`),
        designation: pickValue(
          item,
          ['designation_brute', 'designationBrute', 'designation_normalisee', 'designationNormalisee', 'designation'],
          '—'
        ),
        description: pickValue(item, ['description'], '—'),
        quantite: pickValue(item, ['quantite', 'quantity'], '—'),
        prixUnitaire: pickValue(item, ['prix_unitaire_ht', 'prixUnitaireHt'], null),
        prixTotal: pickValue(item, ['prix_total_ht', 'prixTotalHt'], null),
      })),
    [stagingItems]
  );


  if (marcheQuery.isLoading) {
    return <div style={{ height: 220, borderRadius: 10, background: '#f3f4f6' }} />;
  }

  if (!marche) {
    return <div style={{ color: '#b91c1c' }}>Marché introuvable.</div>;
  }

  const hideExtractedAfterSubmit = ['receptionne_et_stocke', 'non_conforme'].includes(marche?.statut);

  return (
    <div className="page-stack">
      <div style={pageHeaderStyle}>
        <PageBackButton to={`${basePrefix}/marches`} label="Marchés" hint="Revenir à la liste" />
        <div>
          <h1 className="page-title">Détail du marché</h1>
          <div style={{ marginTop: 4, color: '#64748b', fontSize: 13 }}>
            {marche?.statut ? `Statut actuel : ${marche.statut}` : 'Vue détaillée du marché et de ses données extraites.'}
          </div>
        </div>
      </div>

      {hideExtractedAfterSubmit ? (
        <section className="section-shell">
          <h3 className="section-title">Informations extraites</h3>
          <div style={{ color: '#6b7280' }}>
            Ces données ont déjà été soumises. Elles ne sont plus affichées dans cette étape.
          </div>
        </section>
      ) : importExcel ? (
        <section className="section-shell">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <h3 className="section-title" style={{ marginBottom: 0 }}>Informations extraites</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 12, fontSize: 14 }}>
            <div><strong>Titre:</strong> {pickValue(importExcel, ['titre_fichier', 'titreFichier'], '—')}</div>
            <div><strong>Référence:</strong> {pickValue(importExcel, ['reference_document', 'referenceDocument', 'reference'], '—')}</div>
            <div><strong>Fournisseur:</strong> {pickValue(importExcel, ['fournisseur_denomination', 'fournisseurDenomination'], '—')}</div>
            <div><strong>Téléphone:</strong> {pickValue(importExcel, ['fournisseur_telephone', 'fournisseurTelephone'], '—')}</div>
            <div><strong>Email:</strong> {pickValue(importExcel, ['fournisseur_email', 'fournisseurEmail'], '—')}</div>
            <div><strong>Adresse:</strong> {pickValue(importExcel, ['fournisseur_adresse', 'fournisseurAdresse'], '—')}</div>
            <div><strong>Délai / livraison:</strong> {pickValue(importExcel, ['delai_execution', 'delaiExecution'], '—')}</div>
          </div>

          {stagingQuery.isLoading ? (
            <div style={{ color: '#6b7280' }}>Chargement des lignes extraites...</div>
          ) : normalizedRows.length === 0 ? (
            <div style={{ color: '#6b7280' }}>Aucune ligne extraite.</div>
          ) : (
            <table className="data-table" style={{ fontSize: 14 }}>
              <thead>
                <tr>
                  <th>Désignation</th>
                  <th>Description</th>
                  <th>Quantité</th>
                  <th>PU HT</th>
                  <th>PT HT</th>
                </tr>
              </thead>
              <tbody>
                {normalizedRows.map((item) => (
                  <tr key={item.key}>
                    <td>{item.designation}</td>
                    <td>{item.description}</td>
                    <td>{item.quantite}</td>
                    <td>{formatMoney(item.prixUnitaire)}</td>
                    <td>{formatMoney(item.prixTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ) : (
        <section className="section-shell">
          <h3 className="section-title">Informations extraites</h3>
          <div style={{ color: '#6b7280' }}>Aucune information extraite pour ce marché.</div>
        </section>
      )}

    </div>
  );
}

const pageHeaderStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  padding: '4px 0',
};

