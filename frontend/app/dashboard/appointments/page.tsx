'use client';

import React, { useState, useEffect } from 'react';
import { getAppointments, createAppointment, getPatients, updateAppointment, deleteAppointment, getBusiness } from '../../lib/api';
import { Calendar, Clock, User, Plus, Search, Loader2, CheckCircle, XCircle, FileText, Edit, Trash2, Star, MessageSquare, MousePointerClick, RefreshCw } from 'lucide-react';

const inputCls = "w-full bg-neutral-100 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 rounded p-3 text-neutral-900 dark:text-white focus:border-neutral-900 dark:focus:border-white outline-none transition-colors";
const labelCls = "block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5";

const SERVICES = [
    "Routine Checkup",
    "Teeth Whitening",
    "Dental Implants",
    "Invisible Braces (Invisalign)",
    "Root Canal Treatment",
    "Cosmetic Dentistry",
    "Orthodontic Treatment",
    "Periodontal Therapy",
    "Crown & Bridges",
    "Cavity Treatment",
    "Wisdom Tooth Removal",
    "Normal Tooth Treatment/Removal",
    "Minor Surgery",
    "Other / Consult"
];

const allTimeOptions = Array.from({ length: 24 }).flatMap((_, h) => 
    ['00', '15', '30', '45'].map(m => {
      const hh = h.toString().padStart(2, '0');
      return `${hh}:${m}`;
    })
);

const getSlotForTime = (time: string) => {
    if (!time) return 'Morning';
    const [h, m] = time.split(':').map(Number);
    const timeValue = h + m / 60;
    if (timeValue >= 10 && timeValue <= 13.75) return 'Morning';
    if (timeValue >= 14 && timeValue <= 17.25) return 'Afternoon';
    if (timeValue >= 17.5 && timeValue <= 19.5) return 'Evening';
    return ''; // outside bounds
};

const getTimesForSlot = (slot: string) => {
    // If no slot is selected, return all valid times between 10am and 7:30pm
    return allTimeOptions.filter(t => {
        const s = getSlotForTime(t);
        return slot ? s === slot : s !== '';
    });
};

