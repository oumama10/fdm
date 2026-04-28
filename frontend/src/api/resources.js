import { apiClient } from './axios';

export const getCategories = (params = {}) => apiClient.get('/resources/categories/', { params });
export const createCategory = (data) => apiClient.post('/resources/categories/', data);
export const updateCategory = (categoryId, data) => apiClient.patch(`/resources/categories/${categoryId}/`, data);
export const deleteCategory = (categoryId) => apiClient.delete(`/resources/categories/${categoryId}/`);
export const getSousCategories = (params = {}) => apiClient.get('/resources/sous-categories/', { params });
export const createSousCategory = (data) => apiClient.post('/resources/sous-categories/', data);
export const updateSousCategory = (subCategoryId, data) => apiClient.patch(`/resources/sous-categories/${subCategoryId}/`, data);
export const deleteSousCategory = (subCategoryId) => apiClient.delete(`/resources/sous-categories/${subCategoryId}/`);
export const getRessources = (params = {}) => apiClient.get('/resources/ressources/', { params });
export const getStock = () => apiClient.get('/resources/stocks/');
export const getStockAlertes = () => apiClient.get('/resources/stock/', { params: { alerte: true } });
export const getInstances = () => apiClient.get('/resources/instances/');
export const getInstance = (instanceId) => apiClient.get(`/resources/instances/${instanceId}/`);
export const updateInstance = (instanceId, data) => apiClient.patch(`/resources/instances/${instanceId}/`, data);
export const getMouvements = (params = {}) => apiClient.get('/resources/mouvements/', { params });
export const getInstancesEnStock = () => apiClient.get('/resources/instances/', { params: { statut: 'en_stock' } });
