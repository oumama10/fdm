import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { downloadDechargePdf, getDechargeTypes } from '../../api/decharge';

const T = {
  blue:     '#0C447C',
  green:    '#16a34a',
  textDark: '#0f172a',
  textMid:  '#374151',
  textMuted:'#64748b',
  border:   '#e2e8f0',
  bgWhite:  '#ffffff',
  radius:   12,
  radiusSm: 8,
};

export default function DechargePrintModal({ dechargeId, onClose }) {
  const typesQuery = useQuery({
    queryKey: ['decharge', 'types', dechargeId],
    queryFn: () => getDechargeTypes(dechargeId),
    enabled: !!dechargeId,
    staleTime: 60000,
  });

  const types = typesQuery.data?.data;

  // Auto-download and close when décharge is not mixed
  useEffect(() => {
    if (!types) return;
    if (!types.is_mixed) {
      downloadDechargePdf(dechargeId).finally(onClose);
    }
  }, [types, dechargeId, onClose]);

  if (!types) {
    return (
      <div style={backdropStyle} onClick={onClose}>
        <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
          <p style={{ margin: 0, color: T.textMuted, fontSize: 14 }}>
            {typesQuery.isError ? 'Erreur lors du chargement.' : 'Chargement…'}
          </p>
        </div>
      </div>
    );
  }

  // Non-mixed → nothing to show (auto-download triggered in useEffect)
  if (!types.is_mixed) return null;

  function handleDownload(type) {
    downloadDechargePdf(dechargeId, type);
  }

  function handleDownloadBoth() {
    downloadDechargePdf(dechargeId, 'bien_inventaire');
    setTimeout(() => downloadDechargePdf(dechargeId, 'consommable'), 600);
  }

  return (
    <div style={backdropStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: T.textDark }}>
            Télécharger la décharge
          </h3>
          <button style={closeBtnStyle} onClick={onClose} aria-label="Fermer">✕</button>
        </div>

        <p style={{ margin: '0 0 20px', fontSize: 13, color: T.textMuted }}>
          Cette décharge contient des biens inventaire et des consommables.
          Choisissez le document à télécharger.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button style={optionBtnStyle} onClick={() => handleDownload('bien_inventaire')}>
            <span style={optionIconStyle}>📋</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: T.textDark }}>Biens Inventaire</div>
              <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>Matériel avec N° inventaire</div>
            </div>
          </button>

          <button style={optionBtnStyle} onClick={() => handleDownload('consommable')}>
            <span style={optionIconStyle}>📦</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: T.textDark }}>Consommables</div>
              <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>Fournitures et consommables</div>
            </div>
          </button>

          <button style={{ ...optionBtnStyle, borderColor: T.blue, background: '#f0f6ff' }} onClick={handleDownloadBoth}>
            <span style={optionIconStyle}>⬇</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: T.blue }}>Les deux documents</div>
              <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>Télécharger séparément</div>
            </div>
          </button>
        </div>

        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
          <button style={cancelBtnStyle} onClick={onClose}>Annuler</button>
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
  width: 'min(440px, 92vw)',
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

const optionBtnStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  padding: '12px 16px',
  border: `1px solid ${T.border}`,
  borderRadius: T.radiusSm,
  background: T.bgWhite,
  cursor: 'pointer',
  textAlign: 'left',
  width: '100%',
  transition: 'border-color 0.15s',
};

const optionIconStyle = {
  fontSize: 22,
  flexShrink: 0,
};

const cancelBtnStyle = {
  border: `1px solid ${T.border}`,
  borderRadius: T.radiusSm,
  padding: '8px 14px',
  background: T.bgWhite,
  color: T.textMid,
  fontSize: 13,
  cursor: 'pointer',
};
