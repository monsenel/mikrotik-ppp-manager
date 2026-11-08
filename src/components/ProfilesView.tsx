import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  PlusCircle,
  RefreshCw,
  Edit3,
  Trash2,
  Users,
  X,
  AlertTriangle,
  Gauge,
  Info,
  Sliders,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { mikrotikApi } from '../lib/apiClient';
import {
  describeRateLimitHuman,
  formatRouterOsRateLimit,
  parseRouterOsRateLimit,
} from '../lib/utils';
import {
  ChangeTcpMssOption,
  CreateOrUpdatePppProfileDto,
  OnlyOneOption,
  PppProfile,
  UseEncryptionOption,
} from '../types/mikrotik';

const ASYMMETRIC_PRESETS = [
  { label: '5 Mbps Down / 2 Mbps Up', down: '5', downU: 'M' as const, up: '2', upU: 'M' as const },
  { label: '10 Mbps Down / 5 Mbps Up', down: '10', downU: 'M' as const, up: '5', upU: 'M' as const },
  { label: '20 Mbps Down / 10 Mbps Up', down: '20', downU: 'M' as const, up: '10', upU: 'M' as const },
  { label: '50 Mbps Down / 20 Mbps Up', down: '50', downU: 'M' as const, up: '20', upU: 'M' as const },
  { label: '100 Mbps Down / 40 Mbps Up', down: '100', downU: 'M' as const, up: '40', upU: 'M' as const },
];

