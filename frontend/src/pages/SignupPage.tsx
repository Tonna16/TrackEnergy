import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { usePasswordToggle } from '../hooks/usePasswordToggle';
import axios from 'axios';

interface LocationState {
  from?: { pathname: string };
}

const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const state = useLocation().state as LocationState;
  const from = state?.from?.pathname || '/';

  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const passwordToggle = usePasswordToggle();
  const confirmToggle = usePasswordToggle();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    setError(null);
    try {
      const res = await axios.post('/auth/signup', {
        username,
        fullName,
        email,
        password,
      });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Signup failed');
    }
  };

  return (
    <div className="max-w-md mx-auto mt-8 p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
      <button onClick={() => navigate(from)} className="mb-4 text-gray-500">
        <ArrowLeft size={24} />
      </button>
      <h2 className="text-2xl font-semibold text-center mb-6">Sign Up</h2>
      <form onSubmit={handleSignup} className="space-y-4">
        <input
          type="text"
          placeholder="Username"
          value={username}
          required
          onChange={e => setUsername(e.target.value)}
          className="w-full px-3 py-2 border rounded-md"
        />
        <input
          type="text"
          placeholder="Full Name"
          value={fullName}
          required
          onChange={e => setFullName(e.target.value)}
          className="w-full px-3 py-2 border rounded-md"
        />
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

        <div className="relative">
          <input
            type={confirmToggle.type}
            placeholder="Confirm Password"
            value={confirmPassword}
            required
            onChange={e => setConfirmPassword(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
          />
          <span
            onClick={confirmToggle.toggle}
            className="absolute right-3 top-2.5 cursor-pointer"
          >
            {confirmToggle.visible ? <EyeOff size={20} /> : <Eye size={20} />}
          </span>
        </div>

        <button
          type="submit"
          className="w-full py-2 bg-emerald-600 text-white rounded-md"
        >
          Sign Up
        </button>
        {error && <p className="text-red-500 text-center">{error}</p>}
      </form>
      <p className="text-center mt-4 text-sm">
        Already have an account?{' '}
        <button
          onClick={() => navigate('/login', { state: { from } })}
          className="text-emerald-600 hover:underline"
        >
          Login
        </button>
      </p>
    </div>
  );
};

export default SignupPage;
