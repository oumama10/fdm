import { apiClient } from './axios';

export const getAlertes = (params = {}) => apiClient.get('/alerts/alertes/', { params });
export const acquitterAlerte = (id, data = { acquitte: true }) =>
	apiClient.patch(`/alerts/alertes/${id}/`, data);
export const getNotifications = () => apiClient.get('/alerts/notifications/');
export const marquerLu = (id) => apiClient.post(`/alerts/notifications/${id}/marquer_lu/`);
