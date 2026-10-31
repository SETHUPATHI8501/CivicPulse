import React from 'react';
import {
  MapPin,
  Calendar,
  Layers,
  ArrowRight,
  Construction,
  Trash2,
  Droplets,
  Lightbulb,
  Workflow,
  HelpCircle,
  Camera,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import StatusBadge from './StatusBadge';
import PriorityBadge from './PriorityBadge';
import Button from './Button';
import { formatRelativeTime } from '../utils/formatDate';

const categoryIcons = {
  Pothole: Construction,
  Garbage: Trash2,
  Water: Droplets,
  Streetlight: Lightbulb,
  Drainage: Workflow,
  Other: HelpCircle,
};

export default function ComplaintCard({ complaint, onSelect, className = '' }) {
  const { t } = useLanguage();

  if (!complaint) return null;

  const {
    id,
    tracking_id,
    citizen_text,
    category = 'Other',
    priority = 'MEDIUM',
    status = 'OPEN',
    department = 'General',
    latitude,
    longitude,
    created_at,
    duplicate_group_id,
    duplicate_confidence,
    resolution_photo_url,
    photo_url,
  } = complaint;

  const CategoryIcon = categoryIcons[category] || HelpCircle;
  const categoryLabel = t(`cat_${category}`, category);

  return (
    <div
      className={`
        bg-white rounded-xl border border-slate-200/90 shadow-card hover:shadow-card-hover transition-all duration-200
        p-5 flex flex-col justify-between group
        ${className}
      `}
    >
      <div>
        {/* Top Header: Tracking ID, Category, Badges */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-bold text-navy-900 bg-navy-50 border border-navy-100 px-2.5 py-1 rounded-md tracking-wider">
              {tracking_id || `CP-${id}`}
            </span>
            <div className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md">
              <CategoryIcon className="w-3.5 h-3.5 text-teal-600" />
              <span>{categoryLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <PriorityBadge priority={priority} size="sm" />
            <StatusBadge status={status} size="sm" />
          </div>
        </div>

        {/* Complaint Text */}
        <p className="text-slate-800 text-sm font-medium line-clamp-3 leading-relaxed mb-4 group-hover:text-navy-900 transition-colors">
          {citizen_text}
        </p>

        {/* Badges for AI Duplicate and Photos */}
        {(duplicate_group_id || resolution_photo_url || photo_url) && (
          <div className="flex items-center gap-2 mb-4 flex-wrap text-[11px]">
            {duplicate_group_id && (
              <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200/80 px-2 py-0.5 rounded-full font-medium">
                <Layers className="w-3 h-3 text-amber-600" />
                <span>
                  {t('duplicateNotice', 'Duplicate')}: {duplicate_group_id}
                  {duplicate_confidence ? ` (${Math.round(duplicate_confidence * 100)}%)` : ''}
                </span>
              </span>
            )}

            {resolution_photo_url && (
              <span className="inline-flex items-center gap-1 bg-teal-50 text-teal-800 border border-teal-200/80 px-2 py-0.5 rounded-full font-medium">
                <Camera className="w-3 h-3 text-teal-600" />
                <span>Resolution Proof Attached</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Footer Info: Department, GPS, Date, Action */}
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3 text-xs text-slate-500">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-1 text-slate-600 font-medium truncate">
            <span>{department}</span>
          </div>

          <div className="flex items-center gap-3 text-slate-400 text-[11px]">
            {latitude !== undefined && longitude !== undefined && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-400" />
                <span>{latitude.toFixed(4)}, {longitude.toFixed(4)}</span>
              </span>
            )}
            {created_at && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                <span>{formatRelativeTime(created_at)}</span>
              </span>
            )}
          </div>
        </div>

        {onSelect && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSelect(complaint)}
            icon={ArrowRight}
            iconPosition="right"
            className="flex-shrink-0 border-slate-200 text-teal-700 hover:border-teal-300 hover:bg-teal-50/50"
          >
            {t('viewDetails', 'View')}
          </Button>
        )}
      </div>
    </div>
  );
}

