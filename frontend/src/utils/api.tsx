import type { AxiosInstance } from 'axios';
import { BACKEND_ENABLED } from '../config/runtime';

// The default build removes this import and all server request interceptors.
async function loadApi() {
  if (!BACKEND_ENABLED) throw new Error('Server requests require local full-stack mode.');
  return (await import('./backendApi')).default;
}

const api: Pick<AxiosInstance, 'get' | 'post' | 'put' | 'patch' | 'delete'> = {
  get: async (...args) => (await loadApi()).get(...args),
  post: async (...args) => (await loadApi()).post(...args),
  put: async (...args) => (await loadApi()).put(...args),
  patch: async (...args) => (await loadApi()).patch(...args),
  delete: async (...args) => (await loadApi()).delete(...args),
};

export default api;
