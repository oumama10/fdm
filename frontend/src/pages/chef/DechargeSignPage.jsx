import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';

import { getDechargeById, uploadScan } from '../../api/decharge';

export default function DechargeSignPage() {
  const { id } = useParams();
  const [file, setFile] = useState(null);
  const [observation, setObservation] = useState('');
  const [success, setSuccess] = useState('');

  const dechargeQuery = useQuery({
    queryKey: ['decharge', 'chef-sign', id],
    queryFn: () => getDechargeById(id),
    staleTime: 30000,
  });

  const uploadMutation = useMutation({
    mutationFn: (formData) => uploadScan(id, formData),
    onSuccess: () => {
      setSuccess('Décharge envoyée au gestionnaire');
    },
  });

  const dropzone = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg', '.webp'],
    },
    multiple: false,
    onDropAccepted: (files) => setFile(files[0]),
  });

  const decharge = dechargeQuery.data?.data;
  const pdfUrl = decharge?.fichier_pdf || '';

  async function handleSubmit() {
    if (!file) return;
    const formData = new FormData();
    formData.append('fichier_scan_signe', file);
    if (observation.trim()) {
      formData.append('observation_chef', observation.trim());
    }
    await uploadMutation.mutateAsync(formData);
  }

  if (dechargeQuery.isLoading) {
    return <div style={{ height: 220, borderRadius: 12, background: '#f3f4f6' }} />;
  }

  if (!decharge) {
    return <div style={{ color: '#b91c1c' }}>Décharge introuvable.</div>;
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <h1 style={{ margin: 0 }}>Signer la décharge {decharge.numero_decharge}</h1>

      <section style={sectionStyle}>
        <p style={{ marginTop: 0, color: '#374151' }}>
          Imprimez, signez et re-scannez le document
        </p>
        {pdfUrl ? (
          <iframe title="pdf-preview" src={pdfUrl} style={{ width: '100%', height: 480, border: '1px solid #e5e7eb', borderRadius: 10 }} />
        ) : (
          <div style={{ color: '#6b7280' }}>PDF non disponible.</div>
        )}
      </section>

      <section style={sectionStyle}>
        <div
          {...dropzone.getRootProps()}
          style={{
            border: '2px dashed #d1d5db',
            borderRadius: 10,
            padding: 16,
            background: dropzone.isDragActive ? '#eff6ff' : '#fff',
            cursor: 'pointer',
          }}
        >
          <input {...dropzone.getInputProps()} />
          <div style={{ color: '#374151', fontSize: 14 }}>
            {file
              ? `Fichier sélectionné: ${file.name}`
              : 'Glisser-déposer le scan signé (image/*, .pdf)'}
          </div>
        </div>

        <label style={{ display: 'grid', gap: 6, marginTop: 10, fontSize: 13, color: '#374151' }}>
          Observation (optionnel)
          <textarea rows={3} value={observation} onChange={(e) => setObservation(e.target.value)} style={textareaStyle} />
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <button style={primaryButton} onClick={handleSubmit} disabled={!file || uploadMutation.isPending}>
            {uploadMutation.isPending ? 'Envoi...' : 'Envoyer le scan'}
          </button>
        </div>

        {success ? <div style={{ marginTop: 10, color: '#166534', fontWeight: 600 }}>{success}</div> : null}
      </section>
    </div>
  );
}

const sectionStyle = {
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  background: '#fff',
  padding: 12,
};

const textareaStyle = {
  border: '1px solid #d1d5db',
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 14,
  resize: 'vertical',
};

const primaryButton = {
  border: 'none',
  borderRadius: 8,
  padding: '8px 12px',
  background: '#111827',
  color: '#fff',
  cursor: 'pointer',
};
