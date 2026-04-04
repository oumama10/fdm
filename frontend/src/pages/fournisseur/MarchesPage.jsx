import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { getMarches } from '../../api/procurement';
import { useAuthStore } from '../../store/authStore';

const TOTAL_ETAPES = 8;

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('fr-FR');
}

function countCompletedEtapes(marche) {
  if (Array.isArray(marche?.etapes)) {
    return marche.etapes.filter((step) => step?.statut === 'complete').length;
  }

  if (typeof marche?.etapes_completees === 'number') {
    return marche.etapes_completees;
  }

  if (typeof marche?.progression_etapes_completees === 'number') {
    return marche.progression_etapes_completees;
  }

  return 0;
}

function typeLabel(typeAcquisition) {
  if (typeAcquisition === 'bon_commande') return 'BC';
  if (typeAcquisition === 'marche') return 'Marché';
  if (typeAcquisition === 'donation') return 'Donation';
  return typeAcquisition || '—';
}

function ProgressionCell({ completed }) {
  const safeCompleted = Math.max(0, Math.min(TOTAL_ETAPES, completed));
  const percent = Math.round((safeCompleted / TOTAL_ETAPES) * 100);

  return (
    <div style={{ minWidth: 170 }}>
      <div
        style={{
          height: 8,
          borderRadius: 999,
          background: '#e5e7eb',
          overflow: 'hidden',
          marginBottom: 6,
        }}
      >
        <div
          style={{
            width: `${percent}%`,
            height: '100%',
            background: '#16a34a',
          }}
        />
      </div>
      <span style={{ fontSize: 12, color: '#374151' }}>{safeCompleted}/{TOTAL_ETAPES} étapes complètes</span>
    </div>
  );
}

export default function MarchesPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  const marchesQuery = useQuery({
    queryKey: ['procurement', 'marches', 'fournisseur'],
    queryFn: getMarches,
    staleTime: 30000,
  });

  const fournisseurId = user?.id_fournisseur || user?.fournisseur?.id_fournisseur || user?.id;

  const marches = useMemo(() => {
    const rows = marchesQuery.data?.data || [];

    return rows
      .filter((marche) => {
        if (!fournisseurId) return true;
        return Number(marche.id_fournisseur) === Number(fournisseurId);
      })
      .map((marche) => ({
        ...marche,
        completedEtapes: countCompletedEtapes(marche),
      }));
  }, [marchesQuery.data?.data, fournisseurId]);

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <h1 style={{ margin: 0 }}>Mes BC / Marchés</h1>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
        {marchesQuery.isLoading ? (
          <div style={{ padding: 14 }}>
            <div style={{ height: 160, borderRadius: 8, background: '#f3f4f6' }} />
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                <th style={thStyle}>Référence</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Statut</th>
                <th style={thStyle}>Date création</th>
                <th style={thStyle}>Progression étapes</th>
              </tr>
            </thead>
            <tbody>
              {marches.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 16, color: '#6b7280' }}>
                    Aucun BC / marché trouvé.
                  </td>
                </tr>
              ) : (
                marches.map((marche) => (
                  <tr
                    key={marche.id_marche}
                    style={{ cursor: 'pointer', borderTop: '1px solid #f3f4f6' }}
                    onClick={() => navigate(`/fournisseur/marches/${marche.id_marche}`)}
                  >
                    <td style={tdStyle}>{marche.reference || '—'}</td>
                    <td style={tdStyle}>{typeLabel(marche.type_acquisition)}</td>
                    <td style={tdStyle}>{(marche.statut || '').replaceAll('_', ' ') || '—'}</td>
                    <td style={tdStyle}>{formatDate(marche.date_creation)}</td>
                    <td style={tdStyle}>
                      <ProgressionCell completed={marche.completedEtapes} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const thStyle = { padding: 10, fontWeight: 600 };
const tdStyle = { padding: 10, verticalAlign: 'top' };
