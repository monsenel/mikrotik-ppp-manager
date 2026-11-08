import React, { useState, useMemo, useEffect } from 'react';
import { flexRender, SortingState } from '@tanstack/react-table';
import {
  useLegacyTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  LegacyColumnDef,
} from '@tanstack/react-table/legacy';
import { useForm, Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  UserPlus,
  RefreshCw,
  ArrowUpDown,
  Edit3,
  Eye,
  ShieldCheck,
  ShieldOff,
  Unplug,
  Trash2,
  X,
  KeyRound,
  CheckSquare,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { mikrotikApi } from '../lib/apiClient';
import { CreateOrUpdatePppUserDto, PppServiceType, PppUser } from '../types/mikrotik';

const pppUserFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Username is required')
    .max(64, 'Max 64 characters')
    .regex(/^[a-zA-Z0-9._@-]+$/, 'Only letters, numbers, dots, underscores, @, and hyphens allowed'),
  password: z.string().max(128).optional(),
  service: z.enum(['any', 'pppoe', 'pptp', 'l2tp', 'ovpn', 'sstp']),
  profile: z.string().min(1, 'Profile is required'),
  localAddress: z.string().max(64).optional(),
  remoteAddress: z.string().max(64).optional(),
  callerId: z.string().max(64).optional(),
  routes: z.string().max(256).optional(),
  limitBytesIn: z.number().min(0).optional(),
  limitBytesOut: z.number().min(0).optional(),
  comment: z.string().max(255).optional(),
  disabled: z.boolean().optional(),
});

interface PppUserFormValues {
  name: string;
  password?: string;
  service: PppServiceType;
  profile: string;
  localAddress?: string;
  remoteAddress?: string;
  callerId?: string;
  routes?: string;
  limitBytesIn?: number;
  limitBytesOut?: number;
  comment?: string;
  disabled?: boolean;
}

interface UsersViewProps {
  externalEditUser: PppUser | null;
  onClearExternalEditUser: () => void;
}

