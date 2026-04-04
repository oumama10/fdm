import { apiClient } from './axios';

export const getDemandes = (params = {}) => apiClient.get('/requests/demandes/', { params });
export const getDemandeById = (id) => apiClient.get(`/requests/demandes/${id}/`);
export const createDemande = (data) => apiClient.post('/requests/demandes/', data);
export const validerDemande = (id) => apiClient.post(`/requests/demandes/${id}/valider/`);
export const refuserDemande = (id, commentaire_validation) =>
	apiClient.post(`/requests/demandes/${id}/refuser/`, { commentaire_validation });
