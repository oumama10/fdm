import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { acquitterAlerte, getAlertes } from '../../api/alerts';
import { getStockAlertes } from '../../api/resources';

function getDaysRemaining(row) {
  if (typeof row.jours_restants === 'number') return row.jours_restants;
  if (typeof row.joursRestants === 'number') return row.joursRestants;
  return null;
}

function getAlerteId(row) {
  return row.id_alerte ?? row.idAlerte;
}

function getNiveau(row) {
  return row.niveau_alerte ?? row.niveauAlerte ?? '—';
}

export default function AlertesPage() {
  const queryClient = useQueryClient();

  const alertesQuery = useQuery({
    queryKey: ['gestionnaire', 'alertes-delai'],
    queryFn: () => getAlertes(),
    staleTime: 0,
  });

  const stockQuery = useQuery({
    queryKey: ['gestionnaire', 'alertes-stock-bas'],
    queryFn: () => getStockAlertes(),
    staleTime: 0,
  });

  const acquitterMutation = useMutation({
    mutationFn: (id) => acquitterAlerte(id, { acquitte: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gestionnaire', 'alertes-delai'] });
    },
  });

  const alertesRows = useMemo(() => alertesQuery.data?.data || [], [alertesQuery.data?.data]);
  const stockRows = useMemo(() => stockQuery.data?.data || [], [stockQuery.data?.data]);

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <h1 style={{ margin: 0 }}>Alertes</h1>

      <section style={sectionStyle}>
        <h3 style={{ margin: '0 0 10px 0' }}>Alertes délai marchés</h3>
        {alertesQuery.isLoading ? (
          <div style={{ height: 180, borderRadius: 10, background: '#f3f4f6' }} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                  <th style={thStyle}>Référence</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Fournisseur</th>
                  <th style={thStyle}>Échéance</th>
                  <th style={thStyle}>Jours restants</th>
                  <th style={thStyle}>Niveau</th>
                  <th style={thStyle}>Acquitté</th>
                </tr>
              </thead>
              <tbody>
                {alertesRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 16, color: '#6b7280' }}>
                      Aucune alerte délai.
                    </td>
                  </tr>
                ) : (
                  alertesRows.map((row) => {
                    const jours = getDaysRemaining(row);
                    const rowStyle =
                      typeof jours === 'number' && jours <= 7
                        ? { background: '#fee2e2' }
                        : typeof jours === 'number' && jours <= 14
                        ? { background: '#fef3c7' }
                        : {};
                    const idAlerte = getAlerteId(row);
                    return (
                      <tr key={idAlerte} style={{ borderTop: '1px solid #f3f4f6', ...rowStyle }}>
                        <td style={tdStyle}>{row.marche?.reference || row.idMarche?.reference || '—'}</td>
                        <td style={tdStyle}>{row.marche?.type_acquisition || row.marche?.typeAcquisition || '—'}</td>
                        <td style={tdStyle}>
                          {row.fournisseur || row.nomFournisseur || '—'}
                        </td>
                        <td style={tdStyle}>
                          {row.date_echeance
                            ? new Date(row.date_echeance).toLocaleDateString('fr-FR')
                            : row.dateEcheance
                            ? new Date(row.dateEcheance).toLocaleDateString('fr-FR')
                            : '—'}
                        </td>
                        <td style={tdStyle}>{jours ?? '—'}</td>
                        <td style={tdStyle}>{getNiveau(row)}</td>
                        <td style={tdStyle}>
                          {row.acquitte || row.acquitte === true ? (
                            <span style={{ color: '#065f46' }}>Oui</span>
                          ) : (
                            <button
                              style={primaryButton}
                              onClick={() => acquitterMutation.mutate(idAlerte)}
                              disabled={acquitterMutation.isPending}
                            >
                              Acquitter
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={sectionStyle}>
        <h3 style={{ margin: '0 0 10px 0' }}>Alertes stock bas</h3>
        {stockQuery.isLoading ? (
          <div style={{ height: 180, borderRadius: 10, background: '#f3f4f6' }} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                  <th style={thStyle}>Désignation</th>
                  <th style={thStyle}>Catégorie</th>
                  <th style={thStyle}>Qté disponible</th>
                  <th style={thStyle}>Seuil</th>
                  <th style={thStyle}>Statut</th>
                </tr>
              </thead>
              <tbody>
                {stockRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 16, color: '#6b7280' }}>
                      Aucun stock bas.
                    </td>
                  </tr>
                ) : (
                  stockRows.map((row) => {
                    const low = Number(row.quantite_disponible || 0) <= Number(row.seuil_alerte || 0);
                    return (
                      <tr key={row.id_stock} style={{ borderTop: '1px solid #f3f4f6' }}>
                        <td style={tdStyle}>{row.id_ressource?.designation || '—'}</td>
                        <td style={tdStyle}>{row.id_ressource?.id_categorie?.nom_categorie || '—'}</td>
                        <td style={tdStyle}>{row.quantite_disponible ?? '—'}</td>
                        <td style={tdStyle}>{row.seuil_alerte ?? '—'}</td>
                        <td style={tdStyle}>
                          <span style={{ color: low ? '#b45309' : '#065f46' }}>{low ? 'Stock bas' : 'OK'}</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

const sectionStyle = {
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  background: '#fff',
  padding: 12,
};

const thStyle = { padding: 8, fontWeight: 600 };
const tdStyle = { padding: 8 };

const primaryButton = {
  border: 'none',
  borderRadius: 8,
  padding: '6px 10px',
  background: '#111827',
  color: '#fff',
  cursor: 'pointer',
};
