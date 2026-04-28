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
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>{mode === 'create' ? 'Nouveau service' : 'Modifier service'}</h3>

        <div style={{ display: 'grid', gap: 10 }}>
          <label className="field-label" style={{ display: 'grid', gap: 6 }}>
            Nom service
            <input
              className="field-input"
              value={form.nom_service}
              onChange={(e) => setField('nom_service', e.target.value)}
            />
            {errors.nom_service ? <span style={errorTextStyle}>{errors.nom_service}</span> : null}
          </label>

          <label className="field-label" style={{ display: 'grid', gap: 6 }}>
            Type service
            <select
              className="field-input"
              value={form.type_service}
              onChange={(e) => setField('type_service', e.target.value)}
            >
              {TYPE_SERVICE_OPTIONS.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            {errors.type_service ? <span style={errorTextStyle}>{errors.type_service}</span> : null}
          </label>

          <label className="field-label" style={{ display: 'grid', gap: 6 }}>
            Description
            <textarea
              rows={3}
              className="field-input"
              style={{ resize: 'vertical' }}
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
            />
          </label>

          <label className="field-label" style={{ display: 'grid', gap: 6 }}>
            Lettre nomination chef
            <input
              type="file"
              onChange={(e) => setField('lettre_nomination_chef', e.target.files?.[0] || null)}
            />
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={isSubmitting}>
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
    <div className="page-stack">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="page-title">Services</h1>
        <button className="btn btn-primary" onClick={openCreate}>Nouveau service</button>
      </div>

      <div className="data-table-wrap">
        {servicesQuery.isLoading ? (
          <div style={{ padding: 14 }}>
            <div style={{ height: 160, borderRadius: 8, background: '#f3f4f6' }} />
          </div>
        ) : (
          <table className="data-table" style={{ fontSize: 14 }}>
            <thead>
              <tr>
                <th>Nom service</th>
                <th>Type</th>
                <th>Description</th>
                <th>Lettre nomination chef</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-state">Aucun service.</td>
                </tr>
              ) : (
                rows.map((service) => (
                  <tr key={service.id_service}>
                    <td>{service.nom_service}</td>
                    <td>{service.type_service}</td>
                    <td>{service.description || '—'}</td>
                    <td>
                      {service.lettre_nomination_chef ? (
                        <a href={service.lettre_nomination_chef} target="_blank" rel="noreferrer">Voir fichier</a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-secondary" onClick={() => openEdit(service)}>Edit</button>
                        <button className="btn btn-secondary" onClick={() => handleDelete(service)}>Supprimer</button>
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

const errorTextStyle = {
  color: '#b91c1c',
  fontSize: 12,
};
