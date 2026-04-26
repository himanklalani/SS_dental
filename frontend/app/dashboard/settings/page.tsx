'use client';

import React, { useEffect, useState } from 'react';
import { getBusiness, updateBusiness } from '../../lib/api';
import { Save, Loader2, Globe, MessageSquare } from 'lucide-react';

const inputCls = "block w-full rounded bg-neutral-100 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 p-3 text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 focus:border-neutral-900 dark:focus:border-white focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white transition-all outline-none font-mono text-sm";
const labelCls = "block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2";

export default function SettingsPage() {
  const [business, setBusiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [businessId] = useState(process.env.NEXT_PUBLIC_BUSINESS_ID || '65f1a2b3c4d5e6f7a8b9c0d1');

  useEffect(() => {
    const fetchBusiness = async () => {
      try {
        const data = await getBusiness(businessId);
        setBusiness(data);
      } catch {
        setBusiness({
          google_review_url: 'https://g.page/r/fake/review',
          message_templates: [
            { service_category: 'dentist', template: "Hi {name}! Thanks for visiting us. Review us here: {review_url}" },
          ]
        });
      } finally { setLoading(false); }
    };
    fetchBusiness();
  }, [businessId]);

  const handleTemplateChange = (index: number, value: string) => {
    const newTemplates = [...business.message_templates];
    newTemplates[index].template = value;
    setBusiness({ ...business, message_templates: newTemplates });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateBusiness(businessId, { google_review_url: business.google_review_url, message_templates: business.message_templates });
      alert('Configuration updated.');
    } catch { alert('Failed to update configuration.'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="animate-spin text-neutral-400" size={32} /></div>;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-6">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white tracking-tight">Configuration</h1>
          <p className="text-neutral-500 mt-1 text-sm">System parameters and templates.</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center justify-center gap-2 bg-neutral-900 dark:bg-white text-white dark:text-black px-6 py-2 rounded hover:bg-neutral-700 dark:hover:bg-neutral-200 transition-all disabled:opacity-70 w-full md:w-auto font-bold text-sm uppercase tracking-wider">
          {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
          <span>{saving ? 'Saving...' : 'Save Changes'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Google Review URL */}
        <div className="bg-white dark:bg-neutral-900 rounded border border-neutral-200 dark:border-neutral-800 overflow-hidden">
          <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-3">
            <div className="p-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 rounded">
              <Globe size={20} />
            </div>
            <h2 className="text-lg font-medium text-neutral-900 dark:text-white">Review URL Destination</h2>
          </div>
          <div className="p-6">
            <label className={labelCls}>Target Redirect endpoint</label>
            <input type="text" value={business?.google_review_url || ''}
              onChange={(e) => setBusiness({ ...business, google_review_url: e.target.value })}
              className={inputCls} placeholder="https://g.page/r/..." />
            <p className="mt-2 text-xs text-neutral-500 font-mono">This URL is embedded in your outgoing review requests.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
