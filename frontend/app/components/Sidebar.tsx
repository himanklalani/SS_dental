'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Settings, ShieldCheck, Menu, X, Sun, Moon, Box, User, Calendar } from 'lucide-react';

const Sidebar = () => {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const menuItems = [
    { name: 'Dashboard',       href: '/dashboard',               icon: LayoutDashboard },
    { name: 'Patients',        href: '/dashboard/patients',       icon: User },
    { name: 'Appointments',    href: '/dashboard/appointments',   icon: Calendar },
    { name: 'Configuration',   href: '/dashboard/settings',       icon: Settings },
    { name: 'Manual Trigger',  href: '/dashboard/admin',          icon: ShieldCheck },
  ];

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 left-0 w-full bg-white/90 dark:bg-neutral-950/80 backdrop-blur-md z-50 px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
        <div className="w-8 h-8 bg-neutral-900 dark:bg-white rounded flex items-center justify-center">
          <Box size={20} className="text-white dark:text-black" />
        </div>
        <button onClick={() => setIsOpen(!isOpen)} className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors p-1">
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={`
        fixed top-0 left-0 h-full z-50 w-64 transform transition-transform duration-300 ease-out
        bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800
        ${isOpen ? 'translate-x-0 shadow-2xl shadow-black/20' : '-translate-x-full'}
        md:translate-x-0 md:static md:h-screen md:shadow-none
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 hidden md:flex items-center gap-3">
            <div className="w-8 h-8 bg-neutral-900 dark:bg-white rounded flex items-center justify-center">
              <Box size={20} className="text-white dark:text-black" />
            </div>
            <span className="font-bold text-sm text-neutral-900 dark:text-white tracking-widest uppercase">Clinic CRM</span>
          </div>

          {/* Nav Items */}
          <nav className="mt-16 md:mt-4 flex-1 px-3 space-y-1">
            <div className="px-3 py-2 text-xs font-semibold text-neutral-400 uppercase tracking-wider">Toolbox</div>
            {menuItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} onClick={() => setIsOpen(false)}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded transition-all duration-200 group
                    ${isActive
                      ? 'bg-neutral-900 dark:bg-neutral-800 text-white border-l-2 border-white dark:border-white'
                      : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white'}
                  `}
                >
                  <Icon size={18} className={isActive ? 'text-white' : 'text-neutral-400 group-hover:text-neutral-700 dark:group-hover:text-neutral-300'} />
                  <span className="font-medium text-sm">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Theme Toggle */}
          <div className="p-4 border-t border-neutral-200 dark:border-neutral-800">
            <button onClick={toggleTheme}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white rounded transition-colors group">
              {theme === 'dark' ? (
                <Sun size={18} className="text-neutral-400 group-hover:text-neutral-700 dark:group-hover:text-yellow-400 transition-colors" />
              ) : (
                <Moon size={18} className="text-neutral-400 group-hover:text-neutral-700 dark:group-hover:text-white transition-colors" />
              )}
              <span className="font-medium text-sm">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
