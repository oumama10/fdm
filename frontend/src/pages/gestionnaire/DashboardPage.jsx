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
      style={{
        height: 112,
        borderRadius: 12,
        background: 'linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%)',
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
    <span
      style={{
        display: 'inline-block',
        fontSize: 12,
        fontWeight: 600,
        borderRadius: 999,
        padding: '4px 10px',
        background: tone.bg,
        color: tone.color,
        textTransform: 'capitalize',
      }}
    >
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
    queryFn: getDemandes,
    staleTime: STALE_TIME,
  });

  const alertesQuery = useQuery({
    queryKey: ['alertes', 'actives'],
    queryFn: getAlertes,
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
    <div style={{ display: 'grid', gap: 20 }}>
      <h1 style={{ margin: 0, fontSize: 24 }}>Dashboard Gestionnaire</h1>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: 14,
        }}
      >
        {isTopLoading
          ? Array.from({ length: 4 }).map((_, idx) => <SkeletonCard key={`sk-card-${idx}`} />)
          : cards.map((card) => (
              <div
                key={card.title}
                style={{
                  borderRadius: 12,
                  padding: 16,
                  border: `1px solid ${card.danger ? '#fecaca' : '#e5e7eb'}`,
                  background: card.danger ? '#fff5f5' : '#ffffff',
                }}
              >
                <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>{card.title}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: card.danger ? '#b91c1c' : '#111827' }}>
                  {card.value}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>{card.subtitle}</div>
              </div>
            ))}
      </section>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: 16,
        }}
      >
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14 }}>
          <h3 style={{ margin: '0 0 12px' }}>Acquisitions des 12 derniers mois</h3>
          {isChartLoading ? (
            <div style={{ height: 280, borderRadius: 8, background: '#f3f4f6' }} />
          ) : (
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mois" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="total" fill="#2563eb" name="Entrées" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14 }}>
          <h3 style={{ margin: '0 0 12px' }}>Répartition par catégorie</h3>
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

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: 16,
          alignItems: 'start',
        }}
      >
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: 14, borderBottom: '1px solid #f3f4f6', fontWeight: 700 }}>5 dernières demandes</div>
          {isBottomLoading ? (
            <div style={{ padding: 14 }}>
              <div style={{ height: 160, borderRadius: 8, background: '#f3f4f6' }} />
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                  <th style={{ padding: 10 }}>ID</th>
                  <th style={{ padding: 10 }}>Service</th>
                  <th style={{ padding: 10 }}>Urgence</th>
                  <th style={{ padding: 10 }}>Statut</th>
                  <th style={{ padding: 10 }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {latestDemandes.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 16, color: '#6b7280' }}>
                      Aucune demande trouvée.
                    </td>
                  </tr>
                ) : (
                  latestDemandes.map((row) => {
                    const demandeId = row.id_demande ?? row.id;
                    const serviceName = row.id_service?.nom_service || row.service || '—';
                    return (
                      <tr
                        key={demandeId}
                        onClick={() => navigate(`/gestionnaire/demandes/${demandeId}`)}
                        style={{
                          borderTop: '1px solid #f3f4f6',
                          cursor: 'pointer',
                        }}
                      >
                        <td style={{ padding: 10 }}>#{demandeId}</td>
                        <td style={{ padding: 10 }}>{serviceName}</td>
                        <td style={{ padding: 10 }}>
                          <Badge type="urgence" value={row.urgence} />
                        </td>
                        <td style={{ padding: 10 }}>
                          <Badge type="statut" value={row.statut} />
                        </td>
                        <td style={{ padding: 10 }}>{formatDate(row.date_demande)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: 14, borderBottom: '1px solid #f3f4f6', fontWeight: 700 }}>Alertes délai actives</div>
          {isBottomLoading ? (
            <div style={{ padding: 14 }}>
              <div style={{ height: 160, borderRadius: 8, background: '#f3f4f6' }} />
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                  <th style={{ padding: 10 }}>Référence</th>
                  <th style={{ padding: 10 }}>Jours</th>
                  <th style={{ padding: 10 }}>Niveau</th>
                </tr>
              </thead>
              <tbody>
                {activeAlertes.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ padding: 16, color: '#6b7280' }}>
                      Aucune alerte active.
                    </td>
                  </tr>
                ) : (
                  activeAlertes.map((alert) => {
                    const days = Number(alert.jours_restants ?? 0);
                    const isDanger = days <= 7;
                    return (
                      <tr key={alert.id_alerte} style={{ borderTop: '1px solid #f3f4f6', background: isDanger ? '#fff5f5' : '#fff' }}>
                        <td style={{ padding: 10 }}>{alert.id_marche?.reference || '—'}</td>
                        <td style={{ padding: 10, color: isDanger ? '#b91c1c' : '#111827', fontWeight: isDanger ? 700 : 500 }}>
                          {days}
                        </td>
                        <td style={{ padding: 10, textTransform: 'capitalize' }}>{alert.niveau_alerte || '—'}</td>
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
