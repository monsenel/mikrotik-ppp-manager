import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  ShieldOff,
  Wifi,
  WifiOff,
  Unplug,
  Trash2,
  Edit3,
  Clock,
  Server,
  Info,
  Check,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApp } from '../context/AppContext';
import { mikrotikApi } from '../lib/apiClient';
import { formatBytes } from '../lib/utils';
import { PppUser } from '../types/mikrotik';

interface UserDetailsDrawerProps {
  onEditUser: (user: PppUser) => void;
}

export const UserDetailsDrawer: React.FC<UserDetailsDrawerProps> = ({ onEditUser }) => {
  const { inspectedUserId, setInspectedUserId, mode, language, t, addToast } = useApp();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [editingProfileInline, setEditingProfileInline] = useState(false);

  const { data: user, isLoading } = useQuery({
    queryKey: ['ppp-user-detail', inspectedUserId, mode],
    queryFn: () => mikrotikApi.getUserById(inspectedUserId!),
    enabled: Boolean(inspectedUserId),
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['ppp-profiles', mode],
    queryFn: mikrotikApi.getProfiles,
    enabled: Boolean(inspectedUserId),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async (u: PppUser) =>
      u.disabled ? mikrotikApi.enableUser(u.id) : mikrotikApi.disableUser(u.id),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['ppp-users'] });
      queryClient.invalidateQueries({ queryKey: ['ppp-user-detail', inspectedUserId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      addToast({
        type: 'success',
        title: updated.disabled ? 'PPP Secret Disabled' : 'PPP Secret Enabled',
        description: `${updated.name} is now ${updated.disabled ? 'disabled' : 'enabled'} in /ppp/secret.`,
      });
    },
    onError: (err: Error) => {
      addToast({ type: 'error', title: 'Operation Failed', description: err.message });
    },
  });

  const changeProfileMutation = useMutation({
    mutationFn: async ({ u, newProfile }: { u: PppUser; newProfile: string }) =>
      mikrotikApi.updateUser(u.id, {
        name: u.name,
        service: u.service,
        profile: newProfile,
        localAddress: u.localAddress,
        remoteAddress: u.remoteAddress,
        callerId: u.callerId,
        routes: u.routes,
        limitBytesIn: u.limitBytesIn,
        limitBytesOut: u.limitBytesOut,
        comment: u.comment,
        disabled: u.disabled,
      }),
    onSuccess: (updated) => {
      setEditingProfileInline(false);
      queryClient.invalidateQueries({ queryKey: ['ppp-users'] });
      queryClient.invalidateQueries({ queryKey: ['ppp-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['ppp-user-detail', inspectedUserId] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      addToast({
        type: 'success',
        title: 'PPP Profile Updated',
        description: `Assigned ${updated.name} to profile ${updated.profile}.`,
      });
    },
    onError: (err: Error) => {
      addToast({ type: 'error', title: 'Failed to Change Profile', description: err.message });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: (username: string) => mikrotikApi.disconnectUserSessions(username),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['ppp-users'] });
      queryClient.invalidateQueries({ queryKey: ['ppp-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['ppp-user-detail', inspectedUserId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      addToast({
        type: 'success',
        title: 'Active Session Disconnected',
        description: `Removed ${res.disconnected} active session(s) from /ppp/active.`,
      });
    },
    onError: (err: Error) => {
      addToast({ type: 'error', title: 'Disconnect Failed', description: err.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => mikrotikApi.deleteUser(id),
    onSuccess: () => {
      setConfirmDelete(false);
      setInspectedUserId(null);
      queryClient.invalidateQueries({ queryKey: ['ppp-users'] });
      queryClient.invalidateQueries({ queryKey: ['ppp-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      addToast({
        type: 'success',
        title: 'PPP Secret Deleted',
        description: 'Removed subscriber credential from RouterOS /ppp/secret.',
      });
    },
    onError: (err: Error) => {
      addToast({ type: 'error', title: 'Delete Failed', description: err.message });
    },
  });

  if (!inspectedUserId) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-[#202321]/50 backdrop-blur-xs"
      onClick={() => {
        setConfirmDelete(false);
        setInspectedUserId(null);
      }}
    >
      <div
        className="w-full max-w-lg h-full bg-[#FFFFFF] dark:bg-[#181C19] border-s border-[#EDF0ED] dark:border-[#242926] shadow-2xl flex flex-col justify-between overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {isLoading || !user ? (
          <div className="p-6 space-y-4">
            <div className="h-6 w-48 bg-[#F5F6F5] dark:bg-[#121513] rounded-xl animate-pulse" />
            <div className="h-32 bg-[#F5F6F5] dark:bg-[#121513] rounded-2xl animate-pulse" />
            <div className="h-48 bg-[#F5F6F5] dark:bg-[#121513] rounded-2xl animate-pulse" />
          </div>
        ) : (
          <>
            <div className="p-6 space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#EDF0ED] dark:border-[#242926]">
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold font-mono-tabular text-white shrink-0 ${
                      user.isOnline ? 'bg-[#20C66B]' : 'bg-[#202321]'
                    }`}
                  >
                    {user.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-xs text-[#858B87]">
                      <span className="font-mono-tabular">/ppp/secret {user.id}</span>
                      <span>·</span>
                      <span className="uppercase font-mono-tabular">{user.service}</span>
                    </div>
                    <h2 className="mt-0.5 text-lg font-bold tracking-tight text-[#202321] dark:text-[#F2F4F2] font-mono-tabular">
                      {user.name}
                    </h2>
                  </div>
                </div>
                <button
                  onClick={() => setInspectedUserId(null)}
                  className="p-1.5 text-[#858B87] hover:text-[#202321] dark:hover:text-white rounded-xl hover:bg-[#F5F6F5] dark:hover:bg-[#222724]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status Summary Row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border border-[#EDF0ED] dark:border-[#242926] bg-[#F5F6F5] dark:bg-[#121513]">
                  <div className="text-xs text-[#858B87]">{t.users.colAccountStatus}</div>
                  <div className="mt-1.5 flex items-center gap-2 font-semibold text-sm">
                    {user.disabled ? (
                      <>
                        <ShieldOff className="w-4 h-4 text-rose-500 shrink-0" />
                        <span className="text-rose-500">{t.users.statusDisabled}</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4 text-[#20C66B] shrink-0" />
                        <span className="text-[#20C66B]">{t.users.statusEnabled}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-[#EDF0ED] dark:border-[#242926] bg-[#F5F6F5] dark:bg-[#121513]">
                  <div className="text-xs text-[#858B87]">{t.users.colConnStatus}</div>
                  <div className="mt-1.5 flex items-center gap-2 font-semibold text-sm">
                    {user.isOnline ? (
                      <>
                        <Wifi className="w-4 h-4 text-[#20C66B] shrink-0" />
                        <span className="text-[#20C66B]">
                          {t.users.statusOnline} ({user.uptime})
                        </span>
                      </>
                    ) : (
                      <>
                        <WifiOff className="w-4 h-4 text-[#858B87] shrink-0" />
                        <span className="text-[#858B87]">{t.users.statusOffline}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Profile Reassignment */}
              <div className="p-4 rounded-2xl border border-[#EDF0ED] dark:border-[#242926] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#858B87]">
                    {t.users.fieldProfile}
                  </span>
                  {!editingProfileInline && (
                    <button
                      onClick={() => {
                        setSelectedProfile(user.profile);
                        setEditingProfileInline(true);
                      }}
                      className="text-xs font-semibold text-[#20C66B] hover:underline cursor-pointer"
                    >
                      {language === 'fa' ? 'تغییر پروفایل' : 'Change Profile'}
                    </button>
                  )}
                </div>
                {editingProfileInline ? (
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedProfile}
                      onChange={(e) => setSelectedProfile(e.target.value)}
                      className="flex-1 rounded-xl border border-[#EDF0ED] dark:border-[#2A302C] bg-[#F5F6F5] dark:bg-[#121513] px-3 py-1.5 text-sm text-[#202321] dark:text-[#F2F4F2]"
                    >
                      {profiles.map((p) => (
                        <option key={p.id} value={p.name}>
                          {p.name} {p.rateLimit ? `(${p.rateLimit})` : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() =>
                        changeProfileMutation.mutate({ u: user, newProfile: selectedProfile })
                      }
                      disabled={changeProfileMutation.isPending}
                      className="px-3.5 py-1.5 rounded-full bg-[#20C66B] hover:bg-[#1AAF5E] text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Save
                    </button>
                    <button
                      onClick={() => setEditingProfileInline(false)}
                      className="px-3 py-1.5 rounded-full border border-[#EDF0ED] dark:border-[#2A302C] text-xs text-[#858B87]"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="text-sm font-semibold text-[#202321] dark:text-[#F2F4F2] font-mono-tabular">
                    {user.profile}
                  </div>
                )}
              </div>

              {/* Configured Secret Parameters */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-[#202321] dark:text-[#F2F4F2]">
                  {language === 'fa'
                    ? 'پیکربندی اکانت در /ppp/secret'
                    : 'Configured /ppp/secret Attributes'}
                </h3>
                <div className="divide-y divide-[#EDF0ED] dark:divide-[#242926] border border-[#EDF0ED] dark:border-[#242926] rounded-2xl text-sm">
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-[#858B87] text-xs">{t.users.fieldLocalAddress}</span>
                    <span className="font-mono-tabular text-xs font-medium text-[#202321] dark:text-[#F2F4F2]">
                      {user.localAddress || 'Pool / Default'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-[#858B87] text-xs">{t.users.fieldRemoteAddress}</span>
                    <span className="font-mono-tabular text-xs font-medium text-[#202321] dark:text-[#F2F4F2]">
                      {user.remoteAddress || 'Dynamic Pool'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-[#858B87] text-xs">{t.users.fieldCallerId}</span>
                    <span className="font-mono-tabular text-xs text-[#202321] dark:text-[#F2F4F2]">
                      {user.callerId || 'Any (Unbound)'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-[#858B87] text-xs">{t.users.fieldRoutes}</span>
                    <span className="font-mono-tabular text-xs text-[#202321] dark:text-[#F2F4F2]">
                      {user.routes || '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-[#858B87] text-xs">Quota (In / Out)</span>
                    <span className="font-mono-tabular text-xs text-[#202321] dark:text-[#F2F4F2]">
                      {formatBytes(user.limitBytesIn)} / {formatBytes(user.limitBytesOut)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-[#858B87] text-xs">Last Logged Out</span>
                    <span className="font-mono-tabular text-xs text-[#202321] dark:text-[#F2F4F2]">
                      {user.lastLoggedOut || '—'}
                    </span>
                  </div>
                  <div className="px-4 py-2.5 space-y-1">
                    <span className="text-[#858B87] block text-xs">{t.users.fieldComment}</span>
                    <p className="text-[#202321] dark:text-[#F2F4F2] text-xs">
                      {user.comment || 'No comment recorded'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Active Session Information (/ppp/active) */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-[#202321] dark:text-[#F2F4F2]">
                  {language === 'fa'
                    ? 'اطلاعات نشست فعال در /ppp/active'
                    : 'Live Tunnel State (/ppp/active)'}
                </h3>
                {user.isOnline ? (
                  <div className="divide-y divide-[#EDF0ED] dark:divide-[#242926] border border-[#20C66B]/30 bg-[#20C66B]/5 rounded-2xl text-xs">
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-[#858B87]">Active Tunnel IP</span>
                      <span className="font-mono-tabular font-bold text-[#20C66B]">
                        {user.activeIp}
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-[#858B87]">Active Caller-ID</span>
                      <span className="font-mono-tabular text-[#202321] dark:text-[#F2F4F2]">
                        {user.activeCallerId || '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-[#858B87]">Session Uptime</span>
                      <span className="font-mono-tabular text-[#202321] dark:text-[#F2F4F2] flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[#20C66B]" />
                        {user.uptime}
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-[#858B87]">Session ID / .id</span>
                      <span className="font-mono-tabular text-[#202321] dark:text-[#F2F4F2]">
                        {user.activeSessionId} ({user.activeRowId})
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-[#858B87]">Tunnel Encoding</span>
                      <span className="font-mono-tabular text-[#202321] dark:text-[#F2F4F2]">
                        {user.activeEncoding || 'none'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl border border-[#EDF0ED] dark:border-[#242926] text-xs text-[#858B87] flex items-center gap-2.5">
                    <Server className="w-4 h-4 text-[#858B87] shrink-0" />
                    <span>
                      Subscriber has no active session in RouterOS /ppp/active right now.
                    </span>
                  </div>
                )}
              </div>

              {/* Authentic RouterOS Historical Notice */}
              <div className="p-4 rounded-2xl border border-[#EDF0ED] dark:border-[#242926] bg-[#F5F6F5] dark:bg-[#121513] flex items-start gap-2.5 text-xs text-[#858B87]">
                <Info className="w-4 h-4 text-[#20C66B] shrink-0 mt-0.5" />
                <span>
                  RouterOS /ppp/secret stores only the most recent logout timestamp (
                  <code className="font-mono-tabular">last-logged-out</code>). Historical session
                  accounting requires an external RADIUS or syslog collector and is never fabricated.
                </span>
              </div>
            </div>

            {/* Footer Action Controls */}
            <div className="p-4 border-t border-[#EDF0ED] dark:border-[#242926] bg-[#F5F6F5] dark:bg-[#121513] space-y-3">
              {confirmDelete ? (
                <div className="p-3.5 rounded-2xl border border-rose-500/30 bg-rose-500/10 space-y-2.5">
                  <div className="text-xs font-semibold text-rose-600 dark:text-rose-300">
                    {t.users.deleteConfirmTitle} ({user.name})
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => deleteMutation.mutate(user.id)}
                      disabled={deleteMutation.isPending}
                      className="px-4 py-1.5 rounded-full bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold cursor-pointer"
                    >
                      Confirm Permanent Delete
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="px-3.5 py-1.5 rounded-full border border-[#EDF0ED] dark:border-[#2A302C] text-xs text-[#858B87]"
                    >
                      {t.users.cancel}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        onEditUser(user);
                        setInspectedUserId(null);
                      }}
                      className="px-4 py-2 rounded-full bg-[#20C66B] hover:bg-[#1AAF5E] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      {t.users.actionEdit}
                    </button>

                    <button
                      onClick={() => toggleStatusMutation.mutate(user)}
                      disabled={toggleStatusMutation.isPending}
                      className="px-3.5 py-2 rounded-full border border-[#EDF0ED] dark:border-[#2A302C] bg-[#FFFFFF] dark:bg-[#181C19] text-xs font-medium text-[#202321] dark:text-[#F2F4F2] flex items-center gap-1.5 cursor-pointer"
                    >
                      {user.disabled ? (
                        <>
                          <ShieldCheck className="w-3.5 h-3.5 text-[#20C66B]" />
                          {t.users.actionEnable}
                        </>
                      ) : (
                        <>
                          <ShieldOff className="w-3.5 h-3.5 text-amber-500" />
                          {t.users.actionDisable}
                        </>
                      )}
                    </button>

                    {user.isOnline && (
                      <button
                        onClick={() => disconnectMutation.mutate(user.name)}
                        disabled={disconnectMutation.isPending}
                        className="px-3.5 py-2 rounded-full bg-[#202321] text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                      >
                        <Unplug className="w-3.5 h-3.5 text-[#20C66B]" />
                        {t.users.actionDisconnect}
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="p-2 rounded-full text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    title={t.users.actionDelete}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
