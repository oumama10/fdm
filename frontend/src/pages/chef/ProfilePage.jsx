import { useState, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { getMyProfile, updateMyProfile, getEtablissements, getBatiments, getServices } from '../../api/users';

// ── Design tokens ─────────────────────────────────────────────────────────
const C = {
  green:     '#0F6E56',
  lightGreen:'#1D9E75',
  textDark:  '#0f172a',
  textMid:   '#374151',
  textMuted: '#64748b',
  border:    '#e2e8f0',
  bgWhite:   '#ffffff',
  bgSubtle:  '#f8fafc',
  accent:    '#0C447C',
  danger:    '#ef4444',
  radius:    12,
  radiusSm:  8,
};

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: getMyProfile,
    staleTime: 60_000,
  });
  const profile = profileQuery.data?.data;

  const [nomComplet, setNomComplet] = useState('');
  const [titrePoste, setTitrePoste] = useState('');
  const [saved, setSaved] = useState(false);

  // ── Cascading hierarchy state ─────────────────────────────────────────
  const [selectedEtabId, setSelectedEtabId] = useState('');
  const [selectedBatId, setSelectedBatId] = useState('');
  const [selectedSvcId, setSelectedSvcId] = useState('');

  // Pre-fill from profile
  useEffect(() => {
    if (profile) {
      setNomComplet(profile.nomComplet ?? profile.nom_complet ?? '');
      setTitrePoste(profile.titrePoste ?? profile.titre_poste ?? '');
      // Pre-fill hierarchy from current service
      const svc = profile.service;
      if (svc) {
        setSelectedSvcId(String(svc.id ?? ''));
        if (svc.batiment) {
          setSelectedBatId(String(svc.batiment.id ?? svc.batiment.idBatiment ?? ''));
        }
        if (svc.etablissement) {
          setSelectedEtabId(String(svc.etablissement.id ?? svc.etablissement.idEtablissement ?? ''));
        }
      }
    }
  }, [profile]);

  // ── Hierarchy queries ─────────────────────────────────────────────────
  const etabQuery = useQuery({
    queryKey: ['hierarchy', 'etablissements'],
    queryFn: getEtablissements,
    staleTime: 300_000,
  });
  const etablissements = etabQuery.data?.data || [];

  const batQuery = useQuery({
    queryKey: ['hierarchy', 'batiments', selectedEtabId],
    queryFn: () => getBatiments({ id_etablissement: selectedEtabId }),
    enabled: Boolean(selectedEtabId),
    staleTime: 300_000,
  });
  const batiments = batQuery.data?.data || [];

  const svcQuery = useQuery({
    queryKey: ['hierarchy', 'services', selectedBatId],
    queryFn: () => getServices({ id_batiment: selectedBatId }),
    enabled: Boolean(selectedBatId),
    staleTime: 300_000,
  });
  const services = svcQuery.data?.data || [];

  // Accessors (camelCase DRF)
  const _eId  = (e) => e.idEtablissement ?? e.id_etablissement ?? e.id;
  const _eNom = (e) => e.nom;
  const _bId  = (b) => b.idBatiment ?? b.id_batiment ?? b.id;
  const _bNom = (b) => b.nom;
  const _sId  = (s) => s.idService ?? s.id_service ?? s.id;
  const _sNom = (s) => s.nomService ?? s.nom_service ?? s.nom;

  // Derive display names for current selection
  const selectedEtabNom = useMemo(() => {
    if (!selectedEtabId) return '—';
    const found = etablissements.find((e) => String(_eId(e)) === String(selectedEtabId));
    return found ? _eNom(found) : '—';
  }, [selectedEtabId, etablissements]);

  const selectedBatNom = useMemo(() => {
    if (!selectedBatId) return '—';
    const found = batiments.find((b) => String(_bId(b)) === String(selectedBatId));
    return found ? _bNom(found) : '—';
  }, [selectedBatId, batiments]);

  const selectedSvcNom = useMemo(() => {
    if (!selectedSvcId) return '—';
    const found = services.find((s) => String(_sId(s)) === String(selectedSvcId));
    return found ? _sNom(found) : '—';
  }, [selectedSvcId, services]);

  const mutation = useMutation({
    mutationFn: updateMyProfile,
    onSuccess: (res) => {
      const updated = res.data;
      // Sync the global auth store with updated profile data
      if (user) {
        setUser({
          ...user,
          nom_complet: updated.nomComplet ?? updated.nom_complet ?? user.nom_complet,
          nomComplet: updated.nomComplet ?? updated.nom_complet,
          titre_poste: updated.titrePoste ?? updated.titre_poste ?? user.titre_poste,
          service: updated.service ?? user.service,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  function handleSave() {
    const payload = {
      nom_complet: nomComplet.trim(),
      titre_poste: titrePoste.trim(),
    };
    if (selectedSvcId) {
      payload.id_service = Number(selectedSvcId);
    }
    mutation.mutate(payload);
  }

  const email = profile?.email ?? '—';
  const role  = profile?.role ?? '—';

  if (profileQuery.isLoading) {
    return (
      <div style={{ display: 'grid', gap: 16 }}>
        {[1, 2].map((i) => (
          <div key={i} style={{ height: 120, borderRadius: C.radius, background: C.bgSubtle }} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 20, paddingBottom: 40, maxWidth: 680 }}>

      {/* ── Header ── */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: `linear-gradient(135deg, ${C.green}, ${C.lightGreen})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 22, fontWeight: 700,
          }}>
            {(nomComplet || '?')[0].toUpperCase()}
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C.green }}>
              Mon profil
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: C.textMuted, marginTop: 2 }}>
              Consultez et modifiez vos informations personnelles.
            </p>
          </div>
        </div>
        <div style={{ height: 3, background: C.lightGreen, borderRadius: 2, margin: '16px -24px 0' }} />
      </div>

      {/* ── Editable fields ── */}
      <div style={card}>
        <h3 style={sectionTitle}>Informations modifiables</h3>
        <div style={{ marginTop: 16, display: 'grid', gap: 16 }}>
          <FieldRow label="Nom complet">
            <input
              style={inputStyle}
              value={nomComplet}
              onChange={(e) => setNomComplet(e.target.value)}
              placeholder="Votre nom complet"
            />
          </FieldRow>
          <FieldRow label="Titre / Poste">
            <input
              style={inputStyle}
              value={titrePoste}
              onChange={(e) => setTitrePoste(e.target.value)}
              placeholder="Ex: Chef de service chirurgie"
            />
          </FieldRow>
        </div>
      </div>

      {/* ── Hierarchy selection ── */}
      <div style={card}>
        <h3 style={sectionTitle}>Affectation organisationnelle</h3>
        <p style={{ margin: '4px 0 16px', fontSize: 12, color: C.textMuted }}>
          Sélectionnez votre établissement, bâtiment et service. Ces informations seront
          automatiquement pré-remplies dans vos demandes.
        </p>
        <div style={{ display: 'grid', gap: 14 }}>
          <FieldRow label="Établissement">
            <select
              style={inputStyle}
              value={selectedEtabId}
              onChange={(e) => {
                setSelectedEtabId(e.target.value);
                setSelectedBatId('');
                setSelectedSvcId('');
              }}
            >
              <option value="">— Choisir un établissement —</option>
              {etablissements.map((e) => (
                <option key={_eId(e)} value={_eId(e)}>{_eNom(e)}</option>
              ))}
            </select>
          </FieldRow>

          <FieldRow label="Bâtiment">
            <select
              style={{ ...inputStyle, color: !selectedEtabId ? C.textMuted : undefined }}
              value={selectedBatId}
              disabled={!selectedEtabId}
              onChange={(e) => {
                setSelectedBatId(e.target.value);
                setSelectedSvcId('');
              }}
            >
              <option value="">— Choisir un bâtiment —</option>
              {batiments.map((b) => (
                <option key={_bId(b)} value={_bId(b)}>{_bNom(b)}</option>
              ))}
            </select>
          </FieldRow>

          <FieldRow label="Service">
            <select
              style={{ ...inputStyle, color: !selectedBatId ? C.textMuted : undefined }}
              value={selectedSvcId}
              disabled={!selectedBatId}
              onChange={(e) => setSelectedSvcId(e.target.value)}
            >
              <option value="">— Choisir un service —</option>
              {services.map((s) => (
                <option key={_sId(s)} value={_sId(s)}>{_sNom(s)}</option>
              ))}
            </select>
          </FieldRow>
        </div>
      </div>

      {/* ── Save button ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          style={{ ...btnPrimary, opacity: mutation.isPending ? 0.6 : 1 }}
          onClick={handleSave}
          disabled={mutation.isPending || !nomComplet.trim()}
        >
          {mutation.isPending ? 'Enregistrement…' : 'Enregistrer les modifications'}
        </button>
        {saved && (
          <span style={{ fontSize: 13, color: C.green, fontWeight: 600 }}>
            ✓ Profil mis à jour
          </span>
        )}
        {mutation.isError && (
          <span style={{ fontSize: 13, color: C.danger, fontWeight: 500 }}>
            Erreur lors de la mise à jour.
          </span>
        )}
      </div>

      {/* ── Read-only fields ── */}
      <div style={card}>
        <h3 style={sectionTitle}>Informations du compte</h3>
        <p style={{ margin: '4px 0 16px', fontSize: 12, color: C.textMuted }}>
          Ces informations sont gérées par l'administrateur.
        </p>
        <div style={{ display: 'grid', gap: 14 }}>
          <ReadOnlyRow label="Email" value={email} />
          <ReadOnlyRow label="Rôle" value={roleLabel(role)} />
        </div>
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function roleLabel(role) {
  const map = {
    chef_service: 'Chef de Service',
    gestionnaire_magasin: 'Gestionnaire Magasin',
    service_financiere: 'Service Financière',
    admin: 'Administrateur',
    fournisseur: 'Fournisseur',
  };
  return map[role] || role || '—';
}

function FieldRow({ label, children }) {
  return (
    <label style={{ display: 'grid', gap: 5 }}>
      <span style={labelStyle}>{label}</span>
      {children}
    </label>
  );
}

function ReadOnlyRow({ label, value }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12, alignItems: 'center' }}>
      <span style={labelStyle}>{label}</span>
      <span style={{
        fontSize: 14, color: C.textDark, fontWeight: 500,
        padding: '8px 12px', background: C.bgSubtle, borderRadius: C.radiusSm,
        border: `1px solid ${C.border}`,
      }}>
        {value}
      </span>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const card = {
  background: C.bgWhite, border: `1px solid ${C.border}`,
  borderRadius: C.radius, padding: '20px 24px',
};
const sectionTitle = {
  margin: 0, fontSize: 15, fontWeight: 600, color: C.textDark,
};
const labelStyle = {
  fontSize: 12, fontWeight: 600, color: C.textMuted,
  textTransform: 'uppercase', letterSpacing: '0.04em',
};
const inputStyle = {
  width: '100%', padding: '10px 14px', fontSize: 14,
  color: C.textDark, background: C.bgWhite,
  border: `1px solid ${C.border}`, borderRadius: C.radiusSm,
  boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit',
};
const btnPrimary = {
  border: 'none', borderRadius: C.radiusSm,
  padding: '10px 20px', fontSize: 14, fontWeight: 600,
  background: C.green, color: '#fff', cursor: 'pointer',
};
