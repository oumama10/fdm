import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { useMutation, useQuery } from '@tanstack/react-query';

import { getImportById, uploadExcel } from '../../api/procurement';

export default function ImportExcelModal({ marcheId, onClose, onDone, showReviewButton = true }) {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [sourceType, setSourceType] = useState('marche');
  const [uploadState, setUploadState] = useState('idle');
  const [importId, setImportId] = useState(null);
  const redirectTimerRef = useRef(null);

  const dropzone = useDropzone({
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    multiple: false,
    onDropAccepted: (files) => setFile(files[0]),
  });

  const uploadMutation = useMutation({
    mutationFn: (formData) => uploadExcel(formData),
    onSuccess: (response) => {
      setImportId(response.data.id_import);
      setUploadState('extracting');
      onDone?.(response.data);
    },
  });

  const importQuery = useQuery({
    queryKey: ['procurement', 'import', importId],
    queryFn: () => getImportById(importId),
    enabled: Boolean(importId),
    refetchInterval: (query) => {
      const status = query.state.data?.data?.statut_import;
      return status === 'en_revision' ? 3000 : false;
    },
    staleTime: 0,
  });

  const importData = importQuery.data?.data;

  useEffect(() => {
    if (!importData || !importId) return;

    if (importData.statut_import === 'brouillon' && uploadState !== 'ready') {
      setUploadState('ready');
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
      redirectTimerRef.current = setTimeout(() => {
        navigate(`/gestionnaire/staging/${importId}`);
      }, 1200);
    }
  }, [importData, importId, uploadState, navigate]);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  const statusText = useMemo(() => {
    if (uploadMutation.isPending) return 'Upload en cours...';
    if (uploadState === 'extracting') return 'Extraction IA en cours...';
    if (uploadState === 'ready') return 'Extraction terminée — redirection en cours...';
    if (importData?.statut_import === 'brouillon') {
      return `${importData.staging_items_count || 0} lignes extraites — Voir staging`;
    }
    return '';
  }, [uploadMutation.isPending, uploadState, importData]);

  async function handleSubmit() {
    if (!file || !marcheId) return;
    setUploadState('uploading');
    const formData = new FormData();
    formData.append('fichier_excel_original', file);
    formData.append('source_type', sourceType);
    formData.append('id_marche', String(marcheId));
    await uploadMutation.mutateAsync(formData);
  }

  return (
    <div style={backdropStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Importer Excel</h3>

        <div
          {...dropzone.getRootProps()}
          style={{
            border: '2px dashed #d1d5db',
            borderRadius: 10,
            padding: 18,
            background: dropzone.isDragActive ? '#eff6ff' : '#fff',
            cursor: 'pointer',
            marginBottom: 10,
          }}
        >
          <input {...dropzone.getInputProps()} />
          <div style={{ color: '#374151', fontSize: 14 }}>
            {file ? `Fichier sélectionné: ${file.name}` : 'Glisser-déposer un fichier .xlsx ou cliquer pour sélectionner'}
          </div>
        </div>

        <label style={{ display: 'grid', gap: 6, fontSize: 13, marginBottom: 12 }}>
          Source type
          <select value={sourceType} onChange={(e) => setSourceType(e.target.value)} style={inputStyle}>
            <option value="bc">bc</option>
            <option value="marche">marche</option>
            <option value="donation">donation</option>
          </select>
        </label>

        {statusText ? (
          <div style={{ marginBottom: 12, fontSize: 13, color: '#1f2937' }}>{statusText}</div>
        ) : null}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button style={secondaryButton} onClick={onClose}>Fermer</button>
          <button
            style={primaryButton}
            onClick={handleSubmit}
            disabled={!file || uploadMutation.isPending}
          >
            {uploadMutation.isPending ? 'Upload...' : 'Importer'}
          </button>
        </div>
      </div>
    </div>
  );
}

const backdropStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(17,24,39,0.45)',
  display: 'grid',
  placeItems: 'center',
  zIndex: 90,
};

const modalStyle = {
  width: 'min(560px, 92vw)',
  background: '#fff',
  borderRadius: 12,
  padding: 18,
};

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

const secondaryButton = {
  border: '1px solid #d1d5db',
  borderRadius: 8,
  padding: '8px 12px',
  background: '#fff',
  color: '#111827',
  cursor: 'pointer',
};
