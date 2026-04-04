import { useState } from 'react';

export default function DemandeRefuseModal({ onClose, onSubmit, isSubmitting }) {
  const [commentaire, setCommentaire] = useState('');

  return (
    <div style={backdropStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(event) => event.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Refuser la demande</h3>
        <label style={{ display: 'grid', gap: 6, fontSize: 13, color: '#374151' }}>
          Commentaire
          <textarea
            rows={4}
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
            style={textareaStyle}
            placeholder="Saisissez le motif du refus"
          />
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button style={secondaryButton} onClick={onClose}>Annuler</button>
          <button
            style={dangerButton}
            onClick={() => onSubmit(commentaire)}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Envoi...' : 'Confirmer le refus'}
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
  width: 'min(520px, 92vw)',
  background: '#fff',
  borderRadius: 12,
  padding: 18,
};

const textareaStyle = {
  border: '1px solid #d1d5db',
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 14,
  resize: 'vertical',
};

const secondaryButton = {
  border: '1px solid #d1d5db',
  borderRadius: 8,
  padding: '8px 12px',
  background: '#fff',
  cursor: 'pointer',
};

const dangerButton = {
  border: 'none',
  borderRadius: 8,
  padding: '8px 12px',
  background: '#dc2626',
  color: '#fff',
  cursor: 'pointer',
};
