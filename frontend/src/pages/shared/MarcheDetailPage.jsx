import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  getMarcheDetail, getLotsByMarche, confirmerReception, refuserMarche,
  getStagingItems, changerEtape, updateMarche, updateImport,
} from '../../api/procurement';
import PageBackButton from '../../components/ui/PageBackButton';
import StagingClassificationTable from '../../components/procurement/StagingClassificationTable';

// ── Constants ────────────────────────────────────────────────────────────────

const ORDERED_ETAPES = [
  'marche_cree', 'en_attente_livraison', 'livraison_en_cours',
  'receptionne_magasin', 'controle_qualite', 'stocker_au_magasin',
  'paiement_en_cours', 'paiement_effectue',
];

const ETAPE_LABELS = {
  marche_cree:          'Marché créé',
  contrat_signe:        'Contrat signé',
  en_attente_livraison: 'En attente de livraison',
  livraison_en_cours:   'Livraison en cours',
  receptionne_magasin:  'Réceptionné au magasin',
  controle_qualite:     'Contrôle qualité',
  bl_valide:            'Bon de livraison est validé',
  stocker_au_magasin:   'Stocker au magasin',
  paiement_en_cours:    'Paiement en cours',
  paiement_effectue:    'Paiement effectué',
};

const ETAPE_STATUT = {
  complete:   { dot: '#16a34a', bg: '#dcfce7', color: '#166534', label: 'Complète'   },
  en_cours:   { dot: '#2563eb', bg: '#dbeafe', color: '#1e40af', label: 'En cours'   },
  en_attente: { dot: '#cbd5e1', bg: '#f1f5f9', color: '#64748b', label: 'En attente' },
  bloque:     { dot: '#ef4444', bg: '#fee2e2', color: '#991b1b', label: 'Bloquée'    },
};

const STATUT_LABEL = {
  en_attente_livraison:  'En attente de livraison',
  receptionne_et_stocke: 'Réceptionné',
  non_conforme:          'Non conforme',
  refuse:                'Refusé',
};
const STATUT_STYLE = {
  en_attente_livraison:  { background: '#fffbeb', color: '#92400e' },
  receptionne_et_stocke: { background: '#f0fdf4', color: '#166534' },
  non_conforme:          { background: '#fef2f2', color: '#991b1b' },
  refuse:                { background: '#fef2f2', color: '#991b1b' },
};

const TYPE_LABEL = {
  marche:       'Marché',
  bon_commande: 'Bon de commande',
  donation:     'Don',
};
const TYPE_STYLE = {
  marche:       { background: '#eef2ff', color: '#4338ca' },
  bon_commande: { background: '#f1f5f9', color: '#475569' },
  donation:     { background: '#fffbeb', color: '#92400e' },
};

const STATUT_CHOICES = [
  { value: 'en_attente_livraison',  label: 'En attente de livraison' },
  { value: 'receptionne_et_stocke', label: 'Réceptionné' },
  { value: 'refuse',                label: 'Refusé' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d) ? '—' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function receptionDate(etapes) {
  const e = etapes?.find((e) => (e.nom_etape ?? e.nomEtape) === 'receptionne_magasin');
  return e?.date_fin ?? e?.dateFin ?? null;
}

function SmallBadge({ label, style }) {
  return (
    <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 600, borderRadius: 999, padding: '2px 9px', ...style }}>
      {label}
    </span>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '5px 0', borderBottom: '1px solid #f8fafc' }}>
      <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500, width: 175, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: '#1e293b' }}>{value ?? '—'}</span>
    </div>
  );
}

