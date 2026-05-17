import { apiClient } from './axios';

export const getRetours = (params = {}) => apiClient.get('/returns/retours/', { params });
export const createRetour = (data) => apiClient.post('/returns/retours/', data);
export const updateDecision = (id, data) => apiClient.patch(`/returns/retours/${id}/`, data);
export const receptionnerRetour = (id) => apiClient.post(`/returns/retours/${id}/receptionner/`);
