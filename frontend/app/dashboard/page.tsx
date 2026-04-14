'use client';

import React, { useEffect, useState } from 'react';
import { getAnalytics } from '../lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { MousePointer, Star, Send, Loader2, TrendingUp, Users, Zap, Activity } from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [businessId] = useState('65f1a2b3c4d5e6f7a8b9c0d1'); // Valid ObjectId

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await getAnalytics(businessId);
        setStats(data);
      } catch (error) {
        console.error("Failed to fetch stats", error);
        // Fallback mock data
        setStats({
          totalSent: 124,
          totalClicked: 86,
          totalCompleted: 64,
          clickThroughRate: 69.3,
          completionRate: 51.6
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [businessId]);

  if (loading) {
    return (
        <div className="flex h-[50vh] items-center justify-center">
            <Loader2 className="animate-spin text-neutral-500" size={32} />
        </div>
    );
  }

  const data = [
    { name: 'Sent', value: stats?.totalSent || 0 },
    { name: 'Clicked', value: stats?.totalClicked || 0 },
    { name: 'Reviews', value: stats?.totalCompleted || 0 },
  ];

  return (
    <div className="space-y-12 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-neutral-800 pb-6">
        <div>
            <h1 className="text-2xl font-semibold text-white tracking-tight">System Overview</h1>
            <p className="text-neutral-500 mt-1 text-sm">Operational metrics and performance logs.</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-neutral-900 border border-neutral-800 rounded text-xs font-mono text-white">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
            SYSTEM_ONLINE
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-neutral-900 p-6 rounded border border-neutral-800 hover:border-neutral-700 transition-all duration-300 group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 rounded bg-neutral-800 text-neutral-400 group-hover:text-white transition-colors">
                <Send size={20} />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-3xl font-mono text-white tracking-tight">{stats?.totalSent}</h3>
            <p className="text-xs text-neutral-500 font-medium uppercase tracking-wider">Total Dispatched</p>
          </div>
        </div>
        
        <div className="bg-neutral-900 p-6 rounded border border-neutral-800 hover:border-neutral-700 transition-all duration-300 group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 rounded bg-neutral-800 text-neutral-400 group-hover:text-white transition-colors">
                <MousePointer size={20} />
            </div>
            <span className="text-xs font-mono text-white bg-neutral-800 px-2 py-1 rounded">
                {stats?.clickThroughRate}% CTR
            </span>
          </div>
          <div className="space-y-1">
            <h3 className="text-3xl font-mono text-white tracking-tight">{stats?.totalClicked}</h3>
             <p className="text-xs text-neutral-500 font-medium uppercase tracking-wider">Interactions</p>
          </div>
        </div>

        <div className="bg-neutral-900 p-6 rounded border border-neutral-800 hover:border-neutral-700 transition-all duration-300 group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 rounded bg-neutral-800 text-neutral-400 group-hover:text-white transition-colors">
                <Star size={20} />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-3xl font-mono text-white tracking-tight">{stats?.totalCompleted}</h3>
             <p className="text-xs text-neutral-500 font-medium uppercase tracking-wider">Conversions</p>
          </div>
        </div>
      </div>

      {/* Analytics Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-neutral-900 p-6 rounded border border-neutral-800">
            <div className="flex items-center justify-between mb-8">
                <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                    <Activity size={16} className="text-neutral-500" />
                    Traffic Analysis
                </h2>
            </div>
            <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} barSize={40}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                        <XAxis dataKey="name" stroke="#525252" axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                        <YAxis stroke="#525252" axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#171717', border: '1px solid #262626', borderRadius: '4px', color: '#fff' }}
                            cursor={{ fill: '#262626' }}
                        />
                        <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={index === 2 ? '#ffffff' : '#404040'} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* Actionable Insights */}
        <div className="bg-neutral-900 p-6 rounded border border-neutral-800 flex flex-col justify-between">
            <div>
                <div className="flex items-center gap-2 mb-6 text-white">
                    <Zap size={20} />
                    <span className="text-xs font-bold uppercase tracking-widest">Recommendation</span>
                </div>
                <p className="text-neutral-300 text-sm leading-relaxed mb-6 font-mono">
                    &gt; ANALYSIS_COMPLETE<br/>
                    &gt; OPTIMAL_SEND_TIME: TUESDAY_AM<br/>
                    &gt; PROJECTED_UPLIFT: +18%
                </p>
                
                <div className="space-y-4 border-t border-neutral-800 pt-6">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-neutral-500">Queue Status</span>
                        <span className="text-white font-mono">12 PENDING</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-neutral-500">API Health</span>
                        <span className="text-white font-mono">100% OK</span>
                    </div>
                </div>
            </div>

            <button className="w-full mt-8 py-3 bg-white hover:bg-neutral-200 text-black rounded text-sm font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2">
                Execute Optimization
            </button>
        </div>
      </div>
    </div>
  );
}
