"use client";

import React, { useState, useEffect } from 'react';
import { Users, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '@/app/lib/api';

export default function BroadcastsPage() {
    const [patients, setPatients] = useState<any[]>([]);
    const [selectedPatients, setSelectedPatients] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    
    // Using hardcoded templates as per clinic requirements to simplify
    const templates = [
        { id: 'generic_clinic_msg', name: 'Generic Announcement' },
        { id: 'appointment_reminder', name: 'Appointment Reminder' },
        { id: 'review_request', name: 'Review Request' }
    ];
    const [selectedTemplate, setSelectedTemplate] = useState(templates[0].id);

    const businessId = typeof window !== 'undefined' ? localStorage.getItem('business_id') || "" : "";

    useEffect(() => {
        if (businessId) {
            fetchPatients();
        }
    }, [businessId]);

    const fetchPatients = async () => {
        try {
            const res = await api.get(`/patients?business_id=${businessId}`);
            setPatients(res.data);
            setLoading(false);
        } catch (error) {
            console.error("Error fetching patients:", error);
            setLoading(false);
        }
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedPatients(patients.map(p => p._id));
        } else {
            setSelectedPatients([]);
        }
    };

    const handleSelectPatient = (id: string) => {
        if (selectedPatients.includes(id)) {
            setSelectedPatients(selectedPatients.filter(pid => pid !== id));
        } else {
            setSelectedPatients([...selectedPatients, id]);
        }
    };

    const handleSendBroadcast = async () => {
        if (selectedPatients.length === 0) {
            alert("Please select at least one patient.");
            return;
        }

        if (!confirm(`Are you sure you want to send the '${selectedTemplate}' template to ${selectedPatients.length} patients?`)) {
            return;
        }

        setSending(true);
        try {
            const res = await api.post('/broadcast/send', {
                business_id: businessId,
                customer_ids: selectedPatients,
                template_name: selectedTemplate
            });
            
            alert(`Success! ${res.data.total_queued} messages have been added to the queue and are sending in the background.`);
            setSelectedPatients([]); // Clear selection after sending
        } catch (error: any) {
            alert(error.response?.data?.message || "Failed to send broadcast.");
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Campaigns & Broadcasts</h1>
                    <p className="text-gray-500">Send pre-approved WhatsApp templates to multiple patients at once.</p>
                </div>
                <button
                    onClick={handleSendBroadcast}
                    disabled={selectedPatients.length === 0 || sending}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                    {sending ? (
                        <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                        <Send className="w-4 h-4" />
                    )}
                    Send Broadcast ({selectedPatients.length})
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Left Column: Configuration */}
                <div className="md:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            <Send className="w-4 h-4 text-blue-500" />
                            Message Configuration
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp Template</label>
                                <select 
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={selectedTemplate}
                                    onChange={(e) => setSelectedTemplate(e.target.value)}
                                >
                                    {templates.map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mt-4">
                                <h4 className="text-sm font-semibold text-blue-800 mb-1">How it works</h4>
                                <p className="text-xs text-blue-600">
                                    Broadcasts are sent using your background queue. This ensures Meta API rate limits are respected and your server doesn't time out.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Audience Selection */}
                <div className="md:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                            <Users className="w-4 h-4 text-blue-500" />
                            Select Audience
                        </h3>
                        <span className="text-sm text-gray-500">{selectedPatients.length} selected</span>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto max-h-[600px]">
                        {loading ? (
                            <div className="flex justify-center p-12"><span className="animate-spin h-8 w-8 border-2 border-blue-500 rounded-full border-t-transparent"></span></div>
                        ) : patients.length === 0 ? (
                            <div className="text-center p-12 text-gray-500">No patients found.</div>
                        ) : (
                            <table className="w-full text-left text-sm text-gray-600">
                                <thead className="bg-gray-50 text-gray-700 sticky top-0 border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-3 w-10">
                                            <input 
                                                type="checkbox" 
                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                checked={selectedPatients.length === patients.length && patients.length > 0}
                                                onChange={handleSelectAll}
                                            />
                                        </th>
                                        <th className="px-6 py-3">Patient Name</th>
                                        <th className="px-6 py-3">Phone Number</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {patients.map((patient) => (
                                        <tr 
                                            key={patient._id} 
                                            className={`border-b border-gray-50 hover:bg-blue-50 cursor-pointer transition ${selectedPatients.includes(patient._id) ? 'bg-blue-50/50' : ''}`}
                                            onClick={() => handleSelectPatient(patient._id)}
                                        >
                                            <td className="px-6 py-4">
                                                <input 
                                                    type="checkbox" 
                                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                    checked={selectedPatients.includes(patient._id)}
                                                    readOnly // handled by tr click
                                                />
                                            </td>
                                            <td className="px-6 py-4 font-medium text-gray-800">{patient.name}</td>
                                            <td className="px-6 py-4">{patient.phone}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
