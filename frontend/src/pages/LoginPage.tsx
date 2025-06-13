import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { usePasswordToggle } from '../hooks/usePasswordToggle';

interface LocationState {
  from?: { pathname: string };
}

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState;
  const from = state?.from?.pathname || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const passwordToggle = usePasswordToggle();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const response = await axios.post('/auth/login', { email, password });
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      navigate(from, { replace: true });  // ← go back where they came from
    } catch (err: any) {
      const msg =
        err.response?.data?.error ||
        err.response?.data ||
        'Login failed. Please try again.';
      setError(msg);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-8 p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
      {/* Back Arrow */}
      <button
        onClick={() => navigate(from)}
        className="mb-4 text-gray-500 hover:text-gray-700 dark:text-gray-400"
      >
        <ArrowLeft size={24} />
      </button>

      <h2 className="text-2xl font-semibold text-center mb-6 dark:text-white">Login</h2>
      <form onSubmit={handleLogin} className="space-y-4">
        {/* Email */}
        <input
          type="email"
          placeholder="Email"
          value={email}
          required
          onChange={e => setEmail(e.target.value)}
          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-emerald-500"
        />

        {/* Password */}
        <div className="relative">
          <input
            type={passwordToggle.type}
            placeholder="Password"
            value={password}
            required
            onChange={e => setPassword(e.target.value)}
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-emerald-500"
          />
          <span
            onClick={passwordToggle.toggle}
            className="absolute right-3 top-2.5 cursor-pointer text-gray-500"
          >
            {passwordToggle.visible ? <EyeOff size={20}/> : <Eye size={20}/>}
          </span>
        </div>

        <button
          type="submit"
          className="w-full py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
        >
          Login
        </button>
        {error && <p className="text-red-500 text-sm">{error}</p>}
      </form>

      <p className="text-center text-sm mt-4 dark:text-gray-300">
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
