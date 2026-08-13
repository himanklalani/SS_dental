'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getTemplates, createTemplate, deleteTemplate, syncTemplates } from '../../lib/api';
import { RefreshCw, Plus, Trash2, CheckCircle, Clock, XCircle, AlertTriangle, FileText, X, ChevronDown } from 'lucide-react';

const inputCls = "w-full bg-neutral-100 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 rounded p-3 text-neutral-900 dark:text-white focus:border-neutral-900 dark:focus:border-white outline-none transition-colors text-sm";
const labelCls = "block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    APPROVED:  { label: 'Approved',  color: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-900/20 dark:border-emerald-800', icon: <CheckCircle size={12} /> },
    PENDING:   { label: 'Pending',   color: 'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-900/20 dark:border-amber-800',              icon: <Clock size={12} /> },
    REJECTED:  { label: 'Rejected',  color: 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800',                         icon: <XCircle size={12} /> },
    PAUSED:    { label: 'Paused',    color: 'text-neutral-500 bg-neutral-100 border-neutral-200 dark:text-neutral-400 dark:bg-neutral-800 dark:border-neutral-700',    icon: <AlertTriangle size={12} /> },
    DISABLED:  { label: 'Disabled',  color: 'text-neutral-500 bg-neutral-100 border-neutral-200 dark:text-neutral-400 dark:bg-neutral-800 dark:border-neutral-700',   icon: <AlertTriangle size={12} /> },
};

const CATEGORY_CONFIG: Record<string, string> = {
    UTILITY:    'text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-900/20 dark:border-blue-800',
    MARKETING:  'text-purple-600 bg-purple-50 border-purple-200 dark:text-purple-400 dark:bg-purple-900/20 dark:border-purple-800',
    AUTHENTICATION: 'text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-900/20 dark:border-orange-800',
};

// Count {{n}} placeholders in body text
const countVariables = (text: string) => {
    const matches = text.match(/\{\{\d+\}\}/g);
    return matches ? [...new Set(matches)].length : 0;
};

