import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';

import { createDemande, getDemandes } from '../../api/requests';
import { getRessources } from '../../api/resources';
import { useAuthStore } from '../../store/authStore';

export default function NouvelleDemandeModal({ onClose, onCreated }) {
  const user = useAuthStore((state) => state.user);
  const serviceId = user?.service?.id;

  const [step, setStep] = useState(1);
  const [urgence, setUrgence] = useState('normal');
  const [justification, setJustification] = useState('');
  const [search, setSearch] = useState('');
  const [selectedItems, setSelectedItems] = useState([]);
  const [confirmation, setConfirmation] = useState(null);

  const resourcesMutation = useMutation({ mutationFn: getRessources });
  const submitMutation = useMutation({
    mutationFn: createDemande,
    onSuccess: async () => {
      const list = await getDemandes();
      const latest = [...(list.data || [])].sort(
        (a, b) => new Date(b.date_demande || 0) - new Date(a.date_demande || 0)
      )[0];
      setConfirmation(latest || null);
      onCreated?.(latest);
    },
  });

  const resources = resourcesMutation.data?.data || [];

  const filteredResources = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return resources.slice(0, 20);
    return resources.filter((r) => r.designation?.toLowerCase().includes(q)).slice(0, 20);
  }, [resources, search]);

  function addResource(resource) {
    if (selectedItems.some((it) => Number(it.id_ressource) === Number(resource.id_ressource))) return;
    setSelectedItems((prev) => [
      ...prev,
      {
        id_ressource: resource.id_ressource,
        designation: resource.designation,
        categorie: resource.categorie?.nom_categorie || '—',
        quantite_demandee: 1,
      },
    ]);
  }

  function updateQuantity(id_ressource, quantity) {
    setSelectedItems((prev) =>
      prev.map((item) =>
        Number(item.id_ressource) === Number(id_ressource)
          ? { ...item, quantite_demandee: Math.max(1, Number(quantity || 1)) }
          : item
      )
    );
  }

  function removeItem(id_ressource) {
    setSelectedItems((prev) => prev.filter((item) => Number(item.id_ressource) !== Number(id_ressource)));
  }

  async function submitDemande() {
    if (!serviceId) return;
    await submitMutation.mutateAsync({
      urgence,
      justification,
      id_service: serviceId,
      lignes: selectedItems.map((item) => ({
        id_ressource: Number(item.id_ressource),
        quantite_demandee: Number(item.quantite_demandee),
      })),
    });
  }

  return (
    <div style={backdropStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(event) => event.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Nouvelle demande</h3>

        {confirmation ? (
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ color: '#166534', fontWeight: 600 }}>
              Votre demande a été soumise. Référence: #{confirmation.id_demande}
            </div>
            <div style={{ color: '#374151', fontSize: 14 }}>
              Lien de suivi: {confirmation.lien_suivi || '—'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button style={primaryButton} onClick={onClose}>Fermer</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 12, fontSize: 13, color: '#6b7280' }}>Étape {step}/3</div>

            {step === 1 ? (
              <div style={{ display: 'grid', gap: 12 }}>
                <div>
                  <div style={{ marginBottom: 6, fontWeight: 600 }}>Urgence</div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    {['normal', 'moyen', 'urgent'].map((u) => (
                      <label key={u} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                        <input
                          type="radio"
                          name="urgence"
                          value={u}
                          checked={urgence === u}
                          onChange={() => setUrgence(u)}
                        />
                        {u}
                      </label>
                    ))}
                  </div>
                </div>

                <label style={labelStyle}>
                  Justification
                  <textarea
                    rows={4}
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                    style={textareaStyle}
                  />
                </label>
              </div>
            ) : null}

            {step === 2 ? (
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    style={inputStyle}
                    placeholder="Rechercher une ressource (désignation)"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <button style={secondaryButton} onClick={() => resourcesMutation.mutate()}>
                    Charger ressources
                  </button>
                </div>

                <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, maxHeight: 160, overflow: 'auto' }}>
                  {resourcesMutation.isError ? (
                    <div style={{ padding: 10, color: '#b91c1c' }}>
                      Impossible de charger les ressources (permissions API).
                    </div>
                  ) : filteredResources.length === 0 ? (
                    <div style={{ padding: 10, color: '#6b7280' }}>Aucun résultat.</div>
                  ) : (
                    filteredResources.map((r) => (
                      <button
                        key={r.id_ressource}
                        type="button"
                        onClick={() => addResource(r)}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          width: '100%',
                          border: 'none',
                          borderTop: '1px solid #f3f4f6',
                          background: '#fff',
                          padding: 10,
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <span>{r.designation}</span>
                        <span style={{ color: '#6b7280', fontSize: 12 }}>{r.categorie?.nom_categorie || '—'}</span>
                      </button>
                    ))
                  )}
                </div>

                <div style={{ display: 'grid', gap: 8 }}>
                  {selectedItems.map((item) => (
                    <div
                      key={item.id_ressource}
                      style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 8, display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, alignItems: 'center' }}
                    >
                      <div>
                        <div>{item.designation}</div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>{item.categorie}</div>
                      </div>
                      <input
                        type="number"
                        min={1}
                        value={item.quantite_demandee}
                        onChange={(e) => updateQuantity(item.id_ressource, e.target.value)}
                        style={{ ...inputStyle, width: 84 }}
                      />
                      <button style={dangerGhostButton} onClick={() => removeItem(item.id_ressource)}>
                        Retirer
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div style={{ display: 'grid', gap: 8 }}>
                <div><strong>Urgence:</strong> {urgence}</div>
                <div><strong>Justification:</strong> {justification || '—'}</div>
                <div><strong>Articles:</strong> {selectedItems.length}</div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {selectedItems.map((item) => (
                    <li key={item.id_ressource}>
                      {item.designation} — Qté {item.quantite_demandee}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
              <button style={secondaryButton} onClick={step === 1 ? onClose : () => setStep((s) => s - 1)}>
                {step === 1 ? 'Annuler' : 'Précédent'}
              </button>

              {step < 3 ? (
                <button
                  style={primaryButton}
                  onClick={() => setStep((s) => s + 1)}
                  disabled={step === 2 && selectedItems.length === 0}
                >
                  Suivant
                </button>
              ) : (
                <button
                  style={primaryButton}
                  onClick={submitDemande}
                  disabled={submitMutation.isPending || selectedItems.length === 0 || !serviceId}
                >
                  {submitMutation.isPending ? 'Envoi...' : 'Soumettre'}
                </button>
              )}
            </div>
          </>
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
  zIndex: 90,
};

const modalStyle = {
  width: 'min(760px, 94vw)',
  background: '#fff',
  borderRadius: 12,
  padding: 18,
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
  width: '100%',
};

const textareaStyle = {
  ...inputStyle,
  resize: 'vertical',
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
