import { useEffect } from 'react';
import { downloadDechargeAuto } from '../../api/decharge';

const T = {
  blue:     '#0C447C',
  textDark: '#0f172a',
  textMuted:'#64748b',
  border:   '#e2e8f0',
  bgWhite:  '#ffffff',
  radius:   12,
};

export default function DechargePrintModal({ dechargeId, onClose }) {
  useEffect(() => {
    downloadDechargeAuto(dechargeId).finally(onClose);
  }, [dechargeId, onClose]);

  return (
    <div style={backdropStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: T.textDark }}>
            Téléchargement en cours
          </h3>
          <button style={closeBtnStyle} onClick={onClose} aria-label="Fermer">✕</button>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: T.textMuted }}>
          Génération du PDF…
        </p>
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
  width: 'min(380px, 92vw)',
  background: T.bgWhite,
  borderRadius: T.radius,
  padding: '20px 22px',
  boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
};

const closeBtnStyle = {
  background: 'none',
  border: 'none',
  fontSize: 16,
  color: T.textMuted,
  cursor: 'pointer',
  padding: '2px 6px',
  lineHeight: 1,
};
