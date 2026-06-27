'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { getAnalytics } from '../lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { MousePointer, Send, Loader2, Activity, RefreshCw, CalendarDays, CalendarCheck, TrendingUp, Users } from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [businessId] = useState(process.env.NEXT_PUBLIC_BUSINESS_ID || '69edf7401e9164e3fd73e073');

  const fetchStats = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const data = await getAnalytics(businessId);
      setStats(data);
    } catch {
      setStats({ totalSent: 0, totalClicked: 0, clickThroughRate: 0 });
    } finally { setLoading(false); setRefreshing(false); }
  }, [businessId]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  if (loading) return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="animate-spin text-neutral-400" size={32} /></div>;

  const data = [
    { name: 'Review Requests', value: stats?.totalSent || 0 },
    { name: 'Links Clicked', value: stats?.totalClicked || 0 },
  ];

  const seasonalData = stats?.advanced?.seasonalTrend?.map((s: any) => {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return { name: monthNames[s._id.month - 1], value: s.count };
  }) || [];

  const serviceData = stats?.advanced?.serviceBreakdown?.map((s: any) => ({ name: s._id, value: s.count })) || [];

  return (
    <div className="space-y-12 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-6">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white tracking-tight">System Overview</h1>
          <p className="text-neutral-500 mt-1 text-sm">Review engagement and click tracking.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => fetchStats(true)} disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-white bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded hover:border-neutral-400 dark:hover:border-neutral-600 transition-all disabled:opacity-50">
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          <div className="flex items-center gap-2 px-3 py-1 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded text-xs font-mono text-neutral-800 dark:text-white">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            SYSTEM_ONLINE
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[
          { icon: Send, label: 'Reviews Dispatched', value: stats?.totalSent, extra: null },
          { icon: MousePointer, label: 'Links Clicked', value: stats?.totalClicked, extra: `${stats?.clickThroughRate}% CTR` },
        ].map(({ icon: Icon, label, value, extra }) => (
          <div key={label} className="bg-white dark:bg-neutral-900 p-6 rounded border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 transition-all duration-300 group">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500 group-hover:text-neutral-900 dark:group-hover:text-white transition-colors">
                <Icon size={20} />
              </div>
              {extra && <span className="text-xs font-mono text-neutral-900 dark:text-white bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded">{extra}</span>}
            </div>
            <div className="space-y-1">
              <h3 className="text-3xl font-mono text-neutral-900 dark:text-white tracking-tight">{value}</h3>
              <p className="text-xs text-neutral-500 font-medium uppercase tracking-wider">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Advanced Analytics Header */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 pb-6 pt-8">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white tracking-tight">Advanced Analytics</h1>
        <p className="text-neutral-500 mt-1 text-sm">Appointment volume, seasonal trends, and VIP insights.</p>
      </div>

      {/* Advanced Volume Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { icon: Activity, label: 'Appointments Today', value: stats?.advanced?.appointmentsToday || 0 },
          { icon: CalendarDays, label: 'Appointments This Week', value: stats?.advanced?.appointmentsThisWeek || 0 },
          { icon: CalendarCheck, label: 'Appointments This Month', value: stats?.advanced?.appointmentsThisMonth || 0 },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="bg-white dark:bg-neutral-900 p-6 rounded border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 transition-all duration-300 group">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 rounded bg-neutral-100 dark:bg-neutral-800 text-blue-500 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 transition-colors">
                <Icon size={20} />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-3xl font-mono text-neutral-900 dark:text-white tracking-tight">{value}</h3>
              <p className="text-xs text-neutral-500 font-medium uppercase tracking-wider">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Seasonal Trend Chart */}
        <div className="bg-white dark:bg-neutral-900 p-6 rounded border border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <TrendingUp size={16} className="text-neutral-400" />
              Seasonal Trends (Slack Months)
            </h2>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={seasonalData} barSize={40}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" className="dark:[&>line]:stroke-[#262626]" vertical={false} />
                <XAxis dataKey="name" stroke="#a3a3a3" axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                <YAxis stroke="#a3a3a3" axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e5e5', borderRadius: '4px', color: '#171717' }} cursor={{ fill: '#f5f5f5' }} />
                <Bar dataKey="value" radius={[2, 2, 0, 0]} fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Service Popularity Chart */}
        <div className="bg-white dark:bg-neutral-900 p-6 rounded border border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Activity size={16} className="text-neutral-400" />
              Service Popularity
            </h2>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serviceData} barSize={40}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" className="dark:[&>line]:stroke-[#262626]" vertical={false} />
                <XAxis dataKey="name" stroke="#a3a3a3" axisLine={false} tickLine={false} tick={{fontSize: 10}} width={80} />
                <YAxis stroke="#a3a3a3" axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e5e5', borderRadius: '4px', color: '#171717' }} cursor={{ fill: '#f5f5f5' }} />
                <Bar dataKey="value" radius={[2, 2, 0, 0]} fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* VIP Patients Table */}
      <div className="bg-white dark:bg-neutral-900 rounded border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-800">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Users size={16} className="text-neutral-400" />
            Top / VIP Patients
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-neutral-500 uppercase font-medium">
              <tr>
                <th className="px-6 py-4">Patient Name</th>
                <th className="px-6 py-4">Phone Number</th>
                <th className="px-6 py-4">Total Visits</th>
                <th className="px-6 py-4">Last Visit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 text-neutral-900 dark:text-neutral-200">
              {stats?.advanced?.topPatients?.map((patient: any, idx: number) => (
                <tr key={idx} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                  <td className="px-6 py-4 font-medium">{patient.name || 'Unknown'}</td>
                  <td className="px-6 py-4 font-mono text-neutral-500">{patient.phone}</td>
                  <td className="px-6 py-4 font-bold text-emerald-600 dark:text-emerald-400">{patient.totalVisits} Appointments</td>
                  <td className="px-6 py-4 text-neutral-500">{new Date(patient.lastVisit).toLocaleDateString()}</td>
                </tr>
              ))}
              {(!stats?.advanced?.topPatients || stats.advanced.topPatients.length === 0) && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-neutral-500">No patient data available yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