function FormRow({ label, children }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '5px 0', borderBottom: '1px solid #f8fafc', alignItems: 'center' }}>
      <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500, width: 175, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function MarcheDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isFinanciere = location.pathname.startsWith('/financiere');
  const queryClient = useQueryClient();

  // Modal & edit state
  const [etapeModal, setEtapeModal] = useState(null); // { nom_etape, label }
  const [editInfos, setEditInfos]   = useState(false);
  const [infosForm, setInfosForm]   = useState({});

  // ── Queries ─────────────────────────────────────────────────────────────────

  const confirmerMutation = useMutation({
    mutationFn: () => confirmerReception(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement', 'marche', id] });
      queryClient.invalidateQueries({ queryKey: ['procurement', 'marches'] });
    },
  });

  const refuserMutation = useMutation({
    mutationFn: (motif) => refuserMarche(id, { motif_rejet: motif }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement', 'marche', id] });
      queryClient.invalidateQueries({ queryKey: ['procurement', 'marches'] });
    },
  });

  const changerEtapeMutation = useMutation({
    mutationFn: (nomEtape) => changerEtape(id, nomEtape),
    onSuccess: () => {
      setEtapeModal(null);
      queryClient.invalidateQueries({ queryKey: ['procurement', 'marche', id] });
    },
  });

  const patchMarcheMutation = useMutation({
    mutationFn: (data) => updateMarche(id, data),
    onSuccess: () => {
      setEditInfos(false);
      queryClient.invalidateQueries({ queryKey: ['procurement', 'marche', id] });
    },
  });

  const marcheQuery = useQuery({
    queryKey: ['procurement', 'marche', id],
    queryFn: () => getMarcheDetail(id),
    staleTime: 30000,
  });

  const lotsQuery = useQuery({
    queryKey: ['procurement', 'lots', id],
    queryFn: () => getLotsByMarche(id),
    staleTime: 30000,
    enabled: !!id,
  });

  const marche      = marcheQuery.data?.data;
  const importExcelObj = marche?.import_excel ?? marche?.importExcel;
  const importId    = importExcelObj?.id_import ?? importExcelObj?.idImport ?? importExcelObj?.id;

  const stagingQuery = useQuery({
    queryKey: ['procurement', 'staging', importId],
    queryFn: () => getStagingItems(importId),
    enabled: !!importId && marche?.statut === 'en_attente_livraison',
  });

  const rawLots    = lotsQuery.data?.data || [];
  const rawStaging = stagingQuery.data?.data || [];

  // Derived values — computed before early returns so hooks order is stable
  const etapes = marche?.etapes ?? [];

  const nextEtape = useMemo(() => {
    if (!etapes.length) return null;
    const sorted = [...etapes].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
    const lastCompleteIdx = sorted.reduce((acc, e, i) => (e.statut === 'complete' ? i : acc), -1);
    const nextIdx = lastCompleteIdx + 1;
    return nextIdx < sorted.length ? sorted[nextIdx] : null;
  }, [etapes]);

  if (marcheQuery.isLoading) {
    return <div style={{ height: 220, borderRadius: 10, background: '#f3f4f6' }} />;
  }
  if (!marche) {
    return <div style={{ color: '#b91c1c', padding: 24 }}>Marché introuvable.</div>;
  }

  const lots = rawLots.length > 0 ? rawLots : rawStaging.map(s => ({
    id_lot: `staging-${s.id_staging || s.idStaging}`,
    designation: s.designation_normalisee || s.designation_brute,
    quantite_commandee: s.quantite,
    quantite_recue: s.quantite,
    ressource: s.id_ressource_liee || {
      categorie: s.categorie_suggeree,
      is_consommable: s.type_detecte === 'consommable' ? true : s.type_detecte === 'bien_inventaire' ? false : null,
    },
  }));

  const statut      = marche.statut ?? '';
  const typeAcq     = marche.type_acquisition ?? marche.typeAcquisition ?? '';
  const getEtapeLabel = (nom) =>
    nom === 'marche_cree' && typeAcq === 'bon_commande'
      ? 'Bon de Commande créé'
      : ETAPE_LABELS[nom] || nom;
  const importExcel = marche.import_excel ?? marche.importExcel ?? null;
  const fournisseur = marche.fournisseur ?? null;
  const isDonation  = typeAcq === 'donation';
  const dateRec     = receptionDate(etapes);

  // ── Handlers ───────────────────────────────────────────────────────────────

  function openEditInfos() {
    setInfosForm({
      titre_fichier:          importExcel?.titre_fichier          ?? importExcel?.titreFichier          ?? '',
      reference_document:     importExcel?.reference_document     ?? importExcel?.referenceDocument     ?? '',
      statut:                 statut,
      motif_rejet:            marche.motif_rejet                  ?? marche.motifRejet                  ?? '',
      date_livraison_prevue:  marche.date_livraison_prevue ?? marche.dateLivraisonPrevue ?? '',
      fournisseur_denomination: importExcel?.fournisseur_denomination ?? importExcel?.fournisseurDenomination
                                ?? fournisseur?.nom_societe ?? fournisseur?.nomSociete ?? '',
      fournisseur_telephone:  importExcel?.fournisseur_telephone ?? importExcel?.fournisseurTelephone
                                ?? fournisseur?.telephone ?? '',
      fournisseur_email:      importExcel?.fournisseur_email ?? importExcel?.fournisseurEmail
                                ?? fournisseur?.email ?? '',
      nom_donateur:           marche.nom_donateur       ?? marche.nomDonateur       ?? '',
      organisme_donateur:     marche.organisme_donateur ?? marche.organismeDonateur ?? '',
      type_donateur:          marche.type_donateur      ?? marche.typeDonateur      ?? '',
      contact_donateur:       marche.contact_donateur   ?? marche.contactDonateur   ?? '',
    });
    setEditInfos(true);
  }

  function saveInfos(e) {
    e.preventDefault();
    const payload = { statut: infosForm.statut };
    if (infosForm.statut === 'refuse') payload.motif_rejet = infosForm.motif_rejet;
    if (infosForm.date_livraison_prevue) payload.date_livraison_prevue = infosForm.date_livraison_prevue;
    if (isDonation) {
      payload.nom_donateur       = infosForm.nom_donateur;
      payload.organisme_donateur = infosForm.organisme_donateur;
      payload.type_donateur      = infosForm.type_donateur;
      payload.contact_donateur   = infosForm.contact_donateur;
    }
    // Persist import text fields (titre, ref doc, fournisseur) on the linked import
    if (importId) {
      updateImport(importId, {
        titre_fichier:            infosForm.titre_fichier,
        reference_document:       infosForm.reference_document,
        ...(!isDonation && {
          fournisseur_denomination: infosForm.fournisseur_denomination,
          fournisseur_telephone:    infosForm.fournisseur_telephone,
          fournisseur_email:        infosForm.fournisseur_email,
        }),
      }).catch(() => {});
    }
    patchMarcheMutation.mutate(payload);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 860 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <PageBackButton to="back" label="Retour" />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
            <h1 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: '#0f172a' }}>
              {marche.reference}
            </h1>
            <SmallBadge label={STATUT_LABEL[statut] || statut} style={STATUT_STYLE[statut] || {}} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#64748b' }}>
            <SmallBadge label={TYPE_LABEL[typeAcq] || typeAcq} style={TYPE_STYLE[typeAcq] || {}} />
            <span>Consultation</span>
          </div>
        </div>
      </div>

      {/* ── Action Bar (Validation) ── */}
      {statut === 'en_attente_livraison' && !isFinanciere && (
        <section style={{ ...sectionStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: 14, color: '#0f172a' }}>Validation de la commande</h3>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>Vérifiez les articles ci-dessous avant de confirmer la réception.</p>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: '#fff', color: '#dc2626', border: '1px solid #fca5a5', cursor: 'pointer' }}
              disabled={refuserMutation.isPending || confirmerMutation.isPending}
              onClick={() => {
                const motif = window.prompt('Motif du refus :');
                if (motif !== null) refuserMutation.mutate(motif);
              }}
            >
              {refuserMutation.isPending ? '...' : 'Refuser'}
            </button>
            <button
              style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: '#16a34a', color: '#fff', border: 'none', cursor: 'pointer' }}
              disabled={confirmerMutation.isPending || refuserMutation.isPending}
              onClick={() => {
                if (importId && rawStaging.length > 0) {
                  const unclassified = rawStaging.filter((s) => {
                    const hasRessource = s.id_ressource_liee || s.idRessourceLiee;
                    const hasType = s.type_detecte || s.typeDetecte;
                    const hasSubCat = s.id_sous_categorie_suggeree || s.idSousCategorieSuggeree;
                    return !hasRessource && (!hasType || !hasSubCat);
                  });
                  if (unclassified.length > 0) {
                    window.alert(`Impossible de confirmer. Veuillez d'abord classer (Type et Sous-catégorie) et "Enregistrer" les ${unclassified.length} article(s) non classé(s).`);
                    return;
                  }
                }
                if (window.confirm('Confirmer la réception de tous les articles ?')) {
                  confirmerMutation.mutate();
                }
              }}
            >
              {confirmerMutation.isPending ? '...' : 'Confirmer réception'}
            </button>
          </div>
        </section>
      )}

      {/* ── Section 1 : Articles livrés ── */}
      <section style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Articles livrés</h3>
        {lotsQuery.isLoading || stagingQuery.isLoading ? (
          <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>Chargement…</p>
        ) : importId && statut === 'en_attente_livraison' && rawLots.length === 0 ? (
          <StagingClassificationTable importId={importId} />
        ) : lots.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>Aucun article enregistré pour ce marché.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={thStyle}>Désignation</th>
                  <th style={thStyle}>Type</th>
                  <th style={{ ...thStyle, textAlign: 'right', width: 110 }}>Qté livrée</th>
                  <th style={{ ...thStyle, textAlign: 'right', width: 120 }}>Qté commandée</th>
                  <th style={thStyle}>Catégorie</th>
                </tr>
              </thead>
              <tbody>
                {lots.map((lot) => {
                  const res = lot.ressource ?? null;
                  const isConsommable = res?.is_consommable ?? res?.isConsommable ?? null;
                  return (
                    <tr key={lot.id_lot ?? lot.idLot} style={{ borderTop: '1px solid #f1f5f9' }}>
                      <td style={tdStyle}>{lot.designation || res?.designation || '—'}</td>
                      <td style={tdStyle}>
                        {isConsommable === null ? '—' : (
                          <SmallBadge
                            label={isConsommable ? 'Consommable' : 'Bien inventaire'}
                            style={isConsommable
                              ? { background: '#eff6ff', color: '#1d4ed8' }
                              : { background: '#fdf4ff', color: '#a21caf' }}
                          />
                        )}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {lot.quantite_recue ?? lot.quantiteRecue ?? '—'}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {lot.quantite_commandee ?? lot.quantiteCommandee ?? '—'}
                      </td>
                      <td style={tdStyle}>{res?.categorie ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Section 2 : Informations générales ── */}
      <section style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ ...sectionTitleStyle, marginBottom: 0 }}>Informations générales</h3>
          {!isFinanciere && !editInfos && statut !== 'receptionne_et_stocke' && (
            <button style={btnEdit} onClick={openEditInfos}>✏️ Modifier</button>
          )}
        </div>

        {editInfos ? (
          <form onSubmit={saveInfos}>
            <FormRow label="Titre">
              <input style={inputStyle} value={infosForm.titre_fichier} onChange={e => setInfosForm(f => ({ ...f, titre_fichier: e.target.value }))} />
            </FormRow>
            <FormRow label="Référence document">
              <input style={inputStyle} value={infosForm.reference_document} onChange={e => setInfosForm(f => ({ ...f, reference_document: e.target.value }))} />
            </FormRow>
            <FormRow label="Type">
              <input style={{ ...inputStyle, background: '#f8fafc', color: '#94a3b8' }} value={TYPE_LABEL[typeAcq] || typeAcq} disabled />
            </FormRow>
            <FormRow label="Statut">
              <select
                style={inputStyle}
                value={infosForm.statut}
                onChange={e => setInfosForm(f => ({ ...f, statut: e.target.value, motif_rejet: e.target.value !== 'refuse' ? '' : f.motif_rejet }))}
              >
                {STATUT_CHOICES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </FormRow>
            {infosForm.statut === 'refuse' && (
              <FormRow label="Motif / Commentaire *">
                <textarea
                  required
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 72, fontFamily: 'inherit', lineHeight: '20px' }}
                  value={infosForm.motif_rejet}
                  onChange={e => setInfosForm(f => ({ ...f, motif_rejet: e.target.value }))}
                  placeholder="Motif du refus…"
                />
              </FormRow>
            )}
            <FormRow label="Date de création">
              <input style={{ ...inputStyle, background: '#f8fafc', color: '#94a3b8' }} value={formatDate(marche.date_creation ?? marche.dateCreation)} disabled />
            </FormRow>
            <FormRow label="Date livraison prévue">
              <input style={inputStyle} type="date" value={infosForm.date_livraison_prevue} onChange={e => setInfosForm(f => ({ ...f, date_livraison_prevue: e.target.value }))} />
            </FormRow>
            <FormRow label="Délai prévu">
              <input style={{ ...inputStyle, background: '#f8fafc', color: '#94a3b8' }} value={(marche.delaiReceptionJours ?? marche.delai_reception_jours) != null ? `${marche.delaiReceptionJours ?? marche.delai_reception_jours} jours` : '—'} disabled />
            </FormRow>
            {!isDonation && (fournisseur || importExcel) && <>
              <FormRow label="Fournisseur">
                <input style={inputStyle} value={infosForm.fournisseur_denomination} onChange={e => setInfosForm(f => ({ ...f, fournisseur_denomination: e.target.value }))} />
              </FormRow>
              <FormRow label="Téléphone">
                <input style={inputStyle} value={infosForm.fournisseur_telephone} onChange={e => setInfosForm(f => ({ ...f, fournisseur_telephone: e.target.value }))} />
              </FormRow>
              <FormRow label="Email">
                <input style={inputStyle} type="email" value={infosForm.fournisseur_email} onChange={e => setInfosForm(f => ({ ...f, fournisseur_email: e.target.value }))} />
              </FormRow>
            </>}
            {isDonation && <>
              <FormRow label="Nom donateur">
                <input style={inputStyle} value={infosForm.nom_donateur} onChange={e => setInfosForm(f => ({ ...f, nom_donateur: e.target.value }))} />
              </FormRow>
              <FormRow label="Organisme">
                <input style={inputStyle} value={infosForm.organisme_donateur} onChange={e => setInfosForm(f => ({ ...f, organisme_donateur: e.target.value }))} />
              </FormRow>
              <FormRow label="Type donateur">
                <input style={inputStyle} value={infosForm.type_donateur} onChange={e => setInfosForm(f => ({ ...f, type_donateur: e.target.value }))} />
              </FormRow>
              <FormRow label="Contact">
                <input style={inputStyle} value={infosForm.contact_donateur} onChange={e => setInfosForm(f => ({ ...f, contact_donateur: e.target.value }))} />
              </FormRow>
            </>}
            {patchMarcheMutation.isError && (
              <p style={{ fontSize: 12, color: '#dc2626', margin: '8px 0 0' }}>
                {patchMarcheMutation.error?.response?.data?.detail || 'Erreur lors de l\'enregistrement.'}
              </p>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button type="submit" style={btnSave} disabled={patchMarcheMutation.isPending}>
                {patchMarcheMutation.isPending ? '…' : 'Enregistrer'}
              </button>
              <button type="button" style={btnCancel} onClick={() => setEditInfos(false)}>Annuler</button>
            </div>
          </form>
        ) : (
          <div>
            {(importExcel?.titre_fichier || importExcel?.titreFichier) && (
              <InfoRow label="Titre" value={importExcel.titre_fichier || importExcel.titreFichier} />
            )}
            {(importExcel?.reference_document || importExcel?.referenceDocument) && (
              <InfoRow label="Référence document" value={importExcel.reference_document || importExcel.referenceDocument} />
            )}
            <InfoRow label="Type" value={<SmallBadge label={TYPE_LABEL[typeAcq] || typeAcq} style={TYPE_STYLE[typeAcq] || {}} />} />
            <InfoRow label="Statut" value={<SmallBadge label={STATUT_LABEL[statut] || statut} style={STATUT_STYLE[statut] || {}} />} />
            <InfoRow label="Date de création" value={formatDate(marche.date_creation ?? marche.dateCreation)} />
            <InfoRow label="Date de réception" value={formatDate(dateRec)} />
            <InfoRow label="Délai prévu" value={(marche.delaiReceptionJours ?? marche.delai_reception_jours) != null ? `${marche.delaiReceptionJours ?? marche.delai_reception_jours} jours` : '—'} />
            <InfoRow label="Date d'attribution" value={formatDate(marche.date_attribution ?? marche.dateAttribution)} />
            <InfoRow label="Marque" value={marche.marque || '—'} />
            <InfoRow label="Comité de conformité" value={marche.comite_conformite ?? marche.comiteConformite ?? '—'} />
            {statut === 'refuse' && marche.motif_rejet && (
              <div style={{ display: 'flex', gap: 12, padding: '5px 0', borderBottom: '1px solid #f8fafc' }}>
                <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 600, width: 175, flexShrink: 0 }}>Motif du refus</span>
                <span style={{ fontSize: 13, color: '#991b1b' }}>{marche.motif_rejet}</span>
              </div>
            )}
            {!isDonation && (fournisseur || importExcel) && (() => {
              const nom = importExcel?.fournisseur_denomination || importExcel?.fournisseurDenomination
                       || fournisseur?.nom_societe || fournisseur?.nomSociete;
              const tel = importExcel?.fournisseur_telephone || importExcel?.fournisseurTelephone
                       || fournisseur?.telephone;
              const email = importExcel?.fournisseur_email || importExcel?.fournisseurEmail
                         || fournisseur?.email;
              return <>
                {nom   && <InfoRow label="Fournisseur" value={nom} />}
                {tel   && <InfoRow label="Téléphone"   value={tel} />}
                {email && <InfoRow label="Email"       value={email} />}
              </>;
            })()}
            {isDonation && <>
              <InfoRow label="Nom donateur"   value={marche.nom_donateur       || marche.nomDonateur       || '—'} />
              <InfoRow label="Organisme"      value={marche.organisme_donateur || marche.organismeDonateur || '—'} />
              {(marche.type_donateur    || marche.typeDonateur)    && <InfoRow label="Type donateur" value={marche.type_donateur    || marche.typeDonateur} />}
              {(marche.contact_donateur || marche.contactDonateur) && <InfoRow label="Contact"       value={marche.contact_donateur || marche.contactDonateur} />}
            </>}
          </div>
        )}
      </section>

      {/* ── Section 3 : Étapes ── */}
      {etapes.length > 0 && (
        <section style={sectionStyle}>
          <h3 style={sectionTitleStyle}>Étapes du marché</h3>
          <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {[...etapes].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0)).map((etape, idx, arr) => {
              const st      = etape.statut ?? 'en_attente';
              const nom     = etape.nom_etape ?? etape.nomEtape ?? '';
              const df      = etape.date_fin ?? etape.dateFin ?? null;
              const isLast  = idx === arr.length - 1;
              const isNext  = nextEtape && (etape.id_etape ?? etape.idEtape) === (nextEtape.id_etape ?? nextEtape.idEtape);
              const { dot, bg, color, label } = ETAPE_STATUT[st] || ETAPE_STATUT.en_attente;

              return (
                <li key={etape.id_etape ?? idx} style={{ display: 'flex', gap: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 18, flexShrink: 0 }}>
                    <div style={{
                      width: 12, height: 12, borderRadius: '50%', marginTop: 3, flexShrink: 0,
                      background: dot,
                      boxShadow: st === 'complete' ? `0 0 0 3px ${dot}33` : 'none',
                    }} />
                    {!isLast && <div style={{ width: 2, flex: 1, minHeight: 20, background: '#e2e8f0', marginTop: 2 }} />}
                  </div>
                  <div style={{ flex: 1, paddingBottom: isLast ? 4 : 18 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                        {getEtapeLabel(nom)}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 500, borderRadius: 999, padding: '2px 8px', background: bg, color }}>
                        {label}
                      </span>
                      {isNext && !isFinanciere && (
                        <button
                          style={btnNextEtape}
                          disabled={changerEtapeMutation.isPending}
                          onClick={() => setEtapeModal({ nom_etape: nom, label: getEtapeLabel(nom) })}
                        >
                          → Passer à cette étape
                        </button>
                      )}
                    </div>
                    {df && (
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                        Complétée le {formatDate(df)}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* ── Étape confirmation modal ── */}
      {etapeModal && (
        <div style={backdropStyle} onClick={() => setEtapeModal(null)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600, color: '#0f172a' }}>
              Confirmer l'avancement
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#374151' }}>
              Passer l'étape <strong>{etapeModal.label}</strong> au statut <strong>Complète</strong> ?
            </p>
            {changerEtapeMutation.isError && (
              <p style={{ fontSize: 12, color: '#dc2626', margin: '0 0 12px' }}>
                {changerEtapeMutation.error?.response?.data?.detail || 'Erreur.'}
              </p>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={btnCancel} onClick={() => setEtapeModal(null)}>Annuler</button>
              <button
                style={btnSave}
                disabled={changerEtapeMutation.isPending}
                onClick={() => changerEtapeMutation.mutate(etapeModal.nom_etape)}
              >
                {changerEtapeMutation.isPending ? '…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const sectionStyle = {
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  background: '#fff',
  padding: '16px 20px',
};

const sectionTitleStyle = {
  marginTop: 0,
  marginBottom: 14,
  fontSize: 14,
  fontWeight: 600,
  color: '#0f172a',
};

const tableStyle   = { width: '100%', borderCollapse: 'collapse', fontSize: 13 };
const thStyle      = { textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: 12,
                       padding: '8px 10px', borderBottom: '1px solid #e5e7eb' };
const tdStyle      = { padding: '8px 10px', color: '#374151', verticalAlign: 'middle' };

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  border: '1px solid #d1d5db', borderRadius: 6,
  padding: '5px 8px', fontSize: 13, color: '#1e293b',
  background: '#fff',
};

const btnBase = {
  border: 'none', borderRadius: 6, padding: '6px 14px',
  fontSize: 12, fontWeight: 600, cursor: 'pointer', lineHeight: '18px',
};
const btnEdit     = { ...btnBase, border: '1px solid #d1d5db', background: '#fff', color: '#374151' };
const btnSave     = { ...btnBase, background: '#0C447C', color: '#fff' };
const btnCancel   = { ...btnBase, border: '1px solid #d1d5db', background: '#fff', color: '#374151' };
const btnNextEtape = {
  ...btnBase, fontSize: 11, padding: '3px 10px',
  background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe',
};

const backdropStyle = {
  position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.45)',
  display: 'grid', placeItems: 'center', zIndex: 100,
};
const modalStyle = {
  width: 'min(420px, 92vw)', background: '#fff', borderRadius: 12,
  padding: '24px 28px', boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
};
