import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  LayoutDashboard,
  Users,
  Activity,
  Sliders,
  FileText,
  Settings,
  UserPlus,
  PlusCircle,
  Sun,
  Moon,
  Languages,
  Radio,
  ArrowRight,
  X,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useApp } from '../context/AppContext';
import { mikrotikApi } from '../lib/apiClient';

export const CommandPalette: React.FC = () => {
  const {
    isCommandPaletteOpen,
    setCommandPaletteOpen,
    setActiveSection,
    mode,
    setMode,
    theme,
    toggleTheme,
    language,
    setLanguage,
    setInspectedUserId,
    setTriggerCreateUserModal,
    setTriggerCreateProfileModal,
  } = useApp();

  const [query, setQuery] = useState('');

  const { data: users = [] } = useQuery({
    queryKey: ['ppp-users', mode],
    queryFn: mikrotikApi.getUsers,
    enabled: isCommandPaletteOpen,
  });

  useEffect(() => {
    if (!isCommandPaletteOpen) setQuery('');
  }, [isCommandPaletteOpen]);

  const commands = useMemo(
    () => [
      {
        id: 'nav-dashboard',
        label: language === 'fa' ? 'رفتن به داشبورد' : 'Go to Dashboard',
        category: language === 'fa' ? 'ناوبری' : 'Navigation',
        icon: LayoutDashboard,
        action: () => setActiveSection('dashboard'),
      },
      {
        id: 'nav-users',
        label: language === 'fa' ? 'مدیریت کاربران PPP (/ppp/secret)' : 'Manage PPP Users (/ppp/secret)',
        category: language === 'fa' ? 'ناوبری' : 'Navigation',
        icon: Users,
        action: () => setActiveSection('users'),
      },
      {
        id: 'nav-sessions',
        label: language === 'fa' ? 'مشاهده نشست‌های فعال (/ppp/active)' : 'View Active Sessions (/ppp/active)',
        category: language === 'fa' ? 'ناوبری' : 'Navigation',
        icon: Activity,
        action: () => setActiveSection('sessions'),
      },
      {
        id: 'nav-profiles',
        label: language === 'fa' ? 'پروفایل‌های PPP (/ppp/profile)' : 'Manage PPP Profiles (/ppp/profile)',
        category: language === 'fa' ? 'ناوبری' : 'Navigation',
        icon: Sliders,
        action: () => setActiveSection('profiles'),
      },
      {
        id: 'nav-logs',
        label: language === 'fa' ? 'گزارش فعالیت‌های مدیران' : 'View Administrator Activity Logs',
        category: language === 'fa' ? 'ناوبری' : 'Navigation',
        icon: FileText,
        action: () => setActiveSection('logs'),
      },
      {
        id: 'nav-settings',
        label: language === 'fa' ? 'تنظیمات اتصال روتر میکروتیک' : 'Configure MikroTik Router Settings',
        category: language === 'fa' ? 'ناوبری' : 'Navigation',
        icon: Settings,
        action: () => setActiveSection('settings'),
      },
      {
        id: 'act-create-user',
        label: language === 'fa' ? 'ایجاد کاربر جدید PPP' : 'Create New PPP Secret',
        category: language === 'fa' ? 'عملیات سریع' : 'Quick Actions',
        icon: UserPlus,
        action: () => {
          setActiveSection('users');
          setTriggerCreateUserModal(true);
        },
      },
      {
        id: 'act-create-profile',
        label: language === 'fa' ? 'ایجاد پروفایل جدید PPP' : 'Create New PPP Profile',
        category: language === 'fa' ? 'عملیات سریع' : 'Quick Actions',
        icon: PlusCircle,
        action: () => {
          setActiveSection('profiles');
          setTriggerCreateProfileModal(true);
        },
      },
      {
        id: 'act-toggle-mode',
        label:
          mode === 'demo'
            ? language === 'fa'
              ? 'تغییر به حالت اتصال واقعی (Live RouterOS Mode)'
              : 'Switch to Live RouterOS Mode'
            : language === 'fa'
            ? 'تغییر به حالت آزمایشی (Demo Mode)'
            : 'Switch to Demo Mode',
        category: language === 'fa' ? 'محیط و نمایش' : 'Preferences',
        icon: Radio,
        action: () => setMode(mode === 'demo' ? 'live' : 'demo'),
      },
      {
        id: 'act-toggle-theme',
        label:
          theme === 'dark'
            ? language === 'fa'
              ? 'فعال‌سازی پوسته روشن (Light Theme)'
              : 'Switch to Light Theme'
            : language === 'fa'
            ? 'فعال‌سازی پوسته تیره (Dark Theme)'
            : 'Switch to Dark Theme',
        category: language === 'fa' ? 'محیط و نمایش' : 'Preferences',
        icon: theme === 'dark' ? Sun : Moon,
        action: () => toggleTheme(),
      },
      {
        id: 'act-toggle-lang',
        label:
          language === 'en'
            ? 'Switch Interface Language to Persian (فارسی - RTL)'
            : 'تغییر زبان برنامه به انگلیسی (English - LTR)',
        category: language === 'fa' ? 'محیط و نمایش' : 'Preferences',
        icon: Languages,
        action: () => setLanguage(language === 'en' ? 'fa' : 'en'),
      },
    ],
    [
      language,
      mode,
      theme,
      setActiveSection,
      setMode,
      toggleTheme,
      setLanguage,
      setTriggerCreateUserModal,
      setTriggerCreateProfileModal,
    ]
  );

  const filteredCommands = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) => c.label.toLowerCase().includes(q) || c.category.toLowerCase().includes(q)
    );
  }, [commands, query]);

  const matchingUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users.slice(0, 4);
    return users
      .filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.remoteAddress.toLowerCase().includes(q) ||
          (u.activeIp && u.activeIp.toLowerCase().includes(q)) ||
          u.profile.toLowerCase().includes(q)
      )
      .slice(0, 5);
  }, [users, query]);

  if (!isCommandPaletteOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-[#202321]/50 backdrop-blur-xs pt-20 px-4"
      onClick={() => setCommandPaletteOpen(false)}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-[#EDF0ED] dark:border-[#242926] bg-[#FFFFFF] dark:bg-[#181C19] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#EDF0ED] dark:border-[#242926]">
          <Search className="w-4 h-4 text-[#20C66B] shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              language === 'fa'
                ? 'جستجوی فرمان، بخش، نام کاربری PPP یا آی‌پی...'
                : 'Type a command or search PPP subscriber username / IP...'
            }
            className="w-full bg-transparent text-sm text-[#202321] dark:text-[#F2F4F2] placeholder-[#858B87] focus:outline-none"
          />
          <button
            onClick={() => setCommandPaletteOpen(false)}
            className="p-1 text-[#858B87] hover:text-[#202321] dark:hover:text-white rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-2.5 space-y-4">
          {filteredCommands.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-xs font-semibold text-[#858B87]">
                {language === 'fa' ? 'فرمان‌ها و صفحات' : 'Commands & Navigation'}
              </div>
              <div className="space-y-0.5">
                {filteredCommands.map((cmd) => {
                  const Icon = cmd.icon;
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => {
                        cmd.action();
                        setCommandPaletteOpen(false);
                      }}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2 text-xs font-medium text-[#202321] dark:text-[#F2F4F2] hover:bg-[#F5F6F5] dark:hover:bg-[#222724] rounded-xl transition-colors text-start cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className="w-4 h-4 text-[#20C66B] shrink-0" />
                        <span className="truncate">{cmd.label}</span>
                      </div>
                      <span className="text-[11px] text-[#858B87] shrink-0">{cmd.category}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {matchingUsers.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-xs font-semibold text-[#858B87]">
                {language === 'fa' ? 'مشترکین PPP (/ppp/secret)' : 'PPP Subscribers (/ppp/secret)'}
              </div>
              <div className="space-y-0.5">
                {matchingUsers.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => {
                      setInspectedUserId(u.id);
                      setCommandPaletteOpen(false);
                    }}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 text-xs text-[#202321] dark:text-[#F2F4F2] hover:bg-[#F5F6F5] dark:hover:bg-[#222724] rounded-xl transition-colors text-start cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono-tabular font-semibold text-[#202321] dark:text-[#F2F4F2] truncate">
                        {u.name}
                      </span>
                      <span className="text-[#858B87]">·</span>
                      <span className="text-[#858B87] truncate">{u.profile}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-mono-tabular text-[#858B87] shrink-0">
                      <span>{u.activeIp || u.remoteAddress || 'Dynamic'}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-[#20C66B]" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#EDF0ED] dark:border-[#242926] bg-[#F5F6F5] dark:bg-[#121513] text-xs text-[#858B87]">
          <span>
            {language === 'fa'
              ? 'کلید Esc برای بستن پنجره فرمان'
              : 'Press Esc to close command palette'}
          </span>
          <span className="font-mono-tabular">⌘K / Ctrl+K</span>
        </div>
      </div>
    </div>
  );
};
