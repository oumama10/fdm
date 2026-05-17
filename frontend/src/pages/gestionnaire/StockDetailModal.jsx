import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { GripHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { updateStock } from '../../api/resources';

export default function StockDetailModal({ item, onClose }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [modalWidth, setModalWidth] = useState(760);
  const [isResizing, setIsResizing] = useState(false);
  const [editMode, setEditMode] = useState({});
  const resizeRef = useRef(null);

  const updateMutation = useMutation({
    mutationFn: ({ id_stock, data }) => updateStock(id_stock, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources', 'stocks'] });
      setEditMode({});
    },
  });

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
    if (value !== item.stock[field]) {
      updateMutation.mutate({
        id_stock: item.stock.id_stock,
        data: { [field]: value },
      });
    } else {
      setEditMode({ ...editMode, [field]: false });
    }
  };

  if (!item) return null;

  const { ressource, stock } = item;

  return (
    <div style={backdropStyle} onClick={onClose}>
      <div style={{ ...modalStyle, width: modalWidth }} onClick={(event) => event.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>Détail consommable</h3>
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
          <EditableField label="Désignation" value={ressource.designation} editable={false} />
          <EditableField label="Catégorie" value={ressource.categorie?.nom_categorie || '—'} editable={false} />
          <EditableField label="Unité" value={ressource.unite_mesure || '—'} editable={false} />
          <EditableField label="Description" value={ressource.description || '—'} editable={false} />
          <EditableField
            label="Qté disponible"
            value={stock.quantite_disponible}
            editable={true}
            isEditing={editMode.quantite_disponible}
            onToggleEdit={() => setEditMode({ ...editMode, quantite_disponible: !editMode.quantite_disponible })}
            onSave={(val) => handleEditSave('quantite_disponible', Number(val))}
            type="number"
          />
          <EditableField
            label="Qté réservée"
            value={stock.quantite_reservee}
            editable={true}
            isEditing={editMode.quantite_reservee}
            onToggleEdit={() => setEditMode({ ...editMode, quantite_reservee: !editMode.quantite_reservee })}
            onSave={(val) => handleEditSave('quantite_reservee', Number(val))}
            type="number"
          />
          <EditableField
            label="Seuil alerte"
            value={stock.seuil_alerte}
            editable={true}
            isEditing={editMode.seuil_alerte}
            onToggleEdit={() => setEditMode({ ...editMode, seuil_alerte: !editMode.seuil_alerte })}
            onSave={(val) => handleEditSave('seuil_alerte', Number(val))}
            type="number"
          />
          <EditableField
            label="Qté réelle"
            value={stock.quantite_reelle}
            editable={true}
            isEditing={editMode.quantite_reelle}
            onToggleEdit={() => setEditMode({ ...editMode, quantite_reelle: !editMode.quantite_reelle })}
            onSave={(val) => handleEditSave('quantite_reelle', Number(val))}
            type="number"
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button style={secondaryButton} onClick={onClose}>
            Fermer
          </button>
          <button
            style={primaryButton}
            onClick={() => navigate(`/gestionnaire/stock/${ressource.id_ressource}/mouvements`)}
          >
            Voir mouvements
          </button>
        </div>
      </div>
    </div>
  );
}

function EditableField({
  label,
  value,
  editable,
  isEditing,
  onToggleEdit,
  onSave,
  type = 'text',
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
          <input
            type={type}
            value={tempValue}
            onChange={(e) => setTempValue(type === 'number' ? parseInt(e.target.value) || 0 : e.target.value)}
            style={inputStyle}
            autoFocus
          />
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
