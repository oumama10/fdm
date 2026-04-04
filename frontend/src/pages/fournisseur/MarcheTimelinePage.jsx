import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { getEtapes, getLotsByMarche, getMarcheDetail } from '../../api/procurement';

const STEP_LABELS = {
  attestation_non_faillite: 'Attestation de non-faillite',
  publication_journal: 'Publication au journal',
  publication_bulletin: 'Publication au bulletin',
  ouverture_plis: 'Ouverture des plis',
  commission: 'Commission d’évaluation',
  approbation: 'Approbation',
  notification: 'Notification',
  bon_commande: 'Bon de commande',
};

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('fr-FR');
}

function contractDelayLabel(typeAcquisition) {
  if (typeAcquisition === 'marche') return '90 jours (marché public)';
  if (typeAcquisition === 'bon_commande') return '40 jours (bon de commande)';
  return 'Aucun délai (donation)';
}

function computeRemainingDays(dateValue) {
  if (!dateValue) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(dateValue);
  target.setHours(0, 0, 0, 0);

  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

function remainingDaysTone(days) {
  if (typeof days !== 'number') return { color: '#6b7280' };
  if (days <= 7) return { color: '#b91c1c' };
  if (days <= 14) return { color: '#b45309' };
  return { color: '#166534' };
}

function humanizeStepName(stepName) {
  if (!stepName) return 'Étape';
  if (STEP_LABELS[stepName]) return STEP_LABELS[stepName];
  const label = stepName.replaceAll('_', ' ').trim();
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function statusTone(statut) {
  if (statut === 'complete') {
    return { bg: '#dcfce7', color: '#166534', symbol: '✓' };
  }
  if (statut === 'en_cours') {
    return { bg: '#f3e8ff', color: '#7e22ce', symbol: '➜' };
  }
  if (statut === 'bloque') {
    return { bg: '#fee2e2', color: '#b91c1c', symbol: '✕' };
  }
  return { bg: '#e5e7eb', color: '#4b5563', symbol: null };
}

function badgeTone(statut) {
  if (statut === 'receptionne_et_stocke') return { bg: '#dcfce7', color: '#14532d' };
  if (statut === 'non_conforme') return { bg: '#fee2e2', color: '#991b1b' };
  if (statut === 'en_attente_livraison') return { bg: '#dbeafe', color: '#1e3a8a' };
  return { bg: '#e5e7eb', color: '#374151' };
}

function currentStepIndex(orderedEtapes) {
  const inProgress = orderedEtapes.findIndex((step) => step.statut === 'en_cours' || step.statut === 'bloque');
  if (inProgress !== -1) return inProgress;

  const pending = orderedEtapes.findIndex((step) => step.statut === 'en_attente');
  if (pending !== -1) return pending;

  return orderedEtapes.length - 1;
}

export default function MarcheTimelinePage() {
  const { id } = useParams();

  const marcheQuery = useQuery({
    queryKey: ['procurement', 'marche', id, 'fournisseur'],
    queryFn: () => getMarcheDetail(id),
    staleTime: 30000,
  });

  const etapesQuery = useQuery({
    queryKey: ['procurement', 'etapes', id, 'fournisseur'],
    queryFn: () => getEtapes(id),
    staleTime: 30000,
  });

  const lotsQuery = useQuery({
    queryKey: ['procurement', 'lots', id, 'fournisseur'],
    queryFn: () => getLotsByMarche(id),
    staleTime: 30000,
  });

  const marche = marcheQuery.data?.data;
  const orderedEtapes = useMemo(() => {
    const raw = etapesQuery.data?.data || marche?.etapes || [];
    return [...raw].sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
  }, [etapesQuery.data?.data, marche?.etapes]);
  const lots = lotsQuery.data?.data || [];
  const joursRestants = computeRemainingDays(marche?.date_livraison_prevue);
  const joursRestantsStyle = remainingDaysTone(joursRestants);

  const currentIndex = currentStepIndex(orderedEtapes);

  if (marcheQuery.isLoading) {
    return <div style={{ height: 220, borderRadius: 10, background: '#f3f4f6' }} />;
  }

  if (!marche) {
    return <div style={{ color: '#b91c1c' }}>Marché introuvable.</div>;
  }

  const statutStyle = badgeTone(marche.statut);

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <section style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <h1 style={{ margin: 0 }}>{marche.reference || '—'}</h1>
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={badgeStyle}>{(marche.type_acquisition || '—').replaceAll('_', ' ')}</span>
              <span style={{ fontSize: 13, color: '#4b5563' }}>Créé le {formatDate(marche.date_creation)}</span>
            </div>
          </div>

          <span
            style={{
              borderRadius: 999,
              padding: '4px 10px',
              fontSize: 12,
              fontWeight: 600,
              background: statutStyle.bg,
              color: statutStyle.color,
              textTransform: 'capitalize',
            }}
          >
            {(marche.statut || '').replaceAll('_', ' ')}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
          <div style={infoBoxStyle}>
            <div style={infoLabelStyle}>Délai contractuel</div>
            <div style={infoValueStyle}>{contractDelayLabel(marche.type_acquisition)}</div>
          </div>
          <div style={infoBoxStyle}>
            <div style={infoLabelStyle}>Date livraison prévue</div>
            <div style={infoValueStyle}>{formatDate(marche.date_livraison_prevue)}</div>
          </div>
        </div>
      </section>

      <section style={cardStyle}>
        <h3 style={{ marginTop: 0, marginBottom: 10 }}>Timeline des étapes</h3>
        <div style={{ marginBottom: 12, fontSize: 13, color: '#374151' }}>
          <div>Échéance: {formatDate(marche.date_livraison_prevue)}</div>
          <div style={{ ...joursRestantsStyle, fontWeight: 600 }}>
            Jours restants: {typeof joursRestants === 'number' ? joursRestants : '—'}
          </div>
        </div>

        {etapesQuery.isLoading ? (
          <div style={{ height: 160, borderRadius: 8, background: '#f3f4f6' }} />
        ) : orderedEtapes.length === 0 ? (
          <div style={{ color: '#6b7280' }}>Aucune étape.</div>
        ) : (
          <div style={{ display: 'grid', gap: 0 }}>
            {orderedEtapes.map((step, index) => {
              const tone = statusTone(step.statut);
              const started = step.statut && step.statut !== 'en_attente';
              const isComplete = step.statut === 'complete';
              const connectorGreen = index < currentIndex;
              const showConnector = index < orderedEtapes.length - 1;

              return (
                <div key={step.id_etape || `${step.ordre}-${step.nom_etape}`} style={{ display: 'grid', gridTemplateColumns: '44px 1fr', gap: 10 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        display: 'grid',
                        placeItems: 'center',
                        fontWeight: 700,
                        fontSize: 12,
                        background: tone.bg,
                        color: tone.color,
                        border: '1px solid #d1d5db',
                      }}
                    >
                      {tone.symbol || step.ordre || index + 1}
                    </div>
                    {showConnector ? (
                      <div
                        style={{
                          width: 3,
                          flex: 1,
                          minHeight: 34,
                          marginTop: 4,
                          borderRadius: 999,
                          background: connectorGreen ? '#16a34a' : '#d1d5db',
                        }}
                      />
                    ) : null}
                  </div>

                  <div style={{ paddingBottom: showConnector ? 10 : 0 }}>
                    <div style={{ fontWeight: 600, color: '#111827' }}>{humanizeStepName(step.nom_etape)}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                      {isComplete
                        ? `Date fin: ${formatDate(step.date_fin)}`
                        : started
                        ? `Date début: ${formatDate(step.date_debut)}`
                        : 'En attente'}
                    </div>
                    {step.commentaire ? (
                      <div style={{ marginTop: 6, fontSize: 13, color: '#374151' }}>{step.commentaire}</div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section style={cardStyle}>
        <h3 style={{ marginTop: 0, marginBottom: 10 }}>Lots</h3>

        {lotsQuery.isLoading ? (
          <div style={{ height: 120, borderRadius: 8, background: '#f3f4f6' }} />
        ) : lots.length === 0 ? (
          <div style={{ color: '#6b7280' }}>Aucun lot.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                <th style={thStyle}>Désignation</th>
                <th style={thStyle}>Qté commandée</th>
                <th style={thStyle}>Qté reçue</th>
              </tr>
            </thead>
            <tbody>
              {lots.map((lot) => (
                <tr key={lot.id_lot || `${lot.designation}-${lot.numero_lot || ''}`} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={tdStyle}>{lot.designation || '—'}</td>
                  <td style={tdStyle}>{lot.quantite_commandee ?? '—'}</td>
                  <td style={tdStyle}>{lot.quantite_recue ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

const cardStyle = {
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: 14,
  background: '#fff',
};

const badgeStyle = {
  borderRadius: 999,
  padding: '4px 10px',
  fontSize: 12,
  fontWeight: 600,
  background: '#ede9fe',
  color: '#5b21b6',
  textTransform: 'capitalize',
};

const infoBoxStyle = {
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  padding: 10,
  background: '#fafafa',
};

const infoLabelStyle = {
  fontSize: 12,
  color: '#6b7280',
};

const infoValueStyle = {
  marginTop: 4,
  fontSize: 14,
  color: '#111827',
  fontWeight: 600,
};

const thStyle = { padding: 8, fontWeight: 600 };
const tdStyle = { padding: 8 };
