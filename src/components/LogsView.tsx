import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, RefreshCw, CheckCircle2, XCircle, Shield } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { mikrotikApi } from '../lib/apiClient';

export const LogsView: React.FC = () => {
  const { t, mode } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  const {
    data: logs = [],
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['audit-logs', mode],
    queryFn: mikrotikApi.getAuditLogs,
  });

  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return logs.filter((entry) => {
      if (actionFilter !== 'ALL' && entry.action !== actionFilter) return false;
      if (q) {
        return (
          entry.administrator.toLowerCase().includes(q) ||
          entry.action.toLowerCase().includes(q) ||
          entry.target.toLowerCase().includes(q) ||
          entry.details.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [logs, searchQuery, actionFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#202321] dark:text-[#F2F4F2]">
            {t.logs.title}
          </h2>
          <p className="text-xs text-[#858B87] mt-0.5">{t.logs.subtitle}</p>
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
            placeholder={t.logs.searchPlaceholder}
            className="w-full ps-9 pe-3.5 py-2 text-xs rounded-xl border border-[#EDF0ED] dark:border-[#2A302C] bg-[#F5F6F5] dark:bg-[#121513] text-[#202321] dark:text-[#F2F4F2] placeholder-[#858B87] focus:outline-none focus:border-[#20C66B]"
          />
        </div>

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-3.5 py-2 text-xs rounded-xl border border-[#EDF0ED] dark:border-[#2A302C] bg-[#F5F6F5] dark:bg-[#121513] text-[#202321] dark:text-[#F2F4F2] font-mono-tabular focus:outline-none focus:border-[#20C66B]"
        >
          <option value="ALL">All Audit Actions</option>
          <option value="USER_CREATED">USER_CREATED</option>
          <option value="USER_UPDATED">USER_UPDATED</option>
          <option value="USER_DELETED">USER_DELETED</option>
          <option value="USER_ENABLED">USER_ENABLED</option>
          <option value="USER_DISABLED">USER_DISABLED</option>
          <option value="PROFILE_CREATED">PROFILE_CREATED</option>
          <option value="PROFILE_UPDATED">PROFILE_UPDATED</option>
          <option value="PROFILE_DELETED">PROFILE_DELETED</option>
          <option value="SESSION_DISCONNECTED">SESSION_DISCONNECTED</option>
          <option value="ROUTER_CONFIG_UPDATED">ROUTER_CONFIG_UPDATED</option>
          <option value="ROUTER_CONNECTION_TESTED">ROUTER_CONNECTION_TESTED</option>
        </select>
      </div>

      {/* Audit Table Card */}
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
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start border-collapse">
              <thead>
                <tr className="border-b border-[#EDF0ED] dark:border-[#242926] bg-[#F5F6F5]/60 dark:bg-[#121513]/50 text-[11px] font-semibold text-[#858B87]">
                  <th className="py-3.5 px-4 text-start">{t.logs.colTimestamp}</th>
                  <th className="py-3.5 px-4 text-start">{t.logs.colAdmin}</th>
                  <th className="py-3.5 px-4 text-start">{t.logs.colAction}</th>
                  <th className="py-3.5 px-4 text-start">{t.logs.colTarget}</th>
                  <th className="py-3.5 px-4 text-start">{t.logs.colDetails}</th>
                  <th className="py-3.5 px-4 text-start">{t.logs.colMode}</th>
                  <th className="py-3.5 px-4 text-end">{t.logs.colResult}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDF0ED] dark:divide-[#242926] text-sm">
                {filteredLogs.map((log, idx) => (
                  <tr
                    key={log.id}
                    className="hover:bg-[#F5F6F5]/70 dark:hover:bg-[#222724]/50 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-mono-tabular text-xs text-[#858B87] whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold font-mono-tabular text-white shrink-0 ${
                            idx % 2 === 0 ? 'bg-[#202321]' : 'bg-[#20C66B]'
                          }`}
                        >
                          {log.administrator.slice(0, 1).toUpperCase()}
                        </div>
                        <span className="font-mono-tabular text-xs font-medium text-[#202321] dark:text-[#F2F4F2]">
                          {log.administrator}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono-tabular text-xs font-semibold text-[#202321] dark:text-[#F2F4F2] whitespace-nowrap">
                      {log.action}
                    </td>
                    <td className="py-3.5 px-4 font-mono-tabular text-xs text-[#20C66B] font-semibold whitespace-nowrap">
                      {log.target}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-[#858B87]">
                      <div>{log.details}</div>
                      {log.errorMessage && (
                        <div className="text-rose-500 font-mono-tabular mt-0.5">
                          Error: {log.errorMessage}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono-tabular uppercase text-[11px] text-[#858B87] whitespace-nowrap">
                      {log.mode}
                    </td>
                    <td className="py-3.5 px-4 text-end whitespace-nowrap">
                      {log.result === 'SUCCESS' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#20C66B]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          SUCCESS
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-500">
                          <XCircle className="w-3.5 h-3.5" />
                          FAILURE
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="p-4 rounded-2xl border border-[#EDF0ED] dark:border-[#242926] bg-[#FFFFFF] dark:bg-[#1C211E] flex items-center gap-2.5 text-xs text-[#858B87]">
        <Shield className="w-4 h-4 text-[#20C66B] shrink-0" />
        <span>
          Zero-Plaintext Guarantee: Passwords submitted when creating or updating PPP secrets or
          RouterOS API credentials are stripped before audit log serialization.
        </span>
      </div>
    </div>
  );
};
