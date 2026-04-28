import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';

import { downloadPdf, getDechargeById, getSignatureDetail } from '../../api/decharge';
import { getDemandeById } from '../../api/requests';

function StatutBadge({ statut }) {
  const map = {
    non_generee: { bg: '#fef3c7', color: '#92400e', label: 'Non signé' },
    en_attente:  { bg: '#fef3c7', color: '#92400e', label: 'Non signé' },
    signe:       { bg: '#d1fae5', color: '#065f46', label: 'Signé' },
    valide:      { bg: '#d1fae5', color: '#065f46', label: 'Validé' },
    rejete:      { bg: '#fee2e2', color: '#991b1b', label: 'Rejeté' },
  };
  const tone = map[statut] || map.non_generee;
  return (
    <span className="status-chip" style={{ background: tone.bg, color: tone.color }}>
      {tone.label}
    </span>
  );
}

export default function ChefDechargeDetailPage() {
  const { id } = useParams();

  const dechargeQuery = useQuery({
    queryKey: ['decharge', 'chef-detail', id],
    queryFn: () => getDechargeById(id),
    staleTime: 30000,
  });

  const signatureQuery = useQuery({
    queryKey: ['decharge', 'chef-signature', id],
    queryFn: () => getSignatureDetail(id),
    staleTime: 30000,
  });

  const demandeQuery = useQuery({
    queryKey: ['demandes', 'chef-linked', dechargeQuery.data?.data?.id_demande],
    queryFn: () => getDemandeById(dechargeQuery.data?.data?.id_demande),
    enabled: Boolean(dechargeQuery.data?.data?.id_demande),
    staleTime: 30000,
  });

  if (dechargeQuery.isLoading) {
    return <div style={{ height: 220, borderRadius: 12, background: '#f3f4f6' }} />;
  }

  const decharge = dechargeQuery.data?.data;
  const signature = signatureQuery.data?.data;
  const demande = demandeQuery.data?.data;

  if (!decharge) {
    return <div style={{ color: '#b91c1c' }}>Décharge introuvable.</div>;
  }

  const lignes = decharge.lignes || [];
  const serviceNom = demande?.service?.nom_service || '—';
  const isSigned = ['signe', 'valide'].includes(decharge.statut_signature);

  async function handleDownload() {
    try {
      const response = await downloadPdf(id);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `decharge-${decharge.numero_decharge}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('PDF non disponible.');
    }
  }

  return (
    <div className="page-stack">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>{decharge.numero_decharge}</h1>
        <Link to="/chef/decharges">← Retour</Link>
      </div>

      <section className="section-shell">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>Référence</div>
            <div style={{ fontWeight: 600 }}>{decharge.numero_decharge}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>Demande</div>
            <div>#{decharge.id_demande}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>Date</div>
            <div>{decharge.date_generation ? new Date(decharge.date_generation).toLocaleDateString('fr-FR') : '—'}</div>
          </div>
        </div>
      </section>

      <section className="section-shell">
        <h3 className="section-title">Articles</h3>
        <table className="data-table" style={{ fontSize: 14 }}>
          <thead>
            <tr>
              <th>Désignation</th>
              <th>N° inventaire</th>
              <th>Qté</th>
              <th>Affectation</th>
            </tr>
          </thead>
          <tbody>
            {lignes.length === 0 ? (
              <tr>
                <td colSpan={4} className="empty-state">Aucun article.</td>
              </tr>
            ) : (
              lignes.map((ligne) => (
                <tr key={ligne.id_ligne_decharge}>
                  <td>{ligne.ressource?.designation || '—'}</td>
                  <td>
                    {ligne.type_ligne === 'bien_inventaire'
                      ? ligne.instance_ressource?.numero_inventaire || '—'
                      : '—'}
                  </td>
                  <td>{ligne.quantite}</td>
                  <td>{serviceNom}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="section-shell">
        <h3 className="section-title">Statut signature</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <StatutBadge statut={decharge.statut_signature} />
          {!isSigned && (
            <span style={{ color: '#92400e', fontSize: 14 }}>
              En attente de signature du gestionnaire
            </span>
          )}
          {isSigned && signature?.date_signature && (
            <span style={{ fontSize: 13, color: '#374151' }}>
              Signé le {new Date(signature.date_signature).toLocaleString('fr-FR')}
            </span>
          )}
        </div>
      </section>

      <section className="section-shell">
        <button className="btn btn-secondary" onClick={handleDownload}>
          Imprimer / Télécharger PDF
        </button>
      </section>
    </div>
  );
}
