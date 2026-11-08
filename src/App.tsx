/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  LayoutDashboard,
  Users,
  Activity,
  Sliders,
  FileText,
  Settings,
  Search,
  Sun,
  Moon,
  Languages,
  Bell,
  Lock,
  Menu,
  X,
  CheckCircle2,
  AlertCircle,
  Info,
  Router,
  ChevronDown,
} from 'lucide-react';
import { AppProvider, useApp, NavSection } from './context/AppContext';
import { mikrotikApi } from './lib/apiClient';
import { PppUser } from './types/mikrotik';
import { DashboardView } from './components/DashboardView';
import { UsersView } from './components/UsersView';
import { ProfilesView } from './components/ProfilesView';
import { SessionsView } from './components/SessionsView';
import { LogsView } from './components/LogsView';
import { SettingsView } from './components/SettingsView';
import { CommandPalette } from './components/CommandPalette';
import { UserDetailsDrawer } from './components/UserDetailsDrawer';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const MainWorkspace: React.FC = () => {
  const {
    activeSection,
    setActiveSection,
    mode,
    setMode,
    language,
    setLanguage,
    t,
    theme,
    toggleTheme,
    setCommandPaletteOpen,
    toasts,
    dismissToast,
    addToast,
  } = useApp();

  const rqClient = useQueryClient();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [externalEditUser, setExternalEditUser] = useState<PppUser | null>(null);

  // Admin Login Form State
  const [loginUsername, setLoginUsername] = useState('netops.admin');
  const [loginPassword, setLoginPassword] = useState('admin123');
  const [loginError, setLoginError] = useState('');

  const { data: session } = useQuery({
    queryKey: ['admin-session'],
    queryFn: mikrotikApi.getSession,
  });

  const { data: routerInfo } = useQuery({
    queryKey: ['router-info', mode],
    queryFn: mikrotikApi.getRouterInfo,
    refetchInterval: 15000,
    enabled: Boolean(session?.authenticated),
  });

  const { data: recentLogs = [] } = useQuery({
    queryKey: ['audit-logs', mode],
    queryFn: mikrotikApi.getAuditLogs,
    enabled: Boolean(session?.authenticated),
  });

  const loginMutation = useMutation({
    mutationFn: () => mikrotikApi.login(loginUsername, loginPassword),
    onSuccess: () => {
      setLoginError('');
      rqClient.invalidateQueries();
      addToast({
        type: 'success',
        title: 'Administrator Authenticated',
        description: `Welcome back, ${loginUsername}.`,
      });
    },
    onError: (err: Error) => {
      setLoginError(err.message);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: mikrotikApi.logout,
    onSuccess: () => {
      setAdminMenuOpen(false);
      rqClient.invalidateQueries({ queryKey: ['admin-session'] });
    },
  });

  const primaryNavItems: { id: NavSection; label: string; icon: React.ElementType }[] = [
    { id: 'dashboard', label: t.nav.dashboard, icon: LayoutDashboard },
    { id: 'users', label: t.nav.users, icon: Users },
    { id: 'sessions', label: t.nav.sessions, icon: Activity },
    { id: 'profiles', label: t.nav.profiles, icon: Sliders },
  ];

  const systemNavItems: { id: NavSection; label: string; icon: React.ElementType }[] = [
    { id: 'logs', label: t.nav.logs, icon: FileText },
    { id: 'settings', label: t.nav.settings, icon: Settings },
  ];

  const currentSectionTitle =
    [...primaryNavItems, ...systemNavItems].find((item) => item.id === activeSection)?.label ||
    t.nav.dashboard;

  // Lock Screen if administrator locks the session
  if (session && !session.authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F6F5] dark:bg-[#121513] p-4">
        <div className="w-full max-w-md rounded-2xl border border-[#EDF0ED] dark:border-[#242926] bg-[#FFFFFF] dark:bg-[#181C19] p-8 shadow-[0_8px_30px_rgba(32,35,33,0.06)] space-y-6">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-full bg-[#202321] flex items-center justify-center relative">
              <span className="w-4 h-4 rounded-full bg-[#20C66B]" />
              <span className="w-2 h-2 rounded-full bg-white absolute bottom-2.5 end-2.5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#202321] dark:text-[#F2F4F2]">
                {t.appTitle}
              </h1>
              <p className="text-xs text-[#858B87]">{t.appSubtitle}</p>
            </div>
          </div>

          {loginError && (
            <div className="p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/5 text-xs text-rose-600 dark:text-rose-400">
              {loginError}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              loginMutation.mutate();
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-medium text-[#202321] dark:text-[#D5DBD7] mb-1.5">
                Administrator Username
              </label>
              <input
                required
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm font-mono-tabular rounded-xl border border-[#EDF0ED] dark:border-[#2A302C] bg-[#F5F6F5] dark:bg-[#121513] text-[#202321] dark:text-[#F2F4F2] focus:outline-none focus:border-[#20C66B]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#202321] dark:text-[#D5DBD7] mb-1.5">
                Password (Default: admin123)
              </label>
              <input
                required
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#EDF0ED] dark:border-[#2A302C] bg-[#F5F6F5] dark:bg-[#121513] text-[#202321] dark:text-[#F2F4F2] focus:outline-none focus:border-[#20C66B]"
              />
            </div>

            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full py-2.5 px-4 rounded-full bg-[#20C66B] hover:bg-[#1AAF5E] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors duration-150 cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              {loginMutation.isPending ? 'Unlocking Console...' : 'Unlock Console'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#FFFFFF] dark:bg-[#121513] text-[#202321] dark:text-[#F2F4F2]">
      {/* Persistent Full-Height Minimalist Sidebar */}
      <aside className="hidden lg:flex w-60 shrink-0 sticky top-0 h-screen overflow-y-auto flex-col justify-between bg-[#FFFFFF] dark:bg-[#121513] px-5 py-6 z-30 select-none">
        <div className="space-y-7">
          {/* Brand Lockup inspired by reference */}
          <button
            onClick={() => setActiveSection('dashboard')}
            className="flex items-center gap-2.5 px-2 text-start group cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-[#202321] dark:bg-[#202321] flex items-center justify-center relative shrink-0">
              <span className="w-3.5 h-3.5 rounded-full bg-[#20C66B] -translate-x-0.5" />
              <span className="w-2 h-2 rounded-full bg-white translate-x-1 translate-y-0.5 absolute" />
            </div>
            <span className="text-base font-bold tracking-tight text-[#202321] dark:text-[#F2F4F2] truncate">
              {language === 'fa' ? 'میکروتیک PPP' : 'MikroTik PPP'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-[#858B87] shrink-0" />
          </button>

          {/* Primary Navigation */}
          <nav className="space-y-1">
            {primaryNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-[#20C66B] text-white font-semibold shadow-[0_6px_16px_rgba(32,198,107,0.22)]'
                      : 'text-[#858B87] hover:text-[#202321] dark:hover:text-[#F2F4F2] hover:bg-[#F5F6F5] dark:hover:bg-[#1C211E]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Secondary Group (System & Telemetry) */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between px-4 text-xs font-semibold text-[#202321] dark:text-[#D5DBD7]">
              <span>{language === 'fa' ? 'مدیریت سیستم' : 'Administration'}</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#858B87]" />
            </div>
            <nav className="space-y-1">
              {systemNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-[#20C66B] text-white font-semibold shadow-[0_6px_16px_rgba(32,198,107,0.22)]'
                        : 'text-[#858B87] hover:text-[#202321] dark:hover:text-[#F2F4F2] hover:bg-[#F5F6F5] dark:hover:bg-[#1C211E]'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Bottom Dark Card with Green Arc Motif (Matching Reference Bottom-Left Card) */}
        <div className="pt-4">
          <div className="relative overflow-hidden rounded-2xl bg-[#202321] text-white p-5 space-y-4">
            {/* Decorative Concentric Green Arcs SVG */}
            <svg
              className="w-full h-16 -mt-5 -mx-5 mb-1 pointer-events-none"
              viewBox="0 0 200 75"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="135" cy="-5" r="58" stroke="#20C66B" strokeWidth="14" />
              <circle
                cx="135"
                cy="-5"
                r="34"
                stroke="#20C66B"
                strokeWidth="12"
                strokeOpacity="0.85"
              />
            </svg>

            <div className="text-center space-y-1 relative z-10">
              <div className="text-xs font-semibold text-white truncate">
                {routerInfo?.identity || routerInfo?.routerDisplayName || 'BNG-TEHRAN-DC1'}
              </div>
              <p className="text-[11px] text-[#858B87] leading-relaxed">
                {mode === 'demo'
                  ? language === 'fa'
                    ? 'محیط آزمایشی فعال است. اتصال به روتر واقعی'
                    : 'Running in Demo Mode. Switch to Live RouterOS API'
                  : routerInfo?.connected
                  ? `RouterOS ${routerInfo.version}`
                  : language === 'fa'
                  ? 'روتر متصل نیست؛ بررسی تنظیمات'
                  : 'Router offline. Verify API-SSL link'}
              </p>
            </div>

            <button
              onClick={() => setMode(mode === 'demo' ? 'live' : 'demo')}
              className="w-full py-2 px-4 rounded-full bg-[#20C66B] hover:bg-[#1AAF5E] text-white text-xs font-semibold transition-colors duration-150 cursor-pointer relative z-10"
            >
              {mode === 'demo'
                ? language === 'fa'
                  ? 'اتصال واقعی (Live)'
                  : 'Switch to Live'
                : language === 'fa'
                ? 'حالت آزمایشی (Demo)'
                : 'Switch to Demo'}
            </button>
          </div>
        </div>
      </aside>

      {/* Right Column: Top Header + Inset Soft #F5F6F5 Bento Canvas */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#FFFFFF] dark:bg-[#121513]">
        {/* Minimalist Top Bar */}
        <header className="sticky top-0 z-20 h-18 bg-[#FFFFFF]/95 dark:bg-[#121513]/95 backdrop-blur-xs px-4 lg:px-8 flex items-center justify-between gap-4">
          {/* Left: Mobile Menu + Current Page Title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl text-[#858B87] hover:bg-[#F5F6F5] dark:hover:bg-[#1C211E]"
            >
              <Menu className="w-5 h-5" />
            </button>

            <h1 className="text-lg font-bold tracking-tight text-[#202321] dark:text-[#F2F4F2] truncate">
              {currentSectionTitle}
            </h1>

            <span className="hidden sm:inline-block text-[#EDF0ED] dark:text-[#2A302C]">|</span>

            <button
              onClick={() => setActiveSection('settings')}
              className="hidden sm:inline-flex items-center gap-1.5 text-xs text-[#858B87] hover:text-[#202321] dark:hover:text-[#F2F4F2] transition-colors cursor-pointer"
            >
              <span className="font-mono-tabular font-medium text-[#202321] dark:text-[#D5DBD7]">
                {routerInfo?.routerDisplayName || 'Core-BNG-CCR2116-01'}
              </span>
              <span>·</span>
              <span
                className={
                  routerInfo?.connected
                    ? 'text-[#20C66B] font-medium'
                    : 'text-rose-500 font-medium'
                }
              >
                {routerInfo?.connected ? t.topbar.connected : t.topbar.disconnected}
              </span>
            </button>
          </div>

          {/* Right: Search Trigger, Language, Theme, Notification Pill, Avatar Menu */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="hidden md:flex items-center justify-between gap-6 w-64 lg:w-72 px-3.5 py-2 rounded-full bg-[#F5F6F5] dark:bg-[#181C19] border border-[#EDF0ED] dark:border-[#242926] text-xs text-[#858B87] hover:border-[#20C66B]/40 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2 truncate">
                <Search className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{t.topbar.searchPlaceholder}</span>
              </span>
              <kbd className="font-mono-tabular text-[11px] text-[#858B87] shrink-0">⌘K</kbd>
            </button>

            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="md:hidden p-2 rounded-full bg-[#F5F6F5] dark:bg-[#181C19] text-[#202321] dark:text-[#F2F4F2]"
              title={t.topbar.commandPaletteHint}
            >
              <Search className="w-4 h-4" />
            </button>

            <button
              onClick={() => setLanguage(language === 'en' ? 'fa' : 'en')}
              className="px-3 py-1.5 rounded-full bg-[#F5F6F5] dark:bg-[#181C19] hover:bg-[#EDF0ED] dark:hover:bg-[#222724] text-xs font-medium text-[#202321] dark:text-[#F2F4F2] flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Languages className="w-3.5 h-3.5 text-[#20C66B]" />
              <span>{t.topbar.language}</span>
            </button>

            <button
              onClick={toggleTheme}
              className="p-2 rounded-full bg-[#F5F6F5] dark:bg-[#181C19] hover:bg-[#EDF0ED] dark:hover:bg-[#222724] text-[#202321] dark:text-[#F2F4F2] transition-colors cursor-pointer"
              title={theme === 'dark' ? t.topbar.themeLight : t.topbar.themeDark}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-[#20C66B]" />
              ) : (
                <Moon className="w-4 h-4 text-[#858B87]" />
              )}
            </button>

            {/* Notifications Counter Button (Matching Reference Top-Right Pill) */}
            <div className="relative">
              <button
                onClick={() => {
                  setNotifOpen(!notifOpen);
                  setAdminMenuOpen(false);
                }}
                className="px-3 py-1.5 rounded-full bg-[#F5F6F5] dark:bg-[#181C19] hover:bg-[#EDF0ED] dark:hover:bg-[#222724] text-xs font-semibold text-[#202321] dark:text-[#F2F4F2] flex items-center gap-1.5 transition-colors cursor-pointer"
                title={t.topbar.notifications}
              >
                <Bell className="w-3.5 h-3.5 text-[#858B87]" />
                <span className="font-mono-tabular">{recentLogs.length}</span>
              </button>

              {notifOpen && (
                <div className="absolute end-0 mt-2 w-80 rounded-2xl border border-[#EDF0ED] dark:border-[#242926] bg-[#FFFFFF] dark:bg-[#181C19] shadow-[0_10px_30px_rgba(32,35,33,0.08)] p-4 z-50 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[#EDF0ED] dark:border-[#242926]">
                    <span className="text-xs font-semibold text-[#202321] dark:text-[#F2F4F2]">
                      {t.topbar.notifications}
                    </span>
                    <button
                      onClick={() => {
                        setNotifOpen(false);
                        setActiveSection('logs');
                      }}
                      className="text-[11px] font-medium text-[#20C66B] hover:underline cursor-pointer"
                    >
                      {t.dashboard.viewAll}
                    </button>
                  </div>
                  <div className="divide-y divide-[#EDF0ED] dark:divide-[#242926] max-h-60 overflow-y-auto">
                    {recentLogs.slice(0, 4).map((l) => (
                      <div key={l.id} className="py-2.5 text-xs space-y-0.5">
                        <div className="font-mono-tabular font-semibold text-[#202321] dark:text-[#F2F4F2]">
                          {l.action} · {l.target}
                        </div>
                        <div className="text-[11px] text-[#858B87] truncate">{l.details}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Administrator Profile Avatar Button */}
            <div className="relative">
              <button
                onClick={() => {
                  setAdminMenuOpen(!adminMenuOpen);
                  setNotifOpen(false);
                }}
                className="w-9 h-9 rounded-full bg-[#202321] text-white text-xs font-bold flex items-center justify-center ring-2 ring-[#20C66B]/40 hover:ring-[#20C66B] transition-all cursor-pointer"
                title={session?.username || 'netops.admin'}
              >
                {(session?.username || 'N')[0].toUpperCase()}
              </button>

              {adminMenuOpen && (
                <div className="absolute end-0 mt-2 w-56 rounded-2xl border border-[#EDF0ED] dark:border-[#242926] bg-[#FFFFFF] dark:bg-[#181C19] shadow-[0_10px_30px_rgba(32,35,33,0.08)] p-3 z-50 space-y-2">
                  <div className="px-2.5 py-2 border-b border-[#EDF0ED] dark:border-[#242926]">
                    <div className="text-xs font-semibold font-mono-tabular text-[#202321] dark:text-[#F2F4F2]">
                      {session?.username || 'netops.admin'}
                    </div>
                    <div className="text-[11px] text-[#858B87]">
                      {session?.role || 'Administrator'}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setAdminMenuOpen(false);
                      setActiveSection('settings');
                    }}
                    className="w-full text-start px-2.5 py-2 rounded-xl text-xs text-[#202321] dark:text-[#F2F4F2] hover:bg-[#F5F6F5] dark:hover:bg-[#222724] flex items-center gap-2 cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5 text-[#858B87]" />
                    <span>{t.nav.settings}</span>
                  </button>
                  <button
                    onClick={() => logoutMutation.mutate()}
                    className="w-full text-start px-2.5 py-2 rounded-xl text-xs text-rose-600 hover:bg-rose-500/10 flex items-center gap-2 cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>{t.topbar.logout}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Soft #F5F6F5 Rounded Workspace Canvas */}
        <div className="flex-1 bg-[#F5F6F5] dark:bg-[#161A17] lg:rounded-ss-3xl lg:me-4 lg:mb-4 overflow-hidden flex flex-col">
          {/* Context Banner for Demo Mode or Disconnected Live Mode */}
          {mode === 'demo' ? (
            <div className="px-6 lg:px-8 py-2.5 bg-[#FFFFFF]/70 dark:bg-[#1C211E] border-b border-[#EDF0ED] dark:border-[#242926] flex flex-wrap items-center justify-between gap-2 text-xs text-[#858B87]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#20C66B] shrink-0" />
                <span>{t.topbar.demoBanner}</span>
              </div>
              <button
                onClick={() => {
                  setMode('live');
                  setActiveSection('settings');
                }}
                className="font-semibold text-[#202321] dark:text-[#F2F4F2] hover:text-[#20C66B] transition-colors cursor-pointer shrink-0"
              >
                Switch to Live RouterOS Mode →
              </button>
            </div>
          ) : (
            routerInfo &&
            !routerInfo.connected && (
              <div className="px-6 lg:px-8 py-2.5 bg-rose-500/10 border-b border-rose-500/20 flex flex-wrap items-center justify-between gap-2 text-xs text-rose-700 dark:text-rose-300">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{t.topbar.liveDisconnectedBanner}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => setActiveSection('settings')}
                    className="font-semibold underline cursor-pointer"
                  >
                    Open Router Settings
                  </button>
                  <span>·</span>
                  <button
                    onClick={() => setMode('demo')}
                    className="font-semibold underline cursor-pointer"
                  >
                    Use Demo Mode
                  </button>
                </div>
              </div>
            )
          )}

          {/* Main Bento Viewport */}
          <main className="flex-1 p-5 lg:p-8 max-w-[1440px] w-full mx-auto">
            {activeSection === 'dashboard' && <DashboardView />}
            {activeSection === 'users' && (
              <UsersView
                externalEditUser={externalEditUser}
                onClearExternalEditUser={() => setExternalEditUser(null)}
              />
            )}
            {activeSection === 'profiles' && <ProfilesView />}
            {activeSection === 'sessions' && <SessionsView />}
            {activeSection === 'logs' && <LogsView />}
            {activeSection === 'settings' && <SettingsView />}
          </main>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden bg-[#202321]/50 backdrop-blur-xs"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="w-64 h-screen overflow-y-auto bg-[#FFFFFF] dark:bg-[#121513] p-5 flex flex-col justify-between border-e border-[#EDF0ED] dark:border-[#242926]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-[#202321] flex items-center justify-center">
                    <Router className="w-3.5 h-3.5 text-[#20C66B]" />
                  </div>
                  <span className="font-bold text-sm text-[#202321] dark:text-[#F2F4F2]">
                    {t.appTitle}
                  </span>
                </div>
                <button onClick={() => setMobileMenuOpen(false)}>
                  <X className="w-5 h-5 text-[#858B87]" />
                </button>
              </div>
              <nav className="space-y-1">
                {[...primaryNavItems, ...systemNavItems].map((item) => {
                  const Icon = item.icon;
                  const isActive = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveSection(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-medium ${
                        isActive
                          ? 'bg-[#20C66B] text-white font-semibold'
                          : 'text-[#858B87] hover:bg-[#F5F6F5] dark:hover:bg-[#1C211E]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="pt-4">
              <div className="rounded-2xl bg-[#202321] text-white p-4 space-y-3">
                <div className="text-xs font-semibold truncate">
                  {routerInfo?.identity || 'BNG-TEHRAN-DC1'}
                </div>
                <button
                  onClick={() => setMode(mode === 'demo' ? 'live' : 'demo')}
                  className="w-full py-2 rounded-full bg-[#20C66B] text-white text-xs font-semibold"
                >
                  {mode === 'demo' ? 'Switch to Live' : 'Switch to Demo'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global Overlays */}
      <CommandPalette />
      <UserDetailsDrawer
        onEditUser={(user) => {
          setActiveSection('users');
          setExternalEditUser(user);
        }}
      />

      {/* Soft Minimal Toast Stack */}
      <div className="fixed bottom-5 end-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto p-4 rounded-2xl border border-[#EDF0ED] dark:border-[#242926] bg-[#FFFFFF] dark:bg-[#181C19] shadow-[0_8px_24px_rgba(32,35,33,0.08)] flex items-start justify-between gap-3"
          >
            <div className="flex items-start gap-2.5">
              {toast.type === 'success' && (
                <CheckCircle2 className="w-4 h-4 text-[#20C66B] shrink-0 mt-0.5" />
              )}
              {toast.type === 'error' && (
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              )}
              {toast.type === 'info' && (
                <Info className="w-4 h-4 text-[#20C66B] shrink-0 mt-0.5" />
              )}
              <div>
                <div className="text-xs font-semibold text-[#202321] dark:text-[#F2F4F2]">
                  {toast.title}
                </div>
                {toast.description && (
                  <div className="text-[11px] text-[#858B87] mt-0.5">{toast.description}</div>
                )}
              </div>
            </div>
            <button
              onClick={() => dismissToast(toast.id)}
              className="text-[#858B87] hover:text-[#202321] dark:hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <MainWorkspace />
      </AppProvider>
    </QueryClientProvider>
  );
}
