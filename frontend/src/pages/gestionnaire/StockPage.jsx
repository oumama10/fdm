import { Fragment, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, ChevronDown, Clock, Edit2, Eye, Filter, MoreVertical,
  Plus, Search, Trash2, X,
} from 'lucide-react';

import {
  getTypeArticles,
  getCategories, createCategory, updateCategory, deleteCategory,
  getSousCategories, createSousCategory, updateSousCategory, deleteSousCategory,
  getRessources, createRessource, updateRessource, deleteRessource,
  getStock, getInstances, updateInstance, deleteInstance, getMouvements,
} from '../../api/resources';
import {
  getBeneficiaires,
  getEtablissements,
  getBatiments, createBatiment, updateBatiment, deleteBatiment,
  getServices, deleteService, createServiceJson, updateServiceJson,
} from '../../api/users';
import { createRetour, getRetours, updateDecision } from '../../api/returns';

// ── Field accessors ───────────────────────────────────────────────────────────
const getCatId   = (c) => c.idCategorie      ?? c.id_categorie;
const getCatNom  = (c) => c.nomCategorie     ?? c.nom_categorie      ?? '';
const getSubId   = (s) => s.idSousCategorie  ?? s.id_sous_categorie;
const getSubNom  = (s) => s.nomSousCategorie ?? s.nom_sous_categorie  ?? '';
const getSubCat  = (s) => s.idCategorie      ?? s.id_categorie;
const getResId   = (r) => r.idRessource      ?? r.id_ressource;
const getStockId = (s) => s.idStock          ?? s.id_stock;
const getStockRes= (s) => s.idRessource      ?? s.id_ressource;

// ── Shared micro-styles ───────────────────────────────────────────────────────
const iconBtn = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  background: 'none', border: 'none', cursor: 'pointer', padding: 3, borderRadius: 4,
  flexShrink: 0,
};
const inlineInput = {
  border: '1px solid #cbd5e1', borderRadius: 6, padding: '5px 10px',
  fontSize: 13, outline: 'none', background: '#f8fafc', minWidth: 0,
};
const pillBase = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '3px 8px 3px 10px', borderRadius: 999,
  border: '1px solid #e2e8f0', background: '#f1f5f9',
  fontSize: 12, color: '#374151',
};
const WORKSPACE_PANEL_STYLE = {
  background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0',
  padding: '20px 24px', boxShadow: '0 1px 4px rgba(15, 23, 42, 0.06)',
};
const WORKSPACE_TABLE_STYLE = {
  overflow: 'auto', border: '1px solid #e2e8f0',
};
const TOOLBAR_BUTTON_STYLE = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 13px', borderRadius: 10, border: '1px solid #dbe4ee',
  background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer',
};
const PRIMARY_TOOLBAR_BUTTON_STYLE = {
  display: 'inline-flex', alignItems: 'center', gap: 7,
  padding: '9px 14px', borderRadius: 10, border: 'none',
  background: '#0C447C', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
};
const TABLE_HEADER_CELL_STYLE = {
  position: 'sticky', top: 0, background: '#f8fafc',
  borderBottom: '1px solid #e2e8f0', padding: '12px 14px',
  textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b', whiteSpace: 'nowrap',
};
const TABLE_CELL_STYLE = { padding: '12px 14px', verticalAlign: 'middle' };
const CATEGORY_PALETTE = [
  { background: '#E6F1FB', color: '#0C447C' },
  { background: '#EEEDFE', color: '#3C3489' },
  { background: '#FEF3C7', color: '#92400E' },
  { background: '#ECFDF5', color: '#065F46' },
  { background: '#FEE2E2', color: '#991B1B' },
];
const TYPE_FILTER_OPTS = [
  { key: 'all', label: 'Type: tous' },
  { key: 'consommable', label: 'Consommable' },
  { key: 'bien_inventaire', label: 'Bien Inventaire' },
];
const CATEGORY_ACTIONS = [
  { key: 'filter', icon: Filter, label: 'Filtrer' },
];
const TYPE_BADGE_STYLES = {
  consommable:      { bg: '#E6F1FB', color: '#0C447C' },
  bien_inventaire:  { bg: '#EEEDFE', color: '#3C3489' },
};

// ── Tabs ──────────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'articles',    label: 'Gestion des Articles' },
  { key: 'categories',  label: 'Catégories & Sous-catégories' },
  { key: 'structure',   label: 'Gestion de la Structure' },
  { key: 'affectation', label: 'Suivi & Affectation' },
  { key: 'debarras',    label: 'Débarras' },
];

const EMPTY_FORM = {
  designation: '',
  marque: '',
  description: '',
  uniteMesure: 'unité',
  idType: '',
  idCategorie: '',
  idSousCategorie: '',
  seuilAlerte: '',
};

// ═════════════════════════════════════════════════════════════════════════════
export default function StockPage() {
  const [activeTab, setActiveTab] = useState('articles');
  const queryClient = useQueryClient();
  const active = TABS.find((t) => t.key === activeTab);

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '2px solid #e5e7eb', background: '#fff' }}>
        {TABS.map((tab) => {
          const on = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '12px 20px', fontSize: 13,
                fontWeight: on ? 700 : 500,
                color: on ? '#0C447C' : '#64748b',
                background: 'transparent', border: 'none',
                borderBottom: on ? '2px solid #0C447C' : '2px solid transparent',
                marginBottom: -2, cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div style={{ paddingTop: 24 }}>
        {activeTab === 'articles'    && <ArticlesTab         queryClient={queryClient} />}
        {activeTab === 'categories'  && <CategoriesTab       queryClient={queryClient} />}
        {activeTab === 'structure'   && <StructureTab        queryClient={queryClient} />}
        {activeTab === 'affectation' && <SuiviAffectationTab queryClient={queryClient} />}
        {activeTab === 'debarras'    && <DebarrasTab         queryClient={queryClient} />}
        {!['articles', 'categories', 'structure', 'affectation', 'debarras'].includes(activeTab) && (
          <div style={{ padding: '48px 0', textAlign: 'center', color: '#94a3b8', fontSize: 14, fontStyle: 'italic' }}>
            {active?.label}
          </div>
        )}
      </div>
    </div>
  );
}
function getTypeLabel(category) {
  const value = getTypeValue(category);
  if (value === 'consommable') return 'Consommable';
  if (value === 'bien_inventaire') return 'Inventaire';
  return category?.type_article?.description
    ?? category?.id_type?.description
    ?? category?.typeArticle?.description
    ?? category?.idType?.description
    ?? category?.id_type?.nom_categorie
    ?? category?.typeArticle?.nom_categorie
    ?? category?.typeArticle?.nomCategorie
    ?? '—';
}

function getCategoryDisplayLabel(category) {
  return category?.nom_categorie ?? category?.nomCategorie ?? '—';
}

function getCategoryDescription(category) {
  return category?.description ?? '';
}

function getCategoryActive(category) {
  return category?.actif !== false;
}

function getCategoryId(category) {
  return category?.id_categorie ?? category?.idCategorie;
}

function getSubCategoryId(subCategory) {
  return subCategory?.id_sous_categorie ?? subCategory?.idSousCategorie;
}

function getSubCategoryLabel(subCategory) {
  return subCategory?.nom_sous_categorie ?? subCategory?.nomSousCategorie ?? '—';
}

function getSubCategoryDescription(subCategory) {
  return subCategory?.description ?? '';
}

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = (h << 5) - h + str.charCodeAt(i); h |= 0; }
  return h;
}

function normalizeText(text) {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, '_')
    .trim();
}

function getTypeValue(category) {
  return (
    category?.type_article?.nom_categorie
    ?? category?.typeArticle?.nom_categorie
    ?? category?.typeArticle?.nomCategorie
    ?? ''
  ).toLowerCase();
}

function formatTypeDisplayName(value) {
  if (!value) return '—';
  const v = String(value).toLowerCase();
  if (v === 'consommable') return 'Consommable';
  if (v === 'bien_inventaire' || v === 'bien inventaire') return 'Bien Inventaire';
  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
}

function getCategoryTypeId(category) {
  return (
    category?.id_type
    ?? category?.idType
    ?? category?.type_article?.id_categorie
    ?? category?.typeArticle?.id_categorie
    ?? category?.typeArticle?.idCategorie
    ?? null
  );
}

function formatDateTime(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(d);
}

function getCategoryChipStyle(label) {
  return CATEGORY_PALETTE[Math.abs(hashString(label)) % CATEGORY_PALETTE.length];
}

function typeFilterLabel(key) {
  if (key === 'consommable') return 'Consommable';
  if (key === 'bien_inventaire') return 'Inventaire';
  return 'Tous les types';
}

function formatInstanceAffectation(instance) {
  const parts = [];
  const service = instance?.service_actuel?.nom_service ?? instance?.service_actuel?.nomService;
  const lieu = instance?.lieu_affectation?.nom ?? instance?.lieu_affectation?.nom_etablissement;
  const destinataire = instance?.destinataire?.nom;

  if (service) parts.push(service);
  if (lieu) parts.push(lieu);
  if (destinataire) parts.push(destinataire);

  return parts.length ? parts.join(' · ') : '—';
}

function formatInstanceDate(value) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed);
}

function formatStatusLabel(status) {
  const normalized = normalizeText(status);
  const labels = {
    en_stock:       'En stock',
    en_service:     'En service',
    en_maintenance: 'En maintenance',
    debarras:       'Débarras',
  };
  return labels[normalized] ?? status ?? '—';
}

function getInstanceDisplayId(instance) {
  return instance?.numero_inventaire ?? instance?.numeroInventaire ?? instance?.id_instance ?? '—';
}

