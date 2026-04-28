import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { createManualImport } from '../../api/procurement';
import { getCategories, getSousCategories } from '../../api/resources';
import PageBackButton from '../../components/ui/PageBackButton';

const parseDelai = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(',', '.'));
  if (Number.isNaN(parsed)) return null;
  return parsed;
};

const validateDelai = (delai, typeAcquisition) => {
  if (typeAcquisition === 'donation' || delai === null) return null;
  const maxDelai = typeAcquisition === 'marche' ? 90 : 40;
  if (delai > maxDelai) {
    return `Delai maximum pour un ${
      typeAcquisition === 'marche' ? 'marche' : 'BC'
    } : ${maxDelai} jours`;
  }
  return null;
};

export default function MarcheManualCreatePage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

  const basePrefix = location.pathname.startsWith('/financiere') ? '/financiere' : '/gestionnaire';
  const requestedType = useMemo(() => {
    const typeFromQuery = new URLSearchParams(location.search).get('type');
    if (['marche', 'bon_commande', 'donation'].includes(typeFromQuery)) {
      return typeFromQuery;
    }
    return '';
  }, [location.search]);

  const backTo = requestedType === 'bon_commande'
    ? `${basePrefix}/bon-commandes`
    : requestedType === 'donation'
      ? `${basePrefix}/dons`
      : `${basePrefix}/marches`;

  const pageTitle = requestedType === 'bon_commande'
    ? 'Nouveau Bon de commande'
    : requestedType === 'donation'
      ? 'Nouveau Don'
      : 'Nouveau Marché';

  const [form, setForm] = useState({
    titre_fichier: '',
    reference_document: '',
    fournisseur_denomination: '',
    fournisseur_telephone: '',
    fournisseur_email: '',
    fournisseur_adresse: '',
    delai_execution: '',
    type_acquisition: requestedType || 'marche',
    type_donateur: '',
    nom_donateur: '',
    organisme_donateur: '',
    contact_donateur: '',
    lignes: [
      {
        designation: '',
        description: '',
        quantite: 1,
        unite: 'U',
        prix_unitaire_ht: '',
        prix_total_ht: '',
        numero_lot: 1,
        type_produit: '',
        n_inventaire: '',
        id_categorie: '',
        id_sous_categorie: '',
        observation: '',
      },
    ],
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['resources', 'categories'],
    queryFn: getCategories,
    staleTime: 30000,
  });

  const { data: sousCategoriesData } = useQuery({
    queryKey: ['resources', 'sous-categories'],
    queryFn: () => getSousCategories(),
    staleTime: 30000,
  });

  const categories = categoriesData?.data || [];
  const sousCategories = sousCategoriesData?.data || [];

  const updateLigne = (index, key, value) => {
    setForm((prev) => ({
      ...prev,
      lignes: prev.lignes.map((line, i) => (i === index ? { ...line, [key]: value } : line)),
    }));
  };

  const addLigne = () => {
    setForm((prev) => ({
      ...prev,
      lignes: [
        ...prev.lignes,
        {
          designation: '',
          description: '',
          quantite: 1,
          unite: 'U',
          prix_unitaire_ht: '',
          prix_total_ht: '',
          numero_lot: 1,
          type_produit: '',
          n_inventaire: '',
          id_categorie: '',
          id_sous_categorie: '',
          observation: '',
        },
      ],
    }));
  };

  const removeLigne = (index) => {
    setForm((prev) => ({
      ...prev,
      lignes: prev.lignes.filter((_, i) => i !== index),
    }));
  };

  const createMutation = useMutation({
    mutationFn: createManualImport,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['procurement', 'marches'] });
      const marcheId = response?.data?.id_marche;
      if (marcheId) {
        navigate(`${basePrefix}/marches/${marcheId}`);
      } else {
        navigate(backTo);
      }
    },
  });

  const delaiError = useMemo(() => {
    const parsedDelai = parseDelai(form.delai_execution);
    return validateDelai(parsedDelai, form.type_acquisition);
  }, [form.delai_execution, form.type_acquisition]);

  const isDonationMissingDonor =
    form.type_acquisition === 'donation' && !String(form.nom_donateur || '').trim();

  const hasInvalidLignes =
    form.lignes.length === 0 ||
    form.lignes.some((ligne) => {
      if (!String(ligne.designation || '').trim()) return true;
      if (!String(ligne.type_produit || '').trim()) return true;
      if (!String(ligne.id_categorie || '').trim()) return true;
      return false;
    });

  const isSubmitDisabled =
    createMutation.isPending ||
    !form.titre_fichier.trim() ||
    hasInvalidLignes ||
    isDonationMissingDonor ||
    Boolean(delaiError);

  return (
    <div className="page-stack">
      <div style={pageHeaderStyle}>
        <PageBackButton to={backTo} label="Retour" hint="Retour à la liste" />
        <div>
          <h1 className="page-title">{pageTitle}</h1>
          <div style={{ marginTop: 4, color: '#64748b', fontSize: 13 }}>
            Saisie manuelle structurée pour créer un marché sans fichier.
          </div>
        </div>
      </div>

      <section className="section-shell">
        <div style={{ display: 'grid', gap: 10 }}>
          <label className="field-label">
            Titre
            <input
              className="field-input"
              value={form.titre_fichier}
              onChange={(e) => setForm((prev) => ({ ...prev, titre_fichier: e.target.value }))}
            />
          </label>

          <label className="field-label">
            Référence document
            <input
              className="field-input"
              value={form.reference_document}
              onChange={(e) => setForm((prev) => ({ ...prev, reference_document: e.target.value }))}
            />
          </label>

          <label className="field-label">
            Type acquisition
            <select
              className="field-input"
              value={form.type_acquisition}
              onChange={(e) => setForm((prev) => ({ ...prev, type_acquisition: e.target.value }))}
              disabled={Boolean(requestedType)}
            >
              <option value="marche">marche</option>
              <option value="bon_commande">bon_commande</option>
              <option value="donation">donation</option>
            </select>
          </label>

          {form.type_acquisition === 'donation' && (
            <div style={donorBlockStyle}>
              <div style={donorBlockHeaderStyle}>
                <div style={donorBlockTitleStyle}>
                  Informations donateur
                </div>
              </div>
              <div style={donorFieldsGridStyle}>
              <label className="field-label" htmlFor="type_donateur">
                Type de donateur
                <select
                  id="type_donateur"
                  className="field-input"
                  value={form.type_donateur}
                  onChange={(e) => setForm((prev) => ({ ...prev, type_donateur: e.target.value }))}
                >
                  <option value="">Selectionner...</option>
                  <option value="interne">Interne (enseignant, decanat...)</option>
                  <option value="externe">Externe (association, organisation...)</option>
                </select>
              </label>
              <label className="field-label" htmlFor="nom_donateur">
                Nom du donateur *
                <input
                  id="nom_donateur"
                  className="field-input"
                  value={form.nom_donateur}
                  onChange={(e) => setForm((prev) => ({ ...prev, nom_donateur: e.target.value }))}
                  placeholder="Nom complet du donateur"
                />
              </label>
              <label className="field-label" htmlFor="organisme_donateur">
                Organisme
                <input
                  id="organisme_donateur"
                  className="field-input"
                  value={form.organisme_donateur}
                  onChange={(e) => setForm((prev) => ({ ...prev, organisme_donateur: e.target.value }))}
                  placeholder="Nom de l'organisation"
                />
              </label>
              <label className="field-label" htmlFor="contact_donateur">
                Contact
                <input
                  id="contact_donateur"
                  className="field-input"
                  value={form.contact_donateur}
                  onChange={(e) => setForm((prev) => ({ ...prev, contact_donateur: e.target.value }))}
                  placeholder="Email ou telephone"
                />
              </label>
              </div>
            </div>
          )}

          <label className="field-label">
            Fournisseur
            <input
              className="field-input"
              value={form.fournisseur_denomination}
              onChange={(e) => setForm((prev) => ({ ...prev, fournisseur_denomination: e.target.value }))}
            />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label className="field-label">
              Téléphone
              <input
                className="field-input"
                value={form.fournisseur_telephone}
                onChange={(e) => setForm((prev) => ({ ...prev, fournisseur_telephone: e.target.value }))}
              />
            </label>
            <label className="field-label">
              Email
              <input
                className="field-input"
                value={form.fournisseur_email}
                onChange={(e) => setForm((prev) => ({ ...prev, fournisseur_email: e.target.value }))}
              />
            </label>
          </div>

          <label className="field-label">
            Adresse
            <textarea
              className="field-input"
              style={{ minHeight: 70 }}
              value={form.fournisseur_adresse}
              onChange={(e) => setForm((prev) => ({ ...prev, fournisseur_adresse: e.target.value }))}
            />
          </label>

          <label className="field-label">
            Délai / livraison
            <input
              className="field-input"
              value={form.delai_execution}
              onChange={(e) => setForm((prev) => ({ ...prev, delai_execution: e.target.value }))}
            />
          </label>
          {delaiError && (
            <p className="text-[11px] text-red-600 mt-1">{delaiError}</p>
          )}
        </div>
      </section>

      <section className="section-shell">
        <div style={articlesHeaderStyle}>
          <div style={articlesTitleStyle}>Articles</div>
          <div style={articlesSubtitleStyle}>Ajoutez et complétez les lignes d'articles à intégrer.</div>
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          {form.lignes.map((ligne, index) => (
            <div key={`ligne-${index}`} style={articleLineCardStyle}>
              <label className="field-label">
                Désignation
                <input
                  className="field-input"
                  value={ligne.designation}
                  onChange={(e) => updateLigne(index, 'designation', e.target.value)}
                />
              </label>

              <label className="field-label">
                Description
                <textarea
                  className="field-input"
                  style={{ minHeight: 70 }}
                  value={ligne.description}
                  onChange={(e) => updateLigne(index, 'description', e.target.value)}
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
                <label className="field-label">
                  Quantité
                  <input
                    className="field-input"
                    type="number"
                    min="1"
                    value={ligne.quantite}
                    onChange={(e) => updateLigne(index, 'quantite', e.target.value)}
                  />
                </label>
                <label className="field-label">
                  Unité
                  <input
                    className="field-input"
                    value={ligne.unite}
                    onChange={(e) => updateLigne(index, 'unite', e.target.value)}
                  />
                </label>
                <label className="field-label">
                  PU HT
                  <input
                    className="field-input"
                    value={ligne.prix_unitaire_ht}
                    onChange={(e) => updateLigne(index, 'prix_unitaire_ht', e.target.value)}
                  />
                </label>
                <label className="field-label">
                  PT HT
                  <input
                    className="field-input"
                    value={ligne.prix_total_ht}
                    onChange={(e) => updateLigne(index, 'prix_total_ht', e.target.value)}
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                <label className="field-label" htmlFor={`lot_${index}`}>
                  N° de lot
                  <input
                    id={`lot_${index}`}
                    type="number"
                    min="1"
                    className="field-input"
                    value={ligne.numero_lot ?? 1}
                    onChange={(e) => updateLigne(index, 'numero_lot', e.target.value)}
                    placeholder="1"
                  />
                </label>

                <label className="field-label" htmlFor={`type_${index}`}>
                  Type *
                  <select
                    id={`type_${index}`}
                    className="field-input"
                    value={ligne.type_produit}
                    onChange={(e) => updateLigne(index, 'type_produit', e.target.value)}
                  >
                    <option value="">Selectionner...</option>
                    <option value="consommable">Consommable</option>
                    <option value="bien_inventaire">Bien inventaire</option>
                  </select>
                </label>

                {ligne.type_produit === 'bien_inventaire' && (
                  <label className="field-label" htmlFor={`ninv_${index}`}>
                    N° inventaire (optionnel - genere auto si vide)
                    <input
                      id={`ninv_${index}`}
                      className="field-input font-['JetBrains_Mono']"
                      value={ligne.n_inventaire ?? ''}
                      onChange={(e) => updateLigne(index, 'n_inventaire', e.target.value)}
                      placeholder="INV-26-XXXX"
                    />
                  </label>
                )}

                <label className="field-label" htmlFor={`cat_${index}`}>
                  Catégorie *
                  <select
                    id={`cat_${index}`}
                    className="field-input"
                    value={ligne.id_categorie}
                    onChange={(e) => {
                      updateLigne(index, 'id_categorie', e.target.value);
                      updateLigne(index, 'id_sous_categorie', '');
                    }}
                  >
                    <option value="">Selectionner...</option>
                    {categories.map((categorie) => (
                      <option key={categorie.id_categorie} value={categorie.id_categorie}>
                        {categorie.nom_categorie}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field-label" htmlFor={`scat_${index}`}>
                  Sous-catégorie
                  <select
                    id={`scat_${index}`}
                    className="field-input"
                    value={ligne.id_sous_categorie}
                    onChange={(e) => updateLigne(index, 'id_sous_categorie', e.target.value)}
                  >
                    <option value="">Selectionner...</option>
                    {sousCategories
                      .filter((sousCategorie) => String(sousCategorie.id_categorie) === String(ligne.id_categorie))
                      .map((sousCategorie) => (
                        <option key={sousCategorie.id_sous_categorie} value={sousCategorie.id_sous_categorie}>
                          {sousCategorie.nom_sous_categorie}
                        </option>
                      ))}
                  </select>
                </label>
              </div>

              <label className="field-label" htmlFor={`obs_${index}`}>
                Observation / Commentaire
                <textarea
                  id={`obs_${index}`}
                  className="field-input resize-none"
                  style={{ minHeight: 70 }}
                  value={ligne.observation ?? ''}
                  onChange={(e) => updateLigne(index, 'observation', e.target.value)}
                  placeholder="Remarque, etat a la reception, condition particuliere..."
                />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => removeLigne(index)}
                  disabled={form.lignes.length === 1}
                >
                  Supprimer la ligne
                </button>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={addLigne}>
            Ajouter une ligne
          </button>
        </div>
      </section>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button className="btn btn-secondary" onClick={() => navigate(backTo)}>
          Annuler
        </button>
        <button
          className="btn btn-primary"
          onClick={() => {
            if (delaiError) {
              toast.error(delaiError);
              return;
            }
            if (isDonationMissingDonor) {
              toast.error('Le nom du donateur est obligatoire pour un don.');
              return;
            }

            const payload = {
              titre_fichier: form.titre_fichier,
              reference_document: form.reference_document,
              type_acquisition: form.type_acquisition,
              type_donateur: form.type_donateur,
              nom_donateur: form.nom_donateur,
              organisme_donateur: form.organisme_donateur,
              contact_donateur: form.contact_donateur,
              fournisseur_denomination: form.fournisseur_denomination,
              fournisseur_telephone: form.fournisseur_telephone,
              fournisseur_email: form.fournisseur_email,
              fournisseur_adresse: form.fournisseur_adresse,
              delai_execution: form.delai_execution,
              lignes: form.lignes.map((ligne) => ({
                designation: ligne.designation,
                description: ligne.description,
                quantite: ligne.quantite,
                unite: ligne.unite,
                prix_unitaire_ht: ligne.prix_unitaire_ht,
                prix_total_ht: ligne.prix_total_ht,
                numero_lot: ligne.numero_lot,
                type_produit: ligne.type_produit,
                n_inventaire: ligne.n_inventaire,
                id_categorie: ligne.id_categorie,
                id_sous_categorie: ligne.id_sous_categorie,
                observation: ligne.observation,
              })),
            };
            createMutation.mutate(payload);
          }}
          disabled={isSubmitDisabled}
        >
          {createMutation.isPending ? 'Création...' : 'Créer le marché'}
        </button>
      </div>
    </div>
  );
}

const pageHeaderStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  padding: '4px 0',
};

const donorBlockStyle = {
  display: 'grid',
  gap: 12,
  padding: 10,
  marginTop: 4,
  border: '1px solid rgba(11, 61, 74, 0.14)',
  background: '#ffffff',
  borderRadius: 12,
};

const donorBlockHeaderStyle = {
  borderBottom: '1px solid rgba(11, 61, 74, 0.12)',
  paddingBottom: 8,
};

const donorBlockTitleStyle = {
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: '#0b3d4a',
  fontWeight: 700,
};

const donorFieldsGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 10,
};

const articlesHeaderStyle = {
  paddingBottom: 10,
  borderBottom: '1px solid rgba(11, 61, 74, 0.12)',
  marginBottom: 10,
};

const articlesTitleStyle = {
  fontWeight: 700,
  color: '#0b3d4a',
  fontSize: 15,
};

const articlesSubtitleStyle = {
  fontSize: 12,
  color: '#64748b',
  marginTop: 2,
};

const articleLineCardStyle = {
  border: '1px solid rgba(11, 61, 74, 0.14)',
  borderRadius: 12,
  padding: 14,
  display: 'grid',
  gap: 8,
  background: '#ffffff',
};
