import React from 'react';
import Sidebar from '../components/Sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-neutral-950 text-neutral-200 font-sans selection:bg-emerald-500/30">
      <Sidebar />
      <main className="flex-1 w-full pt-16 md:pt-0 overflow-y-auto">
        <div className="p-4 md:p-12 max-w-7xl mx-auto min-h-screen">
            {children}
        </div>
      </main>
    </div>
  );
}
