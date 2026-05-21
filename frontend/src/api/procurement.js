import { apiClient } from './axios';

export const getMarches = (params = {}) => apiClient.get('/procurement/marches/', { params });
export const createMarche = (data) => apiClient.post('/procurement/marches/', data);
export const getMarcheDetail = (id) => apiClient.get(`/procurement/marches/${id}/`);
export const uploadExcel = (formData) =>
	apiClient.post('/procurement/import/', formData, {
		headers: { 'Content-Type': 'multipart/form-data' },
	});
export const uploadExcelDirect = (formData) =>
	apiClient.post('/procurement/import/direct/', formData, {
		headers: { 'Content-Type': 'multipart/form-data' },
	});
export const createManualImport = (data) => apiClient.post('/procurement/import/manual/', data);
export const getImports = (params = {}) => apiClient.get('/procurement/import/', { params });
export const getImportById = (importId) => apiClient.get(`/procurement/import/${importId}/`);
export const updateImport = (importId, data) => apiClient.patch(`/procurement/import/${importId}/`, data);
export const sendImportToGestionnaire = (importId) =>
	apiClient.post(`/procurement/import/${importId}/envoyer-gestionnaire/`);
export const getStagingItems = (importId) =>
	apiClient.get('/procurement/staging/', { params: { id_import: importId } });
export const updateStagingItem = (itemId, data) =>
	apiClient.patch(`/procurement/staging/${itemId}/`, data);
export const approveItem = (itemId) => apiClient.post(`/procurement/staging/${itemId}/approve/`);
export const rejectItem = (itemId, data = {}) => apiClient.post(`/procurement/staging/${itemId}/reject/`, data);
export const bulkValidateStaging = (data) => apiClient.patch('/procurement/staging/bulk-validate/', data);
export const getEtapes = (marcheId) =>
	apiClient.get('/procurement/etapes/', { params: { id_marche: marcheId } });
export const updateEtape = (etapeId, data) => apiClient.patch(`/procurement/etapes/${etapeId}/`, data);
export const getLotsByMarche = (marcheId) =>
	apiClient.get('/procurement/lots/', { params: { id_marche: marcheId } });
export const getLots = (params = {}) => apiClient.get('/procurement/lots/', { params });
export const confirmerReception = (marcheId) =>
	apiClient.post(`/procurement/marches/${marcheId}/confirmer-reception/`);
export const refuserMarche = (marcheId, data = {}) =>
	apiClient.post(`/procurement/marches/${marcheId}/refuser/`, data);
export const changerEtape = (marcheId, nomEtape) =>
	apiClient.patch(`/procurement/marches/${marcheId}/changer-etape/`, { nom_etape: nomEtape });
export const updateMarche = (marcheId, data) =>
	apiClient.patch(`/procurement/marches/${marcheId}/`, data);
export const updateImportFile = (importId, formData) =>
	apiClient.patch(`/procurement/import/${importId}/`, formData, {
		headers: { 'Content-Type': 'multipart/form-data' },
	});
