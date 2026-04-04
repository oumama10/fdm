import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';

import {
  downloadPdf,
  getDechargeById,
  getSignatureDetail,
  regeneratePdf,
  rejeterSignature,
  validerSignature,
} from '../../api/decharge';
import { getDemandeById } from '../../api/requests';

export default function DechargeDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();

  const dechargeQuery = useQuery({
    queryKey: ['decharge', 'detail', id],
    queryFn: () => getDechargeById(id),
    staleTime: 30000,
  });

  const signatureQuery = useQuery({
    queryKey: ['decharge', 'signature', id],
    queryFn: () => getSignatureDetail(id),
    staleTime: 30000,
  });

  const demandeQuery = useQuery({
    queryKey: ['demandes', 'linked-to-decharge', dechargeQuery.data?.data?.id_demande],
    queryFn: () => getDemandeById(dechargeQuery.data?.data?.id_demande),
    enabled: Boolean(dechargeQuery.data?.data?.id_demande),
    staleTime: 30000,
  });

  const validateMutation = useMutation({
    mutationFn: () => validerSignature(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['decharge', 'detail', id] });
      queryClient.invalidateQueries({ queryKey: ['decharge', 'signature', id] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejeterSignature(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['decharge', 'detail', id] });
      queryClient.invalidateQueries({ queryKey: ['decharge', 'signature', id] });
    },
  });

  const regenerateMutation = useMutation({ mutationFn: () => regeneratePdf(id) });

  if (dechargeQuery.isLoading) {
    return <div style={{ height: 220, borderRadius: 12, background: '#f3f4f6' }} />;
  }

  const decharge = dechargeQuery.data?.data;
  const signature = signatureQuery.data?.data;
  const demande = demandeQuery.data?.data;

  if (!decharge) {
    return <div style={{ color: '#b91c1c' }}>Décharge introuvable.</div>;
  }

  async function handleDownload() {
    const response = await downloadPdf(id);
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = `decharge-${id}.pdf`;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <h1 style={{ margin: 0 }}>Décharge {decharge.numero_decharge}</h1>

      <section style={sectionStyle}>
        <div><strong>N°:</strong> {decharge.numero_decharge}</div>
        <div><strong>Date:</strong> {decharge.date_generation ? new Date(decharge.date_generation).toLocaleString('fr-FR') : '—'}</div>
        <div><strong>Service:</strong> {demande?.service?.nom_service || '—'}</div>
        <div><strong>Livré à:</strong> {decharge.id_livre_a || '—'}</div>
      </section>

      <section style={sectionStyle}>
        <h3 style={{ marginTop: 0 }}>Lignes</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
              <th style={thStyle}>Description</th>
              <th style={thStyle}>Quantité</th>
              <th style={thStyle}>N° inventaire</th>
            </tr>
          </thead>
          <tbody>
            {(decharge.lignes || []).map((line) => (
              <tr key={line.id_ligne_decharge} style={{ borderTop: '1px solid #f3f4f6' }}>
                <td style={tdStyle}>{line.ressource?.designation || '—'}</td>
                <td style={tdStyle}>{line.quantite}</td>
                <td style={tdStyle}>{line.instance_ressource?.numero_inventaire || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={sectionStyle}>
        <h3 style={{ marginTop: 0 }}>PDF</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={secondaryButton} onClick={handleDownload}>Télécharger PDF</button>
          <button style={secondaryButton} onClick={() => regenerateMutation.mutate()}>
            Régénérer PDF
          </button>
        </div>
      </section>

      <section style={sectionStyle}>
        <h3 style={{ marginTop: 0 }}>Signature</h3>
        {decharge.statut_signature === 'signe' ? (
          <>
            {signature?.fichier_scan_signe ? (
              <img
                src={signature.fichier_scan_signe}
                alt="scan signé"
                style={{ maxWidth: 220, maxHeight: 140, borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: 8 }}
              />
            ) : null}

            <div style={{ marginBottom: 8, fontSize: 13, color: '#374151' }}>
              Date signature: {signature?.date_signature ? new Date(signature.date_signature).toLocaleString('fr-FR') : '—'}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button style={greenButton} onClick={() => validateMutation.mutate()}>
                Valider
              </button>
              <button style={redButton} onClick={() => rejectMutation.mutate()}>
                Rejeter
              </button>
            </div>
          </>
        ) : (
          <div>Statut signature: {(decharge.statut_signature || '').replaceAll('_', ' ') || '—'}</div>
        )}
      </section>

      <section style={sectionStyle}>
        <h3 style={{ marginTop: 0 }}>Audit trail</h3>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>Date génération: {decharge.date_generation ? new Date(decharge.date_generation).toLocaleString('fr-FR') : '—'}</li>
          <li>Date signature: {signature?.date_signature ? new Date(signature.date_signature).toLocaleString('fr-FR') : '—'}</li>
          <li>Date validation: {signature?.date_validation_systeme ? new Date(signature.date_validation_systeme).toLocaleString('fr-FR') : '—'}</li>
        </ul>
      </section>

      <Link to="/gestionnaire/decharges">Retour décharges</Link>
    </div>
  );
}

const sectionStyle = {
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  background: '#fff',
  padding: 12,
};

const thStyle = { padding: 8, fontWeight: 600 };
const tdStyle = { padding: 8 };

const secondaryButton = {
  border: '1px solid #d1d5db',
  borderRadius: 8,
  padding: '7px 12px',
  background: '#fff',
  cursor: 'pointer',
};

const greenButton = {
  border: 'none',
  borderRadius: 8,
  padding: '7px 12px',
  background: '#16a34a',
  color: '#fff',
  cursor: 'pointer',
};

const redButton = {
  border: 'none',
  borderRadius: 8,
  padding: '7px 12px',
  background: '#dc2626',
  color: '#fff',
  cursor: 'pointer',
};
