import { apiClient } from './axios';

export const getDemandes = (params = {}) => apiClient.get('/requests/demandes/', { params });
export const getDemandeById = (id) => apiClient.get(`/requests/demandes/${id}/`);
export const createDemande = (data) => apiClient.post('/requests/demandes/', data);
export const getDemandeRequesterOptions = () => apiClient.get('/requests/demandes/requester-options/');
export const validerDemande = (id, data = {}) => apiClient.post(`/requests/demandes/${id}/valider/`, data);
export const refuserDemande = (id, commentaire_validation) =>
	apiClient.post(`/requests/demandes/${id}/refuser/`, { commentaire_validation });
