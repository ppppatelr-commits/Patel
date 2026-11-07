'use client';

import { useEffect, useState } from 'react';
import { redirect } from 'next/navigation';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.authenticated) {
          redirect('/admin');
        }
      } catch (err) {
        // Ignore, show login form
      }
    };
    checkAuth();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        window.location.href = '/admin';
      } else {
        const err = await res.json();
        setError(err.error || 'Login failed');
      }
    } catch (err) {
      setError('Login error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/patel-logo-gold.png" alt="Logo" className="mx-auto h-24 w-auto mb-4 object-contain" />
          <h1 className="text-2xl font-bold uppercase tracking-tight">Admin Login</h1>
          <p className="text-secondary text-sm">Patel Restaurant Dashboard</p>
        </div>

        <div className="bg-[#141414] rounded-2xl border border-white/10 p-6 sm:p-8">
          {error && (
            <div className="mb-4 p-3 rounded bg-red-400/10 border border-red-400/20 text-red-400 text-sm">
              {error}
            </div>
          )}
          <form id="login-form" className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-white mb-2">Email Address</label>
              <input
                type="email"
                name="email"
                required
                className="w-full px-4 py-3 rounded-lg bg-[#0a0a0a] border border-white/10 text-white focus:ring-2 focus:ring-[#d4af37] focus:outline-none transition-all"
                placeholder="Enter your email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  required
                  className="w-full px-4 py-3 pr-12 rounded-lg bg-[#0a0a0a] border border-white/10 text-white focus:ring-2 focus:ring-[#d4af37] focus:outline-none transition-all"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/80 hover:text-[#d4af37] transition-colors p-1.5 rounded-md hover:bg-white/10 cursor-pointer z-10"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-4 px-4 font-bold rounded-lg uppercase tracking-wide text-sm transition-all shadow-lg ${
                loading
                  ? 'bg-white/20 text-white/50 cursor-not-allowed'
                  : 'bg-[#d4af37] text-[#0a0a0a] hover:bg-[#e6c850] active:scale-[0.98]'
              }`}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
