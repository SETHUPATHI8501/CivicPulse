import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { AlertTriangle, AlertCircle, ArrowDown } from 'lucide-react';

export default function PriorityBadge({ priority = 'MEDIUM', size = 'md', className = '' }) {
  const { t } = useLanguage();
  const normalized = (priority || 'MEDIUM').toUpperCase();

  const configs = {
    HIGH: {
      color: 'bg-rose-50 text-rose-700 border-rose-200',
      icon: AlertTriangle,
      labelKey: 'priority_HIGH',
      defaultLabel: 'High',
    },
    MEDIUM: {
      color: 'bg-amber-50 text-amber-700 border-amber-200',
      icon: AlertCircle,
      labelKey: 'priority_MEDIUM',
      defaultLabel: 'Medium',
    },
    LOW: {
      color: 'bg-slate-100 text-slate-700 border-slate-200',
      icon: ArrowDown,
      labelKey: 'priority_LOW',
      defaultLabel: 'Low',
    },
  };

  const config = configs[normalized] || configs.MEDIUM;
  const Icon = config.icon;

  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5 gap-1 font-medium',
    md: 'text-xs px-2.5 py-0.5 gap-1.5 font-medium',
  };

  return (
    <span
      className={`
        inline-flex items-center rounded-md border tracking-tight select-none
        ${config.color}
        ${sizeStyles[size] || sizeStyles.md}
        ${className}
      `}
    >
      <Icon className="w-3 h-3 flex-shrink-0" />
      <span>{t(config.labelKey, config.defaultLabel)}</span>
    </span>
  );
}

