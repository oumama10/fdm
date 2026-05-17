import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart2,
  Box,
  Boxes,
  Calendar,
  Gift,
  Package,
  ShoppingBag,
  TrendingUp,
} from 'lucide-react';

import {
  getBilanAnnuel,
  getStatistiquesAchats,
  getStockInstantane,
  getStockPeriodique,
} from '../../api/reporting';
import { getRessources } from '../../api/resources';
import { getLots, getMarches } from '../../api/procurement';

const STALE_TIME = 30_000;

const TABS = [
  { key: 'stock',  label: 'État du Stock',        accent: '#0C447C', soft: '#E6F1FB' },
  { key: 'bilan',  label: 'Bilan Annuel',          accent: '#7c3aed', soft: '#f5f3ff' },
  { key: 'achats', label: 'Statistiques Achats',   accent: '#0d9488', soft: '#f0fdfa' },
];

const STOCK_SUBTABS = [
  { key: 'instantane', label: 'Instantané' },
  { key: 'periodique', label: 'Périodique' },
];

const PIE_COLORS = ['#0C447C', '#16a34a', '#f59e0b', '#7c3aed', '#ef4444'];

// ── helpers ───────────────────────────────────────────────────────────────────
function pick(a, b, fallback = 0) { return a ?? b ?? fallback; }
function fmt(v) { return Number(v || 0).toLocaleString('fr-FR'); }
function sumKey(rows, key) { return rows.reduce((s, r) => s + Number(r?.[key] || 0), 0); }
function inDateRange(d, from, to) {
  if (!d) return false;
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return false;
  if (from && date < new Date(`${from}T00:00:00`)) return false;
  if (to   && date > new Date(`${to}T23:59:59`))   return false;
  return true;
}

// ── custom chart tooltip ──────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 12px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', minWidth: 120 }}>
      {label && <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 5, fontWeight: 600 }}>{label}</div>}
      {payload.map((p) => (
        <div key={p.dataKey} style={{ fontSize: 13, fontWeight: 600, color: p.color }}>
          {p.name} : {fmt(p.value)}
        </div>
      ))}
    </div>
  );
}

// ── sub-components ────────────────────────────────────────────────────────────
function KpiCard({ label, value, icon: Icon, accent, soft, unit }) {
  return (
    <div style={{ border: '1px solid', borderRadius: 14, padding: '14px 16px', borderColor: `${accent}22`, background: soft }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: `${accent}22` }}>
          <Icon size={18} color={accent} strokeWidth={2} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#475569', marginBottom: 2 }}>{label}</div>
          <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1, color: accent }}>{fmt(value)}</div>
          {unit && <div style={{ fontSize: 11, color: accent, opacity: 0.7, fontWeight: 500, marginTop: 1 }}>{unit}</div>}
        </div>
      </div>
    </div>
  );
}

function SectionShell({ title, children, action }) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 14, background: '#fff', overflow: 'hidden' }}>
      {title && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #e5e7eb', background: '#f8fafc' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{title}</span>
          {action}
        </div>
      )}
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}

