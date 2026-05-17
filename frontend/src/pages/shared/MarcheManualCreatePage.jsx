import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createManualImport } from '../../api/procurement';
import { getCategories, getSousCategories } from '../../api/resources';
import PageBackButton from '../../components/ui/PageBackButton';

// ── Design tokens (mirrors StockPage palette) ─────────────────────────────
const C = {
  textPrimary:   '#0f172a',
  textSecondary: '#475569',
  textMuted:     '#94a3b8',
  border:        '#e2e8f0',
  bgWhite:       '#fff',
  bgSubtle:      '#f8fafc',
  primary:       '#1e293b',
  accent:        '#0C447C',
  danger:        '#ef4444',
  warning:       '#f59e0b',
  warningBg:     '#fffbeb',
  warningBorder: '#fcd34d',
};

const DEFAULT_LIGNE = {
  designation: '',
  description: '',
  quantite: 1,
  unite: 'U',
  prix_unitaire_ht: '',
  prix_total_ht: '',
  numero_lot: 1,
  type_produit: '',
  n_inventaire: '',
  id_categorie_metier: '', // top-level SousCategorie (real business category)
  id_sous_categorie: '',   // child SousCategorie (bien_inventaire only)
  observation: '',
};

// ── Field helpers ─────────────────────────────────────────────────────────
function Field({ label, required, hint, children }) {
  return (
    <label style={fieldWrapStyle}>
      <span style={fieldLabelStyle}>
        {label}{required && <span style={{ color: C.danger, marginLeft: 2 }}>*</span>}
      </span>
      {children}
      {hint && <span style={fieldHintStyle}>{hint}</span>}
    </label>
  );
}

function Input({ style: extraStyle, ...props }) {
  return <input style={{ ...fieldInputStyle, ...extraStyle }} {...props} />;
}

function Select({ style: extraStyle, children, ...props }) {
  return <select style={{ ...fieldInputStyle, ...extraStyle }} {...props}>{children}</select>;
}

function Textarea({ style: extraStyle, ...props }) {
  return <textarea style={{ ...fieldInputStyle, height: 'auto', minHeight: 72, resize: 'vertical', ...extraStyle }} {...props} />;
}

