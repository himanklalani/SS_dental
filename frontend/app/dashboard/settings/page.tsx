'use client';

import React, { useEffect, useState } from 'react';
import { getBusiness, updateBusiness } from '../../lib/api';
import { Save, Loader2, Globe, MessageSquare, Sliders } from 'lucide-react';

export default function SettingsPage() {
  const [business, setBusiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [businessId] = useState('65f1a2b3c4d5e6f7a8b9c0d1'); // Valid ObjectId

  useEffect(() => {
    const fetchBusiness = async () => {
      try {
        const data = await getBusiness(businessId);
        setBusiness(data);
      } catch (error) {
        console.error("Failed to fetch business settings", error);
        // Fallback for demo
        setBusiness({
            google_review_url: 'https://g.page/r/fake/review',
            message_templates: [
                { service_category: 'restaurant', template: "Hi {name}! Thanks for dining with us. Review us here: {review_url}" },
                { service_category: 'service', template: "Hi {name}! Thanks for choosing us. Please review: {review_url}" }
            ]
        });
      } finally {
        setLoading(false);
      }
    };

    fetchBusiness();
  }, [businessId]);

  const handleTemplateChange = (index: number, value: string) => {
    const newTemplates = [...business.message_templates];
    newTemplates[index].template = value;
    setBusiness({ ...business, message_templates: newTemplates });
  };

  const handleUrlChange = (value: string) => {
      setBusiness({ ...business, google_review_url: value });
  }

  const handleSave = async () => {
      setSaving(true);
      try {
          await updateBusiness(businessId, {
              google_review_url: business.google_review_url,
              message_templates: business.message_templates
          });
          alert('Configuration updated.');
      } catch (error) {
          console.error("Failed to save settings", error);
          alert('Failed to update configuration.');
      } finally {
          setSaving(false);
      }
  }

  if (loading) {
    return (
        <div className="flex h-[50vh] items-center justify-center">
            <Loader2 className="animate-spin text-neutral-500" size={32} />
        </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-800 pb-6">
        <div>
            <h1 className="text-2xl font-semibold text-white tracking-tight">Configuration</h1>
            <p className="text-neutral-500 mt-1 text-sm">System parameters and templates.</p>
        </div>
        <button 
            onClick={handleSave}
            disabled={saving}
            className="flex items-center justify-center gap-2 bg-white text-black px-6 py-2 rounded hover:bg-neutral-200 transition-all disabled:opacity-70 w-full md:w-auto font-bold text-sm uppercase tracking-wider"
        >
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            <span>{saving ? 'Saving...' : 'Save Changes'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Google Review URL Card */}
        <div className="bg-neutral-900 rounded border border-neutral-800 overflow-hidden">
            <div className="p-6 border-b border-neutral-800 flex items-center gap-3">
                <div className="p-2 bg-neutral-800 text-white rounded">
                    <Globe size={20} />
                </div>
                <h2 className="text-lg font-medium text-white">Target URL</h2>
            </div>
            <div className="p-6">
                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Review Endpoint</label>
                <input 
                    type="text" 
                    value={business?.google_review_url || ''}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    className="block w-full rounded bg-neutral-950 border border-neutral-800 p-3 text-white placeholder-neutral-600 focus:border-white focus:ring-1 focus:ring-white transition-all outline-none font-mono text-sm"
                    placeholder="https://g.page/r/..."
                />
            </div>
        </div>

        {/* Message Templates Card */}
        <div className="bg-neutral-900 rounded border border-neutral-800 overflow-hidden">
            <div className="p-6 border-b border-neutral-800 flex items-center gap-3">
                <div className="p-2 bg-neutral-800 text-white rounded">
                    <MessageSquare size={20} />
                </div>
                <h2 className="text-lg font-medium text-white">Message Templates</h2>
            </div>
            <div className="p-6 space-y-8">
                {business?.message_templates?.map((template: any, index: number) => (
                    <div key={index} className="space-y-2">
                         <div className="flex items-center justify-between">
                            <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider">{template.service_category} Template</label>
                            <span className="text-[10px] font-mono text-neutral-500 bg-neutral-800 px-2 py-0.5 rounded border border-neutral-700 uppercase">
                                ID: {template.service_category}
                            </span>
                         </div>
                        <textarea
                            value={template.template}
                            onChange={(e) => handleTemplateChange(index, e.target.value)}
                            rows={3}
                            className="block w-full rounded bg-neutral-950 border border-neutral-800 p-3 text-white placeholder-neutral-600 focus:border-white focus:ring-1 focus:ring-white transition-all outline-none font-mono text-sm"
                        />
                        <p className="text-xs text-neutral-600 font-mono">Vars: {'{name}'}, {'{review_url}'}</p>
                    </div>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
}
