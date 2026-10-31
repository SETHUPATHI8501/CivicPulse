import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Clock, RefreshCw, CheckCircle2, HelpCircle, XCircle } from 'lucide-react';

export default function StatusBadge({ status = 'OPEN', size = 'md', showIcon = true, className = '' }) {
  const { t } = useLanguage();
  const normalizedStatus = (status || 'OPEN').toUpperCase();

  const configs = {
    OPEN: {
      color: 'bg-amber-50 text-amber-800 border-amber-200/80',
      dotColor: 'bg-amber-500',
      icon: Clock,
      labelKey: 'status_OPEN',
      defaultLabel: 'Open',
    },
    IN_PROGRESS: {
      color: 'bg-sky-50 text-sky-800 border-sky-200/80',
      dotColor: 'bg-sky-500',
      icon: RefreshCw,
      labelKey: 'status_IN_PROGRESS',
      defaultLabel: 'In Progress',
    },
    RESOLVED: {
      color: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
      dotColor: 'bg-emerald-500',
      icon: CheckCircle2,
      labelKey: 'status_RESOLVED',
      defaultLabel: 'Resolved',
    },
    NEEDS_INFO: {
      color: 'bg-purple-50 text-purple-800 border-purple-200/80',
      dotColor: 'bg-purple-500',
      icon: HelpCircle,
      labelKey: 'status_NEEDS_INFO',
      defaultLabel: 'Needs Info',
    },
    REJECTED: {
      color: 'bg-rose-50 text-rose-800 border-rose-200/80',
      dotColor: 'bg-rose-500',
      icon: XCircle,
      labelKey: 'status_REJECTED',
      defaultLabel: 'Rejected',
    },
  };

  const config = configs[normalizedStatus] || configs.OPEN;
  const Icon = config.icon;

  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5 gap-1 font-medium',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-semibold',
  };

  return (
    <span
      className={`
        inline-flex items-center rounded-full border tracking-wide select-none
        ${config.color}
        ${sizeStyles[size] || sizeStyles.md}
        ${className}
      `}
    >
      {showIcon ? (
        <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${normalizedStatus === 'IN_PROGRESS' ? 'animate-[spin_4s_linear_infinite]' : ''}`} />
      ) : (
        <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`} />
      )}
      <span>{t(config.labelKey, config.defaultLabel)}</span>
    </span>
  );
}

