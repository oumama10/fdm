import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createUtilisateur,
  getFournisseurs,
  getRoles,
  getServices,
  getUtilisateurs,
  updateUtilisateur,
} from '../../api/users';
import UtilisateurFormModal from './UtilisateurFormModal';

function normalizeRole(raw) {
  if (!raw) return null;
  if (typeof raw !== 'object') return null;
  return {
    id_role: raw.id_role ?? raw.idRole ?? raw.id,
    nom_role: raw.nom_role ?? raw.nomRole ?? '',
    description: raw.description ?? '',
  };
}

function normalizeService(raw) {
  if (!raw) return null;
  if (typeof raw !== 'object') return null;
  return {
    id_service: raw.id_service ?? raw.idService ?? raw.id,
    nom_service: raw.nom_service ?? raw.nomService ?? '',
    type_service: raw.type_service ?? raw.typeService ?? '',
    description: raw.description ?? '',
  };
}

function normalizeFournisseur(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    id_fournisseur: raw.id_fournisseur ?? raw.idFournisseur ?? raw.id,
    nom_societe: raw.nom_societe ?? raw.nomSociete ?? '',
  };
}

export default function UtilisateursPage() {
  const queryClient = useQueryClient();

  const [filterRole, setFilterRole] = useState('');
  const [filterService, setFilterService] = useState('');
  const [filterActif, setFilterActif] = useState('');
  const [formMode, setFormMode] = useState('closed');
  const [selectedUser, setSelectedUser] = useState(null);
  const [formError, setFormError] = useState('');

  const utilisateursQuery = useQuery({
    queryKey: ['users', 'utilisateurs', filterRole, filterService, filterActif],
    queryFn: () =>
      getUtilisateurs({
        ...(filterRole ? { id_role: filterRole } : {}),
        ...(filterService ? { id_service: filterService } : {}),
        ...(filterActif ? { actif: filterActif } : {}),
      }),
    staleTime: 10000,
  });

  const rolesQuery = useQuery({ queryKey: ['users', 'roles'], queryFn: () => getRoles(), staleTime: 300000 });
  const servicesQuery = useQuery({ queryKey: ['users', 'services'], queryFn: () => getServices(), staleTime: 300000 });
  const fournisseursQuery = useQuery({ queryKey: ['users', 'fournisseurs'], queryFn: () => getFournisseurs(), staleTime: 300000 });

  const createMutation = useMutation({
    mutationFn: createUtilisateur,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'utilisateurs'] });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateUtilisateur(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'utilisateurs'] });
      closeModal();
    },
  });

  const rawRows = utilisateursQuery.data?.data || [];
  const roles = useMemo(
    () => (rolesQuery.data?.data || []).map(normalizeRole).filter((item) => item?.id_role),
    [rolesQuery.data?.data]
  );
  const services = useMemo(
    () => (servicesQuery.data?.data || []).map(normalizeService).filter((item) => item?.id_service),
    [servicesQuery.data?.data]
  );
  const fournisseurs = useMemo(
    () => (fournisseursQuery.data?.data || []).map(normalizeFournisseur).filter((item) => item?.id_fournisseur),
    [fournisseursQuery.data?.data]
  );

  const roleById = useMemo(() => new Map(roles.map((item) => [String(item.id_role), item])), [roles]);
  const serviceById = useMemo(() => new Map(services.map((item) => [String(item.id_service), item])), [services]);

  const isModalOpen = formMode === 'create' || formMode === 'edit';

  const tableRows = useMemo(
    () =>
      rawRows.map((raw) => {
        const idRoleRaw = raw.id_role ?? raw.idRole;
        const idServiceRaw = raw.id_service ?? raw.idService;
        const roleObj = normalizeRole(raw.role || idRoleRaw) || roleById.get(String(idRoleRaw ?? '')) || null;
        const serviceObj = normalizeService(raw.service || idServiceRaw) || serviceById.get(String(idServiceRaw ?? '')) || null;

        return {
          id_utilisateur: raw.id_utilisateur ?? raw.idUtilisateur ?? raw.id,
          nom_complet: raw.nom_complet ?? raw.nomComplet ?? '',
          email: raw.email ?? '',
          actif: raw.actif ?? raw.is_active ?? raw.isActive ?? false,
          titre_poste: raw.titre_poste ?? raw.titrePoste ?? '',
          id_role: roleObj,
          id_service: serviceObj,
          fournisseur_profile: normalizeFournisseur(raw.fournisseur_profile ?? raw.fournisseurProfile),
        };
      }),
    [rawRows, roleById, serviceById]
  );

  function openCreate() {
    setFormError('');
    setSelectedUser(null);
    setFormMode('create');
  }

  function openEdit(user) {
    setFormError('');
    setSelectedUser(user);
    setFormMode('edit');
  }

  function closeModal() {
    setFormMode('closed');
    setSelectedUser(null);
    setFormError('');
  }

  async function submitForm(payload, { setErrors }) {
    setFormError('');

    try {
      if (formMode === 'create') {
        await createMutation.mutateAsync(payload);
      } else if (selectedUser) {
        await updateMutation.mutateAsync({ id: selectedUser.id_utilisateur, data: payload });
      }
    } catch (error) {
      const data = error?.response?.data;
      if (data && typeof data === 'object') {
        const mapped = {};
        Object.entries(data).forEach(([key, value]) => {
          mapped[key] = Array.isArray(value) ? value[0] : String(value);
        });
        setErrors(mapped);
      } else {
        setFormError('Erreur lors de l’enregistrement de l’utilisateur.');
      }
    }
  }

  async function toggleActif(user) {
    setFormError('');
    try {
      await updateMutation.mutateAsync({
        id: user.id_utilisateur,
        data: { actif: !user.actif },
      });
    } catch (error) {
      const detail = error?.response?.data?.detail;
      setFormError(detail || 'Impossible de modifier le statut actif de ce compte.');
    }
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Utilisateurs</h1>
        <button style={primaryButton} onClick={openCreate}>Nouvel utilisateur</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <select style={inputStyle} value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
          <option value="">Tous rôles</option>
          {roles.map((role) => (
            <option key={role.id_role} value={role.id_role}>{role.nom_role}</option>
          ))}
        </select>

        <select style={inputStyle} value={filterService} onChange={(e) => setFilterService(e.target.value)}>
          <option value="">Tous services</option>
          {services.map((service) => (
            <option key={service.id_service} value={service.id_service}>{service.nom_service}</option>
          ))}
        </select>

        <select style={inputStyle} value={filterActif} onChange={(e) => setFilterActif(e.target.value)}>
          <option value="">Actif + inactif</option>
          <option value="true">Actif</option>
          <option value="false">Inactif</option>
        </select>
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
        {utilisateursQuery.isLoading ? (
          <div style={{ padding: 14 }}>
            <div style={{ height: 180, borderRadius: 8, background: '#f3f4f6' }} />
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                <th style={thStyle}>Nom complet</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Rôle</th>
                <th style={thStyle}>Service</th>
                <th style={thStyle}>Actif</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 16, color: '#6b7280' }}>Aucun utilisateur.</td>
                </tr>
              ) : (
                tableRows.map((user) => (
                  <tr key={user.id_utilisateur} style={{ borderTop: '1px solid #f3f4f6' }}>
                    <td style={tdStyle}>{user.nom_complet}</td>
                    <td style={tdStyle}>{user.email}</td>
                    <td style={tdStyle}>{user.id_role?.nom_role || '—'}</td>
                    <td style={tdStyle}>{user.id_service?.nom_service || '—'}</td>
                    <td style={tdStyle}>{user.actif ? 'Oui' : 'Non'}</td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button style={secondaryButton} onClick={() => openEdit(user)}>Edit</button>
                        <button
                          style={secondaryButton}
                          onClick={() => toggleActif(user)}
                          disabled={updateMutation.isPending}
                        >
                          {user.actif ? 'Désactiver' : 'Activer'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {formError ? <div style={{ color: '#b91c1c', fontSize: 13 }}>{formError}</div> : null}

      {isModalOpen ? (
        <UtilisateurFormModal
          mode={formMode}
          initialData={selectedUser}
          roles={roles}
          services={services}
          fournisseurs={fournisseurs}
          existingUsers={tableRows}
          isSubmitting={createMutation.isPending || updateMutation.isPending}
          onSubmit={submitForm}
          onClose={closeModal}
        />
      ) : null}
    </div>
  );
}

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
  padding: '6px 10px',
  background: '#fff',
  cursor: 'pointer',
};

const thStyle = { padding: 10, fontWeight: 600 };
const tdStyle = { padding: 10, verticalAlign: 'top' };
