import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';

import { createRetour } from '../../api/returns';
import { getInstances } from '../../api/resources';
import { useAuthStore } from '../../store/authStore';

export default function RetourCreateModal({ onClose, onCreated }) {
  const user = useAuthStore((state) => state.user);
  const serviceId = user?.service?.id;

  const [selectedInstanceId, setSelectedInstanceId] = useState('');
  const [motif, setMotif] = useState('panne');
  const [observation, setObservation] = useState('');

  const instancesMutation = useMutation({ mutationFn: getInstances });
  const createMutation = useMutation({
    mutationFn: createRetour,
    onSuccess: () => {
      onCreated?.();
      onClose();
    },
  });

  const instances = useMemo(() => {
    const rows = instancesMutation.data?.data || [];
    return rows.filter((inst) => String(inst.id_service_actuel || '') === String(serviceId || ''));
  }, [instancesMutation.data?.data, serviceId]);

  const selectedInstance = instances.find((item) => String(item.id_instance) === String(selectedInstanceId));

  async function handleSubmit() {
    if (!selectedInstance) return;
    await createMutation.mutateAsync({
      id_ressource: Number(selectedInstance.id_ressource),
      id_instance_ressource: Number(selectedInstance.id_instance),
      motif_retour: motif,
      observation,
    });
  }

  return (
    <div style={backdropStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(event) => event.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Signaler un retour</h3>

        <div style={{ marginBottom: 10 }}>
          <button style={secondaryButton} onClick={() => instancesMutation.mutate()}>
            Charger mes instances
          </button>
        </div>

        <label style={labelStyle}>
          Ressource / instance
          <select
            value={selectedInstanceId}
            onChange={(e) => setSelectedInstanceId(e.target.value)}
            style={inputStyle}
          >
            <option value="">Sélectionner</option>
            {instances.map((inst) => (
              <option key={inst.id_instance} value={inst.id_instance}>
                {inst.ressource?.designation || '—'} — {inst.numero_inventaire}
              </option>
            ))}
          </select>
        </label>

        <label style={labelStyle}>
          Motif
          <select value={motif} onChange={(e) => setMotif(e.target.value)} style={inputStyle}>
            <option value="panne">panne</option>
            <option value="inutilise">inutilise</option>
            <option value="endommage">endommage</option>
            <option value="autre">autre</option>
          </select>
        </label>

        <label style={labelStyle}>
          Observation
          <textarea rows={3} value={observation} onChange={(e) => setObservation(e.target.value)} style={textareaStyle} />
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <button style={secondaryButton} onClick={onClose}>Annuler</button>
          <button style={primaryButton} onClick={handleSubmit} disabled={!selectedInstance || createMutation.isPending}>
            {createMutation.isPending ? 'Envoi...' : 'Soumettre'}
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

const labelStyle = {
  display: 'grid',
  gap: 6,
  fontSize: 13,
  color: '#374151',
  marginBottom: 10,
};

const inputStyle = {
  border: '1px solid #d1d5db',
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 14,
};

const textareaStyle = {
  ...inputStyle,
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

const secondaryButton = {
  border: '1px solid #d1d5db',
  borderRadius: 8,
  padding: '8px 12px',
  background: '#fff',
  cursor: 'pointer',
};
