import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

function toSnakeCase(str) {
  return str.replace(/([A-Z])/g, (m) => '_' + m.toLowerCase());
}

function deepSnakeKeys(value) {
  if (Array.isArray(value)) return value.map(deepSnakeKeys);
  if (value !== null && typeof value === 'object' && !(value instanceof Blob)) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [toSnakeCase(k), deepSnakeKeys(v)])
    );
  }
  return value;
}

// Request interceptor: attach Authorization header
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401 and refresh
let isRefreshing = false;
let failedQueue = [];

function processQueue(error, token = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
}

apiClient.interceptors.response.use(
  (response) => {
    if (response.config?.responseType !== 'blob' && response.data && typeof response.data === 'object') {
      response.data = deepSnakeKeys(response.data);
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const url = originalRequest?.url || '';
    const isAuthRoute =
      url.includes('/auth/login/') ||
      url.includes('/auth/refresh/') ||
      url.includes('/auth/logout/');
    if (
      error.response &&
      error.response.status === 401 &&
      !isAuthRoute &&
      !originalRequest._retry
    ) {
      if (isRefreshing) {
        return new Promise(function (resolve, reject) {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = 'Bearer ' + token;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }
      originalRequest._retry = true;
      isRefreshing = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw error;
        const res = await apiClient.post('/auth/refresh/', {
          refresh: refreshToken,
        });
        const { access } = res.data;
        localStorage.setItem('accessToken', access);
        processQueue(null, access);
        originalRequest.headers.Authorization = 'Bearer ' + access;
        return apiClient(originalRequest);
      } catch (err) {
        processQueue(err, null);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export { apiClient };
