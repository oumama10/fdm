import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { AlertTriangle, ArrowDown, ArrowUp, Download, Package } from 'lucide-react';

import {
  getBilanAnnuel,
  getStatistiquesAchats,
  getStockInstantane,
  getStockPeriodique,
} from '../../api/reporting';
import { getRessources } from '../../api/resources';
import { getLots, getMarches } from '../../api/procurement';

const STALE_TIME = 30_000;
const PIE_COLORS = ['#0f6e56', '#9a6e1a', '#1f7663', '#0b3d4a', '#7d8f89'];
const YEAR_RANGE = 5;

function formatNumber(value) {
  return Number(value || 0).toLocaleString('fr-FR');
}

function formatTimestamp(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('fr-FR');
}

function sumByKey(rows, key) {
  return rows.reduce((acc, item) => acc + Number(item?.[key] || 0), 0);
}

function inDateRange(dateValue, dateDebut, dateFin) {
  if (!dateValue) return false;
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return false;

  if (dateDebut) {
    const start = new Date(`${dateDebut}T00:00:00`);
    if (d < start) return false;
  }
  if (dateFin) {
    const end = new Date(`${dateFin}T23:59:59`);
    if (d > end) return false;
  }
  return true;
}

function MetricDelta({ tone = 'neutral', children }) {
  const toneClass =
    tone === 'up'
      ? 'text-[#0F6E56]'
      : tone === 'down'
        ? 'text-[#A32D2D]'
        : 'text-black/40';
  const Icon = tone === 'up' ? ArrowUp : tone === 'down' ? ArrowDown : null;

  return (
    <div className={`text-[11px] flex items-center gap-[3px] mt-1 ${toneClass}`}>
      {Icon ? <Icon size={12} strokeWidth={2.25} /> : null}
      <span>{children}</span>
    </div>
  );
}

function SectionCard({ children }) {
  return (
    <section className="rounded-2xl bg-white border border-black/[0.06] p-5 overflow-hidden">
      {children}
    </section>
  );
}

function LegendRow({ items }) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {items.map(({ color, label }) => (
        <div key={label} className="flex items-center gap-1.5 text-[11px] text-black/50">
          <span className="w-2 h-2 rounded-[2px] inline-block" style={{ background: color }} />
          {label}
        </div>
      ))}
    </div>
  );
}

function TableEmptyState({ columnCount }) {
  return (
    <tr>
      <td colSpan={columnCount} className="py-10 text-center">
        <div className="flex flex-col items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-surface flex items-center justify-center">
            <Package size={16} className="text-black/25" />
          </div>
          <p className="text-[13px] text-black/35">Aucun article trouvé</p>
          <p className="text-[11px] text-black/25">Les données apparaîtront ici une fois importées</p>
        </div>
      </td>
    </tr>
  );
}

function DataFooter({ total, alertCount, okCount, columnCount }) {
  return (
    <tfoot>
      <tr className="bg-surface">
        <td className="px-[14px] py-[9px] text-[11px] text-black/40">
          {total} articles au total
        </td>
        <td colSpan={Math.max(columnCount - 1, 1)} className="px-[14px] py-[9px] text-[11px] text-black/35 text-right">
          {alertCount} alertes · {okCount} OK
        </td>
      </tr>
    </tfoot>
  );
}

function TableShell({ columns, rows, renderRow, total, alertCount, okCount }) {
  return (
    <table className="data-table text-[14px]">
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column} className="font-semibold">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <TableEmptyState columnCount={columns.length} />
        ) : (
          rows.map((row, index) => renderRow(row, index))
        )}
      </tbody>
      <DataFooter total={total} alertCount={alertCount} okCount={okCount} columnCount={columns.length} />
    </table>
  );
}

function StatField({ label, children, className = '' }) {
  return (
    <label className={`bg-white border border-black/[0.07] rounded-xl px-3 py-2 flex flex-col text-xs ${className}`}>
      <span className="text-[10px] uppercase tracking-[.05em] text-black/35 mb-0.5">{label}</span>
      {children}
    </label>
  );
}

