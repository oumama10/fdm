import { apiClient } from './axios';

export const login = (email, password) => apiClient.post('/auth/login/', { email, password });
export const logout = () => apiClient.post('/auth/logout/');
export const me = () => apiClient.get('/auth/me/');
export const refresh = (refresh) => apiClient.post('/auth/refresh/', { refresh });
