import { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { getCategories, getInstances, getRessources, getStock } from '../../api/resources';
import StockDetailModal from './StockDetailModal';
import InstanceDetailModal from './InstanceDetailModal';

const STALE_TIME = 30_000;

export default function StockPage() {
  const [tab, setTab] = useState('consommables');

  const [searchCons, setSearchCons] = useState('');
  const [filterCategorie, setFilterCategorie] = useState('');
  const [selectedConsommable, setSelectedConsommable] = useState(null);

  const [searchInst, setSearchInst] = useState('');
  const [filterStatut, setFilterStatut] = useState('');
  const [filterEtat, setFilterEtat] = useState('');
  const [filterService, setFilterService] = useState('');
  const [selectedInstance, setSelectedInstance] = useState(null);

  const ressourcesQuery = useQuery({
    queryKey: ['resources', 'ressources'],
    queryFn: getRessources,
    staleTime: STALE_TIME,
  });

  const stockQuery = useQuery({
    queryKey: ['resources', 'stocks'],
    queryFn: getStock,
    staleTime: STALE_TIME,
  });

  const categoriesQuery = useQuery({
    queryKey: ['resources', 'categories'],
    queryFn: getCategories,
    staleTime: STALE_TIME,
  });

  const instancesQuery = useQuery({
    queryKey: ['resources', 'instances'],
    queryFn: getInstances,
    staleTime: STALE_TIME,
  });

  const ressourceMap = useMemo(() => {
    const rows = ressourcesQuery.data?.data || [];
    return new Map(rows.map((row) => [Number(row.id_ressource), row]));
  }, [ressourcesQuery.data?.data]);

  const consommableRows = useMemo(() => {
    const stocks = stockQuery.data?.data || [];

    return stocks
      .map((stock) => {
        const ressource = ressourceMap.get(Number(stock.id_ressource));
        if (!ressource?.is_consommable) return null;
        return { stock, ressource };
      })
      .filter(Boolean)
      .filter(({ ressource }) =>
        ressource.designation.toLowerCase().includes(searchCons.trim().toLowerCase())
      )
      .filter(({ ressource }) => (filterCategorie ? String(ressource.id_categorie) === filterCategorie : true))
      .sort((a, b) => a.ressource.designation.localeCompare(b.ressource.designation));
  }, [stockQuery.data?.data, ressourceMap, searchCons, filterCategorie]);

  const bienRows = useMemo(() => {
    const instances = instancesQuery.data?.data || [];

    return instances
      .filter((row) => row.ressource?.is_bien_inventaire)
      .filter((row) => {
        const q = searchInst.trim().toLowerCase();
        return (
          row.numero_inventaire?.toLowerCase().includes(q) ||
          row.ressource?.designation?.toLowerCase().includes(q)
        );
      })
      .filter((row) => (filterStatut ? row.statut === filterStatut : true))
      .filter((row) => (filterEtat ? row.etat === filterEtat : true))
      .filter((row) => (filterService ? String(row.id_service_actuel) === filterService : true));
  }, [instancesQuery.data?.data, searchInst, filterStatut, filterEtat, filterService]);

  const categories = categoriesQuery.data?.data || [];
  const services = useMemo(() => {
    const instances = instancesQuery.data?.data || [];
    const map = new Map();
    instances.forEach((row) => {
      if (row.service_actuel?.id_service) {
        map.set(String(row.service_actuel.id_service), row.service_actuel.nom_service);
      }
    });
    return Array.from(map.entries()).map(([id, nom]) => ({ id, nom }));
  }, [instancesQuery.data?.data]);

  const isLoading =
    ressourcesQuery.isLoading || stockQuery.isLoading || categoriesQuery.isLoading || instancesQuery.isLoading;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <h1 style={{ margin: 0 }}>Stock</h1>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setTab('consommables')} style={tab === 'consommables' ? activeTab : tabStyle}>
          Consommables
        </button>
        <button onClick={() => setTab('biens')} style={tab === 'biens' ? activeTab : tabStyle}>
          Biens Inventaire
        </button>
      </div>

      {tab === 'consommables' ? (
        <section style={sectionStyle}>
          <div style={filtersGrid2}>
            <input
              value={searchCons}
              onChange={(e) => setSearchCons(e.target.value)}
              placeholder="Rechercher par désignation"
              style={inputStyle}
            />
            <select value={filterCategorie} onChange={(e) => setFilterCategorie(e.target.value)} style={inputStyle}>
              <option value="">Toutes catégories</option>
              {categories.map((cat) => (
                <option key={cat.id_categorie} value={cat.id_categorie}>
                  {cat.nom_categorie}
                </option>
              ))}
            </select>
          </div>

          {isLoading ? (
            <div style={{ height: 180, borderRadius: 10, background: '#f3f4f6' }} />
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr style={headRowStyle}>
                  <th style={thStyle}>Désignation</th>
                  <th style={thStyle}>Catégorie</th>
                  <th style={thStyle}>Qté disponible</th>
                  <th style={thStyle}>Seuil alerte</th>
                  <th style={thStyle}>Statut</th>
                </tr>
              </thead>
              <tbody>
                {consommableRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={emptyCellStyle}>
                      Aucun consommable trouvé.
                    </td>
                  </tr>
                ) : (
                  consommableRows.map((row) => {
                    const warning = Number(row.stock.quantite_disponible) <= Number(row.stock.seuil_alerte);
                    return (
                      <tr key={row.stock.id_stock} style={clickableRowStyle} onClick={() => setSelectedConsommable(row)}>
                        <td style={tdStyle}>{row.ressource.designation}</td>
                        <td style={tdStyle}>{row.ressource.categorie?.nom_categorie || '—'}</td>
                        <td style={tdStyle}>{row.stock.quantite_disponible}</td>
                        <td style={tdStyle}>{row.stock.seuil_alerte}</td>
                        <td style={tdStyle}>
                          {warning ? (
                            <span style={warningStyle}>
                              <AlertTriangle size={14} />
                              Sous seuil
                            </span>
                          ) : (
                            <span style={okStyle}>OK</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </section>
      ) : (
        <section style={sectionStyle}>
          <div style={filtersGrid4}>
            <input
              value={searchInst}
              onChange={(e) => setSearchInst(e.target.value)}
              placeholder="N° inventaire ou désignation"
              style={inputStyle}
            />

            <select value={filterStatut} onChange={(e) => setFilterStatut(e.target.value)} style={inputStyle}>
              <option value="">Tous statuts</option>
              <option value="en_stock">En stock</option>
              <option value="en_service">En service</option>
              <option value="en_maintenance">En maintenance</option>
              <option value="hors_service">Hors service</option>
            </select>

            <select value={filterEtat} onChange={(e) => setFilterEtat(e.target.value)} style={inputStyle}>
              <option value="">Tous états</option>
              <option value="neuf">Neuf</option>
              <option value="bon_etat">Bon état</option>
              <option value="usage_normal">Usage normal</option>
              <option value="endommage">Endommagé</option>
              <option value="hors_service">Hors service</option>
            </select>

            <select value={filterService} onChange={(e) => setFilterService(e.target.value)} style={inputStyle}>
              <option value="">Tous services</option>
              {services.map((svc) => (
                <option key={svc.id} value={svc.id}>
                  {svc.nom}
                </option>
              ))}
            </select>
          </div>

          {isLoading ? (
            <div style={{ height: 180, borderRadius: 10, background: '#f3f4f6' }} />
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr style={headRowStyle}>
                  <th style={thStyle}>N° inventaire</th>
                  <th style={thStyle}>Désignation</th>
                  <th style={thStyle}>Statut</th>
                  <th style={thStyle}>État</th>
                  <th style={thStyle}>Service actuel</th>
                </tr>
              </thead>
              <tbody>
                {bienRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={emptyCellStyle}>
                      Aucun bien inventaire trouvé.
                    </td>
                  </tr>
                ) : (
                  bienRows.map((row) => (
                    <tr key={row.id_instance} style={clickableRowStyle} onClick={() => setSelectedInstance(row)}>
                      <td style={tdStyle}>{row.numero_inventaire}</td>
                      <td style={tdStyle}>{row.ressource?.designation || '—'}</td>
                      <td style={tdStyle}>{row.statut}</td>
                      <td style={tdStyle}>{row.etat}</td>
                      <td style={tdStyle}>{row.service_actuel?.nom_service || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </section>
      )}

      {selectedConsommable && (
        <StockDetailModal item={selectedConsommable} onClose={() => setSelectedConsommable(null)} />
      )}

      {selectedInstance && (
        <InstanceDetailModal instance={selectedInstance} onClose={() => setSelectedInstance(null)} />
      )}
    </div>
  );
}

const sectionStyle = {
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  background: '#fff',
  padding: 12,
  display: 'grid',
  gap: 12,
};

const filtersGrid2 = {
  display: 'grid',
  gridTemplateColumns: '2fr 1fr',
  gap: 10,
};

const filtersGrid4 = {
  display: 'grid',
  gridTemplateColumns: '2fr 1fr 1fr 1fr',
  gap: 10,
};

const inputStyle = {
  border: '1px solid #d1d5db',
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 14,
};

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 14,
};

const headRowStyle = {
  background: '#f9fafb',
  textAlign: 'left',
};

const thStyle = {
  padding: 10,
  fontWeight: 600,
};

const tdStyle = {
  padding: 10,
  borderTop: '1px solid #f3f4f6',
};

const emptyCellStyle = {
  padding: 16,
  color: '#6b7280',
};

const clickableRowStyle = {
  cursor: 'pointer',
};

const tabStyle = {
  border: '1px solid #d1d5db',
  background: '#fff',
  color: '#111827',
  borderRadius: 8,
  padding: '8px 12px',
  cursor: 'pointer',
};

const activeTab = {
  ...tabStyle,
  background: '#111827',
  color: '#fff',
  borderColor: '#111827',
};

const warningStyle = {
  display: 'inline-flex',
  gap: 6,
  alignItems: 'center',
  color: '#b91c1c',
  fontWeight: 600,
};

const okStyle = {
  color: '#166534',
  fontWeight: 600,
};
