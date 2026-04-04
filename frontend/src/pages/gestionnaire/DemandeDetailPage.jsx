import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getDemandeById, refuserDemande, validerDemande } from '../../api/requests';
import { getInstances, getStock } from '../../api/resources';
import DemandeRefuseModal from './DemandeRefuseModal';

function Badge({ value, type }) {
  const urgencyColors = {
    normal: { bg: '#e5e7eb', color: '#111827' },
    moyen: { bg: '#fcd34d', color: '#78350f' },
    urgent: { bg: '#fecaca', color: '#991b1b' },
  };
  const statusColors = {
    en_cours: { bg: '#dbeafe', color: '#1e3a8a' },
    validee: { bg: '#bbf7d0', color: '#14532d' },
    refusee: { bg: '#fecaca', color: '#991b1b' },
    complete: { bg: '#99f6e4', color: '#134e4a' },
    complete_avec_decharge: { bg: '#99f6e4', color: '#134e4a' },
  };

  const palette = type === 'urgence' ? urgencyColors : statusColors;
  const tone = palette[value] || { bg: '#e5e7eb', color: '#374151' };

  return (
    <span style={{ borderRadius: 999, padding: '4px 8px', background: tone.bg, color: tone.color, fontSize: 12, fontWeight: 600 }}>
      {String(value || '').replaceAll('_', ' ')}
    </span>
  );
}

function Progress({ value }) {
  const pct = Math.max(0, Math.min(100, Number(value || 0)));
  return (
    <div style={{ minWidth: 170 }}>
      <div style={{ height: 8, background: '#e5e7eb', borderRadius: 999 }}>
        <div style={{ height: 8, width: `${pct}%`, borderRadius: 999, background: '#2563eb' }} />
      </div>
      <div style={{ fontSize: 12, color: '#374151', marginTop: 4 }}>{pct}%</div>
    </div>
  );
}

