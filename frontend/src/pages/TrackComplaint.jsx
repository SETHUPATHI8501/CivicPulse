import React, { useState, useEffect } from 'react';
import { useSearchParams, useParams, Link } from 'react-router-dom';
import {
  Search,
  MapPin,
  Calendar,
  Layers,
  Camera,
  CheckCircle2,
  AlertCircle,
  FileQuestion,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import Button from '../components/Button';
import Input from '../components/Input';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import AuditTimeline from '../components/AuditTimeline';
import DuplicateAlert from '../components/DuplicateAlert';
import CaseIdBadge from '../components/CaseIdBadge';
import Spinner from '../components/Spinner';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import { trackComplaint, getRecentCases } from '../services/complaintService';
import { connectLiveUpdates } from '../services/advancedService';
import { formatDate } from '../utils/formatDate';
import { useLanguage } from '../context/LanguageContext';

function getMediaUrl(url) {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const backendBase = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1')
    .replace(/\/api\/v1\/?$/, '');
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${backendBase}${cleanPath}`;
}

export default function TrackComplaint() {
  const [searchParams, setSearchParams] = useSearchParams();
  const routeParams = useParams();
  const { t, language } = useLanguage();

  const initialId = routeParams.trackingId || searchParams.get('id') || '';
  const [trackingInput, setTrackingInput] = useState(initialId);
  const [complaint, setComplaint] = useState(null);
  const [recentCases, setRecentCases] = useState(() => getRecentCases());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  const fetchTracking = async (idToSearch) => {
    const cleanId = (idToSearch || '').trim();
    if (!cleanId) return;

    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const data = await trackComplaint(cleanId);
      setComplaint(data);
      setRecentCases(getRecentCases());
      setIsLoading(false);
    } catch (err) {
      setComplaint(null);
      setError(err.userMessage || `Complaint Case ID '${cleanId}' not found in municipal records.`);
      setIsLoading(false);
    }
  };

  // Auto-search if URL contains /track/:trackingId or ?id=...
  useEffect(() => {
    if (initialId) {
      setTrackingInput(initialId);
      fetchTracking(initialId);
    }
  }, [initialId]);

  // Real-time WebSocket subscription for live updates to the tracked Case ID
  useEffect(() => {
    if (!complaint) return undefined;
    const activeCaseId = complaint.case_id || complaint.tracking_id;
    const activeTrackId = complaint.tracking_id;

    const disconnect = connectLiveUpdates((evt) => {
      if (
        evt.case_id === activeCaseId ||
        evt.tracking_id === activeTrackId ||
        evt.tracking_id === activeCaseId
      ) {
        fetchTracking(activeCaseId);
      }
    });
    return disconnect;
  }, [complaint]);

  const handleSearch = (e) => {
    e.preventDefault();
    const clean = trackingInput.trim().toUpperCase();
    if (clean) {
      setSearchParams({ id: clean });
      fetchTracking(clean);
    }
  };

  return (
    <MainLayout
      pageTitle={language === 'ta' ? 'புகார் நிலை அறிதல்' : 'Track Grievance Status'}
      subtitle={
        language === 'ta'
          ? 'உங்கள் வழக்கு எண்ணை (Case ID: CP-2026-XXXXX) உள்ளிட்டு தற்போதைய நிலையை அறியவும்'
          : 'Real-time Case ID status tracking and municipal field resolution audit trail.'
      }
      maxWidth="max-w-4xl"
    >
      <div className="space-y-8 pb-12">
        {/* Search Bar Container */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-card space-y-4">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
            <div className="flex-1 w-full">
              <Input
                label={language === 'ta' ? 'நகராட்சி வழக்கு எண் (Case ID)' : 'Municipal Case ID / Tracking ID'}
                placeholder="e.g. CP-2026-00093 or CP-6D07D491"
                value={trackingInput}
                onChange={(e) => setTrackingInput(e.target.value.toUpperCase())}
                leftIcon={Search}
                helperText={
                  language === 'ta'
                    ? 'வழக்கு எண் (எ.கா. CP-2026-00093) உள்ளிட்டு புகாரின் தற்போதைய நிலையை அறியவும்.'
                    : 'Enter your unified Case ID (e.g. CP-2026-00093) issued upon complaint submission.'
                }
                required
              />
            </div>
            <Button
              type="submit"
              variant="teal"
              size="md"
              icon={Search}
              isLoading={isLoading}
              className="w-full sm:w-auto h-[42px] mt-1 sm:mt-0 flex-shrink-0"
            >
              {t('track', 'Track Issue')}
            </Button>
          </form>

          {recentCases.length > 0 && (
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {language === 'ta' ? 'சமீபத்திய வழக்கு எண்கள்:' : 'Recent Case IDs:'}
              </span>
              {recentCases.slice(0, 5).map((rc) => {
                const cid = rc.case_id || rc.tracking_id;
                return (
                  <button
                    key={cid}
                    type="button"
                    onClick={() => {
                      setTrackingInput(cid);
                      setSearchParams({ id: cid });
                      fetchTracking(cid);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-teal-50 text-navy-900 hover:text-teal-800 border border-slate-200 hover:border-teal-300 font-mono text-xs font-bold transition-colors"
                  >
                    {cid}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-card space-y-3">
            <Spinner size="lg" variant="teal" />
            <p className="text-xs text-slate-500 font-medium">
              Querying municipal registry for Case ID records...
            </p>
          </div>
        )}

        {/* Error / Not Found State */}
        {!isLoading && error && (
          <ErrorState
            title="Complaint Case ID Not Found"
            message={error}
            retryLabel="Search Again"
            onRetry={() => {
              setError(null);
            }}
          />
        )}

        {/* Initial Empty State before any search */}
        {!isLoading && !hasSearched && !complaint && (
          <EmptyState
            title="Enter Case Identifier"
            description="Enter your complaint Case ID (e.g. CP-2026-00093) above to view department triage, assigned officers, and resolution photos."
            icon={Search}
          />
        )}

        {/* Successful Complaint Details Display */}
        {!isLoading && complaint && (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-card p-6 sm:p-8 space-y-8 animate-in fade-in duration-200">
            {/* Unified Case ID Banner */}
            <CaseIdBadge
              variant="banner"
              caseId={complaint.case_id || complaint.tracking_id}
              trackingId={complaint.tracking_id}
              status={complaint.status}
              priority={complaint.priority}
              createdAt={complaint.created_at}
              showCopy={true}
              showShare={true}
              showTrackLink={false}
            />

            {/* Duplicate Notice if applicable */}
            {complaint.duplicate_group_id && (
              <DuplicateAlert
                groupId={complaint.duplicate_group_id}
                confidence={complaint.duplicate_confidence}
              />
            )}

            {/* Core Classification Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Category
                </span>
                <span className="text-sm font-bold text-navy-950 block mt-1">
                  {t(`cat_${complaint.category}`, complaint.category)}
                </span>
                <span className="text-[11px] text-teal-700 font-mono mt-0.5 block">
                  Source: {complaint.ai_source}
                </span>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Responsible Department
                </span>
                <span className="text-sm font-bold text-navy-950 block mt-1">
                  {complaint.department}
                </span>
                <span className="text-[11px] text-slate-500 mt-0.5 block">
                  {complaint.assigned_officer_id
                    ? `Assigned Officer ID: #${complaint.assigned_officer_id}`
                    : 'Pending officer dispatch'}
                </span>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Location Coordinates
                </span>
                <span className="text-sm font-bold font-mono text-navy-950 block mt-1">
                  {complaint.latitude?.toFixed(4)}, {complaint.longitude?.toFixed(4)}
                </span>
                <span className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-400" />
                  <span>GPS Verified</span>
                </span>
              </div>
            </div>

            {/* Description Text */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Grievance Description
              </h3>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 text-sm text-slate-800 leading-relaxed">
                "{complaint.citizen_text}"
              </div>
            </div>

            {/* Resolution Proof Card (if RESOLVED) */}
            {complaint.status === 'RESOLVED' && (complaint.resolution_note || complaint.resolution_photo_url) && (
              <div className="p-5 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-emerald-950">
                      Issue Successfully Resolved
                    </h3>
                    <p className="text-xs text-emerald-800">
                      Municipal field engineer verified and closed this grievance.
                    </p>
                  </div>
                </div>

                {complaint.resolution_note && (
                  <div className="bg-white p-3.5 rounded-xl border border-emerald-200 text-xs text-slate-800 leading-relaxed">
                    <span className="font-semibold text-emerald-900 block mb-1">
                      Officer Resolution Summary:
                    </span>
                    <p>{complaint.resolution_note}</p>
                  </div>
                )}

                {complaint.resolution_photo_url && (
                  <div>
                    <span className="text-xs font-semibold text-emerald-900 block mb-2">
                      Proof of Work Photo:
                    </span>
                    <div className="relative inline-block rounded-xl overflow-hidden border border-emerald-200 shadow-sm max-w-sm">
                      <img
                        src={getMediaUrl(complaint.resolution_photo_url)}
                        alt="Municipal Resolution Proof"
                        className="w-full h-48 object-cover cursor-pointer hover:scale-105 transition-transform duration-200"
                        onClick={() => setShowPhotoModal(true)}
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPhotoModal(true)}
                        className="absolute bottom-2 right-2 bg-black/70 hover:bg-black/90 text-white text-[11px] px-2.5 py-1 rounded-md flex items-center gap-1 backdrop-blur-xs"
                      >
                        <Camera className="w-3 h-3" />
                        <span>Enlarge Photo</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Audit Trail Timeline */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-navy-950">
                    Lifecycle Audit History
                  </h3>
                  <p className="text-xs text-slate-500">
                    Chronological verification events recorded in municipal ledger.
                  </p>
                </div>
                <span className="text-xs font-mono text-slate-400">
                  {complaint.logs?.length || 0} events
                </span>
              </div>

              <AuditTimeline logs={complaint.logs} />
            </div>
          </div>
        )}
      </div>

      {/* Modal for full resolution image preview */}
      {showPhotoModal && complaint?.resolution_photo_url && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in"
          onClick={() => setShowPhotoModal(false)}
        >
          <div className="relative max-w-3xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl p-2">
            <img
              src={getMediaUrl(complaint.resolution_photo_url)}
              alt="Resolution Proof High Resolution"
              className="w-full max-h-[80vh] object-contain rounded-xl"
            />
            <div className="p-3 text-center">
              <Button variant="secondary" size="sm" onClick={() => setShowPhotoModal(false)}>
                Close Preview
              </Button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
