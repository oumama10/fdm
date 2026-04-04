import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { getMouvements } from '../../api/resources';

function TypeBadge({ value }) {
  const tones = {
    entree: { bg: '#bbf7d0', color: '#14532d' },
    sortie: { bg: '#dbeafe', color: '#1e3a8a' },
    retour: { bg: '#fde68a', color: '#78350f' },
    transfert: { bg: '#ddd6fe', color: '#4c1d95' },
    rebut: { bg: '#fecaca', color: '#991b1b' },
  };
  const tone = tones[value] || { bg: '#e5e7eb', color: '#374151' };

  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 600,
        borderRadius: 999,
        padding: '3px 10px',
        background: tone.bg,
        color: tone.color,
        textTransform: 'capitalize',
      }}
    >
      {value}
    </span>
  );
}

export default function MouvementsPage() {
  const { id } = useParams();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [typeMouvement, setTypeMouvement] = useState('');
  const [appliedFilters, setAppliedFilters] = useState({
    date_from: '',
    date_to: '',
    type_mouvement: '',
  });

  const mouvementsQuery = useQuery({
    queryKey: ['resources', 'mouvements', id, appliedFilters],
    queryFn: () =>
      getMouvements({
        id_ressource: id,
        ...appliedFilters,
      }),
    staleTime: 30000,
  });

  const rows = useMemo(() => {
    const list = mouvementsQuery.data?.data || [];
    return [...list].sort(
      (a, b) => new Date(b.date_mouvement || 0) - new Date(a.date_mouvement || 0)
    );
  }, [mouvementsQuery.data?.data]);

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Mouvements de stock — Ressource #{id}</h1>
        <Link to="/gestionnaire/stock">Retour stock</Link>
      </div>

      <div
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          background: '#fff',
          padding: 12,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr auto',
          gap: 10,
          alignItems: 'end',
        }}
      >
        <label style={labelStyle}>
          Date début
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={inputStyle} />
        </label>

        <label style={labelStyle}>
          Date fin
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={inputStyle} />
        </label>

        <label style={labelStyle}>
          Type mouvement
          <select value={typeMouvement} onChange={(e) => setTypeMouvement(e.target.value)} style={inputStyle}>
            <option value="">Tous</option>
            <option value="entree">Entrée</option>
            <option value="sortie">Sortie</option>
            <option value="retour">Retour</option>
            <option value="transfert">Transfert</option>
            <option value="rebut">Rebut</option>
          </select>
        </label>

        <button
          style={buttonStyle}
          onClick={() =>
            setAppliedFilters({
              date_from: dateFrom,
              date_to: dateTo,
              type_mouvement: typeMouvement,
            })
          }
        >
          Filtrer
        </button>
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff' }}>
        {mouvementsQuery.isLoading ? (
          <div style={{ padding: 14 }}>
            <div style={{ height: 180, background: '#f3f4f6', borderRadius: 8 }} />
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 16, color: '#6b7280' }}>Aucun mouvement trouvé.</div>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 12, display: 'grid', gap: 10 }}>
            {rows.map((entry) => (
              <li key={entry.id_mouvement} style={timelineItemStyle}>
                <div style={{ minWidth: 110, fontSize: 13, color: '#374151' }}>
                  {new Date(entry.date_mouvement).toLocaleString('fr-FR')}
                </div>
                <div>
                  <TypeBadge value={entry.type_mouvement} />
                </div>
                <div style={{ fontWeight: 700, color: '#111827' }}>Qté: {entry.quantite}</div>
                <div style={{ color: '#4b5563', fontSize: 13 }}>
                  {entry.observation || 'Sans observation'}
                </div>
                <div>
                  {entry.source_object?.id ? (
                    <a
                      href={`/api/${entry.source_object.model}/${entry.source_object.id}/`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Source document
                    </a>
                  ) : (
                    <span style={{ color: '#9ca3af' }}>Aucune source</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

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

const buttonStyle = {
  border: 'none',
  borderRadius: 8,
  padding: '9px 12px',
  background: '#111827',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 600,
};

const timelineItemStyle = {
  border: '1px solid #eef2f7',
  borderRadius: 10,
  padding: 10,
  display: 'grid',
  gridTemplateColumns: '110px auto auto 1fr auto',
  gap: 10,
  alignItems: 'center',
};
