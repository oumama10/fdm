import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GripHorizontal } from 'lucide-react';

import { getMouvements, updateInstance } from '../../api/resources';
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
  const [modalWidth, setModalWidth] = useState(760);
  const [isResizing, setIsResizing] = useState(false);
  const [editMode, setEditMode] = useState({});
  const resizeRef = useRef(null);
  const queryClient = useQueryClient();

  const mouvementsQuery = useQuery({
    queryKey: ['resources', 'mouvements', 'instance', instance?.id_instance],
    queryFn: () => getMouvements({ id_ressource: instance.id_ressource }),
    enabled: Boolean(instance?.id_instance),
    staleTime: 30000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id_instance, data }) => updateInstance(id_instance, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources', 'instances'] });
      setEditMode({});
    },
  });

  const history = useMemo(() => {
    const rows = mouvementsQuery.data?.data || [];
    return rows
      .filter((m) => Number(m.id_instance_ressource) === Number(instance?.id_instance))
      .sort((a, b) => new Date(b.date_mouvement || 0) - new Date(a.date_mouvement || 0))
      .slice(0, 5);
  }, [mouvementsQuery.data?.data, instance?.id_instance]);

  const handleMouseDown = (e) => {
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = modalWidth;

    const handleMouseMove = (moveEvent) => {
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.max(600, Math.min(window.innerWidth * 0.95, startWidth + delta));
      setModalWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleEditSave = (field, value) => {
    if (value !== instance[field]) {
      updateMutation.mutate({
        id_instance: instance.id_instance,
        data: { [field]: value },
      });
    } else {
      setEditMode({ ...editMode, [field]: false });
    }
  };

  if (!instance) return null;

  return (
    <>
      <div style={backdropStyle} onClick={onClose}>
        <div style={{ ...modalStyle, width: modalWidth }} onClick={(event) => event.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>Détail instance</h3>
            <button
              style={{ ...resizeHandleStyle, cursor: isResizing ? 'grabbing' : 'grab' }}
              onMouseDown={handleMouseDown}
              ref={resizeRef}
              title="Redimensionner (min 600px, max 95vw)"
            >
              <GripHorizontal size={18} />
            </button>
          </div>

          <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
            <EditableField
              label="N° inventaire"
              value={instance.numero_inventaire}
              editable={false}
            />
            <EditableField
              label="État"
              value={instance.etat}
              editable={true}
              isEditing={editMode.etat}
              onToggleEdit={() => setEditMode({ ...editMode, etat: !editMode.etat })}
              onSave={(val) => handleEditSave('etat', val)}
              options={['neuf', 'bon_etat', 'usage_normal', 'endommage', 'hors_service']}
            />
            <EditableField
              label="Statut"
              value={instance.statut}
              editable={true}
              isEditing={editMode.statut}
              onToggleEdit={() => setEditMode({ ...editMode, statut: !editMode.statut })}
              onSave={(val) => handleEditSave('statut', val)}
              options={['en_stock', 'en_service', 'en_maintenance', 'hors_service']}
            />
            <EditableField
              label="Localisation"
              value={instance.localisation_actuelle || '—'}
              editable={true}
              isEditing={editMode.localisation_actuelle}
              onToggleEdit={() => setEditMode({ ...editMode, localisation_actuelle: !editMode.localisation_actuelle })}
              onSave={(val) => handleEditSave('localisation_actuelle', val)}
            />
            <EditableField
              label="Service actuel"
              value={instance.service_actuel?.nom_service || '—'}
              editable={false}
            />
            <EditableField
              label="Désignation"
              value={instance.ressource?.designation || '—'}
              editable={false}
            />
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

function EditableField({
  label,
  value,
  editable,
  isEditing,
  onToggleEdit,
  onSave,
  options,
}) {
  const [tempValue, setTempValue] = useState(value);

  const handleSave = () => {
    onSave(tempValue);
    onToggleEdit();
  };

  return (
    <div style={editableFieldContainer}>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{label}</div>
      {!editable || !isEditing ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 14, color: '#111827', flex: 1 }}>{value}</div>
          {editable && (
            <button
              style={editButtonStyle}
              onClick={onToggleEdit}
              title="Modifier"
            >
              ✏
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          {options ? (
            <select
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              style={inputStyle}
              autoFocus
            >
              {options.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              style={inputStyle}
              autoFocus
            />
          )}
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button style={cancelButtonStyle} onClick={() => { setTempValue(value); onToggleEdit(); }}>
              Annuler
            </button>
            <button style={saveButtonStyle} onClick={handleSave}>
              Enregistrer
            </button>
          </div>
        </div>
      )}
    </div>
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
  minWidth: 600,
  maxWidth: '95vw',
  background: '#fff',
  borderRadius: 12,
  padding: 20,
  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
  maxHeight: '90vh',
  overflow: 'auto',
};

const resizeHandleStyle = {
  border: 'none',
  background: '#f3f4f6',
  color: '#9ca3af',
  borderRadius: 6,
  padding: 6,
  cursor: 'grab',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'background-color 0.2s',
};

const editableFieldContainer = {
  display: 'grid',
  gap: 6,
  padding: 10,
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  background: '#fafbfc',
};

const editButtonStyle = {
  border: 'none',
  background: '#f3f4f6',
  color: '#6b7280',
  borderRadius: 4,
  padding: '4px 8px',
  cursor: 'pointer',
  fontSize: 12,
  width: 28,
  height: 28,
};

const inputStyle = {
  border: '1px solid #d1d5db',
  borderRadius: 6,
  padding: '8px 10px',
  fontSize: 14,
};

const cancelButtonStyle = {
  border: '1px solid #d1d5db',
  borderRadius: 6,
  padding: '6px 12px',
  background: '#fff',
  color: '#374151',
  cursor: 'pointer',
  fontSize: 13,
};

const saveButtonStyle = {
  border: 'none',
  borderRadius: 6,
  padding: '6px 12px',
  background: '#0B3D4A',
  color: '#fff',
  cursor: 'pointer',
  fontSize: 13,
};

const innerModalStyle = {
  width: 'min(460px, 92vw)',
  background: '#fff',
  borderRadius: 12,
  padding: 18,
};

const labelStyle = {
  display: 'grid',
  gap: 6,
  fontSize: 13,
  color: '#374151',
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
