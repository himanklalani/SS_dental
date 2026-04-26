'use client';

import React, { useEffect, useState } from 'react';
import { getAnalytics } from '../lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { MousePointer, Send, Loader2, Activity } from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [businessId] = useState(process.env.NEXT_PUBLIC_BUSINESS_ID || '65f1a2b3c4d5e6f7a8b9c0d1');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await getAnalytics(businessId);
        setStats(data);
      } catch {
        setStats({ totalSent: 0, totalClicked: 0, clickThroughRate: 0 });
      } finally { setLoading(false); }
    };
    fetchStats();
  }, [businessId]);

  if (loading) return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="animate-spin text-neutral-400" size={32} /></div>;

  const data = [
    { name: 'Review Requests', value: stats?.totalSent || 0 },
    { name: 'Links Clicked', value: stats?.totalClicked || 0 },
  ];

  return (
    <div className="space-y-12 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-6">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white tracking-tight">System Overview</h1>
          <p className="text-neutral-500 mt-1 text-sm">Review engagement and click tracking.</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded text-xs font-mono text-neutral-800 dark:text-white">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          SYSTEM_ONLINE
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

      {/* Chart */}
      <div className="bg-white dark:bg-neutral-900 p-6 rounded border border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Activity size={16} className="text-neutral-400" />
            Engagement Analysis
          </h2>
        </div>
        <div className="h-[250px] w-full max-w-3xl">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barSize={60}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" className="dark:[&>line]:stroke-[#262626]" vertical={false} />
              <XAxis dataKey="name" stroke="#a3a3a3" axisLine={false} tickLine={false} tick={{fontSize: 12}} />
              <YAxis stroke="#a3a3a3" axisLine={false} tickLine={false} tick={{fontSize: 12}} />
              <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e5e5', borderRadius: '4px', color: '#171717' }} cursor={{ fill: '#f5f5f5' }} />
              <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index === 1 ? '#171717' : '#d4d4d4'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