export default function AppointmentsPage() {
    const [appointments, setAppointments] = useState<any[]>([]);
    const [patients, setPatients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingAppointment, setEditingAppointment] = useState<any>(null);
    const [filterStatus, setFilterStatus] = useState('');
    const [filterDate, setFilterDate] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [businessId] = useState(process.env.NEXT_PUBLIC_BUSINESS_ID || '69edf7401e9164e3fd73e073');
    const [refreshing, setRefreshing] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [showCompletionModal, setShowCompletionModal] = useState(false);
    const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
    const [isFollowUpNeeded, setIsFollowUpNeeded] = useState(false);
    const [canSendReview, setCanSendReview] = useState(false);
    const [followUpData, setFollowUpData] = useState({ date: '', time: '', service: 'Routine Checkup', notes: '' });

    const [patientSearch, setPatientSearch] = useState('');
    const [showPatientDropdown, setShowPatientDropdown] = useState(false);

    const [newAppointment, setNewAppointment] = useState({
        patient_id: '', appointment_date: '', appointment_time: '',
        service_type: 'Routine Checkup', preferred_slot: 'Morning',
        status: 'Booked', notes: '', business_id: businessId
    });

    const [businessConfig, setBusinessConfig] = useState<any>(null);

    useEffect(() => {
        const timer = setTimeout(() => { fetchData(); }, 300);
        return () => clearTimeout(timer);
    }, [businessId, page, filterStatus, filterDate, searchQuery]);

    const fetchData = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true); else { setLoading(true); setError(null); }
        try {
            const [apptRes, patientData, businessData] = await Promise.all([
                getAppointments(businessId, { page, limit: 10, status: filterStatus, search: searchQuery, date: filterDate }),
                getPatients(businessId),
                getBusiness(businessId)
            ]);
            setAppointments(apptRes.data || []);
            setTotalPages(apptRes.totalPages || 1);
            setPatients(patientData);
            setBusinessConfig(businessData);
        } catch (err: any) {
            setError(err.response?.data?.error || "Failed to load data.");
        } finally { setLoading(false); setRefreshing(false); }
    };

    const handleOpenAdd = () => {
        setEditingAppointment(null);
        setNewAppointment({ patient_id: '', appointment_date: '', appointment_time: '', service_type: 'Routine Checkup', preferred_slot: 'Morning', status: 'Booked', notes: '', business_id: businessId });
        setPatientSearch('');
        setShowPatientDropdown(false);
        setShowAddModal(true);
    };

    const openEditModal = (appt: any) => {
        setEditingAppointment(appt);
        setPatientSearch(appt.patient_id?.name || '');
        let initialTime = '';
        if (appt.appointment_date && new Date(appt.appointment_date).getFullYear() > 1970) {
            initialTime = new Date(appt.appointment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        }
        setNewAppointment({
            patient_id: appt.patient_id?._id || appt.patient_id || '',
            business_id: appt.business_id,
            appointment_date: appt.appointment_date ? new Date(appt.appointment_date).toISOString().split('T')[0] : '',
            appointment_time: initialTime,
            service_type: appt.service_type || 'Routine Checkup',
            preferred_slot: appt.preferred_slot || 'Morning',
            status: appt.status === 'Requested' ? 'Booked' : (appt.status || 'Booked'),
            notes: appt.notes || ''
        });
        setShowAddModal(true);
    };

    const handleCreateOrUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!newAppointment.patient_id) {
            alert("Please select a patient from the dropdown. If they are a new patient, add them in the Patients tab first.");
            return;
        }

        if (submitting) return;
        setSubmitting(true);

        try {
            const dateTime = new Date(`${newAppointment.appointment_date}T${newAppointment.appointment_time}`);
            const payload = { ...newAppointment, appointment_date: dateTime };
            if (editingAppointment) { await updateAppointment(editingAppointment._id, payload); }
            else { await createAppointment(payload); }
            setShowAddModal(false); setEditingAppointment(null); fetchData();
        } catch (error) { 
            console.error(error); 
            alert(`Failed to ${editingAppointment ? 'update' : 'create'} appointment`); 
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this appointment?')) return;
        try { await deleteAppointment(id); fetchData(); }
        catch (error) { alert('Failed to delete appointment'); }
    };

    const handleStatusChange = async (id: string, newStatus: string) => {
        try {
            if (newStatus === 'Completed') { const appt = appointments.find(a => a._id === id); if (appt) { openCompletionModal(appt); } return; }
            await updateAppointment(id, { status: newStatus }); fetchData();
        } catch (error) { alert('Failed to update status'); }
    };

    const openCompletionModal = async (appt: any) => {
        setSelectedAppointment(appt); setIsFollowUpNeeded(false); setShowCompletionModal(true);
        try {
            const nineMonthsAgo = new Date(); nineMonthsAgo.setMonth(nineMonthsAgo.getMonth() - 9);
            const prevAppts = await getAppointments(businessId, { patient_id: appt.patient_id?._id || appt.patient_id, status: 'Completed' });
            const hasRecentVisit = (prevAppts.data || []).some((a: any) => a._id !== appt._id && new Date(a.appointment_date) >= nineMonthsAgo);
            setCanSendReview(!hasRecentVisit);
        } catch { setCanSendReview(true); }
    };

    const handleCompleteFlow = async (messageType: 'none' | 'thank_you' | 'review' = 'none') => {
        try {
            await updateAppointment(selectedAppointment._id, { status: 'Completed', message_type: messageType });
            if (isFollowUpNeeded && followUpData.date && followUpData.time) {
                const dateTime = new Date(`${followUpData.date}T${followUpData.time}`);
                await createAppointment({ patient_id: selectedAppointment.patient_id._id, doctor_id: selectedAppointment.doctor_id._id, business_id: selectedAppointment.business_id, appointment_date: dateTime, service_type: followUpData.service, notes: `Follow-up: ${followUpData.notes}` });
            }
            setShowCompletionModal(false); fetchData();
        } catch { alert("Failed to complete appointment flow."); }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Completed': return 'text-emerald-600 dark:text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
            case 'Confirmed': return 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20';
            case 'Cancelled': return 'text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20';
            default: return 'text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700';
        }
    };

    const bookedTimes = React.useMemo(() => {
        if (!newAppointment.appointment_date) return [];
        return appointments
            .filter(a => a.appointment_date && a.status !== 'Cancelled' && a.status !== 'Completed' && a._id !== editingAppointment?._id)
            .filter(a => {
                const d = new Date(a.appointment_date);
                const localDateStr = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
                return localDateStr === newAppointment.appointment_date;
            })
            .map(a => {
                const d = new Date(a.appointment_date);
                return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
            });
    }, [newAppointment.appointment_date, appointments, editingAppointment]);

    const isDateHoliday = React.useMemo(() => {
        if (!newAppointment.appointment_date || !businessConfig?.holidays) return false;
        return businessConfig.holidays.some((h: any) => h.split('T')[0] === newAppointment.appointment_date);
    }, [newAppointment.appointment_date, businessConfig]);

    const getBlockedShiftsForDate = React.useMemo(() => {
        if (!newAppointment.appointment_date || !businessConfig?.blocked_shifts) return [];
        const block = businessConfig.blocked_shifts.find((b: any) => b.date.split('T')[0] === newAppointment.appointment_date);
        return block ? block.shifts : [];
    }, [newAppointment.appointment_date, businessConfig]);

    const filteredAppointments = appointments.filter(a => !filterStatus || a.status === filterStatus);

    if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-neutral-400" /></div>;

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-6">
                <div>
                    <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white tracking-tight">Appointments</h1>
                    <p className="text-neutral-500 mt-1 text-sm">Schedule and manage clinic visits.</p>
                </div>
                <div className="flex gap-2 items-center flex-wrap">
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input type="text" placeholder="Search name or phone..."
                            className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded pl-9 pr-3 py-2 text-neutral-900 dark:text-white text-sm outline-none focus:border-neutral-900 dark:focus:border-white w-48"
                            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>
                    <input type="date" className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded px-3 py-2 text-neutral-900 dark:text-white text-sm outline-none"
                        value={filterDate} onChange={(e) => { setFilterDate(e.target.value); setPage(1); }} />
                    <select className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded px-3 py-2 text-neutral-900 dark:text-white text-sm outline-none"
                        onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}>
                        <option value="">All Status</option>
                        <option value="Requested">Requested (Web)</option>
                        <option value="Booked">Booked</option>
                        <option value="Confirmed">Confirmed</option>
                        <option value="Completed">Completed</option>
                        <option value="Cancelled">Cancelled</option>
                    </select>
                    <button onClick={() => fetchData(true)} disabled={refreshing}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-white bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded hover:border-neutral-400 dark:hover:border-neutral-600 transition-all disabled:opacity-50">
                        <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                    <button onClick={handleOpenAdd} className="flex items-center gap-2 bg-neutral-900 dark:bg-white text-white dark:text-black px-4 py-2 rounded font-bold text-sm uppercase tracking-wider hover:bg-neutral-700 dark:hover:bg-neutral-200 transition-colors">
                        <Plus size={16} /><span>New Booking</span>
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-neutral-50 dark:bg-neutral-950 text-neutral-500 uppercase font-mono text-xs">
                            <tr>
                                <th className="px-6 py-4 font-medium">Patient</th>
                                <th className="px-6 py-4 font-medium">Date &amp; Time</th>
                                <th className="px-6 py-4 font-medium">Slot</th>
                                <th className="px-6 py-4 font-medium">Service</th>
                                <th className="px-6 py-4 font-medium">Status</th>
                                <th className="px-6 py-4 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                            {filteredAppointments.map(appt => (
                                <tr key={appt._id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-neutral-900 dark:text-white capitalize">{appt.patient_id?.name || 'Unknown'}</div>
                                        <div className="text-neutral-500 text-xs">{appt.patient_id?.phone}</div>
                                    </td>
                                    <td className="px-6 py-4 text-neutral-600 dark:text-neutral-300">
                                        <div className="flex items-center gap-2">
                                            <Calendar size={14} />
                                            <span>{appt.appointment_date ? new Date(appt.appointment_date).toLocaleDateString() : 'Needs Assigning'}</span>
                                        </div>
                                        {appt.status !== 'Requested' && appt.appointment_date && (
                                            <div className="flex items-center gap-2 mt-1 text-neutral-400">
                                                <Clock size={14} />
                                                <span>{new Date(appt.appointment_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-neutral-600 dark:text-neutral-300">{appt.preferred_slot || 'N/A'}</td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 rounded text-xs text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 capitalize">
                                            {appt.service_type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(appt.status)} ${appt.status === 'Requested' ? 'animate-pulse !text-amber-600 dark:!text-amber-500 !bg-amber-500/10 !border-amber-500/20' : ''}`}>
                                            <div className="w-1.5 h-1.5 rounded-full bg-current"></div>
                                            {appt.status}
                                        </div>
                                        {appt.review_requested && (
                                            <div className="mt-1 space-y-1">
                                                <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-500">
                                                    <CheckCircle size={10} /><span>Review Sent</span>
                                                </div>
                                                {appt.review_link_clicked && (
                                                    <div className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-500">
                                                        <MousePointerClick size={10} /><span>Link Clicked!</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            {appt.status === 'Requested' && (
                                                <button onClick={() => openEditModal(appt)} className="px-3 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-500 hover:bg-amber-500 hover:text-white rounded text-xs font-bold transition-colors">Assign Slot</button>
                                            )}
                                            {appt.status !== 'Completed' && appt.status !== 'Cancelled' && appt.status !== 'Requested' && (<>
                                                <button onClick={() => handleStatusChange(appt._id, 'Confirmed')} className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded text-blue-500 transition-colors" title="Confirm"><CheckCircle size={18} /></button>
                                                <button onClick={() => openCompletionModal(appt)} className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded text-emerald-500 transition-colors" title="Complete"><FileText size={18} /></button>
                                                <button onClick={() => handleStatusChange(appt._id, 'Cancelled')} className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded text-red-500 transition-colors" title="Cancel"><XCircle size={18} /></button>
                                            </>)}
                                            <button onClick={() => openEditModal(appt)} className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors" title="Edit"><Edit size={18} /></button>
                                            <button onClick={() => handleDelete(appt._id)} className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded text-red-400 hover:text-red-500 transition-colors" title="Delete"><Trash2 size={18} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {filteredAppointments.length === 0 && (
                    <div className="p-12 text-center text-neutral-400">
                        <Calendar size={48} className="mx-auto mb-4 opacity-20" />
                        <p>No appointments found.</p>
                    </div>
                )}
                {totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between bg-neutral-50 dark:bg-neutral-950">
                        <p className="text-xs text-neutral-400">Page {page} of {totalPages}</p>
                        <div className="flex gap-2">
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded text-neutral-700 dark:text-neutral-300 disabled:opacity-50 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">Prev</button>
                            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded text-neutral-700 dark:text-neutral-300 disabled:opacity-50 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">Next</button>
                        </div>
                    </div>
                )}
            </div>

            {/* Add/Edit Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="p-6 sticky top-0 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center z-10">
                            <h2 className="text-xl font-bold text-neutral-900 dark:text-white">{editingAppointment ? 'Edit Appointment' : 'New Appointment'}</h2>
                            <button onClick={() => { setShowAddModal(false); setEditingAppointment(null); }} className="text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"><XCircle size={20} /></button>
                        </div>
                        <div className="p-6">
                            <form onSubmit={handleCreateOrUpdate} className="space-y-5">
                                <div>
                                    <label className={labelCls}>Patient</label>
                                    <div className="relative">
                                        <div className="flex items-center">
                                            <input 
                                                type="text" 
                                                required={!newAppointment.patient_id}
                                                className={inputCls}
                                                placeholder="Search patient name..."
                                                value={showPatientDropdown ? patientSearch : (patients.find(p => p._id === newAppointment.patient_id) ? `${patients.find(p => p._id === newAppointment.patient_id)?.name} - ${patients.find(p => p._id === newAppointment.patient_id)?.phone}` : patientSearch)}
                                                onChange={e => {
                                                    setPatientSearch(e.target.value);
                                                    setNewAppointment({...newAppointment, patient_id: ''});
                                                    setShowPatientDropdown(true);
                                                }}
                                                onFocus={() => setShowPatientDropdown(true)}
                                                onBlur={() => setTimeout(() => setShowPatientDropdown(false), 200)}
                                            />
                                            {newAppointment.patient_id && !showPatientDropdown && (
                                                <CheckCircle size={16} className="absolute right-3 text-emerald-500" />
                                            )}
                                        </div>
                                        {showPatientDropdown && (
                                            <div className="absolute z-50 w-full mt-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded shadow-lg max-h-48 overflow-y-auto">
                                                {patients
                                                    .filter(p => p.name.toLowerCase().includes(patientSearch.toLowerCase()) || p.phone.includes(patientSearch))
                                                    .map(p => (
                                                        <div 
                                                            key={p._id}
                                                            className="px-4 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 cursor-pointer text-sm"
                                                            onMouseDown={(e) => {
                                                                e.preventDefault(); // Prevents the input from losing focus immediately
                                                                setNewAppointment({...newAppointment, patient_id: p._id});
                                                                setPatientSearch(p.name);
                                                                setShowPatientDropdown(false);
                                                            }}
                                                        >
                                                            <div className="font-medium text-neutral-900 dark:text-white">{p.name}</div>
                                                            <div className="text-xs text-neutral-500">{p.phone}</div>
                                                        </div>
                                                    ))}
                                                {patients.filter(p => p.name.toLowerCase().includes(patientSearch.toLowerCase()) || p.phone.includes(patientSearch)).length === 0 && (
                                                    <div className="px-4 py-3 text-sm text-neutral-500 bg-neutral-50 dark:bg-neutral-900">
                                                        No patients found matching "{patientSearch}". Please add them in the Patients tab first.
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelCls}>Date</label>
                                        <input required type="date" className={inputCls} value={newAppointment.appointment_date} onChange={e => setNewAppointment({...newAppointment, appointment_date: e.target.value})} />
                                        {isDateHoliday && <p className="text-xs text-rose-500 font-bold mt-1">The clinic is closed on this date (Holiday).</p>}
                                    </div>
                                    <div>
                                        <label className={labelCls}>Time</label>
                                        <select required className={inputCls} value={newAppointment.appointment_time} onChange={e => {
                                            const time = e.target.value;
                                            const slot = getSlotForTime(time) || newAppointment.preferred_slot;
                                            setNewAppointment({...newAppointment, appointment_time: time, preferred_slot: slot});
                                        }}>
                                            <option value="">Select Time</option>
                                            {getTimesForSlot(newAppointment.preferred_slot).map(t => {
                                                const isBooked = bookedTimes.includes(t);
                                                return <option key={t} value={t} disabled={isBooked}>{t} {isBooked ? '(Booked)' : ''}</option>;
                                            })}
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelCls}>Slot</label>
                                        <select required className={inputCls} value={newAppointment.preferred_slot} onChange={e => {
                                            const slot = e.target.value;
                                            const currentSlot = getSlotForTime(newAppointment.appointment_time);
                                            let newTime = newAppointment.appointment_time;
                                            if (currentSlot !== slot) newTime = '';
                                            setNewAppointment({...newAppointment, preferred_slot: slot, appointment_time: newTime});
                                        }}>
                                            <option value="Morning" disabled={getBlockedShiftsForDate.includes('Morning')}>Morning (10:00 - 1:45) {getBlockedShiftsForDate.includes('Morning') ? '(Closed)' : ''}</option>
                                            <option value="Afternoon" disabled={getBlockedShiftsForDate.includes('Afternoon')}>Afternoon (2:00 - 5:15) {getBlockedShiftsForDate.includes('Afternoon') ? '(Closed)' : ''}</option>
                                            <option value="Evening" disabled={getBlockedShiftsForDate.includes('Evening')}>Evening (5:30 - 7:30) {getBlockedShiftsForDate.includes('Evening') ? '(Closed)' : ''}</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelCls}>Treatment</label>
                                        <select className={inputCls} value={newAppointment.service_type} onChange={e => setNewAppointment({...newAppointment, service_type: e.target.value})}>
                                            {!SERVICES.includes(newAppointment.service_type) && newAppointment.service_type && (
                                                <option value={newAppointment.service_type}>{newAppointment.service_type} (From Web)</option>
                                            )}
                                            {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className={labelCls}>Status</label>
                                    <select className={inputCls} value={newAppointment.status} onChange={e => setNewAppointment({...newAppointment, status: e.target.value})}>
                                        <option value="Requested">Requested (Web)</option>
                                        <option value="Booked">Booked</option>
                                        <option value="Confirmed">Confirmed</option>
                                        <option value="Completed">Completed</option>
                                        <option value="Cancelled">Cancelled</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={labelCls}>Notes / Chief Complaint</label>
                                    <textarea className={inputCls} rows={2} value={newAppointment.notes} onChange={e => setNewAppointment({...newAppointment, notes: e.target.value})} />
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button type="button" disabled={submitting} onClick={() => { setShowAddModal(false); setEditingAppointment(null); }} className="flex-1 py-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white rounded font-medium hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50">Cancel</button>
                                    <button type="submit" disabled={submitting || isDateHoliday || getBlockedShiftsForDate.includes(newAppointment.preferred_slot)} className="flex-1 py-3 flex justify-center items-center gap-2 bg-neutral-900 dark:bg-white text-white dark:text-black rounded font-bold hover:bg-neutral-700 dark:hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                                        {submitting ? 'Saving...' : (editingAppointment ? 'Update' : 'Book Appointment')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Completion Modal */}
            {showCompletionModal && selectedAppointment && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg w-full max-w-md shadow-2xl animate-fade-in">
                        <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-neutral-900 dark:text-white flex items-center gap-2"><CheckCircle className="text-emerald-500" />Complete Appointment</h2>
                            <button onClick={() => setShowCompletionModal(false)} className="text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"><XCircle size={20} /></button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="bg-neutral-50 dark:bg-neutral-800/50 p-4 rounded border border-neutral-200 dark:border-neutral-800">
                                <p className="text-sm text-neutral-500 mb-1">Patient</p>
                                <p className="text-lg font-semibold text-neutral-900 dark:text-white capitalize">{selectedAppointment.patient_id?.name}</p>
                                <p className="text-xs text-neutral-400 mt-1 capitalize">{selectedAppointment.service_type} with Dr. {selectedAppointment.doctor_id?.name}</p>
                            </div>
                            <div className="space-y-4">
                                <label className="flex items-center gap-3 p-3 border border-neutral-200 dark:border-neutral-700 rounded cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
                                    <input type="checkbox" className="w-5 h-5 accent-emerald-500" checked={isFollowUpNeeded} onChange={(e) => setIsFollowUpNeeded(e.target.checked)} />
                                    <span className="text-neutral-900 dark:text-white font-medium">Schedule Follow-up?</span>
                                </label>
                                {isFollowUpNeeded && (
                                    <div className="space-y-4 pl-2 border-l-2 border-neutral-200 dark:border-neutral-800 animate-fade-in">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div><label className={labelCls}>Date</label><input type="date" className={inputCls} value={followUpData.date} onChange={e => setFollowUpData({...followUpData, date: e.target.value})} /></div>
                                            <div>
                                                <label className={labelCls}>Time</label>
                                                <select className={inputCls} value={followUpData.time} onChange={e => setFollowUpData({...followUpData, time: e.target.value})}>
                                                    <option value="">Select Time</option>
                                                    {getTimesForSlot('').map(t => <option key={t} value={t}>{t}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                        <div>
                                            <label className={labelCls}>Service</label>
                                            <select className={inputCls} value={followUpData.service} onChange={e => setFollowUpData({...followUpData, service: e.target.value})}>
                                                {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </div>
                                        <div><label className={labelCls}>Notes</label><textarea className={inputCls} rows={2} placeholder="Reason for follow-up..." value={followUpData.notes} onChange={e => setFollowUpData({...followUpData, notes: e.target.value})} /></div>
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button onClick={() => setShowCompletionModal(false)} className="flex-1 py-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white rounded font-medium hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors">Cancel</button>
                                <div className="flex-[2] flex flex-col gap-2">
                                    <button onClick={() => handleCompleteFlow('none')} disabled={isFollowUpNeeded && (!followUpData.date || !followUpData.time)} className="w-full py-2.5 bg-neutral-200 dark:bg-neutral-700 text-neutral-900 dark:text-white rounded font-bold hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"><CheckCircle size={14} /><span>Just Done (No Message)</span></button>
                                    <button onClick={() => handleCompleteFlow('thank_you')} disabled={isFollowUpNeeded && (!followUpData.date || !followUpData.time)} className="w-full py-2.5 bg-blue-600 text-white rounded font-bold hover:bg-blue-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"><MessageSquare size={14} /><span>Done &amp; Send Thank You</span></button>
                                    <button onClick={() => handleCompleteFlow('review')} disabled={isFollowUpNeeded && (!followUpData.date || !followUpData.time)} className="w-full py-2.5 bg-emerald-500 text-white rounded font-bold hover:bg-emerald-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm shadow-lg shadow-emerald-900/20"><Star size={14} /><span>Done &amp; Send Review Link</span></button>
                                    {!canSendReview && <p className="text-[10px] text-amber-500 text-center italic mt-1">Note: Patient visited within last 9 months.</p>}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
