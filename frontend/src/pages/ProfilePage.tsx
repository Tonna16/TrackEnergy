import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { User as UserIcon, LogOut as LogOutIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './ProfilePage.css';

interface UserDto {
  id: number;
  email: string;
  username: string;
  location?: string;
  createdAt?: string;
}

export default function ProfilePage() {
  const [user, setUser] = useState<UserDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    axios
      .get<UserDto>('/profile')
      .then((res) => setUser(res.data))
      .catch((err) => {
        console.error('Failed to load profile:', err.response?.status);
        if (err.response?.status === 401) {
          localStorage.removeItem('token');
          return navigate('/login');
        }
        setError('Unable to load profile.');
      });
  }, [navigate]);

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to log out?')) {
      localStorage.removeItem('token');
      navigate('/login');
    }
  };

  if (error) {
    return <div className="profile-error text-center mt-8">{error}</div>;
  }
  if (!user) {
    return <div className="profile-loading text-center mt-8">Loading profile…</div>;
  }

  return (
    <div className="max-w-md mx-auto mt-16 p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="flex items-center space-x-4 mb-6">
        <UserIcon className="h-12 w-12 text-emerald-600" />
        <div>
          <h2 className="text-xl font-semibold dark:text-white">{user.username}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
        </div>
      </div>

      <div className="space-y-2 mb-6 text-gray-700 dark:text-gray-200">
        {user.location && (
          <p><strong>Location:</strong> {user.location}</p>
        )}
        {user.createdAt && (
          <p><strong>Joined:</strong> {new Date(user.createdAt).toLocaleDateString()}</p>
        )}
      </div>

      <button
        onClick={handleLogout}
        className="w-full py-2 bg-red-500 text-white rounded-md hover:bg-red-600 flex items-center justify-center"
      >
        <LogOutIcon className="h-5 w-5 mr-2" />
        Log Out
      </button>
    </div>
  );
}
