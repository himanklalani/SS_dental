"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Users, Send, CheckCircle2, AlertCircle, Eye, Zap, Search, UserPlus, Upload, Trash2 } from 'lucide-react';
import api from '@/app/lib/api';

// System templates always available (hardcoded, interceptor-aware)
const SYSTEM_TEMPLATES = [
    { id: 'generic_clinic_msg',        name: 'Generic Announcement',         body: `Greetings from Dr. Saachi Shingrani's Dental Care, {{1}}, we sincerely hope you are doing well. Please feel free to reach out to us or book your next appointment at your convenience or send a text here. 😊\n\nVisit our website: https://www.srsdentalcare.in\nCall us: +919004402797` },
    { id: 'appointment_reminder',      name: 'Appointment Reminder',         body: `Hi {{1}}, this is a friendly reminder that you have an upcoming appointment. We look forward to seeing you!` },
    { id: 'review_request_no_followup',name: 'Review Request (No Follow-up)',body: `Greetings {{1}} from Dr Saachi Shingrani's Dental Care, it would be really helpful if you shared your review about us.\n\nThank You!` },
];

export default function BroadcastsPage() {
    const [patients, setPatients] = useState<any[]>([]);
    const [selectedPatients, setSelectedPatients] = useState<string[]>([]);
    
    // Custom Contacts State
    const [customContacts, setCustomContacts] = useState<{id: string, name: string, phone: string}[]>([]);
    const [activeTab, setActiveTab] = useState<'patients' | 'custom'>('patients');
    
    const [manualName, setManualName] = useState('');
    const [manualPhone, setManualPhone] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [search, setSearch] = useState('');

    // Dynamic templates fetched from DB (APPROVED only)
    const [customTemplates, setCustomTemplates] = useState<any[]>([]);
    const [templatesLoading, setTemplatesLoading] = useState(true);

    const allTemplates = useMemo(() => [
        ...SYSTEM_TEMPLATES,
        ...customTemplates.map(t => {
            const bodyComp = t.components?.find((c: any) => c.type === 'BODY');
            return { id: t.name, name: `${t.name.replace(/_/g, ' ')} (Custom)`, body: bodyComp?.text || '' };
        })
    ], [customTemplates]);

    const [selectedTemplateId, setSelectedTemplateId] = useState(SYSTEM_TEMPLATES[0].id);
    const selectedTemplate = allTemplates.find(t => t.id === selectedTemplateId) || allTemplates[0];

    // Preview: replace {{1}} with "[Patient Name]"
    const previewText = selectedTemplate?.body
        ?.replace(/\{\{1\}\}/g, '[Patient Name]')
        ?.replace(/\{\{2\}\}/g, '[Service]')
        ?.replace(/\\n/g, '\n') || '';

    const [businessId] = useState(process.env.NEXT_PUBLIC_BUSINESS_ID || '69edf7401e9164e3fd73e073');

    useEffect(() => {
        if (businessId) {
            fetchPatients();
            fetchCustomTemplates();
        }
    }, [businessId]);

    const fetchPatients = async () => {
        try {
            const res = await api.get(`/patients?business_id=${businessId}`);
            setPatients(res.data);
        } catch (error) {
            console.error("Error fetching patients:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchCustomTemplates = async () => {
        try {
            const res = await api.get('/templates');
            // Only show APPROVED custom templates
            setCustomTemplates(res.data.filter((t: any) => t.status === 'APPROVED'));
        } catch (error) {
            console.error("Error fetching custom templates:", error);
        } finally {
            setTemplatesLoading(false);
        }
    };

    const filteredPatients = useMemo(() =>
        patients.filter(p =>
            p.name?.toLowerCase().includes(search.toLowerCase()) ||
            p.phone?.includes(search)
        ), [patients, search]);

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedPatients(filteredPatients.map(p => p._id));
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

    // --- Custom Contacts Logic ---
    const handleAddManualContact = (e: React.FormEvent) => {
        e.preventDefault();
        if (!manualName.trim() || !manualPhone.trim()) return;
        setCustomContacts([...customContacts, { id: Date.now().toString(), name: manualName.trim(), phone: manualPhone.trim() }]);
        setManualName('');
        setManualPhone('');
    };

    const handleRemoveCustomContact = (id: string) => {
        setCustomContacts(customContacts.filter(c => c.id !== id));
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            if (!text) return;

            const lines = text.split('\n');
            const newContacts: any[] = [];
            
            // Basic CSV parsing assuming "Name, Phone"
            lines.forEach((line, index) => {
                if (index === 0 && line.toLowerCase().includes('name')) return; // skip header
                
                const parts = line.split(',');
                if (parts.length >= 2) {
                    const name = parts[0].trim();
                    const phone = parts[1].trim();
                    if (name && phone) {
                        newContacts.push({ id: `${Date.now()}_${index}`, name, phone });
                    }
                }
            });

            if (newContacts.length > 0) {
                setCustomContacts(prev => [...prev, ...newContacts]);
                alert(`Added ${newContacts.length} contacts from CSV!`);
            } else {
                alert("Could not find valid contacts in CSV. Please ensure format is: Name, Phone");
            }
        };
        reader.readAsText(file);
        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // --- Send Logic ---
    const handleSendBroadcast = async () => {
        const totalToSend = selectedPatients.length + customContacts.length;
        if (totalToSend === 0) {
            alert("Please select at least one patient or add custom contacts.");
            return;
        }

        if (!confirm(`Send "${selectedTemplate?.name}" to ${totalToSend} recipients?\n\nNote: Recipients with an active 24h window will receive this for free. Others will be charged ~₹0.72 each.`)) {
            return;
        }

        setSending(true);
        try {
            const res = await api.post('/broadcast/send', {
                business_id: businessId,
                customer_ids: selectedPatients,
                custom_contacts: customContacts, // Pass custom contacts directly
                template_name: selectedTemplateId
            });

            const { total_queued, skipped_opted_out } = res.data;
            const skipMsg = skipped_opted_out > 0 ? `\n⚠️ ${skipped_opted_out} recipient(s) skipped (opted out).` : '';
            alert(`✅ ${total_queued} messages queued and sending!${skipMsg}`);
            
            // Clear selections after sending
            setSelectedPatients([]);
            setCustomContacts([]);
        } catch (error: any) {
            alert(error.response?.data?.message || "Failed to send broadcast.");
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Campaigns & Broadcasts</h1>
                    <p className="text-gray-500">Send pre-approved WhatsApp templates to multiple patients at once.</p>
                </div>
                <button
                    onClick={handleSendBroadcast}
                    disabled={(selectedPatients.length === 0 && customContacts.length === 0) || sending}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm w-full md:w-auto justify-center"
                >
                    {sending ? (
                        <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                        <Send className="w-4 h-4" />
                    )}
                    Send Broadcast ({selectedPatients.length + customContacts.length})
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left Column: Configuration + Preview */}
                <div className="lg:col-span-1 space-y-4">
                    {/* Template Selector */}
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                            <Send className="w-4 h-4 text-blue-500" />
                            Select Template
                        </h3>
                        <select
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            value={selectedTemplateId}
                            onChange={(e) => setSelectedTemplateId(e.target.value)}
                        >
                            <optgroup label="System Templates">
                                {SYSTEM_TEMPLATES.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </optgroup>
                            {customTemplates.length > 0 && (
                                <optgroup label="Your Custom Templates">
                                    {customTemplates.map(t => (
                                        <option key={t.name} value={t.name}>{t.name.replace(/_/g, ' ')}</option>
                                    ))}
                                </optgroup>
                            )}
                        </select>
                        {templatesLoading && (
                            <p className="text-xs text-gray-400 mt-1">Loading custom templates...</p>
                        )}
                    </div>

                    {/* Live Preview */}
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                            <Eye className="w-4 h-4 text-purple-500" />
                            Message Preview
                        </h3>
                        <div className="bg-[#e9f7ef] rounded-xl p-3 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed shadow-sm border border-[#d5f0e0] min-h-[80px]">
                            {previewText || <span className="text-gray-400 italic">No preview available.</span>}
                        </div>
                        <p className="text-xs text-gray-400 mt-2 italic">{"{{1}}"} = Name will be auto-injected</p>
                    </div>

                    {/* Smart Interceptor Notice */}
                    <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                        <h4 className="text-sm font-semibold text-green-800 mb-1 flex items-center gap-1">
                            <Zap className="w-4 h-4" /> Smart Interceptor Active
                        </h4>
                        <p className="text-xs text-green-700">
                            Recipients with an active 24h conversation window will receive this message <strong>for free</strong>. Others are charged ~₹0.72 each.
                        </p>
                    </div>
                </div>

                {/* Right Column: Audience Selection */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col min-h-[600px]">
                    
                    {/* Tabs */}
                    <div className="flex border-b border-gray-100 bg-gray-50/50">
                        <button 
                            className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'patients' ? 'border-blue-600 text-blue-700 bg-blue-50/30' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                            onClick={() => setActiveTab('patients')}
                        >
                            CRM Patients ({selectedPatients.length})
                        </button>
                        <button 
                            className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'custom' ? 'border-blue-600 text-blue-700 bg-blue-50/30' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                            onClick={() => setActiveTab('custom')}
                        >
                            Custom Audience ({customContacts.length})
                        </button>
                    </div>

                    {/* Tab 1: CRM Patients */}
                    {activeTab === 'patients' && (
                        <div className="flex flex-col flex-1">
                            <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                                    <Users className="w-4 h-4 text-blue-500" />
                                    Select from Patients
                                </h3>
                                <div className="relative flex-1 w-full sm:max-w-xs">
                                    <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search patients..."
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                        className="pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm w-full focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto max-h-[500px]">
                                {loading ? (
                                    <div className="flex justify-center p-12"><span className="animate-spin h-8 w-8 border-2 border-blue-500 rounded-full border-t-transparent"></span></div>
                                ) : filteredPatients.length === 0 ? (
                                    <div className="text-center p-12 text-gray-500">No patients found.</div>
                                ) : (
                                    <table className="w-full text-left text-sm text-gray-600">
                                        <thead className="bg-gray-50 text-gray-700 sticky top-0 border-b border-gray-200 shadow-sm z-10">
                                            <tr>
                                                <th className="px-6 py-3 w-10">
                                                    <input
                                                        type="checkbox"
                                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                        checked={selectedPatients.length === filteredPatients.length && filteredPatients.length > 0}
                                                        onChange={handleSelectAll}
                                                    />
                                                </th>
                                                <th className="px-6 py-3">Patient Name</th>
                                                <th className="px-6 py-3">Phone Number</th>
                                                <th className="px-6 py-3">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredPatients.map((patient) => (
                                                <tr
                                                    key={patient._id}
                                                    className={`border-b border-gray-50 hover:bg-blue-50 cursor-pointer transition ${selectedPatients.includes(patient._id) ? 'bg-blue-50/50' : ''} ${patient.opt_out ? 'opacity-40 cursor-not-allowed' : ''}`}
                                                    onClick={() => !patient.opt_out && handleSelectPatient(patient._id)}
                                                >
                                                    <td className="px-6 py-4">
                                                        <input
                                                            type="checkbox"
                                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                            checked={selectedPatients.includes(patient._id)}
                                                            disabled={patient.opt_out}
                                                            readOnly
                                                        />
                                                    </td>
                                                    <td className="px-6 py-4 font-medium text-gray-800">{patient.name}</td>
                                                    <td className="px-6 py-4">{patient.phone}</td>
                                                    <td className="px-6 py-4">
                                                        {patient.opt_out ? (
                                                            <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Opted Out</span>
                                                        ) : (
                                                            <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">Active</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Tab 2: Custom Contacts */}
                    {activeTab === 'custom' && (
                        <div className="flex flex-col flex-1 p-6 space-y-6">
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Manual Entry */}
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                    <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2 text-sm">
                                        <UserPlus className="w-4 h-4" /> Add Manually
                                    </h4>
                                    <form onSubmit={handleAddManualContact} className="space-y-3">
                                        <input 
                                            type="text" 
                                            placeholder="Patient Name" 
                                            required
                                            value={manualName}
                                            onChange={(e) => setManualName(e.target.value)}
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                        <input 
                                            type="text" 
                                            placeholder="WhatsApp Number (e.g. 9876543210)" 
                                            required
                                            value={manualPhone}
                                            onChange={(e) => setManualPhone(e.target.value)}
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                        <p className="text-[10px] text-gray-500 -mt-1">+91 will be added automatically if no country code is provided.</p>
                                        <button type="submit" className="w-full bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-medium transition">
                                            Add to List
                                        </button>
                                    </form>
                                </div>

                                {/* CSV Upload */}
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col justify-center items-center text-center">
                                    <Upload className="w-6 h-6 text-blue-500 mb-2" />
                                    <h4 className="font-medium text-gray-800 mb-1 text-sm">Upload CSV File</h4>
                                    <p className="text-xs text-gray-500 mb-4 max-w-[200px]">Format: Name, Phone (2 columns, one per row)</p>
                                    
                                    <input 
                                        type="file" 
                                        accept=".csv" 
                                        className="hidden" 
                                        ref={fileInputRef}
                                        onChange={handleFileUpload}
                                    />
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-6 py-2 rounded-lg text-sm font-medium transition"
                                    >
                                        Browse Files
                                    </button>
                                </div>
                            </div>

                            {/* Custom Contacts List */}
                            <div className="flex-1 flex flex-col border border-gray-200 rounded-xl overflow-hidden">
                                <div className="bg-gray-100 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
                                    <h4 className="text-sm font-medium text-gray-700">Added Contacts ({customContacts.length})</h4>
                                    {customContacts.length > 0 && (
                                        <button onClick={() => setCustomContacts([])} className="text-xs text-red-600 hover:text-red-700 font-medium">
                                            Clear All
                                        </button>
                                    )}
                                </div>
                                <div className="flex-1 overflow-y-auto max-h-[300px] bg-white">
                                    {customContacts.length === 0 ? (
                                        <div className="p-8 text-center text-sm text-gray-500 flex flex-col items-center">
                                            <Users className="w-8 h-8 text-gray-300 mb-2" />
                                            No custom contacts added yet.
                                        </div>
                                    ) : (
                                        <ul className="divide-y divide-gray-100">
                                            {customContacts.map((contact) => (
                                                <li key={contact.id} className="p-3 flex justify-between items-center hover:bg-gray-50 transition">
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-800">{contact.name}</p>
                                                        <p className="text-xs text-gray-500">{contact.phone}</p>
                                                    </div>
                                                    <button 
                                                        onClick={() => handleRemoveCustomContact(contact.id)}
                                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>

                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
