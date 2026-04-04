import { apiClient } from './axios';

export const getDecharges = () => apiClient.get('/decharge/decharges/');
export const getDechargeById = (id) => apiClient.get(`/decharge/decharges/${id}/`);
export const createDecharge = (data) => apiClient.post('/decharge/decharges/', data);
export const downloadPdf = (id) => apiClient.get(`/decharge/decharges/${id}/download_pdf/`, { responseType: 'blob' });
export const regeneratePdf = (id) => apiClient.post(`/decharge/decharges/${id}/regenerate_pdf/`);
export const getSignatureDetail = (dechargeId) =>
	apiClient.get(`/decharge/decharges/${dechargeId}/signature/detail/`);
export const uploadScan = (dechargeId, formData) =>
	apiClient.post(`/decharge/decharges/${dechargeId}/signature/upload_scan/`, formData, {
		headers: { 'Content-Type': 'multipart/form-data' },
	});
export const validerSignature = (dechargeId) =>
	apiClient.post(`/decharge/decharges/${dechargeId}/signature/valider/`);
export const rejeterSignature = (dechargeId) =>
	apiClient.post(`/decharge/decharges/${dechargeId}/signature/rejeter/`);
