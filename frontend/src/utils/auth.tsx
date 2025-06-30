// src/utils/auth.ts

export const getAuthToken = () => localStorage.getItem('token');
export const getRefreshToken = () => localStorage.getItem('refreshToken');

export const saveAuthToken = (token: string) => localStorage.setItem('token', token);
export const saveRefreshToken = (token: string) => localStorage.setItem('refreshToken', token);

export const saveUser = (user: any) => localStorage.setItem('user', JSON.stringify(user));
export const getUser = () => {
  const raw = localStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
};

export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  sessionStorage.clear();
};
