import { apiClient } from './axios';

export const getDemandes = (params = {}) => apiClient.get('/requests/demandes/', { params });
export const getDemandeById = (id) => apiClient.get(`/requests/demandes/${id}/`);
export const createDemande = (data) => apiClient.post('/requests/demandes/', data);
export const getDemandeRequesterOptions = (id_service) =>
	apiClient.get('/requests/demandes/requester-options/', { params: { id_service } });
export const validerDemande = (id, payload = {}) => apiClient.post(`/requests/demandes/${id}/valider/`, payload);
export const refuserDemande = (id, commentaire_validation) =>
	apiClient.post(`/requests/demandes/${id}/refuser/`, { commentaire_validation });
export const downloadDemandePdf = (id) =>
	apiClient.get(`/requests/demandes/${id}/download_pdf/`, { responseType: 'blob' });
export const imprimerDemande = (id) =>
	apiClient.get(`/requests/demandes/${id}/imprimer/`, { responseType: 'blob' });
export const creerCommandeInterne = (id, payload = {}) =>
	apiClient.post(`/requests/demandes/${id}/creer_commande_interne/`, payload);
export const signerCommandeInterne = (id) =>
	apiClient.post(`/requests/demandes/${id}/signer_commande_interne/`);
