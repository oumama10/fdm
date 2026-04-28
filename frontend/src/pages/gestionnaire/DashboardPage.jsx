import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

import { getDashboard, getStockInstantane } from '../../api/reporting';
import { getDemandes } from '../../api/requests';
import { getAlertes } from '../../api/alerts';

const STALE_TIME = 30_000;

const pieColors = ['#2563eb', '#10b981'];

function SkeletonCard() {
  return (
    <div
      className="kpi-card"
      style={{
        height: 112,
        background: 'linear-gradient(90deg, #eef6f1 25%, #e4efe9 50%, #eef6f1 75%)',
        backgroundSize: '200% 100%',
      }}
    />
  );
}

function Badge({ value, type }) {
  const urgencyColors = {
    normal: { bg: '#e5e7eb', color: '#111827' },
    moyen: { bg: '#fcd34d', color: '#78350f' },
    urgent: { bg: '#fecaca', color: '#991b1b' },
  };

  const statusColors = {
    en_cours: { bg: '#bfdbfe', color: '#1e3a8a' },
    validee: { bg: '#bbf7d0', color: '#14532d' },
    refusee: { bg: '#fecaca', color: '#991b1b' },
    complete: { bg: '#99f6e4', color: '#134e4a' },
    complete_avec_decharge: { bg: '#99f6e4', color: '#134e4a' },
  };

  const palette = type === 'urgence' ? urgencyColors : statusColors;
  const tone = palette[value] || { bg: '#e5e7eb', color: '#374151' };

  return (
    <span className="status-chip" style={{ background: tone.bg, color: tone.color }}>
      {String(value || '').replaceAll('_', ' ')}
    </span>
  );
}

function formatDate(dateValue) {
  if (!dateValue) return '—';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('fr-FR');
}

