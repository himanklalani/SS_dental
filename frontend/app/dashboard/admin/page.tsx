'use client';

import React, { useState } from 'react';
import { sendDirectMessage } from '../../lib/api';
import { Send, Phone, User, Loader2, CheckCircle, AlertCircle, Terminal, MessageSquare, ArrowRight } from 'lucide-react';

const inputCls = "pl-10 block w-full rounded bg-neutral-100 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 p-3 text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 focus:border-neutral-900 dark:focus:border-white focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white transition-all outline-none font-mono text-sm";

export default function AdminPanel() {
  const [formData, setFormData] = useState({
    name: '', phone: '', business_id: '65f1a2b3c4d5e6f7a8b9c0d1'
  });
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending'); setStatusMessage('');
    try {
      await sendDirectMessage(formData);
      setStatus('success');
      setStatusMessage('Generic message dispatched via WhatsApp.');
      setFormData({ ...formData, name: '', phone: '' });
      setTimeout(() => { setStatus('idle'); setStatusMessage(''); }, 4000);
    } catch (error: any) {
      setStatus('error');
      setStatusMessage(error.response?.data?.message || 'Dispatch failed.');
    }
  };

  return (
    <div className="space-y-12 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-6">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white tracking-tight">Manual Dispatch</h1>
          <p className="text-neutral-500 mt-1 text-sm">Send a pre-approved outreach message to any patient.</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded text-xs font-mono text-neutral-500">
          <Terminal size={14} />
          <span>MODE: MANUAL_OVERRIDE</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Form */}
        <div className="xl:col-span-2">
          <div className="bg-white dark:bg-neutral-900 rounded border border-neutral-200 dark:border-neutral-800 overflow-hidden">
            <div className="p-6 md:p-8">
              <div className="flex items-center gap-3 mb-8">
                <div className="bg-neutral-100 dark:bg-neutral-800 p-2 rounded text-neutral-600 dark:text-neutral-300">
                  <Send size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-medium text-neutral-900 dark:text-white">Recipient Details</h2>
                  <p className="text-xs text-neutral-400 font-mono">Template: generic_clinic_message</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Patient Name</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User size={16} className="text-neutral-400 group-focus-within:text-neutral-700 dark:group-focus-within:text-white transition-colors" />
                      </div>
                      <input type="text" name="name" value={formData.name} onChange={handleChange} required className={inputCls} placeholder="Priya Sharma" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">WhatsApp Number</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Phone size={16} className="text-neutral-400 group-focus-within:text-neutral-700 dark:group-focus-within:text-white transition-colors" />
                      </div>
                      <input type="tel" name="phone" value={formData.phone} onChange={handleChange} required className={inputCls} placeholder="+91 98765 43210" />
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <button type="submit" disabled={status === 'sending'}
                    className="w-full bg-neutral-900 dark:bg-white text-white dark:text-black hover:bg-neutral-700 dark:hover:bg-neutral-200 disabled:opacity-70 disabled:cursor-not-allowed px-6 py-3 rounded font-bold text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2">
                    {status === 'sending' ? (
                      <><Loader2 className="animate-spin" size={16} /><span>Dispatching...</span></>
                    ) : (
                      <><span>Send Message</span><ArrowRight size={16} /></>
                    )}
                  </button>
                </div>

                {status === 'success' && (
                  <div className="flex items-center gap-2 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-500 rounded text-sm font-mono animate-fade-in">
                    <CheckCircle size={16} /><span>{statusMessage}</span>
                  </div>
                )}
                {status === 'error' && (
                  <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded text-sm font-mono animate-fade-in">
                    <AlertCircle size={16} /><span>{statusMessage}</span>
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>

        {/* Template Preview */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-neutral-900 rounded p-6 border border-neutral-200 dark:border-neutral-800">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white mb-4 flex items-center gap-2 uppercase tracking-wider">
              <MessageSquare className="text-neutral-400" size={16} />
              Template Preview
            </h3>
            <div className="bg-neutral-950 rounded p-4 border border-neutral-800 font-mono text-xs leading-relaxed text-neutral-300 space-y-2">
              <p className="text-neutral-500">// generic_clinic_message</p>
              <p>
                Hi <span className="text-emerald-400">{formData.name || '{{1}}'}</span>! 👋 This is{' '}
                <span className="text-blue-400">Saachi Shingrani Clinic</span>.
              </p>
              <p>We hope you are doing well! Feel free to reach out to us or book your next appointment through our website.</p>
            </div>
            <p className="mt-3 text-xs text-neutral-400 font-mono">This template must be pre-approved in Meta Business Suite before dispatching.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
