'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Lock, User, ArrowRight } from 'lucide-react';
import Cookies from 'js-cookie';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === 'srsbooking' && password === '9004402797') {
      Cookies.set('srs_auth', 'authenticated', { expires: 7 }); // Cookie expires in 7 days
      router.push('/dashboard');
    } else {
      setError('Invalid username or password');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-100 dark:bg-neutral-950 flex items-center justify-center p-4 selection:bg-emerald-500/30">
      <div className="w-full max-w-md">
        <div className="text-center mb-10 animate-fade-in">
          <div className="w-16 h-16 bg-neutral-900 dark:bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
            <Box size={32} className="text-white dark:text-black" />
          </div>
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-white tracking-tight">Clinic CRM</h1>
          <p className="text-neutral-500 mt-2">Sign in to manage your practice</p>
        </div>

        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-8 shadow-2xl shadow-black/5 animate-scale-in">
          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm rounded-lg text-center animate-fade-in">
                {error}
              </div>
            )}
            
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider">Username</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User size={18} className="text-neutral-400" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl pl-12 pr-4 py-3 text-neutral-900 dark:text-white focus:border-neutral-900 dark:focus:border-white focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white outline-none transition-all"
                  placeholder="Enter username"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock size={18} className="text-neutral-400" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl pl-12 pr-4 py-3 text-neutral-900 dark:text-white focus:border-neutral-900 dark:focus:border-white focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white outline-none transition-all"
                  placeholder="Enter password"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full group bg-neutral-900 dark:bg-white text-white dark:text-black py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-all active:scale-[0.98]"
            >
              Sign In
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
