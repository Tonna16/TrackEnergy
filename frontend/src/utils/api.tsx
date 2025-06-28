// src/lib/api.ts
import axios from 'axios';

const api = axios.create({
baseURL: '/api',
withCredentials: false,
});

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  console.log('Using token:', token);
  console.log("Sending request with token:", token)

  if (token) {
    cfg.headers = cfg.headers || {};
    cfg.headers.Authorization = `Bearer ${token}`;

  }
  return cfg;
});


export default api;
