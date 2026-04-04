import { apiClient } from './axios';

export const getCategories = () => apiClient.get('/resources/categories/');
export const getRessources = (params = {}) => apiClient.get('/resources/ressources/', { params });
export const getStock = () => apiClient.get('/resources/stocks/');
export const getStockAlertes = () => apiClient.get('/resources/stock/', { params: { alerte: true } });
export const getInstances = () => apiClient.get('/resources/instances/');
export const getMouvements = (params = {}) => apiClient.get('/resources/mouvements/', { params });
