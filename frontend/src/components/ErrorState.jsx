import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import Button from './Button';

export default function ErrorState({
  title,
  message,
  onRetry,
  retryLabel,
  className = '',
}) {
  const { t } = useLanguage();

  const displayTitle = title || t('errorTitle', 'Something went wrong');
  const displayMessage = message || t('errorDesc', 'Unable to load civic information. Please check your network connection and retry.');
  const displayRetry = retryLabel || t('retry', 'Try Again');

  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-6 sm:p-10 bg-rose-50/50 rounded-xl border border-rose-200 shadow-sm ${className}`}
      role="alert"
    >
      <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-3">
        <AlertTriangle className="w-6 h-6" aria-hidden="true" />
      </div>

      <h3 className="text-base font-semibold text-rose-900 mb-1">{displayTitle}</h3>
      <p className="text-xs sm:text-sm text-rose-700 max-w-md mb-5 leading-relaxed">
        {displayMessage}
      </p>

      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          icon={RotateCcw}
          onClick={onRetry}
          className="border-rose-300 text-rose-800 hover:bg-rose-100/50"
        >
          {displayRetry}
        </Button>
      )}
    </div>
  );
}

