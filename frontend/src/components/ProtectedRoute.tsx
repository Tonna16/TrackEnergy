import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

// Only protect truly private routes
const PRIVATE_PATHS = [
  '/profile',
];

export default function ProtectedRoute() {
  const location = useLocation();
  const { authReady, authStatus, authError, resolveAuthState } = useAppContext();

  // If hitting a private path *and* not authed → login
  const isPrivate = PRIVATE_PATHS.some(path =>
    location.pathname.startsWith(path)
  );
  if (!isPrivate) return <Outlet />;

  if (!authReady || authStatus === 'checking') return null;

  if (authStatus !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return (
    <>
      {authError?.kind === 'transient' && (
        <div role="alert" className="p-2 text-sm text-amber-200 bg-amber-900/60 rounded-md mb-2">
          {authError.message}{' '}
          <button
            type="button"
            className="underline"
            onClick={() => void resolveAuthState()}
          >
            Retry
          </button>
        </div>
      )}
      <Outlet />
    </>
  );
}
