export default function MarcheTimeline({ etapes = [], canEdit = false, onChangeStatut }) {
  const ordered = [...etapes].sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {ordered.length === 0 ? (
        <div style={{ color: '#6b7280', fontSize: 14 }}>Aucune étape.</div>
      ) : (
        ordered.map((step) => (
          <div
            key={step.id_etape}
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 10,
              padding: 10,
              display: 'grid',
              gridTemplateColumns: '40px 1fr auto',
              gap: 10,
              alignItems: 'center',
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: '#111827',
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {step.ordre}
            </div>

            <div>
              <div style={{ fontWeight: 600, color: '#111827' }}>
                {(step.nom_etape || '').replaceAll('_', ' ')}
              </div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>
                Début: {step.date_debut ? new Date(step.date_debut).toLocaleDateString('fr-FR') : '—'}
                {' · '}
                Fin: {step.date_fin ? new Date(step.date_fin).toLocaleDateString('fr-FR') : '—'}
              </div>
            </div>

            {canEdit ? (
              <select
                value={step.statut}
                onChange={(event) => onChangeStatut?.(step, event.target.value)}
                style={{
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  padding: '6px 8px',
                  fontSize: 13,
                }}
              >
                <option value="en_attente">En attente</option>
                <option value="en_cours">En cours</option>
                <option value="complete">Complète</option>
                <option value="bloque">Bloquée</option>
              </select>
            ) : (
              <span
                style={{
                  fontSize: 12,
                  background: '#e5e7eb',
                  color: '#374151',
                  borderRadius: 999,
                  padding: '4px 8px',
                  textTransform: 'capitalize',
                }}
              >
                {(step.statut || '').replaceAll('_', ' ')}
              </span>
            )}
          </div>
        ))
      )}
    </div>
  );
}
