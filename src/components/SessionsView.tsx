import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  RefreshCw,
  Unplug,
  Eye,
  Clock,
  Info,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { mikrotikApi } from '../lib/apiClient';
import { PppActiveSession } from '../types/mikrotik';

export const SessionsView: React.FC = () => {
  const { mode, t, setInspectedUserId, addToast } = useApp();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [serviceFilter, setServiceFilter] = useState('ALL');
  const [confirmDisconnectSession, setConfirmDisconnectSession] =
    useState<PppActiveSession | null>(null);
  const [confirmDisconnectUsername, setConfirmDisconnectUsername] = useState<string | null>(
    null
  );

  const {
    data: sessions = [],
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['ppp-sessions', mode],
    queryFn: mikrotikApi.getSessions,
    refetchInterval: 10000,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['ppp-sessions'] });
    queryClient.invalidateQueries({ queryKey: ['ppp-users'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
  };

  const disconnectSingleMutation = useMutation({
    mutationFn: (id: string) => mikrotikApi.disconnectSession(id),
    onSuccess: () => {
      setConfirmDisconnectSession(null);
      invalidateAll();
      addToast({
        type: 'success',
        title: 'Active Session Terminated',
        description: 'Executed /ppp/active/remove for the selected RouterOS session ID.',
      });
    },
    onError: (err: Error) => {
      addToast({ type: 'error', title: 'Disconnect Failed', description: err.message });
    },
  });

  const disconnectUserAllMutation = useMutation({
    mutationFn: (username: string) => mikrotikApi.disconnectUserSessions(username),
    onSuccess: (res, username) => {
      setConfirmDisconnectUsername(null);
      invalidateAll();
      addToast({
        type: 'success',
        title: 'User Sessions Disconnected',
        description: `Terminated ${res.disconnected} active session(s) for '${username}'.`,
      });
    },
    onError: (err: Error) => {
      addToast({ type: 'error', title: 'Disconnect Failed', description: err.message });
    },
  });

  const filteredSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sessions.filter((s) => {
      if (serviceFilter !== 'ALL' && s.service.toLowerCase() !== serviceFilter.toLowerCase()) {
        return false;
      }
      if (q) {
        return (
          s.name.toLowerCase().includes(q) ||
          s.address.toLowerCase().includes(q) ||
          s.callerId.toLowerCase().includes(q) ||
          s.sessionId.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [sessions, searchQuery, serviceFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#202321] dark:text-[#F2F4F2]">
            {t.sessions.title}
          </h2>
          <p className="text-xs text-[#858B87] mt-0.5">{t.sessions.subtitle}</p>
        </div>

        <button
          onClick={() => refetch()}
          className="px-4 py-2.5 rounded-full border border-[#EDF0ED] dark:border-[#242926] bg-[#FFFFFF] dark:bg-[#1C211E] hover:border-[#20C66B]/40 text-xs font-medium text-[#202321] dark:text-[#F2F4F2] flex items-center gap-2 self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#858B87] ${isFetching ? 'animate-spin' : ''}`} />
          {t.users.refresh}
        </button>
      </div>

      {/* Filter Bar Card */}
      <div className="p-5 rounded-2xl border border-[#EDF0ED] dark:border-[#242926] bg-[#FFFFFF] dark:bg-[#1C211E] shadow-[0_2px_12px_rgba(32,35,33,0.03)] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#858B87] absolute start-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.sessions.searchPlaceholder}
            className="w-full ps-9 pe-3.5 py-2 text-xs rounded-xl border border-[#EDF0ED] dark:border-[#2A302C] bg-[#F5F6F5] dark:bg-[#121513] text-[#202321] dark:text-[#F2F4F2] placeholder-[#858B87] focus:outline-none focus:border-[#20C66B]"
          />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="px-3.5 py-2 text-xs rounded-xl border border-[#EDF0ED] dark:border-[#2A302C] bg-[#F5F6F5] dark:bg-[#121513] text-[#202321] dark:text-[#F2F4F2] focus:outline-none focus:border-[#20C66B]"
          >
            <option value="ALL">{t.users.allServices}</option>
            <option value="pppoe">PPPoE</option>
            <option value="sstp">SSTP</option>
            <option value="l2tp">L2TP</option>
            <option value="ovpn">OpenVPN</option>
            <option value="pptp">PPTP</option>
          </select>
        </div>
      </div>

      {/* Sessions Table Card */}
      <div className="rounded-2xl border border-[#EDF0ED] dark:border-[#242926] bg-[#FFFFFF] dark:bg-[#1C211E] shadow-[0_2px_12px_rgba(32,35,33,0.03)] overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-11 bg-[#F5F6F5] dark:bg-[#121513] rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="py-16 px-4 text-center space-y-2">
            <div className="text-sm font-bold text-[#202321] dark:text-[#F2F4F2]">
              {t.sessions.emptyTitle}
            </div>
            <p className="text-xs text-[#858B87] max-w-md mx-auto">
              {t.sessions.emptySubtitle}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start border-collapse">
              <thead>
                <tr className="border-b border-[#EDF0ED] dark:border-[#242926] bg-[#F5F6F5]/60 dark:bg-[#121513]/50 text-[11px] font-semibold text-[#858B87]">
                  <th className="py-3.5 px-4 text-start">{t.sessions.colUsername}</th>
                  <th className="py-3.5 px-4 text-start">{t.sessions.colService}</th>
                  <th className="py-3.5 px-4 text-start">{t.sessions.colCallerId}</th>
                  <th className="py-3.5 px-4 text-start">{t.sessions.colAddress}</th>
                  <th className="py-3.5 px-4 text-start">{t.sessions.colUptime}</th>
                  <th className="py-3.5 px-4 text-start">{t.sessions.colSessionId}</th>
                  <th className="py-3.5 px-4 text-start">{t.sessions.colEncoding}</th>
                  <th className="py-3.5 px-4 text-end">{t.sessions.colActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDF0ED] dark:divide-[#242926] text-sm">
                {filteredSessions.map((sess) => (
                  <tr
                    key={sess.id}
                    className="hover:bg-[#F5F6F5]/70 dark:hover:bg-[#222724]/50 transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#20C66B] text-white text-[11px] font-bold font-mono-tabular flex items-center justify-center shrink-0">
                          {sess.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <button
                            onClick={() =>
                              sess.relatedSecretId && setInspectedUserId(sess.relatedSecretId)
                            }
                            className="font-mono-tabular font-semibold text-[#202321] dark:text-[#F2F4F2] hover:text-[#20C66B] cursor-pointer"
                          >
                            {sess.name}
                          </button>
                          {sess.profile && (
                            <div className="text-[11px] font-mono-tabular text-[#858B87]">
                              {sess.profile}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono-tabular uppercase text-xs text-[#858B87]">
                      {sess.service}
                    </td>
                    <td className="py-3.5 px-4 font-mono-tabular text-xs text-[#858B87]">
                      {sess.callerId || '—'}
                    </td>
                    <td className="py-3.5 px-4 font-mono-tabular text-xs font-semibold text-[#20C66B]">
                      {sess.address}
                    </td>
                    <td className="py-3.5 px-4 font-mono-tabular text-xs text-[#202321] dark:text-[#D5DBD7]">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[#20C66B]" />
                        {sess.uptime}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono-tabular text-xs text-[#858B87]">
                      {sess.sessionId} <span className="opacity-70">({sess.id})</span>
                    </td>
                    <td className="py-3.5 px-4 font-mono-tabular text-xs text-[#858B87]">
                      {sess.encoding || 'none'}
                    </td>
                    <td className="py-3.5 px-4 text-end">
                      <div className="flex items-center justify-end gap-2">
                        {sess.relatedSecretId && (
                          <button
                            onClick={() => setInspectedUserId(sess.relatedSecretId!)}
                            className="px-3 py-1.5 rounded-full border border-[#EDF0ED] dark:border-[#2A302C] hover:border-[#20C66B]/40 text-xs font-medium text-[#202321] dark:text-[#F2F4F2] flex items-center gap-1.5 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#858B87]" />
                            {t.sessions.inspectUser}
                          </button>
                        )}
                        <button
                          onClick={() => setConfirmDisconnectSession(sess)}
                          className="px-3 py-1.5 rounded-full bg-[#202321] hover:bg-[#323633] text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                        >
                          <Unplug className="w-3.5 h-3.5 text-[#20C66B]" />
                          {t.sessions.disconnectSession}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Semantic Distinction Notice */}
      <div className="p-4 rounded-2xl border border-[#EDF0ED] dark:border-[#242926] bg-[#FFFFFF] dark:bg-[#1C211E] flex items-center gap-2.5 text-xs text-[#858B87]">
        <Info className="w-4 h-4 text-[#20C66B] shrink-0" />
        <span>{t.users.disconnectNote}</span>
      </div>

      {/* Disconnect Confirmation Modal */}
      {confirmDisconnectSession && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#202321]/50 backdrop-blur-xs p-4"
          onClick={() => setConfirmDisconnectSession(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[#EDF0ED] dark:border-[#242926] bg-[#FFFFFF] dark:bg-[#181C19] p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-[#202321] dark:text-[#F2F4F2]">
              {t.sessions.disconnectConfirmTitle}
            </h3>
            <p className="text-xs text-[#858B87]">{t.sessions.disconnectConfirmDesc}</p>
            <div className="p-3.5 rounded-xl bg-[#F5F6F5] dark:bg-[#121513] font-mono-tabular text-xs space-y-1">
              <div>
                Subscriber: <span className="font-semibold text-[#202321] dark:text-white">{confirmDisconnectSession.name}</span>
              </div>
              <div>
                RouterOS .id: <span className="text-[#20C66B] font-semibold">{confirmDisconnectSession.id}</span> · IP:{' '}
                {confirmDisconnectSession.address}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmDisconnectSession(null)}
                className="px-4 py-2 rounded-full border border-[#EDF0ED] dark:border-[#2A302C] text-xs font-medium text-[#858B87]"
              >
                {t.users.cancel}
              </button>
              <button
                onClick={() => {
                  const uName = confirmDisconnectSession.name;
                  setConfirmDisconnectSession(null);
                  setConfirmDisconnectUsername(uName);
                }}
                className="px-4 py-2 rounded-full border border-[#EDF0ED] dark:border-[#2A302C] text-[#202321] dark:text-[#F2F4F2] text-xs font-medium cursor-pointer"
              >
                {t.sessions.disconnectAllUser}
              </button>
              <button
                onClick={() => disconnectSingleMutation.mutate(confirmDisconnectSession.id)}
                disabled={disconnectSingleMutation.isPending}
                className="px-4 py-2 rounded-full bg-[#20C66B] hover:bg-[#1AAF5E] text-white text-xs font-semibold cursor-pointer"
              >
                Terminate Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Disconnect All Sessions for Username Confirmation */}
      {confirmDisconnectUsername && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#202321]/50 backdrop-blur-xs p-4"
          onClick={() => setConfirmDisconnectUsername(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[#EDF0ED] dark:border-[#242926] bg-[#FFFFFF] dark:bg-[#181C19] p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-[#202321] dark:text-[#F2F4F2]">
              Disconnect All Sessions for '{confirmDisconnectUsername}'?
            </h3>
            <p className="text-xs text-[#858B87]">
              This terminates every active tunnel for subscriber{' '}
              <code className="font-mono-tabular">{confirmDisconnectUsername}</code> in{' '}
              <code className="font-mono-tabular">/ppp/active</code>.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmDisconnectUsername(null)}
                className="px-4 py-2 rounded-full border border-[#EDF0ED] dark:border-[#2A302C] text-xs font-medium text-[#858B87]"
              >
                {t.users.cancel}
              </button>
              <button
                onClick={() => disconnectUserAllMutation.mutate(confirmDisconnectUsername)}
                disabled={disconnectUserAllMutation.isPending}
                className="px-4 py-2 rounded-full bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold cursor-pointer"
              >
                Confirm Disconnect All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
