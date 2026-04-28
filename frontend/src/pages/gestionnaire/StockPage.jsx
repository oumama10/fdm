import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Maximize2 } from 'lucide-react';

import { getStock, getInstances, getInstance, getRessources, updateInstance } from '../../api/resources';
import { getServices } from '../../api/users';
import { formatCategorieName } from '../../lib/utils';

const STALE_TIME = 60000;

// ─────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────

function normalizeStringForFilter(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase();
}

// ─────────────────────────────────────────────────────────────
// TAXONOMY CONSTANTS (Static, not fetched from API)
// ─────────────────────────────────────────────────────────────

const CONSOMMABLE_TAXONOMY = {
  'Fourniture De Bureau': [],
  Toners: [],
  'Papiers Et Enveloppes': [],
  'Produits Hygieniques': [],
  'Accessoires Electriques': [],
  'Accessoires Plomberies': [],
  'Accessoires De Sports': [],
  'Consommation Et Pause': [],
};

const BIEN_INVENTAIRE_TAXONOMY = {
  'MATERIEL_INFORMATIQUE': [
    'Ordinateur de bureau',
    'All In One',
    'Ordinateur Portable',
    'Imprimante',
    'Imprimante couleur',
    'Photocopieuse',
    'Scanner',
    'Appareil photo',
    'Tablette',
    'Scanner Onduleur',
    'CAMERA',
    'FAX',
    'Imprimante multifonction',
  ],
  'MATERIEL_ENSEIGNEMENT': [
    'Videoprojecteur',
    'Ecran de projection',
    'Micro cravatte',
    'Microbaladeur',
    'Tableau magnetique GF',
    "Tableau d'affichage GF",
    'Tableau magnetique PF',
    'Tableau magnetique MF',
    'TV',
    'TABLEAU INTERACTIF',
    "TABLE D'EXAMEN",
    'ESCABEAU INOX',
  ],
  'MOBILIER_DE_BUREAU': [
    'Chaise roulante',
    'Bureau simple',
    'Table basse',
    'Chaise visiteur',
    'Climatiseur',
    'Chaise iso',
    'Chaise ecritoire',
    'Fauteuil president',
    'Porte manteau',
    'Armoire metallique GF',
    'Armoire metallique PF',
    'CLAPET a 10 cases',
    'CLAPET a 4cases',
    'Bain huile',
    'Table',
    'TABOURET',
    'Réfrigérateur',
    'Congélateur',
    'Escabeau',
    'ARMOIRE COULISSANTE',
  ],
  'FOURNITURE_INFORMATIQUE': [
    'Switch',
    'Pointeur',
    'Ralonge 5M',
    'Ralonge 5 ports',
    'Cable VGA',
    'Cable HDMI',
    'STREAMING',
    'SERVEUR',
    'ADAPTATEUR',
    'DD EXTERNE',
    'SUPPORT AFFICHE',
  ],
};

// ─────────────────────────────────────────────────────────────
// HELPER: Pick value from multiple keys (handles camelCase/snake_case)
// ─────────────────────────────────────────────────────────────

function pickValue(obj, keys, fallback = null) {
  if (!obj) return fallback;
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && `${value}`.trim() !== '') {
      return value;
    }
  }
  return fallback;
}

function getNomSousCategorie(ressource) {
  const sousCategorie = ressource?.sous_categorie || ressource?.sousCategorie;
  return pickValue(sousCategorie, ['nom_sous_categorie', 'nomSousCategorie'], '');
}

// ─────────────────────────────────────────────────────────────
// SUMMARY CARDS COMPONENT
// ─────────────────────────────────────────────────────────────

function SummaryCards({ stockQuery, instancesQuery }) {
  const stocks = stockQuery.data?.data || [];
  const instances = instancesQuery.data?.data || [];

  const totalConsommables = stocks.reduce((sum, s) => sum + (s.quantite_disponible || 0), 0);
  const totalBiens = instances.filter((i) => pickValue(i?.ressource, ['is_bien_inventaire', 'isBienInventaire'], false)).length;
  const alertes = stocks.filter((s) => s.quantite_disponible < s.seuil_alerte).length;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
      <SummaryCard
        title="Total consommables"
        value={totalConsommables}
        color="#0C447C"
      />
      <SummaryCard
        title="Total biens inventaire"
        value={totalBiens}
        color="#3C3489"
      />
      <SummaryCard
        title="Alertes stock"
        value={alertes}
        color={alertes > 0 ? '#DC2626' : '#10B981'}
      />
    </div>
  );
}

function SummaryCard({ title, value, color }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: 12,
      padding: 16,
    }}>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 600, color }}>{value}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// BREADCRUMB COMPONENT
// ─────────────────────────────────────────────────────────────

