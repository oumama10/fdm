import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Box, Boxes, ChevronRight, Package, Search, X } from 'lucide-react';

import {
  getCategories, getInstances, getRessources, getStock,
  getStockSummary, getSousCategories, updateInstance,
  setStockSeuil, setRessourceSeuil, getMouvements,
} from '../../api/resources';
import { getEtablissements, getServices, getBeneficiaires } from '../../api/users';

const STALE_TIME = 30_000;

const STATUT_LABELS = {
  en_stock: 'En stock',
  en_service: 'Affecté',
  en_maintenance: 'En maintenance',
  hors_service: 'Hors service',
  retire: 'Réformé',
};
const ETAT_LABELS = {
  neuf: 'Neuf',
  bon_etat: 'Bon',
  endommage: 'Endommagé',
  hors_service: 'Hors service',
  retourne: 'Retourné',
};
const STATUT_TONES = {
  en_stock: 'success',
  en_service: 'blue',
  en_maintenance: 'warning',
  hors_service: 'danger',
  retire: 'muted',
};
const ETAT_TONES = {
  neuf: 'success',
  bon_etat: 'success',
  endommage: 'danger',
  hors_service: 'danger',
  retourne: 'muted',
};

const TYPE_DEFINITIONS = {
  consommables: { label: 'Consommables', accent: '#0C447C', soft: '#E6F1FB', icon: Boxes },
  biens_inventaire: { label: 'Biens Inventaire', accent: '#3C3489', soft: '#EEEDFE', icon: Box },
};

