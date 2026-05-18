import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Activity,
  ArrowRight,
  BarChart2,
  CheckCircle,
  ClipboardList,
  FileCheck,
  LogOut,
  Package,
  TrendingDown,
  TrendingUp,
  ShoppingBag,
  Clock,
  Gift,
} from 'lucide-react';
import NotificationBell from '../../components/layout/NotificationBell';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

import { getDashboard } from '../../api/reporting';
import { useAuthStore } from '../../store/authStore';

const STALE_TIME = 30_000;
const CHART_COLORS = ['#1D9E75', '#9FE1CB', '#5DCAA5', '#0F6E56'];

const URGENCE_BADGES = {
  normal: { label: 'Normal', bg: 'bg-surface', text: 'text-black/60' },
  moyen: { label: 'Moyen', bg: 'bg-gold-100', text: 'text-gold-600' },
  urgent: { label: 'Urgent', bg: 'bg-red-50', text: 'text-red-600' },
};

const DEMANDE_STATUT_BADGES = {
  en_attente: { label: 'En attente', bg: 'bg-brand-100', text: 'text-brand-700' },
  partielle: { label: 'Partielle', bg: 'bg-gold-100', text: 'text-gold-600' },
  totale: { label: 'Totale', bg: 'bg-green-50', text: 'text-green-700' },
  refusee: { label: 'Refusée', bg: 'bg-red-50', text: 'text-red-600' },
};

