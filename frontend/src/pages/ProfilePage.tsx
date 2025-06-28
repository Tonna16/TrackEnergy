import React, { useEffect, useState } from 'react';
import {
  User as UserIcon,
  ArrowLeft as BackIcon,
  LogOut as LogOutIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './ProfilePage.css';
import api from '../utils/api'; // make sure this is imported

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
    const token = localStorage.getItem('token');
    api
      .get<UserDto>('/auth/profile', {
        headers: { Authorization: token ? `Bearer ${token}` : '' },
      })
      .then((res) => setUser(res.data))
      .catch((err) => {
        const status = err.response?.status;
        if (status === 401 || status === 403) {
          localStorage.removeItem('token');
          navigate('/login');
        } else {
          console.error(err);
          setError('Unable to load profile.');
        }
      });
  }, [navigate]);

  const handleBack = () => {
    navigate('/');
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to log out?')) {
      localStorage.removeItem('token');
      navigate('/');
    }
  };

  if (error) {
    return <div className="profile-error text-center mt-8">{error}</div>;
  }
  if (!user) {
    return <div className="profile-loading text-center mt-8">Loading profile…</div>;
  }

  // Format the joined date
  const joined = new Date(user.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="profile-page">
      <button className="back-button" onClick={handleBack}>
        <BackIcon /> Back
      </button>

      <div className="profile-header">
        <UserIcon className="profile-avatar" />
        <h2 className="profile-username">{user.username}</h2>
      </div>

      <div className="profile-info">
        <p><strong>Full Name:</strong> {user.fullName || '—'}</p>
        <p><strong>Email:</strong> {user.email}</p>
        <p><strong>Joined:</strong> {joined}</p>
      </div>

      <button className="logout-button" onClick={handleLogout}>
        <LogOutIcon className="logout-icon" /> Log Out
      </button>
    </div>
  );
}
