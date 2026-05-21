import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

import { getRessources } from '../../api/resources';
import { createDemande } from '../../api/requests';
import { getEtablissements, getBatiments, getServices, getBeneficiaires, getPersonnelByService } from '../../api/users';
import { useAuthStore } from '../../store/authStore';

// ── Design tokens ─────────────────────────────────────────────────────────
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
};

// ── Field helpers ─────────────────────────────────────────────────────────
function Field({ label, required, children }) {
  return (
    <label style={fieldWrapStyle}>
      {label && (
        <span style={fieldLabelStyle}>
          {label}
          {required && <span style={{ color: C.danger, marginLeft: 2 }}>*</span>}
        </span>
      )}
      {children}
    </label>
  );
}

function Input({ style: extra, ...props }) {
  return <input style={{ ...fieldInputStyle, ...extra }} {...props} />;
}

function Select({ style: extra, children, ...props }) {
  return (
    <select style={{ ...fieldInputStyle, ...extra }} {...props}>
      {children}
    </select>
  );
}

function Textarea({ style: extra, ...props }) {
  return (
    <textarea
      style={{ ...fieldInputStyle, height: 'auto', minHeight: 88, resize: 'vertical', ...extra }}
      {...props}
    />
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────
function toServiceId(user) {
  return Number(
    user?.service?.id || user?.id_service?.id_service || user?.id_service || 0
  );
}

// ── Component ─────────────────────────────────────────────────────────────
export default function NouvelleDemandeModal({ onClose, onCreated }) {
  const user = useAuthStore((state) => state.user);

  const [urgence, setUrgence]                         = useState('normal');
  const [justification, setJustification]             = useState('');
  const [typeAcquisition, setTypeAcquisition]         = useState('consommable');
  const [selectedRessourceId, setSelectedRessourceId] = useState('');
  const [quantiteDemandee, setQuantiteDemandee]       = useState(1);
  const [lignes, setLignes]                           = useState([]);
  const [formError, setFormError]                     = useState('');

  // ── Cascading hierarchy state ───────────────────────────────────────────
  const [selectedEtabId, setSelectedEtabId]           = useState('');
  const [selectedBatimentId, setSelectedBatimentId]   = useState('');
  const [selectedServiceId, setSelectedServiceId]     = useState('');
  const [selectedBenefId, setSelectedBenefId]         = useState('');
  const [selectedPersonnelId, setSelectedPersonnelId] = useState('');

  const todayDisplay = useMemo(() => new Date().toLocaleDateString('fr-FR'), []);

  // ── Auto-fill hierarchy from user profile ────────────────────────────────
  const userService = user?.service;
  const userEtabId    = String(userService?.etablissement?.id ?? userService?.etablissement?.idEtablissement ?? '');
  const userEtabNom   = userService?.etablissement?.nom ?? '';
  const userBatId     = String(userService?.batiment?.id ?? userService?.batiment?.idBatiment ?? '');
  const userBatNom    = userService?.batiment?.nom ?? '';
  const userSvcId     = String(userService?.id ?? '');
  const userSvcNom    = userService?.nom ?? userService?.nomService ?? '';
  const isProfileLocked = Boolean(userSvcId);

  // Pre-fill on mount from user profile
  useEffect(() => {
    if (isProfileLocked) {
      setSelectedEtabId(userEtabId);
      setSelectedBatimentId(userBatId);
      setSelectedServiceId(userSvcId);
    }
  }, [isProfileLocked, userEtabId, userBatId, userSvcId]);

  // ── Hierarchy queries (only used if profile NOT locked) ─────────────────
  const etabQuery = useQuery({
    queryKey: ['hierarchy', 'etablissements'],
    queryFn: getEtablissements,
    staleTime: 300_000,
    enabled: !isProfileLocked,
  });
  const etablissements = etabQuery.data?.data || [];

  const batQuery = useQuery({
    queryKey: ['hierarchy', 'batiments', selectedEtabId],
    queryFn: () => getBatiments({ id_etablissement: selectedEtabId }),
    enabled: !isProfileLocked && Boolean(selectedEtabId),
    staleTime: 300_000,
  });
  const batiments = batQuery.data?.data || [];

  const svcQuery = useQuery({
    queryKey: ['hierarchy', 'services', selectedBatimentId],
    queryFn: () => getServices({ id_batiment: selectedBatimentId }),
    enabled: !isProfileLocked && Boolean(selectedBatimentId),
    staleTime: 300_000,
  });
  const services = svcQuery.data?.data || [];

  // ── Beneficiaires for user's service ────────────────────────────────────
  const benefQuery = useQuery({
    queryKey: ['hierarchy', 'beneficiaires', userSvcId],
    queryFn: () => getBeneficiaires({ id_service: userSvcId }),
    enabled: Boolean(userSvcId),
    staleTime: 300_000,
  });
  const beneficiaires = benefQuery.data?.data || [];

  const _benId   = (b) => b.idBeneficiaire ?? b.id_beneficiaire;
  const _benNom  = (b) => b.nom;
  const _benRole = (b) => b.roleType ?? b.role_type;

  // Split beneficiaries into personnel and non-personnel
  const nonPersonnelBeneficiaires = useMemo(() => {
    return beneficiaires.filter((b) => _benRole(b) !== 'personnel');
  }, [beneficiaires]);

  const personnelBeneficiaires = useMemo(() => {
    return beneficiaires.filter((b) => _benRole(b) === 'personnel');
  }, [beneficiaires]);

  const isPersonnelBenef = selectedBenefId === 'personnel_group';

  // ── Data queries ────────────────────────────────────────────────────────
  const _rId = (r) => r.idRessource ?? r.id_ressource;

  // Clear article when type changes
  useEffect(() => {
    setSelectedRessourceId('');
  }, [typeAcquisition]);

  // Fetch articles filtered by selected type
  const ressourcesQuery = useQuery({
    queryKey: ['resources', 'ressources', 'by-type', typeAcquisition],
    queryFn: () => getRessources({ type: typeAcquisition }),
    staleTime: 30_000,
  });
  const ressources = ressourcesQuery.data?.data || [];

  // Derive category/sub-category from the selected article
  const selectedRessource = useMemo(
    () => ressources.find((r) => String(_rId(r)) === String(selectedRessourceId)) ?? null,
    [ressources, selectedRessourceId], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const autoCategorieNom = selectedRessource?.categorie?.nomCategorie
    ?? selectedRessource?.categorie?.nom_categorie
    ?? '';
  const autoSousCategorieNom = selectedRessource?.sousCategorie?.nomSousCategorie
    ?? selectedRessource?.sous_categorie?.nom_sous_categorie
    ?? '';

  // ── Mutations ───────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: createDemande,
    onSuccess: () => { onCreated?.(); onClose?.(); },
    onError: (err) => {
      const detail =
        err?.response?.data?.detail ||
        err?.response?.data?.non_field_errors?.[0] ||
        'Impossible de créer la demande.';
      setFormError(String(detail));
    },
  });

  // ── Handlers ────────────────────────────────────────────────────────────
  function handleAddLigne() {
    setFormError('');
    const selected = ressources.find((r) => String(_rId(r)) === String(selectedRessourceId));
    const quantite = Number(quantiteDemandee);
    if (!selected || !Number.isInteger(quantite) || quantite <= 0) {
      setFormError('Sélectionnez un article et une quantité valide.');
      return;
    }
    if (lignes.some((l) => Number(l.id_ressource) === Number(_rId(selected)))) {
      setFormError('Cet article est déjà ajouté.');
      return;
    }
    setLignes((prev) => [
      ...prev,
      { id_ressource: Number(_rId(selected)), designation: selected.designation, quantite_demandee: quantite },
    ]);
    setSelectedRessourceId('');
    setQuantiteDemandee(1);
  }

  function handleRemoveLigne(idRessource) {
    setLignes((prev) => prev.filter((l) => Number(l.id_ressource) !== Number(idRessource)));
  }

  async function handleSubmit() {
    setFormError('');
    if (!userSvcId) { setFormError('Votre compte n\'est pas associé à un service.'); return; }
    if (!selectedBenefId) { setFormError('Veuillez sélectionner un bénéficiaire.'); return; }
    if (!lignes.length) { setFormError('Ajoutez au moins une ligne.'); return; }

    // If the beneficiary is "personnel", a specific person must be selected
    if (isPersonnelBenef && !selectedPersonnelId) {
      setFormError('Veuillez sélectionner un personnel.');
      return;
    }

    // Resolve the actual beneficiaire ID and details
    let actualBenefId;
    let benefRole;
    let benefNom;
    let benefDetail = '';

    if (isPersonnelBenef) {
      // selectedPersonnelId is the actual beneficiaire ID from personnelBeneficiaires
      actualBenefId = Number(selectedPersonnelId);
      const person = personnelBeneficiaires.find((b) => String(_benId(b)) === String(selectedPersonnelId));
      benefRole = 'personnel';
      benefNom = person ? _benNom(person) : '';
      benefDetail = benefNom;
    } else {
      actualBenefId = Number(selectedBenefId);
      const benef = nonPersonnelBeneficiaires.find((b) => String(_benId(b)) === String(selectedBenefId));
      benefRole = benef ? _benRole(benef) : '';
      benefNom = benef ? _benNom(benef) : '';
    }

    await createMutation.mutateAsync({
      urgence,
      type_demandeur: 'chef_service',
      beneficiaire_type: benefRole || 'service',
      beneficiaire_nom: benefNom,
      beneficiaire_detail: benefDetail,
      justification,
      id_service: userSvcId,
      id_beneficiaire: actualBenefId,
      lignes: lignes.map((l) => ({
        id_ressource: Number(l.id_ressource),
        quantite_demandee: Number(l.quantite_demandee),
      })),
    });
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalShellStyle} onClick={(e) => e.stopPropagation()}>

        {/* ── Header: centered title with teal underline ── */}
        <div style={modalHeaderStyle}>
          <div style={headerTitleBlockStyle}>
            <h2 style={modalTitleStyle}>
              Formulaire de demande de Fourniture/Équipement
            </h2>
          </div>
          <button type="button" style={closeBtnStyle} onClick={onClose}>✕</button>
        </div>

        {/* ── Scrollable body ── */}
        <div style={modalBodyStyle}>

          {/* Informations générales */}
          <section style={sectionCardStyle}>
            <h3 style={sectionTitleStyle}>Informations générales</h3>
            <div style={row2Style}>
              <Field label="Date">
                <Input value={todayDisplay} readOnly style={{ color: C.textMuted }} />
              </Field>
              <Field label="Urgence">
                <Select value={urgence} onChange={(e) => setUrgence(e.target.value)}>
                  <option value="normal">Normal</option>
                  <option value="moyen">Moyen</option>
                  <option value="urgent">Urgent</option>
                </Select>
              </Field>
            </div>
          </section>

          {/* Désignation du demandeur — auto-assigned from user profile */}
          <section style={sectionCardStyle}>
            <h3 style={sectionTitleStyle}>Désignation du demandeur</h3>
            <div style={row2Style}>
              <Field label="Établissement" required>
                {isProfileLocked ? (
                  <Input value={userEtabNom || '—'} readOnly disabled style={{ color: C.textMuted, background: C.bgSubtle }} />
                ) : (
                  <Select
                    value={selectedEtabId}
                    onChange={(e) => {
                      setSelectedEtabId(e.target.value);
                      setSelectedBatimentId('');
                      setSelectedServiceId('');
                      setSelectedBenefId('');
                    }}
                  >
                    <option value="">— Choisir —</option>
                    {etablissements.map((e) => (
                      <option key={_eId(e)} value={_eId(e)}>{_eNom(e)}</option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Bâtiment" required>
                {isProfileLocked ? (
                  <Input value={userBatNom || '—'} readOnly disabled style={{ color: C.textMuted, background: C.bgSubtle }} />
                ) : (
                  <Select
                    value={selectedBatimentId}
                    onChange={(e) => {
                      setSelectedBatimentId(e.target.value);
                      setSelectedServiceId('');
                      setSelectedBenefId('');
                    }}
                    disabled={!selectedEtabId}
                    style={{ color: !selectedEtabId ? C.textMuted : undefined }}
                  >
                    <option value="">— Choisir —</option>
                    {batiments.map((b) => (
                      <option key={_bId(b)} value={_bId(b)}>{_bNom(b)}</option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
            <div style={row2Style}>
              <Field label="Service" required>
                {isProfileLocked ? (
                  <Input value={userSvcNom || '—'} readOnly disabled style={{ color: C.textMuted, background: C.bgSubtle }} />
                ) : (
                  <Select
                    value={selectedServiceId}
                    onChange={(e) => {
                      setSelectedServiceId(e.target.value);
                      setSelectedBenefId('');
                    }}
                    disabled={!selectedBatimentId}
                    style={{ color: !selectedBatimentId ? C.textMuted : undefined }}
                  >
                    <option value="">— Choisir —</option>
                    {services.map((s) => (
                      <option key={_sId(s)} value={_sId(s)}>{_sNom(s)}</option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Bénéficiaire" required>
                <Select
                  value={selectedBenefId}
                  onChange={(e) => { setSelectedBenefId(e.target.value); setSelectedPersonnelId(''); }}
                  disabled={!selectedServiceId}
                  style={{ color: !selectedServiceId ? C.textMuted : undefined }}
                >
                  <option value="">— Choisir —</option>
                  {nonPersonnelBeneficiaires.map((b) => (
                    <option key={_benId(b)} value={_benId(b)}>
                      {_benNom(b)} ({_benRole(b) === 'chef_service' ? 'Chef' : _benRole(b) === 'secretariat' ? 'Secrétariat' : _benRole(b) === 'salle_de_cours' ? 'Salle de cours' : _benRole(b) === 'fonctionnaire' ? 'Fonctionnaire' : _benRole(b) === 'prof' ? 'Prof' : _benRole(b)})
                    </option>
                  ))}
                  {personnelBeneficiaires.length > 0 && (
                    <option value="personnel_group">Personnel</option>
                  )}
                </Select>
              </Field>
            </div>
            {/* Personnel dropdown — shown when beneficiary type is 'personnel' */}
            {isPersonnelBenef && (
              <Field label="Nom du personnel" required>
                <Select
                  value={selectedPersonnelId}
                  onChange={(e) => setSelectedPersonnelId(e.target.value)}
                >
                  <option value="">— Choisir un personnel —</option>
                  {personnelBeneficiaires.map((b) => (
                    <option key={_benId(b)} value={_benId(b)}>{_benNom(b)}</option>
                  ))}
                </Select>
              </Field>
            )}
          </section>

          {/* Type d'article */}
          <section style={sectionCardStyle}>
            <h3 style={sectionTitleStyle}>{"Type d'article"}</h3>
            <div style={chipRowStyle}>
              <button
                type="button"
                style={chipStyle(typeAcquisition === 'consommable')}
                onClick={() => setTypeAcquisition('consommable')}
              >
                Consommable
              </button>
              <button
                type="button"
                style={chipStyle(typeAcquisition === 'bien_inventaire')}
                onClick={() => setTypeAcquisition('bien_inventaire')}
              >
                Bien inventaire
              </button>
            </div>
          </section>

          {/* Ajouter un article */}
          <section style={sectionCardStyle}>
            <h3 style={sectionTitleStyle}>Ajouter un article</h3>
            {/* Article dropdown */}
            <Field label="Article">
              <Select
                value={selectedRessourceId}
                onChange={(e) => setSelectedRessourceId(e.target.value)}
                style={{ color: !selectedRessourceId ? C.textMuted : undefined }}
              >
                <option value="">{"Sélectionner un article…"}</option>
                {ressources.map((r) => (
                  <option key={_rId(r)} value={_rId(r)}>{r.designation}</option>
                ))}
              </Select>
            </Field>
            {/* Auto-populated Catégorie / Sous-catégorie */}
            <div style={row2Style}>
              <Field label="Catégorie">
                <Input
                  value={autoCategorieNom}
                  readOnly
                  placeholder="— auto —"
                  style={{ color: autoCategorieNom ? C.textSecondary : C.textMuted, background: C.bgSubtle }}
                />
              </Field>
              <Field label="Sous-catégorie">
                <Input
                  value={autoSousCategorieNom}
                  readOnly
                  placeholder="— auto —"
                  style={{ color: autoSousCategorieNom ? C.textSecondary : C.textMuted, background: C.bgSubtle }}
                />
              </Field>
            </div>
            {/* Quantité + Add button */}
            <div style={addQtyRowStyle}>
              <Field label="Quantité">
                <Input
                  type="number"
                  min={1}
                  value={quantiteDemandee}
                  onChange={(e) => setQuantiteDemandee(e.target.value)}
                />
              </Field>
              <button type="button" style={{ ...addBtnStyle, alignSelf: 'end' }} onClick={handleAddLigne}>
                + Ajouter
              </button>
            </div>
            {!ressources.length && (
              <p style={emptyHintStyle}>Aucun article disponible pour ce type.</p>
            )}
          </section>

          {/* Articles sélectionnés */}
          <section style={sectionCardStyle}>
            <h3 style={sectionTitleStyle}>
              Articles sélectionnés
              {lignes.length > 0 && (
                <span style={badgeStyle}>{lignes.length}</span>
              )}
            </h3>
            {lignes.length === 0 ? (
              <p style={emptyHintStyle}>Aucun article sélectionné.</p>
            ) : (
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {lignes.map((line) => (
                  <div key={line.id_ressource} style={ligneRowStyle}>
                    <span style={ligneDesignationStyle}>{line.designation}</span>
                    <span style={{ fontSize: '0.8rem', color: C.textSecondary, fontWeight: 500 }}>Qté</span>
                    <input
                      style={{ ...fieldInputStyle, width: 72, textAlign: 'center', padding: '0.5rem 0.25rem' }}
                      type="number"
                      min={1}
                      value={line.quantite_demandee}
                      onChange={(e) => {
                        const next = Number(e.target.value);
                        setLignes((prev) =>
                          prev.map((item) =>
                            item.id_ressource === line.id_ressource
                              ? { ...item, quantite_demandee: Number.isNaN(next) ? 1 : Math.max(1, next) }
                              : item
                          )
                        );
                      }}
                    />
                    <button
                      type="button"
                      style={removeBtnStyle}
                      onClick={() => handleRemoveLigne(line.id_ressource)}
                    >
                      Retirer
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Justificatif */}
          <section style={sectionCardStyle}>
            <h3 style={sectionTitleStyle}>Justificatif</h3>
            <Field label="Commentaire / Justification">
              <Textarea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Décrivez le besoin, la raison ou toute information utile…"
              />
            </Field>
          </section>

        </div>

        {/* ── Sticky footer ── */}
        <div style={modalFooterStyle}>
          {formError && <span style={errorStyle}>{formError}</span>}
          <div style={{ display: 'flex', gap: '0.75rem', marginLeft: 'auto' }}>
            <button type="button" style={cancelBtnStyle} onClick={onClose}>
              Annuler
            </button>
            <button
              type="button"
              style={{ ...submitBtnStyle, opacity: createMutation.isPending ? 0.6 : 1 }}
              onClick={handleSubmit}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Envoi…' : 'Envoyer la demande'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────
const overlayStyle = {
  position: 'fixed',
  inset: 0,
  zIndex: 100,
  background: 'rgba(15, 23, 42, 0.45)',
  display: 'grid',
  placeItems: 'center',
  padding: '1rem',
};

const modalShellStyle = {
  width: 'min(680px, 100%)',
  maxHeight: '90vh',
  background: C.bgWhite,
  borderRadius: '1rem',
  border: `1px solid ${C.border}`,
  boxShadow: '0 20px 48px rgba(15, 23, 42, 0.18)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const modalHeaderStyle = {
  position: 'relative',
  padding: '1.5rem 1.5rem 0',
  background: C.bgWhite,
  flexShrink: 0,
};

const headerTitleBlockStyle = {
  textAlign: 'center',
  paddingBottom: '1.25rem',
  borderBottom: '3px solid #1a7abf',
};

const modalTitleStyle = {
  margin: '0 0 0',
  fontSize: '1.25rem',
  fontWeight: 700,
  color: '#0C447C',
  lineHeight: 1.3,
};

const titleUnderlineStyle = { display: 'none' };

const closeBtnStyle = {
  position: 'absolute',
  top: '1.25rem',
  right: '1.25rem',
  border: 'none',
  background: 'transparent',
  fontSize: '1rem',
  color: C.textMuted,
  cursor: 'pointer',
  lineHeight: 1,
  padding: '0.25rem',
};

const modalBodyStyle = {
  flex: 1,
  overflowY: 'auto',
  padding: '1.25rem 1.5rem',
  display: 'grid',
  gap: '1rem',
  alignContent: 'start',
};

const modalFooterStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '1rem 1.5rem',
  borderTop: `1px solid ${C.border}`,
  flexShrink: 0,
  background: C.bgWhite,
};

const sectionCardStyle = {
  border: `1px solid ${C.border}`,
  borderRadius: '0.75rem',
  background: C.bgWhite,
  padding: '1rem 1.25rem',
  display: 'grid',
  gap: '0.875rem',
};

const sectionTitleStyle = {
  margin: 0,
  fontSize: '0.9375rem',
  fontWeight: 600,
  color: C.textPrimary,
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
};

const row2Style = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '1rem',
};

const chipRowStyle = {
  display: 'flex',
  gap: '0.5rem',
};

const chipStyle = (active) => ({
  border: `1px solid ${active ? '#0C447C' : C.border}`,
  borderRadius: '0.5rem',
  padding: '0.5rem 1.25rem',
  fontSize: '0.875rem',
  fontWeight: 600,
  cursor: 'pointer',
  background: active ? '#0C447C' : C.bgSubtle,
  color: active ? '#fff' : C.textSecondary,
  transition: 'all 0.15s',
});

const addArticleRowStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr 5rem auto',
  gap: '0.75rem',
  alignItems: 'end',
};

const addQtyRowStyle = {
  display: 'grid',
  gridTemplateColumns: '5rem auto',
  gap: '0.75rem',
  alignItems: 'end',
};

const addBtnStyle = {
  border: 'none',
  borderRadius: '0.375rem',
  padding: '0 1rem',
  height: '2.5rem',
  fontSize: '0.875rem',
  fontWeight: 600,
  background: '#1a7abf',
  color: '#fff',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const ligneRowStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr auto auto auto',
  gap: '0.75rem',
  alignItems: 'center',
  padding: '0.625rem 0.75rem',
  border: `1px solid ${C.border}`,
  borderRadius: '0.5rem',
  background: C.bgSubtle,
};

const ligneDesignationStyle = {
  fontSize: '0.875rem',
  fontWeight: 500,
  color: C.textPrimary,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const removeBtnStyle = {
  border: `1px solid #fecaca`,
  background: '#fff5f5',
  color: '#b91c1c',
  borderRadius: '0.375rem',
  padding: '0.3rem 0.625rem',
  fontSize: '0.8rem',
  fontWeight: 500,
  cursor: 'pointer',
};

const badgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '1.375rem',
  height: '1.375rem',
  borderRadius: '999px',
  background: C.accent,
  color: '#fff',
  fontSize: '0.7rem',
  fontWeight: 700,
  padding: '0 0.3rem',
};

const emptyHintStyle = {
  margin: 0,
  fontSize: '0.8rem',
  color: C.textMuted,
  fontStyle: 'italic',
};

const fieldWrapStyle = {
  display: 'grid',
  gap: '0.375rem',
};

const fieldLabelStyle = {
  fontSize: '0.8125rem',
  fontWeight: 500,
  color: C.textSecondary,
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

const errorStyle = {
  fontSize: '0.8125rem',
  color: C.danger,
  fontWeight: 500,
};

const cancelBtnStyle = {
  border: `1px solid ${C.border}`,
  borderRadius: '0.375rem',
  padding: '0.5rem 1.125rem',
  fontSize: '0.875rem',
  fontWeight: 500,
  color: C.textSecondary,
  background: C.bgWhite,
  cursor: 'pointer',
};

const submitBtnStyle = {
  border: 'none',
  borderRadius: '0.375rem',
  padding: '0.5rem 1.5rem',
  height: '2.5rem',
  fontSize: '0.875rem',
  fontWeight: 600,
  color: '#fff',
  background: '#1a7abf',
  cursor: 'pointer',
};