// ── Page component ────────────────────────────────────────────────────────
export default function MarcheManualCreatePage() {
  const queryClient = useQueryClient();
  const navigate    = useNavigate();
  const location    = useLocation();

  const basePrefix  = location.pathname.startsWith('/financiere') ? '/financiere' : '/gestionnaire';
  const typeFromUrl = new URLSearchParams(location.search).get('type') || 'marche';
  const backPath    = { marche: `${basePrefix}/marches`, bon_commande: `${basePrefix}/bons-commande`, donation: `${basePrefix}/dons` }[typeFromUrl] ?? `${basePrefix}/marches`;

  const TYPE_META = {
    marche:       { label: 'Marché',          backLabel: 'Marchés',          createBtn: 'Créer le marché',          delaiLabel: 'marché' },
    bon_commande: { label: 'Bon de commande', backLabel: 'Bons de commande', createBtn: 'Créer le bon de commande', delaiLabel: 'bon de commande' },
    donation:     { label: 'Don',             backLabel: 'Dons',             createBtn: 'Créer le don',             delaiLabel: 'don' },
  };
  const typeMeta  = TYPE_META[typeFromUrl] ?? TYPE_META.marche;
  const pageTitle = `Nouveau ${typeMeta.label}`;

  const [form, setForm] = useState({
    titre_fichier: '',
    reference_document: '',
    fournisseur_denomination: '',
    fournisseur_telephone: '',
    fournisseur_email: '',
    fournisseur_adresse: '',
    delai_execution: '',
    statut_livraison: 'en_attente_livraison',
    type_acquisition: typeFromUrl,
    type_donateur: '',
    nom_donateur: '',
    organisme_donateur: '',
    contact_donateur: '',
    lignes: [{ ...DEFAULT_LIGNE }],
  });

  const setField = (key, value) => setForm((p) => ({ ...p, [key]: value }));

  const updateLigne = (index, key, value) =>
    setForm((prev) => ({
      ...prev,
      lignes: prev.lignes.map((line, i) => (i === index ? { ...line, [key]: value } : line)),
    }));

  const updateLigneFields = (index, patch) =>
    setForm((prev) => ({
      ...prev,
      lignes: prev.lignes.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    }));

  const addLigne    = () => setForm((p) => ({ ...p, lignes: [...p.lignes, { ...DEFAULT_LIGNE }] }));
  const removeLigne = (i) => setForm((p) => ({ ...p, lignes: p.lignes.filter((_, idx) => idx !== i) }));

  // ── Queries ────────────────────────────────────────────────────────────
  const catQuery  = useQuery({ queryKey: ['resources', 'categories'], queryFn: getCategories, staleTime: 60_000 });
  const scatQuery = useQuery({ queryKey: ['resources', 'sous-categories-all'], queryFn: getSousCategories, staleTime: 60_000 });
  const categories    = catQuery.data?.data  || [];
  const sousCategories = scatQuery.data?.data || [];

  // ── Derived state ──────────────────────────────────────────────────────
  const isDonation = form.type_acquisition === 'donation';

  const delaiError = (() => {
    const n = Number(form.delai_execution);
    if (!n) return null;
    const max = form.type_acquisition === 'marche' ? 90 : 40;
    return n > max
      ? `Délai maximum pour un ${(TYPE_META[form.type_acquisition] ?? TYPE_META.marche).delaiLabel} : ${max} jours`
      : null;
  })();

  // ── Submit ─────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: createManualImport,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['procurement', 'marches'] });
      queryClient.invalidateQueries({ queryKey: ['resources', 'stocks'] });
      queryClient.invalidateQueries({ queryKey: ['resources', 'instances'] });
      queryClient.invalidateQueries({ queryKey: ['resources', 'ressources'] });
      const id = res?.data?.id_marche;
      navigate(id ? `${basePrefix}/marches/${id}` : backPath);
    },
  });

  const isDisabled =
    createMutation.isPending ||
    !!delaiError ||
    !form.titre_fichier.trim() ||
    form.lignes.length === 0 ||
    form.lignes.some((l) => !String(l.designation || '').trim() || !l.type_produit || !l.id_categorie_metier) ||
    (isDonation && !form.nom_donateur.trim());

  function handleSubmit() {
    createMutation.mutate({
      titre_fichier:            form.titre_fichier,
      reference_document:       form.reference_document,
      type_acquisition:         form.type_acquisition,
      statut_livraison:         form.statut_livraison,
      type_donateur:            form.type_donateur,
      nom_donateur:             form.nom_donateur,
      organisme_donateur:       form.organisme_donateur,
      contact_donateur:         form.contact_donateur,
      fournisseur_denomination: form.fournisseur_denomination,
      fournisseur_telephone:    form.fournisseur_telephone,
      fournisseur_email:        form.fournisseur_email,
      fournisseur_adresse:      form.fournisseur_adresse,
      delai_execution:          form.delai_execution,
      lignes: form.lignes.map((l) => ({
        designation:       l.designation,
        description:       l.description,
        quantite:          l.quantite,
        unite:             l.unite,
        prix_unitaire_ht:  l.prix_unitaire_ht,
        prix_total_ht:     l.prix_total_ht,
        numero_lot:           l.numero_lot || 1,
        type_produit:         l.type_produit         || undefined,
        n_inventaire:         l.n_inventaire         || undefined,
        id_categorie_metier:  l.id_categorie_metier  || undefined,
        id_sous_categorie:    l.id_sous_categorie    || undefined,
        observation:          l.observation          || undefined,
      })),
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div style={pageWrapStyle}>

      {/* ── Page header ── */}
      <div style={pageHeaderStyle}>
        <PageBackButton to={backPath} label={typeMeta.backLabel} hint="Retour à la liste" />
        <div>
          <h1 style={pageTitleStyle}>{pageTitle}</h1>
          <p style={pageSubtitleStyle}>Saisie manuelle structurée pour créer un {typeMeta.delaiLabel} sans fichier.</p>
        </div>
      </div>

      {/* ── Informations générales ── */}
      <section style={sectionCardStyle}>
        <h2 style={sectionTitleStyle}>Informations générales</h2>
        <div style={formGridStyle}>

          <Field label="Titre" required>
            <Input value={form.titre_fichier} onChange={(e) => setField('titre_fichier', e.target.value)} placeholder={`Intitulé du ${typeMeta.delaiLabel}`} />
          </Field>

          <Field label="Référence document">
            <Input value={form.reference_document} onChange={(e) => setField('reference_document', e.target.value)} placeholder="N° référence" />
          </Field>

          <Field label="Statut à la création">
            <Select value={form.statut_livraison} onChange={(e) => setField('statut_livraison', e.target.value)}>
              <option value="en_attente_livraison">En attente de livraison</option>
              <option value="receptionne_et_stocke">Réceptionné et stocké (intégrer au stock)</option>
            </Select>
          </Field>

          {/* ── Donation block ── */}
          {isDonation && (
            <div style={donationBlockStyle}>
              <p style={donationTitleStyle}>Informations du donateur</p>
              <div style={formGridStyle}>
                <Field label="Type de donateur">
                  <Select value={form.type_donateur} onChange={(e) => setField('type_donateur', e.target.value)}>
                    <option value="">Sélectionner...</option>
                    <option value="personne_physique">Personne physique</option>
                    <option value="organisation">Organisation</option>
                    <option value="association">Association</option>
                    <option value="gouvernement">Gouvernement</option>
                    <option value="entreprise">Entreprise</option>
                    <option value="autre">Autre</option>
                  </Select>
                </Field>
                <Field label="Nom du donateur" required>
                  <Input value={form.nom_donateur} onChange={(e) => setField('nom_donateur', e.target.value)} />
                </Field>
                <Field label="Organisme">
                  <Input value={form.organisme_donateur} onChange={(e) => setField('organisme_donateur', e.target.value)} />
                </Field>
                <Field label="Contact">
                  <Input value={form.contact_donateur} onChange={(e) => setField('contact_donateur', e.target.value)} />
                </Field>
              </div>
            </div>
          )}

          <Field label="Fournisseur">
            <Input value={form.fournisseur_denomination} onChange={(e) => setField('fournisseur_denomination', e.target.value)} placeholder="Dénomination" />
          </Field>

          <div style={row2ColStyle}>
            <Field label="Téléphone">
              <Input value={form.fournisseur_telephone} onChange={(e) => setField('fournisseur_telephone', e.target.value)} placeholder="+213 …" />
            </Field>
            <Field label="Email">
              <Input type="email" value={form.fournisseur_email} onChange={(e) => setField('fournisseur_email', e.target.value)} placeholder="nom@domaine.dz" />
            </Field>
          </div>

          <Field label="Adresse">
            <Textarea value={form.fournisseur_adresse} onChange={(e) => setField('fournisseur_adresse', e.target.value)} placeholder="Adresse complète…" />
          </Field>

          <Field label="Délai de livraison (jours)">
            <Input
              type="number"
              min="1"
              value={form.delai_execution}
              onChange={(e) => setField('delai_execution', e.target.value)}
              placeholder={form.type_acquisition === 'marche' ? 'max 90 j' : 'max 40 j'}
              style={{ borderColor: delaiError ? C.danger : undefined }}
            />
            {delaiError && <span style={{ fontSize: '0.75rem', color: C.danger }}>{delaiError}</span>}
          </Field>

        </div>
      </section>

      {/* ── Articles ── */}
      <section style={sectionCardStyle}>
        <h2 style={sectionTitleStyle}>Articles</h2>

        <div style={{ display: 'grid', gap: '1rem' }}>
          {form.lignes.map((ligne, i) => (
            <ArticleCard
              key={i}
              index={i}
              ligne={ligne}
              updateLigne={updateLigne}
              updateLigneFields={updateLigneFields}
              removeLigne={removeLigne}
              canDelete={form.lignes.length > 1}
              categories={categories}
              sousCategories={sousCategories}
            />
          ))}
        </div>

        <button type="button" style={addLineBtnStyle} onClick={addLigne}>
          + Ajouter une ligne
        </button>
      </section>

      {/* ── Sticky footer ── */}
      <div style={footerBarStyle}>
        <button type="button" style={cancelBtnStyle} onClick={() => navigate(backPath)}>
          Annuler
        </button>
        <button type="button" style={{ ...primaryBtnStyle, opacity: isDisabled ? 0.55 : 1 }} onClick={handleSubmit} disabled={isDisabled}>
          {createMutation.isPending ? 'Création…' : typeMeta.createBtn}
        </button>
      </div>

    </div>
  );
}

// ── Article card sub-component ────────────────────────────────────────────
function ArticleCard({ index, ligne, updateLigne, updateLigneFields, removeLigne, canDelete, categories, sousCategories }) {
  const isBienInventaire = ligne.type_produit === 'bien_inventaire';

  // Resolve which DB Categorie ID corresponds to the selected type
  const dbCatId = (() => {
    if (!ligne.type_produit) return null;
    const targetNom = ligne.type_produit === 'consommable' ? 'Consommable' : 'Bien Inventaire';
    const cat = categories.find((c) => (c.nomCategorie ?? c.nom_categorie) === targetNom);
    return cat ? String(cat.idCategorie ?? cat.id_categorie) : null;
  })();

  // Top-level SousCategories filtered by the DB Categorie of the selected type
  const categoriesMetier = sousCategories.filter((s) => {
    const parentId = s.idParentSousCategorie ?? s.id_parent_sous_categorie;
    return !parentId && String(s.idCategorie ?? s.id_categorie) === dbCatId;
  });

  // Child SousCategories of the selected catégorie métier
  const sousCategsMetier = sousCategories.filter((s) => {
    const parentId = s.idParentSousCategorie ?? s.id_parent_sous_categorie;
    return String(parentId) === String(ligne.id_categorie_metier);
  });

  return (
    <div style={articleCardStyle}>
      {/* Card header */}
      <div style={articleHeaderStyle}>
        <span style={articleTitleStyle}>
          <span style={accentDotStyle} />
          Article {index + 1}
        </span>
        <button
          type="button"
          style={{ ...deleteBtnStyle, opacity: canDelete ? 1 : 0.35, cursor: canDelete ? 'pointer' : 'not-allowed' }}
          onClick={() => canDelete && removeLigne(index)}
          disabled={!canDelete}
        >
          Supprimer
        </button>
      </div>

      <div style={formGridStyle}>

        {/* Désignation */}
        <Field label="Désignation" required>
          <input style={fieldInputStyle} value={ligne.designation} onChange={(e) => updateLigne(index, 'designation', e.target.value)} placeholder="Nom de l'article" />
        </Field>

        {/* Description */}
        <Field label="Description">
          <textarea style={{ ...fieldInputStyle, height: 'auto', minHeight: 64, resize: 'vertical' }} value={ligne.description} onChange={(e) => updateLigne(index, 'description', e.target.value)} />
        </Field>

        {/* Type + N° lot — 2 cols */}
        <div style={{ ...row2ColStyle, gridTemplateColumns: '1fr 7rem' }}>
          <Field label="Type" required>
            <select
              style={fieldInputStyle}
              value={ligne.type_produit}
              onChange={(e) => updateLigneFields(index, { type_produit: e.target.value, id_categorie_metier: '', id_sous_categorie: '' })}
            >
              <option value="">Sélectionner...</option>
              <option value="consommable">Consommable</option>
              <option value="bien_inventaire">Bien inventaire</option>
            </select>
          </Field>
          <Field label="N° de lot">
            <input style={fieldInputStyle} type="number" min="1" value={ligne.numero_lot ?? 1} onChange={(e) => updateLigne(index, 'numero_lot', e.target.value)} />
          </Field>
        </div>

        {/* N° inventaire — animated, only for bien_inventaire */}
        <div style={{ maxHeight: isBienInventaire ? '6rem' : '0', overflow: 'hidden', transition: 'max-height 0.25s ease-in-out' }}>
          <Field label="N° inventaire">
            <input
              style={{ ...fieldInputStyle, fontFamily: 'monospace' }}
              value={ligne.n_inventaire ?? ''}
              onChange={(e) => updateLigne(index, 'n_inventaire', e.target.value)}
              placeholder="INV-2026-XXXX"
            />
            <span style={fieldHintStyle}>Optionnel — généré automatiquement si laissé vide.</span>
          </Field>
        </div>

        {/* Catégorie — top-level SousCategorie filtered by type */}
        <Field label="Catégorie" required>
          <select
            style={{ ...fieldInputStyle, color: !ligne.type_produit ? C.textMuted : undefined }}
            value={ligne.id_categorie_metier}
            onChange={(e) => updateLigneFields(index, { id_categorie_metier: e.target.value, id_sous_categorie: '' })}
            disabled={!ligne.type_produit}
          >
            <option value="">Sélectionner...</option>
            {categoriesMetier.map((s) => {
              const id  = s.idSousCategorie ?? s.id_sous_categorie;
              const nom = s.nomSousCategorie ?? s.nom_sous_categorie;
              return <option key={id} value={id}>{nom}</option>;
            })}
          </select>
        </Field>

        {/* Sous-catégorie — child SousCategorie, only for bien_inventaire */}
        {isBienInventaire && (
          <Field label="Sous-catégorie">
            <select
              style={{ ...fieldInputStyle, color: !ligne.id_categorie_metier ? C.textMuted : undefined }}
              value={ligne.id_sous_categorie}
              onChange={(e) => updateLigne(index, 'id_sous_categorie', e.target.value)}
              disabled={!ligne.id_categorie_metier}
            >
              <option value="">Sélectionner...</option>
              {sousCategsMetier.map((s) => {
                const id  = s.idSousCategorie ?? s.id_sous_categorie;
                const nom = s.nomSousCategorie ?? s.nom_sous_categorie;
                return <option key={id} value={id}>{nom}</option>;
              })}
            </select>
          </Field>
        )}

        {/* Qté / Unité / PU HT / PT HT — 4 cols */}
        <div style={row4ColStyle}>
          <Field label="Quantité">
            <input style={fieldInputStyle} type="number" min="1" value={ligne.quantite} onChange={(e) => updateLigne(index, 'quantite', e.target.value)} />
          </Field>
          <Field label="Unité">
            <input style={fieldInputStyle} value={ligne.unite} onChange={(e) => updateLigne(index, 'unite', e.target.value)} />
          </Field>
          <Field label="PU HT">
            <input style={fieldInputStyle} value={ligne.prix_unitaire_ht} onChange={(e) => updateLigne(index, 'prix_unitaire_ht', e.target.value)} placeholder="0.00" />
          </Field>
          <Field label="PT HT">
            <input style={fieldInputStyle} value={ligne.prix_total_ht} onChange={(e) => updateLigne(index, 'prix_total_ht', e.target.value)} placeholder="0.00" />
          </Field>
        </div>

        {/* Observation */}
        <Field label="Observation / Commentaire">
          <textarea
            style={{ ...fieldInputStyle, height: 'auto', minHeight: 56, resize: 'vertical' }}
            rows={2}
            value={ligne.observation ?? ''}
            onChange={(e) => updateLigne(index, 'observation', e.target.value)}
            placeholder="Remarque, état à la réception, condition particulière…"
          />
        </Field>

      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────
const pageWrapStyle = {
  display: 'grid',
  gap: '1.25rem',
  paddingBottom: '5rem', // room for sticky footer
};

const pageHeaderStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.875rem',
};

const pageTitleStyle = {
  margin: 0,
  fontSize: '1.25rem',
  fontWeight: 700,
  color: C.textPrimary,
};

const pageSubtitleStyle = {
  margin: '0.25rem 0 0',
  fontSize: '0.8rem',
  color: C.textMuted,
};

const sectionCardStyle = {
  border: `1px solid ${C.border}`,
  borderRadius: '0.75rem',
  background: C.bgWhite,
  padding: '1.25rem',
  display: 'grid',
  gap: '1rem',
};

const sectionTitleStyle = {
  margin: 0,
  fontSize: '1rem',
  fontWeight: 600,
  color: C.textPrimary,
};

const formGridStyle = {
  display: 'grid',
  gap: '1.25rem',
};

const row2ColStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '1.25rem',
};

const row4ColStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: '1.25rem',
};

