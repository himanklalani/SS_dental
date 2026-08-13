'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getTemplates, createTemplate, deleteTemplate, syncTemplates } from '../../lib/api';
import { RefreshCw, Plus, Trash2, CheckCircle, Clock, XCircle, AlertTriangle, FileText, X, ChevronDown, Image as ImageIcon, Video, File as FileIcon, Type, Link as LinkIcon, Phone } from 'lucide-react';

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
        header:    { type: 'NONE', text: '' },
        body_text: '',
        footer_text: '',
        buttons:   [] as any[]
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
            const payload = {
                name: form.name,
                category: form.category,
                language: form.language,
                header: form.header,
                body_text: form.body_text,
                footer_text: form.footer_text,
                buttons: form.buttons
            };
            const created = await createTemplate(payload);
            setTemplates(prev => [created, ...prev]);
            setShowModal(false);
            setForm({ name: '', category: 'UTILITY', language: 'en', header: { type: 'NONE', text: '' }, body_text: '', footer_text: '', buttons: [] });
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

    const handleAddButton = () => {
        if (form.buttons.length >= 10) return showToast('Maximum 10 buttons allowed', 'error');
        setForm(f => ({ ...f, buttons: [...f.buttons, { type: 'QUICK_REPLY', text: '' }] }));
    };

    const updateButton = (index: number, field: string, value: string) => {
        const newButtons = [...form.buttons];
        newButtons[index] = { ...newButtons[index], [field]: value };
        setForm(f => ({ ...f, buttons: newButtons }));
    };

    const removeButton = (index: number) => {
        const newButtons = [...form.buttons];
        newButtons.splice(index, 1);
        setForm(f => ({ ...f, buttons: newButtons }));
    };

    const filtered = filterStatus ? templates.filter(t => t.status === filterStatus) : templates;
    const counts = templates.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {} as Record<string, number>);
    const varCount = countVariables(form.body_text);

    return (
        <div className="p-4 md:p-8 max-w-6xl mx-auto">
            {toast && (
                <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300 ${toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-neutral-900 dark:bg-white text-white dark:text-black'}`}>
                    {toast.type === 'error' ? <XCircle size={16} /> : <CheckCircle size={16} />}
                    {toast.msg}
                </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900 dark:text-white tracking-tight">Template Manager</h1>
                    <p className="text-neutral-500 text-sm mt-1">Create, track, and manage your WhatsApp message templates</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleSync} disabled={syncing} className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50 uppercase tracking-wider">
                        <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
                        {syncing ? 'Syncing...' : 'Sync from Meta'}
                    </button>
                    <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-neutral-900 dark:bg-white text-white dark:text-black px-4 py-2 rounded font-bold text-xs uppercase tracking-wider hover:bg-neutral-700 dark:hover:bg-neutral-200 transition-colors">
                        <Plus size={14} /> New Template
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {[ { status: 'APPROVED', label: 'Approved' }, { status: 'PENDING',  label: 'Pending' }, { status: 'REJECTED', label: 'Rejected' }, { status: 'all',      label: 'Total' } ].map(({ status, label }) => {
                    const cfg = STATUS_CONFIG[status];
                    const count = status === 'all' ? templates.length : (counts[status] || 0);
                    return (
                        <button key={status} onClick={() => setFilterStatus(status === 'all' ? '' : (filterStatus === status ? '' : status))} className={`text-left p-4 rounded-lg border transition-all ${filterStatus === status ? 'border-neutral-900 dark:border-white shadow-sm' : 'border-neutral-200 dark:border-neutral-800'} bg-white dark:bg-neutral-900 hover:shadow-md`}>
                            <div className="text-2xl font-bold text-neutral-900 dark:text-white">{count}</div>
                            <div className={`text-xs font-semibold mt-1 flex items-center gap-1 ${status === 'all' ? 'text-neutral-500' : cfg?.color.split(' ')[0]}`}>{cfg?.icon}{label}</div>
                        </button>
                    );
                })}
            </div>

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
                                    const headerComp = t.components?.find((c: any) => c.type === 'HEADER');
                                    const bodyComp = t.components?.find((c: any) => c.type === 'BODY');
                                    const footerComp = t.components?.find((c: any) => c.type === 'FOOTER');
                                    const buttonsComp = t.components?.find((c: any) => c.type === 'BUTTONS');

                                    return (
                                        <React.Fragment key={t._id}>
                                            <tr className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="font-mono font-semibold text-neutral-900 dark:text-white text-sm">{t.name}</div>
                                                    {t.rejected_reason && t.rejected_reason !== 'NONE' && (
                                                        <div className="text-xs text-red-500 mt-0.5 flex items-center gap-1">
                                                            <AlertTriangle size={11} /> {t.rejected_reason}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4"><span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border ${cc}`}>{t.category}</span></td>
                                                <td className="px-6 py-4 text-neutral-500 dark:text-neutral-400 text-xs font-mono uppercase">{t.language}</td>
                                                <td className="px-6 py-4"><span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${sc.color}`}>{sc.icon}{sc.label}</span></td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button onClick={() => setExpandedId(isExpanded ? null : t._id)} className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors" title="Preview">
                                                            <ChevronDown size={15} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                                        </button>
                                                        <button onClick={() => handleDelete(t._id, t.name)} disabled={deleting === t._id} className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50" title="Delete template">
                                                            {deleting === t._id ? <RefreshCw size={15} className="animate-spin" /> : <Trash2 size={15} />}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                            {isExpanded && (
                                                <tr className="bg-neutral-50 dark:bg-neutral-950">
                                                    <td colSpan={5} className="px-6 py-6">
                                                        <div className="max-w-md mx-auto">
                                                            <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3 text-center">Message Preview</p>
                                                            <div className="bg-[#efeae2] dark:bg-neutral-800 rounded-lg p-4 shadow-inner relative overflow-hidden">
                                                                <div className="bg-[#d9fdd3] dark:bg-[#005c4b] rounded-xl overflow-hidden shadow-sm flex flex-col">
                                                                    {headerComp && headerComp.format === 'IMAGE' && <div className="h-32 bg-neutral-300 dark:bg-neutral-700 flex items-center justify-center text-neutral-500"><ImageIcon size={32} /></div>}
                                                                    {headerComp && headerComp.format === 'VIDEO' && <div className="h-32 bg-neutral-300 dark:bg-neutral-700 flex items-center justify-center text-neutral-500"><Video size={32} /></div>}
                                                                    {headerComp && headerComp.format === 'DOCUMENT' && <div className="h-20 bg-neutral-300 dark:bg-neutral-700 flex items-center justify-center text-neutral-500"><FileIcon size={32} /></div>}
                                                                    
                                                                    <div className="p-3">
                                                                        {headerComp && headerComp.format === 'TEXT' && <p className="font-bold text-neutral-900 dark:text-white mb-1">{headerComp.text}</p>}
                                                                        {bodyComp && <p className="text-sm text-neutral-900 dark:text-white whitespace-pre-wrap leading-relaxed">{bodyComp.text}</p>}
                                                                        {footerComp && <p className="text-[11px] text-neutral-500 dark:text-neutral-300 mt-2">{footerComp.text}</p>}
                                                                    </div>
                                                                </div>
                                                                
                                                                {buttonsComp && buttonsComp.buttons && buttonsComp.buttons.length > 0 && (
                                                                    <div className="mt-2 space-y-1">
                                                                        {buttonsComp.buttons.map((btn: any, i: number) => (
                                                                            <div key={i} className="w-full bg-white dark:bg-neutral-900 py-2.5 rounded-lg shadow-sm text-center text-[#00a884] font-medium text-sm border border-neutral-200 dark:border-neutral-800 flex items-center justify-center gap-2">
                                                                                {btn.type === 'URL' && <LinkIcon size={14} />}
                                                                                {btn.type === 'PHONE_NUMBER' && <Phone size={14} />}
                                                                                {btn.text}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
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
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-2xl w-full max-w-2xl my-8">
                        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-100 dark:border-neutral-800 sticky top-0 bg-white dark:bg-neutral-900 z-10 rounded-t-xl">
                            <div>
                                <h2 className="font-bold text-neutral-900 dark:text-white">New Template</h2>
                                <p className="text-xs text-neutral-500 mt-0.5">Build a Meta-compliant template with media, body, and buttons.</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="text-neutral-400 hover:text-neutral-700 dark:hover:text-white transition-colors p-1"><X size={20} /></button>
                        </div>

                        <form onSubmit={handleCreate} className="p-6 space-y-6">
                            {/* Basics */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className={labelCls}>Template Name</label>
                                    <input type="text" className={inputCls} placeholder="e.g. seasonal_offer" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') }))} required />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className={labelCls}>Category</label>
                                        <select className={inputCls} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                                            <option value="UTILITY">Utility</option>
                                            <option value="MARKETING">Marketing</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelCls}>Language</label>
                                        <select className={inputCls} value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))}>
                                            <option value="en">English</option>
                                            <option value="hi">Hindi</option>
                                            <option value="gu">Gujarati</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Header */}
                            <div className="bg-neutral-50 dark:bg-neutral-950/50 p-4 rounded-lg border border-neutral-200 dark:border-neutral-800">
                                <label className={labelCls}>Header (Optional)</label>
                                <div className="flex gap-2 mb-3">
                                    {['NONE', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'].map(type => (
                                        <button key={type} type="button" onClick={() => setForm(f => ({ ...f, header: { type, text: '' } }))} className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${form.header.type === type ? 'bg-neutral-900 text-white dark:bg-white dark:text-black' : 'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300'}`}>
                                            {type === 'NONE' ? 'None' : type === 'TEXT' ? 'Text' : type.charAt(0) + type.slice(1).toLowerCase()}
                                        </button>
                                    ))}
                                </div>
                                {form.header.type === 'TEXT' && (
                                    <input type="text" className={inputCls} placeholder="Header text (max 60 chars)" value={form.header.text} maxLength={60} onChange={e => setForm(f => ({ ...f, header: { type: 'TEXT', text: e.target.value } }))} />
                                )}
                                {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(form.header.type) && (
                                    <p className="text-xs text-neutral-500">A media header will be added. You will attach the actual file when sending the message.</p>
                                )}
                            </div>

                            {/* Body */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className={labelCls} style={{ marginBottom: 0 }}>Body Text</label>
                                    {varCount > 0 && <span className="text-xs text-blue-500 font-medium">{varCount} variable{varCount > 1 ? 's' : ''} detected</span>}
                                </div>
                                <textarea className={`${inputCls} min-h-[120px] resize-y`} placeholder="Hello {{1}}, here is your code: {{2}}" value={form.body_text} onChange={e => setForm(f => ({ ...f, body_text: e.target.value }))} required maxLength={1024} />
                            </div>

                            {/* Footer */}
                            <div>
                                <label className={labelCls}>Footer (Optional)</label>
                                <input type="text" className={inputCls} placeholder="Short text at the bottom (max 60 chars)" value={form.footer_text} maxLength={60} onChange={e => setForm(f => ({ ...f, footer_text: e.target.value }))} />
                            </div>

                            {/* Buttons */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className={labelCls} style={{ marginBottom: 0 }}>Buttons (Optional)</label>
                                    <button type="button" onClick={handleAddButton} className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline flex items-center gap-1"><Plus size={12} /> Add Button</button>
                                </div>
                                {form.buttons.map((btn, i) => (
                                    <div key={i} className="flex gap-2 mb-2 items-start">
                                        <select className={`${inputCls} w-1/3`} value={btn.type} onChange={e => updateButton(i, 'type', e.target.value)}>
                                            <option value="QUICK_REPLY">Quick Reply</option>
                                            <option value="URL">Visit Website</option>
                                            <option value="PHONE_NUMBER">Call Phone</option>
                                        </select>
                                        <input type="text" className={`${inputCls} w-1/3`} placeholder="Button Text (e.g. Yes)" value={btn.text} maxLength={25} onChange={e => updateButton(i, 'text', e.target.value)} required />
                                        {btn.type === 'URL' && <input type="url" className={`${inputCls} w-1/3`} placeholder="https://..." value={btn.url || ''} onChange={e => updateButton(i, 'url', e.target.value)} required />}
                                        {btn.type === 'PHONE_NUMBER' && <input type="text" className={`${inputCls} w-1/3`} placeholder="+91..." value={btn.phone_number || ''} onChange={e => updateButton(i, 'phone_number', e.target.value)} required />}
                                        <button type="button" onClick={() => removeButton(i)} className="p-3 text-neutral-400 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                                    </div>
                                ))}
                            </div>

                            {/* Footer actions */}
                            <div className="flex justify-end gap-3 pt-4 border-t border-neutral-100 dark:border-neutral-800 sticky bottom-0 bg-white dark:bg-neutral-900 pb-2">
                                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2 border border-neutral-200 dark:border-neutral-700 rounded text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800">Cancel</button>
                                <button type="submit" disabled={submitting} className="px-6 py-2 bg-[#00a884] text-white rounded text-sm font-bold hover:bg-[#008f6f] disabled:opacity-50 flex items-center gap-2">
                                    {submitting ? <RefreshCw size={14} className="animate-spin" /> : null} Submit to Meta
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
