'use client';

import React, { useEffect, useState } from 'react';
import { getBusiness, updateBusiness } from '../../lib/api';
import { Save, Loader2, Globe, CalendarOff, Plus, Trash2 } from 'lucide-react';

const inputCls = "block w-full rounded bg-neutral-100 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 p-3 text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 focus:border-neutral-900 dark:focus:border-white focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white transition-all outline-none font-mono text-sm";
const labelCls = "block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2";

export default function SettingsPage() {
  const [business, setBusiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [businessId] = useState(process.env.NEXT_PUBLIC_BUSINESS_ID || '69edf7401e9164e3fd73e073');

  const [newHoliday, setNewHoliday] = useState('');
  const [newBlockedDate, setNewBlockedDate] = useState('');
  const [newBlockedShifts, setNewBlockedShifts] = useState<string[]>([]);

  useEffect(() => {
    const fetchBusiness = async () => {
      try {
        const data = await getBusiness(businessId);
        if (!data.holidays) data.holidays = [];
        if (!data.blocked_shifts) data.blocked_shifts = [];
        setBusiness(data);
      } catch {
        setBusiness({
          google_review_url: 'https://g.page/r/fake/review',
          message_templates: [
            { service_category: 'dentist', template: "Hi {name}! Thanks for visiting us. Review us here: {review_url}" },
          ],
          holidays: [],
          blocked_shifts: []
        });
      } finally { setLoading(false); }
    };
    fetchBusiness();
  }, [businessId]);

  const handleSave = async (overrides?: { holidays?: any[], blocked_shifts?: any[] }) => {
    setSaving(true);
    const newHolidays = overrides?.holidays !== undefined ? overrides.holidays : business.holidays;
    const newBlockedShifts = overrides?.blocked_shifts !== undefined ? overrides.blocked_shifts : business.blocked_shifts;
    try {
      await updateBusiness(businessId, { 
        google_review_url: business.google_review_url, 
        message_templates: business.message_templates,
        holidays: newHolidays,
        blocked_shifts: newBlockedShifts
      });
      alert('Configuration updated.');
    } catch { alert('Failed to update configuration.'); }
    finally { setSaving(false); }
  };

  const addHoliday = () => {
    if (!newHoliday) return;
    const updated = [...business.holidays, newHoliday];
    setBusiness({ ...business, holidays: updated });
    setNewHoliday('');
    handleSave({ holidays: updated });
  };

  const removeHoliday = (index: number) => {
    const arr = [...business.holidays];
    arr.splice(index, 1);
    setBusiness({ ...business, holidays: arr });
    handleSave({ holidays: arr });
  };

  const addBlockedShift = () => {
    if (!newBlockedDate || newBlockedShifts.length === 0) return;
    const updated = [...business.blocked_shifts, { date: newBlockedDate, shifts: newBlockedShifts }];
    setBusiness({ 
        ...business, 
        blocked_shifts: updated 
    });
    setNewBlockedDate('');
    setNewBlockedShifts([]);
    handleSave({ blocked_shifts: updated });
  };

  const removeBlockedShift = (index: number) => {
    const arr = [...business.blocked_shifts];
    arr.splice(index, 1);
    setBusiness({ ...business, blocked_shifts: arr });
    handleSave({ blocked_shifts: arr });
  };

  const toggleShift = (shift: string) => {
    if (newBlockedShifts.includes(shift)) {
        setNewBlockedShifts(newBlockedShifts.filter(s => s !== shift));
    } else {
        setNewBlockedShifts([...newBlockedShifts, shift]);
    }
  };

  if (loading) return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="animate-spin text-neutral-400" size={32} /></div>;

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-6">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white tracking-tight">Configuration</h1>
          <p className="text-neutral-500 mt-1 text-sm">System parameters and schedule overrides.</p>
        </div>
        <button onClick={() => handleSave()} disabled={saving}
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

        {/* Schedule Overrides */}
        <div className="bg-white dark:bg-neutral-900 rounded border border-neutral-200 dark:border-neutral-800 overflow-hidden">
          <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-3">
            <div className="p-2 bg-neutral-100 dark:bg-neutral-800 text-rose-500 dark:text-rose-400 rounded">
              <CalendarOff size={20} />
            </div>
            <div>
                <h2 className="text-lg font-medium text-neutral-900 dark:text-white">Schedule Overrides</h2>
                <p className="text-xs text-neutral-500 mt-1 font-mono">Block full days or specific shifts.</p>
            </div>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Full Day Holidays */}
            <div>
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white uppercase tracking-wider mb-4 border-b border-neutral-200 dark:border-neutral-800 pb-2">Full Day Holidays</h3>
                <div className="flex gap-2 mb-4">
                    <input type="date" value={newHoliday} onChange={(e) => setNewHoliday(e.target.value)} className={inputCls} />
                    <button onClick={addHoliday} disabled={saving} className="bg-neutral-900 dark:bg-white text-white dark:text-black px-4 rounded hover:bg-neutral-700 dark:hover:bg-neutral-200 flex items-center justify-center disabled:opacity-50">
                        <Plus size={16} /> Add
                    </button>
                </div>
                <div className="space-y-2">
                    {business?.holidays?.length === 0 && <p className="text-xs text-neutral-500 italic">No holidays configured.</p>}
                    {business?.holidays?.map((h: any, idx: number) => {
                        const dateStr = typeof h === 'string' ? h.split('T')[0] : new Date(h).toISOString().split('T')[0];
                        return (
                        <div key={idx} className="flex justify-between items-center bg-neutral-50 dark:bg-neutral-800/50 p-2 rounded border border-neutral-200 dark:border-neutral-800">
                            <span className="text-sm font-mono text-neutral-900 dark:text-white">{dateStr}</span>
                            <button onClick={() => removeHoliday(idx)} disabled={saving} className="text-xs font-bold uppercase tracking-wider text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1 rounded transition-colors disabled:opacity-50 flex items-center gap-1">
                                <Trash2 size={12} /> Remove
                            </button>
                        </div>
                    )})}
                </div>
            </div>

            {/* Blocked Shifts */}
            <div>
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white uppercase tracking-wider mb-4 border-b border-neutral-200 dark:border-neutral-800 pb-2">Blocked Shifts</h3>
                <div className="space-y-3 mb-4">
                    <input type="date" value={newBlockedDate} onChange={(e) => setNewBlockedDate(e.target.value)} className={inputCls} />
                    <div className="flex gap-2">
                        {['Morning', 'Afternoon', 'Evening'].map(shift => (
                            <button key={shift} onClick={() => toggleShift(shift)}
                                className={`flex-1 py-2 text-xs font-bold uppercase rounded border transition-all ${newBlockedShifts.includes(shift) ? 'bg-neutral-900 text-white dark:bg-white dark:text-black border-transparent' : 'bg-transparent text-neutral-500 border-neutral-300 dark:border-neutral-700 hover:border-neutral-900 dark:hover:border-white'}`}>
                                {shift}
                            </button>
                        ))}
                    </div>
                    <button onClick={addBlockedShift} disabled={!newBlockedDate || newBlockedShifts.length === 0 || saving} className="w-full bg-neutral-900 dark:bg-white text-white dark:text-black py-2 rounded hover:bg-neutral-700 dark:hover:bg-neutral-200 flex items-center justify-center gap-2 disabled:opacity-50 text-xs font-bold uppercase tracking-wider">
                        <Plus size={14} /> Add Block
                    </button>
                </div>
                <div className="space-y-2">
                    {business?.blocked_shifts?.length === 0 && <p className="text-xs text-neutral-500 italic">No blocked shifts configured.</p>}
                    {business?.blocked_shifts?.map((b: any, idx: number) => {
                        const dateStr = typeof b.date === 'string' ? b.date.split('T')[0] : new Date(b.date).toISOString().split('T')[0];
                        return (
                        <div key={idx} className="flex justify-between items-center bg-neutral-50 dark:bg-neutral-800/50 p-2 rounded border border-neutral-200 dark:border-neutral-800">
                            <div>
                                <div className="text-sm font-mono text-neutral-900 dark:text-white">{dateStr}</div>
                                <div className="text-xs text-rose-500 font-medium">{b.shifts.join(', ')}</div>
                            </div>
                            <button onClick={() => removeBlockedShift(idx)} disabled={saving} className="text-xs font-bold uppercase tracking-wider text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1 rounded transition-colors disabled:opacity-50 flex items-center gap-1">
                                <Trash2 size={12} /> Remove
                            </button>
                        </div>
                    )})}
                </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