export const ProfilesView: React.FC = () => {
  const {
    mode,
    t,
    language,
    setInspectedUserId,
    triggerCreateProfileModal,
    setTriggerCreateProfileModal,
    addToast,
  } = useApp();

  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedProfileId, setExpandedProfileId] = useState<string | null>(null);
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<PppProfile | null>(null);
  const [deleteTargetProfile, setDeleteTargetProfile] = useState<PppProfile | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [localAddress, setLocalAddress] = useState('');
  const [remoteAddress, setRemoteAddress] = useState('');
  const [downloadVal, setDownloadVal] = useState('');
  const [downloadUnit, setDownloadUnit] = useState<'k' | 'M' | 'G'>('M');
  const [uploadVal, setUploadVal] = useState('');
  const [uploadUnit, setUploadUnit] = useState<'k' | 'M' | 'G'>('M');
  const [rawRateLimit, setRawRateLimit] = useState('');
  const [sessionTimeout, setSessionTimeout] = useState('');
  const [idleTimeout, setIdleTimeout] = useState('');
  const [onlyOne, setOnlyOne] = useState<OnlyOneOption>('default');
  const [useEncryption, setUseEncryption] = useState<UseEncryptionOption>('default');
  const [dnsServer, setDnsServer] = useState('');
  const [changeTcpMss, setChangeTcpMss] = useState<ChangeTcpMssOption>('yes');
  const [comment, setComment] = useState('');

  const {
    data: profiles = [],
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['ppp-profiles', mode],
    queryFn: mikrotikApi.getProfiles,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['ppp-users', mode],
    queryFn: mikrotikApi.getUsers,
  });

  const openCreateModal = () => {
    setEditingProfile(null);
    setName('');
    setLocalAddress('100.64.14.1');
    setRemoteAddress('pool-ftth-metro');
    setDownloadVal('20');
    setDownloadUnit('M');
    setUploadVal('10');
    setUploadUnit('M');
    setRawRateLimit('10M/20M');
    setSessionTimeout('');
    setIdleTimeout('');
    setOnlyOne('yes');
    setUseEncryption('default');
    setDnsServer('1.1.1.1,8.8.8.8');
    setChangeTcpMss('yes');
    setComment('');
    setModalOpen(true);
  };

  const openEditModal = (p: PppProfile) => {
    setEditingProfile(p);
    setName(p.name);
    setLocalAddress(p.localAddress);
    setRemoteAddress(p.remoteAddress);
    const parsed = parseRouterOsRateLimit(p.rateLimit);
    setDownloadVal(parsed.downloadValue);
    setDownloadUnit(parsed.downloadUnit);
    setUploadVal(parsed.uploadValue);
    setUploadUnit(parsed.uploadUnit);
    setRawRateLimit(p.rateLimit);
    setSessionTimeout(p.sessionTimeout);
    setIdleTimeout(p.idleTimeout);
    setOnlyOne(p.onlyOne);
    setUseEncryption(p.useEncryption);
    setDnsServer(p.dnsServer);
    setChangeTcpMss(p.changeTcpMss);
    setComment(p.comment);
    setModalOpen(true);
  };

  useEffect(() => {
    if (triggerCreateProfileModal) {
      openCreateModal();
      setTriggerCreateProfileModal(false);
    }
  }, [triggerCreateProfileModal]);

  const handleBandwidthBuilderChange = (
    nextUpVal: string,
    nextUpUnit: 'k' | 'M' | 'G',
    nextDownVal: string,
    nextDownUnit: 'k' | 'M' | 'G'
  ) => {
    setUploadVal(nextUpVal);
    setUploadUnit(nextUpUnit);
    setDownloadVal(nextDownVal);
    setDownloadUnit(nextDownUnit);
    const formatted = formatRouterOsRateLimit(
      nextUpVal,
      nextUpUnit,
      nextDownVal,
      nextDownUnit
    );
    setRawRateLimit(formatted);
  };

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['ppp-profiles'] });
    queryClient.invalidateQueries({ queryKey: ['ppp-users'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
  };

  const saveProfileMutation = useMutation({
    mutationFn: async (e: React.FormEvent) => {
      e.preventDefault();
      const dto: CreateOrUpdatePppProfileDto = {
        name: name.trim(),
        localAddress,
        remoteAddress,
        rateLimit: rawRateLimit.trim(),
        sessionTimeout,
        idleTimeout,
        onlyOne,
        useEncryption,
        dnsServer,
        changeTcpMss,
        comment,
      };
      if (editingProfile) {
        return mikrotikApi.updateProfile(editingProfile.id, dto);
      }
      return mikrotikApi.createProfile(dto);
    },
    onSuccess: (saved) => {
      setModalOpen(false);
      invalidateAll();
      addToast({
        type: 'success',
        title: editingProfile ? 'PPP Profile Updated' : 'PPP Profile Created',
        description: `Saved '${saved.name}' with rate-limit '${saved.rateLimit || 'unlimited'}'.`,
      });
    },
    onError: (err: Error) => {
      addToast({ type: 'error', title: 'Profile Save Failed', description: err.message });
    },
  });

  const deleteProfileMutation = useMutation({
    mutationFn: (id: string) => mikrotikApi.deleteProfile(id),
    onSuccess: () => {
      setDeleteTargetProfile(null);
      invalidateAll();
      addToast({
        type: 'success',
        title: 'PPP Profile Deleted',
        description: 'Removed profile from RouterOS /ppp/profile.',
      });
    },
    onError: (err: Error) => {
      addToast({ type: 'error', title: 'Delete Failed', description: err.message });
    },
  });

  const filteredProfiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.remoteAddress.toLowerCase().includes(q) ||
        p.rateLimit.toLowerCase().includes(q) ||
        p.comment.toLowerCase().includes(q)
    );
  }, [profiles, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#202321] dark:text-[#F2F4F2]">
            {t.profiles.title}
          </h2>
          <p className="text-xs text-[#858B87] mt-0.5">{t.profiles.subtitle}</p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => refetch()}
            className="px-4 py-2.5 rounded-full border border-[#EDF0ED] dark:border-[#242926] bg-[#FFFFFF] dark:bg-[#1C211E] hover:border-[#20C66B]/40 text-xs font-medium text-[#202321] dark:text-[#F2F4F2] flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#858B87] ${isFetching ? 'animate-spin' : ''}`} />
            {t.users.refresh}
          </button>
          <button
            onClick={openCreateModal}
            className="px-5 py-2.5 rounded-full bg-[#20C66B] hover:bg-[#1AAF5E] text-white text-xs font-semibold flex items-center gap-2 shadow-[0_6px_16px_rgba(32,198,107,0.22)] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            {t.profiles.createProfile}
          </button>
        </div>
      </div>

      {/* Search Bar Card */}
      <div className="p-5 rounded-2xl border border-[#EDF0ED] dark:border-[#242926] bg-[#FFFFFF] dark:bg-[#1C211E] shadow-[0_2px_12px_rgba(32,35,33,0.03)]">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-[#858B87] absolute start-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.profiles.searchPlaceholder}
            className="w-full ps-9 pe-3.5 py-2 text-xs rounded-xl border border-[#EDF0ED] dark:border-[#2A302C] bg-[#F5F6F5] dark:bg-[#121513] text-[#202321] dark:text-[#F2F4F2] placeholder-[#858B87] focus:outline-none focus:border-[#20C66B]"
          />
        </div>
      </div>

      {/* Profiles Table Card */}
      <div className="rounded-2xl border border-[#EDF0ED] dark:border-[#242926] bg-[#FFFFFF] dark:bg-[#1C211E] shadow-[0_2px_12px_rgba(32,35,33,0.03)] overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-12 bg-[#F5F6F5] dark:bg-[#121513] rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start border-collapse">
              <thead>
                <tr className="border-b border-[#EDF0ED] dark:border-[#242926] bg-[#F5F6F5]/60 dark:bg-[#121513]/50 text-[11px] font-semibold text-[#858B87]">
                  <th className="py-3.5 px-4 text-start">{t.profiles.colName}</th>
                  <th className="py-3.5 px-4 text-start">{t.profiles.colRateLimit}</th>
                  <th className="py-3.5 px-4 text-start">{t.profiles.colRouterOsSyntax}</th>
                  <th className="py-3.5 px-4 text-start">{t.profiles.colAddressing}</th>
                  <th className="py-3.5 px-4 text-start">{t.profiles.colEncryption}</th>
                  <th className="py-3.5 px-4 text-start">{t.profiles.colAssignedUsers}</th>
                  <th className="py-3.5 px-4 text-end">{t.profiles.colActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDF0ED] dark:divide-[#242926] text-sm">
                {filteredProfiles.map((p) => {
                  const isExpanded = expandedProfileId === p.id;
                  return (
                    <React.Fragment key={p.id}>
                      <tr className="hover:bg-[#F5F6F5]/70 dark:hover:bg-[#222724]/50 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-[#202321] text-white flex items-center justify-center shrink-0">
                              <Sliders className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono-tabular font-semibold text-[#202321] dark:text-[#F2F4F2]">
                                  {p.name}
                                </span>
                                {p.isDefaultBuiltIn && (
                                  <span className="text-[11px] text-[#858B87]">
                                    · {t.profiles.builtInBadge}
                                  </span>
                                )}
                              </div>
                              {p.comment && (
                                <div className="text-[11px] text-[#858B87] mt-0.5">
                                  {p.comment}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="text-xs font-semibold text-[#20C66B]">
                            {describeRateLimitHuman(p.rateLimit, language)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono-tabular text-xs text-[#202321] dark:text-[#D5DBD7]">
                          {p.rateLimit || '—'}
                        </td>
                        <td className="py-3.5 px-4 font-mono-tabular text-xs text-[#858B87]">
                          <span>{p.localAddress || 'none'}</span>
                          <span className="mx-1">→</span>
                          <span className="text-[#202321] dark:text-[#F2F4F2]">
                            {p.remoteAddress || 'none'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono-tabular text-xs text-[#858B87]">
                          enc={p.useEncryption} · only-one={p.onlyOne}
                        </td>
                        <td className="py-3.5 px-4">
                          <button
                            onClick={() =>
                              setExpandedProfileId(isExpanded ? null : p.id)
                            }
                            className="inline-flex items-center gap-1.5 text-xs font-mono-tabular font-semibold text-[#202321] dark:text-[#F2F4F2] hover:text-[#20C66B] cursor-pointer"
                          >
                            <Users className="w-3.5 h-3.5 text-[#20C66B]" />
                            <span>{p.assignedUserCount} users</span>
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-end">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openEditModal(p)}
                              className="p-1.5 rounded-lg text-[#858B87] hover:text-[#20C66B] hover:bg-[#F5F6F5] dark:hover:bg-[#222724] cursor-pointer"
                              title="Edit Profile"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            {!p.isDefaultBuiltIn && (
                              <button
                                onClick={() => setDeleteTargetProfile(p)}
                                className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                                title="Delete Profile"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-[#F5F6F5]/60 dark:bg-[#121513]/60">
                          <td colSpan={7} className="px-6 py-4">
                            <div className="text-xs font-medium text-[#858B87] mb-2">
                              PPP Secrets assigned to profile{' '}
                              <span className="font-mono-tabular font-semibold text-[#202321] dark:text-[#F2F4F2]">
                                {p.name}
                              </span>
                              :
                            </div>
                            {p.assignedUsers.length === 0 ? (
                              <div className="text-xs text-[#858B87]">
                                No PPP secrets currently use this profile.
                              </div>
                            ) : (
                              <div className="flex flex-wrap items-center gap-3">
                                {p.assignedUsers.map((uName) => {
                                  const found = users.find((u) => u.name === uName);
                                  return (
                                    <button
                                      key={uName}
                                      onClick={() => found && setInspectedUserId(found.id)}
                                      className="text-xs font-mono-tabular font-semibold text-[#20C66B] hover:underline cursor-pointer"
                                    >
                                      {uName}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit PPP Profile Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#202321]/50 backdrop-blur-xs p-4 overflow-y-auto"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-[#EDF0ED] dark:border-[#242926] bg-[#FFFFFF] dark:bg-[#181C19] shadow-2xl overflow-hidden my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#EDF0ED] dark:border-[#242926]">
              <div>
                <h2 className="text-base font-bold text-[#202321] dark:text-[#F2F4F2]">
                  {editingProfile
                    ? `Edit PPP Profile (${editingProfile.name})`
                    : t.profiles.createProfile}
                </h2>
                <p className="text-xs text-[#858B87] mt-0.5">
                  Configure RouterOS /ppp/profile attributes and asymmetric rate-limit.
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 text-[#858B87] hover:text-[#202321] rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => saveProfileMutation.mutate(e)}
              className="p-6 space-y-5 max-h-[78vh] overflow-y-auto"
            >
              {/* Bandwidth Editor Card */}
              <div className="p-4 rounded-2xl border border-[#EDF0ED] dark:border-[#242926] bg-[#F5F6F5] dark:bg-[#121513] space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#202321] dark:text-[#F2F4F2]">
                    <Gauge className="w-4 h-4 text-[#20C66B]" />
                    <span>{t.profiles.bandwidthPresets}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleBandwidthBuilderChange('', 'M', '', 'M')}
                    className="text-xs text-[#858B87] hover:text-[#202321] underline cursor-pointer"
                  >
                    Set Unlimited
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {ASYMMETRIC_PRESETS.map((preset) => (
                    <button
                      type="button"
                      key={preset.label}
                      onClick={() =>
                        handleBandwidthBuilderChange(
                          preset.up,
                          preset.upU,
                          preset.down,
                          preset.downU
                        )
                      }
                      className="px-3 py-1.5 rounded-full border border-[#EDF0ED] dark:border-[#2A302C] bg-[#FFFFFF] dark:bg-[#181C19] hover:border-[#20C66B] text-xs font-mono-tabular text-[#202321] dark:text-[#F2F4F2] transition-colors cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#202321] dark:text-[#D5DBD7] mb-1">
                      {t.profiles.clientDownload}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={downloadVal}
                        onChange={(e) =>
                          handleBandwidthBuilderChange(
                            uploadVal,
                            uploadUnit,
                            e.target.value,
                            downloadUnit
                          )
                        }
                        placeholder="e.g. 20"
                        className="flex-1 px-3 py-1.5 text-sm font-mono-tabular rounded-xl border border-[#EDF0ED] dark:border-[#2A302C] bg-[#FFFFFF] dark:bg-[#181C19] text-[#202321] dark:text-[#F2F4F2]"
                      />
                      <select
                        value={downloadUnit}
                        onChange={(e) =>
                          handleBandwidthBuilderChange(
                            uploadVal,
                            uploadUnit,
                            downloadVal,
                            e.target.value as 'k' | 'M' | 'G'
                          )
                        }
                        className="px-2.5 py-1.5 text-xs font-mono-tabular rounded-xl border border-[#EDF0ED] dark:border-[#2A302C] bg-[#FFFFFF] dark:bg-[#181C19] text-[#202321] dark:text-[#F2F4F2]"
                      >
                        <option value="k">Kbps (k)</option>
                        <option value="M">Mbps (M)</option>
                        <option value="G">Gbps (G)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#202321] dark:text-[#D5DBD7] mb-1">
                      {t.profiles.clientUpload}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={uploadVal}
                        onChange={(e) =>
                          handleBandwidthBuilderChange(
                            e.target.value,
                            uploadUnit,
                            downloadVal,
                            downloadUnit
                          )
                        }
                        placeholder="e.g. 10"
                        className="flex-1 px-3 py-1.5 text-sm font-mono-tabular rounded-xl border border-[#EDF0ED] dark:border-[#2A302C] bg-[#FFFFFF] dark:bg-[#181C19] text-[#202321] dark:text-[#F2F4F2]"
                      />
                      <select
                        value={uploadUnit}
                        onChange={(e) =>
                          handleBandwidthBuilderChange(
                            uploadVal,
                            e.target.value as 'k' | 'M' | 'G',
                            downloadVal,
                            downloadUnit
                          )
                        }
                        className="px-2.5 py-1.5 text-xs font-mono-tabular rounded-xl border border-[#EDF0ED] dark:border-[#2A302C] bg-[#FFFFFF] dark:bg-[#181C19] text-[#202321] dark:text-[#F2F4F2]"
                      >
                        <option value="k">Kbps (k)</option>
                        <option value="M">Mbps (M)</option>
                        <option value="G">Gbps (G)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#858B87] mb-1">
                    {t.profiles.routerOsRatePreview} (<code className="font-mono-tabular">rx-rate/tx-rate</code>)
                  </label>
                  <input
                    type="text"
                    value={rawRateLimit}
                    onChange={(e) => setRawRateLimit(e.target.value)}
                    placeholder="e.g. 10M/20M (Leave empty for unlimited)"
                    className="w-full px-3.5 py-1.5 text-sm font-mono-tabular rounded-xl border border-[#EDF0ED] dark:border-[#2A302C] bg-[#FFFFFF] dark:bg-[#181C19] text-[#20C66B] font-bold"
                  />
                </div>

                <div className="flex items-start gap-2 text-[11px] text-[#858B87]">
                  <Info className="w-3.5 h-3.5 text-[#20C66B] shrink-0 mt-0.5" />
                  <span>{t.profiles.rateSemanticsNote}</span>
                </div>
              </div>

              {/* Core Profile Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#202321] dark:text-[#D5DBD7] mb-1">
                    {t.profiles.fieldName} *
                  </label>
                  <input
                    required
                    disabled={editingProfile?.isDefaultBuiltIn}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Fiber-50M-20M"
                    className="w-full px-3.5 py-2 text-sm font-mono-tabular rounded-xl border border-[#EDF0ED] dark:border-[#2A302C] bg-[#F5F6F5] dark:bg-[#121513] text-[#202321] dark:text-[#F2F4F2] disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#202321] dark:text-[#D5DBD7] mb-1">
                    {t.profiles.fieldDnsServer}
                  </label>
                  <input
                    value={dnsServer}
                    onChange={(e) => setDnsServer(e.target.value)}
                    placeholder="e.g. 1.1.1.1,8.8.8.8"
                    className="w-full px-3.5 py-2 text-sm font-mono-tabular rounded-xl border border-[#EDF0ED] dark:border-[#2A302C] bg-[#F5F6F5] dark:bg-[#121513] text-[#202321] dark:text-[#F2F4F2]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#202321] dark:text-[#D5DBD7] mb-1">
                    {t.profiles.fieldLocalAddress}
                  </label>
                  <input
                    value={localAddress}
                    onChange={(e) => setLocalAddress(e.target.value)}
                    placeholder="e.g. 100.64.14.1"
                    className="w-full px-3.5 py-2 text-sm font-mono-tabular rounded-xl border border-[#EDF0ED] dark:border-[#2A302C] bg-[#F5F6F5] dark:bg-[#121513] text-[#202321] dark:text-[#F2F4F2]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#202321] dark:text-[#D5DBD7] mb-1">
                    {t.profiles.fieldRemoteAddress}
                  </label>
                  <input
                    value={remoteAddress}
                    onChange={(e) => setRemoteAddress(e.target.value)}
                    placeholder="e.g. pool-ftth-metro"
                    className="w-full px-3.5 py-2 text-sm font-mono-tabular rounded-xl border border-[#EDF0ED] dark:border-[#2A302C] bg-[#F5F6F5] dark:bg-[#121513] text-[#202321] dark:text-[#F2F4F2]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#202321] dark:text-[#D5DBD7] mb-1">
                    {t.profiles.fieldSessionTimeout}
                  </label>
                  <input
                    value={sessionTimeout}
                    onChange={(e) => setSessionTimeout(e.target.value)}
                    placeholder="e.g. 7d 00:00:00"
                    className="w-full px-3.5 py-2 text-sm font-mono-tabular rounded-xl border border-[#EDF0ED] dark:border-[#2A302C] bg-[#F5F6F5] dark:bg-[#121513] text-[#202321] dark:text-[#F2F4F2]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#202321] dark:text-[#D5DBD7] mb-1">
                    {t.profiles.fieldIdleTimeout}
                  </label>
                  <input
                    value={idleTimeout}
                    onChange={(e) => setIdleTimeout(e.target.value)}
                    placeholder="e.g. 00:30:00"
                    className="w-full px-3.5 py-2 text-sm font-mono-tabular rounded-xl border border-[#EDF0ED] dark:border-[#2A302C] bg-[#F5F6F5] dark:bg-[#121513] text-[#202321] dark:text-[#F2F4F2]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#202321] dark:text-[#D5DBD7] mb-1">
                    {t.profiles.fieldOnlyOne}
                  </label>
                  <select
                    value={onlyOne}
                    onChange={(e) => setOnlyOne(e.target.value as OnlyOneOption)}
                    className="w-full px-3.5 py-2 text-sm font-mono-tabular rounded-xl border border-[#EDF0ED] dark:border-[#2A302C] bg-[#F5F6F5] dark:bg-[#121513] text-[#202321] dark:text-[#F2F4F2]"
                  >
                    <option value="default">default</option>
                    <option value="yes">yes</option>
                    <option value="no">no</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#202321] dark:text-[#D5DBD7] mb-1">
                    {t.profiles.fieldUseEncryption}
                  </label>
                  <select
                    value={useEncryption}
                    onChange={(e) => setUseEncryption(e.target.value as UseEncryptionOption)}
                    className="w-full px-3.5 py-2 text-sm font-mono-tabular rounded-xl border border-[#EDF0ED] dark:border-[#2A302C] bg-[#F5F6F5] dark:bg-[#121513] text-[#202321] dark:text-[#F2F4F2]"
                  >
                    <option value="default">default</option>
                    <option value="yes">yes</option>
                    <option value="no">no</option>
                    <option value="required">required</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#202321] dark:text-[#D5DBD7] mb-1">
                    {t.profiles.fieldChangeTcpMss}
                  </label>
                  <select
                    value={changeTcpMss}
                    onChange={(e) => setChangeTcpMss(e.target.value as ChangeTcpMssOption)}
                    className="w-full px-3.5 py-2 text-sm font-mono-tabular rounded-xl border border-[#EDF0ED] dark:border-[#2A302C] bg-[#F5F6F5] dark:bg-[#121513] text-[#202321] dark:text-[#F2F4F2]"
                  >
                    <option value="default">default</option>
                    <option value="yes">yes</option>
                    <option value="no">no</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#202321] dark:text-[#D5DBD7] mb-1">
                    {t.profiles.fieldComment}
                  </label>
                  <input
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Profile description..."
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-[#EDF0ED] dark:border-[#2A302C] bg-[#F5F6F5] dark:bg-[#121513] text-[#202321] dark:text-[#F2F4F2]"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-[#EDF0ED] dark:border-[#242926] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-full border border-[#EDF0ED] dark:border-[#2A302C] text-xs font-medium text-[#858B87]"
                >
                  {t.users.cancel}
                </button>
                <button
                  type="submit"
                  disabled={saveProfileMutation.isPending}
                  className="px-5 py-2 rounded-full bg-[#20C66B] hover:bg-[#1AAF5E] text-white text-xs font-semibold cursor-pointer"
                >
                  {saveProfileMutation.isPending ? 'Saving...' : t.users.saveUpdate}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Profile Confirmation Modal */}
      {deleteTargetProfile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#202321]/50 backdrop-blur-xs p-4"
          onClick={() => setDeleteTargetProfile(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[#EDF0ED] dark:border-[#242926] bg-[#FFFFFF] dark:bg-[#181C19] p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-[#202321] dark:text-[#F2F4F2]">
              Delete PPP Profile '{deleteTargetProfile.name}'?
            </h3>

            {deleteTargetProfile.assignedUserCount > 0 && (
              <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                <div>
                  <p className="font-semibold">
                    Assigned to {deleteTargetProfile.assignedUserCount} PPP secret(s):
                  </p>
                  <p className="mt-1">{t.profiles.inUseDeleteWarning}</p>
                </div>
              </div>
            )}

            <p className="text-xs text-[#858B87]">
              This removes profile <code className="font-mono-tabular">{deleteTargetProfile.id}</code>{' '}
              from RouterOS <code className="font-mono-tabular">/ppp/profile</code>.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteTargetProfile(null)}
                className="px-4 py-2 rounded-full border border-[#EDF0ED] dark:border-[#2A302C] text-xs font-medium text-[#858B87]"
              >
                {t.users.cancel}
              </button>
              <button
                onClick={() => deleteProfileMutation.mutate(deleteTargetProfile.id)}
                disabled={deleteProfileMutation.isPending}
                className="px-4 py-2 rounded-full bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold cursor-pointer"
              >
                Delete Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
