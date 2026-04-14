'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Settings, 
  ShieldCheck, 
  Menu, 
  X,
  LogOut,
  Box,
  User,
  Calendar,
  MessageSquare
} from 'lucide-react';

const Sidebar = () => {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Patients', href: '/dashboard/patients', icon: User },
    { name: 'Appointments', href: '/dashboard/appointments', icon: Calendar },
    { name: 'Configuration', href: '/dashboard/settings', icon: Settings },
    { name: 'Manual Trigger', href: '/dashboard/admin', icon: ShieldCheck },
  ];

  return (
    <>
      {/* Mobile Menu Button */}
      <div className="md:hidden fixed top-0 left-0 w-full bg-neutral-950/80 backdrop-blur-md z-50 px-4 py-3 border-b border-neutral-800 flex items-center justify-between transition-all duration-300">
        <div className="w-8 h-8 bg-white rounded flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.1)]">
            <Box size={20} className="text-black" />
        </div>
        <button onClick={() => setIsOpen(!isOpen)} className="text-neutral-400 hover:text-white transition-colors p-1">
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar Overlay (Mobile) */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <div className={`
        fixed top-0 left-0 h-full bg-neutral-900/95 backdrop-blur-xl z-50 w-64 transform transition-transform duration-300 ease-out border-r border-neutral-800
        ${isOpen ? 'translate-x-0 shadow-2xl shadow-black' : '-translate-x-full'}
        md:translate-x-0 md:static md:h-screen md:shadow-none md:bg-neutral-900
      `}>
        <div className="flex flex-col h-full">
          <div className="p-6 hidden md:flex items-center gap-3">
            <div className="w-8 h-8 bg-white rounded flex items-center justify-center shadow-lg shadow-white/5">
              <Box size={20} className="text-black" />
            </div>
          </div>

          <div className="mt-16 md:mt-6 flex-1 px-3 space-y-1">
            <div className="px-3 py-2 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              Toolbox
            </div>
            {menuItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link 
                  key={item.href} 
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded transition-all duration-200 group
                    ${isActive 
                      ? 'bg-neutral-800 text-white border-l-2 border-white' 
                      : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'}
                  `}
                >
                  <Icon size={18} className={isActive ? 'text-white' : 'text-neutral-500 group-hover:text-neutral-300'} />
                  <span className="font-medium text-sm">{item.name}</span>
                </Link>
              );
            })}
          </div>

          <div className="p-4 border-t border-neutral-800">
            <Link 
              href="/"
              className="flex items-center gap-3 px-3 py-2.5 text-neutral-500 hover:bg-neutral-800 hover:text-white rounded transition-colors group"
            >
              <LogOut size={18} className="group-hover:text-white transition-colors" />
              <span className="font-medium text-sm">Exit Tool</span>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