function pick(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function SkeletonCard() {
  return (
    <div className="relative overflow-hidden rounded-[24px] border border-white/60 bg-white/80 p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)] backdrop-blur-sm">
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-black/5 to-transparent" />
      <div className="space-y-3">
        <div className="h-3 w-28 rounded-full bg-black/5" />
        <div className="h-8 w-20 rounded-full bg-black/5" />
        <div className="h-3 w-36 rounded-full bg-black/5" />
      </div>
    </div>
  );
}

function Badge({ map, value }) {
  const entry = map[value];
  if (!entry) {
    return (
      <span className="inline-flex rounded-full bg-surface px-2.5 py-1 text-[11px] font-medium text-black/40">
        {value ?? '—'}
      </span>
    );
  }

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${entry.bg} ${entry.text}`}>
      {entry.label}
    </span>
  );
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bonjour';
  if (hour < 18) return 'Bon après-midi';
  return 'Bonsoir';
}

function getActivityTone(type) {
  if (type === 'decharge_signee') {
    return { bg: 'bg-green-50', icon: 'text-green-500', iconName: CheckCircle };
  }
  if (type === 'demande_recue') {
    return { bg: 'bg-amber-50', icon: 'text-amber-500', iconName: ClipboardList };
  }
  if (type === 'stock_alerte') {
    return { bg: 'bg-red-50', icon: 'text-red-500', iconName: AlertTriangle };
  }
  return { bg: 'bg-brand-100', icon: 'text-brand-700', iconName: FileCheck };
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const prenom = pick(user?.first_name, user?.firstName, user?.nom_complet, user?.nomComplet, user?.username, 'Gestionnaire');

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const dashboardQuery = useQuery({
    queryKey: ['reporting', 'dashboard'],
    queryFn: getDashboard,
    staleTime: STALE_TIME,
  });

  const dashboard = dashboardQuery.data?.data ?? dashboardQuery.data ?? {};
  const kpis = dashboard.kpis || dashboard;

  const totalArticles = pick(kpis?.total_articles, kpis?.totalArticles, dashboard.total_articles, dashboard.totalArticles, 0);
  const demandesEnCours = pick(kpis?.demandes_en_cours, kpis?.demandesEnCours, dashboard.demandes_en_cours, dashboard.demandesEnCours, 0);
  const dechargesEnAttente = pick(
    kpis?.decharges_en_attente,
    kpis?.dechargesEnAttente,
    kpis?.decharges_en_attente_signature,
    kpis?.dechargesEnAttenteSignature,
    dashboard.decharges_en_attente,
    dashboard.dechargesEnAttente,
    dashboard.decharges_en_attente_signature,
    dashboard.dechargesEnAttenteSignature,
    0,
  );
  const stockAlerts = pick(kpis?.stock_alerts, kpis?.stockAlerts, kpis?.stock_alerts_count, kpis?.stockAlertsCount, dashboard.stock_alerts, dashboard.stockAlerts, dashboard.stock_alerts_count, dashboard.stockAlertsCount, 0);
  const marchesEnAttente = pick(kpis?.marches_en_attente, kpis?.marchesEnAttente, dashboard.marches_en_attente, dashboard.marchesEnAttente, 0);
  const bcEnAttente = pick(kpis?.bc_en_attente, kpis?.bcEnAttente, dashboard.bc_en_attente, dashboard.bcEnAttente, 0);
  const donsEnAttente = pick(kpis?.dons_en_attente, kpis?.donsEnAttente, dashboard.dons_en_attente, dashboard.donsEnAttente, 0);
  const marchesDelaiProche = pick(kpis?.marches_delai_proche, kpis?.marchesDelaiProche, dashboard.marches_delai_proche, dashboard.marchesDelaiProche, 0);

  const acquisitionsData = useMemo(
    () => (dashboard.monthly_acquisitions ?? dashboard.monthlyAcquisitions ?? []).map((item) => ({
      mois: item.mois,
      entrees: Number(pick(item.entrees, item.entreesCount, 0)),
      sorties: Number(pick(item.sorties, item.sortiesCount, 0)),
    })),
    [dashboard.monthly_acquisitions, dashboard.monthlyAcquisitions],
  );

  const categoryData = useMemo(
    () => (dashboard.category_distribution ?? dashboard.categoryDistribution ?? []).map((item) => ({
      name: item.name,
      value: Number(item.value || 0),
    })),
    [dashboard.category_distribution, dashboard.categoryDistribution],
  );

  const recentDemandes = useMemo(
    () => [...(dashboard.recent_demandes ?? dashboard.recentDemandes ?? [])].sort(
      (a, b) => new Date(pick(b.date_demande, b.dateDemande, 0)) - new Date(pick(a.date_demande, a.dateDemande, 0)),
    ),
    [dashboard.recent_demandes, dashboard.recentDemandes],
  );

  const activeAlerts = useMemo(
    () => [...(dashboard.active_alerts ?? dashboard.activeAlerts ?? [])].sort((a, b) => Number(pick(a.jours, a.joursRestants, a.jours_restants, 9999)) - Number(pick(b.jours, b.joursRestants, b.jours_restants, 9999))),
    [dashboard.active_alerts, dashboard.activeAlerts],
  );

  const recentActivity = useMemo(
    () => dashboard.recent_activity ?? dashboard.recentActivity ?? [],
    [dashboard.recent_activity, dashboard.recentActivity],
  );

  const top5Consommables = useMemo(
    () => dashboard.top_5_consommables ?? dashboard.top5Consommables ?? [],
    [dashboard.top_5_consommables, dashboard.top5Consommables],
  );

  const greeting = getGreeting();
  const todayLabel = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const kpiCards = [
    {
      label: 'Articles en stock',
      value: totalArticles,
      delta: pick(kpis?.delta_articles, kpis?.deltaArticles, dashboard.delta_articles, dashboard.deltaArticles),
      icon: Package,
      iconBg: 'bg-brand-100',
      iconColor: 'text-brand-700',
      link: '/gestionnaire/stock',
      accent: '#16a34a',
    },
    {
      label: 'Demandes en cours',
      value: demandesEnCours,
      delta: pick(kpis?.delta_demandes, kpis?.deltaDemandes, dashboard.delta_demandes, dashboard.deltaDemandes),
      icon: ClipboardList,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      link: '/gestionnaire/demandes',
      accent: '#f59e0b',
    },
    {
      label: 'Décharges en attente',
      value: dechargesEnAttente,
      delta: null,
      icon: FileCheck,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      link: '/gestionnaire/decharges',
      accent: '#3b82f6',
    },
    {
      label: 'Alertes stock',
      value: stockAlerts,
      delta: null,
      icon: AlertTriangle,
      iconBg: 'bg-red-50',
      iconColor: 'text-red-500',
      link: '/gestionnaire/stock',
      accent: '#ef4444',
    },
    {
      label: 'Marchés en attente',
      value: marchesEnAttente,
      delta: null,
      icon: ShoppingBag,
      iconBg: 'bg-purple-50',
      iconColor: 'text-purple-600',
      link: '/gestionnaire/marches',
      accent: '#a855f7',
    },
    {
      label: 'Bons Commande en attente',
      value: bcEnAttente,
      delta: null,
      icon: ClipboardList,
      iconBg: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
      link: '/gestionnaire/bons-commande',
      accent: '#6366f1',
    },
    {
      label: 'Dons en attente',
      value: donsEnAttente,
      delta: null,
      icon: Gift,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      link: '/gestionnaire/dons',
      accent: '#10b981',
    },
    {
      label: 'Délai marchés proche',
      value: marchesDelaiProche,
      delta: null,
      icon: Clock,
      iconBg: 'bg-orange-50',
      iconColor: 'text-orange-600',
      link: '/gestionnaire/marches',
      accent: '#f97316',
    },
  ];

  const hasAcquisitionsData = acquisitionsData.some(
    (item) => item.entrees > 0 || item.sorties > 0,
  );
  const hasCategoryData = categoryData.some((item) => item.value > 0);

  const renderDelta = (delta) => {
    if (delta === null || delta === undefined) return null;
    const isPositive = Number(delta) >= 0;
    const DeltaIcon = isPositive ? TrendingUp : TrendingDown;

    return (
      <div className={`inline-flex items-center gap-1 text-[11px] font-medium ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
        <DeltaIcon size={12} />
        {Math.abs(Number(delta))}%
      </div>
    );
  };

  return (
    <div className="grid gap-6 rounded-[28px] bg-transparent">
      <div className="mb-4" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1
            style={{
              fontFamily: "'Bricolage Grotesque', sans-serif",
              fontSize: 28,
              fontWeight: 700,
              color: '#111827',
              margin: 0,
            }}
          >
            {greeting}, {prenom} 👋
          </h1>
          <p
            style={{
              fontSize: 13,
              color: 'rgba(0,0,0,0.4)',
              marginTop: 6,
            }}
          >
            Voici l&apos;état du magasin aujourd&apos;hui · {todayLabel}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
          <NotificationBell />
          <button
            onClick={handleLogout}
            type="button"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 44,
              borderRadius: 10,
              color: 'rgba(0,0,0,0.5)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.05)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            title="Déconnexion"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {dashboardQuery.isLoading
          ? Array.from({ length: 4 }).map((_, index) => <SkeletonCard key={`kpi-skeleton-${index}`} />)
          : kpiCards.map((kpi) => (
              <button
                key={kpi.label}
                type="button"
                onClick={() => navigate(kpi.link)}
                className="group relative overflow-hidden rounded-[18px] border border-white/70 bg-white/85 text-left shadow-[0_12px_32px_rgba(15,23,42,0.05)] backdrop-blur-sm transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)]"
                style={{ padding: '10px 12px', borderLeft: `3px solid ${kpi.accent}` }}
              >
                <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-black/5 to-transparent" />
                <div className="mb-2 flex items-start justify-between">
                  <div className={`flex items-center justify-center rounded-xl ${kpi.iconBg} shadow-sm ring-1 ring-black/5`} style={{ width: 28, height: 28 }}>
                    <kpi.icon size={14} className={kpi.iconColor} />
                  </div>
                  {renderDelta(kpi.delta)}
                </div>
                <p className="font-['Bricolage_Grotesque'] font-semibold tracking-[-0.04em] leading-none text-ink" style={{ fontSize: 22 }}>
                  {kpi.value}
                </p>
                <p className="mt-1 font-medium text-black/45" style={{ fontSize: 11 }}>{kpi.label}</p>
                {kpi.delta !== null && kpi.delta !== undefined && (
                  <p className="mt-1 text-black/30" style={{ fontSize: 10 }}>
                    {Number(kpi.delta) >= 0 ? '↑' : '↓'} vs mois dernier
                  </p>
                )}
              </button>
            ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(320px,0.9fr)]">
        <div className="rounded-[24px] border border-white/70 bg-white/85 p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)] backdrop-blur-sm xl:col-span-1">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h3 className="font-['Bricolage_Grotesque'] text-[15px] font-semibold tracking-[-0.02em] text-ink">
                Acquisitions des 12 derniers mois
              </h3>
              <p className="mt-0.5 text-[11px] text-black/45">Marchés, bons de commande et dons validés</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {[
                { color: '#1D9E75', label: 'Entrées' },
                { color: '#9FE1CB', label: 'Sorties' },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1.5 text-[11px] text-black/50">
                  <span className="inline-block h-2 w-2 rounded-[2px]" style={{ backgroundColor: color }} />
                  {label}
                </div>
              ))}
            </div>
          </div>

          {hasAcquisitionsData ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={acquisitionsData} margin={{ top: 4, right: 6, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="acquisitionsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1D9E75" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#1D9E75" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="rgba(15,23,42,0.05)" strokeDasharray="0" />
                <XAxis
                  dataKey="mois"
                  tick={{ fontSize: 10, fill: 'rgba(15,23,42,0.35)', fontFamily: 'DM Sans' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'rgba(15,23,42,0.35)', fontFamily: 'JetBrains Mono' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: '#fff',
                    border: '1px solid rgba(15,23,42,0.08)',
                    borderRadius: '10px',
                    fontSize: '12px',
                    fontFamily: 'DM Sans',
                    boxShadow: 'none',
                  }}
                  cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                />
                <Area type="monotone" dataKey="entrees" stroke="#1D9E75" strokeWidth={2.5} fill="url(#acquisitionsGradient)" dot={false} activeDot={{ r: 4, fill: '#1D9E75' }} />
                <Area type="monotone" dataKey="sorties" stroke="#9FE1CB" strokeWidth={2.5} fill="transparent" dot={false} activeDot={{ r: 4, fill: '#9FE1CB' }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[200px] flex-col items-center justify-center gap-2 rounded-[20px] bg-[linear-gradient(180deg,rgba(255,255,255,0.2),rgba(246,247,251,0.7))]">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5">
                <BarChart2 size={18} className="text-black/20" />
              </div>
              <p className="text-[12px] text-black/35">Aucune acquisition enregistrée</p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-[24px] border border-white/70 bg-white/85 p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)] backdrop-blur-sm">
            <h3 className="mb-4 font-['Bricolage_Grotesque'] text-[14px] font-semibold tracking-[-0.02em] text-ink">Répartition du stock</h3>

            {hasCategoryData ? (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={64}
                      dataKey="value"
                      paddingAngle={3}
                      startAngle={90}
                      endAngle={-270}
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={entry.name || index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: '#fff',
                        border: '1px solid rgba(15,23,42,0.08)',
                        borderRadius: '10px',
                        fontSize: '12px',
                        boxShadow: 'none',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                <div className="mt-2 flex flex-col gap-2">
                  {categoryData.map((entry, index) => (
                    <div key={`${entry.name}-${index}`} className="flex items-center justify-between text-[12px]">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-sm"
                          style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                        />
                        <span className="truncate text-black/60">{entry.name}</span>
                      </div>
                      <span className="font-jetbrains text-black/50">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex h-[160px] items-center justify-center rounded-[20px] bg-[linear-gradient(180deg,rgba(255,255,255,0.2),rgba(246,247,251,0.7))]">
                <p className="text-[12px] text-black/35">Aucune donnée</p>
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-[24px] border border-white/70 bg-white/85 shadow-[0_12px_32px_rgba(15,23,42,0.05)] backdrop-blur-sm">
            <div className="flex items-center justify-between border-b border-black/[0.04] px-5 py-4">
              <h3 className="font-['Bricolage_Grotesque'] text-[14px] font-semibold tracking-[-0.02em] text-ink">Alertes actives</h3>
              {activeAlerts.length > 0 && (
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600">
                  {activeAlerts.length}
                </span>
              )}
            </div>

            <div className="divide-y divide-black/[0.04]">
              {activeAlerts.length > 0 ? (
                activeAlerts.slice(0, 4).map((alert) => {
                  const days = Number(pick(alert.jours, alert.joursRestants, alert.jours_restants, 0));
                  const reference = pick(alert.reference, alert.id_marche?.reference, alert.idMarche?.reference, '—');
                  const progress = Number(pick(alert.progress, alert.progression, 0));
                  const isOverdue = days <= 0;

                  return (
                    <div key={pick(alert.id, alert.idAlerte, alert.id_alerte, reference)} className="px-5 py-3">
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full ring-4 ${
                            isOverdue ? 'bg-red-500 ring-red-50' : days <= 7 ? 'bg-orange-400 ring-orange-50' : 'bg-amber-400 ring-amber-50'
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <p className="truncate text-[12px] font-medium text-ink">{reference}</p>
                            <span className="flex-shrink-0 text-[10px] text-black/35">
                              {isOverdue ? `-${Math.abs(days)}j` : `${days}j`}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[11px] text-black/40">{isOverdue ? 'Délai dépassé' : 'Échéance proche'}</p>
                          <div className="mt-2 h-1.5 rounded-full bg-black/[0.05]">
                            <div
                              className={`h-full rounded-full ${isOverdue ? 'bg-red-500' : days <= 3 ? 'bg-orange-400' : 'bg-brand-500'}`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="px-5 py-8 text-center">
                  <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-green-50 shadow-[0_8px_20px_rgba(34,197,94,0.08)]">
                    <CheckCircle size={16} className="text-green-500" />
                  </div>
                  <p className="text-[12px] text-black/35">Aucune alerte active</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="overflow-hidden rounded-[24px] border border-white/70 bg-white/85 shadow-[0_12px_32px_rgba(15,23,42,0.05)] backdrop-blur-sm xl:col-span-2">
          <div className="flex items-center justify-between border-b border-black/[0.04] px-5 py-4">
            <h3 className="font-['Bricolage_Grotesque'] text-[14px] font-semibold tracking-[-0.02em] text-ink">5 dernières demandes</h3>
            <button
              type="button"
              onClick={() => navigate('/gestionnaire/demandes')}
              className="flex items-center gap-1 text-[11px] text-brand-700 transition-colors hover:text-brand-900"
            >
              Voir tout <ArrowRight size={11} />
            </button>
          </div>

          {dashboardQuery.isLoading ? (
            <div className="p-5">
              <div className="h-[140px] rounded-[18px] bg-[linear-gradient(180deg,rgba(255,255,255,0.2),rgba(246,247,251,0.8))]" />
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-[#fafbff]">
                <tr>
                  {['Réf.', 'Service', 'Urgence', 'Statut', 'Date'].map((header) => (
                    <th key={header} className="px-4 py-3 text-left text-[10px] uppercase tracking-[0.14em] text-black/35">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentDemandes.length > 0 ? (
                  recentDemandes.map((demande) => {
                    const demandeId = pick(demande.id, demande.id_demande, demande.idDemande);
                    const serviceName = pick(demande.service?.nom_service, demande.service?.nomService, '—');
                    const reference = pick(demande.reference, `#${demandeId}`);

                    return (
                      <tr
                        key={demandeId}
                        onClick={() => navigate(`/gestionnaire/demandes/${demandeId}`)}
                        className="cursor-pointer border-t border-black/[0.04] transition-colors hover:bg-brand-100/10"
                      >
                        <td className="px-4 py-3 font-jetbrains text-[12px] text-black/60">{reference}</td>
                        <td className="px-4 py-3 text-[13px] text-ink">{serviceName}</td>
                        <td className="px-4 py-3">
                          <Badge map={URGENCE_BADGES} value={demande.urgence} />
                        </td>
                        <td className="px-4 py-3">
                          <Badge map={DEMANDE_STATUT_BADGES} value={demande.statut} />
                        </td>
                        <td className="px-4 py-3 text-[12px] text-black/40">{formatDate(pick(demande.date_demande, demande.dateDemande))}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-[12px] text-black/35">
                      Aucune demande récente
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        <div className="overflow-hidden rounded-[24px] border border-white/70 bg-white/85 shadow-[0_12px_32px_rgba(15,23,42,0.05)] backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-black/[0.04] px-5 py-4">
            <h3 className="font-['Bricolage_Grotesque'] text-[14px] font-semibold tracking-[-0.02em] text-ink">Activité récente</h3>
            <Activity size={15} className="text-black/25" />
          </div>

          <div className="divide-y divide-black/[0.04]">
            {recentActivity.length > 0 ? (
              recentActivity.map((item) => {
                const tone = getActivityTone(item.type);
                const ActivityIcon = tone.iconName;

                return (
                  <div key={item.id} className="px-5 py-3">
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${tone.bg} ring-1 ring-black/5`}>
                        <ActivityIcon size={13} className={tone.icon} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="truncate text-[12px] text-ink">{item.title}</p>
                          <span className="flex-shrink-0 text-[10px] text-black/35">{formatDateTime(item.timestamp)}</span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-black/40">{item.description}</p>
                        <p className="mt-0.5 text-[10px] text-black/30">{item.time_ago}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="px-5 py-8 text-center">
                <p className="text-[12px] text-black/30">Aucune activité récente</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Top 5 Consommables */}
        <div className="overflow-hidden rounded-[24px] border border-white/70 bg-white/85 shadow-[0_12px_32px_rgba(15,23,42,0.05)] backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-black/[0.04] px-5 py-4">
            <h3 className="font-['Bricolage_Grotesque'] text-[14px] font-semibold tracking-[-0.02em] text-ink">Top Consommables (Stock bas)</h3>
            <Package size={15} className="text-black/25" />
          </div>

          <div className="divide-y divide-black/[0.04]">
            {top5Consommables.length > 0 ? (
              top5Consommables.map((item) => (
                <div key={item.id} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-medium text-ink">{item.designation}</p>
                      <p className="mt-0.5 text-[11px] text-black/40">
                        Seuil: {item.seuil_alerte ?? '—'}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-[13px] font-jetbrains font-bold ${item.alerte ? 'text-red-600' : 'text-green-600'}`}>
                        {item.quantite_disponible}
                      </p>
                      <p className="text-[10px] text-black/30 uppercase tracking-wider">Restants</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-5 py-8 text-center">
                <p className="text-[12px] text-black/30">Aucun consommable enregistré</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
