import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getEtapes,
  getLotsByMarche,
  getMarcheDetail,
  updateEtape,
} from '../../api/procurement';
import ImportExcelModal from '../gestionnaire/ImportExcelModal';
import MarcheTimeline from '../../components/procurement/MarcheTimeline';
import { useAuthStore } from '../../store/authStore';

function StatusBadge({ statut }) {
  const tone =
    statut === 'receptionne_et_stocke'
      ? { bg: '#bbf7d0', color: '#14532d' }
      : statut === 'non_conforme'
      ? { bg: '#fecaca', color: '#991b1b' }
      : { bg: '#dbeafe', color: '#1e3a8a' };

  return (
    <span
      style={{
        borderRadius: 999,
        padding: '4px 10px',
        fontSize: 12,
        fontWeight: 600,
        background: tone.bg,
        color: tone.color,
      }}
    >
      {(statut || '').replaceAll('_', ' ')}
    </span>
  );
}

export default function MarcheDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const role = useAuthStore((state) => state.user?.id_role?.nom_role || state.user?.role);
  const [showImportModal, setShowImportModal] = useState(false);
  const [lastImport, setLastImport] = useState(null);

  const marcheQuery = useQuery({
    queryKey: ['procurement', 'marche', id],
    queryFn: () => getMarcheDetail(id),
    staleTime: 30000,
  });

  const etapesQuery = useQuery({
    queryKey: ['procurement', 'etapes', id],
    queryFn: () => getEtapes(id),
    staleTime: 30000,
  });

  const lotsQuery = useQuery({
    queryKey: ['procurement', 'lots', id],
    queryFn: () => getLotsByMarche(id),
    staleTime: 30000,
  });

  const updateEtapeMutation = useMutation({
    mutationFn: ({ id_etape, statut }) => updateEtape(id_etape, { statut }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement', 'etapes', id] });
    },
  });

  const marche = marcheQuery.data?.data;
  const etapes = etapesQuery.data?.data || marche?.etapes || [];
  const lots = lotsQuery.data?.data || [];

  const canEditTimeline = role === 'gestionnaire_magasin';
  const canImportExcel = role === 'service_financiere';

  const importStatusLabel = useMemo(() => {
    if (!lastImport) return 'Aucun import détecté dans cette session.';
    return `Import #${lastImport.id_import} — statut: ${lastImport.statut_import}`;
  }, [lastImport]);

  if (marcheQuery.isLoading) {
    return <div style={{ height: 220, borderRadius: 10, background: '#f3f4f6' }} />;
  }

  if (!marche) {
    return <div style={{ color: '#b91c1c' }}>Marché introuvable.</div>;
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: 14,
          background: '#fff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>{marche.reference}</h1>
          <div style={{ color: '#374151', marginTop: 4 }}>
            Type: <strong>{marche.type_acquisition}</strong>
            {' · '}
            Fournisseur: <strong>{marche.fournisseur?.nom_societe || '—'}</strong>
          </div>
        </div>
        <StatusBadge statut={marche.statut} />
      </div>

      <section style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Timeline des étapes</h3>
        <MarcheTimeline
          etapes={etapes}
          canEdit={canEditTimeline}
          onChangeStatut={(step, statut) =>
            updateEtapeMutation.mutate({ id_etape: step.id_etape, statut })
          }
        />
      </section>

      <section style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Lots article</h3>
        {lotsQuery.isLoading ? (
          <div style={{ height: 120, borderRadius: 8, background: '#f3f4f6' }} />
        ) : lots.length === 0 ? (
          <div style={{ color: '#6b7280' }}>Aucun lot.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                <th style={thStyle}>N° lot</th>
                <th style={thStyle}>Désignation</th>
                <th style={thStyle}>Qté commandée</th>
                <th style={thStyle}>Qté reçue</th>
              </tr>
            </thead>
            <tbody>
              {lots.map((lot) => (
                <tr key={lot.id_lot} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={tdStyle}>{lot.numero_lot}</td>
                  <td style={tdStyle}>{lot.designation}</td>
                  <td style={tdStyle}>{lot.quantite_commandee}</td>
                  <td style={tdStyle}>{lot.quantite_recue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={sectionTitleStyle}>Import Excel</h3>
          {canImportExcel ? (
            <button style={primaryButton} onClick={() => setShowImportModal(true)}>
              Importer Excel
            </button>
          ) : null}
        </div>
        <div style={{ fontSize: 14, color: '#374151' }}>{importStatusLabel}</div>
      </section>

      {showImportModal ? (
        <ImportExcelModal
          marcheId={marche.id_marche}
          onClose={() => setShowImportModal(false)}
          onDone={(data) => setLastImport(data)}
        />
      ) : null}
    </div>
  );
}

const sectionStyle = {
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  background: '#fff',
  padding: 12,
};

const sectionTitleStyle = {
  marginTop: 0,
  marginBottom: 10,
};

const primaryButton = {
  border: 'none',
  borderRadius: 8,
  padding: '8px 12px',
  background: '#111827',
  color: '#fff',
  cursor: 'pointer',
};

const thStyle = { padding: 8, fontWeight: 600 };
const tdStyle = { padding: 8 };
