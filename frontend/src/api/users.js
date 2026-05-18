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
export const getBeneficiaires = (params = {}) => apiClient.get('/users/beneficiaires/', { params });
