import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getMouvements } from '../../api/resources';
import { createRetour } from '../../api/returns';

function RetourCreateModal({ instance, onClose }) {
  const queryClient = useQueryClient();
  const [motif_retour, setMotifRetour] = useState('panne');
  const [observation, setObservation] = useState('');

  const createMutation = useMutation({
    mutationFn: createRetour,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources', 'instances'] });
      onClose();
    },
  });

  return (
    <div style={backdropStyle} onClick={onClose}>
      <div style={innerModalStyle} onClick={(event) => event.stopPropagation()}>
        <h4 style={{ marginTop: 0 }}>Créer retour</h4>
        <div style={{ display: 'grid', gap: 10 }}>
          <label style={labelStyle}>
            Motif
            <select
              value={motif_retour}
              onChange={(e) => setMotifRetour(e.target.value)}
              style={inputStyle}
            >
              <option value="panne">Panne</option>
              <option value="inutilise">Inutilisé</option>
              <option value="endommage">Endommagé</option>
              <option value="autre">Autre</option>
            </select>
          </label>

          <label style={labelStyle}>
            Observation
            <textarea
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button style={secondaryButton} onClick={onClose}>
            Annuler
          </button>
          <button
            style={primaryButton}
            onClick={() =>
              createMutation.mutate({
                id_ressource: instance.id_ressource,
                id_instance_ressource: instance.id_instance,
                motif_retour,
                observation,
              })
            }
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? 'Création...' : 'Créer retour'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InstanceDetailModal({ instance, onClose }) {
  const [showRetourModal, setShowRetourModal] = useState(false);

  const mouvementsQuery = useQuery({
    queryKey: ['resources', 'mouvements', 'instance', instance?.id_instance],
    queryFn: () => getMouvements({ id_ressource: instance.id_ressource }),
    enabled: Boolean(instance?.id_instance),
    staleTime: 30000,
  });

  const history = useMemo(() => {
    const rows = mouvementsQuery.data?.data || [];
    return rows
      .filter((m) => Number(m.id_instance_ressource) === Number(instance?.id_instance))
      .sort((a, b) => new Date(b.date_mouvement || 0) - new Date(a.date_mouvement || 0))
      .slice(0, 5);
  }, [mouvementsQuery.data?.data, instance?.id_instance]);

  if (!instance) return null;

  return (
    <>
      <div style={backdropStyle} onClick={onClose}>
        <div style={modalStyle} onClick={(event) => event.stopPropagation()}>
          <h3 style={{ marginTop: 0 }}>Détail instance</h3>

          <div style={gridStyle}>
            <Field label="N° inventaire" value={instance.numero_inventaire} />
            <Field label="État" value={instance.etat} />
            <Field label="Statut" value={instance.statut} />
            <Field label="Localisation" value={instance.localisation_actuelle || '—'} />
            <Field
              label="Service actuel"
              value={instance.service_actuel?.nom_service || '—'}
            />
            <Field label="Désignation" value={instance.ressource?.designation || '—'} />
          </div>

          <h4 style={{ marginBottom: 8 }}>Historique (5 derniers mouvements)</h4>
          {mouvementsQuery.isLoading ? (
            <div style={{ height: 110, background: '#f3f4f6', borderRadius: 8 }} />
          ) : history.length === 0 ? (
            <div style={{ color: '#6b7280', fontSize: 14 }}>Aucun mouvement trouvé.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                  <th style={{ padding: 8 }}>Date</th>
                  <th style={{ padding: 8 }}>Type</th>
                  <th style={{ padding: 8 }}>Qté</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id_mouvement} style={{ borderTop: '1px solid #f3f4f6' }}>
                    <td style={{ padding: 8 }}>
                      {new Date(row.date_mouvement).toLocaleDateString('fr-FR')}
                    </td>
                    <td style={{ padding: 8, textTransform: 'capitalize' }}>{row.type_mouvement}</td>
                    <td style={{ padding: 8 }}>{row.quantite}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
            <button style={secondaryButton} onClick={onClose}>
              Fermer
            </button>
            <button style={primaryButton} onClick={() => setShowRetourModal(true)}>
              Créer retour
            </button>
          </div>
        </div>
      </div>

      {showRetourModal && (
        <RetourCreateModal instance={instance} onClose={() => setShowRetourModal(false)} />
      )}
    </>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, color: '#111827' }}>{value}</div>
    </div>
  );
}

const backdropStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(17,24,39,0.45)',
  display: 'grid',
  placeItems: 'center',
  zIndex: 80,
};

const modalStyle = {
  width: 'min(760px, 92vw)',
  background: '#fff',
  borderRadius: 12,
  padding: 20,
};

const innerModalStyle = {
  width: 'min(460px, 92vw)',
  background: '#fff',
  borderRadius: 12,
  padding: 18,
};

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 14,
  marginBottom: 14,
};

const labelStyle = {
  display: 'grid',
  gap: 6,
  fontSize: 13,
  color: '#374151',
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
