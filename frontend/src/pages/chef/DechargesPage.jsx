import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { downloadPdf, getDecharges } from '../../api/decharge';

function SignatureCell({ statut, onDownload }) {
  if (statut === 'en_attente') {
    return <button style={secondaryButton} onClick={onDownload}>Télécharger PDF</button>;
  }
  if (statut === 'signe') {
    return <span style={{ color: '#1e3a8a', fontWeight: 600 }}>En attente de validation</span>;
  }
  if (statut === 'valide') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: '#16a34a', fontWeight: 700 }}>✓</span>
        <button style={secondaryButton} onClick={onDownload}>Télécharger PDF</button>
      </div>
    );
  }
  return <span style={{ color: '#6b7280' }}>—</span>;
}

export default function DechargesPage() {
  const navigate = useNavigate();

  const dechargesQuery = useQuery({
    queryKey: ['decharge', 'chef-list'],
    queryFn: getDecharges,
    staleTime: 30000,
  });

  const rows = useMemo(() => {
    const raw = dechargesQuery.data?.data || [];
    return [...raw].sort((a, b) => new Date(b.date_generation || 0) - new Date(a.date_generation || 0));
  }, [dechargesQuery.data?.data]);

  async function handleDownload(id, event) {
    event?.stopPropagation();
    const response = await downloadPdf(id);
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = `decharge-${id}.pdf`;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <h1 style={{ margin: 0 }}>Mes Décharges</h1>
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
        {dechargesQuery.isLoading ? (
          <div style={{ padding: 14 }}><div style={{ height: 180, borderRadius: 8, background: '#f3f4f6' }} /></div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                <th style={thStyle}>N°</th>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Statut</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: 16, color: '#6b7280' }}>Aucune décharge.</td></tr>
              ) : rows.map((row) => (
                <tr key={row.id_decharge} style={{ borderTop: '1px solid #f3f4f6', cursor: 'pointer' }} onClick={() => navigate(`/chef/decharges/${row.id_decharge}/signer`)}>
                  <td style={tdStyle}>{row.numero_decharge}</td>
                  <td style={tdStyle}>{row.date_generation ? new Date(row.date_generation).toLocaleDateString('fr-FR') : '—'}</td>
                  <td style={tdStyle}>{(row.statut_signature || '').replaceAll('_', ' ')}</td>
                  <td style={tdStyle}>
                    <SignatureCell statut={row.statut_signature} onDownload={(event) => handleDownload(row.id_decharge, event)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const secondaryButton = {
  border: '1px solid #d1d5db',
  borderRadius: 8,
  padding: '6px 10px',
  background: '#fff',
  cursor: 'pointer',
};

const thStyle = { padding: 10, fontWeight: 600 };
const tdStyle = { padding: 10 };
