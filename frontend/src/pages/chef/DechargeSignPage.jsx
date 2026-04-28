import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';

import { getDechargeById } from '../../api/decharge';

export default function DechargeSignPage() {
  const { id } = useParams();
  const dechargeQuery = useQuery({
    queryKey: ['decharge', 'chef-sign', id],
    queryFn: () => getDechargeById(id),
    staleTime: 30000,
  });

  const decharge = dechargeQuery.data?.data;
  const pdfUrl = decharge?.fichier_pdf || '';

  if (dechargeQuery.isLoading) {
    return <div style={{ height: 220, borderRadius: 12, background: '#f3f4f6' }} />;
  }

  if (!decharge) {
    return <div style={{ color: '#b91c1c' }}>Décharge introuvable.</div>;
  }

  return (
    <div className="page-stack">
      <h1 className="page-title">Décharge {decharge.numero_decharge}</h1>

      <section className="section-shell">
        <p style={{ marginTop: 0, color: '#374151' }}>
          Imprimez, signez le document en papier, puis transmettez-le au gestionnaire pour validation.
        </p>
        {pdfUrl ? (
          <iframe title="pdf-preview" src={pdfUrl} style={{ width: '100%', height: 480, border: '1px solid #e5e7eb', borderRadius: 10 }} />
        ) : (
          <div style={{ color: '#6b7280' }}>PDF non disponible.</div>
        )}
      </section>

      <section className="section-shell">
        <div style={{ color: '#374151', fontSize: 14 }}>
          Le chef de service n'envoie plus de scan. La signature est confirmée par le gestionnaire dans le système, puis le stock et les ressources sont mis à jour automatiquement.
        </div>
      </section>
    </div>
  );
}
