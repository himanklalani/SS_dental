'use client';

import React, { useState, useEffect } from 'react';
import { getAppointments, createAppointment, getPatients, getDoctors, updateAppointment, deleteAppointment } from '../../lib/api';
import { Calendar, Clock, User, Plus, Search, Loader2, CheckCircle, XCircle, AlertCircle, FileText, Edit, ArrowRight, Trash2, Star, MessageSquare } from 'lucide-react';

export default function AppointmentsPage() {
    const [appointments, setAppointments] = useState<any[]>([]);
    const [patients, setPatients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingAppointment, setEditingAppointment] = useState<any>(null);
    const [filterStatus, setFilterStatus] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [businessId] = useState('65f1a2b3c4d5e6f7a8b9c0d1');

    // Follow-up Logic
    const [showCompletionModal, setShowCompletionModal] = useState(false);
    const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
    const [isFollowUpNeeded, setIsFollowUpNeeded] = useState(false);
    const [canSendReview, setCanSendReview] = useState(false);
    const [followUpData, setFollowUpData] = useState({ date: '', time: '', service: 'Consultation', notes: '' });

    const [newAppointment, setNewAppointment] = useState({
        patient_id: '',
        appointment_date: '',
        appointment_time: '',
        service_type: 'Consultation',
        preferred_slot: 'Morning',
        status: 'Booked',
        notes: '',
        business_id: businessId
    });

    useEffect(() => {
        const timer = setTimeout(() => { fetchData(); }, 300);
        return () => clearTimeout(timer);
    }, [businessId, page, filterStatus, searchQuery]);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [apptRes, patientData] = await Promise.all([
                getAppointments(businessId, { page, limit: 10, status: filterStatus, search: searchQuery }),
                getPatients(businessId)
            ]);
            setAppointments(apptRes.data || []);
            setTotalPages(apptRes.totalPages || 1);
            setPatients(patientData);
        } catch (err: any) {
            console.error("Dashboard Fetch Error:", err);
            setError(err.response?.data?.error || "Failed to load dashboard data. Check console for details.");
        } finally {
            setLoading(false);
        }
    };

    const handleOpenAdd = () => {
        setEditingAppointment(null);
        setNewAppointment({
            patient_id: '',
            appointment_date: '',
            appointment_time: '',
            service_type: 'Consultation',
            preferred_slot: 'Morning',
            status: 'Booked',
            notes: '',
            business_id: businessId
        });
        setShowAddModal(true);
    };

    const openEditModal = (appt: any) => {
        setEditingAppointment(appt);
        
        let initialTime = '';
        if (appt.appointment_date && new Date(appt.appointment_date).getFullYear() > 1970) {
           initialTime = new Date(appt.appointment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        }

        setNewAppointment({
            patient_id: appt.patient_id?._id || appt.patient_id || '',
            business_id: appt.business_id,
            appointment_date: appt.appointment_date ? new Date(appt.appointment_date).toISOString().split('T')[0] : '',
            appointment_time: initialTime,
            service_type: appt.service_type || 'Consultation',
            preferred_slot: appt.preferred_slot || 'Morning',
            status: appt.status || 'Booked',
            notes: appt.notes || ''
        });
        setShowAddModal(true);
    };

    const handleCreateOrUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const dateTime = new Date(`${newAppointment.appointment_date}T${newAppointment.appointment_time}`);
            const payload = { ...newAppointment, appointment_date: dateTime };
            
            if (editingAppointment) {
                await updateAppointment(editingAppointment._id, payload);
            } else {
                await createAppointment(payload);
            }
            
            setShowAddModal(false);
            setEditingAppointment(null);
            fetchData();
        } catch (error) {
            console.error(error);
            alert(`Failed to ${editingAppointment ? 'update' : 'create'} appointment`);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this appointment?')) return;
        try {
            await deleteAppointment(id);
            fetchData();
        } catch (error) {
            console.error(error);
            alert('Failed to delete appointment');
        }
    };

    const handleStatusChange = async (id: string, newStatus: string) => {
        try {
            if (newStatus === 'Completed') {
                const appt = appointments.find(a => a._id === id);
                if (appt) {
                    openCompletionModal(appt);
                }
                return;
            }

            await updateAppointment(id, { status: newStatus });
            fetchData();
        } catch (error) {
            console.error(error);
            alert('Failed to update status');
        }
    };

    const openCompletionModal = async (appt: any) => {
        setSelectedAppointment(appt);
        setIsFollowUpNeeded(false);
        setShowCompletionModal(true);
        
        // Check 9-month repeat patient rule
        try {
            const nineMonthsAgo = new Date();
            nineMonthsAgo.setMonth(nineMonthsAgo.getMonth() - 9);
            
            // Query previous completed appointments for this patient
            const prevAppts = await getAppointments(businessId, { 
                patient_id: appt.patient_id?._id || appt.patient_id, 
                status: 'Completed' 
            });
            
            const hasRecentVisit = prevAppts.some((a: any) => 
                a._id !== appt._id && new Date(a.appointment_date) >= nineMonthsAgo
            );
            
            setCanSendReview(!hasRecentVisit);
        } catch (err) {
            console.error("Error checking repeat patient rule:", err);
            setCanSendReview(true); // Fallback to showing button
        }
    };

    const handleCompleteFlow = async (messageType: 'none' | 'thank_you' | 'review' = 'none') => {
        try {
            // 1. Mark current as Completed with specific message trigger
            await updateAppointment(selectedAppointment._id, { 
                status: 'Completed',
                message_type: messageType 
            });

            // 2. Create Follow-up if needed
            if (isFollowUpNeeded && followUpData.date && followUpData.time) {
                const dateTime = new Date(`${followUpData.date}T${followUpData.time}`);
                await createAppointment({
                    patient_id: selectedAppointment.patient_id._id,
                    doctor_id: selectedAppointment.doctor_id._id,
                    business_id: selectedAppointment.business_id,
                    appointment_date: dateTime,
                    service_type: followUpData.service,
                    notes: `Follow-up for: ${selectedAppointment.service_type}. ${followUpData.notes}`
                });
            }

            setShowCompletionModal(false);
            fetchData();
        } catch (error) {
            console.error("Completion Flow Error:", error);
            alert("Failed to complete appointment flow.");
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Completed': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
            case 'Confirmed': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
            case 'Cancelled': return 'text-red-500 bg-red-500/10 border-red-500/20';
            default: return 'text-neutral-500 bg-neutral-800 border-neutral-700';
        }
    };

    const filteredAppointments = appointments.filter(a => 
        !filterStatus || a.status === filterStatus
    );

    if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-white" /></div>;

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Filters & Actions */}
             <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-neutral-800 pb-6">
                <div>
                    <h1 className="text-2xl font-semibold text-white tracking-tight">Appointments</h1>
                    <p className="text-neutral-500 mt-1 text-sm">Schedule and manage clinic visits.</p>
                </div>
                <div className="flex gap-2 items-center flex-wrap">
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                        <input 
                            type="text" 
                            placeholder="Search name or phone..." 
                            className="bg-neutral-900 border border-neutral-800 rounded pl-9 pr-3 py-2 text-white text-sm outline-none focus:border-white w-48"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <select 
                        className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-white text-sm outline-none focus:border-white"
                        onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                    >
                        <option value="">All Status</option>
                        <option value="Requested">Requested (Web)</option>
                        <option value="Booked">Booked</option>
                        <option value="Confirmed">Confirmed</option>
                        <option value="Completed">Completed</option>
                        <option value="Cancelled">Cancelled</option>
                    </select>
                    <button 
                        onClick={handleOpenAdd}
                        className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded font-bold text-sm uppercase tracking-wider hover:bg-neutral-200 transition-colors"
                    >
                        <Plus size={16} />
                        <span>New Booking</span>
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="bg-neutral-900 border border-neutral-800 rounded overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-neutral-950 text-neutral-500 uppercase font-mono text-xs">
                        <tr>
                            <th className="px-6 py-4 font-medium">Patient</th>
                            <th className="px-6 py-4 font-medium">Date & Time</th>
                            <th className="px-6 py-4 font-medium">Slot</th>
                            <th className="px-6 py-4 font-medium">Service</th>
                            <th className="px-6 py-4 font-medium">Status</th>
                            <th className="px-6 py-4 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800">
                        {filteredAppointments.map(appt => (
                            <tr key={appt._id} className="hover:bg-neutral-800/50 transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="font-medium text-white">{appt.patient_id?.name || 'Unknown'}</div>
                                    <div className="text-neutral-500 text-xs">{appt.patient_id?.phone}</div>
                                </td>
                                <td className="px-6 py-4 text-neutral-300">
                                    <div className="flex items-center gap-2">
                                        <Calendar size={14} />
                                        <span>{appt.appointment_date ? new Date(appt.appointment_date).toLocaleDateString() : 'Needs Assigning'}</span>
                                    </div>
                                    {appt.status !== 'Requested' && appt.appointment_date && (
                                        <div className="flex items-center gap-2 mt-1 text-neutral-500">
                                            <Clock size={14} />
                                            <span>{new Date(appt.appointment_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-neutral-300">
                                    {appt.preferred_slot || 'N/A'}
                                </td>
                                <td className="px-6 py-4">
                                    <span className="px-2 py-1 bg-neutral-800 rounded text-xs text-neutral-300 border border-neutral-700">
                                        {appt.service_type}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(appt.status)} ${appt.status === 'Requested' ? 'animate-pulse text-amber-500 bg-amber-500/10 border-amber-500/20' : ''}`}>
                                        <div className={`w-1.5 h-1.5 rounded-full bg-current`}></div>
                                        {appt.status}
                                    </div>
                                    {appt.review_requested && (
                                        <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-500">
                                            <CheckCircle size={10} />
                                            <span>Review Sent</span>
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2">
                                        {/* Status Actions */}
                                        {appt.status === 'Requested' && (
                                             <button 
                                                onClick={() => openEditModal(appt)}
                                                className="px-3 py-1 bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white rounded text-xs font-bold transition-colors" title="Assign Time"
                                            >
                                                Assign Slot
                                            </button>
                                        )}
                                        {appt.status !== 'Completed' && appt.status !== 'Cancelled' && appt.status !== 'Requested' && (
                                            <>
                                                <button 
                                                    onClick={() => handleStatusChange(appt._id, 'Confirmed')}
                                                    className="p-1.5 hover:bg-neutral-700 rounded text-blue-500 transition-colors" title="Confirm"
                                                >
                                                    <CheckCircle size={18} />
                                                </button>
                                                <button 
                                                    onClick={() => openCompletionModal(appt)}
                                                    className="p-1.5 hover:bg-neutral-700 rounded text-emerald-500 transition-colors" title="Complete & Request Review"
                                                >
                                                    <FileText size={18} />
                                                </button>
                                                <button 
                                                    onClick={() => handleStatusChange(appt._id, 'Cancelled')}
                                                    className="p-1.5 hover:bg-neutral-700 rounded text-red-500 transition-colors" title="Cancel"
                                                >
                                                    <XCircle size={18} />
                                                </button>
                                            </>
                                        )}
                                        
                                        {/* Edit Action */}
                                        <button 
                                            onClick={() => openEditModal(appt)}
                                            className="p-1.5 hover:bg-neutral-700 rounded text-neutral-400 hover:text-white transition-colors" title="Edit Details"
                                        >
                                            <Edit size={18} />
                                        </button>

                                        {/* Delete Action */}
                                        <button 
                                            onClick={() => handleDelete(appt._id)}
                                            className="p-1.5 hover:bg-neutral-700 rounded text-red-500/50 hover:text-red-500 transition-colors" title="Delete"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                </div>
                {filteredAppointments.length === 0 && (
                    <div className="p-12 text-center text-neutral-500">
                        <Calendar size={48} className="mx-auto mb-4 opacity-20" />
                        <p>No appointments found.</p>
                    </div>
                )}

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-neutral-800 flex items-center justify-between bg-neutral-950">
                        <p className="text-xs text-neutral-500">Page {page} of {totalPages}</p>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="px-3 py-1 bg-neutral-900 border border-neutral-800 rounded text-neutral-300 disabled:opacity-50 hover:bg-neutral-800 transition-colors"
                            >
                                Prev
                            </button>
                            <button 
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="px-3 py-1 bg-neutral-900 border border-neutral-800 rounded text-neutral-300 disabled:opacity-50 hover:bg-neutral-800 transition-colors"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Add Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl shadow-black">
                        <div className="p-6 sticky top-0 bg-neutral-900/95 backdrop-blur z-10 border-b border-neutral-800 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-white">{editingAppointment ? 'Edit Appointment' : 'New Appointment'}</h2>
                            <button onClick={() => { setShowAddModal(false); setEditingAppointment(null); }} className="text-neutral-500 hover:text-white">
                                <XCircle size={20} />
                            </button>
                        </div>
                        <div className="p-6">
                        <form onSubmit={handleCreateOrUpdate} className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Patient</label>
                                <select required className="w-full bg-neutral-950 border border-neutral-800 rounded p-3 text-white focus:border-white outline-none transition-colors"
                                    value={newAppointment.patient_id} onChange={e => setNewAppointment({...newAppointment, patient_id: e.target.value})}>
                                    <option value="">Select Patient</option>
                                    {patients.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                                </select>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Date</label>
                                    <input required type="date" className="w-full bg-neutral-950 border border-neutral-800 rounded p-3 text-white focus:border-white outline-none transition-colors" 
                                        value={newAppointment.appointment_date} onChange={e => setNewAppointment({...newAppointment, appointment_date: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Time</label>
                                    <input required type="time" className="w-full bg-neutral-950 border border-neutral-800 rounded p-3 text-white focus:border-white outline-none transition-colors" 
                                        value={newAppointment.appointment_time} onChange={e => setNewAppointment({...newAppointment, appointment_time: e.target.value})} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Slot Limit</label>
                                    <select required className="w-full bg-neutral-950 border border-neutral-800 rounded p-3 text-amber-500 focus:border-white outline-none transition-colors font-semibold"
                                        value={newAppointment.preferred_slot} onChange={e => setNewAppointment({...newAppointment, preferred_slot: e.target.value})}>
                                        <option value="Morning">Morning (10:00 - 1:00)</option>
                                        <option value="Afternoon">Afternoon (2:00 - 5:00)</option>
                                        <option value="Evening">Evening (5:30 - 7:30)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Service</label>
                                    <select className="w-full bg-neutral-950 border border-neutral-800 rounded p-3 text-white focus:border-white outline-none transition-colors"
                                        value={newAppointment.service_type} onChange={e => setNewAppointment({...newAppointment, service_type: e.target.value})}>
                                        <option value="Consultation">Consultation</option>
                                        <option value="Cleaning">Cleaning</option>
                                        <option value="Filling">Filling</option>
                                        <option value="Root Canal">Root Canal</option>
                                        <option value="Extraction">Extraction</option>
                                        <option value="Ortho Checkup">Ortho Checkup</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Notes / Chief Complaint</label>
                                <textarea className="w-full bg-neutral-950 border border-neutral-800 rounded p-3 text-white focus:border-white outline-none transition-colors" rows={3}
                                    value={newAppointment.notes} onChange={e => setNewAppointment({...newAppointment, notes: e.target.value})} />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => { setShowAddModal(false); setEditingAppointment(null); }} className="flex-1 py-3 bg-neutral-800 text-white rounded font-medium hover:bg-neutral-700 transition-colors">Cancel</button>
                                <button type="submit" className="flex-1 py-3 bg-white text-black rounded font-bold hover:bg-neutral-200 transition-colors">{editingAppointment ? 'Update Appointment' : 'Book Appointment'}</button>
                            </div>
                        </form>
                        </div>
                    </div>
                </div>
            )}
            {/* Completion & Follow-up Modal */}
            {showCompletionModal && selectedAppointment && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-lg w-full max-w-md shadow-2xl shadow-black animate-fade-in">
                        <div className="p-6 border-b border-neutral-800 flex justify-between items-center bg-neutral-900/95 backdrop-blur rounded-t-lg">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <CheckCircle className="text-emerald-500" />
                                Complete Appointment
                            </h2>
                            <button onClick={() => setShowCompletionModal(false)} className="text-neutral-500 hover:text-white">
                                <XCircle size={20} />
                            </button>
                        </div>
                        
                        <div className="p-6 space-y-6">
                            <div className="bg-neutral-800/50 p-4 rounded border border-neutral-800">
                                <p className="text-sm text-neutral-400 mb-1">Patient</p>
                                <p className="text-lg font-semibold text-white">{selectedAppointment.patient_id?.name}</p>
                                <p className="text-xs text-neutral-500 mt-1">{selectedAppointment.service_type} with Dr. {selectedAppointment.doctor_id?.name}</p>
                            </div>

                            <div className="space-y-4">
                                <label className="flex items-center gap-3 p-3 border border-neutral-700 rounded cursor-pointer hover:bg-neutral-800 transition-colors">
                                    <input 
                                        type="checkbox" 
                                        className="w-5 h-5 accent-emerald-500"
                                        checked={isFollowUpNeeded}
                                        onChange={(e) => setIsFollowUpNeeded(e.target.checked)}
                                    />
                                    <span className="text-white font-medium">Schedule Follow-up?</span>
                                </label>

                                {isFollowUpNeeded && (
                                    <div className="space-y-4 pl-2 border-l-2 border-neutral-800 animate-fade-in">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Date</label>
                                                <input type="date" className="w-full bg-neutral-950 border border-neutral-800 rounded p-2 text-white focus:border-white outline-none"
                                                    value={followUpData.date} onChange={e => setFollowUpData({...followUpData, date: e.target.value})} />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Time</label>
                                                <input type="time" className="w-full bg-neutral-950 border border-neutral-800 rounded p-2 text-white focus:border-white outline-none"
                                                    value={followUpData.time} onChange={e => setFollowUpData({...followUpData, time: e.target.value})} />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Service</label>
                                            <select className="w-full bg-neutral-950 border border-neutral-800 rounded p-2 text-white focus:border-white outline-none"
                                                value={followUpData.service} onChange={e => setFollowUpData({...followUpData, service: e.target.value})}>
                                                <option value="Consultation">Consultation</option>
                                                <option value="Cleaning">Cleaning</option>
                                                <option value="Filling">Filling</option>
                                                <option value="Root Canal">Root Canal</option>
                                                <option value="Extraction">Extraction</option>
                                                <option value="Ortho Checkup">Ortho Checkup</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Notes</label>
                                            <textarea className="w-full bg-neutral-950 border border-neutral-800 rounded p-2 text-white focus:border-white outline-none" rows={2}
                                                placeholder="Reason for follow-up..."
                                                value={followUpData.notes} onChange={e => setFollowUpData({...followUpData, notes: e.target.value})} />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button onClick={() => setShowCompletionModal(false)} className="flex-1 py-3 bg-neutral-800 text-white rounded font-medium hover:bg-neutral-700 transition-colors">
                                    Cancel
                                </button>
                                
                                <div className="flex-[2] flex flex-col gap-2">
                                    <button 
                                        onClick={() => handleCompleteFlow('none')} 
                                        disabled={isFollowUpNeeded && (!followUpData.date || !followUpData.time)}
                                        className="w-full py-2.5 bg-neutral-700 text-white rounded font-bold hover:bg-neutral-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                                    >
                                        <CheckCircle size={14} />
                                        <span>Just Done (No Message)</span>
                                    </button>

                                    <button 
                                        onClick={() => handleCompleteFlow('thank_you')} 
                                        disabled={isFollowUpNeeded && (!followUpData.date || !followUpData.time)}
                                        className="w-full py-2.5 bg-blue-600 text-white rounded font-bold hover:bg-blue-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                                    >
                                        <MessageSquare size={14} />
                                        <span>Done & Send Thank You</span>
                                    </button>

                                    <button 
                                        onClick={() => handleCompleteFlow('review')} 
                                        disabled={isFollowUpNeeded && (!followUpData.date || !followUpData.time)}
                                        className="w-full py-2.5 bg-emerald-500 text-white rounded font-bold hover:bg-emerald-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm shadow-lg shadow-emerald-900/20"
                                    >
                                        <Star size={14} />
                                        <span>Done & Send Review Link</span>
                                    </button>
                                    
                                    {!canSendReview && (
                                        <p className="text-[10px] text-amber-500/80 text-center italic mt-1">
                                            Note: Patient visited within last 9 months.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