function TableShell({ columns, rows, empty = 'Aucune donnée.' }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={tableStyle}>
        <thead>
          <tr style={headRowStyle}>
            {columns.map((c) => (
              <th key={c.key} style={{ ...thStyle, width: c.width }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0
            ? <tr><td colSpan={columns.length} style={emptyCellStyle}>{empty}</td></tr>
            : rows.map((row, i) => (
              <tr key={i} style={row._rowStyle || bodyRowStyle}>
                {columns.map((c) => (
                  <td key={c.key} style={tdStyle}>{row[c.key]}</td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

function AlertBadge({ isAlert }) {
  return isAlert
    ? <span style={{ ...pillBase, background: '#fee2e2', color: '#991b1b' }}>⚠ Alerte</span>
    : <span style={{ ...pillBase, background: '#dcfce7', color: '#166534' }}>OK</span>;
}

function FilterBar({ children }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
      {children}
    </div>
  );
}

function FieldLabel({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600, color: '#475569' }}>
      {label}
      {children}
    </label>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────
export default function ReportingPage() {
  const currentYear = new Date().getFullYear();

  const [mainTab, setMainTab] = useState('stock');
  const [stockSubTab, setStockSubTab] = useState('instantane');

  const [periodicForm, setPeriodicForm] = useState({ id_ressource: '', date_debut: '', date_fin: '', unite: 'mois' });
  const [periodicSubmitted, setPeriodicSubmitted] = useState(false);

  const [selectedYear, setSelectedYear] = useState(currentYear);

  const [achatsFilters, setAchatsFilters] = useState({ date_debut: '', date_fin: '', type_acquisition: '', entite: '' });

  // ── queries ────────────────────────────────────────────────────────────────
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
  const bilanMonthlyQuery = useQuery({
    queryKey: ['reporting', 'bilan-monthly', selectedYear],
    queryFn: () => getStatistiquesAchats({ date_debut: `${selectedYear}-01-01`, date_fin: `${selectedYear}-12-31` }),
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

  // ── derived data ───────────────────────────────────────────────────────────
  const rawInstantane = stockInstantaneQuery.data?.data || {};
  const consommables  = rawInstantane.consommables || [];
  const bienInventaire = rawInstantane.bienInventaire ?? rawInstantane.bien_inventaire ?? [];

  const consAlertCount = consommables.filter((r) => {
    const qty   = pick(r.quantiteDisponible, r.quantite_disponible);
    const seuil = pick(r.seuilAlerte, r.seuil_alerte, null);
    return seuil !== null && qty <= seuil;
  }).length;

  const periodicChartData = useMemo(() => {
    const p = stockPeriodiqueQuery.data?.data;
    if (!p) return [];
    return (p.labels || []).map((label, i) => ({
      periode: label,
      entrees: Number((p.entrees || [])[i] || 0),
      sorties: Number((p.sorties || [])[i] || 0),
    }));
  }, [stockPeriodiqueQuery.data?.data]);

  const bilanData = bilanAnnuelQuery.data?.data;
  const bilanSummary = useMemo(() => {
    const mouvements = bilanData?.mouvements || {};
    const entrees = mouvements.entreesParCategorie ?? mouvements.entrees_par_categorie ?? [];
    const sorties = mouvements.sortiesParCategorie ?? mouvements.sorties_par_categorie ?? [];
    return {
      totalAcquisitions: sumKey(entrees, 'total'),
      totalSorties:      sumKey(sorties, 'total'),
      totalDonations:    Number(bilanData?.donations || 0),
      rebuts:            Number(bilanData?.rebuts || 0),
      transferts:        Number(bilanData?.transferts || 0),
    };
  }, [bilanData]);

  const bilanMonthlyData = (bilanMonthlyQuery.data?.data?.data || []).map((item) => ({
    mois:  item.mois,
    total: Number(item.total || 0),
  }));

  const entitePieData = useMemo(() => {
    const rows = bilanData?.consommationParEntite ?? bilanData?.consommation_par_entite ?? [];
    const map = new Map([['Médecine', 0], ['Pharmacie', 0], ['Dentaire', 0], ['Admin', 0], ['Labos', 0]]);
    rows.forEach((row) => {
      const type = String(row.typeService ?? row.type_service ?? '').toLowerCase();
      const qty  = Number(row.totalAccorde ?? row.total_accorde ?? row.totalDemande ?? row.total_demande ?? 0);
      if (type === 'chu')          map.set('Médecine',  map.get('Médecine')  + qty);
      else if (type === 'pharmacie') map.set('Pharmacie', map.get('Pharmacie') + qty);
      else if (type === 'dentaire')  map.set('Dentaire',  map.get('Dentaire')  + qty);
      else if (type === 'labo')      map.set('Labos',     map.get('Labos')     + qty);
      else                           map.set('Admin',     map.get('Admin')     + qty);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [bilanData]);

  const bilanMarches = bilanData?.marches || {};

  const achatsBarData = (achatsStatsQuery.data?.data?.data || []).map((item) => ({
    mois:  item.mois,
    total: Number(item.total || 0),
  }));

  const topData = useMemo(() => {
    const marchesList = marchesQuery.data?.data || [];
    const lotsList    = lotsQuery.data?.data    || [];

    const filteredMarches = marchesList.filter((m) => {
      const dc   = m.dateCreation ?? m.date_creation;
      const type = m.typeAcquisition ?? m.type_acquisition;
      if (!inDateRange(dc, achatsFilters.date_debut, achatsFilters.date_fin)) return false;
      if (achatsFilters.type_acquisition && type !== achatsFilters.type_acquisition) return false;
      return true;
    });

    const marcheIds = new Set(filteredMarches.map((m) => Number(m.idMarche ?? m.id_marche)));
    const filteredLots = lotsList.filter((lot) => marcheIds.has(Number(lot.idMarche ?? lot.id_marche)));

    const articleMap = new Map();
    filteredLots.forEach((lot) => {
      const key = lot.designation || lot.ressource?.designation || `Lot #${lot.idLot ?? lot.id_lot}`;
      const qty = Number(lot.quantiteCommandee ?? lot.quantite_commandee ?? 0);
      articleMap.set(key, (articleMap.get(key) || 0) + qty);
    });

    const topArticles = Array.from(articleMap.entries())
      .map(([designation, volume]) => ({ designation, volume }))
      .sort((a, b) => b.volume - a.volume).slice(0, 10);

    const lotsByMarche = filteredLots.reduce((acc, lot) => {
      const id = Number(lot.idMarche ?? lot.id_marche);
      acc.set(id, (acc.get(id) || 0) + Number(lot.quantiteCommandee ?? lot.quantite_commandee ?? 0));
      return acc;
    }, new Map());

    const fournMap = new Map();
    filteredMarches.forEach((m) => {
      const nom    = m.fournisseur?.nomSociete ?? m.fournisseur?.nom_societe ?? 'Non défini';
      const volume = lotsByMarche.get(Number(m.idMarche ?? m.id_marche)) || 0;
      fournMap.set(nom, (fournMap.get(nom) || 0) + volume);
    });
    const topFournisseurs = Array.from(fournMap.entries())
      .map(([fournisseur, volume]) => ({ fournisseur, volume }))
      .sort((a, b) => b.volume - a.volume).slice(0, 5);

    return { topArticles, topFournisseurs };
  }, [marchesQuery.data?.data, lotsQuery.data?.data, achatsFilters.date_debut, achatsFilters.date_fin, achatsFilters.type_acquisition]);

  const ressources = ressourcesQuery.data?.data || [];
  const activeTab = TABS.find((t) => t.key === mainTab);

  return (
    <div style={pageStyle}>

      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <div style={tabsRowStyle}>
        {TABS.map((tab) => {
          const active = tab.key === mainTab;
          return (
            <button key={tab.key} type="button"
              onClick={() => setMainTab(tab.key)}
              style={{ ...tabBtnStyle, ...(active ? { borderColor: tab.accent, background: tab.soft, color: tab.accent } : {}) }}>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ══════════════════════ ÉTAT DU STOCK ══════════════════════════════ */}
      {mainTab === 'stock' && (
        <div style={contentGrid}>
          {/* Sub-tabs */}
          <div style={subTabsRowStyle}>
            {STOCK_SUBTABS.map((st) => {
              const active = st.key === stockSubTab;
              return (
                <button key={st.key} type="button"
                  onClick={() => setStockSubTab(st.key)}
                  style={{ ...subTabBtnStyle, ...(active ? { background: '#0C447C', color: '#fff', borderColor: '#0C447C' } : {}) }}>
                  {st.label}
                </button>
              );
            })}
          </div>

          {/* ── Instantané ──────────────────────────────────────────────── */}
          {stockSubTab === 'instantane' && (
            <div style={contentGrid}>
              {/* KPI row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10 }}>
                <KpiCard label="Consommables suivis" value={consommables.length} icon={Boxes} accent="#0C447C" soft="#E6F1FB" unit="références" />
                <KpiCard label="Biens inventaire" value={bienInventaire.length} icon={Box} accent="#3C3489" soft="#EEEDFE" unit="références" />
                <KpiCard label="Alertes consommables" value={consAlertCount} icon={AlertTriangle} accent="#b91c1c" soft="#fef2f2" unit="alertes actives" />
              </div>

              {/* Tables */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {/* Consommables */}
                <SectionShell title="Consommables">
                  <TableShell
                    empty="Aucun consommable."
                    columns={[
                      { key: 'designation', label: 'Désignation' },
                      { key: 'qty',   label: 'Qté dispo', width: 90 },
                      { key: 'seuil', label: 'Seuil',     width: 80 },
                      { key: 'alerte', label: 'Alerte',   width: 90 },
                    ]}
                    rows={consommables.map((row) => {
                      const qty   = pick(row.quantiteDisponible, row.quantite_disponible);
                      const seuil = row.seuilAlerte ?? row.seuil_alerte ?? null;
                      const isAlert = seuil !== null && qty <= seuil;
                      return {
                        _rowStyle: { ...bodyRowStyle, background: isAlert ? '#fff5f5' : undefined },
                        designation: row.designation,
                        qty:    <span style={{ fontWeight: isAlert ? 700 : undefined, color: isAlert ? '#b91c1c' : undefined }}>{fmt(qty)}</span>,
                        seuil:  seuil !== null ? fmt(seuil) : <span style={{ color: '#94a3b8' }}>—</span>,
                        alerte: <AlertBadge isAlert={isAlert} />,
                      };
                    })}
                  />
                </SectionShell>

                {/* Biens inventaire */}
                <SectionShell title="Biens Inventaire">
                  <TableShell
                    empty="Aucun bien inventaire."
                    columns={[
                      { key: 'designation', label: 'Désignation' },
                      { key: 'total',  label: 'Total',       width: 70 },
                      { key: 'stock',  label: 'En stock',    width: 80 },
                      { key: 'serv',   label: 'En service',  width: 90 },
                      { key: 'maint',  label: 'En maint.',   width: 90 },
                    ]}
                    rows={bienInventaire.map((row) => ({
                      designation: row.designation,
                      total: fmt(pick(row.totalInstances, row.total_instances)),
                      stock: <span style={{ color: '#16a34a', fontWeight: 600 }}>{fmt(pick(row.enStock, row.en_stock))}</span>,
                      serv:  fmt(pick(row.enService, row.en_service)),
                      maint: fmt(pick(row.enMaintenance, row.en_maintenance)),
                    }))}
                  />
                </SectionShell>
              </div>
            </div>
          )}

          {/* ── Périodique ──────────────────────────────────────────────── */}
          {stockSubTab === 'periodique' && (
            <div style={contentGrid}>
              <SectionShell title="Paramètres">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
                  <FieldLabel label="Ressource" >
                    <select style={{ ...inputStyle, minWidth: 220 }}
                      value={periodicForm.id_ressource}
                      onChange={(e) => { setPeriodicForm((p) => ({ ...p, id_ressource: e.target.value })); setPeriodicSubmitted(false); }}>
                      <option value="">Sélectionner une ressource…</option>
                      {ressources.map((r) => {
                        const id  = r.idRessource ?? r.id_ressource;
                        return <option key={id} value={id}>{r.designation}</option>;
                      })}
                    </select>
                  </FieldLabel>
                  <FieldLabel label="Date début">
                    <input type="date" style={inputStyle} value={periodicForm.date_debut}
                      onChange={(e) => setPeriodicForm((p) => ({ ...p, date_debut: e.target.value }))} />
                  </FieldLabel>
                  <FieldLabel label="Date fin">
                    <input type="date" style={inputStyle} value={periodicForm.date_fin}
                      onChange={(e) => setPeriodicForm((p) => ({ ...p, date_fin: e.target.value }))} />
                  </FieldLabel>
                  <FieldLabel label="Unité">
                    <select style={inputStyle} value={periodicForm.unite}
                      onChange={(e) => setPeriodicForm((p) => ({ ...p, unite: e.target.value }))}>
                      <option value="jour">Jour</option>
                      <option value="mois">Mois</option>
                      <option value="annee">Année</option>
                    </select>
                  </FieldLabel>
                  <button type="button" style={primaryBtnStyle}
                    disabled={!periodicForm.id_ressource}
                    onClick={() => setPeriodicSubmitted(true)}>
                    Afficher
                  </button>
                </div>
              </SectionShell>

              <SectionShell title="Évolution du stock">
                {periodicChartData.length === 0
                  ? <div style={emptyChartStyle}>Sélectionnez une ressource et cliquez sur Afficher.</div>
                  : (
                    <div style={{ width: '100%', height: 300 }}>
                      <ResponsiveContainer>
                        <AreaChart data={periodicChartData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                          <defs>
                            <linearGradient id="gEntrees" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor="#16a34a" stopOpacity={0.15} />
                              <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="gSorties" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.15} />
                              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="periode" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                          <Tooltip content={<ChartTooltip />} />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Area type="monotone" dataKey="entrees" name="Entrées" stroke="#16a34a" strokeWidth={2} fill="url(#gEntrees)" />
                          <Area type="monotone" dataKey="sorties" name="Sorties" stroke="#ef4444" strokeWidth={2} fill="url(#gSorties)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
              </SectionShell>

              {periodicChartData.length > 0 && (
                <SectionShell title="Tableau récapitulatif">
                  <TableShell
                    columns={[
                      { key: 'periode', label: 'Période' },
                      { key: 'entrees', label: 'Entrées' },
                      { key: 'sorties', label: 'Sorties' },
                      { key: 'solde',   label: 'Solde net' },
                    ]}
                    rows={periodicChartData.map((row) => {
                      const solde = row.entrees - row.sorties;
                      return {
                        periode: row.periode,
                        entrees: <span style={{ color: '#16a34a', fontWeight: 600 }}>{fmt(row.entrees)}</span>,
                        sorties: <span style={{ color: '#ef4444', fontWeight: 600 }}>{fmt(row.sorties)}</span>,
                        solde:   <span style={{ color: solde >= 0 ? '#16a34a' : '#ef4444', fontWeight: 700 }}>{solde >= 0 ? '+' : ''}{fmt(solde)}</span>,
                      };
                    })}
                  />
                </SectionShell>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════ BILAN ANNUEL ═══════════════════════════════ */}
      {mainTab === 'bilan' && (
        <div style={contentGrid}>
          {/* Year picker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FieldLabel label="Année">
              <input type="number" style={{ ...inputStyle, width: 110 }}
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value || currentYear))} />
            </FieldLabel>
          </div>

          {/* KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 10 }}>
            <KpiCard label="Total acquisitions" value={bilanSummary.totalAcquisitions} icon={ArrowDownToLine} accent="#7c3aed" soft="#f5f3ff" unit="unités" />
            <KpiCard label="Total sorties"       value={bilanSummary.totalSorties}      icon={ArrowUpFromLine} accent="#0C447C" soft="#E6F1FB" unit="unités" />
            <KpiCard label="Donations"           value={bilanSummary.totalDonations}   icon={Gift}           accent="#16a34a" soft="#f0fdf4" unit="lots" />
            <KpiCard label="Rebuts"              value={bilanSummary.rebuts}            icon={AlertTriangle}  accent="#b91c1c" soft="#fef2f2" unit="articles" />
            <KpiCard label="Transferts"          value={bilanSummary.transferts}        icon={Activity}       accent="#0d9488" soft="#f0fdfa" unit="mouvements" />
          </div>

          {/* Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 14 }}>
            <SectionShell title={`Acquisitions par mois — ${selectedYear}`}>
              {bilanMonthlyData.length === 0
                ? <div style={emptyChartStyle}>Aucune donnée pour cette année.</div>
                : (
                  <div style={{ width: '100%', height: 280 }}>
                    <ResponsiveContainer>
                      <BarChart data={bilanMonthlyData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="mois" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="total" name="Acquisitions" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
            </SectionShell>

            <SectionShell title="Consommation par entité">
              {entitePieData.every((d) => d.value === 0)
                ? <div style={emptyChartStyle}>Aucune consommation enregistrée.</div>
                : (
                  <div style={{ width: '100%', height: 280 }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={entitePieData} dataKey="value" nameKey="name"
                          cx="50%" cy="45%" outerRadius={90} innerRadius={40}
                          paddingAngle={3}>
                          {entitePieData.map((entry, i) => (
                            <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
            </SectionShell>
          </div>

          {/* Marchés */}
          <SectionShell title="Statistiques Marchés">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10 }}>
              {[
                { label: 'Réceptionnés & stockés', value: pick(bilanMarches.receptionnes, null, 0), accent: '#16a34a', soft: '#f0fdf4' },
                { label: 'Non conformes',           value: pick(bilanMarches.nonConformes, bilanMarches.non_conformes, 0), accent: '#b91c1c', soft: '#fef2f2' },
                { label: 'En attente livraison',    value: pick(bilanMarches.enAttente, bilanMarches.en_attente, 0), accent: '#f59e0b', soft: '#fffbeb' },
              ].map(({ label, value, accent, soft }) => (
                <div key={label} style={{ border: `1px solid ${accent}22`, borderRadius: 12, padding: '14px 16px', background: soft }}>
                  <div style={{ fontSize: 11, color: '#475569', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: accent }}>{fmt(value)}</div>
                </div>
              ))}
            </div>
          </SectionShell>

          {/* Consommation par entité table */}
          <SectionShell title="Détail consommation par entité">
            <TableShell
              empty="Aucune donnée de consommation."
              columns={[
                { key: 'entite',   label: 'Entité / Service' },
                { key: 'demande',  label: 'Qté demandée', width: 130 },
                { key: 'accorde',  label: 'Qté accordée', width: 130 },
                { key: 'taux',     label: 'Taux service', width: 110 },
              ]}
              rows={(bilanData?.consommationParEntite ?? bilanData?.consommation_par_entite ?? []).map((row) => {
                const dem = Number(row.totalDemande ?? row.total_demande ?? 0);
                const acc = Number(row.totalAccorde ?? row.total_accorde ?? 0);
                const taux = dem > 0 ? Math.round((acc / dem) * 100) : 0;
                return {
                  entite:  row.nomService ?? row.nom_service ?? '—',
                  demande: fmt(dem),
                  accorde: <span style={{ fontWeight: 600 }}>{fmt(acc)}</span>,
                  taux:    (
                    <span style={{ color: taux >= 80 ? '#16a34a' : taux >= 50 ? '#f59e0b' : '#b91c1c', fontWeight: 700 }}>
                      {taux}%
                    </span>
                  ),
                };
              })}
            />
          </SectionShell>
        </div>
      )}

      {/* ══════════════════════ STATISTIQUES ACHATS ════════════════════════ */}
      {mainTab === 'achats' && (
        <div style={contentGrid}>
          {/* Filter bar */}
          <SectionShell title="Filtres">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
              <FieldLabel label="Date début">
                <input type="date" style={inputStyle} value={achatsFilters.date_debut}
                  onChange={(e) => setAchatsFilters((p) => ({ ...p, date_debut: e.target.value }))} />
              </FieldLabel>
              <FieldLabel label="Date fin">
                <input type="date" style={inputStyle} value={achatsFilters.date_fin}
                  onChange={(e) => setAchatsFilters((p) => ({ ...p, date_fin: e.target.value }))} />
              </FieldLabel>
              <FieldLabel label="Type acquisition">
                <select style={inputStyle} value={achatsFilters.type_acquisition}
                  onChange={(e) => setAchatsFilters((p) => ({ ...p, type_acquisition: e.target.value }))}>
                  <option value="">Tous</option>
                  <option value="marche">Marché</option>
                  <option value="bon_commande">Bon de commande</option>
                  <option value="donation">Donation</option>
                </select>
              </FieldLabel>
              <FieldLabel label="Entité">
                <select style={inputStyle} value={achatsFilters.entite}
                  onChange={(e) => setAchatsFilters((p) => ({ ...p, entite: e.target.value }))}>
                  <option value="">Toutes</option>
                  <option value="chu">Médecine</option>
                  <option value="pharmacie">Pharmacie</option>
                  <option value="dentaire">Dentaire</option>
                  <option value="administratif">Admin</option>
                  <option value="labo">Labos</option>
                </select>
              </FieldLabel>
              {(achatsFilters.date_debut || achatsFilters.date_fin || achatsFilters.type_acquisition || achatsFilters.entite) && (
                <button type="button"
                  style={{ ...primaryBtnStyle, background: '#f1f5f9', color: '#334155', border: '1px solid #dbe4ee' }}
                  onClick={() => setAchatsFilters({ date_debut: '', date_fin: '', type_acquisition: '', entite: '' })}>
                  Réinitialiser
                </button>
              )}
            </div>
          </SectionShell>

          {/* Bar chart */}
          <SectionShell title="Volume d'achats par mois">
            {achatsBarData.length === 0
              ? <div style={emptyChartStyle}>Aucun mouvement pour cette période.</div>
              : (
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
                    <BarChart data={achatsBarData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="mois" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="total" name="Volume" fill="#0d9488" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
          </SectionShell>

          {/* Top tables */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <SectionShell title="Top 10 — Articles les plus commandés">
              <TableShell
                empty="Aucun article pour les filtres sélectionnés."
                columns={[
                  { key: 'rang',        label: '#',       width: 36 },
                  { key: 'designation', label: 'Article' },
                  { key: 'volume',      label: 'Volume',  width: 90 },
                ]}
                rows={topData.topArticles.map((row, i) => ({
                  rang:        <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700 }}>{i + 1}</span>,
                  designation: row.designation,
                  volume:      <span style={{ fontWeight: 700, color: '#0d9488' }}>{fmt(row.volume)}</span>,
                }))}
              />
            </SectionShell>

            <SectionShell title="Top 5 — Fournisseurs par volume">
              <TableShell
                empty="Aucun fournisseur pour les filtres sélectionnés."
                columns={[
                  { key: 'rang',        label: '#',         width: 36 },
                  { key: 'fournisseur', label: 'Fournisseur' },
                  { key: 'volume',      label: 'Volume',    width: 90 },
                ]}
                rows={topData.topFournisseurs.map((row, i) => ({
                  rang:        <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700 }}>{i + 1}</span>,
                  fournisseur: row.fournisseur,
                  volume:      <span style={{ fontWeight: 700, color: '#0d9488' }}>{fmt(row.volume)}</span>,
                }))}
              />
            </SectionShell>
          </div>
        </div>
      )}
    </div>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────
const pageStyle     = { display: 'grid', gap: 16 };
const contentGrid   = { display: 'grid', gap: 14 };

const tabsRowStyle    = { display: 'flex', gap: 8, flexWrap: 'wrap' };
const tabBtnStyle     = {
  display: 'inline-flex', alignItems: 'center', gap: 7,
  padding: '8px 14px', borderRadius: 11,
  border: '1px solid #dbe4ee', background: '#fff',
  color: '#475569', cursor: 'pointer', fontWeight: 600, fontSize: 13,
  transition: 'all .15s',
};

const subTabsRowStyle = { display: 'flex', gap: 8 };
const subTabBtnStyle  = {
  padding: '6px 12px', borderRadius: 8,
  border: '1px solid #dbe4ee', background: '#fff',
  color: '#475569', cursor: 'pointer', fontWeight: 600, fontSize: 12,
};

const primaryBtnStyle = {
  padding: '8px 16px', borderRadius: 9, border: 'none',
  background: '#0f172a', color: '#fff', cursor: 'pointer',
  fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap',
};

const inputStyle = {
  border: '1px solid #dbe4ee', borderRadius: 9,
  padding: '7px 10px', fontSize: 13, background: '#fff', outline: 'none',
  color: '#0f172a',
};

const tableStyle   = { width: '100%', borderCollapse: 'collapse' };
const headRowStyle = { background: '#f8fafc', textAlign: 'left' };
const bodyRowStyle = { borderTop: '1px solid #f1f5f9' };
const thStyle      = { padding: '9px 12px', fontSize: 11, color: '#475569', fontWeight: 700, borderBottom: '1px solid #e5e7eb' };
const tdStyle      = { padding: '9px 12px', fontSize: 13, color: '#0f172a' };
const emptyCellStyle = { padding: 16, textAlign: 'center', color: '#94a3b8', fontSize: 13 };
const emptyChartStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, color: '#94a3b8', fontSize: 13 };

const pillBase = { borderRadius: 999, padding: '2px 9px', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center' };
