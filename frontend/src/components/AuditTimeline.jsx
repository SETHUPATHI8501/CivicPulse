import React from 'react';
import {
  Clock,
  CheckCircle2,
  UserCheck,
  FileText,
  AlertCircle,
  HelpCircle,
  XCircle,
  Shield,
  ArrowRight,
} from 'lucide-react';
import { formatDate } from '../utils/formatDate';

const actionConfigs = {
  SUBMITTED: {
    color: 'bg-teal-100 text-teal-800 border-teal-300',
    icon: FileText,
    label: 'Complaint Submitted',
  },
  ASSIGNED: {
    color: 'bg-navy-100 text-navy-800 border-navy-300',
    icon: UserCheck,
    label: 'Assigned to Municipal Officer',
  },
  STATUS_IN_PROGRESS: {
    color: 'bg-sky-100 text-sky-800 border-sky-300',
    icon: Clock,
    label: 'Work In Progress',
  },
  STATUS_NEEDS_INFO: {
    color: 'bg-purple-100 text-purple-800 border-purple-300',
    icon: HelpCircle,
    label: 'Additional Information Requested',
  },
  STATUS_REJECTED: {
    color: 'bg-rose-100 text-rose-800 border-rose-300',
    icon: XCircle,
    label: 'Issue Rejected',
  },
  RESOLVED: {
    color: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    icon: CheckCircle2,
    label: 'Issue Resolved',
  },
};

export default function AuditTimeline({ logs = [], className = '' }) {
  if (!logs || logs.length === 0) {
    return (
      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-500 text-center">
        No lifecycle audit events recorded yet.
      </div>
    );
  }

  // Sort logs by timestamp ascending (or id ascending)
  const sortedLogs = [...logs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  return (
    <div className={`flow-root ${className}`}>
      <ul className="-mb-8">
        {sortedLogs.map((log, idx) => {
          const isLast = idx === sortedLogs.length - 1;
          const config = actionConfigs[log.action] || {
            color: 'bg-slate-100 text-slate-800 border-slate-300',
            icon: Shield,
            label: log.action.replace(/^STATUS_/, ''),
          };
          const Icon = config.icon;

          return (
            <li key={log.id || idx}>
              <div className="relative pb-8">
                {!isLast && (
                  <span
                    className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-200"
                    aria-hidden="true"
                  />
                )}
                <div className="relative flex items-start space-x-3.5">
                  {/* Icon Node */}
                  <div
                    className={`
                      relative flex h-8 w-8 items-center justify-center rounded-full border shadow-2xs flex-shrink-0
                      ${config.color}
                    `}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-900">{config.label}</span>
                        {log.old_status && log.new_status && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            <span>{log.old_status}</span>
                            <ArrowRight className="w-2.5 h-2.5" />
                            <span className="font-semibold text-slate-800">{log.new_status}</span>
                          </span>
                        )}
                      </div>
                      <time className="text-[11px] text-slate-400 font-mono">
                        {formatDate(log.timestamp)}
                      </time>
                    </div>

                    <div className="text-xs text-slate-600 space-y-1">
                      <p className="text-[11px] font-medium text-slate-500">
                        By: <span className="text-slate-800 font-semibold">{log.actor_name}</span>{' '}
                        <span className="text-slate-400 font-normal">({log.actor_role})</span>
                      </p>
                      {log.note && (
                        <p className="text-xs text-slate-700 bg-slate-50 p-2 rounded-md border border-slate-100 mt-1.5 leading-relaxed">
                          {log.note}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

