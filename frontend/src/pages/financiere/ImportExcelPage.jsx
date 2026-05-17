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
      const s = getImportStatus(query.state.data?.data);
      return s === 'en_attente' || s === 'brouillon' || !s ? 3000 : false;
    },
    staleTime: 0,
  });

  const importData = importQuery.data?.data;
  const importStatus = getImportStatus(importData);
  const isSent = importStatus === 'en_revision' || importStatus === 'valide';
  const isReviewReady = importStatus === 'en_attente' || importStatus === 'brouillon';
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

  const headerDisplay = useMemo(() => ({
    reference: pickValue(importData, ['reference_document', 'referenceDocument', 'reference'], '') || pickValue(marcheData, ['reference'], ''),
    fournisseur: pickValue(importData, ['fournisseur_denomination', 'fournisseurDenomination'], '') || pickValue(marcheFournisseur, ['nom_societe', 'nomSociete'], ''),
    telephone: pickValue(importData, ['fournisseur_telephone', 'fournisseurTelephone'], '') || pickValue(marcheFournisseur, ['telephone'], ''),
    email: pickValue(importData, ['fournisseur_email', 'fournisseurEmail'], '') || pickValue(marcheFournisseur, ['email'], ''),
    adresse: pickValue(importData, ['fournisseur_adresse', 'fournisseurAdresse'], '') || pickValue(marcheFournisseur, ['adresse'], ''),
    delai: pickValue(importData, ['delai_execution', 'delaiExecution'], ''),
  }), [importData, marcheData, marcheFournisseur]);

  const normalizedRows = useMemo(() => stagingItems.map((item) => ({
    id: pickValue(item, ['id_staging', 'idStaging', 'id'], null),
    designation: pickValue(item, ['designation_brute', 'designationBrute', 'designation_normalisee', 'designationNormalisee', 'designation'], '-'),
    description: pickValue(item, ['description'], '-'),
    quantite: pickValue(item, ['quantite', 'quantity'], '-'),
    prixUnitaire: pickValue(item, ['prix_unitaire_ht', 'prixUnitaireHt', 'unit_price_ht', 'unitPriceHt'], null),
    prixTotal: pickValue(item, ['prix_total_ht', 'prixTotalHt', 'total_price_ht', 'totalPriceHt'], null),
  })), [stagingItems]);

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
    if (importStatus === 'en_attente' || importStatus === 'brouillon') {
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
    if (importStatus === 'en_revision' || importStatus === 'valide') return 'Import envoyé au gestionnaire.';
    if (uploadState === 'done') return 'Extraction terminée — en attente de validation financière.';
    if (uploadState === 'error') return 'Extraction rejetée.';
    return '';
  }, [importStatus, uploadMutation.isPending, uploadState]);

  async function handleStartExtraction() {
    if (!file) { toast.error('Veuillez sélectionner un fichier .xlsx ou .pdf.'); return; }
    setUploadState('uploading');
    const formData = new FormData();
    formData.append('fichier_excel', file);
    formData.append('source_type', sourceType);
    await uploadMutation.mutateAsync(formData);
  }

  async function handleSendToGestionnaire() {
    if (!importId) return;
    try { await sendMutation.mutateAsync(); } catch { /* handled in mutation onError */ }
  }

  return (
    <div style={{ display: 'grid', gap: 16, paddingBottom: 40 }}>
      {/* ── Header ── */}
      <div style={{ background: T.bgWhite, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FileSpreadsheet size={24} color={T.blue} />
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: T.textDark }}>
              Extraction de données
            </h2>
            <p style={{ margin: '6px 0 0', color: T.textMuted, fontSize: 13 }}>
              Déposez votre fichier .xlsx ou .pdf puis lancez directement l'extraction IA.
            </p>
          </div>
        </div>
      </div>

      {/* ── Upload card ── */}
      <div style={{ background: T.bgWhite, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: '20px 24px' }}>

        {/* Dropzone */}
        <div
          {...dropzone.getRootProps()}
          style={{
            border: `2px dashed ${dropzone.isDragActive ? T.lightBlue : T.border}`,
            borderRadius: T.radius,
            padding: 28,
            textAlign: 'center',
            background: dropzone.isDragActive ? '#eff6ff' : T.bgSubtle,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          <input {...dropzone.getInputProps()} />
          <div style={{ display: 'grid', placeItems: 'center', gap: 10 }}>
            <UploadCloud size={34} color={dropzone.isDragActive ? T.lightBlue : T.textMuted} />
            <div style={{ fontSize: 13, color: file ? T.textDark : T.textMuted, fontWeight: file ? 600 : 400 }}>
              {file
                ? `Fichier sélectionné : ${file.name}`
                : 'Glisser-déposer un fichier .xlsx/.pdf ou cliquer pour sélectionner'}
            </div>
          </div>
        </div>

        {/* Source type */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
            Type de source
          </div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {[
              { value: 'marche', label: 'Marché' },
              { value: 'bon_commande', label: 'Bon de commande' },
              { value: 'donation', label: 'Donation' },
            ].map(({ value, label }) => (
              <label key={value} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: T.textDark, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="source_type"
                  value={value}
                  checked={sourceType === value}
                  onChange={(e) => setSourceType(e.target.value)}
                  style={{ accentColor: T.blue }}
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        {/* Status + action */}
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {statusText ? (
            <div style={{
              fontSize: 13, fontWeight: 500,
              color: uploadState === 'error' ? '#b91c1c' : T.textMid,
              background: uploadState === 'error' ? '#fee2e2' : T.bgSubtle,
              border: `1px solid ${uploadState === 'error' ? '#fca5a5' : T.border}`,
              borderRadius: T.radiusSm, padding: '6px 12px',
            }}>
              {statusText}
            </div>
          ) : <div />}
          <Button
            onClick={handleStartExtraction}
            disabled={!file || uploadMutation.isPending || uploadState === 'extracting'}
          >
            Lancer l'extraction
          </Button>
        </div>
      </div>

      {/* ── Review card ── */}
      <div style={{ background: T.bgWhite, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: '20px 24px' }}>
        {isSent ? (
          <>
            <h2 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 700, color: T.textDark }}>Import soumis</h2>
            <div style={{ fontSize: 13, color: T.textMid }}>
              {importStatus === 'valide'
                ? 'Les données extraites ont été validées par le gestionnaire.'
                : 'Import envoyé au gestionnaire — en cours de révision dans Données Extraites.'}
            </div>
          </>
        ) : (
          <>
            <h2 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700, color: T.textDark }}>Données extraites</h2>

            {!importId ? (
              <div style={{ fontSize: 13, color: T.textMuted }}>
                Lancez une extraction pour afficher le tableau de révision financière.
              </div>
            ) : !isReviewReady ? (
              <div style={{ fontSize: 13, color: T.textMuted }}>
                Extraction en cours... le tableau apparaîtra automatiquement dès que l'extraction sera terminée.
              </div>
            ) : (
              <>
                {getImportObservations(importData) && (
                  <div style={{
                    marginBottom: 14, fontSize: 13, color: '#92400e',
                    background: '#fffbeb', border: '1px solid #fde68a',
                    borderRadius: T.radiusSm, padding: '8px 12px',
                  }}>
                    Observation : {getImportObservations(importData)}
                  </div>
                )}

                {/* Meta grid */}
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 10, marginBottom: 16, fontSize: 13,
                }}>
                  {[
                    ['Titre', pickValue(importData, ['titre_fichier', 'titreFichier'], '-')],
                    ['Référence', headerDisplay.reference || '-'],
                    ['Fournisseur', headerDisplay.fournisseur || '-'],
                    ['Téléphone', headerDisplay.telephone || '-'],
                    ['Email', headerDisplay.email || '-'],
                    ['Adresse', headerDisplay.adresse || '-'],
                    ['Délai / livraison', headerDisplay.delai || '-'],
                  ].map(([label, val]) => (
                    <div key={label} style={{ background: T.bgSubtle, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, padding: '8px 12px' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 13, color: T.textDark, fontWeight: 500 }}>{val}</div>
                    </div>
                  ))}
                </div>

                {/* Items table */}
                {stagingQuery.isLoading ? (
                  <div style={{ fontSize: 13, color: T.textMuted }}>Chargement des articles extraits...</div>
                ) : stagingItems.length === 0 ? (
                  <div style={{ fontSize: 13, color: T.textMuted }}>Aucun article extrait.</div>
                ) : (
                  <div style={{ overflowX: 'auto', border: `1px solid ${T.border}`, borderRadius: T.radiusSm }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
                      <thead>
                        <tr>
                          {['Désignation', 'Description', 'Quantité', 'PU HT', 'PT HT'].map((h) => (
                            <th key={h} style={thStyle}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {normalizedRows.map((item, index) => (
                          <tr key={item.id || `row-${index}`} style={{ borderTop: `1px solid ${T.border}` }}>
                            <td style={{ ...tdStyle, fontWeight: 600, color: T.textDark }}>{item.designation || '-'}</td>
                            <td style={{ ...tdStyle, color: T.textMid }}>{item.description}</td>
                            <td style={{ ...tdStyle, color: T.textMid }}>{item.quantite ?? '-'}</td>
                            <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12 }}>{formatMoney(item.prixUnitaire)}</td>
                            <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: T.textDark }}>{formatMoney(item.prixTotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    onClick={handleSendToGestionnaire}
                    disabled={
                      sendMutation.isPending ||
                      !isReviewReady ||
                      stagingItems.length === 0
                    }
                  >
                    Valider et envoyer au gestionnaire
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const thStyle = { padding: '9px 12px', fontSize: 12, fontWeight: 700, color: T.textMuted, textAlign: 'left', borderBottom: `1px solid ${T.border}`, background: T.bgSubtle };
const tdStyle = { padding: '10px 12px', fontSize: 13, color: T.textMid, verticalAlign: 'top' };
