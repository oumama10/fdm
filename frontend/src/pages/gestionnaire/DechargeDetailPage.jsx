import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';

import {
  downloadPdf,
  getDechargeById,
  getSignatureDetail,
  regeneratePdf,
  validerSignature,
} from '../../api/decharge';
import { getDemandeById } from '../../api/requests';

function StatutBadge({ statut }) {
  const map = {
    non_generee: { bg: '#fef3c7', color: '#92400e', label: 'PDF en attente' },
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

  const signerMutation = useMutation({
    mutationFn: () => validerSignature(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['decharge', 'detail', id] });
      queryClient.invalidateQueries({ queryKey: ['decharge', 'signature', id] });
      queryClient.invalidateQueries({ queryKey: ['decharge', 'list'] });
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

  const serviceNom = demande?.service?.nom_service || '—';
  const lignes = decharge.lignes || [];

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
      alert('PDF non disponible. Veuillez régénérer le PDF.');
    }
  }

  return (
    <div className="page-stack">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>{decharge.numero_decharge}</h1>
        <Link to="/gestionnaire/decharges">← Retour liste</Link>
      </div>

      <section className="section-shell">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>Référence décharge</div>
            <div style={{ fontWeight: 600 }}>{decharge.numero_decharge}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>Demande liée</div>
            <Link to={`/gestionnaire/demandes/${decharge.id_demande}`}>#{decharge.id_demande}</Link>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>Service demandeur</div>
            <div>{serviceNom}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>Date génération</div>
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
        <h3 className="section-title">Signature</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <StatutBadge statut={decharge.statut_signature} />
          {signature?.date_signature && (
            <span style={{ fontSize: 13, color: '#374151' }}>
              Signé le {new Date(signature.date_signature).toLocaleString('fr-FR')}
            </span>
          )}
          {decharge.statut_signature === 'en_attente' && (
            <button
              className="btn"
              style={{ background: '#0f6e56', color: '#fff' }}
              onClick={() => signerMutation.mutate()}
              disabled={signerMutation.isPending}
            >
              {signerMutation.isPending ? 'Signature...' : 'Signer la décharge'}
            </button>
          )}
        </div>
      </section>

      <section className="section-shell">
        <h3 className="section-title">Document PDF</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={handleDownload}>
            Imprimer / Télécharger PDF
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => regenerateMutation.mutate()}
            disabled={regenerateMutation.isPending}
          >
            {regenerateMutation.isPending ? 'Génération...' : 'Régénérer PDF'}
          </button>
        </div>
      </section>
    </div>
  );
}
