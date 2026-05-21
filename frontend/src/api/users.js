import { apiClient } from './axios';

export const getUtilisateurs = (params = {}) => apiClient.get('/users/utilisateurs/', { params });
export const createUtilisateur = (data) => apiClient.post('/users/utilisateurs/', data);
export const updateUtilisateur = (id, data) => apiClient.patch(`/users/utilisateurs/${id}/`, data);

export const getRoles = () => apiClient.get('/users/roles/');
export const getServices = (params = {}) => apiClient.get('/users/services/', { params });
export const createService = (formData) =>
  apiClient.post('/users/services/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
export const updateService = (id, formData) =>
  apiClient.patch(`/users/services/${id}/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
export const deleteService = (id) => apiClient.delete(`/users/services/${id}/`);

export const getFournisseurs = () => apiClient.get('/users/fournisseurs/');

export const getJournalAudit = (params = {}) => apiClient.get('/users/journal-audit/', { params });

// ── Hierarchy endpoints ───────────────────────────────────────────────────
export const getEtablissements = () => apiClient.get('/users/etablissements/');
export const getBatiments = (params = {}) => apiClient.get('/users/batiments/', { params });
export const createBatiment = (data) => apiClient.post('/users/batiments/', data);
export const updateBatiment = (id, data) => apiClient.patch(`/users/batiments/${id}/`, data);
export const deleteBatiment = (id) => apiClient.delete(`/users/batiments/${id}/`);
export const createServiceJson = (data) => apiClient.post('/users/services/', data);
export const updateServiceJson = (id, data) => apiClient.patch(`/users/services/${id}/`, data);
export const getBeneficiaires = (params = {}) => apiClient.get('/users/beneficiaires/', { params });
export const createBeneficiaire = (data) => apiClient.post('/users/beneficiaires/', data);
export const updateBeneficiaire = (id, data) => apiClient.patch(`/users/beneficiaires/${id}/`, data);
export const deleteBeneficiaire = (id) => apiClient.delete(`/users/beneficiaires/${id}/`);

export const getMyProfile = () => apiClient.get('/users/me/');
export const updateMyProfile = (data) => apiClient.patch('/users/me/', data);

export const getPersonnelByService = (serviceId) => apiClient.get('/users/beneficiaires/', { params: { id_service: serviceId } });
