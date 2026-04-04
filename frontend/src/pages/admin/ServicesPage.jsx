import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createService, deleteService, getServices, updateService } from '../../api/users';

const TYPE_SERVICE_OPTIONS = [
  'administratif',
  'chu',
  'decanat',
  'pharmacie',
  'dentaire',
  'labo',
  'association',
];

function ServiceFormModal({ mode, initialData, onClose, onSubmit, isSubmitting }) {
  const [form, setForm] = useState({
    nom_service: initialData?.nom_service || '',
    type_service: initialData?.type_service || 'administratif',
    description: initialData?.description || '',
    lettre_nomination_chef: null,
  });
  const [errors, setErrors] = useState({});

  function setField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  }

  async function handleSave() {
    const nextErrors = {};
    if (!form.nom_service.trim()) nextErrors.nom_service = 'Ce champ est requis.';
    if (!form.type_service) nextErrors.type_service = 'Ce champ est requis.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const formData = new FormData();
    formData.append('nom_service', form.nom_service.trim());
    formData.append('type_service', form.type_service);
    formData.append('description', form.description);
    if (form.lettre_nomination_chef) {
      formData.append('lettre_nomination_chef', form.lettre_nomination_chef);
    }

    await onSubmit?.(formData, { setErrors });
  }

  return (
    <div style={backdropStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(event) => event.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>{mode === 'create' ? 'Nouveau service' : 'Modifier service'}</h3>

        <div style={{ display: 'grid', gap: 10 }}>
          <label style={labelStyle}>
            Nom service
            <input
              style={inputStyle}
              value={form.nom_service}
              onChange={(e) => setField('nom_service', e.target.value)}
            />
            {errors.nom_service ? <span style={errorTextStyle}>{errors.nom_service}</span> : null}
          </label>

          <label style={labelStyle}>
            Type service
            <select
              style={inputStyle}
              value={form.type_service}
              onChange={(e) => setField('type_service', e.target.value)}
            >
              {TYPE_SERVICE_OPTIONS.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            {errors.type_service ? <span style={errorTextStyle}>{errors.type_service}</span> : null}
          </label>

          <label style={labelStyle}>
            Description
            <textarea
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
            />
          </label>

          <label style={labelStyle}>
            Lettre nomination chef
            <input
              type="file"
              onChange={(e) => setField('lettre_nomination_chef', e.target.files?.[0] || null)}
            />
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button style={secondaryButton} onClick={onClose}>Annuler</button>
          <button style={primaryButton} onClick={handleSave} disabled={isSubmitting}>
            {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ServicesPage() {
  const queryClient = useQueryClient();

  const [mode, setMode] = useState('closed');
  const [selectedService, setSelectedService] = useState(null);
  const [error, setError] = useState('');

  const servicesQuery = useQuery({
    queryKey: ['users', 'services'],
    queryFn: () => getServices(),
    staleTime: 10000,
  });

  const createMutation = useMutation({
    mutationFn: createService,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'services'] });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateService(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'services'] });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteService,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'services'] });
    },
  });

  const rows = useMemo(() => servicesQuery.data?.data || [], [servicesQuery.data?.data]);

  function openCreate() {
    setError('');
    setSelectedService(null);
    setMode('create');
  }

  function openEdit(service) {
    setError('');
    setSelectedService(service);
    setMode('edit');
  }

  function closeModal() {
    setMode('closed');
    setSelectedService(null);
    setError('');
  }

  async function submitForm(formData, { setErrors }) {
    setError('');
    try {
      if (mode === 'create') {
        await createMutation.mutateAsync(formData);
      } else if (selectedService) {
        await updateMutation.mutateAsync({ id: selectedService.id_service, data: formData });
      }
    } catch (err) {
      const data = err?.response?.data;
      if (data && typeof data === 'object') {
        const mapped = {};
        Object.entries(data).forEach(([key, value]) => {
          mapped[key] = Array.isArray(value) ? value[0] : String(value);
        });
        setErrors(mapped);
      } else {
        setError('Erreur lors de l’enregistrement du service.');
      }
    }
  }

  function handleDelete(service) {
    if (!window.confirm(`Supprimer le service "${service.nom_service}" ?`)) return;
    deleteMutation.mutate(service.id_service);
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Services</h1>
        <button style={primaryButton} onClick={openCreate}>Nouveau service</button>
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
        {servicesQuery.isLoading ? (
          <div style={{ padding: 14 }}>
            <div style={{ height: 160, borderRadius: 8, background: '#f3f4f6' }} />
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                <th style={thStyle}>Nom service</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Description</th>
                <th style={thStyle}>Lettre nomination chef</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 16, color: '#6b7280' }}>Aucun service.</td>
                </tr>
              ) : (
                rows.map((service) => (
                  <tr key={service.id_service} style={{ borderTop: '1px solid #f3f4f6' }}>
                    <td style={tdStyle}>{service.nom_service}</td>
                    <td style={tdStyle}>{service.type_service}</td>
                    <td style={tdStyle}>{service.description || '—'}</td>
                    <td style={tdStyle}>
                      {service.lettre_nomination_chef ? (
                        <a href={service.lettre_nomination_chef} target="_blank" rel="noreferrer">Voir fichier</a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button style={secondaryButton} onClick={() => openEdit(service)}>Edit</button>
                        <button style={secondaryButton} onClick={() => handleDelete(service)}>Supprimer</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {error ? <div style={{ color: '#b91c1c', fontSize: 13 }}>{error}</div> : null}

      {mode === 'create' || mode === 'edit' ? (
        <ServiceFormModal
          mode={mode}
          initialData={selectedService}
          onClose={closeModal}
          onSubmit={submitForm}
          isSubmitting={createMutation.isPending || updateMutation.isPending}
        />
      ) : null}
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
  width: 'min(620px, 94vw)',
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
};

const errorTextStyle = {
  color: '#b91c1c',
  fontSize: 12,
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
  padding: '6px 10px',
  background: '#fff',
  cursor: 'pointer',
};

const thStyle = { padding: 10, fontWeight: 600 };
const tdStyle = { padding: 10, verticalAlign: 'top' };