export default function TemplatesPage() {
    const [templates, setTemplates]         = useState<any[]>([]);
    const [loading, setLoading]             = useState(true);
    const [syncing, setSyncing]             = useState(false);
    const [deleting, setDeleting]           = useState<string | null>(null);
    const [showModal, setShowModal]         = useState(false);
    const [submitting, setSubmitting]       = useState(false);
    const [toast, setToast]                 = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const [filterStatus, setFilterStatus]   = useState('');
    const [expandedId, setExpandedId]       = useState<string | null>(null);

    const [form, setForm] = useState({
        name:      '',
        category:  'UTILITY',
        language:  'en',
        body_text: ''
    });

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    const fetchTemplates = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getTemplates();
            setTemplates(data);
        } catch {
            showToast('Failed to load templates', 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

    const handleSync = async () => {
        setSyncing(true);
        try {
            const result = await syncTemplates();
            setTemplates(result.templates);
            showToast(`Synced ${result.synced} templates from Meta`);
        } catch (e: any) {
            showToast(e?.response?.data?.error || 'Sync failed. Check META_WABA_ID env variable.', 'error');
        } finally {
            setSyncing(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim() || !form.body_text.trim()) {
            showToast('Template name and body text are required', 'error');
            return;
        }
        setSubmitting(true);
        try {
            const created = await createTemplate(form);
            setTemplates(prev => [created, ...prev]);
            setShowModal(false);
            setForm({ name: '', category: 'UTILITY', language: 'en', body_text: '' });
            showToast('Template submitted to Meta for approval!');
        } catch (e: any) {
            showToast(e?.response?.data?.error || 'Failed to create template', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Delete template "${name}"? This will also remove it from Meta.`)) return;
        setDeleting(id);
        try {
            await deleteTemplate(id);
            setTemplates(prev => prev.filter(t => t._id !== id));
            showToast('Template deleted');
        } catch {
            showToast('Failed to delete template', 'error');
        } finally {
            setDeleting(null);
        }
    };

    const filtered = filterStatus ? templates.filter(t => t.status === filterStatus) : templates;
    const counts = templates.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {} as Record<string, number>);
    const varCount = countVariables(form.body_text);

    return (
        <div className="p-4 md:p-8 max-w-6xl mx-auto">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300 ${toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-neutral-900 dark:bg-white text-white dark:text-black'}`}>
                    {toast.type === 'error' ? <XCircle size={16} /> : <CheckCircle size={16} />}
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900 dark:text-white tracking-tight">Template Manager</h1>
                    <p className="text-neutral-500 text-sm mt-1">Create, track, and manage your WhatsApp message templates</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50 uppercase tracking-wider"
                    >
                        <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
                        {syncing ? 'Syncing...' : 'Sync from Meta'}
                    </button>
                    <button
                        onClick={() => setShowModal(true)}
                        className="flex items-center gap-2 bg-neutral-900 dark:bg-white text-white dark:text-black px-4 py-2 rounded font-bold text-xs uppercase tracking-wider hover:bg-neutral-700 dark:hover:bg-neutral-200 transition-colors"
                    >
                        <Plus size={14} /> New Template
                    </button>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {[
                    { status: 'APPROVED', label: 'Approved' },
                    { status: 'PENDING',  label: 'Pending' },
                    { status: 'REJECTED', label: 'Rejected' },
                    { status: 'all',      label: 'Total' },
                ].map(({ status, label }) => {
                    const cfg = STATUS_CONFIG[status];
                    const count = status === 'all' ? templates.length : (counts[status] || 0);
                    return (
                        <button
                            key={status}
                            onClick={() => setFilterStatus(status === 'all' ? '' : (filterStatus === status ? '' : status))}
                            className={`text-left p-4 rounded-lg border transition-all ${filterStatus === status ? 'border-neutral-900 dark:border-white shadow-sm' : 'border-neutral-200 dark:border-neutral-800'} bg-white dark:bg-neutral-900 hover:shadow-md`}
                        >
                            <div className="text-2xl font-bold text-neutral-900 dark:text-white">{count}</div>
                            <div className={`text-xs font-semibold mt-1 flex items-center gap-1 ${status === 'all' ? 'text-neutral-500' : cfg?.color.split(' ')[0]}`}>
                                {cfg?.icon}{label}
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center p-16">
                        <div className="animate-spin h-8 w-8 border-2 border-neutral-900 dark:border-white rounded-full border-t-transparent" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-16 text-center">
                        <FileText size={40} className="text-neutral-300 dark:text-neutral-600 mb-3" />
                        <p className="font-semibold text-neutral-700 dark:text-neutral-300">No templates found</p>
                        <p className="text-sm text-neutral-400 mt-1">Click "Sync from Meta" to import existing templates, or create a new one.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-neutral-50 dark:bg-neutral-950 text-neutral-500 uppercase font-mono text-xs border-b border-neutral-200 dark:border-neutral-800">
                                <tr>
                                    <th className="px-6 py-4 font-medium">Template Name</th>
                                    <th className="px-6 py-4 font-medium">Category</th>
                                    <th className="px-6 py-4 font-medium">Language</th>
                                    <th className="px-6 py-4 font-medium">Status</th>
                                    <th className="px-6 py-4 font-medium text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                                {filtered.map(t => {
                                    const sc = STATUS_CONFIG[t.status] || STATUS_CONFIG['PENDING'];
                                    const cc = CATEGORY_CONFIG[t.category] || CATEGORY_CONFIG['UTILITY'];
                                    const isExpanded = expandedId === t._id;
                                    const bodyComp = t.components?.find((c: any) => c.type === 'BODY');

                                    return (
                                        <React.Fragment key={t._id}>
                                            <tr className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="font-mono font-semibold text-neutral-900 dark:text-white text-sm">{t.name}</div>
                                                    {t.rejected_reason && (
                                                        <div className="text-xs text-red-500 mt-0.5 flex items-center gap-1">
                                                            <AlertTriangle size={11} /> {t.rejected_reason}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border ${cc}`}>
                                                        {t.category}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-neutral-500 dark:text-neutral-400 text-xs font-mono uppercase">{t.language}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${sc.color}`}>
                                                        {sc.icon}{sc.label}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {bodyComp && (
                                                            <button
                                                                onClick={() => setExpandedId(isExpanded ? null : t._id)}
                                                                className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
                                                                title="Preview"
                                                            >
                                                                <ChevronDown size={15} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleDelete(t._id, t.name)}
                                                            disabled={deleting === t._id}
                                                            className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                                                            title="Delete template"
                                                        >
                                                            {deleting === t._id ? <RefreshCw size={15} className="animate-spin" /> : <Trash2 size={15} />}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                            {isExpanded && bodyComp && (
                                                <tr className="bg-neutral-50 dark:bg-neutral-950">
                                                    <td colSpan={5} className="px-6 py-4">
                                                        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-4">
                                                            <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Message Preview</p>
                                                            <div className="bg-[#d9fdd3] dark:bg-[#1a3a1a] rounded-xl px-4 py-3 max-w-sm ml-auto shadow-sm">
                                                                <p className="text-sm text-neutral-800 dark:text-neutral-100 whitespace-pre-wrap leading-relaxed">{bodyComp.text}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-2xl w-full max-w-lg">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-100 dark:border-neutral-800">
                            <div>
                                <h2 className="font-bold text-neutral-900 dark:text-white">New Template</h2>
                                <p className="text-xs text-neutral-500 mt-0.5">This will be submitted to Meta for review (~1–2 min)</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="text-neutral-400 hover:text-neutral-700 dark:hover:text-white transition-colors p-1">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleCreate} className="p-6 space-y-5">
                            {/* Template Name */}
                            <div>
                                <label className={labelCls}>Template Name</label>
                                <input
                                    type="text"
                                    className={inputCls}
                                    placeholder="e.g. appointment_reminder"
                                    value={form.name}
                                    onChange={e => setForm(f => ({ ...f, name: e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') }))}
                                    required
                                />
                                <p className="text-xs text-neutral-400 mt-1">Only lowercase letters, numbers, and underscores. Spaces auto-converted.</p>
                            </div>

                            {/* Category + Language Row */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelCls}>Category</label>
                                    <select className={inputCls} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                                        <option value="UTILITY">Utility</option>
                                        <option value="MARKETING">Marketing</option>
                                    </select>
                                    {form.category === 'MARKETING' && (
                                        <p className="text-xs text-amber-500 mt-1 flex items-start gap-1">
                                            <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                                            Marketing templates cost more per conversation
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className={labelCls}>Language</label>
                                    <select className={inputCls} value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))}>
                                        <option value="en">English (en)</option>
                                        <option value="en_US">English US (en_US)</option>
                                        <option value="en_GB">English UK (en_GB)</option>
                                        <option value="hi">Hindi (hi)</option>
                                        <option value="gu">Gujarati (gu)</option>
                                    </select>
                                </div>
                            </div>

                            {/* Body Text */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className={labelCls} style={{ marginBottom: 0 }}>Body Text</label>
                                    {varCount > 0 && (
                                        <span className="text-xs text-blue-500 font-medium">{varCount} variable{varCount > 1 ? 's' : ''} detected</span>
                                    )}
                                </div>
                                <textarea
                                    className={`${inputCls} min-h-[120px] resize-y`}
                                    placeholder={"Hi {{1}}, your appointment for {{2}} is confirmed for {{3}}.\n\nUse {{1}}, {{2}}, etc. for dynamic variables."}
                                    value={form.body_text}
                                    onChange={e => setForm(f => ({ ...f, body_text: e.target.value }))}
                                    required
                                />
                                <p className="text-xs text-neutral-400 mt-1">Use {"{{1}}"}, {"{{2}}"} for variables. Keep it professional — Meta rejects spam-like content.</p>
                            </div>

                            {/* Live Preview */}
                            {form.body_text && (
                                <div>
                                    <label className={labelCls}>Preview</label>
                                    <div className="bg-[#efeae2] dark:bg-neutral-800 rounded-lg p-3">
                                        <div className="bg-[#d9fdd3] dark:bg-[#1a3a1a] rounded-xl px-4 py-3 max-w-[85%] ml-auto shadow-sm">
                                            <p className="text-sm text-neutral-800 dark:text-neutral-100 whitespace-pre-wrap leading-relaxed">{form.body_text}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Footer */}
                            <div className="flex items-center gap-3 pt-2">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-neutral-200 dark:border-neutral-700 rounded text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" disabled={submitting} className="flex-1 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-black rounded text-sm font-bold hover:bg-neutral-700 dark:hover:bg-neutral-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                                    {submitting ? <><RefreshCw size={14} className="animate-spin" />Submitting...</> : 'Submit to Meta'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
