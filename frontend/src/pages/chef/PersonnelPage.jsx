import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { getBeneficiaires, createBeneficiaire, updateBeneficiaire, deleteBeneficiaire } from '../../api/users';

// ── Design tokens ─────────────────────────────────────────────────────────
const C = {
  green:      '#0F6E56',
  lightGreen: '#1D9E75',
  textDark:   '#0f172a',
  textMid:    '#374151',
  textMuted:  '#64748b',
  border:     '#e2e8f0',
  bgWhite:    '#ffffff',
  bgSubtle:   '#f8fafc',
  danger:     '#ef4444',
  dangerBg:   '#fef2f2',
  radius:     12,
  radiusSm:   8,
};

const ROLE_LABELS = {
  chef_service:   'Chef de Service',
  fonctionnaire:  'Fonctionnaire',
  secretariat:    'Secrétariat',
  salle_de_cours: 'Salle de cours',
  prof:           'Prof',
  personnel:      'Personnel',
};

const ROLE_OPTIONS = Object.entries(ROLE_LABELS);

export default function PersonnelPage() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const serviceId = user?.service?.id;
  const serviceName = user?.service?.nom || '—';

  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [nom, setNom] = useState('');
  const [roleType, setRoleType] = useState('personnel');
  const [formError, setFormError] = useState('');

  const benefQuery = useQuery({
    queryKey: ['chef', 'beneficiaires', serviceId],
    queryFn: () => getBeneficiaires({ id_service: serviceId }),
    enabled: Boolean(serviceId),
    staleTime: 30_000,
  });
  const beneficiaires = benefQuery.data?.data || [];

  const createMut = useMutation({
    mutationFn: createBeneficiaire,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['chef', 'beneficiaires'] }); closeForm(); },
    onError: (e) => setFormError(e?.response?.data?.detail || 'Erreur lors de la création.'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => updateBeneficiaire(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['chef', 'beneficiaires'] }); closeForm(); },
    onError: (e) => setFormError(e?.response?.data?.detail || 'Erreur lors de la modification.'),
  });

  const deleteMut = useMutation({
    mutationFn: deleteBeneficiaire,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chef', 'beneficiaires'] }),
    onError: (e) => setFormError(e?.response?.data?.detail || 'Erreur lors de la suppression.'),
  });

  function openCreate() {
    setEditItem(null);
    setNom('');
    setRoleType('personnel');
    setFormError('');
    setShowForm(true);
  }

  function openEdit(item) {
    setEditItem(item);
    setNom(item.nom);
    setRoleType(item.roleType ?? item.role_type ?? 'personnel');
    setFormError('');
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditItem(null);
    setNom('');
    setRoleType('personnel');
    setFormError('');
  }

  function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (!nom.trim()) { setFormError('Le nom est requis.'); return; }
    const payload = { nom: nom.trim(), role_type: roleType, id_service: serviceId };
    if (editItem) {
      const id = editItem.idBeneficiaire ?? editItem.id_beneficiaire;
      updateMut.mutate({ id, data: payload });
    } else {
      createMut.mutate(payload);
    }
  }

  function handleDelete(item) {
    const id = item.idBeneficiaire ?? item.id_beneficiaire;
    if (window.confirm(`Supprimer "${item.nom}" ?`)) {
      deleteMut.mutate(id);
    }
  }

  if (!serviceId) {
    return (
      <div style={card}>
        <p style={{ color: C.textMuted, fontSize: 14 }}>
          Veuillez d'abord sélectionner votre service dans la page <strong>Profil</strong>.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 20, paddingBottom: 40, maxWidth: 720 }}>

      {/* ── Header ── */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C.green }}>
              Personnel & Bénéficiaires
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: C.textMuted }}>
              Service : <strong>{serviceName}</strong> — Gérez les bénéficiaires de votre service.
            </p>
          </div>
          <button style={btnPrimary} onClick={openCreate}>
            + Ajouter
          </button>
        </div>
        <div style={{ height: 3, background: C.lightGreen, borderRadius: 2, margin: '16px -24px 0' }} />
      </div>

      {/* ── Inline form ── */}
      {showForm && (
        <div style={card}>
          <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 600, color: C.textDark }}>
            {editItem ? 'Modifier le bénéficiaire' : 'Nouveau bénéficiaire'}
          </h3>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
            <label style={{ display: 'grid', gap: 5 }}>
              <span style={labelStyle}>Nom</span>
              <input
                style={inputStyle}
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Nom du bénéficiaire"
                autoFocus
              />
            </label>
            <label style={{ display: 'grid', gap: 5 }}>
              <span style={labelStyle}>Type / Rôle</span>
              <select style={inputStyle} value={roleType} onChange={(e) => setRoleType(e.target.value)}>
                {ROLE_OPTIONS.map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </label>
            {formError && (
              <div style={{ fontSize: 13, color: C.danger, fontWeight: 500 }}>{formError}</div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button
                type="submit"
                style={{ ...btnPrimary, opacity: createMut.isPending || updateMut.isPending ? 0.6 : 1 }}
                disabled={createMut.isPending || updateMut.isPending}
              >
                {editItem ? 'Enregistrer' : 'Créer'}
              </button>
              <button type="button" style={btnSecondary} onClick={closeForm}>
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Table ── */}
      <div style={tableShell}>
        {benefQuery.isLoading ? (
          <div style={{ padding: 20 }}>
            <div style={{ height: 120, borderRadius: C.radiusSm, background: C.bgSubtle }} />
          </div>
        ) : beneficiaires.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: C.textMuted, fontSize: 14 }}>
            Aucun bénéficiaire. Cliquez sur <strong>+ Ajouter</strong> pour en créer.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr>
                <th style={thStyle}>Nom</th>
                <th style={thStyle}>Type</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {beneficiaires.map((b) => {
                const bid = b.idBeneficiaire ?? b.id_beneficiaire;
                const bRole = b.roleType ?? b.role_type;
                return (
                  <tr key={bid} style={{ borderTop: `1px solid ${C.border}` }}>
                    <td style={tdStyle}>{b.nom}</td>
                    <td style={tdStyle}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center',
                        padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                        background: bRole === 'personnel' ? '#dbeafe' : '#f1f5f9',
                        color: bRole === 'personnel' ? '#1e3a8a' : '#475569',
                        border: `1px solid ${bRole === 'personnel' ? '#93c5fd' : '#cbd5e1'}`,
                      }}>
                        {ROLE_LABELS[bRole] || bRole}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button style={btnSmall} onClick={() => openEdit(b)}>Modifier</button>
                        <button
                          style={{ ...btnSmall, color: C.danger, borderColor: '#fecaca' }}
                          onClick={() => handleDelete(b)}
                          disabled={deleteMut.isPending}
                        >
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const card = {
  background: C.bgWhite, border: `1px solid ${C.border}`,
  borderRadius: C.radius, padding: '20px 24px',
};
const tableShell = {
  border: `1px solid ${C.border}`, borderRadius: C.radius,
  overflow: 'hidden', background: C.bgWhite,
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
const thStyle = {
  padding: '10px 14px', fontSize: 12, fontWeight: 700,
  color: C.textMuted, textAlign: 'left',
  borderBottom: `1px solid ${C.border}`, background: C.bgSubtle,
};
const tdStyle = {
  padding: '10px 14px', fontSize: 14, color: C.textMid, verticalAlign: 'middle',
};
const btnPrimary = {
  border: 'none', borderRadius: C.radiusSm,
  padding: '9px 16px', fontSize: 13, fontWeight: 600,
  background: C.green, color: '#fff', cursor: 'pointer',
};
const btnSecondary = {
  border: `1px solid ${C.border}`, borderRadius: C.radiusSm,
  padding: '9px 16px', fontSize: 13, fontWeight: 500,
  background: C.bgWhite, color: C.textMid, cursor: 'pointer',
};
const btnSmall = {
  border: `1px solid ${C.border}`, borderRadius: 6,
  padding: '5px 10px', fontSize: 12, fontWeight: 500,
  background: C.bgWhite, color: C.textMid, cursor: 'pointer',
};