function ArticlesTab({ queryClient }) {
  const [search,     setSearch]     = useState('');
  const [modal,      setModal]      = useState(null);   // null | { mode:'add'|'edit', article? }
  const [instancesModalArticle, setInstancesModalArticle] = useState(null);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [formErr,    setFormErr]    = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [page, setPage] = useState(1);
  const [hoveredRowId, setHoveredRowId] = useState(null);

  // ── Queries ────────────────────────────────────────────────────────────────
  const resQ = useQuery({
    queryKey: ['resources', 'ressources'],
    queryFn: () => getRessources(),
    staleTime: 30_000,
  });
  const stoQ = useQuery({
    queryKey: ['resources', 'stocks'],
    queryFn: () => getStock(),
    staleTime: 30_000,
  });
  const catsQ = useQuery({
    queryKey: ['resources', 'categories'],
    queryFn: () => getCategories(),
    staleTime: 60_000,
  });
  const subsQ = useQuery({
    queryKey: ['resources', 'sous-categories'],
    queryFn: () => getSousCategories(),
    staleTime: 60_000,
  });
  const typesQ = useQuery({
    queryKey: ['resources', 'types'],
    queryFn: () => getTypeArticles(),
    staleTime: 60_000,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const inv = () => {
    queryClient.invalidateQueries({ queryKey: ['resources', 'ressources'] });
    queryClient.invalidateQueries({ queryKey: ['resources', 'stocks'] });
  };

  const createM = useMutation({
    mutationFn: (d) => createRessource(d),
    onSuccess: () => { inv(); setModal(null); },
    onError: (e) => setFormErr(e?.response?.data?.designation?.[0] ?? 'Erreur lors de la création.'),
  });
  const updateM = useMutation({
    mutationFn: ({ id, d }) => updateRessource(id, d),
    onSuccess: () => { inv(); setModal(null); },
    onError: (e) => setFormErr(e?.response?.data?.designation?.[0] ?? 'Erreur lors de la mise à jour.'),
  });
  const deleteM = useMutation({
    mutationFn: (id) => deleteRessource(id),
    onSuccess: () => { inv(); setDeletingId(null); },
  });

  // ── Derived data ───────────────────────────────────────────────────────────
  const rawRes   = resQ.data?.data?.results   ?? resQ.data?.data   ?? [];
  const rawSto   = stoQ.data?.data?.results   ?? stoQ.data?.data   ?? [];
  const rawCats  = catsQ.data?.data?.results  ?? catsQ.data?.data  ?? [];
  const rawSubs  = subsQ.data?.data?.results  ?? subsQ.data?.data  ?? [];
  const rawTypes = typesQ.data?.data?.results ?? typesQ.data?.data ?? [];

  const stockById = useMemo(
    () => Object.fromEntries(rawSto.map((s) => [getStockRes(s), s])),
    [rawSto],
  );

  const articles = useMemo(() => rawRes.map((r) => {
    const id   = getResId(r);
    const isC  = r.isConsommable ?? r.is_consommable ?? false;
    const stock = stockById[id];

    const quantite = isC
      ? (stock?.quantiteDisponible ?? stock?.quantite_disponible ?? 0)
      : (r.instancesEnStock ?? r.instances_en_stock ?? 0);

    const seuilAlerte = isC
      ? (stock?.seuilAlerte ?? stock?.seuil_alerte ?? r.seuilAlerte ?? r.seuil_alerte ?? null)
      : (r.seuilAlerte ?? r.seuil_alerte ?? null);

    const sub = r.sousCategorie ?? r.sous_categorie;

    return {
      id,
      designation:    r.designation ?? '',
      marque:         r.marque ?? '',
      description:    r.description ?? '',
      uniteMesure:    r.uniteMesure ?? r.unite_mesure ?? 'unité',
      type:           isC ? 'consommable' : 'bien_inventaire',
      categorie:      getCatNom(r.categorie ?? r.idCategorie ?? {}),
      sousCategorie:  sub ? (sub.nomSousCategorie ?? sub.nom_sous_categorie ?? '') : '—',
      quantite,
      seuilAlerte,
      estEnAlerte:    seuilAlerte != null && quantite <= seuilAlerte,
      stockId:        stock ? getStockId(stock) : null,
      _idType:          r.idType ?? r.id_type ?? '',
      _idCategorie:     r.idCategorie ?? r.id_categorie ?? '',
      _idSousCategorie: r.idSousCategorie ?? r.id_sous_categorie ?? '',
    };
  }), [rawRes, stockById]);

  const filtered = useMemo(() => {
    if (!search.trim()) return articles;
    const q = search.toLowerCase();
    return articles.filter((a) =>
      a.designation.toLowerCase().includes(q) ||
      a.marque.toLowerCase().includes(q) ||
      a.sousCategorie.toLowerCase().includes(q),
    );
  }, [articles, search]);

  const PAGE_SIZE = 12;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage],
  );

  useEffect(() => { setPage(1); }, [search]);

  // ── Form helpers ───────────────────────────────────────────────────────────
  const formCats = rawCats.filter(
    (c) => !form.idType || String(getCategoryTypeId(c)) === String(form.idType),
  );

  const formSousCats = rawSubs.filter(
    (s) => String(getSubCat(s)) === String(form.idCategorie),
  );

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const openAdd = () => {
    setFormErr('');
    setForm(EMPTY_FORM);
    setModal({ mode: 'add' });
  };
  const openEdit = (a) => {
    setFormErr('');
    setForm({
      designation:      a.designation,
      marque:           a.marque,
      description:      a.description,
      uniteMesure:      a.uniteMesure,
      idType:           String(a._idType ?? ''),
      idCategorie:      String(a._idCategorie ?? ''),
      idSousCategorie:  a._idSousCategorie ? String(a._idSousCategorie) : '',
      seuilAlerte:      a.seuilAlerte ?? '',
    });
    setModal({ mode: 'edit', article: a });
  };

  const submitForm = () => {
    setFormErr('');
    if (!form.designation.trim()) { setFormErr('La désignation est requise.'); return; }
    if (!form.idType)              { setFormErr('Le type est requis.'); return; }

    const payload = {
      designation:       form.designation.trim(),
      marque:            form.marque.trim(),
      description:       form.description.trim(),
      unite_mesure:      form.uniteMesure.trim() || 'unité',
      id_type:           Number(form.idType),
      id_categorie:      form.idCategorie ? Number(form.idCategorie) : null,
      id_sous_categorie: form.idSousCategorie ? Number(form.idSousCategorie) : null,
      seuil_alerte:      form.seuilAlerte !== '' ? Number(form.seuilAlerte) : null,
    };

    if (modal.mode === 'add') {
      createM.mutate(payload);
    } else {
      updateM.mutate({ id: modal.article.id, d: payload });
    }
  };

  const saving = createM.isPending || updateM.isPending;

  const openInstancesModal = (article) => {
    setInstancesModalArticle(article);
  };

  const closeInstancesModal = () => {
    setInstancesModalArticle(null);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        {/* ── Toolbar ──────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: 420 }}>
            <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              placeholder="Rechercher par désignation, marque…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '9px 14px 9px 36px', borderRadius: 10,
                border: '1px solid #e2e8f0', background: '#fff',
                fontSize: 13, color: '#0f172a', outline: 'none',
              }}
            />
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' }}>
            {filtered.length} résultat(s)
          </div>
          <button
            type="button"
            onClick={openAdd}
            style={{ ...PRIMARY_TOOLBAR_BUTTON_STYLE, marginLeft: 'auto', whiteSpace: 'nowrap' }}
          >
            <Plus size={15} /> Nouvel article
          </button>
        </div>

        {/* ── Table ──────────────────────────────────────────────────────────── */}
        <div style={{ marginTop: 10 }}>
          {resQ.isLoading || stoQ.isLoading ? (
            <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>Chargement…</p>
          ) : filtered.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '24px 0', margin: 0 }}>
              Aucun article trouvé.
            </p>
          ) : (
            <>
            <div style={WORKSPACE_TABLE_STYLE}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 }}>
                <thead>
                  <tr>
                    {['Désignation', 'Description', 'Marque', 'Type', 'Catégorie', 'Sous-catégorie', 'Qté', 'Seuil', 'Unité', 'Actions'].map((h) => (
                      <th key={h} style={TABLE_HEADER_CELL_STYLE}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((a) => (
                    <tr
                      key={a.id}
                      onMouseEnter={() => setHoveredRowId(a.id)}
                      onMouseLeave={() => setHoveredRowId(null)}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: hoveredRowId === a.id ? '#f8fbff' : '#fff',
                        transition: 'background 0.1s',
                      }}
                    >
                  {/* Désignation */}
                  <td style={{ ...TABLE_CELL_STYLE, maxWidth: 200 }}>
                    <div style={{ fontWeight: 600, color: '#1e293b' }}>{a.designation}</div>
                  </td>

                  {/* Description */}
                  <td style={{ ...TABLE_CELL_STYLE, maxWidth: 220, color: '#64748b' }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 210 }}>
                      {a.description || '—'}
                    </div>
                  </td>

                  {/* Marque */}
                  <td style={{ ...TABLE_CELL_STYLE, color: '#475569' }}>{a.marque || '—'}</td>

                  {/* Type badge */}
                  <td style={TABLE_CELL_STYLE}>
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: 999,
                      fontSize: 11, fontWeight: 600,
                      background: a.type === 'consommable' ? '#E6F1FB' : '#EEEDFE',
                      color:      a.type === 'consommable' ? '#0C447C' : '#3C3489',
                    }}>
                      {a.type === 'consommable' ? 'Consommable' : 'Bien Inventaire'}
                    </span>
                  </td>

                  {/* Catégorie */}
                  <td style={{ ...TABLE_CELL_STYLE, color: '#475569' }}>{a.categorie || '—'}</td>

                  {/* Sous-catégorie */}
                  <td style={{ ...TABLE_CELL_STYLE, color: '#475569' }}>{a.sousCategorie}</td>

                  {/* Quantité */}
                  <td style={TABLE_CELL_STYLE}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: a.estEnAlerte ? '#dc2626' : '#1e293b' }}>
                      {a.quantite}
                      {a.estEnAlerte && (
                        <AlertTriangle size={12} style={{ marginLeft: 4, verticalAlign: 'middle' }} color="#dc2626" />
                      )}
                    </span>
                  </td>

                  {/* Seuil */}
                  <td style={{ ...TABLE_CELL_STYLE, color: '#64748b' }}>{a.seuilAlerte ?? '—'}</td>

                  {/* Unité */}
                  <td style={{ ...TABLE_CELL_STYLE, color: '#64748b' }}>{a.uniteMesure}</td>

                  {/* Actions */}
                  <td style={{ ...TABLE_CELL_STYLE, whiteSpace: 'nowrap' }}>
                    {deletingId === a.id ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 12, color: '#374151' }}>Supprimer ?</span>
                        <button
                          type="button"
                          onClick={() => deleteM.mutate(a.id)}
                          style={{ ...iconBtn, fontSize: 11, fontWeight: 700, color: '#dc2626', padding: '2px 6px' }}
                          disabled={deleteM.isPending}
                        >
                          Oui
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingId(null)}
                          style={{ ...iconBtn, fontSize: 11, color: '#64748b', padding: '2px 6px' }}
                        >
                          Non
                        </button>
                      </span>
                    ) : (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {a.type === 'bien_inventaire' && (
                          <button type="button" title="Voir les instances" onClick={() => openInstancesModal(a)} style={iconBtn}>
                            <Eye size={14} color="#0C447C" />
                          </button>
                        )}
                        <button type="button" title="Modifier" onClick={() => openEdit(a)} style={iconBtn}>
                          <Edit2 size={14} color="#64748b" />
                        </button>
                        <button type="button" title="Supprimer" onClick={() => setDeletingId(a.id)} style={iconBtn}>
                          <Trash2 size={14} color="#ef4444" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 12 }}>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                Affichage de {filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1} à {Math.min(currentPage * PAGE_SIZE, filtered.length)} sur {filtered.length}
              </div>
              <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={currentPage === 1}
                  style={{
                    ...TOOLBAR_BUTTON_STYLE,
                    padding: '7px 10px',
                    opacity: currentPage === 1 ? 0.45 : 1,
                  }}
                >
                  Précédent
                </button>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  Page {currentPage} / {totalPages}
                </div>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={currentPage === totalPages}
                  style={{
                    ...TOOLBAR_BUTTON_STYLE,
                    padding: '7px 10px',
                    opacity: currentPage === totalPages ? 0.45 : 1,
                  }}
                >
                  Suivant
                </button>
              </div>
            </div>
            </>
          )}
        </div>
      </div>
      {/* ── Modal ──────────────────────────────────────────────────────────── */}
      {modal && (
        <div
          onClick={() => setModal(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 12, padding: 28, width: 480,
              maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            }}
          >
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0C447C' }}>
                {modal.mode === 'add' ? 'Nouvel article' : 'Modifier l\'article'}
              </h2>
              <button type="button" onClick={() => setModal(null)} style={iconBtn}>
                <X size={18} color="#64748b" />
              </button>
            </div>

            {/* Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Type (TypeArticle) */}
              <label style={labelStyle}>
                Type <span style={{ color: '#dc2626' }}>*</span>
                <select
                  value={form.idType}
                  onChange={(e) => {
                    setField('idType', e.target.value);
                    setField('idCategorie', '');
                    setField('idSousCategorie', '');
                  }}
                  style={selectStyle}
                >
                  <option value="">— Sélectionner —</option>
                  {rawTypes.map((t) => (
                    <option key={t.id_categorie ?? t.idCategorie} value={String(t.id_categorie ?? t.idCategorie)}>
                      {formatTypeDisplayName(t.nom_categorie ?? t.nomCategorie)}
                    </option>
                  ))}
                </select>
              </label>

              {/* Catégorie */}
              <label style={labelStyle}>
                Catégorie
                <select
                  value={form.idCategorie}
                  onChange={(e) => { setField('idCategorie', e.target.value); setField('idSousCategorie', ''); }}
                  style={selectStyle}
                  disabled={!form.idType}
                >
                  <option value="">— Aucune —</option>
                  {formCats.map((c) => (
                    <option key={getCatId(c)} value={String(getCatId(c))}>
                      {getCatNom(c)}
                    </option>
                  ))}
                </select>
              </label>

              {/* Sous-catégorie */}
              <label style={labelStyle}>
                Sous-catégorie
                <select
                  value={form.idSousCategorie}
                  onChange={(e) => setField('idSousCategorie', e.target.value)}
                  style={selectStyle}
                  disabled={!form.idCategorie}
                >
                  <option value="">— Aucune —</option>
                  {formSousCats.map((s) => (
                    <option key={getSubId(s)} value={String(getSubId(s))}>
                      {getSubNom(s)}
                    </option>
                  ))}
                </select>
              </label>

              {/* Désignation */}
              <label style={labelStyle}>
                Désignation <span style={{ color: '#dc2626' }}>*</span>
                <input
                  value={form.designation}
                  onChange={(e) => setField('designation', e.target.value)}
                  style={inputStyle}
                  placeholder="Nom de l'article"
                />
              </label>

              {/* Marque */}
              <label style={labelStyle}>
                Marque
                <input
                  value={form.marque}
                  onChange={(e) => setField('marque', e.target.value)}
                  style={inputStyle}
                  placeholder="Optionnel"
                />
              </label>

              {/* Description */}
              <label style={labelStyle}>
                Description
                <textarea
                  value={form.description}
                  onChange={(e) => setField('description', e.target.value)}
                  style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }}
                  placeholder="Optionnel"
                />
              </label>

              {/* Unité + Seuil (side by side) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={labelStyle}>
                  Unité de mesure
                  <input
                    value={form.uniteMesure}
                    onChange={(e) => setField('uniteMesure', e.target.value)}
                    style={inputStyle}
                    placeholder="unité"
                  />
                </label>
                <label style={labelStyle}>
                  Seuil d'alerte
                  <input
                    type="number"
                    min="0"
                    value={form.seuilAlerte}
                    onChange={(e) => setField('seuilAlerte', e.target.value)}
                    style={inputStyle}
                    placeholder="Optionnel"
                  />
                </label>
              </div>

              {/* Error */}
              {formErr && (
                <p style={{ margin: 0, fontSize: 12, color: '#dc2626' }}>{formErr}</p>
              )}

              {/* Buttons */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  style={{
                    padding: '8px 18px', borderRadius: 8, fontSize: 13,
                    border: '1px solid #e2e8f0', background: '#f8fafc',
                    color: '#64748b', cursor: 'pointer',
                  }}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={submitForm}
                  disabled={saving}
                  style={{
                    padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                    background: '#0C447C', color: '#fff', border: 'none',
                    cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? 'Enregistrement…' : modal.mode === 'add' ? 'Créer' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {instancesModalArticle && (
        <ArticleInstancesModal
          article={instancesModalArticle}
          onClose={closeInstancesModal}
          queryClient={queryClient}
        />
      )}
    </div>
  );
}

function ArticleInstancesModal({ article, onClose, queryClient }) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [deletingInstanceId, setDeletingInstanceId] = useState(null);

  const instancesQuery = useQuery({
    queryKey: ['resources', 'instances', article.id],
    queryFn: () => getInstances({ id_ressource: article.id }),
    enabled: Boolean(article?.id),
    staleTime: 30_000,
  });

  const etabsQuery = useQuery({
    queryKey: ['users', 'etablissements'],
    queryFn: getEtablissements,
    staleTime: 300_000,
  });

  const servicesQuery = useQuery({
    queryKey: ['users', 'services'],
    queryFn: () => getServices(),
    staleTime: 300_000,
  });

  const beneficiariesQuery = useQuery({
    queryKey: ['users', 'beneficiaires'],
    queryFn: () => getBeneficiaires(),
    staleTime: 300_000,
  });

  const instances = useMemo(() => {
    const list = instancesQuery.data?.data?.results ?? instancesQuery.data?.data ?? [];
    return [...list].sort((left, right) => {
      const aDate = new Date(left.date_acquisition_display ?? left.date_acquisition ?? 0).getTime();
      const bDate = new Date(right.date_acquisition_display ?? right.date_acquisition ?? 0).getTime();
      return bDate - aDate;
    });
  }, [instancesQuery.data?.data]);

  const etabs = etabsQuery.data?.data?.results ?? etabsQuery.data?.data ?? [];
  const services = servicesQuery.data?.data?.results ?? servicesQuery.data?.data ?? [];
  const beneficiaries = beneficiariesQuery.data?.data?.results ?? beneficiariesQuery.data?.data ?? [];

  const updateMutation = useMutation({
    mutationFn: ({ id_instance, data }) => updateInstance(id_instance, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources', 'instances'] });
      queryClient.invalidateQueries({ queryKey: ['resources', 'ressources'] });
      setEditingId(null);
      setDraft(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id_instance) => deleteInstance(id_instance),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources', 'instances'] });
      queryClient.invalidateQueries({ queryKey: ['resources', 'ressources'] });
      setDeletingInstanceId(null);
    },
  });

  const toNullableId = (value) => {
    if (value === '' || value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const startEdit = (instance) => {
    setEditingId(instance.idInstance ?? instance.id_instance);
    setDraft({
      statut: instance.statut ?? 'en_stock',
      id_lieu_affectation: (instance.idLieuAffectation ?? instance.id_lieu_affectation) ?? '',
      id_service_actuel: (instance.idServiceActuel ?? instance.id_service_actuel) ?? '',
      id_destinataire: (instance.idDestinataire ?? instance.id_destinataire) ?? '',
      observation: instance.observation ?? '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
  };

  const saveEdit = () => {
    if (!editingId || !draft) return;
    updateMutation.mutate({
      id_instance: editingId,
      data: {
        statut: draft.statut,
        id_lieu_affectation: toNullableId(draft.id_lieu_affectation),
        id_service_actuel: toNullableId(draft.id_service_actuel),
        id_destinataire: toNullableId(draft.id_destinataire),
        observation: draft.observation ?? '',
      },
    });
  };

  const modalStyle = {
    position: 'fixed',
    inset: 0,
    zIndex: 1100,
    background: 'rgba(15, 23, 42, 0.45)',
    backdropFilter: 'blur(4px)',
    display: 'grid',
    placeItems: 'center',
    padding: 16,
  };

  const panelStyle = {
    width: 'min(1200px, 98vw)',
    maxHeight: '92vh',
    overflow: 'auto',
    background: '#fff',
    borderRadius: 20,
    border: '1px solid #e2e8f0',
    boxShadow: '0 32px 80px rgba(15, 23, 42, 0.24)',
    padding: 18,
  };

  const selectMiniStyle = {
    ...inputStyle,
    padding: '8px 10px',
    fontSize: 12,
    width: '100%',
    boxSizing: 'border-box',
    background: '#fff',
  };

  const textareaMiniStyle = {
    ...inputStyle,
    padding: '8px 10px',
    fontSize: 12,
    width: '100%',
    boxSizing: 'border-box',
    minHeight: 68,
    resize: 'vertical',
  };

  return (
    <div style={modalStyle} onClick={onClose}>
      <div style={panelStyle} onClick={(event) => event.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
              Instances de {article.designation}
            </div>
            <div style={{ marginTop: 4, fontSize: 12, color: '#64748b' }}>
              {instances.length} instance(s) chargée(s)
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ ...iconBtn, width: 34, height: 34, borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <X size={16} color="#475569" />
          </button>
        </div>

        {instancesQuery.isLoading ? (
          <p style={{ color: '#94a3b8', fontSize: 13 }}>Chargement…</p>
        ) : instances.length === 0 ? (
          <div style={{ padding: '24px 0', color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>
            Aucune instance trouvée pour cet article.
          </div>
        ) : (
          <div style={{ overflow: 'auto', border: '1px solid #e2e8f0' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12 }}>
              <thead>
                <tr>
                  {['N° inv.', 'Statut', "Date d'acquisition", 'Réf. marché', 'Localisation', 'Observation', 'Actions'].map((header) => (
                    <th key={header} style={{
                      position: 'sticky',
                      top: 0,
                      background: '#f8fafc',
                      borderBottom: '1px solid #e2e8f0',
                      padding: '11px 12px',
                      textAlign: 'left',
                      color: '#64748b',
                      fontSize: 11,
                      fontWeight: 800,
                      whiteSpace: 'nowrap',
                    }}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {instances.map((instance) => {
                  const instanceId = instance.idInstance ?? instance.id_instance;
                  const isEditing = editingId != null && String(editingId) === String(instanceId);

                  return (
                    <tr key={instanceId} style={{ borderBottom: '1px solid #f1f5f9', verticalAlign: 'top' }}>
                      <td style={{ padding: '12px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{getInstanceDisplayId(instance)}</div>
                      </td>
                      <td style={{ padding: '12px' }}>
                        {isEditing ? (
                          <select
                            value={draft?.statut ?? instance.statut ?? 'en_stock'}
                            onChange={(event) => setDraft((current) => ({ ...current, statut: event.target.value }))}
                            style={selectMiniStyle}
                          >
                            {['en_stock', 'en_service', 'en_maintenance', 'debarras'].map((option) => (
                              <option key={option} value={option}>{formatStatusLabel(option)}</option>
                            ))}
                          </select>
                        ) : (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '5px 10px', borderRadius: 999,
                            background: '#ecfdf3', color: '#027A48',
                            fontWeight: 700,
                          }}>
                            {formatStatusLabel(instance.statut)}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px', color: '#334155' }}>{formatInstanceDate(instance.dateAcquisitionDisplay ?? instance.date_acquisition_display ?? instance.dateAcquisition ?? instance.date_acquisition)}</td>
                      <td style={{ padding: '12px', color: '#334155' }}>{instance.referenceMarche ?? instance.reference_marche ?? '—'}</td>
                      <td style={{ padding: '12px', minWidth: 280 }}>
                        {isEditing ? (
                          <select
                            value={draft?.id_service_actuel ?? ''}
                            onChange={(event) => setDraft((current) => ({ ...current, id_service_actuel: event.target.value }))}
                            style={selectMiniStyle}
                          >
                            <option value="">— Aucun —</option>
                            {services.map((service) => (
                              <option key={service.id_service ?? service.idService} value={service.id_service ?? service.idService}>
                                {service.nom_service ?? service.nomService}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span style={{ color: '#334155', fontSize: 12 }}>
                            {instance.statut === 'en_stock'
                              ? 'Magasin'
                              : instance.statut === 'en_service'
                                ? (instance.serviceActuel?.nomService ?? instance.service_actuel?.nom_service ?? '—')
                                : '—'}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px', minWidth: 240 }}>
                        {isEditing ? (
                          <textarea
                            value={draft?.observation ?? ''}
                            onChange={(event) => setDraft((current) => ({ ...current, observation: event.target.value }))}
                            style={textareaMiniStyle}
                            placeholder="Observation"
                          />
                        ) : (
                          <div style={{ color: '#334155', whiteSpace: 'pre-wrap' }}>{instance.observation || '—'}</div>
                        )}
                      </td>
                      <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                        {isEditing ? (
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              type="button"
                              onClick={saveEdit}
                              disabled={updateMutation.isPending}
                              style={{
                                padding: '8px 12px', borderRadius: 10,
                                border: 'none', background: '#0C447C', color: '#fff',
                                fontSize: 12, fontWeight: 800, cursor: 'pointer',
                                opacity: updateMutation.isPending ? 0.7 : 1,
                              }}
                            >
                              {updateMutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              style={{
                                padding: '8px 12px', borderRadius: 10,
                                border: '1px solid #dbe4ee', background: '#fff', color: '#334155',
                                fontSize: 12, fontWeight: 800, cursor: 'pointer',
                              }}
                            >
                              Annuler
                            </button>
                          </div>
                        ) : deletingInstanceId === instanceId ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: 12, color: '#374151' }}>Supprimer ?</span>
                            <button
                              type="button"
                              onClick={() => deleteMutation.mutate(instanceId)}
                              disabled={deleteMutation.isPending}
                              style={{ ...iconBtn, fontSize: 11, fontWeight: 700, color: '#dc2626', padding: '2px 6px' }}
                            >
                              Oui
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingInstanceId(null)}
                              style={{ ...iconBtn, fontSize: 11, color: '#64748b', padding: '2px 6px' }}
                            >
                              Non
                            </button>
                          </span>
                        ) : (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => startEdit(instance)}
                              style={{ ...TOOLBAR_BUTTON_STYLE, fontSize: 12, padding: '5px 10px' }}
                            >
                              Modifier
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingInstanceId(instanceId)}
                              style={{ ...TOOLBAR_BUTTON_STYLE, fontSize: 12, padding: '5px 10px', color: '#dc2626', borderColor: '#fca5a5' }}
                            >
                              Supprimer
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// Modal form field styles
const labelStyle = {
  display: 'flex', flexDirection: 'column', gap: 5,
  fontSize: 12, fontWeight: 600, color: '#374151',
};
const inputStyle = {
  border: '1px solid #e2e8f0', borderRadius: 7, padding: '8px 10px',
  fontSize: 13, outline: 'none', background: '#fff', width: '100%',
  boxSizing: 'border-box',
};
const selectStyle = {
  ...inputStyle, cursor: 'pointer', appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', paddingRight: 28,
};

// ═════════════════════════════════════════════════════════════════════════════
// ── Structure tab shared constants ────────────────────────────────────────────
const SVC_TYPE_LABELS = {
  administratif: 'Administratif',
  chu: 'CHU',
  decanat: 'Décanat',
  pharmacie: 'Pharmacie',
  dentaire: 'Dentaire',
  labo: 'Labo',
  association: 'Association',
};
const SVC_TYPE_BADGE = {
  administratif: { bg: '#f1f5f9', color: '#475569' },
  chu:           { bg: '#E6F1FB', color: '#0C447C' },
  decanat:       { bg: '#EEEDFE', color: '#3C3489' },
  pharmacie:     { bg: '#ECFDF5', color: '#065F46' },
  dentaire:      { bg: '#E0F2FE', color: '#0369A1' },
  labo:          { bg: '#FEF3C7', color: '#92400E' },
  association:   { bg: '#FDF2F8', color: '#9D174D' },
};
const BEN_ROLE_LABELS = {
  chef_service:   'Chef de service',
  fonctionnaire:  'Fonctionnaire',
  secretariat:    'Secrétariat',
  salle_de_cours: 'Salle de cours',
  prof:           'Prof',
};
const BEN_ROLE_BADGE = {
  chef_service:   { bg: '#E6F1FB', color: '#0C447C' },
  fonctionnaire:  { bg: '#f1f5f9', color: '#475569' },
  secretariat:    { bg: '#ECFDF5', color: '#065F46' },
  salle_de_cours: { bg: '#FEF3C7', color: '#92400E' },
  prof:           { bg: '#EEEDFE', color: '#3C3489' },
};
function SmallBadge({ label, bg, color }) {
  return (
    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, background: bg, color, fontSize: 11, fontWeight: 700 }}>
      {label}
    </span>
  );
}

// CategoriesTab
// ═════════════════════════════════════════════════════════════════════════════
function CategoriesTab({ queryClient }) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(new Set());
  const [openMenuId, setOpenMenuId] = useState(null);
  const [modal, setModal] = useState(null);
  const [modalError, setModalError] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showFilter, setShowFilter] = useState(false);

  const catsQ = useQuery({
    queryKey: ['resources', 'categories'],
    queryFn: () => getCategories(),
    staleTime: 30_000,
  });
  const subsQ = useQuery({
    queryKey: ['resources', 'sous-categories'],
    queryFn: () => getSousCategories(),
    staleTime: 30_000,
  });
  const resQ = useQuery({
    queryKey: ['resources', 'ressources'],
    queryFn: () => getRessources(),
    staleTime: 30_000,
  });
  const stoQ = useQuery({
    queryKey: ['resources', 'stocks'],
    queryFn: () => getStock(),
    staleTime: 30_000,
  });
  const typesQ = useQuery({
    queryKey: ['resources', 'types'],
    queryFn: () => getTypeArticles(),
    staleTime: 60_000,
  });

  const inv = () => {
    queryClient.invalidateQueries({ queryKey: ['resources', 'categories'] });
    queryClient.invalidateQueries({ queryKey: ['resources', 'sous-categories'] });
    queryClient.invalidateQueries({ queryKey: ['resources', 'ressources'] });
    queryClient.invalidateQueries({ queryKey: ['resources', 'stocks'] });
    queryClient.invalidateQueries({ queryKey: ['resources', 'types'] });
  };

  const createCatM = useMutation({
    mutationFn: (d) => createCategory(d),
    onSuccess: () => { inv(); closeModal(); },
    onError: (error) => setModalError(error?.response?.data?.nom_categorie?.[0] ?? 'Impossible de créer la catégorie.'),
  });
  const updateCatM = useMutation({
    mutationFn: ({ id, d }) => updateCategory(id, d),
    onSuccess: () => { inv(); closeModal(); },
    onError: (error) => setModalError(error?.response?.data?.nom_categorie?.[0] ?? 'Impossible de modifier la catégorie.'),
  });
  const deleteCatM = useMutation({
    mutationFn: (id) => deleteCategory(id),
    onSuccess: inv,
  });
  const createSubM = useMutation({
    mutationFn: (d) => createSousCategory(d),
    onSuccess: () => { inv(); closeModal(); },
    onError: (error) => setModalError(error?.response?.data?.nom_sous_categorie?.[0] ?? 'Impossible de créer la sous-catégorie.'),
  });
  const updateSubM = useMutation({
    mutationFn: ({ id, d }) => updateSousCategory(id, d),
    onSuccess: () => { inv(); closeModal(); },
    onError: (error) => setModalError(error?.response?.data?.nom_sous_categorie?.[0] ?? 'Impossible de modifier la sous-catégorie.'),
  });
  const deleteSubM = useMutation({
    mutationFn: (id) => deleteSousCategory(id),
    onSuccess: inv,
  });

  const rawCats = catsQ.data?.data?.results ?? catsQ.data?.data ?? [];
  const rawSubs = subsQ.data?.data?.results ?? subsQ.data?.data ?? [];
  const rawRes = resQ.data?.data?.results ?? resQ.data?.data ?? [];
  const rawSto = stoQ.data?.data?.results ?? stoQ.data?.data ?? [];
  const rawTypes = typesQ.data?.data?.results ?? typesQ.data?.data ?? [];

  const typeOptions = useMemo(() => {
    const mapped = rawTypes
      .map((typeItem) => ({
        value: String(typeItem.id_categorie ?? typeItem.idCategorie ?? ''),
        label: formatTypeDisplayName(typeItem.nom_categorie ?? typeItem.nomCategorie),
      }))
      .filter((option) => option.value);

    return mapped;
  }, [rawTypes]);

  const typeLabelById = useMemo(() => {
    return Object.fromEntries(typeOptions.map((option) => [String(option.value), option.label]));
  }, [typeOptions]);

  const typeValueById = useMemo(() => {
    return Object.fromEntries(typeOptions.map((option) => [String(option.value), normalizeText(option.label)]));
  }, [typeOptions]);

  const stockByResourceId = useMemo(() => {
    return Object.fromEntries(
      rawSto.map((stock) => [String(getStockRes(stock)), stock]),
    );
  }, [rawSto]);

  const resolveResourceCategoryId = (resource) => String(
    resource?.id_categorie
      ?? resource?.idCategorie
      ?? resource?.categorie?.id_categorie
      ?? resource?.categorie?.idCategorie
      ?? '',
  );

  const resolveResourceSubCategoryId = (resource) => String(
    resource?.id_sous_categorie
      ?? resource?.idSousCategorie
      ?? resource?.sous_categorie?.id_sous_categorie
      ?? resource?.sous_categorie?.idSousCategorie
      ?? '',
  );

  const getResourceQuantity = (resource) => {
    const resourceId = String(getResId(resource));
    const stock = stockByResourceId[resourceId];
    const isConsumable = resource?.is_consommable ?? resource?.isConsommable ?? false;

    if (isConsumable) {
      return Number(stock?.quantite_disponible ?? stock?.quantiteDisponible ?? 0);
    }

    return Number(resource?.instancesEnStock ?? resource?.instances_en_stock ?? 0);
  };

  const getResourceLastUpdate = (resource) => {
    const resourceId = String(getResId(resource));
    const updated = stockByResourceId[resourceId]?.date_mise_a_jour;
    const stamp = updated ? new Date(updated).getTime() : 0;
    return Number.isNaN(stamp) ? 0 : stamp;
  };

  const categoryRows = useMemo(() => {
    return rawCats.map((category) => {
      const categoryId = String(getCategoryId(category));
      const categoryLabel = getCategoryDisplayLabel(category);
      const categoryDescription = getCategoryDescription(category);
      const typeId = String(getCategoryTypeId(category) ?? '');
      const rawTypeLabel = typeLabelById[typeId] ?? getTypeLabel(category);
      const typeLabel = formatTypeDisplayName(rawTypeLabel);
      const typeValue = typeValueById[typeId] ?? getTypeValue(category);
      const isActive = getCategoryActive(category);

      const categoryResources = rawRes.filter((resource) => resolveResourceCategoryId(resource) === categoryId);
      const categorySubCategories = rawSubs.filter((subCategory) => String(getSubCat(subCategory)) === categoryId);

      const subCategoryRows = categorySubCategories
        .map((subCategory) => {
          const subCategoryId = String(getSubCategoryId(subCategory));
          const resourcesInSubCategory = categoryResources.filter(
            (resource) => resolveResourceSubCategoryId(resource) === subCategoryId,
          );
          const totalQuantity = resourcesInSubCategory.reduce(
            (sum, resource) => sum + getResourceQuantity(resource),
            0,
          );
          const lastUpdated = resourcesInSubCategory.reduce(
            (max, resource) => Math.max(max, getResourceLastUpdate(resource)),
            0,
          );

          return {
            id: subCategoryId,
            label: getSubCategoryLabel(subCategory),
            description: getSubCategoryDescription(subCategory),
            articleCount: resourcesInSubCategory.length,
            quantity: totalQuantity,
            availability: resourcesInSubCategory.length === 0
              ? 'Vide'
              : totalQuantity > 0
                ? 'Disponible'
                : 'Rupture',
            availabilityTone: resourcesInSubCategory.length === 0
              ? 'muted'
              : totalQuantity > 0
                ? 'success'
                : 'danger',
            lastUpdated,
            raw: subCategory,
          };
        })
        .sort((left, right) => left.label.localeCompare(right.label, 'fr'));

      const catDate = category?.date_mise_a_jour ?? category?.dateMiseAJour ?? null;

      return {
        id: categoryId,
        label: categoryLabel,
        description: categoryDescription,
        typeValue,
        typeLabel,
        typeId,
        isActive,
        subCategoryCount: categorySubCategories.length,
        articleCount: categoryResources.length,
        lastUpdatedLabel: formatDateTime(catDate),
        chipStyle: getCategoryChipStyle(categoryLabel),
        subCategories: subCategoryRows,
        raw: category,
        searchIndex: normalizeText([
          categoryLabel,
          categoryDescription,
          typeLabel,
          ...subCategoryRows.map((item) => item.label),
          ...subCategoryRows.map((item) => item.description),
        ].join(' ')),
      };
    });
  }, [rawCats, rawRes, rawSubs, stockByResourceId, typeLabelById, typeValueById]);

  const stats = useMemo(() => {
    const topCategory = categoryRows.reduce((best, current) => {
      if (!best) return current;
      return current.articleCount > best.articleCount ? current : best;
    }, null);

    return {
      totalCategories: categoryRows.length,
      totalSubCategories: rawSubs.length,
      totalArticles: rawRes.length,
      topCategory,
    };
  }, [categoryRows, rawSubs.length, rawRes.length]);

  const filteredCategories = useMemo(() => {
    let list = [...categoryRows];

    if (typeFilter !== 'all') {
      list = list.filter((category) => category.typeValue === typeFilter);
    }

    if (search.trim()) {
      const query = normalizeText(search);
      list = list.filter((category) => category.searchIndex.includes(query));
    }

    list.sort((left, right) => right.articleCount - left.articleCount || left.label.localeCompare(right.label, 'fr'));
    return list;
  }, [categoryRows, search, typeFilter]);

  const defaultTypeId = typeOptions[0]?.value ?? '';
  const isSaving = createCatM.isPending || updateCatM.isPending || createSubM.isPending || updateSubM.isPending;

  function closeModal() {
    setModal(null);
    setModalError('');
    setOpenMenuId(null);
  }

  function openCategoryModal(category = null) {
    setOpenMenuId(null);
    setModalError('');
    if (!category) {
      setModal({
        kind: 'category',
        mode: 'add',
        draft: {
          typeId: defaultTypeId,
          name: '',
          description: '',
          active: true,
        },
      });
      return;
    }

    setModal({
      kind: 'category',
      mode: 'edit',
      id: category.id,
      draft: {
        typeId: category.typeId || defaultTypeId,
        name: category.label,
        description: category.description,
        active: category.isActive,
      },
    });
  }

  function openSubCategoryModal(category = null, subCategory = null) {
    setOpenMenuId(null);
    setModalError('');
    if (!category) return;

    setModal({
      kind: 'subcategory',
      mode: subCategory ? 'edit' : 'add',
      id: subCategory?.id ?? null,
      categoryId: category.id,
      draft: {
        categoryId: category.id,
        name: subCategory?.label ?? '',
        description: subCategory?.description ?? '',
      },
    });
  }

  function submitModal() {
    if (!modal) return;
    setModalError('');

    if (modal.kind === 'category') {
      if (!modal.draft.name.trim()) {
        setModalError('Le nom de la catégorie est requis.');
        return;
      }
      if (!modal.draft.typeId) {
        setModalError('Le type est requis.');
        return;
      }

      const payload = {
        nom_categorie: modal.draft.name.trim(),
        description: modal.draft.description.trim(),
        actif: Boolean(modal.draft.active),
        id_type: Number(modal.draft.typeId),
      };

      if (modal.mode === 'add') {
        createCatM.mutate(payload);
      } else {
        updateCatM.mutate({ id: modal.id, d: payload });
      }
      return;
    }

    if (!modal.draft.name.trim()) {
      setModalError('Le nom de la sous-catégorie est requis.');
      return;
    }
    if (!modal.draft.categoryId) {
      setModalError('La catégorie parente est requise.');
      return;
    }

    const payload = {
      nom_sous_categorie: modal.draft.name.trim(),
      description: modal.draft.description.trim(),
      id_categorie: Number(modal.draft.categoryId),
    };

    if (modal.mode === 'add') {
      createSubM.mutate(payload);
    } else {
      updateSubM.mutate({ id: modal.id, d: payload });
    }
  }

  function toggleExpanded(categoryId) {
    setOpenMenuId(null);
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }

  function toggleMenu(categoryId) {
    setOpenMenuId((current) => (current === categoryId ? null : categoryId));
  }

  function handleDeleteCategory(category) {
    setOpenMenuId(null);
    if (window.confirm(`Supprimer la catégorie “${category.label}” ?`)) {
      deleteCatM.mutate(category.id);
    }
  }

  function handleDeleteSubCategory(subCategory) {
    setOpenMenuId(null);
    if (window.confirm(`Supprimer la sous-catégorie “${subCategory.label}” ?`)) {
      deleteSubM.mutate(subCategory.id);
    }
  }

  if (catsQ.isLoading || subsQ.isLoading || resQ.isLoading || stoQ.isLoading || typesQ.isLoading) {
    return <p style={{ color: '#94a3b8', fontSize: 13 }}>Chargement…</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 14 }}>
          <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: 420 }}>
            <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher une catégorie ou une sous-catégorie"
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '9px 14px 9px 36px', borderRadius: 10,
                border: '1px solid #e2e8f0', background: '#fff',
                fontSize: 13, color: '#0f172a', outline: 'none',
              }}
            />
          </div>

          {CATEGORY_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.key}
                type="button"
                onClick={() => setShowFilter((v) => !v)}
                style={{ ...TOOLBAR_BUTTON_STYLE, background: showFilter ? '#f1f5f9' : '#fff' }}
              >
                <Icon size={14} /> {action.label}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => openCategoryModal()}
            style={{ ...PRIMARY_TOOLBAR_BUTTON_STYLE, marginLeft: 'auto' }}
          >
            <Plus size={15} /> Ajouter une catégorie
          </button>
        </div>

        {showFilter && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Type :</span>
            {[
              { key: 'all', label: 'Tous' },
              { key: 'consommable', label: 'Consommable' },
              { key: 'bien_inventaire', label: 'Bien Inventaire' },
            ].map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setTypeFilter(opt.key)}
                style={{
                  padding: '4px 12px', borderRadius: 999, border: '1px solid',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  borderColor: typeFilter === opt.key ? '#0C447C' : '#e2e8f0',
                  background: typeFilter === opt.key ? '#E6F1FB' : '#fff',
                  color: typeFilter === opt.key ? '#0C447C' : '#64748b',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        <div style={WORKSPACE_TABLE_STYLE}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 }}>
            <thead>
              <tr>
                {['Type', 'Catégorie', 'Sous-catégories', 'Articles', 'Dernière modification', '', 'Actions'].map((headerLabel) => (
                  <th
                    key={headerLabel}
                    style={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 2,
                      background: '#f8fafc',
                      borderBottom: '1px solid #e2e8f0',
                      padding: '12px 14px',
                      textAlign: 'left',
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#64748b',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {headerLabel}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '40px 16px', textAlign: 'center', color: '#94a3b8' }}>
                    Aucune catégorie ne correspond aux filtres actifs.
                  </td>
                </tr>
              ) : (
                filteredCategories.map((category) => {
                  const isExpanded = expanded.has(category.id);
                  const isMenuOpen = openMenuId === category.id;

                  return (
                    <Fragment key={category.id}>
                      <tr
                        onClick={() => toggleExpanded(category.id)}
                        style={{
                          background: isExpanded ? '#F8FBFF' : '#fff',
                          cursor: 'pointer',
                        }}
                      >
                        <td style={{ padding: '14px 14px', verticalAlign: 'top' }}>
                          <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: 8,
                            padding: '5px 10px', borderRadius: 999,
                            background: TYPE_BADGE_STYLES[category.typeValue]?.bg ?? '#F1F5F9',
                            color: TYPE_BADGE_STYLES[category.typeValue]?.color ?? '#334155',
                            fontSize: 12, fontWeight: 700,
                          }}>
                            <span style={{ width: 6, height: 6, borderRadius: 999, background: 'currentColor', opacity: 0.8 }} />
                            {category.typeLabel}
                          </div>
                        </td>
                        <td style={{ padding: '14px 14px', verticalAlign: 'top' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ fontWeight: 700, color: '#0f172a' }}>{category.label}</div>
                              </div>
                              {category.description && (
                                <div style={{ marginTop: 3, color: '#64748b', fontSize: 12, lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 340 }}>
                                  {category.description}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '14px 14px', verticalAlign: 'top', color: '#334155', fontWeight: 600 }}>
                          {category.subCategoryCount}
                        </td>
                        <td style={{ padding: '14px 14px', verticalAlign: 'top', color: '#334155', fontWeight: 700 }}>
                          {category.articleCount}
                        </td>
                        <td style={{ padding: '14px 14px', verticalAlign: 'top', color: '#64748b', whiteSpace: 'nowrap' }}>
                          {category.lastUpdatedLabel}
                        </td>
                        <td style={{ padding: '14px 14px', verticalAlign: 'top' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '5px 10px', borderRadius: 999,
                            background: category.isActive ? '#ecfdf3' : '#fef2f2',
                            color: category.isActive ? '#027A48' : '#b42318',
                            fontSize: 12, fontWeight: 700,
                          }}>
                            <span style={{ width: 6, height: 6, borderRadius: 999, background: category.isActive ? '#12b76a' : '#f04438' }} />
                            {category.isActive ? 'Actif' : 'Inactif'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 14px', verticalAlign: 'top', position: 'relative' }}>
                          <button
                            type="button"
                            onClick={(event) => { event.stopPropagation(); toggleMenu(category.id); }}
                            style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              width: 36, height: 36, borderRadius: 12,
                              border: '1px solid #dbe4ee', background: isMenuOpen ? '#f8fafc' : '#fff',
                              color: '#334155', cursor: 'pointer',
                            }}
                          >
                            <MoreVertical size={16} />
                          </button>

                          {isMenuOpen && (
                            <div style={{
                              position: 'absolute', right: 14, top: 52, zIndex: 10,
                              minWidth: 230,
                              background: '#fff',
                              borderRadius: 16,
                              border: '1px solid #e2e8f0',
                              boxShadow: '0 24px 60px rgba(15, 23, 42, 0.16)',
                              overflow: 'hidden',
                            }}>
                              {[
                                { key: 'details', label: 'Voir détails', icon: Eye },
                                { key: 'edit', label: 'Modifier', icon: Edit2 },
                                { key: 'add-sub', label: 'Ajouter sous-catégorie', icon: Plus },
                                { key: 'delete', label: 'Supprimer', icon: Trash2, danger: true },
                              ].map((action) => {
                                const ActionIcon = action.icon;
                                return (
                                  <button
                                    key={action.key}
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setOpenMenuId(null);
                                      if (action.key === 'details') {
                                        toggleExpanded(category.id);
                                      } else if (action.key === 'edit') {
                                        openCategoryModal(category);
                                      } else if (action.key === 'add-sub') {
                                        openSubCategoryModal(category);
                                      } else if (action.key === 'delete') {
                                        handleDeleteCategory(category);
                                      }
                                    }}
                                    style={{
                                      width: '100%',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 10,
                                      padding: '11px 14px',
                                      border: 'none',
                                      background: 'transparent',
                                      textAlign: 'left',
                                      color: action.danger ? '#b42318' : '#0f172a',
                                      fontSize: 13,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <ActionIcon size={14} />
                                    {action.label}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr key={`${category.id}-expanded`}>
                          <td colSpan={7} style={{ padding: '0 12px 14px' }}>
                            <div style={{
                              background: '#F8FBFF',
                              border: '1px solid #dbe8f5',
                              borderRadius: 16,
                              padding: 14,
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                                    Sous-catégories
                                  </div>
                                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                                    {category.subCategoryCount} sous-catégorie(s) et {category.articleCount} article(s) liés.
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => openSubCategoryModal(category)}
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 7,
                                    padding: '9px 13px', borderRadius: 11,
                                    border: '1px solid #cfe0ee', background: '#fff',
                                    color: '#0C447C', fontSize: 13, fontWeight: 700,
                                    cursor: 'pointer',
                                  }}
                                >
                                  <Plus size={14} /> Ajouter une sous-catégorie
                                </button>
                              </div>

                              <div style={{ overflow: 'hidden', border: '1px solid #e2e8f0', background: '#fff' }}>
                                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12 }}>
                                  <thead>
                                    <tr>
                                      {['Nom sous-catégorie', 'Quantité d’articles', 'Disponibilité', 'Description', 'Actions'].map((subHeader) => (
                                        <th key={subHeader} style={{
                                          background: '#f8fafc',
                                          position: 'sticky',
                                          top: 0,
                                          zIndex: 1,
                                          padding: '10px 12px',
                                          textAlign: 'left',
                                          fontSize: 11,
                                          fontWeight: 700,
                                          color: '#64748b',
                                          borderBottom: '1px solid #e2e8f0',
                                        }}>
                                          {subHeader}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {category.subCategories.length === 0 ? (
                                      <tr>
                                        <td colSpan={5} style={{ padding: '22px 12px', color: '#94a3b8', textAlign: 'center' }}>
                                          Aucune sous-catégorie rattachée.
                                        </td>
                                      </tr>
                                    ) : (
                                      category.subCategories.map((subCategory) => (
                                        <tr key={subCategory.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                          <td style={{ padding: '12px', verticalAlign: 'top' }}>
                                            <div style={{ fontWeight: 700, color: '#0f172a' }}>{subCategory.label}</div>
                                            {subCategory.description && (
                                              <div style={{ marginTop: 3, color: '#64748b', lineHeight: 1.35 }}>
                                                {subCategory.description}
                                              </div>
                                            )}
                                          </td>
                                          <td style={{ padding: '12px', verticalAlign: 'top', color: '#334155', fontWeight: 700 }}>
                                            {subCategory.articleCount}
                                          </td>
                                          <td style={{ padding: '12px', verticalAlign: 'top' }}>
                                            <span style={{
                                              display: 'inline-flex', alignItems: 'center', gap: 6,
                                              padding: '5px 10px', borderRadius: 999,
                                              background: subCategory.availabilityTone === 'success'
                                                ? '#ecfdf3'
                                                : subCategory.availabilityTone === 'danger'
                                                  ? '#fef2f2'
                                                  : '#f1f5f9',
                                              color: subCategory.availabilityTone === 'success'
                                                ? '#027A48'
                                                : subCategory.availabilityTone === 'danger'
                                                  ? '#b42318'
                                                  : '#475569',
                                              fontWeight: 700,
                                              fontSize: 11,
                                            }}>
                                              {subCategory.availability}
                                            </span>
                                            <div style={{ marginTop: 6, fontSize: 11, color: '#64748b' }}>
                                              Quantité disponible: {subCategory.quantity}
                                            </div>
                                          </td>
                                          <td style={{ padding: '12px', verticalAlign: 'top', color: '#64748b' }}>
                                            {subCategory.description || '—'}
                                          </td>
                                          <td style={{ padding: '12px', verticalAlign: 'top', position: 'relative' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                              <button
                                                type="button"
                                                onClick={(event) => {
                                                  event.stopPropagation();
                                                  openSubCategoryModal(category, subCategory);
                                                }}
                                                title="Modifier"
                                                style={{
                                                  ...iconBtn,
                                                  width: 34,
                                                  height: 34,
                                                  border: '1px solid #dbe4ee',
                                                  borderRadius: 10,
                                                  background: '#fff',
                                                  color: '#334155',
                                                }}
                                              >
                                                <Edit2 size={14} />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={(event) => {
                                                  event.stopPropagation();
                                                  handleDeleteSubCategory(subCategory);
                                                }}
                                                title="Supprimer"
                                                style={{
                                                  ...iconBtn,
                                                  width: 34,
                                                  height: 34,
                                                  border: '1px solid #ffd7d7',
                                                  borderRadius: 10,
                                                  background: '#fff',
                                                  color: '#b42318',
                                                }}
                                              >
                                                <Trash2 size={14} />
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div
          onClick={closeModal}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 'min(620px, 100%)',
              background: '#fff',
              borderRadius: 20,
              border: '1px solid #e2e8f0',
              boxShadow: '0 30px 70px rgba(15, 23, 42, 0.24)',
              padding: 20,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
                  {modal.kind === 'category'
                    ? (modal.mode === 'add' ? 'Nouvelle catégorie' : 'Modifier la catégorie')
                    : (modal.mode === 'add' ? 'Nouvelle sous-catégorie' : 'Modifier la sous-catégorie')}
                </div>
                <div style={{ marginTop: 4, fontSize: 12, color: '#64748b' }}>
                  {modal.kind === 'category'
                    ? 'Définissez le type, le statut et la description pour mieux piloter la taxonomie.'
                    : 'Rattachez la sous-catégorie à une catégorie et gardez la hiérarchie lisible.'}
                </div>
              </div>
              <button type="button" onClick={closeModal} style={{ ...iconBtn, width: 34, height: 34, borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <X size={16} color="#475569" />
              </button>
            </div>

            <div style={{ display: 'grid', gap: 14 }}>
              {modal.kind === 'category' ? (
                <>
                  <label style={labelStyle}>
                    Type
                    <select
                      value={modal.draft.typeId}
                      onChange={(event) => setModal((current) => ({ ...current, draft: { ...current.draft, typeId: event.target.value } }))}
                      style={selectStyle}
                    >
                      <option value="">— Sélectionner —</option>
                      {typeOptions.map((typeOption) => (
                        <option key={typeOption.value} value={typeOption.value}>
                          {typeOption.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={labelStyle}>
                    Nom de la catégorie
                    <input
                      value={modal.draft.name}
                      onChange={(event) => setModal((current) => ({ ...current, draft: { ...current.draft, name: event.target.value } }))}
                      placeholder="Ex. Informatique"
                      style={inputStyle}
                    />
                  </label>

                  <label style={labelStyle}>
                    Description
                    <textarea
                      value={modal.draft.description}
                      onChange={(event) => setModal((current) => ({ ...current, draft: { ...current.draft, description: event.target.value } }))}
                      placeholder="Contexte, périmètre ou usage interne"
                      style={{ ...inputStyle, minHeight: 96, resize: 'vertical' }}
                    />
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 700, color: '#334155' }}>
                    <input
                      type="checkbox"
                      checked={Boolean(modal.draft.active)}
                      onChange={(event) => setModal((current) => ({ ...current, draft: { ...current.draft, active: event.target.checked } }))}
                    />
                    Catégorie active
                  </label>
                </>
              ) : (
                <>
                  <label style={labelStyle}>
                    Catégorie parente
                    <select
                      value={modal.draft.categoryId}
                      onChange={(event) => setModal((current) => ({ ...current, draft: { ...current.draft, categoryId: event.target.value } }))}
                      style={selectStyle}
                    >
                      <option value="">— Sélectionner —</option>
                      {categoryRows.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={labelStyle}>
                    Nom de la sous-catégorie
                    <input
                      value={modal.draft.name}
                      onChange={(event) => setModal((current) => ({ ...current, draft: { ...current.draft, name: event.target.value } }))}
                      placeholder="Ex. Imprimantes"
                      style={inputStyle}
                    />
                  </label>

                  <label style={labelStyle}>
                    Description
                    <textarea
                      value={modal.draft.description}
                      onChange={(event) => setModal((current) => ({ ...current, draft: { ...current.draft, description: event.target.value } }))}
                      placeholder="Infos complémentaires sur le périmètre"
                      style={{ ...inputStyle, minHeight: 96, resize: 'vertical' }}
                    />
                  </label>
                </>
              )}

              {modalError && (
                <div style={{
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: '1px solid #fecaca',
                  background: '#fef2f2',
                  color: '#b42318',
                  fontSize: 12,
                  fontWeight: 600,
                }}>
                  {modalError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={closeModal}
                  style={{
                    padding: '10px 16px',
                    borderRadius: 12,
                    border: '1px solid #dbe4ee',
                    background: '#fff',
                    color: '#334155',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={submitModal}
                  disabled={isSaving}
                  style={{
                    padding: '10px 16px',
                    borderRadius: 12,
                    border: 'none',
                    background: 'linear-gradient(135deg, #0C447C 0%, #1f5b91 100%)',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                    opacity: isSaving ? 0.75 : 1,
                    boxShadow: '0 14px 28px rgba(12, 68, 124, 0.2)',
                  }}
                >
                  {isSaving ? 'Enregistrement…' : modal.mode === 'add' ? 'Créer' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// StructureTab
// ═════════════════════════════════════════════════════════════════════════════
function StructureTab({ queryClient }) {
  // ── Queries ──────────────────────────────────────────────────────────────
  const etabsQ = useQuery({ queryKey: ['users', 'etablissements'], queryFn: getEtablissements, staleTime: 300_000 });
  const batsQ  = useQuery({ queryKey: ['users', 'batiments'],      queryFn: () => getBatiments(), staleTime: 60_000 });
  const svcsQ  = useQuery({ queryKey: ['users', 'services'],       queryFn: () => getServices(),  staleTime: 60_000 });

  const etabs     = etabsQ.data?.data?.results ?? etabsQ.data?.data ?? [];
  const batiments = batsQ.data?.data?.results  ?? batsQ.data?.data  ?? [];
  const services  = svcsQ.data?.data?.results  ?? svcsQ.data?.data  ?? [];

  // ── Lookup maps ───────────────────────────────────────────────────────────
  const etabById = useMemo(
    () => Object.fromEntries(etabs.map((e) => [String(e.idEtablissement ?? e.id_etablissement), e.nom])),
    [etabs],
  );

  const svcCountByBat = useMemo(() => {
    const counts = {};
    services.forEach((s) => {
      const bId = String(s.idBatiment ?? s.id_batiment ?? '');
      if (bId) counts[bId] = (counts[bId] ?? 0) + 1;
    });
    return counts;
  }, [services]);

  // ── Accordion state (one row open at a time) ──────────────────────────────
  const [expandedBatId, setExpandedBatId] = useState(null);

  function toggleExpand(batId) {
    setExpandedBatId((curr) => (curr != null && String(curr) === String(batId) ? null : batId));
  }

  const expandedServices = useMemo(
    () => expandedBatId == null
      ? []
      : services.filter((s) => String(s.idBatiment ?? s.id_batiment ?? '') === String(expandedBatId)),
    [services, expandedBatId],
  );

  // ── Bâtiment state ────────────────────────────────────────────────────────
  const [batModal, setBatModal] = useState(null);  // null | 'add' | bat object
  const [batForm,  setBatForm]  = useState({ nom: '', idEtablissement: '' });
  const [batErr,   setBatErr]   = useState('');
  const [batDel,   setBatDel]   = useState(null);

  // ── Service state ─────────────────────────────────────────────────────────
  const [svcModal,       setSvcModal]       = useState(null);  // null | 'add' | svc object
  const [svcForm,        setSvcForm]        = useState({ nomService: '' });
  const [svcErr,         setSvcErr]         = useState('');
  const [svcDel,         setSvcDel]         = useState(null);
  const [svcParentBatId, setSvcParentBatId] = useState(null);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createBatM = useMutation({
    mutationFn: createBatiment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'batiments'] });
      setBatModal(null); setBatForm({ nom: '', idEtablissement: '' }); setBatErr('');
    },
    onError: () => setBatErr('Erreur lors de la création.'),
  });
  const updateBatM = useMutation({
    mutationFn: ({ id, data }) => updateBatiment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'batiments'] });
      setBatModal(null); setBatForm({ nom: '', idEtablissement: '' }); setBatErr('');
    },
    onError: () => setBatErr('Erreur lors de la mise à jour.'),
  });
  const deleteBatM = useMutation({
    mutationFn: deleteBatiment,
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['users', 'batiments'] });
      setBatDel(null);
      setExpandedBatId((curr) => (curr != null && String(curr) === String(deletedId) ? null : curr));
    },
  });

  const createSvcM = useMutation({
    mutationFn: createServiceJson,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users', 'services'] }); setSvcModal(null); setSvcErr(''); },
    onError: () => setSvcErr('Erreur lors de la création.'),
  });
  const updateSvcM = useMutation({
    mutationFn: ({ id, data }) => updateServiceJson(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users', 'services'] }); setSvcModal(null); setSvcErr(''); },
    onError: () => setSvcErr('Erreur lors de la mise à jour.'),
  });
  const deleteSvcM = useMutation({
    mutationFn: deleteService,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users', 'services'] }); setSvcDel(null); },
  });

  // ── Submit helpers ────────────────────────────────────────────────────────
  function openBatEdit(bat) {
    setBatForm({
      nom: bat.nom ?? '',
      idEtablissement: String(bat.idEtablissement ?? bat.id_etablissement ?? ''),
    });
    setBatErr('');
    setBatModal(bat);
  }

  function submitBat() {
    if (!batForm.nom.trim())      { setBatErr('Le nom est requis.'); return; }
    if (!batForm.idEtablissement) { setBatErr("L'établissement est requis."); return; }
    const payload = { nom: batForm.nom.trim(), id_etablissement: Number(batForm.idEtablissement) };
    if (batModal === 'add') {
      createBatM.mutate(payload);
    } else {
      const id = batModal.idBatiment ?? batModal.id_batiment;
      updateBatM.mutate({ id, data: payload });
    }
  }

  function openSvcAdd(batId) {
    setSvcParentBatId(batId);
    setSvcForm({ nomService: '' });
    setSvcErr('');
    setSvcModal('add');
  }

  function openSvcEdit(svc) {
    setSvcParentBatId(null);
    setSvcForm({ nomService: svc.nomService ?? svc.nom_service ?? '' });
    setSvcErr('');
    setSvcModal(svc);
  }

  function submitSvc() {
    if (!svcForm.nomService.trim()) { setSvcErr('Le nom du service est requis.'); return; }
    if (svcModal === 'add') {
      createSvcM.mutate({
        nom_service:  svcForm.nomService.trim(),
        type_service: 'administratif',
        id_batiment:  svcParentBatId != null ? Number(svcParentBatId) : null,
      });
    } else {
      const id = svcModal.idService ?? svcModal.id_service;
      updateSvcM.mutate({ id, data: { nom_service: svcForm.nomService.trim() } });
    }
  }

  // ── Local styles ──────────────────────────────────────────────────────────
  const overlay     = { position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', padding: 16 };
  const panel       = { width: 'min(440px, 96vw)', background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 24px 64px rgba(15,23,42,0.20)', padding: 24 };
  const modalHead   = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 };
  const mTitle      = { fontSize: 16, fontWeight: 800, color: '#0f172a' };
  const errBox      = { marginBottom: 12, color: '#dc2626', fontSize: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px' };
  const modalFooter = { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 };
  const closeBtn    = { ...iconBtn, width: 32, height: 32, borderRadius: 8, border: '1px solid #e2e8f0' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={() => { setBatModal('add'); setBatForm({ nom: '', idEtablissement: '' }); setBatErr(''); }}
          style={PRIMARY_TOOLBAR_BUTTON_STYLE}
        >
          <Plus size={14} /> Ajouter un bâtiment
        </button>
      </div>

      {/* ── Accordion table ── */}
      <div style={WORKSPACE_TABLE_STYLE}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 }}>
          <thead>
            <tr>
              {['', 'Nom du bâtiment', 'Établissement', 'Nb. services', 'Actions'].map((h) => (
                <th key={h} style={TABLE_HEADER_CELL_STYLE}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {batsQ.isLoading ? (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>Chargement…</td></tr>
            ) : batiments.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>Aucun bâtiment.</td></tr>
            ) : batiments.map((bat) => {
              const batId = bat.idBatiment ?? bat.id_batiment;
              const etabNom = etabById[String(bat.idEtablissement ?? bat.id_etablissement ?? '')] ?? '—';
              const isExpanded = expandedBatId != null && String(expandedBatId) === String(batId);
              const svcCount = svcCountByBat[String(batId)] ?? 0;

              return (
                <Fragment key={batId}>
                  <tr
                    onClick={() => toggleExpand(batId)}
                    style={{ background: isExpanded ? '#F8FBFF' : '#fff', cursor: 'pointer' }}
                  >
                    <td style={{ ...TABLE_CELL_STYLE, width: 40 }}>
                      <ChevronDown
                        size={15}
                        color="#64748b"
                        style={{ display: 'block', transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s' }}
                      />
                    </td>
                    <td style={{ ...TABLE_CELL_STYLE, fontWeight: 700, color: '#0f172a' }}>{bat.nom}</td>
                    <td style={TABLE_CELL_STYLE}>{etabNom}</td>
                    <td style={TABLE_CELL_STYLE}><span style={{ fontWeight: 600, color: '#334155' }}>{svcCount}</span></td>
                    <td style={{ ...TABLE_CELL_STYLE, whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                      {batDel === batId ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 12, color: '#374151' }}>Supprimer ?</span>
                          <button type="button" onClick={() => deleteBatM.mutate(batId)} disabled={deleteBatM.isPending} style={{ ...iconBtn, fontSize: 11, fontWeight: 700, color: '#dc2626', padding: '2px 6px' }}>Oui</button>
                          <button type="button" onClick={() => setBatDel(null)} style={{ ...iconBtn, fontSize: 11, color: '#64748b', padding: '2px 6px' }}>Non</button>
                        </span>
                      ) : (
                        <div style={{ display: 'inline-flex', gap: 4 }}>
                          <button type="button" title="Modifier" onClick={() => openBatEdit(bat)} style={iconBtn}><Edit2 size={14} color="#64748b" /></button>
                          <button type="button" title="Supprimer" onClick={() => setBatDel(batId)} style={iconBtn}><Trash2 size={14} color="#ef4444" /></button>
                        </div>
                      )}
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr key={`${batId}-expanded`}>
                      <td colSpan={5} style={{ padding: '0 12px 14px' }}>
                        <div style={{ background: '#F8FBFF', border: '1px solid #dbe8f5', borderRadius: 16, padding: 14 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#0C447C' }}>
                              Services — {bat.nom}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); openSvcAdd(batId); }}
                              style={{ ...PRIMARY_TOOLBAR_BUTTON_STYLE, padding: '7px 12px', fontSize: 12 }}
                            >
                              <Plus size={13} /> Ajouter un service
                            </button>
                          </div>

                          {svcsQ.isLoading ? (
                            <p style={{ color: '#94a3b8', fontSize: 12 }}>Chargement…</p>
                          ) : expandedServices.length === 0 ? (
                            <p style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', padding: '12px 0' }}>Aucun service pour ce bâtiment.</p>
                          ) : (
                            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12 }}>
                              <thead>
                                <tr>
                                  {['Nom du service', 'Actions'].map((h) => (
                                    <th key={h} style={{ ...TABLE_HEADER_CELL_STYLE, fontSize: 11, background: '#eef4fb' }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {expandedServices.map((svc) => {
                                  const svcId = svc.idService ?? svc.id_service;
                                  return (
                                    <tr key={svcId} style={{ borderBottom: '1px solid #e8eff8' }}>
                                      <td style={TABLE_CELL_STYLE}>{svc.nomService ?? svc.nom_service}</td>
                                      <td style={{ ...TABLE_CELL_STYLE, whiteSpace: 'nowrap' }}>
                                        {svcDel === svcId ? (
                                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                            <span style={{ fontSize: 11, color: '#374151' }}>Supprimer ?</span>
                                            <button type="button" onClick={() => deleteSvcM.mutate(svcId)} disabled={deleteSvcM.isPending} style={{ ...iconBtn, fontSize: 11, fontWeight: 700, color: '#dc2626', padding: '2px 6px' }}>Oui</button>
                                            <button type="button" onClick={() => setSvcDel(null)} style={{ ...iconBtn, fontSize: 11, color: '#64748b', padding: '2px 6px' }}>Non</button>
                                          </span>
                                        ) : (
                                          <div style={{ display: 'inline-flex', gap: 4 }}>
                                            <button type="button" title="Modifier" onClick={() => openSvcEdit(svc)} style={iconBtn}><Edit2 size={13} color="#64748b" /></button>
                                            <button type="button" title="Supprimer" onClick={() => setSvcDel(svcId)} style={iconBtn}><Trash2 size={13} color="#ef4444" /></button>
                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Modal : Bâtiment ── */}
      {batModal && (
        <div style={overlay} onClick={() => setBatModal(null)}>
          <div style={panel} onClick={(e) => e.stopPropagation()}>
            <div style={modalHead}>
              <span style={mTitle}>{batModal === 'add' ? 'Ajouter un bâtiment' : 'Modifier le bâtiment'}</span>
              <button type="button" onClick={() => setBatModal(null)} style={closeBtn}><X size={15} color="#475569" /></button>
            </div>
            {batErr && <div style={errBox}>{batErr}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={labelStyle}>
                Nom du bâtiment *
                <input value={batForm.nom} onChange={(e) => setBatForm((f) => ({ ...f, nom: e.target.value }))} style={inputStyle} placeholder="ex : Bloc A" />
              </label>
              <label style={labelStyle}>
                Établissement *
                <select value={batForm.idEtablissement} onChange={(e) => setBatForm((f) => ({ ...f, idEtablissement: e.target.value }))} style={inputStyle}>
                  <option value="">— Sélectionner —</option>
                  {etabs.map((et) => (
                    <option key={et.idEtablissement ?? et.id_etablissement} value={et.idEtablissement ?? et.id_etablissement}>{et.nom}</option>
                  ))}
                </select>
              </label>
            </div>
            <div style={modalFooter}>
              <button type="button" onClick={() => setBatModal(null)} style={TOOLBAR_BUTTON_STYLE}>Annuler</button>
              <button type="button" onClick={submitBat} disabled={createBatM.isPending || updateBatM.isPending} style={{ ...PRIMARY_TOOLBAR_BUTTON_STYLE, opacity: (createBatM.isPending || updateBatM.isPending) ? 0.7 : 1 }}>
                {(createBatM.isPending || updateBatM.isPending) ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal : Service ── */}
      {svcModal && (
        <div style={overlay} onClick={() => setSvcModal(null)}>
          <div style={panel} onClick={(e) => e.stopPropagation()}>
            <div style={modalHead}>
              <span style={mTitle}>{svcModal === 'add' ? 'Ajouter un service' : 'Modifier le service'}</span>
              <button type="button" onClick={() => setSvcModal(null)} style={closeBtn}><X size={15} color="#475569" /></button>
            </div>
            {svcErr && <div style={errBox}>{svcErr}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={labelStyle}>
                Nom du service *
                <input value={svcForm.nomService} onChange={(e) => setSvcForm((f) => ({ ...f, nomService: e.target.value }))} style={inputStyle} placeholder="ex : Cardiologie" />
              </label>
            </div>
            <div style={modalFooter}>
              <button type="button" onClick={() => setSvcModal(null)} style={TOOLBAR_BUTTON_STYLE}>Annuler</button>
              <button type="button" onClick={submitSvc} disabled={createSvcM.isPending || updateSvcM.isPending} style={{ ...PRIMARY_TOOLBAR_BUTTON_STYLE, opacity: (createSvcM.isPending || updateSvcM.isPending) ? 0.7 : 1 }}>
                {(createSvcM.isPending || updateSvcM.isPending) ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SuiviAffectationTab
// ═════════════════════════════════════════════════════════════════════════════

const MOTIF_OPTS = [
  { value: 'panne',     label: 'Panne' },
  { value: 'inutilise', label: 'Inutilisé' },
  { value: 'endommage', label: 'Endommagé' },
  { value: 'autre',     label: 'Autre' },
];
const MOTIF_LABEL = Object.fromEntries(MOTIF_OPTS.map((o) => [o.value, o.label]));

const STATUT_BADGE_CFG = {
  en_stock:       { bg: '#E6F1FB', color: '#0C447C', label: 'En stock' },
  en_service:     { bg: '#ecfdf3', color: '#027A48', label: 'En service' },
  en_maintenance: { bg: '#FEF3C7', color: '#92400E', label: 'En maintenance' },
  debarras:       { bg: '#FEE2E2', color: '#991B1B', label: 'Débarras' },
};

const MOUV_BADGE_CFG = {
  entree:    { bg: '#ecfdf3', color: '#027A48', label: 'Entrée' },
  sortie:    { bg: '#E6F1FB', color: '#0C447C', label: 'Sortie' },
  retour:    { bg: '#FEF3C7', color: '#92400E', label: 'Retour' },
  transfert: { bg: '#EEEDFE', color: '#3C3489', label: 'Transfert' },
  rebut:     { bg: '#FEE2E2', color: '#991B1B', label: 'Rebut' },
};

const ETAT_OPTS = [
  { value: 'neuf',      label: 'Neuf' },
  { value: 'bon_etat',  label: 'Bon état' },
  { value: 'endommage', label: 'Endommagé' },
  { value: 'retourne',  label: 'Retourné' },
];

const SUIVI_STATUT_OPTS = [
  { key: 'all',            label: 'Tous' },
  { key: 'en_stock',       label: 'En stock' },
  { key: 'en_service',     label: 'En service' },
  { key: 'en_maintenance', label: 'En maintenance' },
  { key: 'debarras',       label: 'Débarras' },
];

function SuiviAffectationTab({ queryClient }) {
  const [search,       setSearch]       = useState('');
  const [statutFilter, setStatutFilter] = useState('all');
  const [page,         setPage]         = useState(1);
  const [affectModal,  setAffectModal]  = useState(null);
  const [histModal,    setHistModal]    = useState(null);
  const [affectForm,   setAffectForm]   = useState({
    statut: 'en_service', idServiceActuel: '', idLieuAffectation: '', idDestinataire: '',
    etat: 'bon_etat', observation: '',
    dateDerniereAffectation: new Date().toISOString().split('T')[0],
  });
  const [affectErr, setAffectErr] = useState('');

  // ── Queries ───────────────────────────────────────────────────────────────
  const instQ  = useQuery({ queryKey: ['resources', 'instances'],  queryFn: () => getInstances(),     staleTime: 30_000 });
  const svcsQ  = useQuery({ queryKey: ['users', 'services'],       queryFn: () => getServices(),      staleTime: 60_000 });
  const etabsQ = useQuery({ queryKey: ['users', 'etablissements'], queryFn: getEtablissements,        staleTime: 300_000 });
  const bensQ  = useQuery({ queryKey: ['users', 'beneficiaires'],  queryFn: () => getBeneficiaires(), staleTime: 300_000 });

  const histInstanceId = histModal != null ? (histModal.idInstance ?? histModal.id_instance) : null;
  const histQ = useQuery({
    queryKey: ['resources', 'mouvements', { id_instance: histInstanceId }],
    queryFn:  () => getMouvements({ id_instance: histInstanceId }),
    enabled:  histInstanceId != null,
    staleTime: 0,
  });

  // ── Derived data ──────────────────────────────────────────────────────────
  const rawInstances  = instQ.data?.data?.results  ?? instQ.data?.data  ?? [];
  const services      = svcsQ.data?.data?.results  ?? svcsQ.data?.data  ?? [];
  const etabs         = etabsQ.data?.data?.results ?? etabsQ.data?.data ?? [];
  const beneficiaires = bensQ.data?.data?.results  ?? bensQ.data?.data  ?? [];
  const mouvements    = histQ.data?.data?.results  ?? histQ.data?.data  ?? [];

  const instances = useMemo(
    () => rawInstances.filter((i) => {
      const r = i.ressource ?? {};
      return (r.isBienInventaire ?? r.is_bien_inventaire) === true;
    }),
    [rawInstances],
  );

  const filtered = useMemo(() => {
    let list = statutFilter === 'all' ? instances : instances.filter((i) => i.statut === statutFilter);
    if (search.trim()) {
      const q = normalizeText(search);
      list = list.filter((i) =>
        normalizeText(i.numeroInventaire ?? i.numero_inventaire ?? '').includes(q) ||
        normalizeText(i.ressource?.designation ?? '').includes(q),
      );
    }
    return list;
  }, [instances, search]);

  const PAGE_SIZE   = 15;
  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated   = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage],
  );

  useEffect(() => setPage(1), [search, statutFilter]);

  // ── Mutation ──────────────────────────────────────────────────────────────
  const affectM = useMutation({
    mutationFn: ({ id, data }) => updateInstance(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources', 'instances'] });
      setAffectModal(null);
    },
    onError: () => setAffectErr('Erreur lors de la mise à jour.'),
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  function openAffect(instance) {
    const currentStatut = instance.statut ?? 'en_service';
    setAffectForm({
      statut:                  ['en_stock', 'en_service', 'en_maintenance'].includes(currentStatut) ? currentStatut : 'en_service',
      idServiceActuel:         String(instance.idServiceActuel   ?? instance.id_service_actuel   ?? ''),
      idLieuAffectation:       String(instance.idLieuAffectation ?? instance.id_lieu_affectation ?? ''),
      idDestinataire:          String(instance.idDestinataire    ?? instance.id_destinataire     ?? ''),
      etat:                    instance.etat ?? 'bon_etat',
      observation:             instance.observation ?? '',
      dateDerniereAffectation: new Date().toISOString().split('T')[0],
    });
    setAffectErr('');
    setAffectModal(instance);
  }

  function submitAffect() {
    const id = affectModal.idInstance ?? affectModal.id_instance;
    const toNullId = (v) => (v === '' || v == null) ? null : Number(v);
    affectM.mutate({
      id,
      data: {
        statut:                    affectForm.statut,
        id_service_actuel:         toNullId(affectForm.idServiceActuel),
        id_lieu_affectation:       toNullId(affectForm.idLieuAffectation),
        id_destinataire:           toNullId(affectForm.idDestinataire),
        etat:                      affectForm.etat,
        observation:               affectForm.observation,
        date_derniere_affectation: affectForm.dateDerniereAffectation || null,
      },
    });
  }

  // ── Local styles ──────────────────────────────────────────────────────────
  const overlay     = { position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', padding: 16 };
  const panel       = { width: 'min(520px, 96vw)', background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 24px 64px rgba(15,23,42,0.20)', padding: 24, maxHeight: '90vh', overflowY: 'auto' };
  const modalHead   = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 };
  const mTitle      = { fontSize: 16, fontWeight: 800, color: '#0f172a' };
  const errBox      = { marginBottom: 12, color: '#dc2626', fontSize: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px' };
  const modalFooter = { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 };
  const closeBtn    = { ...iconBtn, width: 32, height: 32, borderRadius: 8, border: '1px solid #e2e8f0' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Search ── */}
      <div style={{ position: 'relative', maxWidth: 420 }}>
        <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par N° inventaire ou article"
          style={{ width: '100%', boxSizing: 'border-box', padding: '9px 14px 9px 36px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', fontSize: 13, outline: 'none' }}
        />
      </div>

      {/* ── Statut filter chips ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {SUIVI_STATUT_OPTS.map((opt) => (
          <button key={opt.key} type="button" onClick={() => setStatutFilter(opt.key)} style={{
            padding: '5px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid',
            borderColor: statutFilter === opt.key ? '#0C447C' : '#e2e8f0',
            background:  statutFilter === opt.key ? '#E6F1FB'  : '#fff',
            color:       statutFilter === opt.key ? '#0C447C'  : '#64748b',
          }}>{opt.label}</button>
        ))}
      </div>

      {/* ── Table ── */}
      <div style={WORKSPACE_TABLE_STYLE}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 }}>
          <thead>
            <tr>
              {['N° inventaire', 'Article', 'Statut', "Type d'affectation", 'Bâtiment', 'Service', 'Bénéficiaire', 'Dernière affectation', 'Actions'].map((h) => (
                <th key={h} style={TABLE_HEADER_CELL_STYLE}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {instQ.isLoading ? (
              <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>Chargement…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>Aucune instance trouvée.</td></tr>
            ) : paginated.map((instance) => {
              const instId       = instance.idInstance       ?? instance.id_instance;
              const ressource    = instance.ressource        ?? {};
              const numInv       = instance.numeroInventaire ?? instance.numero_inventaire ?? '—';
              const dateDerniere = instance.dateDerniereAffectation ?? instance.date_derniere_affectation;
              const cfg          = STATUT_BADGE_CFG[instance.statut] ?? { bg: '#f1f5f9', color: '#64748b', label: instance.statut ?? '—' };
              const svcObj  = instance.serviceActuel  ?? instance.service_actuel  ?? {};
              const batObj  = svcObj.idBatiment      ?? svcObj.id_batiment      ?? {};
              const batNom  = batObj.nom ?? '—';
              const svcNom  = svcObj.nomService       ?? svcObj.nom_service      ?? '—';
              const destObj = instance.destinataire   ?? {};
              const destNom = destObj.nom ?? '—';
              const typeAff      = instance.typeAffectation   ?? instance.type_affectation;
              const typeAffCfg   = typeAff === 'nouvelle_affectation'
                ? { label: 'Nouvelle affectation', bg: '#ecfdf3', color: '#027A48' }
                : typeAff === 'reaffectation'
                ? { label: 'Réaffectation',        bg: '#EEEDFE', color: '#3C3489' }
                : null;
              return (
                <tr key={instId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ ...TABLE_CELL_STYLE, fontWeight: 700, color: '#0f172a' }}>{numInv}</td>
                  <td style={TABLE_CELL_STYLE}>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{ressource.designation ?? '—'}</div>
                    {ressource.marque && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{ressource.marque}</div>}
                  </td>
                  <td style={TABLE_CELL_STYLE}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, background: cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 700 }}>
                      <span style={{ width: 5, height: 5, borderRadius: 999, background: 'currentColor' }} />
                      {cfg.label}
                    </span>
                  </td>
                  <td style={TABLE_CELL_STYLE}>
                    {typeAffCfg
                      ? <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, background: typeAffCfg.bg, color: typeAffCfg.color, fontSize: 11, fontWeight: 700 }}>{typeAffCfg.label}</span>
                      : <span style={{ color: '#94a3b8' }}>—</span>
                    }
                  </td>
                  <td style={{ ...TABLE_CELL_STYLE, color: '#475569' }}>{batNom}</td>
                  <td style={{ ...TABLE_CELL_STYLE, color: '#475569' }}>{svcNom}</td>
                  <td style={{ ...TABLE_CELL_STYLE, color: '#475569' }}>{destNom}</td>
                  <td style={{ ...TABLE_CELL_STYLE, color: '#64748b', whiteSpace: 'nowrap' }}>{formatInstanceDate(dateDerniere)}</td>
                  <td style={{ ...TABLE_CELL_STYLE, whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <button type="button" title="Affecter / Réaffecter" onClick={() => openAffect(instance)} style={iconBtn}>
                        <Edit2 size={14} color="#64748b" />
                      </button>
                      <button type="button" title="Historique des mouvements" onClick={() => setHistModal(instance)} style={iconBtn}>
                        <Clock size={14} color="#64748b" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ ...TOOLBAR_BUTTON_STYLE, padding: '6px 14px' }}>←</button>
          <span style={{ fontSize: 13, color: '#64748b' }}>{currentPage} / {totalPages}</span>
          <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} style={{ ...TOOLBAR_BUTTON_STYLE, padding: '6px 14px' }}>→</button>
        </div>
      )}

      {/* ── Modal : Affecter / Réaffecter ── */}
      {affectModal && (
        <div style={overlay} onClick={() => setAffectModal(null)}>
          <div style={panel} onClick={(e) => e.stopPropagation()}>
            <div style={modalHead}>
              <span style={mTitle}>Affecter / Réaffecter</span>
              <button type="button" onClick={() => setAffectModal(null)} style={closeBtn}><X size={15} color="#475569" /></button>
            </div>
            <div style={{ marginBottom: 16, padding: '10px 14px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{affectModal.ressource?.designation ?? '—'}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>N° {affectModal.numeroInventaire ?? affectModal.numero_inventaire ?? '—'}</div>
            </div>
            {affectErr && <div style={errBox}>{affectErr}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={labelStyle}>
                Statut
                <select value={affectForm.statut} onChange={(e) => setAffectForm((f) => ({ ...f, statut: e.target.value }))} style={inputStyle}>
                  <option value="en_stock">En stock</option>
                  <option value="en_service">En service</option>
                  <option value="en_maintenance">En maintenance</option>
                </select>
              </label>
              <label style={labelStyle}>
                Service
                <select value={affectForm.idServiceActuel} onChange={(e) => setAffectForm((f) => ({ ...f, idServiceActuel: e.target.value }))} style={inputStyle}>
                  <option value="">— Aucun —</option>
                  {services.map((svc) => {
                    const id = svc.idService ?? svc.id_service;
                    return <option key={id} value={id}>{svc.nomService ?? svc.nom_service}</option>;
                  })}
                </select>
              </label>
              <label style={labelStyle}>
                Établissement
                <select value={affectForm.idLieuAffectation} onChange={(e) => setAffectForm((f) => ({ ...f, idLieuAffectation: e.target.value }))} style={inputStyle}>
                  <option value="">— Aucun —</option>
                  {etabs.map((et) => {
                    const id = et.idEtablissement ?? et.id_etablissement;
                    return <option key={id} value={id}>{et.nom}</option>;
                  })}
                </select>
              </label>
              <label style={labelStyle}>
                Destinataire (optionnel)
                <select value={affectForm.idDestinataire} onChange={(e) => setAffectForm((f) => ({ ...f, idDestinataire: e.target.value }))} style={inputStyle}>
                  <option value="">— Aucun —</option>
                  {beneficiaires.map((b) => {
                    const id = b.idBeneficiaire ?? b.id_beneficiaire;
                    return <option key={id} value={id}>{b.nom}</option>;
                  })}
                </select>
              </label>
              <label style={labelStyle}>
                État
                <select value={affectForm.etat} onChange={(e) => setAffectForm((f) => ({ ...f, etat: e.target.value }))} style={inputStyle}>
                  {ETAT_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
              <label style={labelStyle}>
                Observation
                <textarea value={affectForm.observation} onChange={(e) => setAffectForm((f) => ({ ...f, observation: e.target.value }))} style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }} placeholder="Notes complémentaires…" />
              </label>
              <label style={labelStyle}>
                Date d'affectation
                <input type="date" value={affectForm.dateDerniereAffectation} onChange={(e) => setAffectForm((f) => ({ ...f, dateDerniereAffectation: e.target.value }))} style={inputStyle} />
              </label>
            </div>
            <div style={modalFooter}>
              <button type="button" onClick={() => setAffectModal(null)} style={TOOLBAR_BUTTON_STYLE}>Annuler</button>
              <button type="button" onClick={submitAffect} disabled={affectM.isPending} style={{ ...PRIMARY_TOOLBAR_BUTTON_STYLE, opacity: affectM.isPending ? 0.7 : 1 }}>
                {affectM.isPending ? 'Enregistrement…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal : Historique ── */}
      {histModal && (
        <div style={overlay} onClick={() => setHistModal(null)}>
          <div style={{ ...panel, width: 'min(580px, 96vw)' }} onClick={(e) => e.stopPropagation()}>
            <div style={modalHead}>
              <div>
                <div style={mTitle}>Historique des mouvements</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
                  {histModal.ressource?.designation ?? '—'} — N° {histModal.numeroInventaire ?? histModal.numero_inventaire ?? '—'}
                </div>
              </div>
              <button type="button" onClick={() => setHistModal(null)} style={closeBtn}><X size={15} color="#475569" /></button>
            </div>
            {histQ.isLoading ? (
              <p style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>Chargement…</p>
            ) : mouvements.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>Aucun mouvement enregistré pour cette instance.</p>
            ) : (
              <div style={{ position: 'relative', paddingLeft: 28, marginTop: 8 }}>
                <div style={{ position: 'absolute', left: 10, top: 6, bottom: 6, width: 2, background: '#e2e8f0', borderRadius: 1 }} />
                {mouvements.map((m, idx) => {
                  const typeKey = m.typeMouvement ?? m.type_mouvement;
                  const mCfg   = MOUV_BADGE_CFG[typeKey] ?? { bg: '#f1f5f9', color: '#64748b', label: typeKey ?? '—' };
                  const dateStr = formatInstanceDate(m.dateMouvement ?? m.date_mouvement);
                  const ref  = m.reference;
                  const lieu = m.lieuAffectation        ?? m.lieu_affectation;
                  const svc  = m.serviceAffectation      ?? m.service_affectation;
                  const dest = m.destinataireAffectation ?? m.destinataire_affectation;
                  return (
                    <div key={m.idMouvement ?? m.id_mouvement ?? idx} style={{ position: 'relative', marginBottom: 16 }}>
                      <div style={{ position: 'absolute', left: -22, top: 4, width: 10, height: 10, borderRadius: 999, background: mCfg.color, border: '2px solid #fff', boxShadow: `0 0 0 2px ${mCfg.color}40` }} />
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, background: mCfg.bg, color: mCfg.color, fontSize: 11, fontWeight: 700 }}>{mCfg.label}</span>
                          <span style={{ fontSize: 12, color: '#64748b' }}>{dateStr}</span>
                          {ref && <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto' }}>Réf. {ref}</span>}
                        </div>
                        {(svc || lieu || dest) && (
                          <div style={{ marginTop: 6, fontSize: 12, color: '#475569', display: 'flex', flexWrap: 'wrap', gap: '3px 16px' }}>
                            {svc  && <span>Service : {svc}</span>}
                            {lieu && <span>Lieu : {lieu}</span>}
                            {dest && <span>Destinataire : {dest}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Débarras tab
// ─────────────────────────────────────────────────────────────────────────────

function DebarrasTab({ queryClient }) {
  const [modal,          setModal]          = useState(false);
  const [form,           setForm]           = useState({ idInstance: '', idRessource: '', motif: 'panne', justification: '' });
  const [formErr,        setFormErr]        = useState('');
  const [instanceSearch, setInstanceSearch] = useState('');

  const allInstQ = useQuery({ queryKey: ['resources', 'instances', 'all'], queryFn: () => getInstances(), staleTime: 30_000 });
  const rebutsQ  = useQuery({ queryKey: ['returns', 'retours'],            queryFn: () => getRetours(),   staleTime: 30_000 });

  const allInstances = allInstQ.data?.data?.results ?? allInstQ.data?.data ?? [];
  const allRetours   = rebutsQ.data?.data?.results  ?? rebutsQ.data?.data  ?? [];

  const pendingInstanceIds = useMemo(() => {
    const ids = new Set();
    allRetours.forEach((r) => {
      if (r.statut === 'en_attente') {
        const id = r.idInstanceRessource ?? r.id_instance_ressource;
        if (id != null) ids.add(String(id));
      }
    });
    return ids;
  }, [allRetours]);

  const activeInstances = useMemo(
    () => allInstances.filter((i) => {
      if (i.statut === 'debarras') return false;
      return !pendingInstanceIds.has(String(i.idInstance ?? i.id_instance ?? ''));
    }),
    [allInstances, pendingInstanceIds],
  );
  const archive = useMemo(() => allRetours.filter((r) => r.decision === 'debarras'), [allRetours]);

  const filteredInstances = useMemo(() => {
    if (!instanceSearch.trim()) return activeInstances;
    const q = normalizeText(instanceSearch);
    return activeInstances.filter((i) =>
      normalizeText(i.numeroInventaire ?? i.numero_inventaire ?? '').includes(q) ||
      normalizeText(i.ressource?.designation ?? '').includes(q),
    );
  }, [activeInstances, instanceSearch]);

  const debarrasM = useMutation({
    mutationFn: async ({ idInstance, idRessource, motif, justification }) => {
      const res = await createRetour({
        id_instance_ressource: Number(idInstance),
        id_ressource:          Number(idRessource),
        motif_retour:          motif,
      });
      const retourId = res.data.idRetour ?? res.data.id_retour;
      await updateDecision(retourId, { decision: 'debarras', justification_decision: justification || '' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources', 'instances'] });
      queryClient.invalidateQueries({ queryKey: ['returns', 'retours'] });
      queryClient.invalidateQueries({ queryKey: ['resources', 'instances', { statut: 'debarras' }] });
      closeModal();
    },
    onError: () => setFormErr('Erreur lors du débarras. Veuillez réessayer.'),
  });

  function openModal() {
    setForm({ idInstance: '', idRessource: '', motif: 'panne', justification: '' });
    setFormErr(''); setInstanceSearch(''); setModal(true);
  }
  function closeModal() { setModal(false); setFormErr(''); }
  function selectInstance(inst) {
    setForm((f) => ({ ...f, idInstance: String(inst.idInstance ?? inst.id_instance ?? ''), idRessource: String(inst.idRessource ?? inst.id_ressource ?? '') }));
  }
  function submitDebarras() {
    if (!form.idInstance) { setFormErr('Veuillez sélectionner un article.'); return; }
    setFormErr('');
    debarrasM.mutate({ idInstance: form.idInstance, idRessource: form.idRessource, motif: form.motif, justification: form.justification });
  }

  const overlay    = { position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', padding: 16 };
  const panel      = { width: 'min(540px, 96vw)', background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 24px 64px rgba(15,23,42,0.20)', padding: 24, maxHeight: '90vh', overflowY: 'auto' };
  const mHead      = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 };
  const mTitle     = { fontSize: 16, fontWeight: 800, color: '#0f172a' };
  const errBox     = { marginBottom: 12, color: '#dc2626', fontSize: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px' };
  const mFooter    = { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 };
  const closeBtn   = { ...iconBtn, width: 32, height: 32, borderRadius: 8, border: '1px solid #e2e8f0' };
  const labelStyle = { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 13, fontWeight: 600, color: '#374151' };
  const inputStyle = { border: '1px solid #cbd5e1', borderRadius: 8, padding: '8px 11px', fontSize: 13, outline: 'none', background: '#fff' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Warning banner */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10 }}>
        <AlertTriangle size={16} color="#92400e" style={{ flexShrink: 0, marginTop: 1 }} />
        <span style={{ fontSize: 13, color: '#92400e' }}>Les articles débarrassés restent visibles à titre d'archive et ne comptent plus dans le stock actif.</span>
      </div>

      {/* Section 1 */}
      <div style={WORKSPACE_PANEL_STYLE}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Procéder au débarras</span>
          <button type="button" onClick={openModal} style={PRIMARY_TOOLBAR_BUTTON_STYLE}><Plus size={15} /> Nouveau débarras</button>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>Sélectionnez un article actif et définissez un motif pour le retirer définitivement du stock.</p>
      </div>

      {/* Section 2 — Archive */}
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>Archive des articles débarrassés</div>
        <div style={WORKSPACE_TABLE_STYLE}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 }}>
            <thead>
              <tr>{['N° inventaire', 'Article', 'Date de retour', 'Motif', 'Justification'].map((h) => <th key={h} style={TABLE_HEADER_CELL_STYLE}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {rebutsQ.isLoading ? (
                <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>Chargement…</td></tr>
              ) : archive.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>Aucun article débarrassé pour l'instant.</td></tr>
              ) : archive.map((retour) => {
                const retourId  = retour.idRetour    ?? retour.id_retour;
                const inst      = retour.instanceRessource ?? retour.instance_ressource ?? {};
                const res       = retour.ressource   ?? {};
                const justification = retour.justificationDecision ?? retour.justification_decision;
                const motifKey  = retour.motifRetour ?? retour.motif_retour;
                return (
                  <tr key={retourId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ ...TABLE_CELL_STYLE, fontWeight: 700, color: '#0f172a' }}>{inst.numeroInventaire ?? inst.numero_inventaire ?? '—'}</td>
                    <td style={TABLE_CELL_STYLE}>{res.designation ?? '—'}</td>
                    <td style={{ ...TABLE_CELL_STYLE, color: '#64748b', whiteSpace: 'nowrap' }}>{formatInstanceDate(retour.dateRetour ?? retour.date_retour)}</td>
                    <td style={TABLE_CELL_STYLE}>
                      <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, background: '#FEF3C7', color: '#92400E', fontSize: 11, fontWeight: 700 }}>
                        {MOTIF_LABEL[motifKey] ?? motifKey ?? '—'}
                      </span>
                    </td>
                    <td style={{ ...TABLE_CELL_STYLE, color: '#475569', fontStyle: justification ? 'italic' : 'normal' }}>{justification || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div style={overlay} onClick={closeModal}>
          <div style={panel} onClick={(e) => e.stopPropagation()}>
            <div style={mHead}>
              <span style={mTitle}>Nouveau débarras</span>
              <button type="button" onClick={closeModal} style={closeBtn}><X size={15} color="#475569" /></button>
            </div>
            {formErr && <div style={errBox}>{formErr}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Searchable instance picker */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Article</span>
                <div style={{ border: '1px solid #cbd5e1', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ padding: '8px 10px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', position: 'relative' }}>
                    <Search size={13} color="#94a3b8" style={{ position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    <input value={instanceSearch} onChange={(e) => setInstanceSearch(e.target.value)} placeholder="Rechercher N° inventaire ou article…"
                      style={{ width: '100%', boxSizing: 'border-box', paddingLeft: 26, paddingRight: 8, paddingTop: 6, paddingBottom: 6, border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, outline: 'none', background: '#fff' }} />
                  </div>
                  <div style={{ maxHeight: 190, overflowY: 'auto' }}>
                    {allInstQ.isLoading ? (
                      <div style={{ padding: 16, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>Chargement…</div>
                    ) : filteredInstances.length === 0 ? (
                      <div style={{ padding: 16, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>Aucun article trouvé.</div>
                    ) : filteredInstances.slice(0, 60).map((inst) => {
                      const id = inst.idInstance ?? inst.id_instance;
                      const selected = form.idInstance === String(id);
                      const sCfg = STATUT_BADGE_CFG[inst.statut] ?? { bg: '#f1f5f9', color: '#64748b', label: inst.statut };
                      return (
                        <div key={id} onClick={() => selectInstance(inst)}
                          style={{ padding: '9px 14px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', background: selected ? '#E6F1FB' : 'transparent', display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontWeight: 700, fontSize: 12, color: '#0f172a', minWidth: 90, flexShrink: 0 }}>{inst.numeroInventaire ?? inst.numero_inventaire ?? '—'}</span>
                          <span style={{ fontSize: 12, color: '#475569', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inst.ressource?.designation ?? '—'}</span>
                          <span style={{ padding: '2px 8px', borderRadius: 999, background: sCfg.bg, color: sCfg.color, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{sCfg.label}</span>
                          {selected && <span style={{ color: '#0C447C', fontSize: 13, fontWeight: 900, flexShrink: 0 }}>✓</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Motif */}
              <label style={labelStyle}>
                Motif du débarras
                <select value={form.motif} onChange={(e) => setForm((f) => ({ ...f, motif: e.target.value }))} style={inputStyle}>
                  {MOTIF_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>

              {/* Justification */}
              <label style={labelStyle}>
                Justification <span style={{ fontWeight: 400, color: '#94a3b8' }}>(optionnel)</span>
                <textarea value={form.justification} onChange={(e) => setForm((f) => ({ ...f, justification: e.target.value }))}
                  placeholder="Précisions complémentaires…" style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }} />
              </label>
            </div>

            <div style={mFooter}>
              <button type="button" onClick={closeModal} style={TOOLBAR_BUTTON_STYLE}>Annuler</button>
              <button type="button" onClick={submitDebarras} disabled={debarrasM.isPending}
                style={{ ...PRIMARY_TOOLBAR_BUTTON_STYLE, background: '#dc2626', opacity: debarrasM.isPending ? 0.7 : 1 }}>
                {debarrasM.isPending ? 'Traitement…' : 'Confirmer le débarras'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
