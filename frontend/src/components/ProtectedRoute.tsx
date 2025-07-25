// src/components/ProtectedRoute.tsx
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api from '../utils/api';
import { logout, getAuthToken } from '../utils/auth';

// Only protect truly private routes
const PRIVATE_PATHS = [
  '/profile',
];

export default function ProtectedRoute() {
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    async function verify() {
      const token = getAuthToken();
      if (!token) {
        setAuthenticated(false);
        setChecking(false);
        return;
      }
      try {
        // lightweight check
        await api.get('profile');
        setAuthenticated(true);
      } catch {
        logout(); // clears token + redirect
        setAuthenticated(false);
      } finally {
        setChecking(false);
      }
    }
    verify();
  }, []);

  if (checking) return null;

  // If hitting a private path *and* not authed → login
  const isPrivate = PRIVATE_PATHS.some(path =>
    location.pathname.startsWith(path)
  );
  if (!authenticated && isPrivate) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Otherwise render everything
  return <Outlet />;
}
