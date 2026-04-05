import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { createManualImport } from '../../api/procurement';
import PageBackButton from '../../components/ui/PageBackButton';

export default function MarcheManualCreatePage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

  const basePrefix = location.pathname.startsWith('/financiere') ? '/financiere' : '/gestionnaire';

  const [form, setForm] = useState({
    titre_fichier: '',
    reference_document: '',
    fournisseur_denomination: '',
    fournisseur_telephone: '',
    fournisseur_email: '',
    fournisseur_adresse: '',
    delai_execution: '',
    type_acquisition: 'marche',
    lignes: [
      {
        designation: '',
        description: '',
        quantite: 1,
        unite: 'U',
        prix_unitaire_ht: '',
        prix_total_ht: '',
      },
    ],
  });

  const setLigne = (index, key, value) => {
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
        navigate(`${basePrefix}/marches`);
      }
    },
  });

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={pageHeaderStyle}>
        <PageBackButton to={`${basePrefix}/marches`} label="Marchés" hint="Retour à la liste" />
        <div>
          <h1 style={{ margin: 0 }}>Nouveau Marché</h1>
          <div style={{ marginTop: 4, color: '#64748b', fontSize: 13 }}>
            Saisie manuelle structurée pour créer un marché sans fichier.
          </div>
        </div>
      </div>

      <section style={cardStyle}>
        <div style={{ display: 'grid', gap: 10 }}>
          <label style={labelStyle}>
            Titre
            <input
              style={inputStyle}
              value={form.titre_fichier}
              onChange={(e) => setForm((prev) => ({ ...prev, titre_fichier: e.target.value }))}
            />
          </label>

          <label style={labelStyle}>
            Référence document
            <input
              style={inputStyle}
              value={form.reference_document}
              onChange={(e) => setForm((prev) => ({ ...prev, reference_document: e.target.value }))}
            />
          </label>

          <label style={labelStyle}>
            Type acquisition
            <select
              style={inputStyle}
              value={form.type_acquisition}
              onChange={(e) => setForm((prev) => ({ ...prev, type_acquisition: e.target.value }))}
            >
              <option value="marche">marche</option>
              <option value="bon_commande">bon_commande</option>
              <option value="donation">donation</option>
            </select>
          </label>

          <label style={labelStyle}>
            Fournisseur
            <input
              style={inputStyle}
              value={form.fournisseur_denomination}
              onChange={(e) => setForm((prev) => ({ ...prev, fournisseur_denomination: e.target.value }))}
            />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={labelStyle}>
              Téléphone
              <input
                style={inputStyle}
                value={form.fournisseur_telephone}
                onChange={(e) => setForm((prev) => ({ ...prev, fournisseur_telephone: e.target.value }))}
              />
            </label>
            <label style={labelStyle}>
              Email
              <input
                style={inputStyle}
                value={form.fournisseur_email}
                onChange={(e) => setForm((prev) => ({ ...prev, fournisseur_email: e.target.value }))}
              />
            </label>
          </div>

          <label style={labelStyle}>
            Adresse
            <textarea
              style={{ ...inputStyle, minHeight: 70 }}
              value={form.fournisseur_adresse}
              onChange={(e) => setForm((prev) => ({ ...prev, fournisseur_adresse: e.target.value }))}
            />
          </label>

          <label style={labelStyle}>
            Délai / livraison
            <input
              style={inputStyle}
              value={form.delai_execution}
              onChange={(e) => setForm((prev) => ({ ...prev, delai_execution: e.target.value }))}
            />
          </label>
        </div>
      </section>

      <section style={cardStyle}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Articles</div>
        <div style={{ display: 'grid', gap: 10 }}>
          {form.lignes.map((ligne, index) => (
            <div key={`ligne-${index}`} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 10, display: 'grid', gap: 8 }}>
              <label style={labelStyle}>
                Désignation
                <input
                  style={inputStyle}
                  value={ligne.designation}
                  onChange={(e) => setLigne(index, 'designation', e.target.value)}
                />
              </label>

              <label style={labelStyle}>
                Description
                <textarea
                  style={{ ...inputStyle, minHeight: 70 }}
                  value={ligne.description}
                  onChange={(e) => setLigne(index, 'description', e.target.value)}
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
                <label style={labelStyle}>
                  Quantité
                  <input
                    style={inputStyle}
                    type="number"
                    min="1"
                    value={ligne.quantite}
                    onChange={(e) => setLigne(index, 'quantite', e.target.value)}
                  />
                </label>
                <label style={labelStyle}>
                  Unité
                  <input
                    style={inputStyle}
                    value={ligne.unite}
                    onChange={(e) => setLigne(index, 'unite', e.target.value)}
                  />
                </label>
                <label style={labelStyle}>
                  PU HT
                  <input
                    style={inputStyle}
                    value={ligne.prix_unitaire_ht}
                    onChange={(e) => setLigne(index, 'prix_unitaire_ht', e.target.value)}
                  />
                </label>
                <label style={labelStyle}>
                  PT HT
                  <input
                    style={inputStyle}
                    value={ligne.prix_total_ht}
                    onChange={(e) => setLigne(index, 'prix_total_ht', e.target.value)}
                  />
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  style={secondaryButton}
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
          <button type="button" style={secondaryButton} onClick={addLigne}>
            Ajouter une ligne
          </button>
        </div>
      </section>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button style={secondaryButton} onClick={() => navigate(`${basePrefix}/marches`)}>
          Annuler
        </button>
        <button
          style={primaryButton}
          onClick={() => {
            const payload = {
              titre_fichier: form.titre_fichier,
              reference_document: form.reference_document,
              type_acquisition: form.type_acquisition,
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
              })),
            };
            createMutation.mutate(payload);
          }}
          disabled={
            createMutation.isPending ||
            !form.titre_fichier.trim() ||
            form.lignes.length === 0 ||
            form.lignes.some((l) => !String(l.designation || '').trim())
          }
        >
          {createMutation.isPending ? 'Création...' : 'Créer le marché'}
        </button>
      </div>
    </div>
  );
}

const cardStyle = {
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  background: '#fff',
  padding: 12,
};

const pageHeaderStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  padding: '4px 0',
};

const labelStyle = {
  display: 'grid',
  gap: 6,
  fontSize: 13,
  color: '#374151',
};

const inputStyle = {
  border: '1px solid #d1d5db',
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 14,
};

const primaryButton = {
  border: 'none',
  borderRadius: 8,
  padding: '8px 12px',
  background: '#111827',
  color: '#fff',
  cursor: 'pointer',
};

const secondaryButton = {
  border: '1px solid #d1d5db',
  borderRadius: 8,
  padding: '8px 12px',
  background: '#fff',
  color: '#111827',
  cursor: 'pointer',
};
