'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login, TOKEN_KEY } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      router.replace('/');
    } catch (err: any) {
      setError(err?.message || 'Login failed');
      setBusy(false);
    }
  };

  const fillDemo = () => {
    setEmail('admin@khaadi.com');
    setPassword('admin123');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="h-12 w-12 bg-emerald-600 rounded-xl flex items-center justify-center font-bold text-white text-2xl">
            P
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Pak Commerce</h1>
            <p className="text-xs text-emerald-400 font-medium">Merchant Operating System</p>
          </div>
        </div>

        <form
          onSubmit={submit}
          className="bg-white rounded-2xl shadow-2xl p-7 space-y-4"
        >
          <h2 className="text-lg font-bold text-slate-900">Sign in to your store</h2>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@store.com"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-sm transition"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <button
            type="button"
            onClick={fillDemo}
            className="w-full text-xs text-slate-500 hover:text-emerald-600 font-medium"
          >
            Fill demo credentials (admin@khaadi.com)
          </button>
        </form>
      </div>
    </div>
  );
}
