// src/pages/ProfilePage.tsx
import  { useEffect, useState } from 'react';
import {
  User as UserIcon,
  ArrowLeft as BackIcon,
  LogOut as LogOutIcon,
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import './ProfilePage.css';
import api from '../utils/api';
import { logout } from '../utils/auth';

interface UserDto {
  username: string;
  email: string;
  fullName?: string;
  createdAt: string;
}

export default function ProfilePage() {
  const [user, setUser] = useState<UserDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .get<UserDto>('profile')
      .then((res) => setUser(res.data))
      .catch((err) => {
        const status = err.response?.status;
        if (status === 401 || status === 403) {
          logout();
          navigate('/login');
        } else {
          console.error('Profile fetch error:', err);
          setError('Unable to load profile.');
        }
      });
  }, [navigate]);

  const handleBack = () => {
    navigate(-1);
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to log out?')) {
      logout();
      navigate('/login');
    }
  };

  if (error) {
    return <div className="profile-error text-center mt-8 text-red-500">{error}</div>;
  }

  if (!user) {
    return (
      <div className="flex justify-center items-center mt-20">
        <div className="loader">Loading...</div>
      </div>
    );
  }

  const joined = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '—';

  return (
    <div className="profile-page max-w-md mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow mt-8">
      <button
        className="back-button flex items-center mb-6 text-gray-600 hover:text-gray-900 dark:hover:text-white"
        onClick={handleBack}
      >
        <BackIcon className="mr-2" /> Back
      </button>

      <div className="profile-header flex flex-col items-center mb-6">
        <UserIcon className="profile-avatar w-16 h-16 text-emerald-600 dark:text-emerald-400 mb-2" />
        <h2 className="profile-username text-2xl font-semibold">{user.username}</h2>
      </div>

      <div className="profile-info space-y-2 text-gray-700 dark:text-gray-300">
        <p>
          <strong>Full Name:</strong> {user.fullName || '—'}
        </p>
        <p>
          <strong>Email:</strong> {user.email}
        </p>
        <p>
          <strong>Joined:</strong> {joined}
        </p>
      </div>

      {/* Optional future enhancement */}
      {/* <Link to="/edit-profile" className="btn btn-outline w-full mt-4 text-center">
        Edit Profile
      </Link> */}

      <button
        className="logout-button mt-8 w-full flex items-center justify-center space-x-2 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition"
        onClick={handleLogout}
      >
        <LogOutIcon className="logout-icon" /> <span>Log Out</span>
      </button>
    </div>
  );
}
