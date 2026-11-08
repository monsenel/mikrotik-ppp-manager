import React from 'react';
import {
  Users,
  Wifi,
  Sliders,
  UserPlus,
  PlusCircle,
  Settings,
  Server,
  Clock,
  ArrowRight,
  Info,
  Lock,
  AlertTriangle,
  Check,
  ShieldCheck,
  ShieldOff,
  WifiOff,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';
import { useApp } from '../context/AppContext';
import { mikrotikApi } from '../lib/apiClient';
import { formatBytes } from '../lib/utils';

export const DashboardView: React.FC = () => {
  const {
    mode,
    t,
    language,
    setActiveSection,
    setInspectedUserId,
    setTriggerCreateUserModal,
    setTriggerCreateProfileModal,
  } = useApp();

  const { data: summary, isLoading, error } = useQuery({
    queryKey: ['dashboard-summary', mode],
    queryFn: mikrotikApi.getDashboardSummary,
    refetchInterval: 15000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-8 space-y-6">
          <div className="h-40 rounded-2xl bg-[#FFFFFF] dark:bg-[#1C211E] animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="h-44 rounded-2xl bg-[#FFFFFF] dark:bg-[#1C211E] animate-pulse" />
            <div className="h-44 rounded-2xl bg-[#FFFFFF] dark:bg-[#1C211E] animate-pulse" />
            <div className="h-44 rounded-2xl bg-[#20C66B]/40 animate-pulse" />
          </div>
          <div className="h-64 rounded-2xl bg-[#FFFFFF] dark:bg-[#1C211E] animate-pulse" />
        </div>
        <div className="xl:col-span-4 space-y-6">
          <div className="h-80 rounded-2xl bg-[#FFFFFF] dark:bg-[#1C211E] animate-pulse" />
          <div className="h-64 rounded-2xl bg-[#FFFFFF] dark:bg-[#1C211E] animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="p-6 rounded-2xl border border-rose-500/20 bg-[#FFFFFF] dark:bg-[#1C211E] text-sm text-rose-600 dark:text-rose-400 flex items-center justify-between">
        <span>
          {error instanceof Error ? error.message : 'Unable to load RouterOS telemetry.'}
        </span>
        <button
          onClick={() => setActiveSection('settings')}
          className="px-4 py-2 rounded-full bg-[#20C66B] text-white text-xs font-semibold cursor-pointer"
        >
          Configure Router
        </button>
      </div>
    );
  }

  const distributionData = [
    {
      name: language === 'fa' ? 'آنلاین (Active)' : 'Online (Active)',
      count: summary.onlineUsers,
      color: '#20C66B',
    },
    {
      name: language === 'fa' ? 'آفلاین (مجاز)' : 'Offline (Enabled)',
      count: Math.max(0, summary.enabledUsers - summary.onlineUsers),
      color: '#202321',
    },
    {
      name: language === 'fa' ? 'غیرفعال (Disabled)' : 'Disabled Secrets',
      count: summary.disabledUsers,
      color: '#858B87',
    },
  ];

  const { routerInfo } = summary;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* Left / Main Bento Column (8 cols on XL) */}
      <div className="xl:col-span-8 space-y-6">
        {/* Top Row: Overview Greeting + Connected Subscribers Cluster Card */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
          {/* Greeting & Primary CTA Block */}
          <div className="md:col-span-7 flex flex-col justify-between py-2 space-y-4">
            <div className="space-y-1.5">
              <h2 className="text-2xl font-bold tracking-tight text-[#202321] dark:text-[#F2F4F2]">
                {t.dashboard.title}
              </h2>
              <p className="text-xs text-[#858B87] leading-relaxed max-w-md">
                {t.dashboard.subtitle}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                onClick={() => {
                  setActiveSection('users');
                  setTriggerCreateUserModal(true);
                }}
                className="px-5 py-2.5 rounded-full bg-[#20C66B] hover:bg-[#1AAF5E] text-white text-xs font-semibold flex items-center gap-2 shadow-[0_6px_16px_rgba(32,198,107,0.22)] transition-all duration-150 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{t.dashboard.quickCreateUser}</span>
              </button>

              <button
                onClick={() => {
                  setActiveSection('profiles');
                  setTriggerCreateProfileModal(true);
                }}
                className="px-4 py-2.5 rounded-full bg-[#FFFFFF] dark:bg-[#1C211E] border border-[#EDF0ED] dark:border-[#242926] hover:border-[#20C66B]/40 text-[#202321] dark:text-[#F2F4F2] text-xs font-medium flex items-center gap-2 transition-colors duration-150 cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5 text-[#20C66B]" />
                <span>{t.dashboard.quickCreateProfile}</span>
              </button>

              <button
                onClick={() => setActiveSection('settings')}
                className="px-4 py-2.5 rounded-full bg-[#FFFFFF] dark:bg-[#1C211E] border border-[#EDF0ED] dark:border-[#242926] hover:border-[#20C66B]/40 text-[#858B87] hover:text-[#202321] dark:hover:text-[#F2F4F2] text-xs font-medium flex items-center gap-1.5 transition-colors duration-150 cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>{t.dashboard.quickTestRouter}</span>
              </button>
            </div>
          </div>

          {/* Connected Subscribers Cluster Card (Inspired by Reference Top-Center Card) */}
          <div className="md:col-span-5 rounded-2xl bg-[#FFFFFF] dark:bg-[#1C211E] border border-[#EDF0ED] dark:border-[#242926] p-5 shadow-[0_2px_12px_rgba(32,35,33,0.03)] flex flex-col justify-between space-y-4">
            <div className="flex flex-wrap items-center gap-2.5">
              {summary.recentSessions.slice(0, 5).map((sess, idx) => {
                const bgClass =
                  idx % 2 === 0
                    ? 'bg-[#20C66B] text-white'
                    : 'bg-[#202321] text-white';
                return (
                  <button
                    key={sess.id}
                    onClick={() =>
                      sess.relatedSecretId && setInspectedUserId(sess.relatedSecretId)
                    }
                    title={`${sess.name} (${sess.address})`}
                    className={`w-10 h-10 rounded-full ${bgClass} text-xs font-bold font-mono-tabular flex items-center justify-center hover:scale-105 transition-transform cursor-pointer`}
                  >
                    {sess.name.slice(0, 2).toUpperCase()}
                  </button>
                );
              })}
              <button
                onClick={() => setActiveSection('sessions')}
                title={t.nav.sessions}
                className="w-10 h-10 rounded-full border border-[#EDF0ED] dark:border-[#2A302C] bg-[#F5F6F5] dark:bg-[#121513] text-[#858B87] hover:text-[#202321] dark:hover:text-white text-sm font-medium flex items-center justify-center transition-colors cursor-pointer"
              >
                +
              </button>
            </div>

            <div className="flex items-center justify-between text-xs text-[#858B87]">
              <span>
                <strong className="text-[#202321] dark:text-[#F2F4F2] font-mono-tabular">
                  +{summary.onlineUsers}
                </strong>{' '}
                {t.dashboard.onlineUsers}
              </span>
              <span className="font-mono-tabular text-[11px] text-[#20C66B]">
                /ppp/active
              </span>
            </div>
          </div>
        </div>

        {/* Insights Section Header */}
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-2.5">
              <h3 className="text-sm font-bold text-[#202321] dark:text-[#F2F4F2]">
                {language === 'fa' ? 'شاخص‌های کلیدی' : 'Insights'}
              </h3>
              <span className="text-xs text-[#858B87]">
                {routerInfo.identity} · {routerInfo.version}
              </span>
            </div>
            <button
              onClick={() => setActiveSection('users')}
              className="text-xs font-medium text-[#858B87] hover:text-[#202321] dark:hover:text-white cursor-pointer"
            >
              {t.dashboard.viewAll} →
            </button>
          </div>

          {/* 3 Primary Bento KPI Cards (Matching Reference Insights Cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Card 1: Total PPP Secrets */}
            <button
              onClick={() => setActiveSection('users')}
              className="text-start rounded-2xl bg-[#FFFFFF] dark:bg-[#1C211E] border border-[#EDF0ED] dark:border-[#242926] p-5 shadow-[0_2px_12px_rgba(32,35,33,0.03)] hover:border-[#20C66B]/40 transition-all duration-150 flex flex-col justify-between min-h-[164px] cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-[#202321] text-white flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
              <div className="space-y-1.5 pt-4">
                <div className="text-xs text-[#858B87] leading-snug">
                  {t.dashboard.totalUsers}
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-2xl font-bold font-mono-tabular text-[#202321] dark:text-[#F2F4F2]">
                    {summary.totalUsers}
                  </span>
                  <span className="text-[11px] font-mono-tabular font-semibold text-[#20C66B]">
                    {summary.enabledUsers} active
                  </span>
                </div>
              </div>
            </button>

            {/* Card 2: Configured PPP Profiles */}
            <button
              onClick={() => setActiveSection('profiles')}
              className="text-start rounded-2xl bg-[#FFFFFF] dark:bg-[#1C211E] border border-[#EDF0ED] dark:border-[#242926] p-5 shadow-[0_2px_12px_rgba(32,35,33,0.03)] hover:border-[#20C66B]/40 transition-all duration-150 flex flex-col justify-between min-h-[164px] cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-[#202321] text-white flex items-center justify-center">
                <Sliders className="w-4 h-4" />
              </div>
              <div className="space-y-1.5 pt-4">
                <div className="text-xs text-[#858B87] leading-snug">
                  {t.dashboard.totalProfiles}
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-2xl font-bold font-mono-tabular text-[#202321] dark:text-[#F2F4F2]">
                    {summary.totalProfiles}
                  </span>
                  <span className="text-[11px] font-mono-tabular font-semibold text-[#20C66B]">
                    /ppp/profile
                  </span>
                </div>
              </div>
            </button>

            {/* Card 3: Signature #20C66B Green Accent Card — Connected Sessions */}
            <button
              onClick={() => setActiveSection('sessions')}
              className="text-start rounded-2xl bg-[#20C66B] p-5 shadow-[0_8px_24px_rgba(32,198,107,0.24)] hover:bg-[#1AAF5E] transition-all duration-150 flex flex-col justify-between min-h-[164px] text-white cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-[#202321] text-white flex items-center justify-center">
                <Wifi className="w-4 h-4" />
              </div>
              <div className="space-y-1.5 pt-4">
                <div className="text-xs text-white/85 leading-snug">
                  {t.dashboard.onlineUsers}
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-2xl font-bold font-mono-tabular text-white">
                    {summary.onlineUsers}
                  </span>
                  <span className="text-[11px] font-mono-tabular font-semibold text-white/95">
                    {summary.offlineUsers} offline
                  </span>
                </div>
              </div>
            </button>
          </div>

          {/* Secondary Compact KPI Strip for Enabled / Disabled / Offline */}
          <div className="grid grid-cols-3 gap-4">
            <button
              onClick={() => setActiveSection('users')}
              className="rounded-2xl bg-[#FFFFFF] dark:bg-[#1C211E] border border-[#EDF0ED] dark:border-[#242926] px-4 py-3 flex items-center justify-between hover:border-[#20C66B]/40 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <ShieldCheck className="w-4 h-4 text-[#20C66B] shrink-0" />
                <span className="text-xs text-[#858B87] truncate">{t.dashboard.enabledUsers}</span>
              </div>
              <span className="text-sm font-bold font-mono-tabular text-[#202321] dark:text-[#F2F4F2]">
                {summary.enabledUsers}
              </span>
            </button>

            <button
              onClick={() => setActiveSection('users')}
              className="rounded-2xl bg-[#FFFFFF] dark:bg-[#1C211E] border border-[#EDF0ED] dark:border-[#242926] px-4 py-3 flex items-center justify-between hover:border-[#20C66B]/40 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <ShieldOff className="w-4 h-4 text-rose-500 shrink-0" />
                <span className="text-xs text-[#858B87] truncate">{t.dashboard.disabledUsers}</span>
              </div>
              <span className="text-sm font-bold font-mono-tabular text-[#202321] dark:text-[#F2F4F2]">
                {summary.disabledUsers}
              </span>
            </button>

            <button
              onClick={() => setActiveSection('users')}
              className="rounded-2xl bg-[#FFFFFF] dark:bg-[#1C211E] border border-[#EDF0ED] dark:border-[#242926] px-4 py-3 flex items-center justify-between hover:border-[#20C66B]/40 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <WifiOff className="w-4 h-4 text-[#858B87] shrink-0" />
                <span className="text-xs text-[#858B87] truncate">{t.dashboard.offlineUsers}</span>
              </div>
              <span className="text-sm font-bold font-mono-tabular text-[#202321] dark:text-[#F2F4F2]">
                {summary.offlineUsers}
              </span>
            </button>
          </div>
        </div>

        {/* Subscriber Distribution & Protocol Breakdown Bento Card */}
        <div className="rounded-2xl bg-[#FFFFFF] dark:bg-[#1C211E] border border-[#EDF0ED] dark:border-[#242926] p-6 shadow-[0_2px_12px_rgba(32,35,33,0.03)] space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-[#202321] dark:text-[#F2F4F2]">
                {t.dashboard.distributionTitle}
              </h3>
              <p className="text-xs text-[#858B87] mt-0.5">
                {t.dashboard.distributionSubtitle}
              </p>
            </div>
            <span className="text-xs font-mono-tabular text-[#858B87]">
              {summary.onlineUsers} / {summary.totalUsers} Active
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-center">
            <div className="md:col-span-3 h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={distributionData}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                >
                  <XAxis type="number" allowDecimals={false} stroke="#858B87" fontSize={11} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={125}
                    stroke="#858B87"
                    fontSize={11}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(32, 198, 107, 0.06)' }}
                    contentStyle={{
                      backgroundColor: '#202321',
                      borderColor: '#202321',
                      borderRadius: '12px',
                      color: '#FFFFFF',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 8, 8, 0]} barSize={22}>
                    {distributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="md:col-span-2 space-y-3 border-t md:border-t-0 md:border-s border-[#EDF0ED] dark:border-[#242926] pt-4 md:pt-0 md:ps-6">
              <div className="text-xs font-semibold text-[#858B87]">
                {language === 'fa' ? 'تفکیک پروتکل‌های سرویس' : 'Protocol Breakdown'}
              </div>
              <div className="space-y-2.5">
                {summary.serviceBreakdown.map((srv) => (
                  <div key={srv.service} className="flex items-center justify-between text-xs">
                    <span className="font-mono-tabular font-semibold text-[#202321] dark:text-[#F2F4F2]">
                      {srv.service}
                    </span>
                    <div className="flex items-center gap-2 font-mono-tabular text-[#858B87]">
                      <span className="text-[#20C66B] font-semibold">
                        {srv.online} online
                      </span>
                      <span>·</span>
                      <span>{srv.total} total</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[#EDF0ED] dark:border-[#242926] flex items-center gap-2 text-[11px] text-[#858B87]">
            <Info className="w-3.5 h-3.5 text-[#20C66B] shrink-0" />
            <span>{t.dashboard.historicalNotice}</span>
          </div>
        </div>

        {/* Recent Administrator Actions Card (Styled like Reference Bottom "Messages" Feed) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#202321] dark:text-[#F2F4F2]">
              {t.dashboard.recentActionsTitle}
            </h3>
            <button
              onClick={() => setActiveSection('logs')}
              className="text-xs font-medium text-[#858B87] hover:text-[#202321] dark:hover:text-white cursor-pointer"
            >
              {t.dashboard.viewAll} →
            </button>
          </div>

          <div className="rounded-2xl bg-[#FFFFFF] dark:bg-[#1C211E] border border-[#EDF0ED] dark:border-[#242926] p-5 shadow-[0_2px_12px_rgba(32,35,33,0.03)] divide-y divide-[#EDF0ED] dark:divide-[#242926]">
            {summary.recentActions.slice(0, 4).map((log, idx) => (
              <div
                key={log.id}
                className="py-3.5 first:pt-0 last:pb-0 flex items-start justify-between gap-4"
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-xs font-bold font-mono-tabular text-white ${
                      idx % 2 === 0 ? 'bg-[#202321]' : 'bg-[#20C66B]'
                    }`}
                  >
                    {log.administrator.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-[#202321] dark:text-[#F2F4F2] font-mono-tabular">
                        {log.target}
                      </span>
                      <span className="text-[11px] text-[#858B87]">
                        {new Date(log.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span className="w-1.5 h-1.5 rounded-full bg-[#20C66B]" />
                    </div>
                    <p className="text-xs text-[#858B87] truncate">{log.details}</p>
                  </div>
                </div>
                <span className="text-[11px] font-mono-tabular text-[#858B87] shrink-0">
                  {log.action}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Bento Column (4 cols on XL) */}
      <div className="xl:col-span-4 space-y-6">
        {/* RouterOS Hardware & Telemetry Card (Matching Reference Right-Top Card) */}
        <div className="rounded-2xl bg-[#FFFFFF] dark:bg-[#1C211E] border border-[#EDF0ED] dark:border-[#242926] p-6 shadow-[0_2px_12px_rgba(32,35,33,0.03)] space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#202321] dark:text-[#F2F4F2]">
                {t.dashboard.routerWidgetTitle}
              </h3>
              <p className="text-xs text-[#858B87] font-mono-tabular mt-0.5">
                {routerInfo.identity}
              </p>
            </div>
            <div className="w-9 h-9 rounded-full bg-[#F5F6F5] dark:bg-[#121513] flex items-center justify-center">
              <Server className="w-4 h-4 text-[#20C66B]" />
            </div>
          </div>

          {/* Hardware Telemetry Matrix Grid */}
          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="p-3 rounded-xl bg-[#F5F6F5] dark:bg-[#121513] space-y-1">
              <span className="text-[11px] text-[#858B87] block">{t.dashboard.version}</span>
              <span className="font-mono-tabular font-bold text-[#202321] dark:text-[#F2F4F2]">
                {routerInfo.version}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[#F5F6F5] dark:bg-[#121513] space-y-1">
              <span className="text-[11px] text-[#858B87] block">{t.dashboard.cpuLoad}</span>
              <span className="font-mono-tabular font-bold text-[#20C66B]">
                {routerInfo.cpuLoad}% Load
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[#F5F6F5] dark:bg-[#121513] space-y-1">
              <span className="text-[11px] text-[#858B87] block">{t.dashboard.uptime}</span>
              <span className="font-mono-tabular font-semibold text-[#202321] dark:text-[#F2F4F2]">
                {routerInfo.uptime}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[#F5F6F5] dark:bg-[#121513] space-y-1">
              <span className="text-[11px] text-[#858B87] block">{t.dashboard.memoryFree}</span>
              <span className="font-mono-tabular font-semibold text-[#202321] dark:text-[#F2F4F2]">
                {formatBytes(routerInfo.freeMemoryBytes)}
              </span>
            </div>
          </div>

          <div className="divide-y divide-[#EDF0ED] dark:divide-[#242926] text-xs">
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-[#858B87]">{t.dashboard.board}</span>
              <span className="font-mono-tabular font-medium text-[#202321] dark:text-[#F2F4F2]">
                {routerInfo.boardName} ({routerInfo.architectureName})
              </span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-[#858B87]">{t.dashboard.endpoint}</span>
              <span className="font-mono-tabular text-[#202321] dark:text-[#F2F4F2]">
                {routerInfo.host || '10.254.0.1'}:{routerInfo.port}
              </span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-[#858B87]">{t.dashboard.tlsSecurity}</span>
              <span className="font-mono-tabular flex items-center gap-1.5 text-[#202321] dark:text-[#F2F4F2]">
                {routerInfo.tlsEnabled ? (
                  <>
                    <Lock className="w-3.5 h-3.5 text-[#20C66B]" />
                    <span>{t.dashboard.tlsVerified}</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    <span>{t.dashboard.cleartextWarning}</span>
                  </>
                )}
              </span>
            </div>
          </div>

          <div className="pt-1 flex items-center gap-2 text-xs font-semibold text-[#202321] dark:text-[#F2F4F2]">
            <span className="w-2 h-2 rounded-full bg-[#20C66B]" />
            <span>
              {routerInfo.connected ? t.topbar.connected : t.topbar.disconnected} ·{' '}
              {routerInfo.mode.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Top Active Sessions Stack (Styled like Reference Bottom-Right "To-Do List" Cards) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#202321] dark:text-[#F2F4F2]">
              {t.dashboard.topUptimeTitle}
            </h3>
            <button
              onClick={() => setActiveSection('sessions')}
              className="px-3 py-1 rounded-full bg-[#FFFFFF] dark:bg-[#1C211E] border border-[#EDF0ED] dark:border-[#242926] text-[11px] font-semibold text-[#202321] dark:text-[#F2F4F2] hover:border-[#20C66B] transition-colors cursor-pointer"
            >
              {t.dashboard.viewAll}
            </button>
          </div>

          <div className="space-y-2.5">
            {summary.topSessionsByUptime.length === 0 ? (
              <div className="p-6 rounded-2xl bg-[#FFFFFF] dark:bg-[#1C211E] border border-[#EDF0ED] dark:border-[#242926] text-center text-xs text-[#858B87]">
                No active sessions in /ppp/active
              </div>
            ) : (
              summary.topSessionsByUptime.slice(0, 4).map((sess, index) => {
                if (index === 0) {
                  // Primary #20C66B Highlighted Session Row
                  return (
                    <button
                      key={sess.id}
                      onClick={() =>
                        sess.relatedSecretId && setInspectedUserId(sess.relatedSecretId)
                      }
                      className="w-full p-4 rounded-2xl bg-[#20C66B] hover:bg-[#1AAF5E] text-white shadow-[0_6px_16px_rgba(32,198,107,0.20)] flex items-center justify-between gap-3 transition-colors text-start cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold font-mono-tabular truncate">
                          {sess.name}
                        </div>
                        <div className="text-[11px] text-white/85 font-mono-tabular mt-0.5">
                          {sess.address} · {sess.uptime}
                        </div>
                      </div>
                      <div className="w-6 h-6 rounded-full bg-white text-[#20C66B] flex items-center justify-center shrink-0">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    </button>
                  );
                }

                return (
                  <button
                    key={sess.id}
                    onClick={() =>
                      sess.relatedSecretId && setInspectedUserId(sess.relatedSecretId)
                    }
                    className="w-full p-4 rounded-2xl bg-[#FFFFFF] dark:bg-[#1C211E] border border-[#EDF0ED] dark:border-[#242926] hover:border-[#20C66B]/40 flex items-center justify-between gap-3 transition-colors text-start cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold font-mono-tabular text-[#202321] dark:text-[#F2F4F2] truncate">
                        {sess.name}
                      </div>
                      <div className="text-[11px] text-[#858B87] font-mono-tabular mt-0.5 flex items-center gap-1.5">
                        <span>{sess.address}</span>
                        <span>·</span>
                        <Clock className="w-3 h-3 text-[#20C66B]" />
                        <span>{sess.uptime}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="w-6 h-6 rounded-full bg-[#202321] text-white text-[10px] font-mono-tabular flex items-center justify-center uppercase">
                        {sess.service.slice(0, 2)}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-[#858B87]" />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
