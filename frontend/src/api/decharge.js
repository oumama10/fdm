import { apiClient } from './axios';

export const getDecharges = () => apiClient.get('/decharge/decharges/');
export const getDechargeById = (id) => apiClient.get(`/decharge/decharges/${id}/`);
export const createDecharge = (data) => apiClient.post('/decharge/decharges/', data);
export const downloadPdf = (id) => apiClient.get(`/decharge/decharges/${id}/download_pdf/`, { responseType: 'blob' });

export const downloadDechargePdf = async (id, type = null) => {
  const params = type ? `?type=${type}` : '';
  try {
    const res = await apiClient.get(`/decharge/decharges/${id}/pdf/${params}`, { responseType: 'blob' });
    // Check if the response is actually a PDF (not a JSON error wrapped in blob)
    const contentType = res.data.type || res.headers?.['content-type'] || '';
    if (!contentType.includes('application/pdf')) {
      // Try to read the blob as text to get the error message
      let text = '';
      try { text = await res.data.text(); } catch (e) {}
      console.error('PDF download error:', text);
      alert('Erreur lors du téléchargement du PDF.');
      return;
    }
    const blob = new Blob([res.data], { type: 'application/pdf' });
    console.log('PDF Blob Size:', blob.size);
    if (blob.size === 0) {
      alert('Le fichier PDF est vide (0 octets). Erreur du serveur.');
      return;
    }
    const url      = URL.createObjectURL(blob);
    const a        = document.createElement('a');
    const suffix   = type ? `-${type}` : '';
    a.href         = url;
    a.download     = `decharge-${id}${suffix}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('PDF download failed:', err);
    // If the error response is a blob, try to read it
    if (err.response?.data instanceof Blob) {
      try {
        const text = await err.response.data.text();
        console.error('Server error:', text);
      } catch (_) { /* ignore */ }
    }
    alert('Erreur lors du téléchargement du PDF. Veuillez réessayer.');
  }
};
export const getDechargeTypes = (id) => apiClient.get(`/decharge/decharges/${id}/types/`);
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
export const marquerSigne = (dechargeId) =>
	apiClient.post(`/decharge/decharges/${dechargeId}/signature/marquer_signe/`);
