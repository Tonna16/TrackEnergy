// src/components/ProtectedRoute.tsx
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api from '../utils/api';
import { logout, getAuthToken } from '../utils/auth';

export default function ProtectedRoute() {
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const verify = async () => {
      const token = getAuthToken();
      if (!token) {
        setAuthenticated(false);
        setChecking(false);
        return;
      }

      try {
        await api.get('/auth/profile'); // triggers interceptor & validates/refreshes
        setAuthenticated(true);
      } catch {
        logout();
        setAuthenticated(false);
      } finally {
        setChecking(false);
      }
    };

    verify();
  }, []);

  if (checking) return null; // Or show loading spinner

  return authenticated ? (
    <Outlet />
  ) : (
    <Navigate to="/login" replace state={{ from: location }} />
  );
}
 