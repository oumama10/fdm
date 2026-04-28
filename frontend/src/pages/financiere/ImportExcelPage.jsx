import { useEffect, useMemo, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation, useQuery } from '@tanstack/react-query';
import { FileSpreadsheet, UploadCloud } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLocation, useNavigate } from 'react-router-dom';

import {
  getImportById,
  getMarcheDetail,
  getStagingItems,
  sendImportToGestionnaire,
  updateImportById,
  updateStagingItem,
  uploadExcelDirect,
} from '../../api/procurement';
import { Button } from '@/components/ui/button';
import { IMPORT_STATUT_LABELS, StatusBadge } from '../../constants/statuts';

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
  const navigate = useNavigate();
  const isFinanciere = location.pathname.startsWith('/financiere');
  const roleLabel = isFinanciere ? 'Service Financière' : 'Gestionnaire Magasin';
  const basePrefix = isFinanciere ? '/financiere' : '/gestionnaire';

  const [file, setFile] = useState(null);
  const [sourceType, setSourceType] = useState('marche');
  const [importId, setImportId] = useState(null);
  const [uploadState, setUploadState] = useState('idle');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editableHeader, setEditableHeader] = useState({
    titre_fichier: '',
    reference_document: '',
    fournisseur_denomination: '',
    fournisseur_telephone: '',
    fournisseur_email: '',
    fournisseur_adresse: '',
    delai_execution: '',
  });
  const [editableRows, setEditableRows] = useState([]);
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
      return !status ? 3000 : false;
    },
    staleTime: 0,
  });

  const importData = importQuery.data?.data;
  const importStatus = getImportStatus(importData);
  const isReviewReady = Boolean(importStatus);
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
      designation: pickValue(item, ['designation_normalisee', 'designationNormalisee', 'designation_brute', 'designationBrute', 'designation'], '-'),
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

  const saveEditsMutation = useMutation({
    mutationFn: async () => {
      if (!importId) return;

      await updateImportById(importId, {
        titre_fichier: editableHeader.titre_fichier || '',
        reference_document: editableHeader.reference_document || '',
        fournisseur_denomination: editableHeader.fournisseur_denomination || '',
        fournisseur_telephone: editableHeader.fournisseur_telephone || '',
        fournisseur_email: editableHeader.fournisseur_email || '',
        fournisseur_adresse: editableHeader.fournisseur_adresse || '',
        delai_execution: editableHeader.delai_execution || '',
      });

      const updates = editableRows
        .filter((row) => row.id)
        .map((row) =>
          updateStagingItem(row.id, {
            designation_normalisee: row.designation || '',
            description: row.description || '',
            quantite: Number(row.quantite) || 1,
            prix_unitaire_ht: row.prixUnitaire === '' ? null : row.prixUnitaire,
            prix_total_ht: row.prixTotal === '' ? null : row.prixTotal,
          })
        );

      if (updates.length) {
        await Promise.all(updates);
      }
    },
    onSuccess: async () => {
      await Promise.all([importQuery.refetch(), stagingQuery.refetch()]);
      setIsEditModalOpen(false);
      toast.success('Informations extraites modifiées avec succès.');
    },
    onError: (error) => {
      const message = error?.response?.data?.detail || 'Échec de la modification des informations extraites.';
      toast.error(message);
    },
  });

  useEffect(() => {
    if (!importData || handledStatusRef.current) return;

    if (importStatus === 'en_attente') {
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

    if (importStatus === 'non_conforme' || importStatus === 'autre') {
      handledStatusRef.current = true;
      setUploadState('error');
      toast.error(getImportObservations(importData) || "Extraction rejetée. Vérifiez le fichier Excel.");
    }
  }, [importData, importStatus]);

  const statusText = useMemo(() => {
    if (uploadMutation.isPending) return 'Upload en cours...';
    if (uploadState === 'extracting' && !importStatus) return 'Extraction en cours...';
    if (importStatus === 'valide') return 'Import validé et envoyé au gestionnaire.';
    if (importStatus === 'en_attente' || uploadState === 'done') return 'Extraction terminée — prête à être envoyée au gestionnaire.';
    if (importStatus === 'en_revision') return 'Import envoyé au gestionnaire (en révision).';
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

  function openEditModal() {
    setEditableHeader({
      titre_fichier: pickValue(importData, ['titre_fichier', 'titreFichier'], ''),
      reference_document: headerDisplay.reference || '',
      fournisseur_denomination: headerDisplay.fournisseur || '',
      fournisseur_telephone: headerDisplay.telephone || '',
      fournisseur_email: headerDisplay.email || '',
      fournisseur_adresse: headerDisplay.adresse || '',
      delai_execution: headerDisplay.delai || '',
    });
    setEditableRows(
      normalizedRows.map((row) => ({
        id: row.id,
        designation: row.designation === '-' ? '' : row.designation,
        description: row.description === '-' ? '' : row.description,
        quantite: row.quantite === '-' ? 1 : row.quantite,
        prixUnitaire: row.prixUnitaire ?? '',
        prixTotal: row.prixTotal ?? '',
      }))
    );
    setIsEditModalOpen(true);
  }

  function updateEditableRow(index, patch) {
    setEditableRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <section className="card-surface" style={heroStyle}>
        <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--ink)' }}>
          <FileSpreadsheet size={28} />
          Import Fichier — {roleLabel}
        </h1>
        <p style={{ margin: '6px 0 0', color: '#6b7280', fontSize: 14 }}>
          Déposez votre fichier .xlsx ou .pdf puis lancez directement l'extraction IA.
        </p>
      </section>

      <section className="card-surface" style={cardStyle}>
        <div
          {...dropzone.getRootProps()}
          style={{
            border: '2px dashed rgba(0,0,0,0.2)',
            borderRadius: 24,
            padding: 48,
            textAlign: 'center',
            background: dropzone.isDragActive ? 'rgba(225,245,238,0.4)' : 'var(--surface)',
            cursor: 'pointer',
            transition: 'all 150ms ease',
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

      <section className="card-surface" style={cardStyle}>
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
            Extraction en cours... le tableau apparaîtra automatiquement.
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
              <div><strong>Statut:</strong> <StatusBadge map={IMPORT_STATUT_LABELS} value={importStatus} /></div>
            </div>

            {stagingQuery.isLoading ? (
              <div style={{ fontSize: 14, color: '#4b5563' }}>Chargement des articles extraits...</div>
            ) : stagingItems.length === 0 ? (
              <div style={{ fontSize: 14, color: '#4b5563' }}>Aucun article extrait.</div>
            ) : (
              <div className="data-table-wrap" style={tableWrapperStyle} aria-label="Tableau des données extraites">
                <table className="data-table" style={tableStyle}>
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
                    {normalizedRows.map((item, index) => (
                      <tr key={item.id || `row-${index}`}>
                        <td>
                          <div>{item.designation || '-'}</div>
                        </td>
                        <td>{item.description}</td>
                        <td className="ref-mono">{item.quantite ?? '-'}</td>
                        <td className="ref-mono">{formatMoney(item.prixUnitaire)}</td>
                        <td className="ref-mono">{formatMoney(item.prixTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <Button
                  variant="outline"
                  onClick={openEditModal}
                  disabled={importStatus !== 'en_attente' || stagingItems.length === 0}
                >
                  Modifier
                </Button>
                <Button
                  onClick={handleSendToGestionnaire}
                  disabled={
                    sendMutation.isPending ||
                    importStatus !== 'en_attente' ||
                    stagingItems.length === 0
                  }
                >
                  {importStatus === 'valide' ? 'Déjà envoyé au gestionnaire' : 'Valider et envoyer au gestionnaire'}
                </Button>
              </div>
            </div>

            {isEditModalOpen ? (
              <div style={modalOverlayStyle}>
                <div style={modalCardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>Modifier les informations extraites</h3>
                    <button style={closeButtonStyle} onClick={() => setIsEditModalOpen(false)}>Fermer</button>
                  </div>

                  <div style={modalSectionStyle}>
                    <h4 style={{ margin: '0 0 8px' }}>En-tête</h4>
                    <div style={modalHeaderGridStyle}>
                      <input style={modalInputStyle} placeholder="Titre" value={editableHeader.titre_fichier} onChange={(e) => setEditableHeader((s) => ({ ...s, titre_fichier: e.target.value }))} />
                      <input style={modalInputStyle} placeholder="Référence" value={editableHeader.reference_document} onChange={(e) => setEditableHeader((s) => ({ ...s, reference_document: e.target.value }))} />
                      <input style={modalInputStyle} placeholder="Fournisseur" value={editableHeader.fournisseur_denomination} onChange={(e) => setEditableHeader((s) => ({ ...s, fournisseur_denomination: e.target.value }))} />
                      <input style={modalInputStyle} placeholder="Téléphone" value={editableHeader.fournisseur_telephone} onChange={(e) => setEditableHeader((s) => ({ ...s, fournisseur_telephone: e.target.value }))} />
                      <input style={modalInputStyle} placeholder="Email" value={editableHeader.fournisseur_email} onChange={(e) => setEditableHeader((s) => ({ ...s, fournisseur_email: e.target.value }))} />
                      <input style={modalInputStyle} placeholder="Délai / livraison" value={editableHeader.delai_execution} onChange={(e) => setEditableHeader((s) => ({ ...s, delai_execution: e.target.value }))} />
                    </div>
                    <textarea style={{ ...modalInputStyle, minHeight: 72, resize: 'vertical' }} placeholder="Adresse" value={editableHeader.fournisseur_adresse} onChange={(e) => setEditableHeader((s) => ({ ...s, fournisseur_adresse: e.target.value }))} />
                  </div>

                  <div style={modalSectionStyle}>
                    <h4 style={{ margin: '0 0 8px' }}>Lignes extraites</h4>
                    <div style={{ maxHeight: 280, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            <th style={thStyle}>Désignation</th>
                            <th style={thStyle}>Description</th>
                            <th style={thStyle}>Qté</th>
                            <th style={thStyle}>PU HT</th>
                            <th style={thStyle}>PT HT</th>
                          </tr>
                        </thead>
                        <tbody>
                          {editableRows.map((row, index) => (
                            <tr key={row.id || index}>
                              <td style={tdStyle}><input style={modalInputStyle} value={row.designation} onChange={(e) => updateEditableRow(index, { designation: e.target.value })} /></td>
                              <td style={tdStyle}><textarea style={{ ...modalInputStyle, minHeight: 56, resize: 'vertical' }} value={row.description} onChange={(e) => updateEditableRow(index, { description: e.target.value })} /></td>
                              <td style={tdStyle}><input type="number" min="1" style={modalInputStyle} value={row.quantite} onChange={(e) => updateEditableRow(index, { quantite: e.target.value })} /></td>
                              <td style={tdStyle}><input style={modalInputStyle} value={row.prixUnitaire} onChange={(e) => updateEditableRow(index, { prixUnitaire: e.target.value })} /></td>
                              <td style={tdStyle}><input style={modalInputStyle} value={row.prixTotal} onChange={(e) => updateEditableRow(index, { prixTotal: e.target.value })} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Annuler</Button>
                    <Button onClick={() => saveEditsMutation.mutate()} disabled={saveEditsMutation.isPending}>
                      {saveEditsMutation.isPending ? 'Enregistrement...' : 'Enregistrer les modifications'}
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
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

const modalOverlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(17, 24, 39, 0.45)',
  display: 'grid',
  placeItems: 'center',
  zIndex: 1000,
  padding: 16,
};

const modalCardStyle = {
  width: 'min(1100px, 96vw)',
  maxHeight: '90vh',
  overflow: 'auto',
  background: '#fff',
  borderRadius: 12,
  border: '1px solid #e5e7eb',
  padding: 16,
  display: 'grid',
  gap: 12,
};

const modalSectionStyle = {
  display: 'grid',
  gap: 10,
};

const modalHeaderGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 8,
};

const modalInputStyle = {
  width: '100%',
  border: '1px solid #d1d5db',
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 13,
  color: '#111827',
};

const closeButtonStyle = {
  border: '1px solid #d1d5db',
  background: '#fff',
  borderRadius: 8,
  padding: '6px 10px',
  cursor: 'pointer',
};
