import React from 'react';
import { Inbox, FileQuestion, Plus } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import Button from './Button';

export default function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  actionLabel,
  onAction,
  className = '',
}) {
  const { t } = useLanguage();

  const displayTitle = title || t('emptyTitle', 'No records found');
  const displayDesc = description || t('emptyDesc', 'There are no complaints matching your criteria at this moment.');

  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-8 sm:p-12 bg-white rounded-xl border border-dashed border-slate-300 shadow-sm ${className}`}
    >
      <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-4 text-slate-400">
        <Icon className="w-7 h-7" aria-hidden="true" />
      </div>

      <h3 className="text-base font-semibold text-slate-800 mb-1">{displayTitle}</h3>
      <p className="text-xs sm:text-sm text-slate-500 max-w-sm mb-6 leading-relaxed">
        {displayDesc}
      </p>

      {actionLabel && onAction && (
        <Button variant="primary" size="sm" icon={Plus} onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

