import { apiClient } from './axios';

export const getStockInstantane = () => apiClient.get('/reporting/stock/instantane/');
export const getStockPeriodique = (params) => apiClient.get('/reporting/stock/periodique/', { params });
export const getDashboard = () => apiClient.get('/reporting/dashboard/');
export const getBilanAnnuel = (annee) => apiClient.get(`/reporting/bilan_annuel/?annee=${annee}`);
export const getStatistiquesAchats = (params) => apiClient.get('/reporting/statistiques_achats/', { params });
