import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { getMarcheDetail, getLotsByMarche } from '../../api/procurement';
import PageBackButton from '../../components/ui/PageBackButton';

// ── Label / style maps ──────────────────────────────────────────────────────

const STATUT_LABEL = {
  en_attente_livraison:  'En attente de livraison',
  receptionne_et_stocke: 'Réceptionné',
  non_conforme:          'Non conforme',
};
const STATUT_STYLE = {
  en_attente_livraison:  { background: '#fffbeb', color: '#92400e' },
  receptionne_et_stocke: { background: '#f0fdf4', color: '#166534' },
  non_conforme:          { background: '#fef2f2', color: '#991b1b' },
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

const ETAPE_LABELS = {
  marche_cree:           'Marché créé',
  contrat_signe:         'Contrat signé',
  en_attente_livraison:  'En attente de livraison',
  livraison_en_cours:    'Livraison en cours',
  receptionne_magasin:   'Réceptionné au magasin',
  controle_qualite:      'Contrôle qualité',
  paiement_en_cours:     'Paiement en cours',
  paiement_effectue:     'Paiement effectué',
};
const ETAPE_STATUT = {
  complete:   { dot: '#16a34a', bg: '#dcfce7', color: '#166534', label: 'Complète'   },
  en_cours:   { dot: '#2563eb', bg: '#dbeafe', color: '#1e40af', label: 'En cours'   },
  en_attente: { dot: '#cbd5e1', bg: '#f1f5f9', color: '#64748b', label: 'En attente' },
  bloque:     { dot: '#ef4444', bg: '#fee2e2', color: '#991b1b', label: 'Bloquée'    },
};

// ── Helpers ─────────────────────────────────────────────────────────────────

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

// ── Page ────────────────────────────────────────────────────────────────────

export default function MarcheDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isFinanciere = location.pathname.startsWith('/financiere');

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

  const marche = marcheQuery.data?.data;
  const lots   = lotsQuery.data?.data || [];

  if (marcheQuery.isLoading) {
    return <div style={{ height: 220, borderRadius: 10, background: '#f3f4f6' }} />;
  }
  if (!marche) {
    return <div style={{ color: '#b91c1c', padding: 24 }}>Marché introuvable.</div>;
  }

  const statut      = marche.statut ?? '';
  const typeAcq     = marche.type_acquisition ?? marche.typeAcquisition ?? '';
  const etapes      = marche.etapes ?? [];
  const importExcel = marche.import_excel ?? marche.importExcel ?? null;
  const fournisseur = marche.fournisseur ?? null;
  const isDonation  = typeAcq === 'donation';
  const dateRec     = receptionDate(etapes);

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

      {/* ── Section 1 : Informations générales ── */}
      <section style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Informations générales</h3>
        <div>
          <InfoRow label="Référence" value={marche.reference} />
          <InfoRow label="Type" value={<SmallBadge label={TYPE_LABEL[typeAcq] || typeAcq} style={TYPE_STYLE[typeAcq] || {}} />} />
          <InfoRow label="Statut" value={<SmallBadge label={STATUT_LABEL[statut] || statut} style={STATUT_STYLE[statut] || {}} />} />
          <InfoRow label="Date de création" value={formatDate(marche.date_creation ?? marche.dateCreation)} />
          <InfoRow label="Date de réception" value={formatDate(dateRec)} />
          <InfoRow label="Délai prévu" value={marche.delai_reception_jours != null ? `${marche.delai_reception_jours} jours` : '—'} />
          {!isDonation && fournisseur && <>
            <InfoRow label="Fournisseur" value={fournisseur.nom_societe ?? fournisseur.nomSociete ?? '—'} />
            {fournisseur.telephone && <InfoRow label="Téléphone" value={fournisseur.telephone} />}
            {fournisseur.email && <InfoRow label="Email" value={fournisseur.email} />}
          </>}
          {isDonation && <>
            <InfoRow label="Nom donateur"    value={marche.nom_donateur        || marche.nomDonateur        || '—'} />
            <InfoRow label="Organisme"       value={marche.organisme_donateur  || marche.organismeDonateur  || '—'} />
            {(marche.type_donateur    || marche.typeDonateur)    && <InfoRow label="Type donateur" value={marche.type_donateur    || marche.typeDonateur} />}
            {(marche.contact_donateur || marche.contactDonateur) && <InfoRow label="Contact"       value={marche.contact_donateur || marche.contactDonateur} />}
          </>}
        </div>
      </section>

      {/* ── Section 2 : Articles livrés ── */}
      <section style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Articles livrés</h3>
        {lotsQuery.isLoading ? (
          <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>Chargement…</p>
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
                              : { background: '#faf5ff', color: '#7c3aed' }}
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

      {/* ── Section 3 : Étapes ── */}
      {etapes.length > 0 && (
        <section style={sectionStyle}>
          <h3 style={sectionTitleStyle}>Étapes du marché</h3>
          <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {etapes.map((etape, idx) => {
              const st   = etape.statut ?? 'en_attente';
              const nom  = etape.nom_etape ?? etape.nomEtape ?? '';
              const df   = etape.date_fin ?? etape.dateFin ?? null;
              const isLast = idx === etapes.length - 1;
              const { dot, bg, color, label } = ETAPE_STATUT[st] || ETAPE_STATUT.en_attente;
              return (
                <li key={etape.id_etape ?? idx} style={{ display: 'flex', gap: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 18, flexShrink: 0 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', marginTop: 3, flexShrink: 0, background: dot }} />
                    {!isLast && <div style={{ width: 2, flex: 1, minHeight: 20, background: '#e2e8f0', marginTop: 2 }} />}
                  </div>
                  <div style={{ flex: 1, paddingBottom: isLast ? 4 : 18 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                        {ETAPE_LABELS[nom] || nom}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 500, borderRadius: 999, padding: '2px 8px', background: bg, color }}>
                        {label}
                      </span>
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

      {/* ── Section 4 : Import lié ── */}
      {importExcel && (
        <section style={sectionStyle}>
          <h3 style={sectionTitleStyle}>Import lié</h3>
          <div>
            {(importExcel.reference_document || importExcel.referenceDocument) && (
              <InfoRow label="Référence document" value={importExcel.reference_document || importExcel.referenceDocument} />
            )}
            {(importExcel.fournisseur_denomination || importExcel.fournisseurDenomination) && (
              <InfoRow label="Fournisseur (import)" value={importExcel.fournisseur_denomination || importExcel.fournisseurDenomination} />
            )}
            {(importExcel.delai_execution || importExcel.delaiExecution) && (
              <InfoRow label="Délai d'exécution" value={importExcel.delai_execution || importExcel.delaiExecution} />
            )}
            <InfoRow label="Fichier" value={importExcel.titre_fichier || importExcel.titreFichier || '—'} />
          </div>
          {!isFinanciere && (
            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                style={linkBtnStyle}
                onClick={() => navigate(`/gestionnaire/donnees-extraites/${importExcel.id_import ?? importExcel.idImport}`)}
              >
                Voir dans Données Extraites →
              </button>
            </div>
          )}
        </section>
      )}

    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

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

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 13,
};

const thStyle = {
  textAlign: 'left',
  fontWeight: 600,
  color: '#64748b',
  fontSize: 12,
  padding: '8px 12px',
  borderBottom: '1px solid #e5e7eb',
};

const tdStyle = {
  padding: '9px 12px',
  color: '#1e293b',
  verticalAlign: 'middle',
};

const linkBtnStyle = {
  background: 'none',
  border: 'none',
  color: '#2563eb',
  fontSize: 13,
  cursor: 'pointer',
  padding: 0,
  textDecoration: 'underline',
};
