import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { acquitterAlerte, getAlertes } from '../../api/alerts';
import { getStockAlertes } from '../../api/resources';
import { MARCHE_STATUT_LABELS, StatusBadge } from '../../constants/statuts';

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
    <div className="page-stack">
      <h1 className="page-title">Alertes</h1>

      <section className="section-shell">
        <h3 className="section-title">Alertes délai marchés</h3>
        {alertesQuery.isLoading ? (
          <div style={{ height: 180, borderRadius: 10, background: '#f3f4f6' }} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Type</th>
                  <th>Statut marché</th>
                  <th>Fournisseur</th>
                  <th>Échéance</th>
                  <th>Jours restants</th>
                  <th>Niveau</th>
                  <th>Acquitté</th>
                </tr>
              </thead>
              <tbody>
                {alertesRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="empty-state">
                      Aucune alerte délai.
                    </td>
                  </tr>
                ) : (
                  alertesRows.map((row) => {
                    const jours = getDaysRemaining(row);
                    const rowStyle =
                      typeof jours === 'number' && jours <= 7
                        ? { background: '#fff6e5' }
                        : typeof jours === 'number' && jours <= 14
                        ? { background: '#fef9eb' }
                        : {};
                    const idAlerte = getAlerteId(row);
                    return (
                      <tr key={idAlerte} style={rowStyle}>
                        <td>{row.marche?.reference || row.idMarche?.reference || '—'}</td>
                        <td>{row.marche?.type_acquisition || row.marche?.typeAcquisition || '—'}</td>
                        <td><StatusBadge map={MARCHE_STATUT_LABELS} value={row.marche?.statut || row.idMarche?.statut} /></td>
                        <td>
                          {row.fournisseur || row.nomFournisseur || '—'}
                        </td>
                        <td>
                          {row.date_echeance
                            ? new Date(row.date_echeance).toLocaleDateString('fr-FR')
                            : row.dateEcheance
                            ? new Date(row.dateEcheance).toLocaleDateString('fr-FR')
                            : '—'}
                        </td>
                        <td>{jours ?? '—'}</td>
                        <td>{getNiveau(row)}</td>
                        <td>
                          {row.acquitte || row.acquitte === true ? (
                            <span style={{ color: '#0f6e56', fontWeight: 700 }}>Oui</span>
                          ) : (
                            <button
                              className="btn btn-primary"
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

      <section className="section-shell">
        <h3 className="section-title">Alertes stock bas</h3>
        {stockQuery.isLoading ? (
          <div style={{ height: 180, borderRadius: 10, background: '#f3f4f6' }} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  <th>Désignation</th>
                  <th>Catégorie</th>
                  <th>Qté disponible</th>
                  <th>Seuil</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {stockRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="empty-state">
                      Aucun stock bas.
                    </td>
                  </tr>
                ) : (
                  stockRows.map((row) => {
                    const low = Number(row.quantite_disponible || 0) <= Number(row.seuil_alerte || 0);
                    return (
                      <tr key={row.id_stock}>
                        <td>{row.id_ressource?.designation || '—'}</td>
                        <td>{row.id_ressource?.id_categorie?.nom_categorie || '—'}</td>
                        <td>{row.quantite_disponible ?? '—'}</td>
                        <td>{row.seuil_alerte ?? '—'}</td>
                        <td>
                          <span className="status-chip" style={{ background: low ? '#fef3dc' : '#e1f5ee', color: low ? '#9a6e1a' : '#0f6e56' }}>
                            {low ? 'Stock bas' : 'OK'}
                          </span>
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