export default function DemandeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showRefuseModal, setShowRefuseModal] = useState(false);

  const demandeQuery = useQuery({
    queryKey: ['demandes', 'detail', id],
    queryFn: () => getDemandeById(id),
    staleTime: 30000,
  });

  const stockQuery = useQuery({ queryKey: ['resources', 'stocks'], queryFn: getStock, staleTime: 30000 });
  const instancesQuery = useQuery({ queryKey: ['resources', 'instances'], queryFn: getInstances, staleTime: 30000 });

  const validateMutation = useMutation({
    mutationFn: validerDemande,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demandes', 'detail', id] });
      queryClient.invalidateQueries({ queryKey: ['demandes', 'list'] });
    },
  });

  const refuseMutation = useMutation({
    mutationFn: ({ demandeId, commentaire }) => refuserDemande(demandeId, commentaire),
    onSuccess: () => {
      setShowRefuseModal(false);
      queryClient.invalidateQueries({ queryKey: ['demandes', 'detail', id] });
      queryClient.invalidateQueries({ queryKey: ['demandes', 'list'] });
    },
  });

  const demande = demandeQuery.data?.data;

  const stockMap = useMemo(() => {
    const map = new Map();
    (stockQuery.data?.data || []).forEach((row) => {
      map.set(Number(row.id_ressource), Number(row.quantite_disponible || 0));
    });
    return map;
  }, [stockQuery.data?.data]);

  const instanceCountMap = useMemo(() => {
    const map = new Map();
    (instancesQuery.data?.data || []).forEach((row) => {
      if (row.statut === 'en_stock') {
        const key = Number(row.id_ressource);
        map.set(key, (map.get(key) || 0) + 1);
      }
    });
    return map;
  }, [instancesQuery.data?.data]);

  const timeline = useMemo(() => {
    if (!demande) return [];
    const base = [
      {
        label: 'Demande soumise',
        date: demande.date_demande,
        status: 'en_cours',
      },
    ];

    if (demande.statut === 'validee' && demande.date_validation) {
      base.push({ label: 'Demande validée', date: demande.date_validation, status: 'validee' });
    }
    if (demande.statut === 'refusee') {
      base.push({ label: 'Demande refusée', date: demande.date_validation || demande.date_demande, status: 'refusee' });
    }
    return base;
  }, [demande]);

  if (demandeQuery.isLoading) {
    return <div style={{ height: 240, background: '#f3f4f6', borderRadius: 12 }} />;
  }

  if (!demande) {
    return <div style={{ color: '#b91c1c' }}>Demande introuvable.</div>;
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 14, background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0 }}>Demande #{demande.id_demande}</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <Badge type="urgence" value={demande.urgence} />
            <Badge type="statut" value={demande.statut} />
          </div>
        </div>
        <div style={{ marginTop: 8, color: '#374151', fontSize: 14 }}>
          Demandeur: <strong>{demande.chef_demandeur?.nom_complet || '—'}</strong>
          {' · '}
          Service: <strong>{demande.service?.nom_service || '—'}</strong>
          {' · '}
          Date: <strong>{demande.date_demande ? new Date(demande.date_demande).toLocaleString('fr-FR') : '—'}</strong>
        </div>
      </div>

      <section style={sectionStyle}>
        <h3 style={{ marginTop: 0, marginBottom: 10 }}>Lignes de demande</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
              <th style={thStyle}>Article</th>
              <th style={thStyle}>Catégorie</th>
              <th style={thStyle}>Qté demandée</th>
              <th style={thStyle}>Disponibilité</th>
            </tr>
          </thead>
          <tbody>
            {(demande.lignes || []).map((ligne) => {
              const isCons = ligne.ressource?.categorie_nom === 'Consommable';
              const stockNow = isCons
                ? stockMap.get(Number(ligne.id_ressource)) || 0
                : instanceCountMap.get(Number(ligne.id_ressource)) || 0;

              return (
                <tr key={ligne.id_ligne} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={tdStyle}>{ligne.ressource?.designation || '—'}</td>
                  <td style={tdStyle}>{ligne.ressource?.categorie_nom || '—'}</td>
                  <td style={tdStyle}>{ligne.quantite_demandee}</td>
                  <td style={tdStyle}>
                    <div style={{ display: 'grid', gap: 2 }}>
                      <Progress value={ligne.disponibilite_pct} />
                      <span style={{ fontSize: 12, color: '#6b7280' }}>
                        Stock actuel: ({stockNow})
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {demande.statut === 'en_cours' ? (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            style={greenButton}
            onClick={() => validateMutation.mutate(demande.id_demande)}
            disabled={validateMutation.isPending}
          >
            {validateMutation.isPending ? 'Validation...' : 'Valider la demande'}
          </button>
          <button style={redButton} onClick={() => setShowRefuseModal(true)}>
            Refuser
          </button>
        </div>
      ) : null}

      {demande.statut === 'validee' ? (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            style={primaryButton}
            onClick={() => navigate(`/gestionnaire/decharges/creer/${demande.id_demande}`)}
          >
            Créer la décharge
          </button>
        </div>
      ) : null}

      <section style={sectionStyle}>
        <h3 style={{ marginTop: 0, marginBottom: 10 }}>Historique statut</h3>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {timeline.map((item, index) => (
            <li key={`${item.label}-${index}`} style={{ marginBottom: 8 }}>
              <strong>{item.label}</strong>
              <div style={{ fontSize: 13, color: '#6b7280' }}>
                {item.date ? new Date(item.date).toLocaleString('fr-FR') : '—'}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {showRefuseModal ? (
        <DemandeRefuseModal
          onClose={() => setShowRefuseModal(false)}
          onSubmit={(commentaire) =>
            refuseMutation.mutate({ demandeId: demande.id_demande, commentaire })
          }
          isSubmitting={refuseMutation.isPending}
        />
      ) : null}
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

const greenButton = {
  border: 'none',
  borderRadius: 8,
  padding: '8px 12px',
  background: '#16a34a',
  color: '#fff',
  cursor: 'pointer',
};

const redButton = {
  border: 'none',
  borderRadius: 8,
  padding: '8px 12px',
  background: '#dc2626',
  color: '#fff',
  cursor: 'pointer',
};
