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
    const year     = new Date().getFullYear();
    const filename = type === 'consommable'      ? `Décharge Consommable ${year}.pdf`
                   : type === 'bien_inventaire'  ? `Décharge Bien Inventaire ${year}.pdf`
                   :                               `Décharge ${year}.pdf`;
    a.href         = url;
    a.download     = filename;
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

// Trigger a blob as a browser download without any async gap after the click.
// URL is revoked after 60 s to give the browser time to start the download.
function _triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// Dedup guard: prevents React StrictMode double-fire (and accidental double-click)
// from triggering two concurrent downloads for the same décharge.
const _inFlight = new Set();

// Single entry-point for all download buttons.
// Mixed décharge → fetch both PDFs in parallel, then trigger the two downloads
// back-to-back with no async gap between them so the browser treats them as
// one batch and does not block the second with its multi-download guard.
export const downloadDechargeAuto = async (id) => {
  if (_inFlight.has(id)) return;
  _inFlight.add(id);
  try {
    const typesRes = await apiClient.get(`/decharge/decharges/${id}/types/`);
    // djangorestframework-camel-case converts snake_case → camelCase in responses
    const { isMixed } = typesRes.data;

    if (isMixed) {
      const [resBI, resC] = await Promise.all([
        apiClient.get(`/decharge/decharges/${id}/pdf/?type=bien_inventaire`, { responseType: 'blob' }),
        apiClient.get(`/decharge/decharges/${id}/pdf/?type=consommable`, { responseType: 'blob' }),
      ]);
      // Synchronous back-to-back — no await between the two clicks
      const year = new Date().getFullYear();
      _triggerBlobDownload(resBI.data, `Décharge Bien Inventaire ${year}.pdf`);
      _triggerBlobDownload(resC.data,  `Décharge Consommable ${year}.pdf`);
    } else {
      await downloadDechargePdf(id);
    }
  } catch (err) {
    console.error('downloadDechargeAuto:', err);
    alert('Erreur lors du téléchargement. Veuillez réessayer.');
  } finally {
    _inFlight.delete(id);
  }
};
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
	apiClient.post(`/decharge/decharges/${dechargeId}/signature/confirmer/`);