const fieldWrapStyle = {
  display: 'grid',
  gap: '0.375rem',
};

const fieldLabelStyle = {
  fontSize: '0.875rem',
  fontWeight: 500,
  color: C.textSecondary,
};

const fieldHintStyle = {
  fontSize: '0.75rem',
  fontStyle: 'italic',
  color: C.textMuted,
  marginTop: '0.125rem',
};

const fieldInputStyle = {
  width: '100%',
  height: '2.5rem',
  padding: '0.5rem 0.75rem',
  fontSize: '0.875rem',
  color: C.textPrimary,
  background: C.bgWhite,
  border: `1px solid ${C.border}`,
  borderRadius: '0.375rem',
  boxSizing: 'border-box',
  outline: 'none',
  fontFamily: 'inherit',
};

// Article card
const articleCardStyle = {
  border: `1px solid ${C.border}`,
  borderLeft: `3px solid ${C.accent}`,
  borderRadius: '0.5rem',
  padding: '1.25rem',
  display: 'grid',
  gap: '1rem',
  background: C.bgWhite,
};

const articleHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const articleTitleStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  fontSize: '1rem',
  fontWeight: 600,
  color: C.textPrimary,
};

const accentDotStyle = {
  display: 'inline-block',
  width: 8,
  height: 8,
  borderRadius: '50%',
  background: C.accent,
  flexShrink: 0,
};

