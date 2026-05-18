import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createRetour } from '../../api/returns';
import { getInstances } from '../../api/resources';
import { useAuthStore } from '../../store/authStore';

// ── Design tokens ─────────────────────────────────────────────────────────
const C = {
  green:       '#0F6E56',
  lightGreen:  '#1D9E75',
  textPrimary: '#0f172a',
  textSecondary:'#374151',
  textMuted:   '#64748b',
  border:      '#e2e8f0',
  bgWhite:     '#ffffff',
  bgSubtle:    '#f8fafc',
  danger:      '#ef4444',
};

// ── Motif options ─────────────────────────────────────────────────────────
const MOTIFS = [
  { value: 'panne',      label: 'Panne',      desc: "L'équipement est tombé en panne" },
  { value: 'inutilise',  label: 'Inutilisé',  desc: "L'équipement n'est plus utilisé" },
  { value: 'endommage',  label: 'Endommagé',  desc: "L'équipement est endommagé" },
  { value: 'autre',      label: 'Autre',      desc: "Autre motif de retour" },
];

const MOTIF_COLORS = {
  panne:     { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
  inutilise: { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
  endommage: { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  autre:     { bg: '#ede9fe', color: '#5b21b6', border: '#c4b5fd' },
};

// ── Field wrapper ─────────────────────────────────────────────────────────
function Field({ label, required, children }) {
  return (
    <label style={fieldWrap}>
      {label && (
        <span style={fieldLabel}>
          {label}
          {required && <span style={{ color: C.danger, marginLeft: 2 }}>*</span>}
        </span>
      )}
      {children}
    </label>
  );
}

// ── Component ─────────────────────────────────────────────────────────────
export default function RetourCreateModal({ onClose, onCreated }) {
  const user      = useAuthStore((s) => s.user);
  const serviceId = user?.id_service?.id_service || user?.service?.id || user?.service?.id_service;
  const queryClient = useQueryClient();

  const [selectedId,  setSelectedId]  = useState('');
  const [motif,       setMotif]       = useState('panne');
  const [observation, setObservation] = useState('');
  const [error,       setError]       = useState('');

  const instancesQuery = useQuery({
    queryKey: ['chef', 'retours', 'instances', serviceId],
    queryFn:  () => getInstances({ scope: 'retours' }),
    enabled:  Boolean(serviceId),
    staleTime: 30000,
  });

  const createMutation = useMutation({
    mutationFn: createRetour,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chef', 'retours'] });
      onCreated?.();
      onClose();
    },
    onError: (err) => {
      const detail =
        err?.response?.data?.detail ||
        err?.response?.data?.non_field_errors?.[0] ||
        'Impossible de soumettre le retour.';
      setError(String(detail));
    },
  });

  const instances = useMemo(() => {
    const rows = instancesQuery.data?.data || [];
    return rows.filter((inst) => inst.statut === 'en_service');
  }, [instancesQuery.data?.data]);

  const selectedInstance = instances.find(
    (inst) => String(inst.id_instance ?? inst.idInstance) === String(selectedId)
  );

  function handleSubmit() {
    setError('');
    if (!selectedInstance) { setError('Sélectionnez un article à retourner.'); return; }
    createMutation.mutate({
      id_ressource:          Number(selectedInstance.id_ressource ?? selectedInstance.idRessource),
      id_instance_ressource: Number(selectedInstance.id_instance  ?? selectedInstance.idInstance),
      motif_retour:          motif,
      observation,
    });
  }

  const selectedMotif = MOTIFS.find((m) => m.value === motif);

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={shellStyle} onClick={(e) => e.stopPropagation()}>

        {/* ── Header ── */}
        <div style={headerStyle}>
          <div style={headerTitleBlockStyle}>
            <h2 style={titleStyle}>Soumettre un retour</h2>
          </div>
          <button type="button" style={closeBtnStyle} onClick={onClose} aria-label="Fermer">✕</button>
        </div>

        {/* ── Body ── */}
        <div style={bodyStyle}>

          {/* Article */}
          <section style={sectionCard}>
            <h3 style={sectionTitle}>Article à retourner</h3>

            {instancesQuery.isLoading ? (
              <div style={{ height: 40, borderRadius: 6, background: C.bgSubtle }} />
            ) : instances.length === 0 ? (
              <p style={emptyHint}>
                Aucun équipement affecté à votre service n'est retournable.
              </p>
            ) : (
              <Field label="Sélectionner l'équipement" required>
                <select
                  value={selectedId}
                  onChange={(e) => { setSelectedId(e.target.value); setError(''); }}
                  style={inputStyle}
                >
                  <option value="">Choisir un article…</option>
                  {instances.map((inst) => {
                    const iid  = inst.id_instance ?? inst.idInstance;
                    const num  = inst.numero_inventaire ?? inst.numeroInventaire ?? iid;
                    const name = inst.ressource?.designation || inst.designation || '—';
                    return (
                      <option key={iid} value={iid}>
                        {name} — {num}
                      </option>
                    );
                  })}
                </select>
              </Field>
            )}

            {/* Selected instance detail */}
            {selectedInstance && (
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
                padding: '10px 14px', borderRadius: 8,
                background: C.bgSubtle, border: `1px solid ${C.border}`,
                fontSize: 13,
              }}>
                <div>
                  <span style={{ color: C.textMuted, display: 'block', fontSize: 11, fontWeight: 500, marginBottom: 2 }}>
                    Désignation
                  </span>
                  <span style={{ fontWeight: 600, color: C.textPrimary }}>
                    {selectedInstance.ressource?.designation || '—'}
                  </span>
                </div>
                <div>
                  <span style={{ color: C.textMuted, display: 'block', fontSize: 11, fontWeight: 500, marginBottom: 2 }}>
                    N° inventaire
                  </span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: C.green }}>
                    {selectedInstance.numero_inventaire ?? selectedInstance.numeroInventaire ?? '—'}
                  </span>
                </div>
              </div>
            )}
          </section>

          {/* Motif */}
          <section style={sectionCard}>
            <h3 style={sectionTitle}>Motif du retour</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {MOTIFS.map(({ value, label, desc }) => {
                const active = motif === value;
                const col    = MOTIF_COLORS[value];
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMotif(value)}
                    style={{
                      textAlign: 'left', cursor: 'pointer', padding: '10px 12px',
                      borderRadius: 8,
                      border: active ? `2px solid ${col.color}` : `1px solid ${C.border}`,
                      background: active ? col.bg : C.bgWhite,
                      outline: 'none', transition: 'all 0.12s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{
                        width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                        border: `2px solid ${active ? col.color : C.border}`,
                        background: active ? col.color : 'transparent',
                      }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: active ? col.color : C.textPrimary }}>
                        {label}
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: C.textMuted, paddingLeft: 20 }}>{desc}</span>
                  </button>
                );
              })}
            </div>
            {selectedMotif && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center',
                  padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                  background: MOTIF_COLORS[motif].bg,
                  color: MOTIF_COLORS[motif].color,
                  border: `1px solid ${MOTIF_COLORS[motif].border}`,
                }}>
                  {selectedMotif.label}
                </span>
              </div>
            )}
          </section>

          {/* Observation */}
          <section style={sectionCard}>
            <h3 style={sectionTitle}>Observation</h3>
            <Field label="Commentaire (optionnel)">
              <textarea
                rows={3}
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
                placeholder="Décrivez l'état de l'équipement, les circonstances du retour…"
                style={{ ...inputStyle, height: 'auto', minHeight: 80, resize: 'vertical' }}
              />
            </Field>
          </section>

        </div>

        {/* ── Footer ── */}
        <div style={footerStyle}>
          {error && <span style={{ fontSize: 13, color: C.danger, fontWeight: 500 }}>{error}</span>}
          <div style={{ display: 'flex', gap: 10, marginLeft: 'auto' }}>
            <button type="button" style={btnCancel} onClick={onClose}>
              Annuler
            </button>
            <button
              type="button"
              style={{
                ...btnSubmit,
                opacity: (!selectedInstance || createMutation.isPending) ? 0.5 : 1,
                cursor:  (!selectedInstance || createMutation.isPending) ? 'not-allowed' : 'pointer',
              }}
              onClick={handleSubmit}
              disabled={!selectedInstance || createMutation.isPending}
            >
              {createMutation.isPending ? 'Envoi…' : 'Soumettre le retour'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────
const overlayStyle = {
  position: 'fixed', inset: 0, zIndex: 100,
  background: 'rgba(15, 23, 42, 0.45)',
  display: 'grid', placeItems: 'center',
  padding: '1rem',
};

const shellStyle = {
  width: 'min(560px, 100%)',
  maxHeight: '90vh',
  background: C.bgWhite,
  borderRadius: 16,
  border: `1px solid ${C.border}`,
  boxShadow: '0 20px 48px rgba(15, 23, 42, 0.18)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const headerStyle = {
  position: 'relative',
  padding: '20px 24px 0',
  background: C.bgWhite,
  flexShrink: 0,
};

const headerTitleBlockStyle = {
  paddingBottom: 16,
  borderBottom: `3px solid ${C.lightGreen}`,
};

const titleStyle = {
  margin: 0,
  fontSize: '1.125rem',
  fontWeight: 700,
  color: C.green,
};

const closeBtnStyle = {
  position: 'absolute', top: 18, right: 20,
  border: 'none', background: 'transparent',
  fontSize: '1rem', color: C.textMuted,
  cursor: 'pointer', lineHeight: 1, padding: 4,
};

const bodyStyle = {
  flex: 1, overflowY: 'auto',
  padding: '16px 24px',
  display: 'grid', gap: 12,
  alignContent: 'start',
};

const footerStyle = {
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '14px 24px',
  borderTop: `1px solid ${C.border}`,
  flexShrink: 0,
  background: C.bgWhite,
};

const sectionCard = {
  border: `1px solid ${C.border}`,
  borderRadius: 12,
  background: C.bgWhite,
  padding: '14px 16px',
  display: 'grid',
  gap: 12,
};

const sectionTitle = {
  margin: 0,
  fontSize: 14,
  fontWeight: 600,
  color: C.textPrimary,
};

const fieldWrap  = { display: 'grid', gap: 6 };
const fieldLabel = { fontSize: 13, fontWeight: 500, color: C.textSecondary };

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  height: '2.5rem', padding: '0.5rem 0.75rem',
  fontSize: 14, color: C.textPrimary,
  background: C.bgWhite,
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  outline: 'none', fontFamily: 'inherit',
};

const emptyHint = {
  margin: 0, fontSize: 13,
  color: C.textMuted, fontStyle: 'italic',
};

const btnBase = {
  border: 'none', borderRadius: 8,
  padding: '9px 18px', fontSize: 14,
  fontWeight: 600, lineHeight: '20px',
};

const btnCancel = {
  ...btnBase,
  border: `1px solid ${C.border}`,
  background: C.bgWhite,
  color: C.textSecondary,
  cursor: 'pointer',
};

const btnSubmit = {
  ...btnBase,
  background: C.green,
  color: '#fff',
};
