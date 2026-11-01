import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Check, Share2, ExternalLink, Hash } from 'lucide-react';
import StatusBadge from './StatusBadge';
import PriorityBadge from './PriorityBadge';
import { formatDate } from '../utils/formatDate';
import { useLanguage } from '../context/LanguageContext';

/**
 * Unified Case ID Badge & Card Component
 * Ensures ONE COMPLAINT = ONE CASE ID = ONE SHARED BACKEND RECORD
 * across Citizen, Officer, Worker, and Admin Web Interfaces.
 */
export default function CaseIdBadge({
  caseId,
  trackingId,
  status,
  priority,
  createdAt,
  variant = 'inline', // 'inline' | 'banner' | 'card'
  showCopy = true,
  showShare = false,
  showTrackLink = false,
  className = '',
}) {
  const { language } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [sharedFeedback, setSharedFeedback] = useState(false);

  const resolvedCaseId = caseId || trackingId || 'CP-2026-00000';
  const hasDistinctLegacyId =
    trackingId && caseId && trackingId !== caseId;

  const handleCopy = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    try {
      await navigator.clipboard.writeText(resolvedCaseId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback copy
      const input = document.createElement('input');
      input.value = resolvedCaseId;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const shareTitle = `CivicPulse AI Case ID: ${resolvedCaseId}`;
    const shareText =
      language === 'ta'
        ? `வழக்கு எண்: ${resolvedCaseId}\nஉங்கள் புகாரைக் கண்காணிக்க இந்த எண்ணைப் பயன்படுத்தவும்.`
        : `Case ID: ${resolvedCaseId}\nUse this Case ID to track the real-time municipal resolution status on CivicPulse AI.`;
    const shareUrl = `${window.location.origin}/track/${encodeURIComponent(resolvedCaseId)}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch {
        // User cancelled or share failed; fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      setSharedFeedback(true);
      setTimeout(() => setSharedFeedback(false), 2200);
    } catch {
      // ignore
    }
  };

  if (variant === 'banner') {
    return (
      <div
        className={`rounded-2xl bg-gradient-to-r from-navy-950 via-navy-900 to-teal-950 text-white p-5 sm:p-6 border border-teal-500/30 shadow-lg space-y-4 ${className}`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-teal-300 uppercase tracking-widest font-mono">
              <Hash className="w-3.5 h-3.5 text-teal-400" />
              <span>
                {language === 'ta'
                  ? 'ஒருங்கிணைந்த வழக்கு எண் (Unified Case ID)'
                  : 'Unified Municipal Case ID'}
              </span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-white">
                {resolvedCaseId}
              </span>
              {hasDistinctLegacyId && (
                <span className="text-[11px] font-mono text-slate-300 bg-white/10 px-2 py-0.5 rounded-md border border-white/15">
                  Ref: {trackingId}
                </span>
              )}
            </div>
            <p className="text-xs text-teal-100/90 font-medium pt-0.5">
              {language === 'ta'
                ? `வழக்கு எண்: ${resolvedCaseId} • உங்கள் புகாரைக் கண்காணிக்க இந்த எண்ணைப் பயன்படுத்தவும்.`
                : `வழக்கு எண்: ${resolvedCaseId} • Use this Case ID to track your complaint across Mobile & Web.`}
            </p>
            {createdAt && (
              <p className="text-[11px] text-slate-300 font-mono">
                {language === 'ta' ? 'பதிவு நேரம்:' : 'Registered:'} {formatDate(createdAt)}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {priority && <PriorityBadge priority={priority} size="md" />}
            {status && <StatusBadge status={status} size="md" />}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t border-white/10">
          {showCopy && (
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-teal-300" />
                  <span>{language === 'ta' ? 'நகலெடுக்கப்பட்டது!' : 'Case ID Copied!'}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-teal-300" />
                  <span>{language === 'ta' ? 'வழக்கு எண்ணை நகலெடு' : 'Copy Case ID'}</span>
                </>
              )}
            </button>
          )}

          {showShare && (
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5 text-teal-300" />
              <span>
                {sharedFeedback
                  ? language === 'ta'
                    ? 'பகிர்வு இணைப்பு நகலெடுக்கப்பட்டது!'
                    : 'Share Link Copied!'
                  : language === 'ta'
                  ? 'வழக்கு எண்ணைப் பகிர்'
                  : 'Share Case ID'}
              </span>
            </button>
          )}

          {showTrackLink && (
            <Link
              to={`/track/${encodeURIComponent(resolvedCaseId)}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold bg-teal-500 hover:bg-teal-400 text-navy-950 transition-colors ml-auto"
            >
              <span>{language === 'ta' ? 'புகாரைக் கண்காணிக்க' : 'Track Complaint'}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono text-xs font-extrabold text-navy-950 bg-navy-50 px-2.5 py-1 rounded-md border border-navy-200/80 ${className}`}
    >
      <span>{resolvedCaseId}</span>
      {showCopy && (
        <button
          type="button"
          onClick={handleCopy}
          title={copied ? 'Copied!' : `Copy ${resolvedCaseId}`}
          className="text-slate-400 hover:text-teal-700 transition-colors"
        >
          {copied ? (
            <Check className="w-3 h-3 text-emerald-600" />
          ) : (
            <Copy className="w-3 h-3" />
          )}
        </button>
      )}
    </span>
  );
}

