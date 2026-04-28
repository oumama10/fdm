import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Pencil, Plus, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';

import {
  createCategory,
  createSousCategory,
  deleteCategory,
  deleteSousCategory,
  getCategories,
  getSousCategories,
  updateCategory,
  updateSousCategory,
} from '../../api/resources';

const CATEGORY_OPTIONS = [
  { value: 'Consommable', label: 'Consommable' },
  { value: 'Bien Inventaire', label: 'Bien Inventaire' },
];

function ModalShell({ title, children, onClose }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.35)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 90,
        padding: 14,
      }}
      onClick={onClose}
    >
      <div
        className="section-shell"
        style={{ width: 'min(560px, 100%)', margin: 0 }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button type="button" className="btn btn-secondary" onClick={onClose} style={{ padding: 6 }}>
            <X size={14} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function AdminCategoriesPage() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [expandedCat, setExpandedCat] = useState(null);

  const [showSubModal, setShowSubModal] = useState(false);
  const [editingSub, setEditingSub] = useState(null);
  const [activeCategoryForSub, setActiveCategoryForSub] = useState(null);

  const [categoryForm, setCategoryForm] = useState({
    nom_categorie: 'Consommable',
    description: '',
    actif: true,
  });

  const [subForm, setSubForm] = useState({
    nom_sous_categorie: '',
    description: '',
  });

  const categoriesQuery = useQuery({
    queryKey: ['resources', 'categories'],
    queryFn: getCategories,
    staleTime: 30000,
  });

  const sousCategoriesQuery = useQuery({
    queryKey: ['resources', 'sous-categories'],
    queryFn: () => getSousCategories(),
    staleTime: 30000,
  });

  const categories = useMemo(() => {
    const categoriesRows = categoriesQuery.data?.data || [];
    const subRows = sousCategoriesQuery.data?.data || [];

    return categoriesRows.map((cat) => {
      const catId = cat.id_categorie;
      return {
        ...cat,
        sous_categories: subRows.filter((sub) => String(sub.id_categorie) === String(catId)),
      };
    });
  }, [categoriesQuery.data?.data, sousCategoriesQuery.data?.data]);

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['resources', 'categories'] });
    queryClient.invalidateQueries({ queryKey: ['resources', 'sous-categories'] });
  };

  const createCategoryMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      toast.success('Catégorie créée.');
      setShowCreateModal(false);
      setCategoryForm({ nom_categorie: 'Consommable', description: '', actif: true });
      refreshAll();
    },
    onError: () => toast.error('Création catégorie impossible.'),
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, payload }) => updateCategory(id, payload),
    onSuccess: () => {
      toast.success('Catégorie modifiée.');
      setEditingCat(null);
      refreshAll();
    },
    onError: () => toast.error('Modification catégorie impossible.'),
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      toast.success('Catégorie supprimée.');
      refreshAll();
    },
    onError: () => toast.error('Suppression catégorie impossible.'),
  });

  const createSubMutation = useMutation({
    mutationFn: createSousCategory,
    onSuccess: () => {
      toast.success('Sous-catégorie créée.');
      setShowSubModal(false);
      setSubForm({ nom_sous_categorie: '', description: '' });
      setActiveCategoryForSub(null);
      refreshAll();
    },
    onError: () => toast.error('Création sous-catégorie impossible.'),
  });

  const updateSubMutation = useMutation({
    mutationFn: ({ id, payload }) => updateSousCategory(id, payload),
    onSuccess: () => {
      toast.success('Sous-catégorie modifiée.');
      setShowSubModal(false);
      setEditingSub(null);
      setSubForm({ nom_sous_categorie: '', description: '' });
      setActiveCategoryForSub(null);
      refreshAll();
    },
    onError: () => toast.error('Modification sous-catégorie impossible.'),
  });

  const deleteSubMutation = useMutation({
    mutationFn: deleteSousCategory,
    onSuccess: () => {
      toast.success('Sous-catégorie supprimée.');
      refreshAll();
    },
    onError: () => toast.error('Suppression sous-catégorie impossible.'),
  });

  const handleDeleteCat = (categoryId) => {
    if (!window.confirm('Supprimer cette catégorie ?')) return;
    deleteCategoryMutation.mutate(categoryId);
  };

  const handleDeleteSub = (subCategoryId) => {
    if (!window.confirm('Supprimer cette sous-catégorie ?')) return;
    deleteSubMutation.mutate(subCategoryId);
  };

  const handleEditCategory = (cat) => {
    setEditingCat(cat);
    setCategoryForm({
      nom_categorie: cat.nom_categorie || 'Consommable',
      description: cat.description || '',
      actif: Boolean(cat.actif),
    });
    setShowCreateModal(false);
  };

  const handleAddSub = (categoryId) => {
    setActiveCategoryForSub(categoryId);
    setEditingSub(null);
    setSubForm({ nom_sous_categorie: '', description: '' });
    setShowSubModal(true);
  };

  const handleEditSub = (sub) => {
    setEditingSub(sub);
    setActiveCategoryForSub(sub.id_categorie);
    setSubForm({
      nom_sous_categorie: sub.nom_sous_categorie || '',
      description: sub.description || '',
    });
    setShowSubModal(true);
  };

  const submitCategory = (event) => {
    event.preventDefault();
    const payload = {
      nom_categorie: categoryForm.nom_categorie,
      description: (categoryForm.description || '').trim(),
      actif: Boolean(categoryForm.actif),
    };

    if (editingCat?.id_categorie) {
      updateCategoryMutation.mutate({ id: editingCat.id_categorie, payload });
      return;
    }

    createCategoryMutation.mutate(payload);
  };

  const submitSubCategory = (event) => {
    event.preventDefault();
    if (!activeCategoryForSub) {
      toast.error('Catégorie parente manquante.');
      return;
    }
    if (!subForm.nom_sous_categorie.trim()) {
      toast.error('Nom de sous-catégorie requis.');
      return;
    }

    const payload = {
      nom_sous_categorie: subForm.nom_sous_categorie.trim(),
      description: (subForm.description || '').trim(),
      id_categorie: activeCategoryForSub,
    };

    if (editingSub?.id_sous_categorie) {
      updateSubMutation.mutate({ id: editingSub.id_sous_categorie, payload });
      return;
    }

    createSubMutation.mutate(payload);
  };

  return (
    <div className="page-stack">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Catégories & Sous-catégories</h1>
          <p className="text-[12px] text-black/40 mt-1">
            Gérez la hiérarchie des articles du magasin
          </p>
        </div>
        <button
          onClick={() => {
            setEditingCat(null);
            setCategoryForm({ nom_categorie: 'Consommable', description: '', actif: true });
            setShowCreateModal(true);
          }}
          className="btn btn-primary"
          type="button"
        >
          + Nouvelle catégorie
        </button>
      </div>

      {categoriesQuery.isLoading ? (
        <div className="section-shell">Chargement...</div>
      ) : categories.length === 0 ? (
        <div className="section-shell">Aucune catégorie trouvée.</div>
      ) : (
        categories.map((cat) => (
          <div
            key={cat.id_categorie}
            className="bg-white rounded-2xl border border-black/[0.06] mb-3 overflow-hidden"
          >
            <div
              className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-surface transition-colors"
              onClick={() => setExpandedCat(expandedCat === cat.id_categorie ? null : cat.id_categorie)}
            >
              <div className="flex items-center gap-3">
                <ChevronRight
                  size={16}
                  className={`text-black/30 transition-transform ${expandedCat === cat.id_categorie ? 'rotate-90' : ''}`}
                />
                <div>
                  <div className="font-medium text-ink text-[14px]">{cat.nom_categorie}</div>
                  <div className="text-[11px] text-black/40 mt-0.5">
                    {cat.sous_categories?.length ?? 0} sous-catégorie(s)
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    handleEditCategory(cat);
                  }}
                  className="ghost-btn text-xs px-2 py-1"
                  type="button"
                >
                  <Pencil size={12} />
                </button>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    handleDeleteCat(cat.id_categorie);
                  }}
                  className="ghost-btn text-xs px-2 py-1 text-red-500 hover:bg-red-50"
                  type="button"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>

            {expandedCat === cat.id_categorie && (
              <div className="border-t border-black/[0.05] px-5 py-3">
                {cat.sous_categories?.length ? (
                  cat.sous_categories.map((sub) => (
                    <div
                      key={sub.id_sous_categorie}
                      className="flex items-center justify-between py-2 border-b border-black/[0.04] last:border-0"
                    >
                      <span className="text-[13px] text-black/70">{sub.nom_sous_categorie}</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditSub(sub)}
                          className="ghost-btn text-xs px-2 py-1"
                          type="button"
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          onClick={() => handleDeleteSub(sub.id_sous_categorie)}
                          className="ghost-btn text-xs px-2 py-1 text-red-500 hover:bg-red-50"
                          type="button"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-[12px] text-black/45 py-2">Aucune sous-catégorie.</div>
                )}

                <button
                  onClick={() => handleAddSub(cat.id_categorie)}
                  className="mt-2 text-[12px] text-brand-700 hover:text-brand-900 flex items-center gap-1"
                  type="button"
                >
                  <Plus size={12} /> Ajouter une sous-catégorie
                </button>
              </div>
            )}
          </div>
        ))
      )}

      {(showCreateModal || editingCat) && (
        <ModalShell
          title={editingCat ? 'Modifier catégorie' : 'Nouvelle catégorie'}
          onClose={() => {
            setShowCreateModal(false);
            setEditingCat(null);
          }}
        >
          <form onSubmit={submitCategory} style={{ display: 'grid', gap: 10 }}>
            <label className="field-label">
              Nom catégorie
              <select
                className="field-input"
                value={categoryForm.nom_categorie}
                onChange={(event) => setCategoryForm((prev) => ({ ...prev, nom_categorie: event.target.value }))}
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="field-label">
              Description
              <textarea
                className="field-input"
                rows={3}
                value={categoryForm.description}
                onChange={(event) => setCategoryForm((prev) => ({ ...prev, description: event.target.value }))}
              />
            </label>

            <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={categoryForm.actif}
                onChange={(event) => setCategoryForm((prev) => ({ ...prev, actif: event.target.checked }))}
              />
              Active
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingCat(null);
                }}
              >
                Annuler
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending}
              >
                {editingCat ? 'Enregistrer' : 'Créer'}
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {showSubModal && (
        <ModalShell
          title={editingSub ? 'Modifier sous-catégorie' : 'Nouvelle sous-catégorie'}
          onClose={() => {
            setShowSubModal(false);
            setEditingSub(null);
            setActiveCategoryForSub(null);
          }}
        >
          <form onSubmit={submitSubCategory} style={{ display: 'grid', gap: 10 }}>
            <label className="field-label">
              Nom sous-catégorie
              <input
                className="field-input"
                value={subForm.nom_sous_categorie}
                onChange={(event) => setSubForm((prev) => ({ ...prev, nom_sous_categorie: event.target.value }))}
              />
            </label>

            <label className="field-label">
              Description
              <textarea
                className="field-input"
                rows={3}
                value={subForm.description}
                onChange={(event) => setSubForm((prev) => ({ ...prev, description: event.target.value }))}
              />
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setShowSubModal(false);
                  setEditingSub(null);
                  setActiveCategoryForSub(null);
                }}
              >
                Annuler
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={createSubMutation.isPending || updateSubMutation.isPending}
              >
                {editingSub ? 'Enregistrer' : 'Créer'}
              </button>
            </div>
          </form>
        </ModalShell>
      )}
    </div>
  );
}
