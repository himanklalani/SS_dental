import React from 'react';
import Sidebar from '../components/Sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-neutral-100 dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200 font-sans selection:bg-emerald-500/30 overflow-hidden">
      <Sidebar />
      <main className="flex-1 h-full w-full pt-16 md:pt-0 overflow-y-auto relative">
        <div className="p-4 md:p-12 max-w-7xl mx-auto min-h-full">
            {children}
        </div>
      </main>
    </div>
  );
}
