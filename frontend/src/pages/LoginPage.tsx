// src/pages/LoginPage.tsx
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { usePasswordToggle } from '../hooks/usePasswordToggle';
import api from '../utils/api'; // Ensure this path is correct
const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const from = (useLocation().state as any)?.from?.pathname || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false); // NEW STATE
  const [error, setError] = useState<string | null>(null);
  const passwordToggle = usePasswordToggle();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await api.post('/auth/login', {
        email,
        password,
        remember, // SEND REMEMBER FLAG TO BACKEND
      });
      localStorage.setItem('token', res.data.accessToken);
      localStorage.setItem('refreshToken', res.data.refreshToken);

      localStorage.setItem('user', JSON.stringify(res.data.user));
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    }
  };

  return (
    <div className="max-w-md mx-auto mt-8 p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
      <button onClick={() => navigate(from)} className="mb-4 text-gray-500">
        <ArrowLeft size={24} />
      </button>
      <h2 className="text-2xl font-semibold text-center mb-6">Login</h2>
      <form onSubmit={handleLogin} className="space-y-4">
        <input
          type="email"
          placeholder="Email"
          value={email}
          required
          onChange={e => setEmail(e.target.value)}
          className="w-full px-3 py-2 border rounded-md"
        />
        <div className="relative">
          <input
            type={passwordToggle.type}
            placeholder="Password"
            value={password}
            required
            onChange={e => setPassword(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
          />
          <span
            onClick={passwordToggle.toggle}
            className="absolute right-3 top-2.5 cursor-pointer"
          >
            {passwordToggle.visible ? <EyeOff size={20} /> : <Eye size={20} />}
          </span>
        </div>

        {/* REMEMBER ME CHECKBOX */}
        <label className="flex items-center text-sm">
          <input
            type="checkbox"
            checked={remember}
            onChange={() => setRemember(prev => !prev)}
            className="mr-2"
          />
          Remember me
        </label>

        <button
          type="submit"
          className="w-full py-2 bg-emerald-600 text-white rounded-md"
        >
          Login
        </button>
        {error && <p className="text-red-500 text-center">{error}</p>}
      </form>

      <p className="text-center mt-4 text-sm">
        Don’t have an account?{' '}
        <button
          onClick={() => navigate('/signup', { state: { from } })}
          className="text-emerald-600 hover:underline"
        >
          Sign Up
        </button>
      </p>
    </div>
  );
};

export default LoginPage;