function MetricCard({ label, value, accent = '#7d8f89', deltaTone = 'neutral', deltaText }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-black/[0.06] relative overflow-hidden">
      <span className="absolute top-0 left-0 bottom-0 w-[3px]" style={{ background: accent }} />
      <div className="text-[10px] uppercase tracking-[.06em] text-black/40 mb-[5px]">{label}</div>
      <div className="font-headings text-[26px] font-semibold text-ink leading-none">{value}</div>
      <MetricDelta tone={deltaTone}>{deltaText}</MetricDelta>
    </div>
  );
}

function TabsPill({ active, onClick, children, activeClassName }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? `rounded-[9px] px-4 py-[7px] text-sm font-medium ${activeClassName}`
          : 'rounded-[9px] px-4 py-[7px] text-sm text-black/45 hover:text-black/70 hover:bg-black/[0.04] transition'
      }
    >
      {children}
    </button>
  );
}

export default function ReportingPage() {
  const currentYear = new Date().getFullYear();

  const [mainTab, setMainTab] = useState('stock');
  const [stockSubTab, setStockSubTab] = useState('instantane');
  const [periodicSubmitted, setPeriodicSubmitted] = useState(false);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [periodicForm, setPeriodicForm] = useState({
    id_ressource: '',
    date_debut: '',
    date_fin: '',
    unite: 'mois',
  });
  const [achatsFilters, setAchatsFilters] = useState({
    date_debut: '',
    date_fin: '',
    type_acquisition: '',
    entite: '',
  });

  const stockInstantaneQuery = useQuery({
    queryKey: ['reporting', 'stock', 'instantane'],
    queryFn: getStockInstantane,
    staleTime: STALE_TIME,
  });

  const ressourcesQuery = useQuery({
    queryKey: ['resources', 'ressources', 'reporting'],
    queryFn: getRessources,
    staleTime: 60_000,
  });

  const stockPeriodiqueQuery = useQuery({
    queryKey: ['reporting', 'stock', 'periodique', periodicForm],
    queryFn: () => getStockPeriodique(periodicForm),
    enabled: periodicSubmitted && !!periodicForm.id_ressource,
    staleTime: STALE_TIME,
  });

  const bilanAnnuelQuery = useQuery({
    queryKey: ['reporting', 'bilan-annuel', selectedYear],
    queryFn: () => getBilanAnnuel(selectedYear),
    enabled: mainTab === 'bilan',
    staleTime: STALE_TIME,
  });

  const achatsStatsQuery = useQuery({
    queryKey: ['reporting', 'statistiques-achats', achatsFilters],
    queryFn: () => getStatistiquesAchats(achatsFilters),
    enabled: mainTab === 'achats',
    staleTime: STALE_TIME,
  });

  const marchesQuery = useQuery({
    queryKey: ['procurement', 'marches', 'reporting'],
    queryFn: getMarches,
    enabled: mainTab === 'achats',
    staleTime: STALE_TIME,
  });

  const lotsQuery = useQuery({
    queryKey: ['procurement', 'lots', 'reporting'],
    queryFn: () => getLots(),
    enabled: mainTab === 'achats',
    staleTime: STALE_TIME,
  });

  const stockInstantane = stockInstantaneQuery.data?.data || { consommables: [], bien_inventaire: [] };
  const stockConsommables = stockInstantane.consommables || [];
  const stockBienInventaire = stockInstantane.bien_inventaire || [];
  const consommablesEnAlerte = stockConsommables.filter((row) => row.alerte);
  const consommablesSousSeuil = stockConsommables.filter(
    (row) => Number(row.quantite_disponible || 0) < Number(row.seuil_alerte || 0)
  );

  const periodicChartData = useMemo(() => {
    const payload = stockPeriodiqueQuery.data?.data;
    if (!payload) return [];

    return (payload.labels || []).map((label, index) => ({
      periode: label,
      entrees: Number(payload.entrees?.[index] || 0),
      sorties: Number(payload.sorties?.[index] || 0),
    }));
  }, [stockPeriodiqueQuery.data?.data]);

  const bilanData = bilanAnnuelQuery.data?.data;
  const bilanSummary = useMemo(() => {
    const entrees = bilanData?.mouvements?.entrees_par_categorie || [];
    const sorties = bilanData?.mouvements?.sorties_par_categorie || [];

    return {
      totalAcquisitions: sumByKey(entrees, 'total'),
      totalSorties: sumByKey(sorties, 'total'),
      totalDonations: Number(bilanData?.donations || 0),
    };
  }, [bilanData]);

  const bilanMonthlyDataQuery = useQuery({
    queryKey: ['reporting', 'bilan-annuel-monthly', selectedYear],
    queryFn: () =>
      getStatistiquesAchats({
        date_debut: `${selectedYear}-01-01`,
        date_fin: `${selectedYear}-12-31`,
      }),
    enabled: mainTab === 'bilan',
    staleTime: STALE_TIME,
  });

  const bilanMonthlyData = (bilanMonthlyDataQuery.data?.data?.data || []).map((item) => ({
    mois: item.mois,
    total: Number(item.total || 0),
  }));

  const entitePieData = useMemo(() => {
    const rows = bilanData?.consommation_par_entite || [];
    const map = new Map([
      ['Médecine', 0],
      ['Pharmacie', 0],
      ['Dentaire', 0],
      ['Admin', 0],
      ['Labos', 0],
    ]);

    rows.forEach((row) => {
      const type = String(row.type_service || '').toLowerCase();
      const qty = Number(row.total_accorde || row.total_demande || 0);

      if (type === 'chu') map.set('Médecine', map.get('Médecine') + qty);
      else if (type === 'pharmacie') map.set('Pharmacie', map.get('Pharmacie') + qty);
      else if (type === 'dentaire') map.set('Dentaire', map.get('Dentaire') + qty);
      else if (type === 'labo') map.set('Labos', map.get('Labos') + qty);
      else map.set('Admin', map.get('Admin') + qty);
    });

    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [bilanData?.consommation_par_entite]);

  const achatsBarData = (achatsStatsQuery.data?.data?.data || []).map((item) => ({
    mois: item.mois,
    total: Number(item.total || 0),
  }));

  const topData = useMemo(() => {
    const marches = marchesQuery.data?.data || [];
    const lots = lotsQuery.data?.data || [];

    const filteredMarches = marches.filter((marche) => {
      if (!inDateRange(marche.date_creation, achatsFilters.date_debut, achatsFilters.date_fin)) return false;
      if (achatsFilters.type_acquisition && marche.type_acquisition !== achatsFilters.type_acquisition) return false;
      return true;
    });

    const marcheIds = new Set(filteredMarches.map((m) => Number(m.id_marche)));
    const filteredLots = lots.filter((lot) => marcheIds.has(Number(lot.id_marche)));

    const articleMap = new Map();
    filteredLots.forEach((lot) => {
      const key = lot.designation || lot.ressource?.designation || `Article #${lot.id_lot}`;
      articleMap.set(key, (articleMap.get(key) || 0) + Number(lot.quantite_commandee || 0));
    });

    const topArticles = Array.from(articleMap.entries())
      .map(([designation, volume]) => ({ designation, volume }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 10);

    const volumeParFournisseur = new Map();
    const lotsByMarche = filteredLots.reduce((acc, lot) => {
      const id = Number(lot.id_marche);
      acc.set(id, (acc.get(id) || 0) + Number(lot.quantite_commandee || 0));
      return acc;
    }, new Map());

    filteredMarches.forEach((marche) => {
      const fournisseur = marche?.fournisseur?.nom_societe || 'Non défini';
      const volume = lotsByMarche.get(Number(marche.id_marche)) || 0;
      volumeParFournisseur.set(fournisseur, (volumeParFournisseur.get(fournisseur) || 0) + volume);
    });

    const topFournisseurs = Array.from(volumeParFournisseur.entries())
      .map(([fournisseur, volume]) => ({ fournisseur, volume }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 5);

    return { topArticles, topFournisseurs };
  }, [marchesQuery.data?.data, lotsQuery.data?.data, achatsFilters.date_debut, achatsFilters.date_fin, achatsFilters.type_acquisition, achatsFilters.entite]);

  const ressources = ressourcesQuery.data?.data || [];
  const lastUpdatedAt = Math.max(
    stockInstantaneQuery.dataUpdatedAt || 0,
    stockPeriodiqueQuery.dataUpdatedAt || 0,
    bilanAnnuelQuery.dataUpdatedAt || 0,
    achatsStatsQuery.dataUpdatedAt || 0
  );
  const lastUpdatedLabel = formatTimestamp(lastUpdatedAt || Date.now());
  const yearOptions = Array.from({ length: YEAR_RANGE }, (_, index) => currentYear - index);
  const chartLegendItems = [
    { color: '#1D9E75', label: 'Entrées' },
    { color: '#9FE1CB', label: 'Sorties' },
  ];

  const stockKpis = [
    {
      label: 'Alertes',
      value: formatNumber(consommablesEnAlerte.length),
      accent: '#A32D2D',
      deltaTone: consommablesEnAlerte.length > 0 ? 'down' : 'neutral',
      deltaText: consommablesEnAlerte.length > 0 ? `${consommablesEnAlerte.length} à traiter` : 'Aucune alerte',
    },
    {
      label: 'Valeur',
      value: formatNumber(sumByKey(stockConsommables, 'quantite_disponible')),
      accent: '#7d8f89',
      deltaTone: 'neutral',
      deltaText: 'Total instantané',
    },
    {
      label: 'Sous seuil',
      value: formatNumber(consommablesSousSeuil.length),
      accent: '#A32D2D',
      deltaTone: consommablesSousSeuil.length > 0 ? 'down' : 'neutral',
      deltaText: consommablesSousSeuil.length > 0 ? `${consommablesSousSeuil.length} en dessous` : 'Seuil respecté',
    },
    {
      label: 'Rotation',
      value: formatNumber(sumByKey(stockBienInventaire, 'en_service')),
      accent: '#9a6e1a',
      deltaTone: stockBienInventaire.length > 0 ? 'up' : 'neutral',
      deltaText: stockBienInventaire.length > 0 ? 'En service' : 'Aucune donnée',
    },
  ];

  const bilanKpis = [
    {
      label: 'Acquisitions',
      value: formatNumber(bilanSummary.totalAcquisitions),
      accent: '#1D9E75',
      deltaTone: 'up',
      deltaText: 'Flux d’entrées',
    },
    {
      label: 'Sorties',
      value: formatNumber(bilanSummary.totalSorties),
      accent: '#7d8f89',
      deltaTone: 'down',
      deltaText: 'Flux sortants',
    },
    {
      label: 'Donations',
      value: formatNumber(bilanSummary.totalDonations),
      accent: '#9a6e1a',
      deltaTone: 'neutral',
      deltaText: 'Dons enregistrés',
    },
  ];

  const achatsTotal = formatNumber(achatsBarData.reduce((acc, row) => acc + Number(row.total || 0), 0));
  const achatsKpis = [
    {
      label: 'Volume achats',
      value: achatsTotal,
      accent: '#1D9E75',
      deltaTone: 'up',
      deltaText: 'Total filtré',
    },
    {
      label: 'Articles suivis',
      value: formatNumber(topData.topArticles.length),
      accent: '#7d8f89',
      deltaTone: 'neutral',
      deltaText: 'Top 10 affiché',
    },
    {
      label: 'Fournisseurs',
      value: formatNumber(topData.topFournisseurs.length),
      accent: '#9a6e1a',
      deltaTone: 'neutral',
      deltaText: 'Top 5 affiché',
    },
  ];

  const renderMainTabButton = (value, label) => (
    <TabsPill
      key={value}
      active={mainTab === value}
      activeClassName="bg-brand-500 text-white"
      onClick={() => setMainTab(value)}
    >
      {label}
    </TabsPill>
  );

  const renderModeButton = (value, label) => (
    <TabsPill
      key={value}
      active={stockSubTab === value}
      activeClassName="bg-[#1A1A2E] text-white"
      onClick={() => setStockSubTab(value)}
    >
      {label}
    </TabsPill>
  );

  return (
    <div className="page-stack">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-headings text-[22px] font-semibold text-ink leading-tight">Reporting</h1>
          <p className="mt-1 text-[11px] text-black/40">Dernière mise à jour : {lastUpdatedLabel}</p>
        </div>

        <button type="button" className="btn btn-primary flex items-center gap-2 rounded-xl">
          <Download size={16} />
          Exporter PDF
        </button>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="bg-white border border-black/[0.07] rounded-xl p-[3px] flex gap-[2px]">
          {renderMainTabButton('stock', 'État du stock')}
          {renderMainTabButton('bilan', 'Bilan annuel')}
          {renderMainTabButton('achats', 'Statistiques achats')}
        </div>

        <div className="flex items-center gap-3 flex-wrap justify-end">
          <div className="bg-white border border-black/[0.07] rounded-xl p-[3px] flex gap-[2px]">
            {renderModeButton('instantane', 'Instantané')}
            {renderModeButton('periodique', 'Périodique')}
          </div>

          <div
            className={`bg-white border border-black/[0.07] rounded-xl px-3 py-[7px] flex items-center gap-2 text-xs ${
              stockSubTab === 'instantane' ? 'opacity-50 pointer-events-none' : ''
            }`}
          >
            <span className="text-black/45">Du</span>
            <input
              type="date"
              value={periodicForm.date_debut}
              disabled={stockSubTab === 'instantane'}
              onChange={(e) => setPeriodicForm((prev) => ({ ...prev, date_debut: e.target.value }))}
              className="border-none bg-transparent text-sm text-ink outline-none font-['DM_Sans'] disabled:cursor-not-allowed"
            />
            <span className="text-black/45">Au</span>
            <input
              type="date"
              value={periodicForm.date_fin}
              disabled={stockSubTab === 'instantane'}
              onChange={(e) => setPeriodicForm((prev) => ({ ...prev, date_fin: e.target.value }))}
              className="border-none bg-transparent text-sm text-ink outline-none font-['DM_Sans'] disabled:cursor-not-allowed"
            />
          </div>
        </div>
      </div>

      {mainTab === 'stock' && consommablesEnAlerte.length > 0 ? (
        <div className="bg-red-50 border border-red-200/60 rounded-xl px-5 py-3 flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <AlertTriangle size={16} className="text-red-600" />
            <div>
              <p className="text-sm font-medium text-red-700">
                {consommablesEnAlerte.length} articles sous seuil d'alerte
              </p>
              <p className="text-xs text-red-500/70 mt-0.5">
                {consommablesEnAlerte.map((item) => item.designation).join(' · ')} — action requise
              </p>
            </div>
          </div>
          <button type="button" className="bg-red-700 text-white text-xs px-3 py-1.5 rounded-lg">
            Voir les alertes
          </button>
        </div>
      ) : null}

      {mainTab === 'stock' ? (
        <div className="grid gap-5">
          <div className="grid gap-4 md:grid-cols-4">
            {stockKpis.map((card) => (
              <MetricCard key={card.label} {...card} />
            ))}
          </div>

          {stockSubTab === 'instantane' ? (
            <div className="grid gap-5">
              <div className="grid gap-5 xl:grid-cols-2">
                <SectionCard>
                  <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
                    <h3 className="m-0 text-base font-semibold text-ink">Consommables</h3>
                  </div>
                  <TableShell
                    columns={['Désignation', 'Qté dispo', 'Seuil', 'Alerte']}
                    rows={stockConsommables}
                    total={stockConsommables.length}
                    alertCount={consommablesEnAlerte.length}
                    okCount={stockConsommables.length - consommablesEnAlerte.length}
                    renderRow={(row) => (
                      <tr key={row.id}>
                        <td>{row.designation}</td>
                        <td>{formatNumber(row.quantite_disponible)}</td>
                        <td>{formatNumber(row.seuil_alerte)}</td>
                        <td>
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${
                              row.alerte ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                            }`}
                          >
                            {row.alerte ? 'Alerte' : 'OK'}
                          </span>
                        </td>
                      </tr>
                    )}
                  />
                </SectionCard>

                <SectionCard>
                  <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
                    <h3 className="m-0 text-base font-semibold text-ink">Biens inventaire</h3>
                  </div>
                  <TableShell
                    columns={['Désignation', 'Total', 'En stock', 'En service', 'En maintenance']}
                    rows={stockBienInventaire}
                    total={stockBienInventaire.length}
                    alertCount={0}
                    okCount={stockBienInventaire.length}
                    renderRow={(row) => (
                      <tr key={row.id}>
                        <td>{row.designation}</td>
                        <td>{formatNumber(row.total_instances)}</td>
                        <td>{formatNumber(row.en_stock)}</td>
                        <td>{formatNumber(row.en_service)}</td>
                        <td>{formatNumber(row.en_maintenance)}</td>
                      </tr>
                    )}
                  />
                </SectionCard>
              </div>

              <SectionCard>
                <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
                  <h3 className="m-0 text-base font-semibold text-ink">Périodique</h3>
                </div>
                <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_1fr_auto] items-end">
                  <StatField label="Ressource">
                    <select
                      className="border-none bg-transparent text-sm text-ink outline-none font-['DM_Sans']"
                      value={periodicForm.id_ressource}
                      onChange={(e) => setPeriodicForm((prev) => ({ ...prev, id_ressource: e.target.value }))}
                    >
                      <option value="">Sélectionner</option>
                      {ressources.map((item) => (
                        <option key={item.id_ressource} value={item.id_ressource}>
                          {item.designation}
                        </option>
                      ))}
                    </select>
                  </StatField>

                  <StatField label="Date début">
                    <input
                      type="date"
                      value={periodicForm.date_debut}
                      onChange={(e) => setPeriodicForm((prev) => ({ ...prev, date_debut: e.target.value }))}
                      className="border-none bg-transparent text-sm text-ink outline-none font-['DM_Sans']"
                    />
                  </StatField>

                  <StatField label="Date fin">
                    <input
                      type="date"
                      value={periodicForm.date_fin}
                      onChange={(e) => setPeriodicForm((prev) => ({ ...prev, date_fin: e.target.value }))}
                      className="border-none bg-transparent text-sm text-ink outline-none font-['DM_Sans']"
                    />
                  </StatField>

                  <StatField label="Unité">
                    <select
                      className="border-none bg-transparent text-sm text-ink outline-none font-['DM_Sans']"
                      value={periodicForm.unite}
                      onChange={(e) => setPeriodicForm((prev) => ({ ...prev, unite: e.target.value }))}
                    >
                      <option value="jour">jour</option>
                      <option value="mois">mois</option>
                      <option value="annee">année</option>
                    </select>
                  </StatField>

                  <button
                    type="button"
                    className="btn btn-primary rounded-xl"
                    onClick={() => setPeriodicSubmitted(true)}
                    disabled={!periodicForm.id_ressource}
                  >
                    Afficher
                  </button>
                </div>
              </SectionCard>

              <SectionCard>
                <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
                  <h3 className="m-0 text-base font-semibold text-ink">Évolution</h3>
                  <LegendRow items={chartLegendItems} />
                </div>
                <div className="w-full h-[280px]">
                  <ResponsiveContainer>
                    <LineChart data={periodicChartData}>
                      <CartesianGrid vertical={false} stroke="rgba(0,0,0,0.05)" strokeDasharray="0" />
                      <XAxis
                        dataKey="periode"
                        tick={{ fontSize: 10, fill: 'rgba(0,0,0,0.3)', fontFamily: 'DM Sans' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 10, fill: 'rgba(0,0,0,0.3)', fontFamily: 'JetBrains Mono' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          background: '#fff',
                          border: '1px solid rgba(0,0,0,0.08)',
                          borderRadius: '10px',
                          fontSize: '12px',
                          fontFamily: 'DM Sans',
                          boxShadow: 'none',
                        }}
                        cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                      />
                      <Line type="monotone" dataKey="entrees" stroke="#1D9E75" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="sorties" stroke="#9FE1CB" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>

              <SectionCard>
                <h3 className="m-0 mb-4 text-base font-semibold text-ink">Résumé</h3>
                <TableShell
                  columns={['Période', 'Entrées', 'Sorties']}
                  rows={periodicChartData}
                  total={periodicChartData.length}
                  alertCount={0}
                  okCount={periodicChartData.length}
                  renderRow={(row) => (
                    <tr key={row.periode}>
                      <td>{row.periode}</td>
                      <td>{formatNumber(row.entrees)}</td>
                      <td>{formatNumber(row.sorties)}</td>
                    </tr>
                  )}
                />
              </SectionCard>
            </div>
          ) : null}
        </div>
      ) : null}

      {mainTab === 'bilan' ? (
        <div className="grid gap-5">
          <div className="grid gap-4 md:grid-cols-3">
            {bilanKpis.map((card) => (
              <MetricCard key={card.label} {...card} />
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <StatField label="Année" className="w-[180px]">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="border-none bg-transparent text-sm text-ink outline-none font-['DM_Sans']"
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </StatField>

          </div>

          <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
            <SectionCard>
              <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
                <h3 className="m-0 text-base font-semibold text-ink">Acquisitions par mois</h3>
                <LegendRow items={chartLegendItems} />
              </div>
              <div className="w-full h-[280px]">
                <ResponsiveContainer>
                  <BarChart
                    data={bilanMonthlyData}
                    barCategoryGap="35%"
                    barGap={3}
                    margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} stroke="rgba(0,0,0,0.05)" strokeDasharray="0" />
                    <XAxis
                      dataKey="mois"
                      tick={{ fontSize: 10, fill: 'rgba(0,0,0,0.3)', fontFamily: 'DM Sans' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 10, fill: 'rgba(0,0,0,0.3)', fontFamily: 'JetBrains Mono' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#fff',
                        border: '1px solid rgba(0,0,0,0.08)',
                        borderRadius: '10px',
                        fontSize: '12px',
                        fontFamily: 'DM Sans',
                        boxShadow: 'none',
                      }}
                      cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                    />
                    <Bar dataKey="total" fill="#1D9E75" radius={[4, 4, 0, 0]} barSize={10} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>

            <SectionCard>
              <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
                <h3 className="m-0 text-base font-semibold text-ink">Consommation par entité</h3>
                <LegendRow
                  items={entitePieData.map((item, index) => ({ color: PIE_COLORS[index % PIE_COLORS.length], label: item.name }))}
                />
              </div>
              <div className="w-full h-[280px]">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={entitePieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}>
                      {entitePieData.map((entry, index) => (
                        <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: '#fff',
                        border: '1px solid rgba(0,0,0,0.08)',
                        borderRadius: '10px',
                        fontSize: '12px',
                        fontFamily: 'DM Sans',
                        boxShadow: 'none',
                      }}
                      cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          </div>

          <SectionCard>
            <h3 className="m-0 mb-4 text-base font-semibold text-ink">Marchés</h3>
            <TableShell
              columns={['Réceptionnés', 'Non conformes', 'En attente']}
              rows={bilanData?.marches ? [bilanData.marches] : []}
              total={bilanData?.marches ? 1 : 0}
              alertCount={Number(bilanData?.marches?.non_conformes || 0)}
              okCount={Number(bilanData?.marches?.receptionnes || 0)}
              renderRow={(row) => (
                <tr key="marches-summary">
                  <td>{formatNumber(row.receptionnes)}</td>
                  <td>{formatNumber(row.non_conformes)}</td>
                  <td>{formatNumber(row.en_attente)}</td>
                </tr>
              )}
            />
          </SectionCard>
        </div>
      ) : null}

      {mainTab === 'achats' ? (
        <div className="grid gap-5">
          <div className="grid gap-4 md:grid-cols-3">
            {achatsKpis.map((card) => (
              <MetricCard key={card.label} {...card} />
            ))}
          </div>

          <div className="mb-6 flex items-center gap-2 flex-wrap">
            <StatField label="Début" className="min-w-[160px]">
              <input
                type="date"
                value={achatsFilters.date_debut}
                onChange={(e) => setAchatsFilters((prev) => ({ ...prev, date_debut: e.target.value }))}
                className="border-none bg-transparent text-sm text-ink outline-none font-['DM_Sans']"
              />
            </StatField>
            <StatField label="Fin" className="min-w-[160px]">
              <input
                type="date"
                value={achatsFilters.date_fin}
                onChange={(e) => setAchatsFilters((prev) => ({ ...prev, date_fin: e.target.value }))}
                className="border-none bg-transparent text-sm text-ink outline-none font-['DM_Sans']"
              />
            </StatField>
            <StatField label="Type" className="min-w-[180px]">
              <select
                value={achatsFilters.type_acquisition}
                onChange={(e) => setAchatsFilters((prev) => ({ ...prev, type_acquisition: e.target.value }))}
                className="border-none bg-transparent text-sm text-ink outline-none font-['DM_Sans']"
              >
                <option value="">Tous</option>
                <option value="marche">Marché</option>
                <option value="bon_commande">Bon commande</option>
                <option value="donation">Don</option>
              </select>
            </StatField>
            <StatField label="Entité" className="min-w-[180px]">
              <select
                value={achatsFilters.entite}
                onChange={(e) => setAchatsFilters((prev) => ({ ...prev, entite: e.target.value }))}
                className="border-none bg-transparent text-sm text-ink outline-none font-['DM_Sans']"
              >
                <option value="">Toutes</option>
                <option value="chu">Médecine</option>
                <option value="pharmacie">Pharmacie</option>
                <option value="dentaire">Dentaire</option>
                <option value="administratif">Admin</option>
                <option value="labo">Labos</option>
              </select>
            </StatField>
          </div>

          <SectionCard>
            <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
              <h3 className="m-0 text-base font-semibold text-ink">Achats par mois</h3>
              <LegendRow items={[{ color: '#1D9E75', label: 'Achats' }]} />
            </div>
            <div className="w-full h-[280px]">
              <ResponsiveContainer>
                <BarChart
                  data={achatsBarData}
                  barCategoryGap="35%"
                  barGap={3}
                  margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} stroke="rgba(0,0,0,0.05)" strokeDasharray="0" />
                  <XAxis
                    dataKey="mois"
                    tick={{ fontSize: 10, fill: 'rgba(0,0,0,0.3)', fontFamily: 'DM Sans' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 10, fill: 'rgba(0,0,0,0.3)', fontFamily: 'JetBrains Mono' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#fff',
                      border: '1px solid rgba(0,0,0,0.08)',
                      borderRadius: '10px',
                      fontSize: '12px',
                      fontFamily: 'DM Sans',
                      boxShadow: 'none',
                    }}
                    cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                  />
                  <Bar dataKey="total" fill="#1D9E75" radius={[4, 4, 0, 0]} barSize={10} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          <div className="grid gap-5 xl:grid-cols-2">
            <SectionCard>
              <h3 className="m-0 mb-4 text-base font-semibold text-ink">Top 10 articles les plus commandés</h3>
              <TableShell
                columns={['Article', 'Volume']}
                rows={topData.topArticles}
                total={topData.topArticles.length}
                alertCount={0}
                okCount={topData.topArticles.length}
                renderRow={(row) => (
                  <tr key={row.designation}>
                    <td>{row.designation}</td>
                    <td>{formatNumber(row.volume)}</td>
                  </tr>
                )}
              />
            </SectionCard>

            <SectionCard>
              <h3 className="m-0 mb-4 text-base font-semibold text-ink">Top 5 fournisseurs par volume</h3>
              <TableShell
                columns={['Fournisseur', 'Volume']}
                rows={topData.topFournisseurs}
                total={topData.topFournisseurs.length}
                alertCount={0}
                okCount={topData.topFournisseurs.length}
                renderRow={(row) => (
                  <tr key={row.fournisseur}>
                    <td>{row.fournisseur}</td>
                    <td>{formatNumber(row.volume)}</td>
                  </tr>
                )}
              />
            </SectionCard>
          </div>
        </div>
      ) : null}
    </div>
  );
}