export const UsersView: React.FC<UsersViewProps> = ({
  externalEditUser,
  onClearExternalEditUser,
}) => {
  const {
    mode,
    t,
    globalSearch,
    setInspectedUserId,
    triggerCreateUserModal,
    setTriggerCreateUserModal,
    addToast,
  } = useApp();

  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [profileFilter, setProfileFilter] = useState('ALL');
  const [serviceFilter, setServiceFilter] = useState('ALL');
  const [accountStatusFilter, setAccountStatusFilter] = useState<'ALL' | 'ENABLED' | 'DISABLED'>('ALL');
  const [connStatusFilter, setConnStatusFilter] = useState<'ALL' | 'ONLINE' | 'OFFLINE'>('ALL');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modals state
  const [isFormModalOpen, setFormModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<PppUser | null>(null);
  const [deleteTargetUser, setDeleteTargetUser] = useState<PppUser | null>(null);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [bulkProfileModalOpen, setBulkProfileModalOpen] = useState(false);
  const [bulkTargetProfile, setBulkTargetProfile] = useState('default');

  const {
    data: users = [],
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['ppp-users', mode],
    queryFn: mikrotikApi.getUsers,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['ppp-profiles', mode],
    queryFn: mikrotikApi.getProfiles,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PppUserFormValues>({
    resolver: zodResolver(pppUserFormSchema) as unknown as Resolver<PppUserFormValues>,
    defaultValues: {
      name: '',
      password: '',
      service: 'pppoe',
      profile: 'default',
      localAddress: '',
      remoteAddress: '',
      callerId: '',
      routes: '',
      limitBytesIn: 0,
      limitBytesOut: 0,
      comment: '',
      disabled: false,
    },
  });

  const openCreateModal = () => {
    setEditingUser(null);
    reset({
      name: '',
      password: '',
      service: 'pppoe',
      profile: profiles[0]?.name || 'default',
      localAddress: '',
      remoteAddress: '',
      callerId: '',
      routes: '',
      limitBytesIn: 0,
      limitBytesOut: 0,
      comment: '',
      disabled: false,
    });
    setFormModalOpen(true);
  };

  const openEditModal = (user: PppUser) => {
    setEditingUser(user);
    reset({
      name: user.name,
      password: '', // Never expose existing password
      service: user.service,
      profile: user.profile,
      localAddress: user.localAddress,
      remoteAddress: user.remoteAddress,
      callerId: user.callerId,
      routes: user.routes,
      limitBytesIn: user.limitBytesIn,
      limitBytesOut: user.limitBytesOut,
      comment: user.comment,
      disabled: user.disabled,
    });
    setFormModalOpen(true);
  };

  useEffect(() => {
    if (triggerCreateUserModal) {
      openCreateModal();
      setTriggerCreateUserModal(false);
    }
  }, [triggerCreateUserModal]);

  useEffect(() => {
    if (externalEditUser) {
      openEditModal(externalEditUser);
      onClearExternalEditUser();
    }
  }, [externalEditUser]);

  useEffect(() => {
    if (globalSearch) {
      setSearchQuery(globalSearch);
    }
  }, [globalSearch]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['ppp-users'] });
    queryClient.invalidateQueries({ queryKey: ['ppp-profiles'] });
    queryClient.invalidateQueries({ queryKey: ['ppp-sessions'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
  };

  const saveUserMutation = useMutation({
    mutationFn: async (values: PppUserFormValues) => {
      const dto: CreateOrUpdatePppUserDto = {
        ...values,
        limitBytesIn: Number(values.limitBytesIn || 0),
        limitBytesOut: Number(values.limitBytesOut || 0),
        password: values.password?.trim() || undefined,
      };
      if (editingUser) {
        return mikrotikApi.updateUser(editingUser.id, dto);
      } else {
        if (!dto.password) {
          throw new Error('Password is required when creating a new PPP secret.');
        }
        return mikrotikApi.createUser(dto);
      }
    },
    onSuccess: (saved) => {
      setFormModalOpen(false);
      invalidateAll();
      addToast({
        type: 'success',
        title: editingUser ? 'PPP Secret Updated' : 'PPP Secret Created',
        description: `Successfully saved '${saved.name}' in /ppp/secret.`,
      });
    },
    onError: (err: Error) => {
      addToast({ type: 'error', title: 'Validation / RouterOS Error', description: err.message });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: (u: PppUser) =>
      u.disabled ? mikrotikApi.enableUser(u.id) : mikrotikApi.disableUser(u.id),
    onSuccess: (updated) => {
      invalidateAll();
      addToast({
        type: 'success',
        title: updated.disabled ? 'Account Disabled' : 'Account Enabled',
        description: `${updated.name} is now ${updated.disabled ? 'disabled' : 'enabled'}.`,
      });
    },
    onError: (err: Error) => {
      addToast({ type: 'error', title: 'Status Change Failed', description: err.message });
    },
  });

  const disconnectUserMutation = useMutation({
    mutationFn: (username: string) => mikrotikApi.disconnectUserSessions(username),
    onSuccess: (res, username) => {
      invalidateAll();
      addToast({
        type: 'success',
        title: 'Active Session Disconnected',
        description: `Disconnected ${res.disconnected} active tunnel(s) for ${username}.`,
      });
    },
    onError: (err: Error) => {
      addToast({ type: 'error', title: 'Disconnect Failed', description: err.message });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => mikrotikApi.deleteUser(id),
    onSuccess: () => {
      setDeleteTargetUser(null);
      invalidateAll();
      addToast({
        type: 'success',
        title: 'PPP Secret Removed',
        description: 'Deleted subscriber account from /ppp/secret.',
      });
    },
    onError: (err: Error) => {
      addToast({ type: 'error', title: 'Delete Failed', description: err.message });
    },
  });

  const bulkMutation = useMutation({
    mutationFn: mikrotikApi.bulkUserAction,
    onSuccess: (res) => {
      setSelectedIds(new Set());
      setBulkDeleteConfirmOpen(false);
      setBulkProfileModalOpen(false);
      invalidateAll();
      addToast({
        type: 'success',
        title: 'Bulk Operation Completed',
        description: `Updated ${res.affected} PPP secret(s) on RouterOS.`,
      });
    },
    onError: (err: Error) => {
      addToast({ type: 'error', title: 'Bulk Operation Failed', description: err.message });
    },
  });

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return users.filter((u) => {
      if (q) {
        const matchesSearch =
          u.name.toLowerCase().includes(q) ||
          u.localAddress.toLowerCase().includes(q) ||
          u.remoteAddress.toLowerCase().includes(q) ||
          (u.activeIp && u.activeIp.toLowerCase().includes(q)) ||
          u.callerId.toLowerCase().includes(q) ||
          u.comment.toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }
      if (profileFilter !== 'ALL' && u.profile !== profileFilter) return false;
      if (serviceFilter !== 'ALL' && u.service !== serviceFilter) return false;
      if (accountStatusFilter === 'ENABLED' && u.disabled) return false;
      if (accountStatusFilter === 'DISABLED' && !u.disabled) return false;
      if (connStatusFilter === 'ONLINE' && !u.isOnline) return false;
      if (connStatusFilter === 'OFFLINE' && u.isOnline) return false;
      return true;
    });
  }, [
    users,
    searchQuery,
    profileFilter,
    serviceFilter,
    accountStatusFilter,
    connStatusFilter,
  ]);

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredUsers.length && filteredUsers.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredUsers.map((u) => u.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const columns = useMemo<LegacyColumnDef<PppUser>[]>(
    () => [
      {
        id: 'select',
        header: () => (
          <input
            type="checkbox"
            checked={
              filteredUsers.length > 0 && selectedIds.size === filteredUsers.length
            }
            onChange={toggleSelectAll}
            className="rounded border-[#EDF0ED] dark:border-[#2A302C] accent-[#20C66B] cursor-pointer"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={selectedIds.has(row.original.id)}
            onChange={() => toggleSelectOne(row.original.id)}
            className="rounded border-[#EDF0ED] dark:border-[#2A302C] accent-[#20C66B] cursor-pointer"
          />
        ),
      },
      {
        accessorKey: 'name',
        header: t.users.colUsername,
        cell: ({ row }) => {
          const u = row.original;
          return (
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold font-mono-tabular text-white ${
                  u.isOnline ? 'bg-[#20C66B]' : 'bg-[#202321]'
                }`}
              >
                {u.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <button
                  onClick={() => setInspectedUserId(u.id)}
                  className="font-mono-tabular font-semibold text-[#202321] dark:text-[#F2F4F2] hover:text-[#20C66B] transition-colors text-start cursor-pointer"
                >
                  {u.name}
                </button>
                {u.comment && (
                  <div className="text-[11px] text-[#858B87] truncate max-w-[210px]">
                    {u.comment}
                  </div>
                )}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'service',
        header: t.users.colService,
        cell: ({ row }) => (
          <span className="font-mono-tabular uppercase text-xs text-[#858B87]">
            {row.original.service}
          </span>
        ),
      },
      {
        accessorKey: 'profile',
        header: t.users.colProfile,
        cell: ({ row }) => (
          <span className="font-mono-tabular text-xs font-medium text-[#202321] dark:text-[#D5DBD7]">
            {row.original.profile}
          </span>
        ),
      },
      {
        id: 'addresses',
        header: t.users.colAddresses,
        cell: ({ row }) => {
          const u = row.original;
          return (
            <div className="font-mono-tabular text-xs text-[#858B87]">
              <span>{u.localAddress || 'pool'}</span>
              <span className="mx-1">→</span>
              <span className="text-[#202321] dark:text-[#F2F4F2]">
                {u.remoteAddress || 'dynamic'}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: 'disabled',
        header: t.users.colAccountStatus,
        cell: ({ row }) => {
          const disabled = row.original.disabled;
          return disabled ? (
            <span className="text-xs font-medium text-rose-500">
              {t.users.statusDisabled}
            </span>
          ) : (
            <span className="text-xs font-semibold text-[#20C66B]">
              {t.users.statusEnabled}
            </span>
          );
        },
      },
      {
        accessorKey: 'isOnline',
        header: t.users.colConnStatus,
        cell: ({ row }) => {
          const online = row.original.isOnline;
          return online ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#20C66B]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#20C66B]" />
              {t.users.statusOnline}
            </span>
          ) : (
            <span className="text-xs text-[#858B87]">
              {t.users.statusOffline}
            </span>
          );
        },
      },
      {
        accessorKey: 'activeIp',
        header: t.users.colActiveIp,
        cell: ({ row }) => (
          <span className="font-mono-tabular text-xs text-[#202321] dark:text-[#F2F4F2]">
            {row.original.activeIp || '—'}
          </span>
        ),
      },
      {
        accessorKey: 'uptimeSeconds',
        header: t.users.colUptime,
        cell: ({ row }) => (
          <span className="font-mono-tabular text-xs text-[#858B87]">
            {row.original.uptime || '—'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: () => <div className="text-end">{t.users.colActions}</div>,
        cell: ({ row }) => {
          const u = row.original;
          return (
            <div className="flex items-center justify-end gap-1">
              <button
                onClick={() => setInspectedUserId(u.id)}
                className="p-1.5 rounded-lg text-[#858B87] hover:text-[#202321] dark:hover:text-white hover:bg-[#F5F6F5] dark:hover:bg-[#222724] transition-colors cursor-pointer"
                title={t.users.actionDetails}
              >
                <Eye className="w-4 h-4" />
              </button>
              <button
                onClick={() => openEditModal(u)}
                className="p-1.5 rounded-lg text-[#858B87] hover:text-[#20C66B] hover:bg-[#F5F6F5] dark:hover:bg-[#222724] transition-colors cursor-pointer"
                title={t.users.actionEdit}
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => toggleStatusMutation.mutate(u)}
                className="p-1.5 rounded-lg text-[#858B87] hover:text-[#20C66B] hover:bg-[#F5F6F5] dark:hover:bg-[#222724] transition-colors cursor-pointer"
                title={u.disabled ? t.users.actionEnable : t.users.actionDisable}
              >
                {u.disabled ? (
                  <ShieldCheck className="w-4 h-4 text-[#20C66B]" />
                ) : (
                  <ShieldOff className="w-4 h-4 text-amber-500" />
                )}
              </button>
              {u.isOnline && (
                <button
                  onClick={() => disconnectUserMutation.mutate(u.name)}
                  className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-500/10 transition-colors cursor-pointer"
                  title={t.users.actionDisconnect}
                >
                  <Unplug className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setDeleteTargetUser(u)}
                className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                title={t.users.actionDelete}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        },
      },
    ],
    [filteredUsers, selectedIds, t]
  );

  const table = useLegacyTable({
    data: filteredUsers,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageIndex: 0, pageSize: 10 },
    },
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#202321] dark:text-[#F2F4F2]">
            {t.users.title}
          </h2>
          <p className="text-xs text-[#858B87] mt-0.5">{t.users.subtitle}</p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => refetch()}
            className="px-4 py-2.5 rounded-full border border-[#EDF0ED] dark:border-[#242926] bg-[#FFFFFF] dark:bg-[#1C211E] hover:border-[#20C66B]/40 text-xs font-medium text-[#202321] dark:text-[#F2F4F2] flex items-center gap-2 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#858B87] ${isFetching ? 'animate-spin' : ''}`} />
            {t.users.refresh}
          </button>
          <button
            onClick={openCreateModal}
            className="px-5 py-2.5 rounded-full bg-[#20C66B] hover:bg-[#1AAF5E] text-white text-xs font-semibold flex items-center gap-2 shadow-[0_6px_16px_rgba(32,198,107,0.22)] transition-all whitespace-nowrap shrink-0 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            {t.users.createUser}
          </button>
        </div>
      </div>

      {/* Filters Bento Card */}
      <div className="p-5 rounded-2xl border border-[#EDF0ED] dark:border-[#242926] bg-[#FFFFFF] dark:bg-[#1C211E] shadow-[0_2px_12px_rgba(32,35,33,0.03)] space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 text-[#858B87] absolute start-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.users.searchPlaceholder}
              className="w-full ps-9 pe-3.5 py-2 text-xs rounded-xl border border-[#EDF0ED] dark:border-[#2A302C] bg-[#F5F6F5] dark:bg-[#121513] text-[#202321] dark:text-[#F2F4F2] placeholder-[#858B87] focus:outline-none focus:border-[#20C66B]"
            />
          </div>

          <select
            value={profileFilter}
            onChange={(e) => setProfileFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-[#EDF0ED] dark:border-[#2A302C] bg-[#F5F6F5] dark:bg-[#121513] text-[#202321] dark:text-[#F2F4F2] focus:outline-none focus:border-[#20C66B]"
          >
            <option value="ALL">{t.users.allProfiles}</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>

          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-[#EDF0ED] dark:border-[#2A302C] bg-[#F5F6F5] dark:bg-[#121513] text-[#202321] dark:text-[#F2F4F2] focus:outline-none focus:border-[#20C66B]"
          >
            <option value="ALL">{t.users.allServices}</option>
            <option value="pppoe">PPPoE</option>
            <option value="l2tp">L2TP</option>
            <option value="sstp">SSTP</option>
            <option value="ovpn">OpenVPN</option>
            <option value="pptp">PPTP</option>
            <option value="any">Any Service</option>
          </select>

          <div className="flex items-center gap-2">
            <select
              value={accountStatusFilter}
              onChange={(e) =>
                setAccountStatusFilter(e.target.value as 'ALL' | 'ENABLED' | 'DISABLED')
              }
              className="w-1/2 px-2.5 py-2 text-xs rounded-xl border border-[#EDF0ED] dark:border-[#2A302C] bg-[#F5F6F5] dark:bg-[#121513] text-[#202321] dark:text-[#F2F4F2]"
            >
              <option value="ALL">{t.users.allAccountStatus}</option>
              <option value="ENABLED">{t.users.enabledOnly}</option>
              <option value="DISABLED">{t.users.disabledOnly}</option>
            </select>

            <select
              value={connStatusFilter}
              onChange={(e) =>
                setConnStatusFilter(e.target.value as 'ALL' | 'ONLINE' | 'OFFLINE')
              }
              className="w-1/2 px-2.5 py-2 text-xs rounded-xl border border-[#EDF0ED] dark:border-[#2A302C] bg-[#F5F6F5] dark:bg-[#121513] text-[#202321] dark:text-[#F2F4F2]"
            >
              <option value="ALL">{t.users.allConnStatus}</option>
              <option value="ONLINE">{t.users.onlineOnly}</option>
              <option value="OFFLINE">{t.users.offlineOnly}</option>
            </select>
          </div>
        </div>

        {/* Bulk Operations Bar */}
        {selectedIds.size > 0 && (
          <div className="pt-3 border-t border-[#EDF0ED] dark:border-[#242926] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#20C66B]">
              <CheckSquare className="w-4 h-4" />
              <span className="font-mono-tabular">
                {selectedIds.size} {t.users.bulkSelected}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() =>
                  bulkMutation.mutate({ ids: Array.from(selectedIds), action: 'enable' })
                }
                disabled={bulkMutation.isPending}
                className="px-3.5 py-1.5 rounded-full bg-[#20C66B] text-white text-xs font-semibold cursor-pointer"
              >
                {t.users.bulkEnable}
              </button>
              <button
                onClick={() =>
                  bulkMutation.mutate({ ids: Array.from(selectedIds), action: 'disable' })
                }
                disabled={bulkMutation.isPending}
                className="px-3.5 py-1.5 rounded-full border border-[#EDF0ED] dark:border-[#2A302C] bg-[#F5F6F5] dark:bg-[#121513] text-[#202321] dark:text-[#F2F4F2] text-xs font-medium cursor-pointer"
              >
                {t.users.bulkDisable}
              </button>
              <button
                onClick={() => {
                  setBulkTargetProfile(profiles[0]?.name || 'default');
                  setBulkProfileModalOpen(true);
                }}
                className="px-3.5 py-1.5 rounded-full border border-[#EDF0ED] dark:border-[#2A302C] bg-[#F5F6F5] dark:bg-[#121513] text-[#202321] dark:text-[#F2F4F2] text-xs font-medium cursor-pointer"
              >
                {t.users.bulkAssignProfile}
              </button>
              <button
                onClick={() => setBulkDeleteConfirmOpen(true)}
                className="px-3.5 py-1.5 rounded-full bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold cursor-pointer"
              >
                {t.users.bulkDelete}
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="px-2.5 py-1.5 text-xs text-[#858B87] hover:text-[#202321] cursor-pointer"
              >
                {t.users.clearSelection}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Data Table Bento Card */}
      <div className="rounded-2xl border border-[#EDF0ED] dark:border-[#242926] bg-[#FFFFFF] dark:bg-[#1C211E] shadow-[0_2px_12px_rgba(32,35,33,0.03)] overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-11 bg-[#F5F6F5] dark:bg-[#121513] rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-16 px-4 text-center space-y-3">
            <div className="text-sm font-bold text-[#202321] dark:text-[#F2F4F2]">
              {t.users.emptyTitle}
            </div>
            <p className="text-xs text-[#858B87] max-w-md mx-auto">{t.users.emptySubtitle}</p>
            <button
              onClick={openCreateModal}
              className="px-5 py-2.5 rounded-full bg-[#20C66B] hover:bg-[#1AAF5E] text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              {t.users.createUser}
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-start border-collapse">
                <thead>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr
                      key={headerGroup.id}
                      className="border-b border-[#EDF0ED] dark:border-[#242926] bg-[#F5F6F5]/60 dark:bg-[#121513]/50 text-[11px] font-semibold text-[#858B87]"
                    >
                      {headerGroup.headers.map((header) => (
                        <th key={header.id} className="py-3.5 px-4 text-start whitespace-nowrap">
                          {header.isPlaceholder ? null : (
                            <div
                              onClick={header.column.getToggleSortingHandler()}
                              className={
                                header.column.getCanSort()
                                  ? 'flex items-center gap-1.5 cursor-pointer select-none hover:text-[#202321] dark:hover:text-white'
                                  : ''
                              }
                            >
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                              {header.column.getCanSort() && (
                                <ArrowUpDown className="w-3 h-3 text-[#858B87]" />
                              )}
                            </div>
                          )}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody className="divide-y divide-[#EDF0ED] dark:divide-[#242926] text-sm">
                  {table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-[#F5F6F5]/70 dark:hover:bg-[#222724]/50 transition-colors"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="py-3.5 px-4 whitespace-nowrap">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="px-5 py-3.5 border-t border-[#EDF0ED] dark:border-[#242926] flex items-center justify-between text-xs text-[#858B87]">
              <div className="font-mono-tabular">
                Showing {table.getRowModel().rows.length} of {filteredUsers.length} PPP secrets
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="px-3.5 py-1.5 rounded-full border border-[#EDF0ED] dark:border-[#242926] disabled:opacity-40 hover:bg-[#F5F6F5] dark:hover:bg-[#222724] text-[#202321] dark:text-[#F2F4F2] cursor-pointer"
                >
                  Previous
                </button>
                <span className="font-mono-tabular">
                  Page {table.getState().pagination.pageIndex + 1} of{' '}
                  {Math.max(1, table.getPageCount())}
                </span>
                <button
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className="px-3.5 py-1.5 rounded-full border border-[#EDF0ED] dark:border-[#242926] disabled:opacity-40 hover:bg-[#F5F6F5] dark:hover:bg-[#222724] text-[#202321] dark:text-[#F2F4F2] cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Create / Edit PPP Secret Modal */}
      {isFormModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#202321]/50 backdrop-blur-xs p-4 overflow-y-auto"
          onClick={() => setFormModalOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-[#EDF0ED] dark:border-[#242926] bg-[#FFFFFF] dark:bg-[#181C19] shadow-2xl overflow-hidden my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#EDF0ED] dark:border-[#242926]">
              <div>
                <h2 className="text-base font-bold text-[#202321] dark:text-[#F2F4F2]">
                  {editingUser ? t.users.formEditTitle : t.users.formCreateTitle}
                </h2>
                <p className="text-xs text-[#858B87] mt-0.5">{t.users.formSubtitle}</p>
              </div>
              <button
                onClick={() => setFormModalOpen(false)}
                className="p-1.5 text-[#858B87] hover:text-[#202321] dark:hover:text-white rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit((values) => saveUserMutation.mutate(values))}
              className="p-6 space-y-4 max-h-[75vh] overflow-y-auto"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#202321] dark:text-[#D5DBD7] mb-1.5">
                    {t.users.fieldUsername} *
                  </label>
                  <input
                    {...register('name')}
                    placeholder="e.g. ftth.tehran.205"
                    className="w-full px-3.5 py-2 text-sm font-mono-tabular rounded-xl border border-[#EDF0ED] dark:border-[#2A302C] bg-[#F5F6F5] dark:bg-[#121513] text-[#202321] dark:text-[#F2F4F2] focus:outline-none focus:border-[#20C66B]"
                  />
                  {errors.name && (
                    <p className="text-xs text-rose-500 mt-1">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#202321] dark:text-[#D5DBD7] mb-1.5">
                    <span className="inline-flex items-center gap-1">
                      <KeyRound className="w-3.5 h-3.5 text-[#20C66B]" />
                      {t.users.fieldPassword} {!editingUser && '*'}
                    </span>
                  </label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    {...register('password')}
                    placeholder={
                      editingUser ? t.users.fieldPasswordEditHint : 'Enter strong PPP secret password'
                    }
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-[#EDF0ED] dark:border-[#2A302C] bg-[#F5F6F5] dark:bg-[#121513] text-[#202321] dark:text-[#F2F4F2] focus:outline-none focus:border-[#20C66B]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#202321] dark:text-[#D5DBD7] mb-1.5">
                    {t.users.fieldService}
                  </label>
                  <select
                    {...register('service')}
                    className="w-full px-3.5 py-2 text-sm font-mono-tabular rounded-xl border border-[#EDF0ED] dark:border-[#2A302C] bg-[#F5F6F5] dark:bg-[#121513] text-[#202321] dark:text-[#F2F4F2] focus:outline-none focus:border-[#20C66B]"
                  >
                    <option value="any">any (All PPP Protocols)</option>
                    <option value="pppoe">pppoe</option>
                    <option value="l2tp">l2tp</option>
                    <option value="sstp">sstp</option>
                    <option value="ovpn">ovpn</option>
                    <option value="pptp">pptp</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#202321] dark:text-[#D5DBD7] mb-1.5">
                    {t.users.fieldProfile}
                  </label>
                  <select
                    {...register('profile')}
                    className="w-full px-3.5 py-2 text-sm font-mono-tabular rounded-xl border border-[#EDF0ED] dark:border-[#2A302C] bg-[#F5F6F5] dark:bg-[#121513] text-[#202321] dark:text-[#F2F4F2] focus:outline-none focus:border-[#20C66B]"
                  >
                    {profiles.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.name} {p.rateLimit ? `(${p.rateLimit})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#202321] dark:text-[#D5DBD7] mb-1.5">
                    {t.users.fieldLocalAddress}
                  </label>
                  <input
                    {...register('localAddress')}
                    placeholder="e.g. 100.64.14.1 (Optional)"
                    className="w-full px-3.5 py-2 text-sm font-mono-tabular rounded-xl border border-[#EDF0ED] dark:border-[#2A302C] bg-[#F5F6F5] dark:bg-[#121513] text-[#202321] dark:text-[#F2F4F2] focus:outline-none focus:border-[#20C66B]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#202321] dark:text-[#D5DBD7] mb-1.5">
                    {t.users.fieldRemoteAddress}
                  </label>
                  <input
                    {...register('remoteAddress')}
                    placeholder="e.g. 100.64.14.205 (Optional)"
                    className="w-full px-3.5 py-2 text-sm font-mono-tabular rounded-xl border border-[#EDF0ED] dark:border-[#2A302C] bg-[#F5F6F5] dark:bg-[#121513] text-[#202321] dark:text-[#F2F4F2] focus:outline-none focus:border-[#20C66B]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#202321] dark:text-[#D5DBD7] mb-1.5">
                    {t.users.fieldCallerId}
                  </label>
                  <input
                    {...register('callerId')}
                    placeholder="e.g. DC:2C:6E:4A:11:09 or IP"
                    className="w-full px-3.5 py-2 text-sm font-mono-tabular rounded-xl border border-[#EDF0ED] dark:border-[#2A302C] bg-[#F5F6F5] dark:bg-[#121513] text-[#202321] dark:text-[#F2F4F2] focus:outline-none focus:border-[#20C66B]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#202321] dark:text-[#D5DBD7] mb-1.5">
                    {t.users.fieldRoutes}
                  </label>
                  <input
                    {...register('routes')}
                    placeholder="e.g. 192.168.50.0/24 172.22.10.20 1"
                    className="w-full px-3.5 py-2 text-sm font-mono-tabular rounded-xl border border-[#EDF0ED] dark:border-[#2A302C] bg-[#F5F6F5] dark:bg-[#121513] text-[#202321] dark:text-[#F2F4F2] focus:outline-none focus:border-[#20C66B]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#202321] dark:text-[#D5DBD7] mb-1.5">
                    {t.users.fieldLimitBytesIn}
                  </label>
                  <input
                    type="number"
                    min={0}
                    {...register('limitBytesIn', { valueAsNumber: true })}
                    className="w-full px-3.5 py-2 text-sm font-mono-tabular rounded-xl border border-[#EDF0ED] dark:border-[#2A302C] bg-[#F5F6F5] dark:bg-[#121513] text-[#202321] dark:text-[#F2F4F2]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#202321] dark:text-[#D5DBD7] mb-1.5">
                    {t.users.fieldLimitBytesOut}
                  </label>
                  <input
                    type="number"
                    min={0}
                    {...register('limitBytesOut', { valueAsNumber: true })}
                    className="w-full px-3.5 py-2 text-sm font-mono-tabular rounded-xl border border-[#EDF0ED] dark:border-[#2A302C] bg-[#F5F6F5] dark:bg-[#121513] text-[#202321] dark:text-[#F2F4F2]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#202321] dark:text-[#D5DBD7] mb-1.5">
                  {t.users.fieldComment}
                </label>
                <input
                  {...register('comment')}
                  placeholder="Subscriber unit, circuit ID, or billing reference..."
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-[#EDF0ED] dark:border-[#2A302C] bg-[#F5F6F5] dark:bg-[#121513] text-[#202321] dark:text-[#F2F4F2]"
                />
              </div>

              <label className="flex items-center gap-2.5 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  {...register('disabled')}
                  className="rounded border-[#EDF0ED] accent-[#20C66B]"
                />
                <span className="text-xs font-medium text-[#202321] dark:text-[#D5DBD7]">
                  {t.users.fieldDisabled}
                </span>
              </label>

              <div className="pt-4 border-t border-[#EDF0ED] dark:border-[#242926] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setFormModalOpen(false)}
                  className="px-4 py-2 rounded-full border border-[#EDF0ED] dark:border-[#2A302C] text-xs font-medium text-[#858B87] hover:text-[#202321] dark:hover:text-white"
                >
                  {t.users.cancel}
                </button>
                <button
                  type="submit"
                  disabled={saveUserMutation.isPending}
                  className="px-5 py-2 rounded-full bg-[#20C66B] hover:bg-[#1AAF5E] text-white text-xs font-semibold cursor-pointer"
                >
                  {saveUserMutation.isPending
                    ? 'Saving...'
                    : editingUser
                    ? t.users.saveUpdate
                    : t.users.saveCreate}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Single Delete Confirmation Modal */}
      {deleteTargetUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#202321]/50 backdrop-blur-xs p-4"
          onClick={() => setDeleteTargetUser(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[#EDF0ED] dark:border-[#242926] bg-[#FFFFFF] dark:bg-[#181C19] p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-[#202321] dark:text-[#F2F4F2]">
              {t.users.deleteConfirmTitle}
            </h3>
            <p className="text-xs text-[#858B87]">{t.users.deleteConfirmDesc}</p>
            <div className="p-3 rounded-xl bg-[#F5F6F5] dark:bg-[#121513] font-mono-tabular text-xs text-[#202321] dark:text-[#F2F4F2]">
              {deleteTargetUser.name} ({deleteTargetUser.id})
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteTargetUser(null)}
                className="px-4 py-2 rounded-full border border-[#EDF0ED] dark:border-[#2A302C] text-xs font-medium text-[#858B87]"
              >
                {t.users.cancel}
              </button>
              <button
                onClick={() => deleteUserMutation.mutate(deleteTargetUser.id)}
                disabled={deleteUserMutation.isPending}
                className="px-4 py-2 rounded-full bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold cursor-pointer"
              >
                Delete Secret
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {bulkDeleteConfirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#202321]/50 backdrop-blur-xs p-4"
          onClick={() => setBulkDeleteConfirmOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[#EDF0ED] dark:border-[#242926] bg-[#FFFFFF] dark:bg-[#181C19] p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-[#202321] dark:text-[#F2F4F2]">
              Delete {selectedIds.size} Selected PPP Secrets?
            </h3>
            <p className="text-xs text-[#858B87]">
              This action permanently removes {selectedIds.size} PPP secrets from RouterOS /ppp/secret.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setBulkDeleteConfirmOpen(false)}
                className="px-4 py-2 rounded-full border border-[#EDF0ED] dark:border-[#2A302C] text-xs font-medium text-[#858B87]"
              >
                {t.users.cancel}
              </button>
              <button
                onClick={() =>
                  bulkMutation.mutate({ ids: Array.from(selectedIds), action: 'delete' })
                }
                disabled={bulkMutation.isPending}
                className="px-4 py-2 rounded-full bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold cursor-pointer"
              >
                Confirm Bulk Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Profile Assignment Modal */}
      {bulkProfileModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#202321]/50 backdrop-blur-xs p-4"
          onClick={() => setBulkProfileModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[#EDF0ED] dark:border-[#242926] bg-[#FFFFFF] dark:bg-[#181C19] p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-[#202321] dark:text-[#F2F4F2]">
              {t.users.bulkAssignProfile} ({selectedIds.size})
            </h3>
            <div>
              <label className="block text-xs font-medium text-[#858B87] mb-1.5">
                Select Target PPP Profile
              </label>
              <select
                value={bulkTargetProfile}
                onChange={(e) => setBulkTargetProfile(e.target.value)}
                className="w-full px-3.5 py-2 text-sm font-mono-tabular rounded-xl border border-[#EDF0ED] dark:border-[#2A302C] bg-[#F5F6F5] dark:bg-[#121513] text-[#202321] dark:text-[#F2F4F2]"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name} {p.rateLimit ? `(${p.rateLimit})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setBulkProfileModalOpen(false)}
                className="px-4 py-2 rounded-full border border-[#EDF0ED] dark:border-[#2A302C] text-xs font-medium text-[#858B87]"
              >
                {t.users.cancel}
              </button>
              <button
                onClick={() =>
                  bulkMutation.mutate({
                    ids: Array.from(selectedIds),
                    action: 'assign-profile',
                    profile: bulkTargetProfile,
                  })
                }
                disabled={bulkMutation.isPending}
                className="px-5 py-2 rounded-full bg-[#20C66B] hover:bg-[#1AAF5E] text-white text-xs font-semibold cursor-pointer"
              >
                Apply Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
