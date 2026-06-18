import React from 'react';
import Sidebar from '../components/Sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-neutral-100 dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200 font-sans selection:bg-emerald-500/30">
      {/* Sidebar: fixed height, scrollable internally on overflow */}
      <div className="hidden md:flex flex-col flex-shrink-0 w-64 h-full overflow-y-auto border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <Sidebar />
      </div>
      {/* Mobile: sidebar is self-managed (fixed overlay), no wrapper needed */}
      <div className="md:hidden">
        <Sidebar />
      </div>
      {/* Main content area: scrolls independently */}
      <main className="flex-1 h-full pt-14 md:pt-0 overflow-y-auto">
        <div className="p-4 md:p-10 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
