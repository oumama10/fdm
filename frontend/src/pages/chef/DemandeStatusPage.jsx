import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { downloadPdf, getDecharges } from '../../api/decharge';
import { getNotifications } from '../../api/alerts';
import { getDemandeById } from '../../api/requests';

const steps = ['Soumise', 'En cours', 'Validée', 'Décharge générée', 'Signée', 'Complète'];

function getStepIndex(demande, decharge) {
  if (!demande) return 0;
  if (!decharge) {
    if (demande.statut === 'validee') return 2;
    if (demande.statut === 'en_cours') return 1;
    if (demande.statut === 'refusee') return 1;
    return 0;
  }

  if (decharge.statut_signature === 'valide') return 5;
  if (decharge.statut_signature === 'signe') return 4;
  return 3;
}

export default function DemandeStatusPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const demandeQuery = useQuery({
    queryKey: ['chef', 'demande', id],
    queryFn: () => getDemandeById(id),
    staleTime: 30000,
  });

  const dechargesQuery = useQuery({
    queryKey: ['decharge', 'for-demande', id],
    queryFn: getDecharges,
    staleTime: 30000,
  });

  const notificationsQuery = useQuery({
    queryKey: ['alerts', 'notifications'],
    queryFn: getNotifications,
    staleTime: 30000,
  });

  const demande = demandeQuery.data?.data;
  const decharge = useMemo(() => {
    const rows = dechargesQuery.data?.data || [];
    return rows.find((d) => Number(d.id_demande) === Number(id));
  }, [dechargesQuery.data?.data, id]);

  const stepIndex = getStepIndex(demande, decharge);

  const notifHistory = useMemo(() => {
    const rows = notificationsQuery.data?.data || [];
    return rows
      .filter((n) => Number(n.object_id) === Number(id))
      .sort((a, b) => new Date(b.date_envoi || 0) - new Date(a.date_envoi || 0));
  }, [notificationsQuery.data?.data, id]);

  async function handleDownload() {
    if (!decharge?.id_decharge) return;
    const response = await downloadPdf(decharge.id_decharge);
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = `decharge-${decharge.id_decharge}.pdf`;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  }

  if (demandeQuery.isLoading) {
    return <div style={{ height: 220, borderRadius: 12, background: '#f3f4f6' }} />;
  }

  if (!demande) {
    return <div style={{ color: '#b91c1c' }}>Demande introuvable.</div>;
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <h1 style={{ margin: 0 }}>Statut demande #{demande.id_demande}</h1>

      <section style={sectionStyle}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 8 }}>
          {steps.map((step, index) => (
            <div key={step} style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  margin: '0 auto 6px',
                  background: index <= stepIndex ? '#111827' : '#e5e7eb',
                  color: index <= stepIndex ? '#fff' : '#6b7280',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {index + 1}
              </div>
              <div style={{ fontSize: 12, color: '#374151' }}>{step}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={sectionStyle}>
        <h3 style={{ marginTop: 0 }}>Articles demandés</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
              <th style={thStyle}>Article</th>
              <th style={thStyle}>Qté demandée</th>
              <th style={thStyle}>Qté accordée</th>
              <th style={thStyle}>Statut</th>
            </tr>
          </thead>
          <tbody>
            {(demande.lignes || []).map((line) => {
              const accordee = Number(line.quantite_accordee || 0);
              return (
                <tr key={line.id_ligne} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={tdStyle}>{line.ressource?.designation || '—'}</td>
                  <td style={tdStyle}>{line.quantite_demandee}</td>
                  <td style={tdStyle}>{accordee}</td>
                  <td style={tdStyle}>{accordee > 0 ? 'accordé' : 'non disponible'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {decharge ? (
        <section style={sectionStyle}>
          <h3 style={{ marginTop: 0 }}>Décharge</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button style={secondaryButton} onClick={handleDownload}>Télécharger décharge PDF</button>
            {decharge.statut_signature === 'en_attente' ? (
              <button
                style={primaryButton}
                onClick={() => navigate(`/chef/decharges/${decharge.id_decharge}/signer`)}
              >
                Uploader scan signé
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      <section style={sectionStyle}>
        <h3 style={{ marginTop: 0 }}>Historique notifications</h3>
        {notifHistory.length === 0 ? (
          <div style={{ color: '#6b7280' }}>Aucune notification liée.</div>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {notifHistory.map((n) => (
              <li key={n.id_notification} style={{ marginBottom: 6 }}>
                <strong>{n.titre}</strong>
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                  {n.date_envoi ? new Date(n.date_envoi).toLocaleString('fr-FR') : '—'}
                </div>
              </li>
            ))}
          </ul>
        )}
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

const thStyle = { padding: 10, fontWeight: 600 };
const tdStyle = { padding: 10 };

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
  cursor: 'pointer',
};
