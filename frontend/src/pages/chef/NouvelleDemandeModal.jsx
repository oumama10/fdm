import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';

import { createDemande, getDemandeRequesterOptions } from '../../api/requests';
import { getCategories, getRessources, getSousCategories } from '../../api/resources';
import { getServices } from '../../api/users';
import { useAuthStore } from '../../store/authStore';

function pickValue(obj, keys, fallback = '') {
  if (!obj) return fallback;
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && `${value}`.trim() !== '') {
      return value;
    }
  }
  return fallback;
}

export default function NouvelleDemandeModal({ onClose, onCreated }) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const serviceId = user?.service?.id;
  const ONLY_ALLOWED_DEMANDEUR = 'Chef de service';

  const [urgence, setUrgence] = useState('');
  const [idService, setIdService] = useState(serviceId ? String(serviceId) : '');
  const [typeDemandeur, setTypeDemandeur] = useState('');
  const [beneficiaireType, setBeneficiaireType] = useState('');
  const [beneficiaireNom, setBeneficiaireNom] = useState('');
  const [beneficiaireDetail, setBeneficiaireDetail] = useState('');
  const [justification, setJustification] = useState('');
  const [typeArticle, setTypeArticle] = useState('');
  const [categorieId, setCategorieId] = useState('');
  const [sousCategorieId, setSousCategorieId] = useState('');
  const [selectedArticleId, setSelectedArticleId] = useState('');
  const [selectedQuantite, setSelectedQuantite] = useState(1);
  const [selectedItems, setSelectedItems] = useState([]);
  const [confirmation, setConfirmation] = useState(null);

  const servicesQuery = useQuery({
    queryKey: ['users', 'services', 'demandes'],
    queryFn: () => getServices(),
    staleTime: 60000,
  });

  const requesterOptionsQuery = useQuery({
    queryKey: ['requests', 'requester-options', idService],
    queryFn: () => getDemandeRequesterOptions(idService),
    enabled: Boolean(idService),
    staleTime: 60000,
  });

  const resourcesQuery = useQuery({
    queryKey: ['resources', 'ressources', 'demande-form', typeArticle, categorieId, sousCategorieId],
    queryFn: () => {
      const leafSousCategorieId = typeArticle === 'consommable' ? categorieId : sousCategorieId;
      return getRessources(leafSousCategorieId ? { id_sous_categorie: leafSousCategorieId } : {});
    },
    enabled: Boolean(typeArticle === 'consommable' ? categorieId : (categorieId && sousCategorieId)),
    staleTime: 60000,
  });

  const categoriesQuery = useQuery({
    queryKey: ['resources', 'categories', 'all'],
    queryFn: () => getCategories(),
    staleTime: 60000,
  });

  const submitMutation = useMutation({
    mutationFn: createDemande,
    onSuccess: (response) => {
      const created = response?.data;
      setConfirmation(created || null);
      onCreated?.(created);
    },
  });

  const resources = Array.isArray(resourcesQuery.data?.data)
    ? resourcesQuery.data.data
    : resourcesQuery.data?.data?.results || [];
  const allCategories = Array.isArray(categoriesQuery.data?.data)
    ? categoriesQuery.data.data
    : categoriesQuery.data?.data?.results || [];

  const parentCategorieId = useMemo(() => {
    if (!typeArticle || allCategories.length === 0) return null;

    const normalize = (value) =>
      String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    const match = allCategories.find((category) => {
      const name = normalize(pickValue(category, ['nom_categorie', 'nomCategorie'], ''));
      return typeArticle === 'consommable'
        ? name.includes('consommable')
        : name.includes('inventaire') || name.includes('bien');
    });

    return match ? String(pickValue(match, ['id_categorie', 'idCategorie', 'id'], '')) : null;
  }, [typeArticle, allCategories]);

  const sousCategoriesQuery = useQuery({
    queryKey: ['resources', 'sous-categories', 'demande-form', parentCategorieId, 'roots'],
    queryFn: async () => {
      console.log('Sending API call with parentCategorieId:', parentCategorieId, 'and roots_only: true');
      const res = await getSousCategories({ id_categorie: parentCategorieId, roots_only: 'true' });
      const items = res.data?.results || res.data;
      console.log('API returned:', items?.length, 'items', items?.map(s => s.nom_sous_categorie || s.nomSousCategorie));
      return res;
    },
    enabled: Boolean(parentCategorieId),
    staleTime: 60000,
  });

  const childSousCategoriesQuery = useQuery({
    queryKey: ['resources', 'sous-categories', 'demande-form', 'children', categorieId],
    queryFn: () => getSousCategories({ parent: categorieId }),
    enabled: Boolean(typeArticle === 'bien_inventaire' && categorieId),
    staleTime: 60000,
  });

  const services = servicesQuery.data?.data || [];
  const requesterOptions = requesterOptionsQuery.data?.data;

  useEffect(() => {
    if (!requesterOptions) return;

    const fetchedType = requesterOptions.type_demandeur || requesterOptions.typeDemandeur || '';
    setTypeDemandeur(fetchedType);

    setBeneficiaireType((prev) => {
      const types = requesterOptions.beneficiaire_types || requesterOptions.beneficiaireTypes || [];
      if (prev && types.includes(prev)) return prev;
      return types[0] || '';
    });
    setBeneficiaireNom(ONLY_ALLOWED_DEMANDEUR);
  }, [requesterOptions]);

  const categoriesFiltrees = useMemo(() => {
    const raw = Array.isArray(sousCategoriesQuery.data?.data)
      ? sousCategoriesQuery.data.data
      : sousCategoriesQuery.data?.data?.results || [];

    return raw
      .map((sousCategory) => ({
        id: String(pickValue(sousCategory, ['id_sous_categorie', 'idSousCategorie', 'id'], '')),
        name: pickValue(sousCategory, ['nom_sous_categorie', 'nomSousCategorie'], ''),
      }))
      .filter((sousCategory) => sousCategory.id && sousCategory.name);
  }, [sousCategoriesQuery.data]);

  const sousCategoriesFiltrees = useMemo(() => {
    const raw = Array.isArray(childSousCategoriesQuery.data?.data)
      ? childSousCategoriesQuery.data.data
      : childSousCategoriesQuery.data?.data?.results || [];

    return raw
      .map((sousCategory) => ({
        id: String(pickValue(sousCategory, ['id_sous_categorie', 'idSousCategorie', 'id'], '')),
        name: pickValue(sousCategory, ['nom_sous_categorie', 'nomSousCategorie'], ''),
      }))
      .filter((sousCategory) => sousCategory.id && sousCategory.name);
  }, [childSousCategoriesQuery.data]);

  const articleOptions = useMemo(() => resources, [resources]);

  function handleTypeChange(value) {
    setTypeArticle(value);
    setCategorieId('');
    setSousCategorieId('');
    setSelectedArticleId('');
    setSelectedQuantite(1);
  }

  function handleCategorieChange(value) {
    setCategorieId(value);
    setSousCategorieId('');
    setSelectedArticleId('');
    setSelectedQuantite(1);
  }

  function handleSousCategorieChange(value) {
    setSousCategorieId(value);
    setSelectedArticleId('');
    setSelectedQuantite(1);
  }

  function addResource(resource) {
    const resourceId = pickValue(resource, ['id_ressource', 'idRessource', 'id']);
    if (selectedItems.some((it) => Number(it.id_ressource) === Number(resourceId))) return;

    const catNom = resource.categorie ? pickValue(resource.categorie, ['nom_categorie', 'nomCategorie'], '') : '';
    const sousCatObj = resource.sous_categorie || resource.sousCategorie;
    const sousCatNom = sousCatObj ? pickValue(sousCatObj, ['nom_sous_categorie', 'nomSousCategorie'], '') : '';

    setSelectedItems((prev) => [
      ...prev,
      {
        id_ressource: resourceId,
        designation: resource.designation,
        description: resource.description || '',
        categorie: catNom || '—',
        sous_categorie: sousCatNom || '—',
        quantite_demandee: selectedQuantite,
      },
    ]);
    setSelectedQuantite(1);
  }

  function updateItemQuantity(id_ressource, newQuantity) {
    setSelectedItems((prev) =>
      prev.map((item) =>
        Number(item.id_ressource) === Number(id_ressource)
          ? { ...item, quantite_demandee: Math.max(1, newQuantity) }
          : item
      )
    );
  }

  function removeItem(id_ressource) {
    setSelectedItems((prev) => prev.filter((item) => Number(item.id_ressource) !== Number(id_ressource)));
  }

  async function submitDemande() {
    if (!idService || !beneficiaireNom || !urgence || selectedItems.length === 0) return;
    await submitMutation.mutateAsync({
      urgence,
      type_demandeur: typeDemandeur,
      beneficiaire_type: beneficiaireType,
      beneficiaire_nom: beneficiaireNom,
      beneficiaire_detail: beneficiaireDetail,
      justification,
      id_service: Number(idService),
      lignes: selectedItems.map((item) => ({
        id_ressource: Number(item.id_ressource),
        quantite_demandee: Number(item.quantite_demandee),
      })),
    });
  }

  function handleAjouterArticle() {
    if (!selectedArticleId) return;
    const row = articleOptions.find((item) => Number(pickValue(item, ['id_ressource', 'idRessource', 'id'])) === Number(selectedArticleId));
    if (!row) return;
    addResource(row);
    setSelectedArticleId('');
  }

  const servicesByType = useMemo(() => {
    const groups = new Map();
    services.forEach((svc) => {
      const key = svc.type_service || 'autre';
      const current = groups.get(key) || [];
      current.push(svc);
      groups.set(key, current);
    });
    return groups;
  }, [services]);

  const canSubmit = Boolean(
    idService && typeDemandeur && beneficiaireType && beneficiaireNom && urgence && selectedItems.length > 0
  );

  const canShowArticleSelect =
    typeArticle === 'consommable'
      ? Boolean(categorieId)
      : Boolean(categorieId && sousCategorieId);

  return (
    <div style={backdropStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(event) => event.stopPropagation()}>
        <h3 style={titleStyle}>Formulaire de demande de Fourniture/Équipement</h3>
        <div style={titleSeparatorStyle} />

        {confirmation ? (
          <div style={{ display: 'grid', gap: 16, padding: '8px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 28 }}>✅</span>
              <div>
                <div style={{ color: '#166534', fontWeight: 700, fontSize: 16 }}>
                  Votre demande a été soumise avec succès
                </div>
                <div style={{ color: '#374151', fontSize: 14, marginTop: 2 }}>
                  Référence :{' '}
                  <strong>
                    DEM-{new Date().getFullYear()}-{String(confirmation.id_demande).padStart(4, '0')}
                  </strong>
                </div>
              </div>
            </div>
            <div style={{ color: '#4b5563', fontSize: 14, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '10px 14px' }}>
              Votre demande est en cours de traitement. Vous pouvez suivre son évolution depuis votre espace.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                style={secondaryButton}
                onClick={() => { onClose(); navigate(`/chef/demandes/${confirmation.id_demande}`); }}
              >
                Suivre ma demande
              </button>
              <button style={primaryButton} onClick={onClose}>Fermer</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={gridTwoColumnsStyle}>
              <label style={labelStyle}>
                Date
                <div style={inputStyle}>{new Date().toLocaleDateString('fr-FR')}</div>
              </label>

              <label style={labelStyle}>
                Demandeur
                <select
                  style={inputStyle}
                  value={beneficiaireNom}
                  onChange={(e) => setBeneficiaireNom(e.target.value)}
                  disabled
                >
                  <option value={ONLY_ALLOWED_DEMANDEUR}>{ONLY_ALLOWED_DEMANDEUR}</option>
                </select>
              </label>
            </div>

            <div style={{ ...labelStyle, gap: 8 }}>
              <span>Type d'article</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { value: 'consommable', label: 'Consommable' },
                  { value: 'bien_inventaire', label: 'Bien inventaire' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleTypeChange(option.value)}
                    style={
                      typeArticle === option.value
                        ? activeTypeButtonStyle
                        : typeButtonStyle
                    }
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {typeArticle ? (
              <div style={gridTwoColumnsStyle}>
                <label style={labelStyle}>
                  Catégorie
                  <select
                    style={inputStyle}
                    value={categorieId}
                    onChange={(e) => handleCategorieChange(e.target.value)}
                  >
                    <option value="">Sélectionner une catégorie</option>
                    {categoriesFiltrees.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </label>

                {typeArticle === 'bien_inventaire' ? (
                  <label style={labelStyle}>
                    Sous-Catégorie
                    <select
                      style={inputStyle}
                      value={sousCategorieId}
                      onChange={(e) => handleSousCategorieChange(e.target.value)}
                      disabled={!categorieId}
                    >
                      <option value="">Sélectionner une sous-catégorie</option>
                      {sousCategoriesFiltrees.map((sousCategory) => (
                        <option key={sousCategory.id} value={sousCategory.id}>{sousCategory.name}</option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
            ) : null}

            {canShowArticleSelect ? (
              <div style={labelStyle}>
                <span>Articles</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px auto', gap: 10 }}>
                  <select
                    style={inputStyle}
                    value={selectedArticleId}
                    onChange={(e) => setSelectedArticleId(e.target.value)}
                    disabled={resourcesQuery.isLoading || articleOptions.length === 0}
                  >
                    <option value="">Sélectionner un article</option>
                    {articleOptions.map((row) => {
                      const rId = pickValue(row, ['id_ressource', 'idRessource', 'id']);
                      return (
                        <option key={rId} value={rId}>
                          {row.designation}
                        </option>
                      );
                    })}
                  </select>
                  <input
                    type="number"
                    min="1"
                    style={inputStyle}
                    title="Quantité"
                    placeholder="Qté"
                    value={selectedQuantite}
                    onChange={(e) => setSelectedQuantite(Math.max(1, parseInt(e.target.value) || 1))}
                    disabled={!selectedArticleId}
                  />
                  <button
                    type="button"
                    style={addButtonStyle}
                    onClick={handleAjouterArticle}
                    disabled={!selectedArticleId}
                  >
                    + Ajouter
                  </button>
                </div>
                {!resourcesQuery.isLoading && articleOptions.length === 0 ? (
                  <div style={{ fontSize: 13, color: '#6b7280' }}>
                    Aucun article disponible dans cette catégorie.
                  </div>
                ) : null}
              </div>
            ) : null}

            <div style={selectedBoxStyle}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#20344f', marginBottom: 8 }}>Articles sélectionnés</div>
              {selectedItems.length === 0 ? (
                <div style={{ color: '#374151' }}>Aucun article sélectionné</div>
              ) : (
                <div style={{ display: 'grid', gap: 6 }}>
                  {selectedItems.map((item) => (
                    <div key={item.id_ressource} style={selectedItemRowStyle}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, color: '#111827', fontSize: 16 }}>
                          {item.designation}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 14, color: '#4b5563', fontWeight: 600 }}>Qté:</span>
                          <input
                            type="number"
                            min="1"
                            style={{ ...inputStyle, width: 70, minHeight: 36, padding: '4px 8px', textAlign: 'center' }}
                            value={item.quantite_demandee}
                            onChange={(e) => updateItemQuantity(item.id_ressource, parseInt(e.target.value) || 1)}
                          />
                        </div>
                        <button style={dangerGhostButton} onClick={() => removeItem(item.id_ressource)}>
                          Retirer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <label style={labelStyle}>
              Justificatif / Commentaire
              <textarea
                rows={4}
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                style={textareaStyle}
                placeholder="Veuillez fournir une justification ou des commentaires supplémentaires..."
              />
            </label>

            <label style={{ ...labelStyle, maxWidth: 480 }}>
              Urgence
              <select style={inputStyle} value={urgence} onChange={(e) => setUrgence(e.target.value)}>
                <option value="">Sélectionner le niveau d'urgence</option>
                <option value="normal">normal</option>
                <option value="moyen">moyen</option>
                <option value="urgent">urgent</option>
              </select>
            </label>

            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4, gap: 10 }}>
              <button style={secondaryButton} onClick={onClose}>Annuler</button>
              <button
                style={{
                  ...submitButtonStyle,
                  opacity: (submitMutation.isPending || !canSubmit) ? 0.5 : 1,
                  cursor: (submitMutation.isPending || !canSubmit) ? 'not-allowed' : 'pointer'
                }}
                onClick={submitDemande}
                disabled={submitMutation.isPending || !canSubmit}
              >
                {submitMutation.isPending ? 'Envoi...' : '✈ Envoyer'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const backdropStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(17,24,39,0.45)',
  display: 'grid',
  placeItems: 'center',
  padding: 20,
  zIndex: 90,
};

const modalStyle = {
  width: 'min(960px, 88vw)',
  background: '#fff',
  borderRadius: 8,
  padding: 22,
  maxHeight: '88vh',
  overflowY: 'auto',
};

const titleStyle = {
  margin: 0,
  textAlign: 'center',
  color: '#20344f',
  fontSize: 22,
  fontWeight: 700,
};

const titleSeparatorStyle = {
  marginTop: 10,
  marginBottom: 16,
  borderTop: '2px solid #4da3df',
};

const gridTwoColumnsStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 14,
};

const labelStyle = {
  display: 'grid',
  gap: 6,
  fontSize: 15,
  fontWeight: 600,
  color: '#24303f',
};

const inputStyle = {
  border: '1px solid #d5d5d5',
  borderRadius: 8,
  padding: '10px 12px',
  fontSize: 16,
  width: '100%',
  background: '#efeff1',
  minHeight: 46,
};

const textareaStyle = {
  ...inputStyle,
  resize: 'vertical',
  minHeight: 120,
};

const primaryButton = {
  border: 'none',
  borderRadius: 8,
  padding: '8px 12px',
  background: '#111827',
  color: '#fff',
  cursor: 'pointer',
};

const addButtonStyle = {
  border: 'none',
  borderRadius: 4,
  padding: '0 16px',
  minHeight: 46,
  fontSize: 16,
  background: '#3e95d2',
  color: '#fff',
  cursor: 'pointer',
};

const submitButtonStyle = {
  border: 'none',
  borderRadius: 6,
  padding: '8px 20px',
  fontSize: 18,
  background: '#2fc06f',
  color: '#fff',
  cursor: 'pointer',
};

const selectedBoxStyle = {
  border: '1px solid #d6d6d6',
  borderRadius: 8,
  padding: 14,
};

const selectedItemRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  padding: '16px',
  background: '#fafafa',
};

const secondaryButton = {
  border: '1px solid #d1d5db',
  borderRadius: 8,
  padding: '8px 12px',
  background: '#fff',
  cursor: 'pointer',
};

const dangerGhostButton = {
  border: '1px solid #fecaca',
  borderRadius: 8,
  padding: '6px 10px',
  background: '#fff5f5',
  color: '#991b1b',
  cursor: 'pointer',
};

const typeButtonStyle = {
  border: '1px solid rgba(0, 0, 0, 0.08)',
  borderRadius: 10,
  padding: '8px 14px',
  background: '#f7f5f0',
  color: 'rgba(0, 0, 0, 0.65)',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};

const activeTypeButtonStyle = {
  ...typeButtonStyle,
  border: '1px solid #1a1a2e',
  background: '#1a1a2e',
  color: '#fff',
};

function formatServiceType(value) {
  const labels = {
    administratif: 'Services administratifs',
    chu: 'Services CHU',
    decanat: 'Décanat',
    pharmacie: 'Pharmacie',
    dentaire: 'Médecine dentaire',
    labo: 'Laboratoires',
    association: 'Associations',
  };
  return labels[value] || value;
}
