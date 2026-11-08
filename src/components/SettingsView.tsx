import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Server,
  ShieldCheck,
  Lock,
  CheckCircle2,
  AlertCircle,
  Save,
  Radio,
  KeyRound,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { mikrotikApi } from '../lib/apiClient';
import { RouterConnectionConfigDto, RouterInfoDto } from '../types/mikrotik';

export const SettingsView: React.FC = () => {
  const { mode, setMode, t, addToast } = useApp();
  const queryClient = useQueryClient();

  const { data: savedConfig } = useQuery({
    queryKey: ['router-config'],
    queryFn: mikrotikApi.getRouterConfig,
  });

  const { data: routerInfo, refetch: refetchInfo } = useQuery({
    queryKey: ['router-info', mode],
    queryFn: mikrotikApi.getRouterInfo,
  });

  const [formState, setFormState] = useState<RouterConnectionConfigDto>({
    routerDisplayName: 'Core-BNG-CCR2116-01',
    host: '',
    port: 8729,
    username: 'ppp-api-admin',
    password: '',
    tlsEnabled: true,
    validateCertificate: true,
    timeoutMs: 8000,
  });

  const [lastTestResult, setLastTestResult] = useState<RouterInfoDto | null>(null);

  useEffect(() => {
    if (savedConfig) {
      setFormState((prev) => ({
        ...prev,
        routerDisplayName: savedConfig.routerDisplayName,
        host: savedConfig.host,
        port: savedConfig.port || 8729,
        username: savedConfig.username,
        password: '', // Never populate stored password
        tlsEnabled: savedConfig.tlsEnabled,
        validateCertificate: savedConfig.validateCertificate,
        timeoutMs: savedConfig.timeoutMs || 8000,
      }));
    }
  }, [savedConfig]);

  const testMutation = useMutation({
    mutationFn: (dto: RouterConnectionConfigDto) => mikrotikApi.testRouterConnection(dto),
    onSuccess: (info) => {
      setLastTestResult(info);
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      if (info.connected) {
        addToast({
          type: 'success',
          title: 'RouterOS Handshake Succeeded',
          description: `Connected to ${info.identity} running RouterOS ${info.version}.`,
        });
      } else {
        addToast({
          type: 'error',
          title: 'RouterOS Connection Failed',
          description: info.errorMessage || 'Could not reach RouterOS API endpoint.',
        });
      }
    },
    onError: (err: Error) => {
      addToast({ type: 'error', title: 'Test Error', description: err.message });
    },
  });

  const saveMutation = useMutation({
    mutationFn: (dto: RouterConnectionConfigDto) => mikrotikApi.updateRouterConfig(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['router-config'] });
      queryClient.invalidateQueries({ queryKey: ['router-info'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      refetchInfo();
      setFormState((prev) => ({ ...prev, password: '' }));
      addToast({
        type: 'success',
        title: 'Router Configuration Saved',
        description: 'Credentials stored securely in backend memory.',
      });
    },
    onError: (err: Error) => {
      addToast({ type: 'error', title: 'Save Failed', description: err.message });
    },
  });

  const displayInfo = lastTestResult || routerInfo;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#202321] dark:text-[#F2F4F2]">
            {t.settings.title}
          </h2>
          <p className="text-xs text-[#858B87] mt-0.5">{t.settings.subtitle}</p>
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center gap-1 p-1 rounded-full border border-[#EDF0ED] dark:border-[#242926] bg-[#FFFFFF] dark:bg-[#1C211E] self-start sm:self-auto">
          <button
            onClick={() => setMode('demo')}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
              mode === 'demo'
                ? 'bg-[#202321] text-white font-semibold'
                : 'text-[#858B87] hover:text-[#202321] dark:hover:text-white'
            }`}
          >
            {t.topbar.demoMode}
          </button>
          <button
            onClick={() => setMode('live')}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
              mode === 'live'
                ? 'bg-[#20C66B] text-white font-semibold'
                : 'text-[#858B87] hover:text-[#202321] dark:hover:text-white'
            }`}
          >
            {t.topbar.liveMode}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Configuration Form Bento Card */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate(formState);
          }}
          className="lg:col-span-2 rounded-2xl border border-[#EDF0ED] dark:border-[#242926] bg-[#FFFFFF] dark:bg-[#1C211E] shadow-[0_2px_12px_rgba(32,35,33,0.03)] p-6 space-y-5"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#202321] dark:text-[#D5DBD7] mb-1.5">
                {t.settings.displayName} *
              </label>
              <input
                required
                value={formState.routerDisplayName}
                onChange={(e) =>
                  setFormState({ ...formState, routerDisplayName: e.target.value })
                }
                placeholder="e.g. Core-BNG-CCR2116-01"
                className="w-full px-3.5 py-2 text-sm font-mono-tabular rounded-xl border border-[#EDF0ED] dark:border-[#2A302C] bg-[#F5F6F5] dark:bg-[#121513] text-[#202321] dark:text-[#F2F4F2] focus:outline-none focus:border-[#20C66B]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#202321] dark:text-[#D5DBD7] mb-1.5">
                {t.settings.host}
              </label>
              <input
                value={formState.host}
                onChange={(e) => setFormState({ ...formState, host: e.target.value })}
                placeholder="e.g. 192.168.88.1 or bng.isp.example.com"
                className="w-full px-3.5 py-2 text-sm font-mono-tabular rounded-xl border border-[#EDF0ED] dark:border-[#2A302C] bg-[#F5F6F5] dark:bg-[#121513] text-[#202321] dark:text-[#F2F4F2] focus:outline-none focus:border-[#20C66B]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#202321] dark:text-[#D5DBD7] mb-1.5">
                {t.settings.port}
              </label>
              <input
                type="number"
                min={1}
                max={65535}
                value={formState.port}
                onChange={(e) =>
                  setFormState({ ...formState, port: Number(e.target.value) })
                }
                className="w-full px-3.5 py-2 text-sm font-mono-tabular rounded-xl border border-[#EDF0ED] dark:border-[#2A302C] bg-[#F5F6F5] dark:bg-[#121513] text-[#202321] dark:text-[#F2F4F2] focus:outline-none focus:border-[#20C66B]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#202321] dark:text-[#D5DBD7] mb-1.5">
                {t.settings.timeoutMs}
              </label>
              <input
                type="number"
                min={1000}
                max={30000}
                step={500}
                value={formState.timeoutMs}
                onChange={(e) =>
                  setFormState({ ...formState, timeoutMs: Number(e.target.value) })
                }
                className="w-full px-3.5 py-2 text-sm font-mono-tabular rounded-xl border border-[#EDF0ED] dark:border-[#2A302C] bg-[#F5F6F5] dark:bg-[#121513] text-[#202321] dark:text-[#F2F4F2] focus:outline-none focus:border-[#20C66B]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#202321] dark:text-[#D5DBD7] mb-1.5">
                {t.settings.username} *
              </label>
              <input
                required
                value={formState.username}
                onChange={(e) =>
                  setFormState({ ...formState, username: e.target.value })
                }
                placeholder="e.g. ppp-api-admin"
                className="w-full px-3.5 py-2 text-sm font-mono-tabular rounded-xl border border-[#EDF0ED] dark:border-[#2A302C] bg-[#F5F6F5] dark:bg-[#121513] text-[#202321] dark:text-[#F2F4F2] focus:outline-none focus:border-[#20C66B]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#202321] dark:text-[#D5DBD7] mb-1.5">
                <span className="inline-flex items-center gap-1">
                  <KeyRound className="w-3.5 h-3.5 text-[#20C66B]" />
                  {t.settings.password}
                </span>
              </label>
              <input
                type="password"
                autoComplete="new-password"
                value={formState.password}
                onChange={(e) =>
                  setFormState({ ...formState, password: e.target.value })
                }
                placeholder={
                  savedConfig?.hasPasswordConfigured
                    ? '•••••••• (Stored securely on backend)'
                    : t.settings.passwordPlaceholder
                }
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-[#EDF0ED] dark:border-[#2A302C] bg-[#F5F6F5] dark:bg-[#121513] text-[#202321] dark:text-[#F2F4F2] focus:outline-none focus:border-[#20C66B]"
              />
            </div>
          </div>

          {/* TLS & Certificate Controls */}
          <div className="p-4 rounded-2xl border border-[#EDF0ED] dark:border-[#242926] bg-[#F5F6F5] dark:bg-[#121513] space-y-3">
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <div className="flex items-center gap-2.5">
                <Lock className="w-4 h-4 text-[#20C66B] shrink-0" />
                <span className="text-xs font-semibold text-[#202321] dark:text-[#F2F4F2]">
                  {t.settings.tlsEnabled}
                </span>
              </div>
              <input
                type="checkbox"
                checked={formState.tlsEnabled}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  setFormState({
                    ...formState,
                    tlsEnabled: enabled,
                    port:
                      enabled && formState.port === 8728
                        ? 8729
                        : !enabled && formState.port === 8729
                        ? 8728
                        : formState.port,
                  });
                }}
                className="rounded border-[#EDF0ED] accent-[#20C66B]"
              />
            </label>

            {formState.tlsEnabled && (
              <label className="flex items-center justify-between gap-3 pt-2.5 border-t border-[#EDF0ED] dark:border-[#242926] cursor-pointer">
                <span className="text-xs text-[#858B87]">
                  {t.settings.validateCert}
                </span>
                <input
                  type="checkbox"
                  checked={formState.validateCertificate}
                  onChange={(e) =>
                    setFormState({
                      ...formState,
                      validateCertificate: e.target.checked,
                    })
                  }
                  className="rounded border-[#EDF0ED] accent-[#20C66B]"
                />
              </label>
            )}
          </div>

          {/* Actions */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => testMutation.mutate(formState)}
              disabled={testMutation.isPending}
              className="px-4 py-2.5 rounded-full border border-[#EDF0ED] dark:border-[#2A302C] bg-[#FFFFFF] dark:bg-[#181C19] hover:border-[#20C66B] text-xs font-semibold text-[#202321] dark:text-[#F2F4F2] flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Radio className="w-4 h-4 text-[#20C66B]" />
              {testMutation.isPending ? 'Testing Handshake...' : t.settings.testConnection}
            </button>

            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="px-5 py-2.5 rounded-full bg-[#20C66B] hover:bg-[#1AAF5E] text-white text-xs font-semibold flex items-center gap-2 shadow-[0_6px_16px_rgba(32,198,107,0.22)] transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {saveMutation.isPending ? 'Saving...' : t.settings.saveConfig}
            </button>
          </div>
        </form>

        {/* Right Column: Live Connection Telemetry & Security Architecture */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-[#EDF0ED] dark:border-[#242926] bg-[#FFFFFF] dark:bg-[#1C211E] shadow-[0_2px_12px_rgba(32,35,33,0.03)] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#202321] text-white flex items-center justify-center">
                  <Server className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-[#202321] dark:text-[#F2F4F2]">
                  Connection State
                </h3>
              </div>
              {displayInfo?.connected ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#20C66B]">
                  <CheckCircle2 className="w-4 h-4" />
                  {t.topbar.connected}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-500">
                  <AlertCircle className="w-4 h-4" />
                  {t.topbar.disconnected}
                </span>
              )}
            </div>

            {displayInfo?.errorMessage && (
              <div className="p-3.5 rounded-xl border border-rose-500/25 bg-rose-500/10 text-xs text-rose-600 dark:text-rose-300 font-mono-tabular">
                {displayInfo.errorMessage}
              </div>
            )}

            <div className="divide-y divide-[#EDF0ED] dark:divide-[#242926] text-xs">
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-[#858B87]">Active Mode</span>
                <span className="font-mono-tabular uppercase font-semibold text-[#20C66B]">
                  {displayInfo?.mode || mode}
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-[#858B87]">{t.dashboard.identity}</span>
                <span className="font-mono-tabular font-semibold text-[#202321] dark:text-[#F2F4F2]">
                  {displayInfo?.identity || '—'}
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-[#858B87]">{t.dashboard.version}</span>
                <span className="font-mono-tabular text-[#202321] dark:text-[#F2F4F2]">
                  {displayInfo?.version || '—'}
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-[#858B87]">{t.dashboard.board}</span>
                <span className="font-mono-tabular text-[#202321] dark:text-[#F2F4F2]">
                  {displayInfo?.boardName || '—'}
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-[#858B87]">Last Verified</span>
                <span className="font-mono-tabular text-[#858B87]">
                  {displayInfo?.lastCheckedAt
                    ? new Date(displayInfo.lastCheckedAt).toLocaleTimeString()
                    : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Least-Privilege RouterOS Policy Guide */}
          <div className="rounded-2xl border border-[#EDF0ED] dark:border-[#242926] bg-[#FFFFFF] dark:bg-[#1C211E] shadow-[0_2px_12px_rgba(32,35,33,0.03)] p-6 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[#202321] dark:text-[#F2F4F2]">
              <ShieldCheck className="w-4 h-4 text-[#20C66B]" />
              <span>{t.settings.securityArchitectureTitle}</span>
            </div>
            <p className="text-xs text-[#858B87] leading-relaxed">
              {t.settings.securityArchitectureDesc}
            </p>
            <div className="p-3.5 rounded-xl bg-[#F5F6F5] dark:bg-[#121513] font-mono-tabular text-[11px] text-[#202321] dark:text-[#D5DBD7] space-y-1 overflow-x-auto">
              <div className="text-[#858B87]"># Recommended RouterOS Group Setup:</div>
              <div>/user group add name=ppp-api-group policy=api,read,write,sensitive,!ftp,!reboot,!policy,!test,!sniff</div>
              <div>/ip service set api-ssl port=8729 certificate=router-tls-cert disabled=no</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
