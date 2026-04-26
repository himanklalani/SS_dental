'use client';

import React, { useEffect, useState } from 'react';
import { getHealthStatus } from '../../lib/api';
import { Loader2, Activity, Database, MessageCircle, Server } from 'lucide-react';

export default function HealthcheckPage() {
  const [statusData, setStatusData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    setLoading(true);
    const data = await getHealthStatus();
    setStatusData({
      ...data,
      frontend: 'online'
    });
    setLoading(false);
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading && !statusData) {
    return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="animate-spin text-neutral-400" size={32} /></div>;
  }

  const services = [
    { name: 'Frontend Application', key: 'frontend', icon: Activity },
    { name: 'Backend API Server', key: 'status', icon: Server },
    { name: 'MongoDB Database', key: 'database', icon: Database },
    { name: 'WhatsApp Meta API', key: 'whatsapp', icon: MessageCircle },
  ];

  const getStatusColor = (status: string) => {
    if (['online', 'connected', 'configured'].includes(status)) return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
    if (['degraded', 'connecting'].includes(status)) return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    return 'text-red-500 bg-red-500/10 border-red-500/20';
  };

  const getStatusLabel = (status: string) => {
    if (status === 'missing_config') return 'MISSING CONFIG';
    return status.toUpperCase();
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-6">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white tracking-tight flex items-center gap-2">
            System Health
            {loading && <Loader2 className="animate-spin text-neutral-400 w-4 h-4 ml-2" />}
          </h1>
          <p className="text-neutral-500 mt-1 text-sm">Real-time status of critical infrastructure services.</p>
        </div>
        <div className="text-xs text-neutral-500">
          Last updated: {statusData?.timestamp ? new Date(statusData.timestamp).toLocaleTimeString() : 'Just now'}
        </div>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {services.map((service) => {
          const Icon = service.icon;
          const currentStatus = statusData ? statusData[service.key] : 'unknown';
          const style = getStatusColor(currentStatus);

          return (
            <div key={service.key} className="bg-white dark:bg-neutral-900 p-5 rounded border border-neutral-200 dark:border-neutral-800 flex items-center justify-between transition-all">
              <div className="flex items-center gap-4">
                <div className="p-2.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                  <Icon size={20} />
                </div>
                <div>
                  <h3 className="font-medium text-neutral-900 dark:text-white text-sm">{service.name}</h3>
                </div>
              </div>
              <div className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold border tracking-wider ${style}`}>
                {getStatusLabel(currentStatus)}
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="flex justify-end">
         <button onClick={fetchStatus} disabled={loading} className="px-4 py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white rounded text-sm font-medium transition-colors disabled:opacity-50">
           Refresh Status
         </button>
      </div>
    </div>
  );
}