export default function StockPage() {
  const queryClient = useQueryClient();

  const invalidateAfterSeuil = () => {
    queryClient.invalidateQueries({ queryKey: ['resources'] });
    queryClient.invalidateQueries({ queryKey: ['reporting', 'dashboard'] });
  };
  const setStockSeuilMutation = useMutation({
    mutationFn: ({ stockId, seuil }) => setStockSeuil(stockId, seuil),
    onSuccess: invalidateAfterSeuil,
  });
  const setRessourceSeuilMutation = useMutation({
    mutationFn: ({ ressourceId, seuil }) => setRessourceSeuil(ressourceId, seuil),
    onSuccess: invalidateAfterSeuil,
  });

  const [activeType, setActiveType] = useState('consommables');
  const [activeRootId, setActiveRootId] = useState(null);
  const [activeLeafId, setActiveLeafId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedConsommable, setSelectedConsommable] = useState(null);
  const [detailsModalData, setDetailsModalData] = useState(null);

  // ── Queries ────────────────────────────────────────────────────────────────
  const categoriesQuery = useQuery({
    queryKey: ['resources', 'categories', activeType],
    queryFn: () => getCategories({ is_consommable: activeType === 'consommables' }),
    staleTime: STALE_TIME,
  });
  const summaryQuery = useQuery({
    queryKey: ['resources', 'stock-summary'],
    queryFn: getStockSummary,
    staleTime: STALE_TIME,
  });
  const resourcesQuery = useQuery({
    queryKey: ['resources', 'ressources', activeType],
    queryFn: () => getRessources({ type: activeType }),
    staleTime: STALE_TIME,
  });
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

  const categories = categoriesQuery.data?.data || [];
  const resources = resourcesQuery.data?.data || [];
  const stocks = stockQuery.data?.data || [];
  const instances = instancesQuery.data?.data || [];
  const summary = summaryQuery.data?.data || {};

  const backendCategory = categories[0] || null;

  const sousCategoriesQuery = useQuery({
    queryKey: ['resources', 'sous-categories', getCategoryId(backendCategory)],
    queryFn: () => getSousCategories({ id_categorie: getCategoryId(backendCategory) }),
    enabled: Boolean(getCategoryId(backendCategory)),
    staleTime: STALE_TIME,
  });

  const sousCategories = sousCategoriesQuery.data?.data || [];

  const stockByResourceId = useMemo(
    () => new Map(stocks.map((s) => [String(s.id_ressource ?? s.idRessource), s])),
    [stocks],
  );

  // ── Sous-catégorie tree ───────────────────────────────────────────────────
  const roots = useMemo(
    () => sousCategories
      .filter((sc) => !getSousCategorieParentId(sc))
      .sort((a, b) => getSousCategorieName(a).localeCompare(getSousCategorieName(b), 'fr')),
    [sousCategories],
  );

  const children = useMemo(
    () => sousCategories
      .filter((sc) => String(getSousCategorieParentId(sc)) === String(activeRootId))
      .sort((a, b) => getSousCategorieName(a).localeCompare(getSousCategorieName(b), 'fr')),
    [sousCategories, activeRootId],
  );

  const selectedRoot = roots.find((sc) => String(getSousCategorieId(sc)) === String(activeRootId)) || null;
  const selectedLeaf = children.find((sc) => String(getSousCategorieId(sc)) === String(activeLeafId)) || null;

  // ── Cards (category level) ────────────────────────────────────────────────
  const cards = useMemo(() => roots.map((root) => {
    const rootId = String(getSousCategorieId(root));
    const childIds = sousCategories
      .filter((sc) => String(getSousCategorieParentId(sc)) === rootId)
      .map((sc) => String(getSousCategorieId(sc)));
    const allIds = new Set([rootId, ...childIds]);
    const articleCount = resources.filter((r) => allIds.has(String(getResourceSousCategorieId(r)))).length;
    return { ...root, articleCount };
  }), [roots, sousCategories, resources]);

  // ── Instances grouped by resource ─────────────────────────────────────────
  const instancesByResourceId = useMemo(() => {
    const map = new Map();
    instances.forEach((inst) => {
      const rid = String(inst.idRessource ?? inst.id_ressource ?? getResourceId(getInstanceResource(inst)) ?? '');
      if (!rid || rid === 'null' || rid === 'undefined') return;
      if (!map.has(rid)) map.set(rid, []);
      map.get(rid).push(inst);
    });
    return map;
  }, [instances]);

  // ── Consommable rows ──────────────────────────────────────────────────────
  const consumableRows = useMemo(() => {
    if (activeType !== 'consommables' || !selectedRoot) return [];
    return resources
      .filter((r) => r.is_consommable ?? r.isConsommable)
      .filter((r) => String(getResourceSousCategorieId(r)) === String(getSousCategorieId(selectedRoot)))
      .filter((r) => normalizeKey(getResourceDesignation(r)).includes(normalizeKey(searchTerm)))
      .map((r) => ({ resource: r, stock: stockByResourceId.get(String(getResourceId(r))) || null }))
      .sort((a, b) => getResourceDesignation(a.resource).localeCompare(getResourceDesignation(b.resource), 'fr'));
  }, [activeType, resources, selectedRoot, searchTerm, stockByResourceId]);

  // ── Bien inventaire articles (one row per Ressource) ──────────────────────
  const inventoryArticles = useMemo(() => {
    if (activeType !== 'biens_inventaire' || !selectedLeaf) return [];
    const term = normalizeKey(searchTerm);
    return resources
      .filter((r) => String(getResourceSousCategorieId(r)) === String(getSousCategorieId(selectedLeaf)))
      .filter((r) => {
        if (!term) return true;
        if (normalizeKey(getResourceDesignation(r)).includes(term)) return true;
        const rid = String(getResourceId(r));
        return (instancesByResourceId.get(rid) || []).some(
          (inst) => normalizeKey(getInstanceNumeroInventaire(inst)).includes(term),
        );
      })
      .sort((a, b) => getResourceDesignation(a).localeCompare(getResourceDesignation(b), 'fr'));
  }, [activeType, resources, selectedLeaf, searchTerm, instancesByResourceId]);

  // ── Navigation helpers ─────────────────────────────────────────────────────
  function resetAll() {
    setActiveType('consommables'); setActiveRootId(null); setActiveLeafId(null);
    setSearchTerm(''); setSelectedConsommable(null); setDetailsModalData(null);
  }
  function selectType(key) {
    setActiveType(key); setActiveRootId(null); setActiveLeafId(null);
    setSearchTerm(''); setSelectedConsommable(null); setDetailsModalData(null);
  }
  function selectRoot(id) {
    setActiveRootId(id); setActiveLeafId(null);
    setSearchTerm(''); setSelectedConsommable(null); setDetailsModalData(null);
  }
  function selectLeaf(id) {
    setActiveLeafId(id); setSearchTerm(''); setSelectedConsommable(null); setDetailsModalData(null);
  }

  const loading = categoriesQuery.isLoading || resourcesQuery.isLoading
    || stockQuery.isLoading || instancesQuery.isLoading || sousCategoriesQuery.isLoading;
  const typeDef = TYPE_DEFINITIONS[activeType];
  const showContent = (activeType === 'consommables' && selectedRoot)
    || (activeType === 'biens_inventaire' && selectedLeaf);

  const breadcrumbs = [
    { label: 'Stock', onClick: resetAll },
    { label: typeDef.label, onClick: () => selectType(activeType) },
    selectedRoot ? {
      label: getSousCategorieName(selectedRoot),
      onClick: activeType === 'biens_inventaire' ? () => selectRoot(getSousCategorieId(selectedRoot)) : null,
    } : null,
    activeType === 'biens_inventaire' && selectedLeaf
      ? { label: getSousCategorieName(selectedLeaf), onClick: null } : null,
  ].filter(Boolean);

  return (
    <div style={pageStyle}>
      {/* KPI row */}
      <section style={summaryGridStyle}>
        <MetricCard label="Consommables" value={summary.totalConsommables ?? summary.total_consommables ?? 0} tone="blue" />
        <MetricCard label="Biens inventaire" value={summary.totalBiensInventaire ?? summary.total_biens_inventaire ?? 0} tone="purple" />
        <MetricCard label="Alertes stock" value={summary.alertesStock ?? summary.alertes_stock ?? 0} tone="red" />
      </section>

      {/* Breadcrumb */}
      <nav style={breadcrumbStyle}>
        {breadcrumbs.map((item, i) => (
          <span key={`${item.label}-${i}`} style={breadcrumbItemStyle}>
            {i > 0 ? <ChevronRight size={14} color="#94a3b8" /> : null}
            {item.onClick
              ? <button type="button" onClick={item.onClick} style={breadcrumbButtonStyle}>{item.label}</button>
              : <span style={breadcrumbCurrentStyle}>{item.label}</span>}
          </span>
        ))}
      </nav>

      {/* Type tabs */}
      <div style={tabsStyle}>
        {Object.entries(TYPE_DEFINITIONS).map(([key, def]) => {
          const Icon = def.icon;
          const active = key === activeType;
          return (
            <button key={key} type="button" onClick={() => selectType(key)}
              style={{ ...tabButtonStyle, ...(active ? { borderColor: def.accent, background: def.soft, color: def.accent } : {}) }}>
              <Icon size={16} /><span>{def.label}</span>
            </button>
          );
        })}
      </div>

      {/* Category cards */}
      <div style={categoryGridStyle}>
        {loading ? <LoadingCard /> : cards.length === 0
          ? <EmptyState message="Aucune catégorie trouvée." />
          : cards.map((card) => {
            const active = String(getSousCategorieId(card)) === String(activeRootId);
            return (
              <button key={getSousCategorieId(card)} type="button"
                onClick={() => selectRoot(getSousCategorieId(card))}
                style={{ ...cardStyle, ...(active ? { borderColor: typeDef.accent, boxShadow: `0 0 0 1px ${typeDef.accent}` } : {}) }}>
                <div style={cardTopStyle}>
                  <span style={cardTitleStyle}>{getSousCategorieName(card)}</span>
                  <span style={articleBadgeStyle(card.articleCount)}>
                    {formatNumber(card.articleCount)} articles
                  </span>
                </div>
              </button>
            );
          })}
      </div>

      {/* Child pills — biens inventaire only */}
      {activeType === 'biens_inventaire' && selectedRoot ? (
        <div style={pillRowStyle}>
          {children.length === 0
            ? <EmptyState message="Aucune sous-catégorie enfant." compact />
            : children.map((child) => {
              const active = String(getSousCategorieId(child)) === String(activeLeafId);
              return (
                <button key={getSousCategorieId(child)} type="button"
                  onClick={() => selectLeaf(getSousCategorieId(child))}
                  style={{ ...pillStyle, ...(active ? { borderColor: typeDef.accent, background: typeDef.accent, color: '#fff' } : {}) }}>
                  {getSousCategorieName(child)}
                </button>
              );
            })}
        </div>
      ) : null}

      {/* Main content */}
      {!showContent
        ? <EmptyState message={activeType === 'consommables'
          ? 'Choisissez une catégorie pour afficher les articles.'
          : 'Choisissez une sous-catégorie pour afficher les articles.'} />
        : (
          <div style={tableShellStyle}>
            {/* Toolbar */}
            <div style={tableToolbarStyle}>
              <div style={searchBoxStyle}>
                <Search size={16} color="#64748b" />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={activeType === 'consommables'
                    ? 'Rechercher par désignation…'
                    : 'Rechercher par désignation ou N° inventaire…'}
                  style={searchInputStyle}
                />
              </div>
              <span style={toolbarHintStyle}>
                {activeType === 'consommables'
                  ? `${consumableRows.length} article(s)`
                  : `${inventoryArticles.length} article(s)`}
              </span>
            </div>

            {/* ── Consommables ────────────────────────────────────────── */}
            {activeType === 'consommables' ? (
              <table style={tableStyle}>
                <thead>
                  <tr style={headRowStyle}>
                    <th style={thStyle}>Désignation</th>
                    <th style={thStyle}>Qté disponible</th>
                    <th style={thStyle}>Seuil alerte</th>
                    <th style={{ ...thStyle, width: 120 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {consumableRows.length === 0
                    ? <tr><td colSpan={4} style={emptyCellStyle}>Aucun consommable trouvé.</td></tr>
                    : consumableRows.map((row) => {
                      const qty = Number(row.stock?.quantite_disponible ?? row.stock?.quantiteDisponible ?? 0);
                      const qtyReservee = Number(row.stock?.quantite_reservee ?? row.stock?.quantiteReservee ?? 0);
                      const stockId = row.stock?.id_stock ?? row.stock?.idStock ?? null;
                      const seuilVal = row.stock?.seuil_alerte ?? row.stock?.seuilAlerte ?? null;
                      const isAlerte = seuilVal !== null && qty <= seuilVal;
                      return (
                        <tr key={getResourceId(row.resource)}
                          style={{ ...clickableRowStyle, background: isAlerte ? '#fff5f5' : undefined }}
                          onClick={() => setSelectedConsommable(row)}>
                          <td style={tdStyle}>{getResourceDesignation(row.resource)}</td>
                          <td style={tdStyle}>
                            <span style={{ fontWeight: 600 }}>{formatNumber(qty)}</span>
                            {qtyReservee > 0 && (
                              <span style={reserveBadgeStyle}>
                                · {formatNumber(qtyReservee)} en réserve
                              </span>
                            )}
                          </td>
                          <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                            <SeuilCell
                              value={seuilVal}
                              isAlerte={isAlerte}
                              loading={setStockSeuilMutation.isPending}
                              onSave={(val) => stockId && setStockSeuilMutation.mutate({ stockId, seuil: val })}
                            />
                          </td>
                          <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                            <button
                              style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 13, padding: 0 }}
                              onClick={() => setSelectedConsommable(row)}
                            >Détails →</button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>

            ) : (
              /* ── Biens inventaire ──────────────────────────────────── */
              <table style={tableStyle}>
                <thead>
                  <tr style={headRowStyle}>
                    <th style={thStyle}>Désignation</th>
                    <th style={{ ...thStyle, width: 140 }}>Quantité totale</th>
                    <th style={{ ...thStyle, width: 140 }}>Seuil d'alerte</th>
                    <th style={{ ...thStyle, width: 120 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryArticles.length === 0
                    ? <tr><td colSpan={4} style={emptyCellStyle}>Aucun article trouvé dans cette sous-catégorie.</td></tr>
                    : inventoryArticles.map((article) => {
                      const rid = String(getResourceId(article));
                      const artInstances = instancesByResourceId.get(rid) || [];
                      const total = artInstances.length;
                      const seuilVal = article.seuil_alerte ?? article.seuilAlerte ?? null;
                      const isAlerte = seuilVal !== null && total <= seuilVal;
                      return (
                        <tr key={rid} style={{
                          background: isAlerte ? '#fff5f5' : undefined,
                          borderTop: '1px solid #f1f5f9',
                        }}>
                          <td style={tdStyle}>
                            <span style={{ fontWeight: isAlerte ? 600 : undefined }}>{getResourceDesignation(article)}</span>
                            {isAlerte ? <span style={alertTagStyle}>⚠ Alerte</span> : null}
                          </td>
                          <td style={tdStyle}>{formatNumber(total)}</td>
                          <td style={tdStyle}>
                            <SeuilCell
                              value={seuilVal}
                              loading={setRessourceSeuilMutation.isPending}
                              onSave={(val) => setRessourceSeuilMutation.mutate({ ressourceId: getResourceId(article), seuil: val })}
                            />
                          </td>
                          <td style={tdStyle}>
                            <button type="button"
                              onClick={() => setDetailsModalData({ article, instances: artInstances })}
                              style={detailsBtnStyle}>
                              Détails ›
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            )}
          </div>
        )}

      {/* Modals */}
      {selectedConsommable
        ? <ConsommableDetailModal item={selectedConsommable} onClose={() => setSelectedConsommable(null)} />
        : null}
      {detailsModalData
        ? <ArticleDetailsModal
            article={detailsModalData.article}
            instances={detailsModalData.instances}
            onClose={() => setDetailsModalData(null)}
          />
        : null}
    </div>
  );
}

// ── ConsommableDetailModal ────────────────────────────────────────────────
const MOUVEMENT_CFG = {
  entree:    { label: '＋ Entrée',     bg: '#dcfce7', color: '#166534', sign: '+', signColor: '#16a34a' },
  sortie:    { label: '－ Sortie',     bg: '#fee2e2', color: '#991b1b', sign: '-', signColor: '#dc2626' },
  retour:    { label: '↩ Libération', bg: '#dbeafe', color: '#1e40af', sign: '+', signColor: '#16a34a' },
  transfert: { label: '⇄ Transfert',  bg: '#f3e8ff', color: '#6b21a8', sign: '',  signColor: '#6b21a8' },
  rebut:     { label: '✗ Rebut',      bg: '#ffedd5', color: '#9a3412', sign: '-', signColor: '#dc2626' },
};

function ConsommableDetailModal({ item, onClose }) {
  const { resource, stock } = item;
  const resourceId = getResourceId(resource);

  const mouvQuery = useQuery({
    queryKey: ['resources', 'mouvements', resourceId],
    queryFn: () => getMouvements({ id_ressource: resourceId }),
    staleTime: 0,
  });

  const mouvements = mouvQuery.data?.data?.results ?? mouvQuery.data?.data ?? [];
  const dispo     = Number(stock?.quantite_disponible ?? stock?.quantiteDisponible ?? 0);
  const reserve   = Number(stock?.quantite_reservee   ?? stock?.quantiteReservee   ?? 0);

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={articleModalStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={articleModalHeaderStyle}>
          <span style={detailsStatStyle}>Disponible : <strong>{formatNumber(dispo)}</strong></span>
          <span style={detailsStatDividerStyle} />
          <span style={detailsStatStyle}>Réservé : <strong>{formatNumber(reserve)}</strong></span>
          <span style={detailsStatDividerStyle} />
          <span style={articleModalTitleStyle}>{getResourceDesignation(resource)}</span>
          <button type="button" onClick={onClose} style={closeIconBtnStyle}><X size={16} /></button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {mouvQuery.isLoading ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
              Chargement…
            </div>
          ) : mouvements.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
              Aucun mouvement enregistré pour cet article.
            </div>
          ) : (
            <table style={{ ...tableStyle, margin: 0 }}>
              <thead>
                <tr style={headRowStyle}>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Quantité</th>
                  <th style={thStyle}>Référence</th>
                  <th style={thStyle}>Lieu d'affectation</th>
                  <th style={thStyle}>Service</th>
                  <th style={thStyle}>Destinataire</th>
                </tr>
              </thead>
              <tbody>
                {mouvements.map((m) => {
                  const id    = m.id_mouvement ?? m.idMouvement;
                  const type  = m.type_mouvement ?? m.typeMouvement ?? '';
                  const cfg   = MOUVEMENT_CFG[type] || { label: type, bg: '#f1f5f9', color: '#475569', sign: '', signColor: '#475569' };
                  const qty   = Number(m.quantite ?? 0);
                  const ref   = m.reference ?? null;
                  const lieu  = m.lieu_affectation ?? m.lieuAffectation ?? null;
                  const svc   = m.service_affectation ?? m.serviceAffectation ?? null;
                  const dest  = m.destinataire_affectation ?? m.destinataireAffectation ?? null;
                  const date  = m.date_mouvement ?? m.dateMouvement;
                  const qtyDisplay = cfg.sign ? `${cfg.sign}${formatNumber(qty)}` : formatNumber(qty);
                  return (
                    <tr key={id} style={{ borderTop: '1px solid #e5e7eb' }}>
                      <td style={{ ...tdStyle, color: '#64748b', fontSize: 12 }}>
                        {date ? new Date(date).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                      </td>
                      <td style={tdStyle}>
                        <span style={{
                          display: 'inline-block', padding: '2px 8px', borderRadius: 999,
                          fontSize: 11, fontWeight: 600,
                          background: cfg.bg, color: cfg.color,
                        }}>
                          {cfg.label}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 600, color: cfg.signColor }}>
                        {qtyDisplay}
                      </td>
                      <td style={{ ...tdStyle, fontSize: 12 }}>{ref ?? '—'}</td>
                      <td style={{ ...tdStyle, fontSize: 12, color: '#64748b' }}>{lieu ?? '—'}</td>
                      <td style={{ ...tdStyle, fontSize: 12, color: '#64748b' }}>{svc ?? '—'}</td>
                      <td style={{ ...tdStyle, fontSize: 12, color: '#64748b' }}>{dest ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ── ArticleDetailsModal ────────────────────────────────────────────────────
function ArticleDetailsModal({ article, instances, onClose }) {
  const total = instances.length;
  const enStock = instances.filter((i) => i.statut === 'en_stock').length;
  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={articleModalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={articleModalHeaderStyle}>
          <span style={detailsStatStyle}>Total : <strong>{total}</strong></span>
          <span style={detailsStatDividerStyle} />
          <span style={detailsStatStyle}>En stock : <strong>{enStock}</strong></span>
          <span style={detailsStatDividerStyle} />
          <span style={articleModalTitleStyle}>{getResourceDesignation(article)}</span>
          <button type="button" onClick={onClose} style={closeIconBtnStyle}><X size={16} /></button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <ArticleDetailsPanel instances={instances} />
        </div>
      </div>
    </div>
  );
}

const TYPE_AFFECTATION_LABELS = {
  nouvelle_affectation: 'Nouvelle Affectation',
  reaffectation:        'Réaffectation',
};
const TYPE_AFFECTATION_STYLES = {
  nouvelle_affectation: { background: '#dbeafe', color: '#1e40af' },
  reaffectation:        { background: '#ffedd5', color: '#9a3412' },
};

// ── ArticleDetailsPanel ────────────────────────────────────────────────────
function ArticleDetailsPanel({ instances }) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({});

  const etabQuery = useQuery({
    queryKey: ['hierarchy', 'etablissements'],
    queryFn: getEtablissements,
    staleTime: 300_000,
  });
  const etablissements = etabQuery.data?.data || [];

  const svcQuery = useQuery({
    queryKey: ['hierarchy', 'services-by-etab', draft.id_lieu_affectation],
    queryFn: () => getServices({ id_etablissement: draft.id_lieu_affectation }),
    enabled: Boolean(draft.id_lieu_affectation),
    staleTime: 300_000,
  });
  const editServices = svcQuery.data?.data || [];

  const benefQuery = useQuery({
    queryKey: ['hierarchy', 'beneficiaires', draft.id_service_actuel],
    queryFn: () => getBeneficiaires({ id_service: draft.id_service_actuel }),
    enabled: Boolean(draft.id_service_actuel),
    staleTime: 300_000,
  });
  const editBeneficiaires = benefQuery.data?.data || [];

  const patchMutation = useMutation({
    mutationFn: ({ id, data }) => updateInstance(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources', 'instances'] });
      setEditingId(null);
    },
  });

  function startEdit(inst) {
    setEditingId(getInstanceId(inst));
    const lieuId = inst.idLieuAffectation ?? inst.id_lieu_affectation
      ?? inst.lieuAffectation?.idEtablissement ?? inst.lieu_affectation?.id_etablissement ?? '';
    const svcId  = inst.idServiceActuel ?? inst.id_service_actuel
      ?? inst.serviceActuel?.idService ?? inst.service_actuel?.id_service ?? '';
    const destId = inst.idDestinataire ?? inst.id_destinataire
      ?? inst.destinataire?.idBeneficiaire ?? inst.destinataire?.id_beneficiaire ?? '';
    setDraft({
      statut:              inst.statut ?? '',
      etat:                inst.etat ?? '',
      id_lieu_affectation: lieuId ? Number(lieuId) : '',
      id_service_actuel:   svcId  ? Number(svcId)  : '',
      id_destinataire:     destId ? Number(destId) : '',
    });
  }

  function cancelEdit() { setEditingId(null); setDraft({}); }

  if (instances.length === 0) {
    return <p style={{ padding: '12px 16px', color: '#64748b', fontSize: 13 }}>Aucune instance enregistrée.</p>;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={tableStyle}>
        <thead>
          <tr style={headRowStyle}>
            <th style={thStyle}>N° inventaire</th>
            <th style={thStyle}>État</th>
            <th style={thStyle}>Statut</th>
            <th style={thStyle}>Lieu d&apos;affectation</th>
            <th style={thStyle}>Service</th>
            <th style={thStyle}>Destinataire</th>
            <th style={thStyle}>Type d&apos;affectation</th>
            <th style={thStyle}>Date acquisition</th>
            <th style={thStyle}>Réf. marché</th>
            <th style={{ ...thStyle, width: 160 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {instances.map((inst) => {
            const id = getInstanceId(inst);
            const isEditing = id === editingId;
            const typeAff = inst.typeAffectation ?? inst.type_affectation ?? '';
            return (
              <tr key={id} style={{ borderTop: '1px solid #e5e7eb', background: isEditing ? '#f8fafc' : '#fff' }}>
                <td style={tdStyle}><code style={monoStyle}>{getInstanceNumeroInventaire(inst)}</code></td>

                {/* État */}
                <td style={tdStyle}>
                  {isEditing
                    ? <select value={draft.etat} onChange={(e) => setDraft({ ...draft, etat: e.target.value })} style={inlineSelectStyle}>
                        {Object.entries(ETAT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    : <Badge tone={ETAT_TONES[inst.etat]}>{ETAT_LABELS[inst.etat] || inst.etat || '—'}</Badge>}
                </td>

                {/* Statut */}
                <td style={tdStyle}>
                  {isEditing
                    ? <select value={draft.statut} onChange={(e) => setDraft({ ...draft, statut: e.target.value })} style={inlineSelectStyle}>
                        {Object.entries(STATUT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    : <Badge tone={STATUT_TONES[inst.statut]}>{STATUT_LABELS[inst.statut] || inst.statut || '—'}</Badge>}
                </td>

                {/* Lieu d'affectation */}
                <td style={tdStyle}>
                  {isEditing
                    ? <select
                        value={draft.id_lieu_affectation ?? ''}
                        onChange={(e) => {
                          const val = e.target.value ? Number(e.target.value) : '';
                          setDraft({ ...draft, id_lieu_affectation: val, id_service_actuel: '', id_destinataire: '' });
                        }}
                        style={inlineSelectStyle}
                      >
                        <option value="">— Choisir —</option>
                        {etablissements.map((et) => {
                          const eid = et.idEtablissement ?? et.id_etablissement;
                          return <option key={eid} value={eid}>{et.nom}</option>;
                        })}
                      </select>
                    : getLieuAffectation(inst) || '—'}
                </td>

                {/* Service */}
                <td style={tdStyle}>
                  {isEditing
                    ? <select
                        value={draft.id_service_actuel ?? ''}
                        onChange={(e) => {
                          const val = e.target.value ? Number(e.target.value) : '';
                          setDraft({ ...draft, id_service_actuel: val, id_destinataire: '' });
                        }}
                        disabled={!draft.id_lieu_affectation}
                        style={inlineSelectStyle}
                      >
                        <option value="">— Choisir —</option>
                        {editServices.map((s) => {
                          const sid = s.idService ?? s.id_service;
                          const nom = s.nomService ?? s.nom_service;
                          return <option key={sid} value={sid}>{nom}</option>;
                        })}
                      </select>
                    : getServiceName(inst) || '—'}
                </td>

                {/* Destinataire */}
                <td style={tdStyle}>
                  {isEditing
                    ? <select
                        value={draft.id_destinataire ?? ''}
                        onChange={(e) => setDraft({ ...draft, id_destinataire: e.target.value ? Number(e.target.value) : '' })}
                        disabled={!draft.id_service_actuel}
                        style={inlineSelectStyle}
                      >
                        <option value="">— Choisir —</option>
                        {editBeneficiaires.map((b) => {
                          const bid = b.idBeneficiaire ?? b.id_beneficiaire;
                          return <option key={bid} value={bid}>{b.nom}</option>;
                        })}
                      </select>
                    : getDestinataireLabel(inst) || '—'}
                </td>

                {/* Type d'affectation — read-only badge, set automatically */}
                <td style={tdStyle}>
                  {typeAff
                    ? <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: 999,
                        fontSize: 11, fontWeight: 600,
                        ...TYPE_AFFECTATION_STYLES[typeAff],
                      }}>
                        {TYPE_AFFECTATION_LABELS[typeAff] || typeAff}
                      </span>
                    : '—'}
                </td>

                <td style={tdStyle}>{getDateAcquisitionDisplay(inst) || '—'}</td>
                <td style={tdStyle}>{getReferenceMarche(inst) || '—'}</td>
                <td style={tdStyle}>
                  {isEditing
                    ? <div style={{ display: 'flex', gap: 5 }}>
                        <button type="button"
                          onClick={() => patchMutation.mutate({ id, data: draft })}
                          disabled={patchMutation.isPending}
                          style={saveRowBtnStyle}>
                          {patchMutation.isPending ? '…' : '✔ Enregistrer'}
                        </button>
                        <button type="button" onClick={cancelEdit} style={cancelRowBtnStyle}>✖ Annuler</button>
                      </div>
                    : <button type="button" onClick={() => startEdit(inst)} style={editInstanceBtnStyle}>
                        Modifier
                      </button>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────
const METRIC_ICONS = { blue: Package, purple: Box, red: AlertTriangle };
const METRIC_UNITS = { blue: 'références', purple: 'biens', red: 'alertes actives' };
const METRIC_STYLES = {
  blue:   { borderColor: '#dbeafe', background: '#eff6ff', color: '#0C447C', iconBg: '#dbeafe' },
  purple: { borderColor: '#e9e8ff', background: '#f5f3ff', color: '#3C3489', iconBg: '#e9e8ff' },
  red:    { borderColor: '#fee2e2', background: '#fef2f2', color: '#b91c1c', iconBg: '#fee2e2' },
};

function MetricCard({ label, value, tone }) {
  const s = METRIC_STYLES[tone];
  const Icon = METRIC_ICONS[tone];
  return (
    <div style={{ border: '1px solid', borderRadius: 14, padding: '14px 16px', borderColor: s.borderColor, background: s.background }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: s.iconBg }}>
          <Icon size={18} color={s.color} strokeWidth={2} />
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#475569', marginBottom: 3 }}>{label}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 24, fontWeight: 800, lineHeight: 1, color: s.color }}>{formatNumber(value)}</span>
            <span style={{ fontSize: 11, color: s.color, opacity: 0.65, fontWeight: 500 }}>{METRIC_UNITS[tone]}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Badge({ tone, children }) {
  const colors = {
    success: { background: '#ecfdf5', color: '#166534' },
    blue:    { background: '#eff6ff', color: '#1d4ed8' },
    warning: { background: '#fffbeb', color: '#92400e' },
    danger:  { background: '#fef2f2', color: '#b91c1c' },
    muted:   { background: '#f1f5f9', color: '#64748b' },
  };
  const c = colors[tone] || colors.muted;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
      whiteSpace: 'nowrap', ...c,
    }}>{children}</span>
  );
}

function LoadingCard() {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 14, padding: 12, display: 'grid', gap: 10 }}>
      {[100, 70, 45].map((w) => (
        <div key={w} style={{ height: 12, width: `${w}%`, borderRadius: 999, background: '#e2e8f0' }} />
      ))}
    </div>
  );
}

function EmptyState({ message, compact = false }) {
  return (
    <div style={{
      border: '1px dashed #cbd5e1', borderRadius: 14,
      padding: compact ? 10 : 14, color: '#64748b',
      background: '#f8fafc', fontSize: 13,
    }}>{message}</div>
  );
}

function SeuilCell({ value, isAlerte, onSave, loading }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  function startEdit(e) {
    e.stopPropagation();
    setDraft(value != null ? String(value) : '');
    setEditing(true);
  }
  function cancel(e) { e?.stopPropagation(); setEditing(false); }
  function submit(e) {
    e?.stopPropagation();
    const trimmed = draft.trim();
    const parsed = trimmed === '' ? null : parseInt(trimmed, 10);
    if (trimmed !== '' && (Number.isNaN(parsed) || parsed < 0)) return;
    onSave(parsed);
    setEditing(false);
  }
  function handleKey(e) {
    if (e.key === 'Enter') submit(e);
    if (e.key === 'Escape') cancel(e);
  }

  if (editing) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <input
          type="number" min="0"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKey}
          onClick={(e) => e.stopPropagation()}
          autoFocus
          style={{ ...inlineInputStyle, width: 64 }}
        />
        <button type="button" onClick={submit} disabled={loading} style={seuilSaveBtnStyle}>✔</button>
        <button type="button" onClick={cancel} style={seuilCancelBtnStyle}>✗</button>
      </span>
    );
  }

  if (value == null) {
    return (
      <span onClick={startEdit} title="Cliquer pour définir un seuil"
        style={{ color: '#94a3b8', cursor: 'pointer', fontSize: 13 }}>—</span>
    );
  }
  return (
    <span onClick={startEdit} title="Cliquer pour modifier"
      style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, color: isAlerte ? '#dc2626' : '#16a34a' }}>
      {formatNumber(value)}
    </span>
  );
}

// ── Accessor helpers ──────────────────────────────────────────────────────
function normalizeKey(v) {
  return String(v || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
function getCategoryId(cat) { return cat?.id_categorie ?? cat?.idCategorie ?? null; }
function getSousCategorieId(sc) { return sc?.id_sous_categorie ?? sc?.idSousCategorie ?? null; }
function getSousCategorieName(sc) { return sc?.nom_sous_categorie ?? sc?.nomSousCategorie ?? '—'; }
function getSousCategorieParentId(sc) { return sc?.id_parent_sous_categorie ?? sc?.idParentSousCategorie ?? null; }
function getResourceId(r) { return r?.id_ressource ?? r?.idRessource ?? null; }
function getResourceDesignation(r) { return r?.designation ?? '—'; }
function getResourceSousCategory(r) { return r?.sous_categorie ?? r?.sousCategorie ?? null; }
function getResourceSousCategorieId(r) {
  return r?.id_sous_categorie ?? r?.idSousCategorie ?? getSousCategorieId(getResourceSousCategory(r));
}
function getInstanceId(inst) { return inst?.id_instance ?? inst?.idInstance ?? null; }
function getInstanceNumeroInventaire(inst) { return inst?.numero_inventaire ?? inst?.numeroInventaire ?? '—'; }
function getInstanceResource(inst) { return inst?.ressource ?? inst?.id_ressource ?? null; }
function getLieuAffectation(inst) {
  return inst?.lieu_affectation?.nom ?? inst?.lieuAffectation?.nom ?? null;
}
function getServiceName(inst) {
  return inst?.service_actuel?.nom_service ?? inst?.serviceActuel?.nomService ?? null;
}
function getDestinataireLabel(inst) {
  const d = inst?.destinataire ?? null;
  if (!d) return null;
  const nom = d.nom ?? '';
  return nom || null;
}
function getDateAcquisitionDisplay(inst) {
  const raw = inst?.date_acquisition_display ?? inst?.dateAcquisitionDisplay
    ?? inst?.date_acquisition ?? inst?.dateAcquisition ?? null;
  return raw ? new Date(raw).toLocaleDateString('fr-FR') : null;
}
function getReferenceMarche(inst) {
  return inst?.reference_marche ?? inst?.referenceMarche ?? null;
}
function formatNumber(v) {
  const n = Number(v);
  return Number.isNaN(n) ? '0' : new Intl.NumberFormat('fr-FR').format(n);
}

function articleBadgeStyle(count) {
  const has = Number(count) > 0;
  return {
    display: 'inline-flex', alignItems: 'center', padding: '3px 8px',
    borderRadius: 999, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0,
    background: has ? '#e0f2fe' : '#f1f5f9',
    color: has ? '#0369a1' : '#94a3b8',
  };
}

const detailsBtnStyle = {
  border: '1px solid #dbe4ee',
  borderRadius: 7,
  padding: '5px 10px',
  background: '#fff',
  color: '#334155',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
  whiteSpace: 'nowrap',
};

// ── Styles ─────────────────────────────────────────────────────────────────
const pageStyle = { display: 'grid', gap: 16 };
const summaryGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 };
const breadcrumbStyle = { display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center', fontSize: 12 };
const breadcrumbItemStyle = { display: 'inline-flex', alignItems: 'center', gap: 6 };
const breadcrumbButtonStyle = { border: 'none', background: 'transparent', color: '#334155', cursor: 'pointer', padding: 0, font: 'inherit' };
const breadcrumbCurrentStyle = { color: '#0f172a', fontWeight: 600 };
const tabsStyle = { display: 'flex', gap: 8, flexWrap: 'wrap' };
const tabButtonStyle = { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 12px', borderRadius: 11, border: '1px solid #dbe4ee', background: '#fff', color: '#475569', cursor: 'pointer', fontWeight: 600, fontSize: 13 };
const categoryGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 };
const cardStyle = { border: '1px solid #e5e7eb', borderRadius: 14, background: '#fff', padding: 12, textAlign: 'left', cursor: 'pointer', minHeight: 80, display: 'flex', flexDirection: 'column', gap: 6 };
const cardTopStyle = { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 };
const cardTitleStyle = { fontWeight: 700, fontSize: 14, color: '#0f172a', lineHeight: 1.25, flex: 1 };
const pillRowStyle = { display: 'flex', flexWrap: 'wrap', gap: 8 };
const pillStyle = { border: '1px solid #dbe4ee', borderRadius: 999, padding: '7px 12px', background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#334155', fontSize: 12 };
const tableShellStyle = { border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden', background: '#fff' };
const tableToolbarStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: 12, borderBottom: '1px solid #e5e7eb', background: '#f8fafc' };
const searchBoxStyle = { display: 'flex', alignItems: 'center', gap: 7, padding: '8px 10px', border: '1px solid #dbe4ee', borderRadius: 11, background: '#fff', flex: 1 };
const searchInputStyle = { border: 'none', outline: 'none', width: '100%', fontSize: 13, background: 'transparent' };
const toolbarHintStyle = { fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' };
const tableStyle = { width: '100%', borderCollapse: 'collapse' };
const headRowStyle = { background: '#f8fafc', textAlign: 'left' };
const thStyle = { padding: '10px 12px', borderBottom: '1px solid #e5e7eb', fontSize: 12, color: '#475569', fontWeight: 700 };
const tdStyle = { padding: '10px 12px', fontSize: 13, color: '#0f172a' };
const emptyCellStyle = { padding: 16, textAlign: 'center', color: '#64748b', fontSize: 13 };
const clickableRowStyle = { cursor: 'pointer', borderTop: '1px solid #f1f5f9' };

const alertTagStyle = { display: 'inline-flex', alignItems: 'center', marginLeft: 8, padding: '2px 6px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: '#fef3c7', color: '#92400e' };
const reserveBadgeStyle = { marginLeft: 6, fontSize: 11, color: '#7c3aed', fontWeight: 500 };
const monoStyle = { fontFamily: 'monospace', fontSize: 12, background: '#f1f5f9', padding: '2px 5px', borderRadius: 4 };

// Details panel stats (used in merged modal header)
const detailsStatStyle = { fontSize: 13, color: '#3730a3', whiteSpace: 'nowrap' };
const detailsStatDividerStyle = { width: 1, height: 14, background: '#c7d2fe', flexShrink: 0 };

// Instance row buttons
const editInstanceBtnStyle = { border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 10px', background: '#fff', color: '#334155', cursor: 'pointer', fontSize: 12, fontWeight: 600 };
const saveRowBtnStyle = { border: 'none', borderRadius: 6, padding: '4px 10px', background: '#1e293b', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' };
const cancelRowBtnStyle = { border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 10px', background: '#fff', color: '#64748b', cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' };

// Inline edit controls
const inlineSelectStyle = { border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 7px', fontSize: 12, background: '#fff', minWidth: 110 };
const inlineInputStyle = { border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 7px', fontSize: 12, outline: 'none', width: '100%', minWidth: 80, boxSizing: 'border-box' };
const seuilSaveBtnStyle = { border: 'none', borderRadius: 5, padding: '3px 7px', background: '#16a34a', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700, lineHeight: 1 };
const seuilCancelBtnStyle = { border: '1px solid #e2e8f0', borderRadius: 5, padding: '3px 7px', background: '#fff', color: '#64748b', cursor: 'pointer', fontSize: 12, fontWeight: 700, lineHeight: 1 };

// Modals shared
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', display: 'grid', placeItems: 'center', zIndex: 90 };
const closeIconBtnStyle = { border: 'none', background: 'rgba(255,255,255,0.25)', borderRadius: 6, padding: 6, cursor: 'pointer', display: 'flex', color: '#3730a3', flexShrink: 0 };

// Article details modal
const articleModalStyle = { width: 'min(960px, 96vw)', maxHeight: '85vh', background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column' };
const articleModalHeaderStyle = { display: 'flex', alignItems: 'center', gap: 14, padding: '11px 16px', background: '#eef2ff', borderBottom: '1px solid #e0e7ff', flexShrink: 0 };
const articleModalTitleStyle = { fontWeight: 700, fontSize: 14, color: '#1e1b4b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 };
