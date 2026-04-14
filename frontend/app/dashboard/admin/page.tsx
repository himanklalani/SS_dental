'use client';

import React, { useState } from 'react';
import { triggerReview } from '../../lib/api';
import { Send, Phone, User, Tag, Loader2, CheckCircle, AlertCircle, Terminal, MessageSquare, ArrowRight } from 'lucide-react';

export default function AdminPanel() {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    service_type: '',
    business_id: '65f1a2b3c4d5e6f7a8b9c0d1' // Valid ObjectId
  });
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    setStatusMessage('');
    
    try {
      await triggerReview(formData);
      setStatus('success');
      setStatusMessage('Request queued in dispatch system.');
      setFormData({ ...formData, name: '', phone: '', service_type: '' });
      
      setTimeout(() => {
          setStatus('idle');
          setStatusMessage('');
      }, 3000);

    } catch (error: any) {
      console.error(error);
      setStatus('error');
      setStatusMessage(error.response?.data?.message || 'Dispatch failed.');
    }
  };

  return (
    <div className="space-y-12 animate-fade-in">
       <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-neutral-800 pb-6">
        <div>
            <h1 className="text-2xl font-semibold text-white tracking-tight">Manual Dispatch</h1>
            <p className="text-neutral-500 mt-1 text-sm">Trigger individual review requests.</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-neutral-900 border border-neutral-800 rounded text-xs font-mono text-neutral-400">
            <Terminal size={14} />
            <span>MODE: MANUAL_OVERRIDE</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Main Form Section */}
          <div className="xl:col-span-2 space-y-6">
            <div className="bg-neutral-900 rounded border border-neutral-800 overflow-hidden">
                <div className="p-6 md:p-8">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="bg-neutral-800 p-2 rounded text-white">
                            <Send size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-medium text-white">New Request Payload</h2>
                            <p className="text-xs text-neutral-500 font-mono">Target: WhatsApp Business API</p>
                        </div>
                    </div>
                    
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Customer Name</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <User size={16} className="text-neutral-600 group-focus-within:text-white transition-colors" />
                                    </div>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        required
                                        className="pl-10 block w-full rounded bg-neutral-950 border border-neutral-800 p-3 text-white placeholder-neutral-600 focus:border-white focus:ring-1 focus:ring-white transition-all outline-none font-mono text-sm"
                                        placeholder="ALEX MORGAN"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Phone Number</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Phone size={16} className="text-neutral-600 group-focus-within:text-white transition-colors" />
                                    </div>
                                    <input
                                        type="tel"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleChange}
                                        required
                                        className="pl-10 block w-full rounded bg-neutral-950 border border-neutral-800 p-3 text-white placeholder-neutral-600 focus:border-white focus:ring-1 focus:ring-white transition-all outline-none font-mono text-sm"
                                        placeholder="+1 234 567 8900"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2 md:col-span-2">
                                <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Service Context</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Tag size={16} className="text-neutral-600 group-focus-within:text-white transition-colors" />
                                    </div>
                                    <input
                                        type="text"
                                        name="service_type"
                                        value={formData.service_type}
                                        onChange={handleChange}
                                        required
                                        className="pl-10 block w-full rounded bg-neutral-950 border border-neutral-800 p-3 text-white placeholder-neutral-600 focus:border-white focus:ring-1 focus:ring-white transition-all outline-none font-mono text-sm"
                                        placeholder="DELIVERY #1234"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-4">
                            <button
                                type="submit"
                                disabled={status === 'sending'}
                                className="w-full bg-white text-black hover:bg-neutral-200 disabled:opacity-70 disabled:cursor-not-allowed px-6 py-3 rounded font-bold text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                            >
                                {status === 'sending' ? (
                                    <>
                                        <Loader2 className="animate-spin" size={16} />
                                        <span>Dispatching...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Initiate Dispatch</span>
                                        <ArrowRight size={16} />
                                    </>
                                )}
                            </button>
                        </div>
                        
                        {status === 'success' && (
                            <div className="flex items-center gap-2 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded text-sm font-mono animate-fade-in">
                                <CheckCircle size={16} />
                                <span>{statusMessage}</span>
                            </div>
                        )}

                        {status === 'error' && (
                            <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded text-sm font-mono animate-fade-in">
                                <AlertCircle size={16} />
                                <span>{statusMessage}</span>
                            </div>
                        )}
                    </form>
                </div>
            </div>
          </div>

          {/* Sidebar / Info Section */}
          <div className="space-y-6">
            {/* Live Preview Card */}
            <div className="bg-neutral-900 rounded p-6 border border-neutral-800">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2 uppercase tracking-wider">
                    <MessageSquare className="text-neutral-500" size={16} />
                    Payload Preview
                </h3>
                <div className="bg-black rounded p-4 border border-neutral-800 relative font-mono text-xs leading-relaxed text-neutral-300">
                    <div className="absolute -left-2 top-4 w-4 h-4 bg-black border-l border-t border-neutral-800 rotate-45"></div>
                    <p>
                        "Hi {formData.name || '[NAME]'}! Thanks for choosing us for your {formData.service_type || '[SERVICE]'}. We'd love your feedback..."
                    </p>
                </div>
            </div>
          </div>
      </div>
    </div>
  );
}