function Breadcrumb({ activeType, activeCategorie, activeSousCategorie, onSegmentClick }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, fontSize: 14, color: '#6b7280' }}>
      <span style={{ cursor: 'pointer', color: '#0C447C' }} onClick={() => onSegmentClick('type')}>Stock</span>
      {activeType && (
        <>
          <span>›</span>
          <span
            style={{ cursor: 'pointer', color: '#0C447C' }}
            onClick={() => onSegmentClick('categorie')}
          >
            {activeType}
          </span>
        </>
      )}
      {activeCategorie && (
        <>
          <span>›</span>
          <span
            style={{ cursor: 'pointer', color: '#0C447C' }}
            onClick={() => onSegmentClick('sousCategorie')}
          >
            {formatCategorieName(activeCategorie)}
          </span>
        </>
      )}
      {activeSousCategorie && (
        <>
          <span>›</span>
          <span>{activeSousCategorie}</span>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TYPE TABS
// ─────────────────────────────────────────────────────────────

function TypeTabs({ activeType, onTypeChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
      {['Consommables', 'Biens Inventaire'].map((type) => (
        <button
          key={type}
          onClick={() => onTypeChange(type)}
          style={{
            padding: '10px 16px',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 500,
            fontSize: 14,
            background: activeType === type
              ? (type === 'Consommables' ? '#0C447C' : '#3C3489')
              : '#fff',
            color: activeType === type ? '#fff' : '#6b7280',
            borderWidth: activeType === type ? 0 : 1,
            borderStyle: 'solid',
            borderColor: '#d1d5db',
            transition: 'all 200ms',
          }}
        >
          {type}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CATEGORY CARDS
// ─────────────────────────────────────────────────────────────

function CategoryCards({ activeType, activeCategorie, onCategorieChange }) {
  const taxonomy = activeType === 'Consommables' ? CONSOMMABLE_TAXONOMY : BIEN_INVENTAIRE_TAXONOMY;
  const categories = Object.keys(taxonomy);

  if (!activeType) return null;

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 14, fontWeight: 600 }}>Catégories</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
        {categories.map((cat) => (
          <div
            key={cat}
            onClick={() => onCategorieChange(cat)}
            style={{
              padding: 14,
              background: '#fff',
              border: activeCategorie === cat
                ? `1.5px solid ${activeType === 'Consommables' ? '#0C447C' : '#3C3489'}`
                : '0.5px solid #e5e7eb',
              borderRadius: 10,
              cursor: 'pointer',
              transition: 'all 200ms',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>{formatCategorieName(cat)}</div>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>
              {activeType === 'Consommables'
                ? 'Catégorie consommable'
                : `${taxonomy[cat].length} élément${taxonomy[cat].length > 1 ? 's' : ''}`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SOUS-CATEGORIE PILLS
// ─────────────────────────────────────────────────────────────

function SousCategoryPills({ activeType, activeCategorie, activeSousCategorie, onSousCategorieChange }) {
  if (activeType === 'Consommables') return null;

  const taxonomy = activeType === 'Consommables' ? CONSOMMABLE_TAXONOMY : BIEN_INVENTAIRE_TAXONOMY;
  const pills = activeCategorie ? taxonomy[activeCategorie] : [];

  if (!activeCategorie) return null;

  const accentColor = activeType === 'Consommables' ? '#0C447C' : '#3C3489';
  const bgColor = activeType === 'Consommables' ? '#E6F1FB' : '#EEEDFE';

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {pills.map((pill) => (
          <button
            key={pill}
            onClick={() => onSousCategorieChange(pill)}
            style={{
              padding: '6px 12px',
              border: `1px solid ${activeSousCategorie === pill ? accentColor : '#d1d5db'}`,
              borderRadius: 20,
              background: activeSousCategorie === pill ? bgColor : '#fff',
              color: activeSousCategorie === pill ? accentColor : '#6b7280',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: activeSousCategorie === pill ? 500 : 400,
              transition: 'all 150ms',
            }}
          >
            {pill}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CONSOMMABLES TABLE
// ─────────────────────────────────────────────────────────────

function ConsommablesTable({ stocks, searchTerm, onSearchChange, isLoading }) {
  const filteredStocks = stocks.filter((s) =>
    s.designation.toLowerCase().includes(searchTerm.toLowerCase())
  );

  function getStatutBadge(disponible, seuil) {
    if (disponible > seuil) {
      return { label: 'Normal', color: '#10B981' };
    } else if (disponible === seuil) {
      return { label: 'Bas', color: '#F59E0B' };
    }
    return { label: 'Critique', color: '#DC2626' };
  }

  return (
    <div>
      <input
        type="text"
        placeholder="Rechercher par désignation..."
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        style={{
          width: '100%',
          padding: '8px 12px',
          border: '1px solid #d1d5db',
          borderRadius: 8,
          fontSize: 14,
          marginBottom: 14,
        }}
      />

      {isLoading ? (
        <div style={{ display: 'grid', gap: 8 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ height: 42, background: '#f3f4f6', borderRadius: 8 }} />
          ))}
        </div>
      ) : filteredStocks.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#6b7280', padding: '32px 0' }}>
          Aucun article dans cette catégorie.
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
              <th style={{ padding: 12, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#6b7280', letterSpacing: '0.05em' }}>Désignation</th>
              <th style={{ padding: 12, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#6b7280', letterSpacing: '0.05em' }}>Qté disponible</th>
              <th style={{ padding: 12, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#6b7280', letterSpacing: '0.05em' }}>Seuil alerte</th>
              <th style={{ padding: 12, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#6b7280', letterSpacing: '0.05em' }}>Statut</th>
            </tr>
          </thead>
          <tbody>
            {filteredStocks.map((stock) => {
              const badge = getStatutBadge(stock.quantite_disponible, stock.seuil_alerte);
              return (
                <tr key={stock.id_stock} style={{ borderTop: '1px solid #f3f4f6', transition: 'background 150ms' }} onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'} onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}>
                  <td style={{ padding: 12 }}>{stock.designation}</td>
                  <td style={{ padding: 12 }}>{stock.quantite_disponible}</td>
                  <td style={{ padding: 12 }}>{stock.seuil_alerte}</td>
                  <td style={{ padding: 12 }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 8px',
                      borderRadius: 4,
                      background: badge.color + '20',
                      color: badge.color,
                      fontSize: 12,
                      fontWeight: 500,
                    }}>
                      {badge.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// BIENS INVENTAIRE TABLE
// ─────────────────────────────────────────────────────────────

function BiensInventaireTable({ ressources, instances, searchTerm, onSearchChange, onDetailsClick, isLoading }) {
  const ressourceMap = new Map(
    ressources.map((r) => [Number(pickValue(r, ['id_ressource', 'idRessource'], 0)), r])
  );

  const grouped = {};
  instances.forEach((inst) => {
    const resId = Number(pickValue(inst, ['id_ressource', 'idRessource'], 0));
    if (!grouped[resId]) {
      grouped[resId] = [];
    }
    grouped[resId].push(inst);
  });

  const bienRows = Object.entries(grouped)
    .map(([resId, insts]) => ({
      ressource: ressourceMap.get(Number(resId)),
      count: insts.length,
      instances: insts,
    }))
    .filter((row) => row.ressource && row.ressource.designation.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div>
      <input
        type="text"
        placeholder="Rechercher par désignation..."
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        style={{
          width: '100%',
          padding: '8px 12px',
          border: '1px solid #d1d5db',
          borderRadius: 8,
          fontSize: 14,
          marginBottom: 14,
        }}
      />

      {isLoading ? (
        <div style={{ display: 'grid', gap: 8 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ height: 42, background: '#f3f4f6', borderRadius: 8 }} />
          ))}
        </div>
      ) : bienRows.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#6b7280', padding: '32px 0' }}>
          Aucun article dans cette sous-catégorie.
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
              <th style={{ padding: 12, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#6b7280', letterSpacing: '0.05em' }}>Désignation</th>
              <th style={{ padding: 12, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#6b7280', letterSpacing: '0.05em' }}>Quantité</th>
              <th style={{ padding: 12, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#6b7280', letterSpacing: '0.05em' }}>Seuil</th>
              <th style={{ padding: 12, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#6b7280', letterSpacing: '0.05em' }}>Détails</th>
            </tr>
          </thead>
          <tbody>
            {bienRows.map((row) => (
              <tr key={row.ressource.id_ressource} style={{ borderTop: '1px solid #f3f4f6', transition: 'background 150ms' }} onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'} onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}>
                <td style={{ padding: 12 }}>{row.ressource.designation}</td>
                <td style={{ padding: 12 }}>{row.count}</td>
                <td style={{ padding: 12 }}>5</td>
                <td style={{ padding: 12 }}>
                  <button
                    onClick={() => onDetailsClick(row.ressource, row.instances)}
                    style={{
                      padding: '6px 12px',
                      border: 'none',
                      borderRadius: 6,
                      background: '#0C447C',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 500,
                    }}
                  >
                    Voir détails
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DETAILS MODAL
// ─────────────────────────────────────────────────────────────

function DetailsModal({ ressource, instances, onClose }) {
  if (!ressource) return null;

  const queryClient = useQueryClient();
  const [filterStatut, setFilterStatut] = useState('tous');
  const [modalWidth, setModalWidth] = useState(820);
  const [resizeState, setResizeState] = useState(null);
  const [hoveredHandle, setHoveredHandle] = useState(null);
  const [editingRowId, setEditingRowId] = useState(null);
  const [editingDrafts, setEditingDrafts] = useState({});
  const [editedById, setEditedById] = useState({});

  const updateInstanceMutation = useMutation({
    mutationFn: ({ instanceId, payload }) => updateInstance(instanceId, payload),
  });

  const servicesQuery = useQuery({
    queryKey: ['users', 'services'],
    queryFn: () => getServices(),
    staleTime: STALE_TIME,
  });

  const services = useMemo(() => servicesQuery.data?.data || [], [servicesQuery.data?.data]);
  const serviceById = useMemo(
    () => new Map(services.map((service) => [String(pickValue(service, ['id_service', 'idService'], '')), service])),
    [services]
  );

  function getServiceLabel(serviceId, fallback = '—') {
    if (serviceId === null || serviceId === undefined || serviceId === '') return fallback;
    return pickValue(serviceById.get(String(serviceId)), ['nom_service', 'nomService'], fallback) || fallback;
  }

  const primaryInstanceId = pickValue(instances?.[0], ['id_instance', 'idInstance'], null);
  const instanceQuery = useQuery({
    queryKey: ['resources', 'instance', primaryInstanceId],
    queryFn: () => getInstance(primaryInstanceId),
    enabled: Boolean(primaryInstanceId),
    staleTime: STALE_TIME,
  });

  const primaryInstance = instanceQuery.data?.data || instances?.[0] || null;
  const primaryLot = pickValue(primaryInstance, ['id_lot', 'idLot'], null);
  const primaryMarche = pickValue(primaryLot, ['id_marche', 'idMarche'], null);
  const acquisitionDisplay = pickValue(primaryInstance, ['date_acquisition_display', 'dateAcquisitionDisplay'], null);
  const acquisitionRaw = pickValue(primaryInstance, ['date_acquisition', 'dateAcquisition'], null);
  const acquisitionMarcheCreation = pickValue(primaryMarche, ['date_creation', 'dateCreation'], null);
  const acquisitionMarchePrevue = pickValue(primaryMarche, ['date_livraison_prevue', 'dateLivraisonPrevue'], null);
  const referenceMarche = pickValue(primaryInstance, ['reference_marche', 'referenceMarche'], null)
    || pickValue(primaryMarche, ['reference'], null);

  const normalizedInstances = useMemo(
    () =>
      (instances || []).map((inst) => {
        const rowId = pickValue(inst, ['id_instance', 'idInstance'], 0);
        const editedValues = editedById[rowId] || {};
        const lot = pickValue(inst, ['id_lot', 'idLot'], null);
        const marche = pickValue(lot, ['id_marche', 'idMarche'], null);

        const dateAcquisition =
          pickValue(inst, ['date_acquisition_display', 'dateAcquisitionDisplay'], null)
          || pickValue(inst, ['date_acquisition', 'dateAcquisition'], null)
          || pickValue(marche, ['date_creation', 'dateCreation'], null)
          || pickValue(marche, ['date_livraison_prevue', 'dateLivraisonPrevue'], null)
          || acquisitionDisplay
          || acquisitionRaw
          || acquisitionMarcheCreation
          || acquisitionMarchePrevue;

        const serviceId =
          pickValue(inst, ['id_service_actuel', 'idServiceActuel'], null)
          || pickValue(inst?.service_actuel, ['id_service', 'idService'], null)
          || null;

        const refMarche =
          pickValue(inst, ['reference_marche', 'referenceMarche'], null)
          || pickValue(marche, ['reference'], null)
          || referenceMarche;

        return {
          ...inst,
          __numeroInventaire: pickValue(inst, ['numero_inventaire', 'numeroInventaire'], ''),
          __etat: editedValues.etat ?? pickValue(inst, ['etat'], ''),
          __statut: editedValues.statut ?? pickValue(inst, ['statut'], ''),
          __serviceId: editedValues.serviceId ?? serviceId,
          __serviceAffecte:
            editedValues.serviceAffecte
            || getServiceLabel(editedValues.serviceId ?? serviceId)
            || pickValue(inst, ['service_actuel.nom_service'], null)
            || pickValue(inst?.service_actuel, ['nom_service', 'nomService'], null)
            || '—',
          __localisation:
            editedValues.localisation
            ?? pickValue(inst, ['localisation_actuelle', 'localisationActuelle'], null)
            ?? '—',
          __observation: editedValues.observation ?? pickValue(inst, ['observation'], '') ?? '',
          __dateAcquisition: dateAcquisition,
          __refMarche: refMarche,
        };
      }),
    [
      instances,
      acquisitionDisplay,
      acquisitionRaw,
      acquisitionMarcheCreation,
      acquisitionMarchePrevue,
      referenceMarche,
      editedById,
      serviceById,
    ]
  );

  const filteredInstances = useMemo(() => {
    if (filterStatut === 'tous') return normalizedInstances;
    return normalizedInstances.filter((inst) => inst.__statut === filterStatut);
  }, [normalizedInstances, filterStatut]);

  const totalCount = normalizedInstances.length;
  const enStockCount = normalizedInstances.filter((inst) => inst.__statut === 'en_stock').length;
  const minModalWidth = 600;
  const maxModalWidth = Math.floor(window.innerWidth * 0.95);

  function getEtatBadge(etat) {
    const badges = {
      'neuf': { label: 'Neuf', color: '#10B981' },
      'bon_etat': { label: 'Bon état', color: '#06B6D4' },
      'usage_normal': { label: 'Usage normal', color: '#F59E0B' },
      'endommage': { label: 'Endommagé', color: '#DC2626' },
      'hors_service': { label: 'Hors service', color: '#64748b' },
    };
    return badges[etat] || { label: etat, color: '#9ca3af' };
  }

  function getStatutBadge(statut) {
    const badges = {
      'en_stock': { label: 'En stock', color: '#10B981' },
      'en_service': { label: 'En service', color: '#3B82F6' },
      'en_maintenance': { label: 'En maintenance', color: '#F59E0B' },
      'hors_service': { label: 'Hors service', color: '#DC2626' },
      'retire': { label: 'Retiré', color: '#6b7280' },
    };
    return badges[statut] || { label: statut, color: '#9ca3af' };
  }

  function startResize(side, event) {
    event.preventDefault();
    setResizeState({
      side,
      startX: event.clientX,
      startWidth: modalWidth,
    });
  }

  function handleResizeMove(event) {
    if (!resizeState) return;

    const deltaX = event.clientX - resizeState.startX;
    const nextWidth =
      resizeState.side === 'right'
        ? resizeState.startWidth + deltaX
        : resizeState.startWidth - deltaX;

    const clampedWidth = Math.max(minModalWidth, Math.min(maxModalWidth, nextWidth));
    setModalWidth(clampedWidth);
  }

  function stopResize() {
    if (resizeState) setResizeState(null);
  }

  useEffect(() => {
    if (!resizeState) return undefined;

    function onMouseMove(event) {
      handleResizeMove(event);
    }

    function onMouseUp() {
      stopResize();
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [resizeState]);

  function openEditRow(inst) {
    const rowId = pickValue(inst, ['id_instance', 'idInstance'], 0);
    setEditingRowId(rowId);
    setEditingDrafts((prev) => ({
      ...prev,
      [rowId]: {
        statut: inst.__statut || '',
        etat: inst.__etat || '',
        serviceId: inst.__serviceId ?? '',
        localisation: inst.__localisation === '—' ? '' : inst.__localisation,
        observation: inst.__observation || '',
      },
    }));
  }

  function updateDraft(rowId, field, value) {
    setEditingDrafts((prev) => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
        [field]: value,
      },
    }));
  }

  async function saveRowEdit(rowId) {
    const draft = editingDrafts[rowId] || {};
    const currentRow = normalizedInstances.find(
      (inst) => pickValue(inst, ['id_instance', 'idInstance'], 0) === rowId
    );

    if (!currentRow) {
      toast.error('Instance introuvable.');
      return;
    }

    const payload = {
      statut: draft.statut ?? currentRow.__statut,
      etat: draft.etat ?? currentRow.__etat,
      id_service_actuel: draft.serviceId === '' || draft.serviceId === null || draft.serviceId === undefined
        ? null
        : Number(draft.serviceId),
      localisation_actuelle: draft.localisation ?? currentRow.__localisation,
      observation: draft.observation ?? currentRow.__observation,
    };

    const serviceLabel = getServiceLabel(payload.id_service_actuel, currentRow.__serviceAffecte);

    try {
      await updateInstanceMutation.mutateAsync({ instanceId: rowId, payload });

      setEditedById((prev) => ({
        ...prev,
        [rowId]: {
          statut: payload.statut,
          etat: payload.etat,
          localisation: payload.localisation_actuelle,
          observation: payload.observation,
          serviceId: payload.id_service_actuel,
          serviceAffecte: serviceLabel,
        },
      }));

      setEditingRowId(null);
      toast.success('Modification enregistrée.');
      queryClient.invalidateQueries({ queryKey: ['resources', 'instances'] });
      queryClient.invalidateQueries({ queryKey: ['resources', 'instance', rowId] });
    } catch (error) {
      const message = error?.response?.data?.detail || 'Échec de la sauvegarde.';
      toast.error(message);
    }
  }

  function cancelRowEdit() {
    setEditingRowId(null);
  }

  function resetModalWidth() {
    setModalWidth(820);
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.35)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      zIndex: 90,
      paddingTop: 40,
      overflowY: 'auto',
    }} onClick={onClose}>
      <div style={{
        width: `${Math.max(minModalWidth, Math.min(maxModalWidth, modalWidth))}px`,
        background: '#fff',
        borderRadius: 12,
        border: '1px solid #e5e7eb',
        overflow: 'hidden',
        position: 'relative',
      }} onClick={(e) => e.stopPropagation()}>
        <div
          onMouseDown={(event) => startResize('left', event)}
          onMouseEnter={() => setHoveredHandle('left')}
          onMouseLeave={() => setHoveredHandle((current) => (current === 'left' ? null : current))}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: 6,
            height: '100%',
            cursor: 'ew-resize',
            background: hoveredHandle === 'left' ? '#22c55e' : 'transparent',
            transition: 'background 120ms ease',
            zIndex: 2,
          }}
        />
        <div
          onMouseDown={(event) => startResize('right', event)}
          onMouseEnter={() => setHoveredHandle('right')}
          onMouseLeave={() => setHoveredHandle((current) => (current === 'right' ? null : current))}
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            width: 6,
            height: '100%',
            cursor: 'ew-resize',
            background: hoveredHandle === 'right' ? '#22c55e' : 'transparent',
            transition: 'background 120ms ease',
            zIndex: 2,
          }}
        />
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 16,
          borderBottom: '1px solid #e5e7eb',
        }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{ressource.designation}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={resetModalWidth}
              style={{
                width: 30,
                height: 30,
                border: '1px solid #d1d5db',
                borderRadius: 6,
                background: '#fff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#4b5563',
              }}
              title="Reset largeur"
            >
              <Maximize2 size={14} />
            </button>
            <button onClick={onClose} style={{
              background: 'none',
              border: 'none',
              fontSize: 20,
              cursor: 'pointer',
              color: '#6b7280',
            }}>×</button>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: 16 }}>
          {instances.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#6b7280', padding: '24px 0' }}>
              Aucune instance trouvée.
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12 }}>
                  <span style={{ color: '#374151' }}><strong>Total</strong> {totalCount}</span>
                  <span style={{ color: '#065f46' }}><strong>En stock</strong> {enStockCount}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label htmlFor="filter-statut-modal" style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>Filtre statut</label>
                  <select
                    id="filter-statut-modal"
                    value={filterStatut}
                    onChange={(e) => setFilterStatut(e.target.value)}
                    style={{
                      border: '1px solid #d1d5db',
                      borderRadius: 8,
                      padding: '6px 10px',
                      fontSize: 12,
                      color: '#111827',
                      background: '#fff',
                    }}
                  >
                    <option value="tous">Tous</option>
                    <option value="en_stock">En stock</option>
                    <option value="en_service">En service</option>
                    <option value="en_maintenance">En maintenance</option>
                    <option value="hors_service">Hors service</option>
                  </select>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 980 }}>
                  <thead>
                    <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                      <th style={{ padding: 10, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#6b7280' }}>N° inventaire</th>
                      <th style={{ padding: 10, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#6b7280' }}>État</th>
                      <th style={{ padding: 10, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#6b7280' }}>Statut</th>
                      <th style={{ padding: 10, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#6b7280' }}>Service affecté</th>
                      <th style={{ padding: 10, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#6b7280' }}>Localisation</th>
                      <th style={{ padding: 10, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#6b7280' }}>Observation</th>
                      <th style={{ padding: 10, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#6b7280' }}>Date acquisition</th>
                      <th style={{ padding: 10, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#6b7280' }}>Réf. marché</th>
                      <th style={{ padding: 10, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#6b7280' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInstances.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ padding: 14, color: '#6b7280', textAlign: 'center' }}>
                          Aucune instance pour ce filtre.
                        </td>
                      </tr>
                    ) : (
                      filteredInstances.map((inst) => {
                        const rowId = pickValue(inst, ['id_instance', 'idInstance'], 0);
                        const isEditing = editingRowId === rowId;
                        const draft = editingDrafts[rowId] || {};
                        const etatBadge = getEtatBadge(inst.__etat);
                        const statutBadge = getStatutBadge(inst.__statut);

                        return (
                          <tr key={pickValue(inst, ['id_instance', 'idInstance'], 0)} style={{ borderTop: '1px solid #f3f4f6' }}>
                            <td style={{ padding: 10 }}>{inst.__numeroInventaire || '—'}</td>
                            <td style={{ padding: 10 }}>
                              {isEditing ? (
                                <select
                                  value={draft.etat ?? inst.__etat}
                                  onChange={(e) => updateDraft(rowId, 'etat', e.target.value)}
                                  style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '5px 7px', fontSize: 12 }}
                                >
                                  <option value="neuf">Neuf</option>
                                  <option value="bon_etat">Bon état</option>
                                  <option value="usage_normal">Usage normal</option>
                                  <option value="endommage">Endommagé</option>
                                  <option value="hors_service">Hors service</option>
                                </select>
                              ) : (
                                <span style={{
                                  display: 'inline-block',
                                  padding: '3px 6px',
                                  borderRadius: 3,
                                  background: etatBadge.color + '20',
                                  color: etatBadge.color,
                                  fontSize: 11,
                                  fontWeight: 500,
                                }}>
                                  {etatBadge.label}
                                </span>
                              )}
                            </td>
                            <td style={{ padding: 10 }}>
                              {isEditing ? (
                                <select
                                  value={draft.statut ?? inst.__statut}
                                  onChange={(e) => updateDraft(rowId, 'statut', e.target.value)}
                                  style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '5px 7px', fontSize: 12 }}
                                >
                                  <option value="en_stock">En stock</option>
                                  <option value="en_service">En service</option>
                                  <option value="en_maintenance">En maintenance</option>
                                  <option value="hors_service">Hors service</option>
                                </select>
                              ) : (
                                <span style={{
                                  display: 'inline-block',
                                  padding: '3px 6px',
                                  borderRadius: 3,
                                  background: statutBadge.color + '20',
                                  color: statutBadge.color,
                                  fontSize: 11,
                                  fontWeight: 500,
                                }}>
                                  {statutBadge.label}
                                </span>
                              )}
                            </td>
                            <td style={{ padding: 10 }}>
                              {isEditing ? (
                                <select
                                  value={draft.serviceId ?? ''}
                                  onChange={(e) => updateDraft(rowId, 'serviceId', e.target.value)}
                                  style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '5px 7px', fontSize: 12, width: '100%' }}
                                >
                                  <option value="">Aucun service</option>
                                  {services.map((service) => {
                                    const serviceId = pickValue(service, ['id_service', 'idService'], '');
                                    const serviceName = pickValue(service, ['nom_service', 'nomService'], '');
                                    return (
                                      <option key={serviceId} value={serviceId}>
                                        {serviceName}
                                      </option>
                                    );
                                  })}
                                </select>
                              ) : (inst.__serviceAffecte || '—')}
                            </td>
                            <td style={{ padding: 10 }}>
                              {isEditing ? (
                                <input
                                  value={draft.localisation ?? ''}
                                  onChange={(e) => updateDraft(rowId, 'localisation', e.target.value)}
                                  style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '5px 7px', fontSize: 12, width: '100%' }}
                                />
                              ) : (inst.__localisation || '—')}
                            </td>
                            <td style={{ padding: 10 }}>
                              {isEditing ? (
                                <input
                                  value={draft.observation ?? ''}
                                  onChange={(e) => updateDraft(rowId, 'observation', e.target.value)}
                                  style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '5px 7px', fontSize: 12, width: '100%' }}
                                />
                              ) : (inst.__observation || '—')}
                            </td>
                            <td style={{ padding: 10 }}>
                              {inst.__dateAcquisition ? new Date(inst.__dateAcquisition).toLocaleDateString('fr-FR') : '—'}
                            </td>
                            <td style={{ padding: 10 }}>{inst.__refMarche || '—'}</td>
                            <td style={{ padding: 10 }}>
                              {isEditing ? (
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button
                                    type="button"
                                    onClick={() => saveRowEdit(rowId)}
                                    disabled={updateInstanceMutation.isPending}
                                    style={{
                                      padding: '5px 10px',
                                      border: '1px solid #16a34a',
                                      borderRadius: 6,
                                      background: '#16a34a',
                                      color: '#fff',
                                      cursor: updateInstanceMutation.isPending ? 'not-allowed' : 'pointer',
                                      fontSize: 12,
                                      fontWeight: 500,
                                      opacity: updateInstanceMutation.isPending ? 0.6 : 1,
                                    }}
                                  >
                                    Enregistrer
                                  </button>
                                  <button
                                    type="button"
                                    onClick={cancelRowEdit}
                                    style={{
                                      padding: '5px 10px',
                                      border: '1px solid #d1d5db',
                                      borderRadius: 6,
                                      background: '#fff',
                                      color: '#111827',
                                      cursor: 'pointer',
                                      fontSize: 12,
                                      fontWeight: 500,
                                    }}
                                  >
                                    Annuler
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => openEditRow(inst)}
                                  style={{
                                    padding: '5px 10px',
                                    border: '1px solid #d1d5db',
                                    borderRadius: 6,
                                    background: '#fff',
                                    color: '#111827',
                                    cursor: 'pointer',
                                    fontSize: 12,
                                    fontWeight: 500,
                                  }}
                                >
                                  Modifier
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
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          padding: 16,
          borderTop: '1px solid #e5e7eb',
          background: '#f9fafb',
        }}>
          <button onClick={onClose} style={{
            padding: '8px 16px',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            background: '#fff',
            color: '#111827',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 500,
          }}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────

export default function StockPage() {
  const [activeType, setActiveType] = useState(null);
  const [activeCategorie, setActiveCategorie] = useState(null);
  const [activeSousCategorie, setActiveSousCategorie] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRessource, setSelectedRessource] = useState(null);
  const [selectedInstances, setSelectedInstances] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);

  const stockQuery = useQuery({
    queryKey: ['resources', 'stocks'],
    queryFn: getStock,
    staleTime: STALE_TIME,
  });

  const instancesQuery = useQuery({
    queryKey: ['resources', 'instances'],
    queryFn: getInstances,
    staleTime: STALE_TIME,
  });

  const ressourcesQuery = useQuery({
    queryKey: ['resources', 'ressources'],
    queryFn: () => getRessources(),
    staleTime: STALE_TIME,
  });

  // Normalize stock data
  const stocks = useMemo(() => {
    const items = stockQuery.data?.data || [];
    return items.map((s) => ({
      ...s,
      id_stock: Number(pickValue(s, ['id_stock', 'idStock'], 0)),
      id_ressource: Number(pickValue(s, ['id_ressource', 'idRessource'], 0)),
      quantite_disponible: Number(pickValue(s, ['quantite_disponible', 'quantiteDisponible'], 0)),
      seuil_alerte: Number(pickValue(s, ['seuil_alerte', 'seuilAlerte'], 0)),
      designation: pickValue(s?.id_ressource || s?.idRessource, ['designation'], '—'),
    }));
  }, [stockQuery.data?.data]);

  // Normalize instances data
  const instances = useMemo(() => {
    const items = instancesQuery.data?.data || [];
    return items.map((i) => ({
      ...i,
      id_instance: Number(pickValue(i, ['id_instance', 'idInstance'], 0)),
      id_ressource: Number(pickValue(i, ['id_ressource', 'idRessource'], 0)),
    }));
  }, [instancesQuery.data?.data]);

  // Normalize ressources data
  const ressources = useMemo(() => {
    const items = ressourcesQuery.data?.data || [];
    return items.map((r) => ({
      ...r,
      id_ressource: Number(pickValue(r, ['id_ressource', 'idRessource'], 0)),
      designation: pickValue(r, ['designation'], '—'),
    }));
  }, [ressourcesQuery.data?.data]);

  // Filter stocks by type and sous-categorie
  const filteredStocks = useMemo(() => {
    if (!activeType || activeType !== 'Consommables' || !activeCategorie) return [];
    return stocks.filter((s) => {
      const ressource = ressources.find((r) => r.id_ressource === s.id_ressource);
      if (!ressource) return false;
      return normalizeStringForFilter(getNomSousCategorie(ressource)) === normalizeStringForFilter(activeCategorie);
    });
  }, [stocks, ressources, activeType, activeCategorie]);

  // Filter instances by type and sous-categorie
  const filteredInstances = useMemo(() => {
    if (!activeType || activeType !== 'Biens Inventaire' || !activeSousCategorie) return [];
    return instances.filter((inst) => {
      const ressource = ressources.find((r) => r.id_ressource === inst.id_ressource);
      if (!ressource) return false;
      return normalizeStringForFilter(getNomSousCategorie(ressource)) === normalizeStringForFilter(activeSousCategorie);
    });
  }, [instances, ressources, activeType, activeSousCategorie]);

  // Reset sub-states when parent state changes
  const handleTypeChange = (type) => {
    setActiveType(type);
    setActiveCategorie(null);
    setActiveSousCategorie(null);
    setSearchTerm('');
  };

  const handleCategorieChange = (cat) => {
    setActiveCategorie(cat);
    setActiveSousCategorie(activeType === 'Biens Inventaire' ? null : '');
    setSearchTerm('');
  };

  const handleBreadcrumbClick = (level) => {
    if (level === 'type') {
      setActiveType(null);
      setActiveCategorie(null);
      setActiveSousCategorie(null);
    } else if (level === 'categorie') {
      setActiveCategorie(null);
      setActiveSousCategorie(null);
    } else if (level === 'sousCategorie') {
      setActiveSousCategorie(null);
    }
  };

  const isLoading = stockQuery.isLoading || instancesQuery.isLoading || ressourcesQuery.isLoading;

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <h1 style={{ margin: 0 }}>Stock</h1>

      <SummaryCards stockQuery={stockQuery} instancesQuery={instancesQuery} />

      <Breadcrumb
        activeType={activeType}
        activeCategorie={activeCategorie}
        activeSousCategorie={activeSousCategorie}
        onSegmentClick={handleBreadcrumbClick}
      />

      <TypeTabs activeType={activeType} onTypeChange={handleTypeChange} />

      <CategoryCards
        activeType={activeType}
        activeCategorie={activeCategorie}
        onCategorieChange={handleCategorieChange}
      />

      <SousCategoryPills
        activeType={activeType}
        activeCategorie={activeCategorie}
        activeSousCategorie={activeSousCategorie}
        onSousCategorieChange={setActiveSousCategorie}
      />

      {(activeType === 'Consommables' ? Boolean(activeCategorie) : Boolean(activeSousCategorie)) && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
          {activeType === 'Consommables' ? (
            <ConsommablesTable
              stocks={filteredStocks}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              isLoading={isLoading}
            />
          ) : (
            <BiensInventaireTable
              ressources={ressources}
              instances={filteredInstances}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              onDetailsClick={(res, insts) => {
                setSelectedRessource(res);
                setSelectedInstances(insts);
                setModalOpen(true);
              }}
              isLoading={isLoading}
            />
          )}
        </div>
      )}

      {modalOpen && (
        <DetailsModal
          ressource={selectedRessource}
          instances={selectedInstances}
          onClose={() => {
            setModalOpen(false);
            setSelectedRessource(null);
            setSelectedInstances([]);
          }}
        />
      )}
    </div>
  );
}
