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
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

import {
  getBilanAnnuel,
  getStatistiquesAchats,
  getStockInstantane,
  getStockPeriodique,
} from '../../api/reporting';
import { getRessources } from '../../api/resources';
import { getLots, getMarches } from '../../api/procurement';

const STALE_TIME = 30_000;
const PIE_COLORS = ['#2563eb', '#16a34a', '#dc2626', '#7c3aed', '#ea580c'];

function formatNumber(value) {
  return Number(value || 0).toLocaleString('fr-FR');
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

function alerteBadge(isAlerte) {
  return isAlerte ? (
    <span style={{ ...pillStyle, background: '#fee2e2', color: '#991b1b' }}>Alerte</span>
  ) : (
    <span style={{ ...pillStyle, background: '#dcfce7', color: '#166534' }}>OK</span>
  );
}

function sectionCard(children) {
  return (
    <section style={{ border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff', padding: 12 }}>
      {children}
    </section>
  );
}

export default function ReportingPage() {
  const currentYear = new Date().getFullYear();

  const [mainTab, setMainTab] = useState('stock');
  const [stockSubTab, setStockSubTab] = useState('instantane');

  const [periodicForm, setPeriodicForm] = useState({
    id_ressource: '',
    date_debut: '',
    date_fin: '',
    unite: 'mois',
  });
  const [periodicSubmitted, setPeriodicSubmitted] = useState(false);

  const [selectedYear, setSelectedYear] = useState(currentYear);

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

  const stockInstantane = stockInstantaneQuery.data?.data || {
    consommables: [],
    bien_inventaire: [],
  };

  const periodicChartData = useMemo(() => {
    const payload = stockPeriodiqueQuery.data?.data;
    if (!payload) return [];

    const labels = payload.labels || [];
    const entrees = payload.entrees || [];
    const sorties = payload.sorties || [];

    return labels.map((label, index) => ({
      periode: label,
      entrees: Number(entrees[index] || 0),
      sorties: Number(sorties[index] || 0),
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
  }, [marchesQuery.data?.data, lotsQuery.data?.data, achatsFilters.date_debut, achatsFilters.date_fin, achatsFilters.type_acquisition]);

  const ressources = ressourcesQuery.data?.data || [];

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <h1 style={{ margin: 0 }}>Reporting</h1>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button style={mainTab === 'stock' ? activeTabStyle : tabStyle} onClick={() => setMainTab('stock')}>
          État du stock
        </button>
        <button style={mainTab === 'bilan' ? activeTabStyle : tabStyle} onClick={() => setMainTab('bilan')}>
          Bilan Annuel
        </button>
        <button style={mainTab === 'achats' ? activeTabStyle : tabStyle} onClick={() => setMainTab('achats')}>
          Statistiques Achats
        </button>
      </div>

      {mainTab === 'stock' ? (
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              style={stockSubTab === 'instantane' ? activeTabStyle : tabStyle}
              onClick={() => setStockSubTab('instantane')}
            >
              Instantané
            </button>
            <button
              style={stockSubTab === 'periodique' ? activeTabStyle : tabStyle}
              onClick={() => setStockSubTab('periodique')}
            >
              Périodique
            </button>
          </div>

          {stockSubTab === 'instantane' ? (
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button style={primaryButton} onClick={() => window.print()}>
                  Exporter PDF
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {sectionCard(
                  <>
                    <h3 style={sectionTitleStyle}>Consommables</h3>
                    <table style={tableStyle}>
                      <thead>
                        <tr style={headRowStyle}>
                          <th style={thStyle}>Désignation</th>
                          <th style={thStyle}>Qté dispo</th>
                          <th style={thStyle}>Seuil</th>
                          <th style={thStyle}>Alerte</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(stockInstantane.consommables || []).map((row) => (
                          <tr key={row.id} style={bodyRowStyle}>
                            <td style={tdStyle}>{row.designation}</td>
                            <td style={tdStyle}>{formatNumber(row.quantite_disponible)}</td>
                            <td style={tdStyle}>{formatNumber(row.seuil_alerte)}</td>
                            <td style={tdStyle}>{alerteBadge(row.alerte)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}

                {sectionCard(
                  <>
                    <h3 style={sectionTitleStyle}>Biens Inventaire</h3>
                    <table style={tableStyle}>
                      <thead>
                        <tr style={headRowStyle}>
                          <th style={thStyle}>Désignation</th>
                          <th style={thStyle}>Total</th>
                          <th style={thStyle}>En stock</th>
                          <th style={thStyle}>En service</th>
                          <th style={thStyle}>En maintenance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(stockInstantane.bien_inventaire || []).map((row) => (
                          <tr key={row.id} style={bodyRowStyle}>
                            <td style={tdStyle}>{row.designation}</td>
                            <td style={tdStyle}>{formatNumber(row.total_instances)}</td>
                            <td style={tdStyle}>{formatNumber(row.en_stock)}</td>
                            <td style={tdStyle}>{formatNumber(row.en_service)}</td>
                            <td style={tdStyle}>{formatNumber(row.en_maintenance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {sectionCard(
                <>
                  <h3 style={sectionTitleStyle}>Périodique</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 10, alignItems: 'end' }}>
                    <label style={labelStyle}>
                      Ressource
                      <select
                        style={inputStyle}
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
                    </label>

                    <label style={labelStyle}>
                      Date début
                      <input
                        type="date"
                        style={inputStyle}
                        value={periodicForm.date_debut}
                        onChange={(e) => setPeriodicForm((prev) => ({ ...prev, date_debut: e.target.value }))}
                      />
                    </label>

                    <label style={labelStyle}>
                      Date fin
                      <input
                        type="date"
                        style={inputStyle}
                        value={periodicForm.date_fin}
                        onChange={(e) => setPeriodicForm((prev) => ({ ...prev, date_fin: e.target.value }))}
                      />
                    </label>

                    <label style={labelStyle}>
                      Unité
                      <select
                        style={inputStyle}
                        value={periodicForm.unite}
                        onChange={(e) => setPeriodicForm((prev) => ({ ...prev, unite: e.target.value }))}
                      >
                        <option value="jour">jour</option>
                        <option value="mois">mois</option>
                        <option value="annee">année</option>
                      </select>
                    </label>

                    <button
                      style={primaryButton}
                      onClick={() => setPeriodicSubmitted(true)}
                      disabled={!periodicForm.id_ressource}
                    >
                      Afficher
                    </button>
                  </div>
                </>
              )}

              {sectionCard(
                <>
                  <h3 style={sectionTitleStyle}>Évolution</h3>
                  <div style={{ width: '100%', height: 280 }}>
                    <ResponsiveContainer>
                      <LineChart data={periodicChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="periode" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="entrees" stroke="#16a34a" name="Entrées" strokeWidth={2} />
                        <Line type="monotone" dataKey="sorties" stroke="#dc2626" name="Sorties" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}

              {sectionCard(
                <>
                  <h3 style={sectionTitleStyle}>Résumé</h3>
                  <table style={tableStyle}>
                    <thead>
                      <tr style={headRowStyle}>
                        <th style={thStyle}>Période</th>
                        <th style={thStyle}>Entrées</th>
                        <th style={thStyle}>Sorties</th>
                      </tr>
                    </thead>
                    <tbody>
                      {periodicChartData.map((row) => (
                        <tr key={row.periode} style={bodyRowStyle}>
                          <td style={tdStyle}>{row.periode}</td>
                          <td style={tdStyle}>{formatNumber(row.entrees)}</td>
                          <td style={tdStyle}>{formatNumber(row.sorties)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          )}
        </div>
      ) : null}

      {mainTab === 'bilan' ? (
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
            <label style={{ ...labelStyle, width: 220 }}>
              Année
              <input
                type="number"
                style={inputStyle}
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value || currentYear))}
              />
            </label>

            <button style={primaryButton} onClick={() => window.print()}>
              Exporter PDF
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
            <div style={summaryCardStyle}>
              <div style={summaryLabelStyle}>Total acquisitions</div>
              <div style={summaryValueStyle}>{formatNumber(bilanSummary.totalAcquisitions)}</div>
            </div>
            <div style={summaryCardStyle}>
              <div style={summaryLabelStyle}>Total sorties</div>
              <div style={summaryValueStyle}>{formatNumber(bilanSummary.totalSorties)}</div>
            </div>
            <div style={summaryCardStyle}>
              <div style={summaryLabelStyle}>Total donations</div>
              <div style={summaryValueStyle}>{formatNumber(bilanSummary.totalDonations)}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 12 }}>
            {sectionCard(
              <>
                <h3 style={sectionTitleStyle}>Acquisitions par mois</h3>
                <div style={{ width: '100%', height: 280 }}>
                  <ResponsiveContainer>
                    <BarChart data={bilanMonthlyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="mois" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="total" fill="#2563eb" name="Acquisitions" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}

            {sectionCard(
              <>
                <h3 style={sectionTitleStyle}>Consommation par entité</h3>
                <div style={{ width: '100%', height: 280 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={entitePieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}>
                        {entitePieData.map((entry, index) => (
                          <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>

          {sectionCard(
            <>
              <h3 style={sectionTitleStyle}>Marchés</h3>
              <table style={tableStyle}>
                <thead>
                  <tr style={headRowStyle}>
                    <th style={thStyle}>Réceptionnés</th>
                    <th style={thStyle}>Non conformes</th>
                    <th style={thStyle}>En attente</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={bodyRowStyle}>
                    <td style={tdStyle}>{formatNumber(bilanData?.marches?.receptionnes)}</td>
                    <td style={tdStyle}>{formatNumber(bilanData?.marches?.non_conformes)}</td>
                    <td style={tdStyle}>{formatNumber(bilanData?.marches?.en_attente)}</td>
                  </tr>
                </tbody>
              </table>
            </>
          )}
        </div>
      ) : null}

      {mainTab === 'achats' ? (
        <div style={{ display: 'grid', gap: 12 }}>
          {sectionCard(
            <>
              <h3 style={sectionTitleStyle}>Filtres</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
                <label style={labelStyle}>
                  Date début
                  <input
                    type="date"
                    style={inputStyle}
                    value={achatsFilters.date_debut}
                    onChange={(e) => setAchatsFilters((prev) => ({ ...prev, date_debut: e.target.value }))}
                  />
                </label>

                <label style={labelStyle}>
                  Date fin
                  <input
                    type="date"
                    style={inputStyle}
                    value={achatsFilters.date_fin}
                    onChange={(e) => setAchatsFilters((prev) => ({ ...prev, date_fin: e.target.value }))}
                  />
                </label>

                <label style={labelStyle}>
                  Type acquisition
                  <select
                    style={inputStyle}
                    value={achatsFilters.type_acquisition}
                    onChange={(e) => setAchatsFilters((prev) => ({ ...prev, type_acquisition: e.target.value }))}
                  >
                    <option value="">Tous</option>
                    <option value="marche">Marché</option>
                    <option value="bon_commande">BC</option>
                    <option value="donation">Donation</option>
                  </select>
                </label>

                <label style={labelStyle}>
                  Entité
                  <select
                    style={inputStyle}
                    value={achatsFilters.entite}
                    onChange={(e) => setAchatsFilters((prev) => ({ ...prev, entite: e.target.value }))}
                  >
                    <option value="">Toutes</option>
                    <option value="chu">Médecine</option>
                    <option value="pharmacie">Pharmacie</option>
                    <option value="dentaire">Dentaire</option>
                    <option value="administratif">Admin</option>
                    <option value="labo">Labos</option>
                  </select>
                </label>
              </div>
            </>
          )}

          {sectionCard(
            <>
              <h3 style={sectionTitleStyle}>Achats par mois</h3>
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer>
                  <BarChart data={achatsBarData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mois" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="total" fill="#2563eb" name="Achats" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {sectionCard(
              <>
                <h3 style={sectionTitleStyle}>Top 10 articles les plus commandés</h3>
                <table style={tableStyle}>
                  <thead>
                    <tr style={headRowStyle}>
                      <th style={thStyle}>Article</th>
                      <th style={thStyle}>Volume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topData.topArticles.map((row) => (
                      <tr key={row.designation} style={bodyRowStyle}>
                        <td style={tdStyle}>{row.designation}</td>
                        <td style={tdStyle}>{formatNumber(row.volume)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {sectionCard(
              <>
                <h3 style={sectionTitleStyle}>Top 5 fournisseurs par volume</h3>
                <table style={tableStyle}>
                  <thead>
                    <tr style={headRowStyle}>
                      <th style={thStyle}>Fournisseur</th>
                      <th style={thStyle}>Volume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topData.topFournisseurs.map((row) => (
                      <tr key={row.fournisseur} style={bodyRowStyle}>
                        <td style={tdStyle}>{row.fournisseur}</td>
                        <td style={tdStyle}>{formatNumber(row.volume)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const tabStyle = {
  border: '1px solid #d1d5db',
  borderRadius: 8,
  padding: '8px 12px',
  background: '#fff',
  color: '#111827',
  cursor: 'pointer',
};

const activeTabStyle = {
  ...tabStyle,
  background: '#111827',
  color: '#fff',
  border: '1px solid #111827',
};

const primaryButton = {
  border: 'none',
  borderRadius: 8,
  padding: '8px 12px',
  background: '#111827',
  color: '#fff',
  cursor: 'pointer',
};

const inputStyle = {
  border: '1px solid #d1d5db',
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 14,
};

const labelStyle = {
  display: 'grid',
  gap: 6,
  fontSize: 13,
  color: '#374151',
};

const sectionTitleStyle = { marginTop: 0, marginBottom: 10 };

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 14,
};

const headRowStyle = {
  background: '#f9fafb',
  textAlign: 'left',
};

const bodyRowStyle = {
  borderTop: '1px solid #f3f4f6',
};

const thStyle = { padding: 8, fontWeight: 600 };
const tdStyle = { padding: 8 };

const pillStyle = {
  borderRadius: 999,
  padding: '3px 9px',
  fontSize: 12,
  fontWeight: 600,
};

const summaryCardStyle = {
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  padding: 12,
  background: '#fff',
};

const summaryLabelStyle = {
  fontSize: 13,
  color: '#6b7280',
};

const summaryValueStyle = {
  marginTop: 4,
  fontSize: 24,
  fontWeight: 700,
  color: '#111827',
};