export default function DashboardPage() {
  const navigate = useNavigate();

  const dashboardQuery = useQuery({
    queryKey: ['reporting', 'dashboard'],
    queryFn: getDashboard,
    staleTime: STALE_TIME,
  });

  const stockInstantaneQuery = useQuery({
    queryKey: ['reporting', 'stock-instantane'],
    queryFn: getStockInstantane,
    staleTime: STALE_TIME,
  });

  const demandesQuery = useQuery({
    queryKey: ['demandes', 'latest'],
    queryFn: () => getDemandes(),
    staleTime: STALE_TIME,
  });

  const alertesQuery = useQuery({
    queryKey: ['alertes', 'actives'],
    queryFn: () => getAlertes(),
    staleTime: STALE_TIME,
  });

  const dashboard = dashboardQuery.data?.data || {};

  const monthlyData = useMemo(() => {
    const raw = dashboard.monthly_acquisitions || [];
    return raw.map((item) => ({
      mois: item.mois,
      total: Number(item.total || 0),
    }));
  }, [dashboard.monthly_acquisitions]);

  const pieData = useMemo(() => {
    const stockData = stockInstantaneQuery.data?.data || {};
    const consommablesCount = (stockData.consommables || []).length;
    const bienCount = (stockData.bien_inventaire || []).length;

    return [
      { name: 'Consommables', value: consommablesCount },
      { name: 'Biens inventaire', value: bienCount },
    ];
  }, [stockInstantaneQuery.data?.data]);

  const latestDemandes = useMemo(() => {
    const raw = demandesQuery.data?.data || [];
    return [...raw]
      .sort((a, b) => new Date(b.date_demande || 0) - new Date(a.date_demande || 0))
      .slice(0, 5);
  }, [demandesQuery.data?.data]);

  const activeAlertes = useMemo(() => {
    const raw = alertesQuery.data?.data || [];
    return raw
      .filter((a) => !a.acquitte)
      .sort((a, b) => (a.jours_restants ?? 9999) - (b.jours_restants ?? 9999))
      .slice(0, 10);
  }, [alertesQuery.data?.data]);

  const cards = [
    {
      title: 'Stock alerts',
      value: dashboard.stock_alerts_count || 0,
      danger: (dashboard.stock_alerts_count || 0) > 0,
      subtitle: 'Consommables sous seuil',
    },
    {
      title: 'Demandes en cours',
      value: dashboard.demandes_en_cours || 0,
      danger: false,
      subtitle: 'Demandes en attente de traitement',
    },
    {
      title: 'Décharges en attente',
      value: dashboard.decharges_en_attente_signature || 0,
      danger: false,
      subtitle: 'Signatures chef service',
    },
    {
      title: 'Marchés délai proche',
      value: dashboard.marches_deadline_proche || 0,
      danger: (dashboard.marches_deadline_proche || 0) > 0,
      subtitle: '≤ 7 jours',
    },
  ];

  const isTopLoading = dashboardQuery.isLoading;
  const isChartLoading = dashboardQuery.isLoading || stockInstantaneQuery.isLoading;
  const isBottomLoading = demandesQuery.isLoading || alertesQuery.isLoading;

  return (
    <div className="page-stack">
      <h1 className="page-title">Dashboard Gestionnaire</h1>

      <section className="kpi-grid">
        {isTopLoading
          ? Array.from({ length: 4 }).map((_, idx) => <SkeletonCard key={`sk-card-${idx}`} />)
          : cards.map((card) => (
              <div
                key={card.title}
                className={`kpi-card ${card.danger ? 'warn' : ''}`}
              >
                <div className="kpi-label">{card.title}</div>
                <div className="kpi-value">{card.value}</div>
                <div className="kpi-caption">{card.subtitle}</div>
              </div>
            ))}
      </section>

      <section className="grid-two">
        <div className="chart-card">
          <h3 className="section-title">Acquisitions des 12 derniers mois</h3>
          {isChartLoading ? (
            <div style={{ height: 280, borderRadius: 8, background: '#f3f4f6' }} />
          ) : (
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d7e7df" />
                  <XAxis dataKey="mois" />
                  <YAxis allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #d7e7df' }} />
                  <Bar dataKey="total" fill="#0f6e56" name="Entrées" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="chart-card">
          <h3 className="section-title">Répartition par catégorie</h3>
          {isChartLoading ? (
            <div style={{ height: 280, borderRadius: 8, background: '#f3f4f6' }} />
          ) : (
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={92}>
                    {pieData.map((entry, index) => (
                      <Cell key={entry.name} fill={pieColors[index % pieColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      <section className="grid-two" style={{ alignItems: 'start' }}>
        <div className="data-table-wrap">
          <div style={{ padding: 14, borderBottom: '1px solid #f3f4f6', fontWeight: 700 }}>5 dernières demandes</div>
          {isBottomLoading ? (
            <div style={{ padding: 14 }}>
              <div style={{ height: 160, borderRadius: 8, background: '#f3f4f6' }} />
            </div>
          ) : (
            <table className="data-table" style={{ fontSize: 14 }}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Service</th>
                  <th>Urgence</th>
                  <th>Statut</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {latestDemandes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="empty-state">
                      Aucune demande trouvée.
                    </td>
                  </tr>
                ) : (
                  latestDemandes.map((row) => {
                    const demandeId = row.id_demande ?? row.id;
                    const serviceName = row.service?.nom_service || row.service?.nomService || '—';
                    return (
                      <tr
                        key={demandeId}
                        onClick={() => navigate(`/gestionnaire/demandes/${demandeId}`)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>#{demandeId}</td>
                        <td>{serviceName}</td>
                        <td>
                          <Badge type="urgence" value={row.urgence} />
                        </td>
                        <td>
                          <Badge type="statut" value={row.statut} />
                        </td>
                        <td>{formatDate(row.date_demande)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        <div className="data-table-wrap">
          <div style={{ padding: 14, borderBottom: '1px solid #f3f4f6', fontWeight: 700 }}>Alertes délai actives</div>
          {isBottomLoading ? (
            <div style={{ padding: 14 }}>
              <div style={{ height: 160, borderRadius: 8, background: '#f3f4f6' }} />
            </div>
          ) : (
            <table className="data-table" style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Jours</th>
                  <th>Niveau</th>
                </tr>
              </thead>
              <tbody>
                {activeAlertes.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="empty-state">
                      Aucune alerte active.
                    </td>
                  </tr>
                ) : (
                  activeAlertes.map((alert) => {
                    const days = Number(alert.jours_restants ?? 0);
                    const isDanger = days <= 7;
                    return (
                      <tr key={alert.id_alerte} className={isDanger ? 'row-danger' : ''}>
                        <td>{alert.id_marche?.reference || '—'}</td>
                        <td style={{ color: isDanger ? '#9a6e1a' : '#111827', fontWeight: isDanger ? 700 : 500 }}>
                          {days}
                        </td>
                        <td style={{ textTransform: 'capitalize' }}>{alert.niveau_alerte || '—'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
