'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getPatients, createPatient, updatePatient, deletePatient } from '../../lib/api';
import { User, Plus, Search, Loader2, Phone, Mail, MapPin, Edit, Trash2, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 12;

// Shared input class for forms - works in both light and dark
const inputCls = "w-full bg-neutral-100 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 rounded p-3 text-neutral-900 dark:text-white focus:border-neutral-900 dark:focus:border-white outline-none transition-colors";
const labelCls = "block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5";

export default function PatientsPage() {
    const [patients, setPatients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [businessId] = useState(process.env.NEXT_PUBLIC_BUSINESS_ID || '69edf7401e9164e3fd73e073');
    const [submitting, setSubmitting] = useState(false);

    const [countryCode, setCountryCode] = useState('+91');
    const [formData, setFormData] = useState({
        name: '', phone: '', email: '', date_of_birth: '', gender: '',
        medical_history: '', business_id: businessId
    });

    const fetchPatients = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true); else setLoading(true);
        try {
            const data = await getPatients(businessId);
            setPatients(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [businessId]);

    useEffect(() => { fetchPatients(); }, [fetchPatients]);

    const handleOpenAdd = () => {
        setEditingId(null);
        setCountryCode('+91');
        setFormData({ name: '', phone: '', email: '', date_of_birth: '', gender: '', medical_history: '', business_id: businessId });
        setShowAddModal(true);
    };

    const handleOpenEdit = (patient: any) => {
        setEditingId(patient._id);
        
        let pPhone = patient.phone || '';
        let cCode = '+91';
        if (pPhone.startsWith('+91')) {
            cCode = '+91';
            pPhone = pPhone.slice(3);
        } else if (pPhone.startsWith('+1')) {
            cCode = '+1';
            pPhone = pPhone.slice(2);
        } else if (pPhone.startsWith('+')) {
            // generic fallback
            const match = pPhone.match(/^(\+\d{2,3})(\d+)$/);
            if (match) {
                cCode = match[1];
                pPhone = match[2];
            }
        }
        
        setCountryCode(cCode);

        setFormData({
            name: patient.name || '', phone: pPhone, email: patient.email || '',
            date_of_birth: patient.date_of_birth ? new Date(patient.date_of_birth).toISOString().split('T')[0] : '',
            gender: patient.gender || '',
            medical_history: Array.isArray(patient.medical_history) ? patient.medical_history.join(', ') : '',
            business_id: businessId
        });
        setShowAddModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting) return;
        setSubmitting(true);
        try {
            const historyArray = formData.medical_history.split(',').map(s => s.trim()).filter(Boolean);
            const payload = { ...formData, medical_history: historyArray, phone: countryCode + formData.phone };
            if (editingId) { await updatePatient(editingId, payload); }
            else { await createPatient(payload); }
            setShowAddModal(false);
            fetchPatients();
        } catch (error: any) {
            console.error(error);
            alert(error.response?.data?.error || error.response?.data?.message || `Failed to ${editingId ? 'update' : 'create'} patient`);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this patient?')) return;
        try {
            await deletePatient(id);
            fetchPatients();
        } catch (error) {
            console.error(error);
            alert('Failed to delete patient');
        }
    };

    const filteredPatients = patients.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.phone.includes(searchTerm)
    );

    const totalPages = Math.max(1, Math.ceil(filteredPatients.length / PAGE_SIZE));
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const paginatedPatients = filteredPatients.slice((safeCurrentPage - 1) * PAGE_SIZE, safeCurrentPage * PAGE_SIZE);

    if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-neutral-500" /></div>;

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-6">
                <div>
                    <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white tracking-tight">Patients</h1>
                    <p className="text-neutral-500 mt-1 text-sm">{patients.length} total patients · Manage patient records and history.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => fetchPatients(true)} disabled={refreshing}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-white bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded hover:border-neutral-400 dark:hover:border-neutral-600 transition-all disabled:opacity-50">
                        <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                    <button onClick={handleOpenAdd} className="flex items-center gap-2 bg-neutral-900 dark:bg-white text-white dark:text-black px-4 py-2 rounded font-bold text-sm uppercase tracking-wider hover:bg-neutral-700 dark:hover:bg-neutral-200 transition-colors">
                        <Plus size={16} />
                        <span>Add Patient</span>
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-3 text-neutral-400" size={18} />
                <input
                    type="text"
                    placeholder="Search patients by name or phone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded pl-10 p-3 text-neutral-900 dark:text-white focus:border-neutral-900 dark:focus:border-white outline-none font-mono text-sm"
                />
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {paginatedPatients.map(patient => (
                    <div key={patient._id} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded p-4 hover:border-neutral-300 dark:hover:border-neutral-700 transition-all group relative">
                        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleOpenEdit(patient)} className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors">
                                <Edit size={16} />
                            </button>
                            <button onClick={() => handleDelete(patient._id)} className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded text-red-400 hover:text-red-500 transition-colors">
                                <Trash2 size={16} />
                            </button>
                        </div>
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-900 dark:text-white font-bold text-lg">
                                {patient.name.charAt(0).toUpperCase()}
                            </div>
                            <span className={`px-2 py-1 rounded text-[10px] font-mono uppercase border ${
                                patient.status === 'Active' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 border-emerald-500/20' :
                                'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 border-neutral-200 dark:border-neutral-700'
                            }`}>
                                {patient.status || 'New'}
                            </span>
                        </div>
                        <h3 className="text-lg font-medium text-neutral-900 dark:text-white mb-1 capitalize">{patient.name}</h3>
                        <div className="space-y-2 text-sm text-neutral-500 mt-4">
                            <div className="flex items-center gap-2">
                                <Phone size={14} />
                                <span className="font-mono">{patient.phone}</span>
                            </div>
                            {patient.email && (
                                <div className="flex items-center gap-2">
                                    <Mail size={14} />
                                    <span>{patient.email}</span>
                                </div>
                            )}
                            {patient.address?.city && (
                                <div className="flex items-center gap-2">
                                    <MapPin size={14} />
                                    <span>{patient.address.city}</span>
                                </div>
                            )}
                        </div>
                        {patient.tags?.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800 flex gap-2 flex-wrap">
                                {patient.tags.map((tag: string, i: number) => (
                                    <span key={i} className="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 rounded text-xs text-neutral-500">#{tag}</span>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
                {filteredPatients.length === 0 && (
                    <div className="col-span-3 p-12 text-center text-neutral-400">
                        <User size={48} className="mx-auto mb-4 opacity-20" />
                        <p>No patients found.</p>
                    </div>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-neutral-200 dark:border-neutral-800">
                    <p className="text-xs text-neutral-400 font-mono">Page {safeCurrentPage} of {totalPages} &middot; {filteredPatients.length} patients</p>
                    <div className="flex items-center gap-1">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={safeCurrentPage === 1}
                            className="p-2 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white disabled:opacity-30 transition-colors">
                            <ChevronLeft size={16} />
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                            <button key={p} onClick={() => setCurrentPage(p)}
                                className={`w-8 h-8 text-xs rounded font-medium transition-colors ${
                                    p === safeCurrentPage
                                        ? 'bg-neutral-900 dark:bg-white text-white dark:text-black'
                                        : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500'
                                }`}>{p}</button>
                        ))}
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={safeCurrentPage === totalPages}
                            className="p-2 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white disabled:opacity-30 transition-colors">
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="p-6 sticky top-0 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center z-10">
                            <h2 className="text-xl font-bold text-neutral-900 dark:text-white">{editingId ? 'Edit Patient' : 'Add New Patient'}</h2>
                            <button onClick={() => setShowAddModal(false)} className="text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors">
                                <Plus className="rotate-45" size={24} />
                            </button>
                        </div>
                        <div className="p-6">
                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div>
                                    <label className={labelCls}>Full Name</label>
                                    <input required type="text" className={inputCls} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelCls}>Phone</label>
                                        <p className="text-[10px] text-neutral-400 mb-1 -mt-1">Edit the box to change country code.</p>
                                        <div className="flex gap-2">
                                            <input type="text" className={`${inputCls.replace('w-full', 'w-20')} px-2 text-center shrink-0`} value={countryCode} onChange={e => setCountryCode(e.target.value)} />
                                            <input required type="tel" className={`${inputCls} flex-1`} value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="Enter phone number" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className={labelCls}>Email</label>
                                        <input type="email" className={inputCls} value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelCls}>DOB</label>
                                        <input type="date" className={inputCls} value={formData.date_of_birth} onChange={e => setFormData({...formData, date_of_birth: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Gender</label>
                                        <select className={inputCls} value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})}>
                                            <option value="">Select</option>
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className={labelCls}>Medical History (comma separated)</label>
                                    <textarea className={inputCls} rows={3} value={formData.medical_history} onChange={e => setFormData({...formData, medical_history: e.target.value})} />
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button type="button" disabled={submitting} onClick={() => setShowAddModal(false)} className="flex-1 py-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white rounded font-medium hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50">Cancel</button>
                                    <button type="submit" disabled={submitting} className="flex-1 py-3 flex justify-center items-center gap-2 bg-neutral-900 dark:bg-white text-white dark:text-black rounded font-bold hover:bg-neutral-700 dark:hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                                        {submitting ? 'Saving...' : (editingId ? 'Update Patient' : 'Create Patient')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
