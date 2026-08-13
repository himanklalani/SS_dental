'use client';

import React, { useState, useEffect } from 'react';
import api, { sendDirectMessage } from '../../lib/api';
import { Send, Phone, User, Loader2, CheckCircle, AlertCircle, Terminal, MessageSquare, ArrowRight, Zap } from 'lucide-react';

const inputCls = "pl-10 block w-full rounded bg-neutral-100 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 p-3 text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 focus:border-neutral-900 dark:focus:border-white focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white transition-all outline-none font-mono text-sm";

const SYSTEM_TEMPLATES: Record<string, { name: string; body: string }> = {
  'generic_clinic_msg':         { name: 'Generic Announcement',           body: "Greetings from Dr. Saachi Shingrani's Dental Care, {{1}}, we sincerely hope you are doing well. Please feel free to reach out to us or book your next appointment at your convenience or send a text here. 😊\n\nVisit our website: https://www.srsdentalcare.in\nCall us: +919004402797" },
  'review_request_no_followup': { name: 'Review Request (No Follow-up)',  body: "Greetings {{1}} from Dr Saachi Shingrani's Dental Care, it would be really helpful if you shared your review about us.\n\nThank You!" },
  'appointment_reminder':       { name: 'Appointment Reminder',           body: "Hi {{1}}, this is a friendly reminder that you have an upcoming appointment. We look forward to seeing you!" },
};

export default function AdminPanel() {
  const [formData, setFormData] = useState({
    name: '', phone: '', business_id: '69edf7401e9164e3fd73e073', template_name: 'generic_clinic_msg'
  });
  const [countryCode, setCountryCode] = useState('+91');
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  // Dynamic custom templates from DB
  const [customTemplates, setCustomTemplates] = useState<any[]>([]);

  useEffect(() => {
    api.get('/templates')
      .then(res => setCustomTemplates(res.data.filter((t: any) => t.status === 'APPROVED')))
      .catch(() => {}); // non-fatal
  }, []);

  // Build preview text for the selected template
  const getPreviewText = () => {
    const tName = formData.template_name;
    const displayName = formData.name || '{{1}}';

    if (SYSTEM_TEMPLATES[tName]) {
      return SYSTEM_TEMPLATES[tName].body.replace(/\{\{1\}\}/g, displayName).replace(/\\n/g, '\n');
    }
    const custom = customTemplates.find(t => t.name === tName);
    if (custom) {
      const bodyComp = custom.components?.find((c: any) => c.type === 'BODY');
      return (bodyComp?.text || '')
        .replace(/\{\{1\}\}/g, displayName)
        .replace(/\{\{2\}\}/g, '[Service]')
        .replace(/\\n/g, '\n');
    }
    return '';
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending'); setStatusMessage('');
    try {
      await sendDirectMessage({ ...formData, phone: countryCode + formData.phone });
      setStatus('success');
      setStatusMessage('Message dispatched via WhatsApp.');
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
          <span>SRS Dental Care</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Form */}
        <div className="xl:col-span-2">
          <div className="bg-white dark:bg-neutral-900 rounded border border-neutral-200 dark:border-neutral-800 overflow-hidden">
            <div className="p-6 md:p-8">
              <div className="flex flex-col md:flex-row md:items-center gap-3 mb-8 justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-neutral-100 dark:bg-neutral-800 p-2 rounded text-neutral-600 dark:text-neutral-300">
                    <Send size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-medium text-neutral-900 dark:text-white">Recipient Details</h2>
                    <p className="text-xs text-neutral-400 font-mono">Select a pre-approved template.</p>
                  </div>
                </div>
                <div>
                  <select
                    name="template_name"
                    value={formData.template_name}
                    onChange={handleChange}
                    className="bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded p-2 text-sm text-neutral-900 dark:text-white outline-none"
                  >
                    <optgroup label="System Templates">
                      {Object.entries(SYSTEM_TEMPLATES).map(([id, t]) => (
                        <option key={id} value={id}>{t.name}</option>
                      ))}
                    </optgroup>
                    {customTemplates.length > 0 && (
                      <optgroup label="Custom Templates">
                        {customTemplates.map(t => (
                          <option key={t.name} value={t.name}>{t.name.replace(/_/g, ' ')}</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
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
                    <p className="text-[10px] text-neutral-400 mb-1 -mt-1">Edit the box to change country code.</p>
                    <div className="flex gap-2 relative group">
                      <input type="text" className={`${inputCls.replace('w-full', 'w-20')} px-2 text-center pl-3 shrink-0`} value={countryCode} onChange={e => setCountryCode(e.target.value)} />
                      <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Phone size={16} className="text-neutral-400 group-focus-within:text-neutral-700 dark:group-focus-within:text-white transition-colors" />
                        </div>
                        <input type="tel" name="phone" value={formData.phone} onChange={handleChange} required className={inputCls} placeholder="9876543210" />
                      </div>
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
        <div className="space-y-4">
          <div className="bg-white dark:bg-neutral-900 rounded p-6 border border-neutral-200 dark:border-neutral-800">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white mb-4 flex items-center gap-2 uppercase tracking-wider">
              <MessageSquare className="text-neutral-400" size={16} />
              Live Preview
            </h3>
            <div className="bg-[#e9f7ef] rounded-xl p-4 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed shadow-sm border border-[#d5f0e0] min-h-[100px]">
              {getPreviewText() || <span className="text-gray-400 italic text-xs">No preview available.</span>}
            </div>
            <p className="mt-2 text-xs text-neutral-400 font-mono">{"{{1}}"} = Patient name (auto-injected)</p>
          </div>

          <div className="bg-green-50 dark:bg-green-950/30 rounded p-4 border border-green-100 dark:border-green-800">
            <h4 className="text-sm font-semibold text-green-800 dark:text-green-400 mb-1 flex items-center gap-1">
              <Zap size={14} /> Smart Interceptor Active
            </h4>
            <p className="text-xs text-green-700 dark:text-green-500">
              If this patient has messaged in the last 24h, this will be sent as a <strong>free message</strong> instead of a paid template.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