const deleteBtnStyle = {
  border: 'none',
  background: 'transparent',
  color: C.danger,
  fontSize: '0.8rem',
  fontWeight: 500,
  padding: '0.25rem 0',
};

const addLineBtnStyle = {
  marginTop: '0.5rem',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.375rem',
  border: `1px solid ${C.border}`,
  borderRadius: '0.375rem',
  padding: '0.5rem 1rem',
  fontSize: '0.875rem',
  fontWeight: 500,
  color: C.textSecondary,
  background: C.bgWhite,
  cursor: 'pointer',
};

// Donation block
const donationBlockStyle = {
  border: `1px solid ${C.warningBorder}`,
  borderRadius: '0.5rem',
  background: C.warningBg,
  padding: '1rem',
  display: 'grid',
  gap: '1rem',
};

const donationTitleStyle = {
  margin: 0,
  fontSize: '0.875rem',
  fontWeight: 600,
  color: '#92400e',
};

// Footer
const footerBarStyle = {
  position: 'sticky',
  bottom: 0,
  display: 'flex',
  justifyContent: 'flex-end',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '0.875rem 1.25rem',
  background: C.bgWhite,
  borderTop: `1px solid ${C.border}`,
  borderRadius: '0 0 0.75rem 0.75rem',
  zIndex: 10,
};

const cancelBtnStyle = {
  border: `1px solid ${C.border}`,
  borderRadius: '0.375rem',
  padding: '0.5rem 1.25rem',
  fontSize: '0.875rem',
  fontWeight: 500,
  color: C.textSecondary,
  background: C.bgWhite,
  cursor: 'pointer',
};

const primaryBtnStyle = {
  border: 'none',
  borderRadius: '0.375rem',
  padding: '0.5rem 1.5rem',
  height: '2.5rem',
  fontSize: '0.875rem',
  fontWeight: 600,
  color: '#fff',
  background: C.primary,
  cursor: 'pointer',
};
