import { useNavigate } from 'react-router-dom';

export default function StockDetailModal({ item, onClose }) {
  const navigate = useNavigate();

  if (!item) return null;

  const { ressource, stock } = item;

  return (
    <div style={backdropStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(event) => event.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Détail consommable</h3>

        <div style={gridStyle}>
          <Field label="Désignation" value={ressource.designation} />
          <Field label="Catégorie" value={ressource.categorie?.nom_categorie || '—'} />
          <Field label="Unité" value={ressource.unite_mesure || '—'} />
          <Field label="Description" value={ressource.description || '—'} />
          <Field label="Qté disponible" value={stock.quantite_disponible} />
          <Field label="Qté réservée" value={stock.quantite_reservee} />
          <Field label="Seuil alerte" value={stock.seuil_alerte} />
          <Field label="Qté réelle" value={stock.quantite_reelle} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
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

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 14,
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
