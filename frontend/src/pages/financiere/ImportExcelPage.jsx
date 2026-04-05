import { useEffect, useMemo, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation, useQuery } from '@tanstack/react-query';
import { FileSpreadsheet, UploadCloud } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLocation } from 'react-router-dom';

import {
  getImportById,
  getMarcheDetail,
  getStagingItems,
  sendImportToGestionnaire,
  uploadExcelDirect,
} from '../../api/procurement';
import { Button } from '@/components/ui/button';

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

function getImportId(payload) {
  return payload?.id_import ?? payload?.idImport ?? null;
}

function getImportStatus(payload) {
  return payload?.statut_import ?? payload?.statutImport ?? null;
}

function getImportObservations(payload) {
  return payload?.observations ?? '';
}

function formatMoney(value) {
  if (value === null || value === undefined || value === '') return '-';
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) return '-';
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericValue);
}

export default function ImportExcelPage() {
  const location = useLocation();

  const [file, setFile] = useState(null);
  const [sourceType, setSourceType] = useState('marche');
  const [importId, setImportId] = useState(null);
  const [uploadState, setUploadState] = useState('idle');
  const handledStatusRef = useRef(false);

  const dropzone = useDropzone({
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/pdf': ['.pdf'],
    },
    multiple: false,
    onDropAccepted: (files) => setFile(files[0]),
    onDropRejected: () => {
      toast.error('Seuls les fichiers .xlsx et .pdf sont acceptés.');
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (formData) => uploadExcelDirect(formData),
    onSuccess: (response) => {
      const newImportId = getImportId(response.data);
      if (!newImportId) {
        toast.error("Réponse invalide de l'API d'import.");
        setUploadState('error');
        return;
      }
      handledStatusRef.current = false;
      setImportId(newImportId);
      setUploadState('extracting');
    },
    onError: () => {
      setUploadState('error');
      toast.error("Échec de l'upload du fichier.");
    },
  });

  const importQuery = useQuery({
    queryKey: ['procurement', 'import', 'direct', importId],
    queryFn: () => getImportById(importId),
    enabled: Boolean(importId),
    refetchInterval: (query) => {
      const status = getImportStatus(query.state.data?.data);
      return status === 'en_revision' || !status ? 3000 : false;
    },
    staleTime: 0,
  });

  const importData = importQuery.data?.data;
  const importStatus = getImportStatus(importData);
  const isReviewReady = importStatus === 'brouillon' || importStatus === 'valide';
  const marcheId = pickValue(importData, ['id_marche', 'idMarche'], null);

  const stagingQuery = useQuery({
    queryKey: ['procurement', 'staging', 'import', importId],
    queryFn: () => getStagingItems(importId),
    enabled: Boolean(importId) && isReviewReady,
    staleTime: 0,
  });

  const stagingItems = useMemo(() => {
    const payload = stagingQuery.data?.data;
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.results)) return payload.results;
    return [];
  }, [stagingQuery.data]);

  const marcheQuery = useQuery({
    queryKey: ['procurement', 'marche', marcheId],
    queryFn: () => getMarcheDetail(marcheId),
    enabled: Boolean(marcheId) && isReviewReady,
    staleTime: 0,
  });

  const marcheData = marcheQuery.data?.data;
  const marcheFournisseur = marcheData?.fournisseur;

  const headerDisplay = useMemo(() => {
    return {
      reference: pickValue(importData, ['reference_document', 'referenceDocument', 'reference'], '') || pickValue(marcheData, ['reference'], ''),
      fournisseur: pickValue(importData, ['fournisseur_denomination', 'fournisseurDenomination'], '') || pickValue(marcheFournisseur, ['nom_societe', 'nomSociete'], ''),
      telephone: pickValue(importData, ['fournisseur_telephone', 'fournisseurTelephone'], '') || pickValue(marcheFournisseur, ['telephone'], ''),
      email: pickValue(importData, ['fournisseur_email', 'fournisseurEmail'], '') || pickValue(marcheFournisseur, ['email'], ''),
      adresse: pickValue(importData, ['fournisseur_adresse', 'fournisseurAdresse'], '') || pickValue(marcheFournisseur, ['adresse'], ''),
      delai: pickValue(importData, ['delai_execution', 'delaiExecution'], ''),
    };
  }, [importData, marcheData, marcheFournisseur]);

  const normalizedRows = useMemo(() => {
    return stagingItems.map((item) => ({
      id: pickValue(item, ['id_staging', 'idStaging', 'id'], null),
      designation: pickValue(item, ['designation_brute', 'designationBrute', 'designation_normalisee', 'designationNormalisee', 'designation'], '-'),
      description: pickValue(item, ['description'], '-'),
      quantite: pickValue(item, ['quantite', 'quantity'], '-'),
      prixUnitaire: pickValue(item, ['prix_unitaire_ht', 'prixUnitaireHt', 'unit_price_ht', 'unitPriceHt'], null),
      prixTotal: pickValue(item, ['prix_total_ht', 'prixTotalHt', 'total_price_ht', 'totalPriceHt'], null),
    }));
  }, [stagingItems]);

  const sendMutation = useMutation({
    mutationFn: () => sendImportToGestionnaire(importId),
    onSuccess: async (response) => {
      const sentCount = response?.data?.notifications_sent ?? 0;
      toast.success(`Import envoyé (${sentCount} notification(s)).`);
      await Promise.all([importQuery.refetch(), stagingQuery.refetch()]);
      setUploadState('done');
    },
    onError: (error) => {
      const message = error?.response?.data?.detail || "Échec de l'envoi au gestionnaire.";
      toast.error(message);
    },
  });

  useEffect(() => {
    if (!importData || handledStatusRef.current) return;

    if (importStatus === 'brouillon') {
      handledStatusRef.current = true;
      setUploadState('done');
      toast.success('Extraction terminée. Vérifiez les données puis envoyez au gestionnaire.');
      return;
    }

    if (importStatus === 'valide') {
      handledStatusRef.current = true;
      setUploadState('done');
      return;
    }

    if (importStatus === 'rejete') {
      handledStatusRef.current = true;
      setUploadState('error');
      toast.error(getImportObservations(importData) || "Extraction rejetée. Vérifiez le fichier Excel.");
    }
  }, [importData, importStatus]);

  const statusText = useMemo(() => {
    if (uploadMutation.isPending) return 'Upload en cours...';
    if (uploadState === 'extracting') return 'Extraction en cours...';
    if (importStatus === 'valide') return 'Import validé et envoyé au gestionnaire.';
    if (uploadState === 'done') return 'Extraction terminée — en attente de validation financière.';
    if (uploadState === 'error') return 'Extraction rejetée.';
    return '';
  }, [importStatus, uploadMutation.isPending, uploadState]);

  async function handleStartExtraction() {
    if (!file) {
      toast.error('Veuillez sélectionner un fichier .xlsx ou .pdf.');
      return;
    }

    setUploadState('uploading');
    const formData = new FormData();
    formData.append('fichier_excel', file);
    formData.append('source_type', sourceType);

    await uploadMutation.mutateAsync(formData);
  }

  async function handleSendToGestionnaire() {
    if (!importId) return;
    try {
      await sendMutation.mutateAsync();
    } catch {
      // handled in mutation onError
    }
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <section style={heroStyle}>
        <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <FileSpreadsheet size={28} />
          Import Fichier — Service Financière
        </h1>
        <p style={{ margin: '6px 0 0', color: '#6b7280', fontSize: 14 }}>
          Déposez votre fichier .xlsx ou .pdf puis lancez directement l'extraction IA.
        </p>
      </section>

      <section style={cardStyle}>
        <div
          {...dropzone.getRootProps()}
          style={{
            border: '2px dashed #d1d5db',
            borderRadius: 12,
            padding: 24,
            textAlign: 'center',
            background: dropzone.isDragActive ? '#eff6ff' : '#fff',
            cursor: 'pointer',
          }}
        >
          <input {...dropzone.getInputProps()} />
          <div style={{ display: 'grid', placeItems: 'center', gap: 10 }}>
            <UploadCloud size={34} color="#4b5563" />
            <div style={{ fontSize: 14, color: '#374151' }}>
              {file
                ? `Fichier sélectionné: ${file.name}`
                : 'Glisser-déposer un fichier .xlsx/.pdf ou cliquer pour sélectionner'}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 13, color: '#4b5563', marginBottom: 8 }}>Type de source</div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <label style={radioLabelStyle}>
              <input
                type="radio"
                name="source_type"
                value="marche"
                checked={sourceType === 'marche'}
                onChange={(e) => setSourceType(e.target.value)}
              />
              Marché
            </label>
            <label style={radioLabelStyle}>
              <input
                type="radio"
                name="source_type"
                value="bon_commande"
                checked={sourceType === 'bon_commande'}
                onChange={(e) => setSourceType(e.target.value)}
              />
              Bon de commande
            </label>
            <label style={radioLabelStyle}>
              <input
                type="radio"
                name="source_type"
                value="donation"
                checked={sourceType === 'donation'}
                onChange={(e) => setSourceType(e.target.value)}
              />
              Donation
            </label>
          </div>
        </div>

        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 13, color: uploadState === 'error' ? '#b91c1c' : '#374151' }}>
            {statusText}
          </div>
          <Button onClick={handleStartExtraction} disabled={!file || uploadMutation.isPending || uploadState === 'extracting'}>
            Lancer l'extraction
          </Button>
        </div>
      </section>

      <section style={cardStyle}>
        {importStatus === 'valide' ? (
          <>
            <h2 style={{ margin: '0 0 10px', fontSize: 18 }}>Import soumis</h2>
            <div style={{ fontSize: 14, color: '#374151' }}>
              Les données extraites ont déjà été validées et envoyées au gestionnaire.
            </div>
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
              <Button onClick={() => navigate(`${basePrefix}/marches`)}>
                Voir les marchés
              </Button>
            </div>
          </>
        ) : (
          <>
            <h2 style={{ margin: '0 0 10px', fontSize: 18 }}>Données extraites</h2>

            {!importId ? (
          <div style={{ fontSize: 14, color: '#4b5563' }}>
            Lancez une extraction pour afficher le tableau de révision financière.
          </div>
        ) : !isReviewReady ? (
          <div style={{ fontSize: 14, color: '#4b5563' }}>
            Extraction en cours... le tableau apparaîtra automatiquement quand le statut passe à brouillon.
          </div>
        ) : (
          <>
            {getImportObservations(importData) ? (
              <div style={observationStyle}>Observation: {getImportObservations(importData)}</div>
            ) : null}

            <div style={metaGridStyle}>
              <div><strong>Titre:</strong> {pickValue(importData, ['titre_fichier', 'titreFichier'], '-')}</div>
              <div><strong>Référence:</strong> {headerDisplay.reference || '-'}</div>
              <div><strong>Fournisseur:</strong> {headerDisplay.fournisseur || '-'}</div>
              <div><strong>Téléphone:</strong> {headerDisplay.telephone || '-'}</div>
              <div><strong>Email:</strong> {headerDisplay.email || '-'}</div>
              <div><strong>Adresse:</strong> {headerDisplay.adresse || '-'}</div>
              <div><strong>Délai / livraison:</strong> {headerDisplay.delai || '-'}</div>
            </div>

            {stagingQuery.isLoading ? (
              <div style={{ fontSize: 14, color: '#4b5563' }}>Chargement des articles extraits...</div>
            ) : stagingItems.length === 0 ? (
              <div style={{ fontSize: 14, color: '#4b5563' }}>Aucun article extrait.</div>
            ) : (
              <div style={tableWrapperStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Désignation</th>
                      <th style={thStyle}>Description</th>
                      <th style={thStyle}>Quantité</th>
                      <th style={thStyle}>PU HT</th>
                      <th style={thStyle}>PT HT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {normalizedRows.map((item, index) => (
                      <tr key={item.id || `row-${index}`}>
                        <td style={tdStyle}>
                          <div>{item.designation || '-'}</div>
                        </td>
                        <td style={tdStyle}>{item.description}</td>
                        <td style={tdStyle}>{item.quantite ?? '-'}</td>
                        <td style={tdStyle}>{formatMoney(item.prixUnitaire)}</td>
                        <td style={tdStyle}>{formatMoney(item.prixTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                onClick={handleSendToGestionnaire}
                disabled={
                  sendMutation.isPending ||
                  importStatus !== 'brouillon' ||
                  stagingItems.length === 0
                }
              >
                {importStatus === 'valide' ? 'Déjà envoyé au gestionnaire' : 'Valider et envoyer au gestionnaire'}
              </Button>
            </div>
          </>
            )}
          </>
        )}
      </section>
    </div>
  );
}

const heroStyle = {
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  background: '#fff',
  padding: 14,
};

const cardStyle = {
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  background: '#fff',
  padding: 14,
};

const radioLabelStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 14,
  color: '#111827',
};

const metaGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 10,
  marginBottom: 12,
  fontSize: 14,
  color: '#111827',
};

const observationStyle = {
  marginBottom: 12,
  fontSize: 13,
  color: '#92400e',
  background: '#fffbeb',
  border: '1px solid #fde68a',
  borderRadius: 8,
  padding: '8px 10px',
};

const tableWrapperStyle = {
  overflowX: 'auto',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
};

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  minWidth: 680,
};

const thStyle = {
  textAlign: 'left',
  background: '#f9fafb',
  borderBottom: '1px solid #e5e7eb',
  padding: '10px 12px',
  fontSize: 13,
  color: '#374151',
};

const tdStyle = {
  borderBottom: '1px solid #f3f4f6',
  padding: '10px 12px',
  fontSize: 13,
  color: '#111827',
  verticalAlign: 'top',
};
