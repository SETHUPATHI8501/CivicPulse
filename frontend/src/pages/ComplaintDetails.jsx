import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Sparkles,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Clock,
  HelpCircle,
  FileText,
  UserCheck,
  Building2,
  Shield,
  Upload,
  X,
  AlertCircle,
  Camera,
  Mic,
  Maximize2,
  ExternalLink,
} from 'lucide-react';
import OfficerLayout from '../layouts/OfficerLayout';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  getComplaintDetails,
  updateComplaintStatus,
  resolveComplaint,
  assignComplaint,
  listOfficers,
} from '../services/officerService';
import { connectLiveUpdates } from '../services/advancedService';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import CaseIdBadge from '../components/CaseIdBadge';
import AuditTimeline from '../components/AuditTimeline';
import DuplicateAlert from '../components/DuplicateAlert';
import ComplaintMap from '../components/ComplaintMap';
import Button from '../components/Button';
import Spinner from '../components/Spinner';
import ErrorState from '../components/ErrorState';
import { formatDate, formatRelativeTime } from '../utils/formatDate';

function getMediaUrl(url) {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const backendBase = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1')
    .replace(/\/api\/v1\/?$/, '');
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${backendBase}${cleanPath}`;
}

export default function ComplaintDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { officer, isAdmin } = useAuth();
  const { t } = useLanguage();

  const [complaint, setComplaint] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals state
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [targetStatus, setTargetStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [statusError, setStatusError] = useState('');

  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolvePhoto, setResolvePhoto] = useState(null);
  const [resolvePhotoPreview, setResolvePhotoPreview] = useState(null);
  const [resolveNote, setResolveNote] = useState('');
  const [resolveSubmitting, setResolveSubmitting] = useState(false);
  const [resolveError, setResolveError] = useState('');

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [officersList, setOfficersList] = useState([]);
  const [selectedOfficerId, setSelectedOfficerId] = useState('');
  const [assignNote, setAssignNote] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [assignError, setAssignError] = useState('');

  // Toast
  const [toastMessage, setToastMessage] = useState(null);
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadComplaint = useCallback(async (silent = false) => {
    if (!silent) {
      setIsLoading(true);
      setError(null);
    }
    try {
      const data = await getComplaintDetails(id);
      setComplaint(data);
    } catch (err) {
      if (!silent) {
        setError(err.userMessage || 'Complaint record not found or inaccessible.');
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, [id]);

  useEffect(() => {
    loadComplaint();
  }, [loadComplaint]);

  useEffect(() => {
    const disconnect = connectLiveUpdates((evt) => {
      if (
        complaint &&
        (evt.case_id === complaint.case_id ||
          evt.tracking_id === complaint.tracking_id ||
          String(evt.complaint_id) === String(complaint.id))
      ) {
        loadComplaint(true);
      }
    });
    return disconnect;
  }, [complaint, loadComplaint]);

  // Status transitions
  const getAllowedTransitions = (status) => {
    switch (status) {
      case 'OPEN':
        return [
          { value: 'IN_PROGRESS', label: 'In Progress (Acknowledge & Dispatch Work)' },
          { value: 'NEEDS_INFO', label: 'Needs Info (Request Citizen Clarification)' },
          { value: 'REJECTED', label: 'Reject (Invalid / Outside Municipal Scope)' },
        ];
      case 'IN_PROGRESS':
        return [
          { value: 'NEEDS_INFO', label: 'Needs Info (Request Citizen Clarification)' },
        ];
      case 'NEEDS_INFO':
        return [
          { value: 'IN_PROGRESS', label: 'In Progress (Resume Resolution)' },
          { value: 'OPEN', label: 'Re-open' },
          { value: 'REJECTED', label: 'Reject' },
        ];
      default:
        return [];
    }
  };

  const handleStatusSubmit = async (e) => {
    e.preventDefault();
    if (!targetStatus) return;

    setStatusSubmitting(true);
    setStatusError('');
    try {
      const updated = await updateComplaintStatus(complaint.id, {
        status: targetStatus,
        note: statusNote.trim() || undefined,
      });
      setComplaint(updated);
      setShowStatusModal(false);
      showToast(`Status successfully changed to ${targetStatus}`);
    } catch (err) {
      setStatusError(err.userMessage || 'Status update failed.');
    } finally {
      setStatusSubmitting(false);
    }
  };

  // Resolution photo select
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setResolveError('Invalid image format. Only JPEG, PNG, and WebP are allowed.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setResolveError('Photo file size exceeds 5 MB limit.');
      return;
    }

    setResolveError('');
    setResolvePhoto(file);
    setResolvePhotoPreview(URL.createObjectURL(file));
  };

  const handleResolveSubmit = async (e) => {
    e.preventDefault();
    if (!resolvePhoto) {
      setResolveError('A proof of resolution photo is mandatory.');
      return;
    }
    if (!resolveNote.trim()) {
      setResolveError('A descriptive resolution summary note is mandatory.');
      return;
    }

    setResolveSubmitting(true);
    setResolveError('');
    try {
      const updated = await resolveComplaint(complaint.id, resolvePhoto, resolveNote);
      setComplaint(updated);
      setShowResolveModal(false);
      showToast('Complaint verified and marked as RESOLVED!');
    } catch (err) {
      setResolveError(err.userMessage || 'Failed to submit complaint resolution proof.');
    } finally {
      setResolveSubmitting(false);
    }
  };

  // Admin Assignment
  const handleOpenAssign = async () => {
    setShowAssignModal(true);
    setAssignError('');
    setAssignLoading(true);
    try {
      const data = await listOfficers(complaint.department);
      if (data.items?.length > 0) {
        setOfficersList(data.items);
        setSelectedOfficerId(String(data.items[0].id));
      } else {
        const all = await listOfficers();
        setOfficersList(all.items || []);
        if (all.items?.length > 0) setSelectedOfficerId(String(all.items[0].id));
      }
    } catch (err) {
      setAssignError('Unable to load officers.');
    } finally {
      setAssignLoading(false);
    }
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!selectedOfficerId) return;

    setAssignSubmitting(true);
    setAssignError('');
    try {
      const updated = await assignComplaint(complaint.id, selectedOfficerId, assignNote);
      setComplaint(updated);
      setShowAssignModal(false);
      showToast('Complaint assigned to officer.');
    } catch (err) {
      setAssignError(err.userMessage || 'Failed to assign complaint.');
    } finally {
      setAssignSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <OfficerLayout>
        <div className="min-h-[50vh] flex flex-col items-center justify-center">
          <Spinner size="lg" color="teal" className="mb-4" />
          <p className="text-sm font-semibold text-slate-600">Retrieving grievance record...</p>
        </div>
      </OfficerLayout>
    );
  }

  if (error || !complaint) {
    return (
      <OfficerLayout>
        <div className="max-w-2xl mx-auto">
          <ErrorState message={error || 'Complaint not found'} onRetry={() => loadComplaint(false)} />
          <div className="mt-4 text-center">
            <Link to="/officer/dashboard" className="text-sm font-bold text-teal-600 hover:underline">
              ← Return to Complaints Queue
            </Link>
          </div>
        </div>
      </OfficerLayout>
    );
  }

  const citizenPhotoUrl = getMediaUrl(complaint.photo_url);
  const resolutionPhotoUrl = getMediaUrl(complaint.resolution_photo_url);
  const allowedTransitions = getAllowedTransitions(complaint.status);

  return (
    <OfficerLayout>
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-navy-950 text-white px-5 py-3 rounded-xl shadow-2xl border border-teal-500/50 flex items-center gap-3 animate-slideUp">
          <CheckCircle2 className="w-5 h-5 text-teal-400 flex-shrink-0" />
          <span className="text-sm font-semibold">{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Back button & Action Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <Link
          to="/officer/dashboard"
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-navy-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Complaints Queue</span>
        </Link>

        {/* Quick Operations Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {allowedTransitions.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setTargetStatus(allowedTransitions[0]?.value || '');
                setStatusNote('');
                setStatusError('');
                setShowStatusModal(true);
              }}
            >
              Update Status
            </Button>
          )}

          {complaint.status === 'IN_PROGRESS' && (
            <Button
              variant="teal"
              size="sm"
              icon={CheckCircle2}
              onClick={() => {
                setResolvePhoto(null);
                setResolvePhotoPreview(null);
                setResolveNote('');
                setResolveError('');
                setShowResolveModal(true);
              }}
            >
              Resolve Issue
            </Button>
          )}

          {isAdmin && (
            <Button
              variant="secondary"
              size="sm"
              icon={UserCheck}
              onClick={handleOpenAssign}
            >
              Assign Officer
            </Button>
          )}
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Columns: Main Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-8 shadow-2xs space-y-6">
            <CaseIdBadge
              variant="banner"
              caseId={complaint.case_id || complaint.tracking_id}
              trackingId={complaint.tracking_id}
              status={complaint.status}
              priority={complaint.priority}
              createdAt={complaint.created_at}
              showCopy={true}
              showShare={true}
              showTrackLink={true}
            />

            {/* AI Duplicate Alert */}
            {complaint.duplicate_group_id && (
              <div>
                <DuplicateAlert
                  duplicateGroupId={complaint.duplicate_group_id}
                  confidence={complaint.duplicate_confidence}
                />
              </div>
            )}

            {/* Description */}
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Citizen Issue Description
                </h3>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-slate-800 text-sm leading-relaxed whitespace-pre-wrap font-medium">
                  {complaint.citizen_text}
                </div>
              </div>

              {/* Voice Transcript (if available) */}
              {complaint.voice_transcript && (
                <div>
                  <h3 className="text-xs font-bold text-teal-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5" />
                    <span>Voice Audio Transcript</span>
                  </h3>
                  <div className="p-3 bg-teal-50/60 rounded-xl border border-teal-200/80 text-teal-950 text-xs italic">
                    "{complaint.voice_transcript}"
                  </div>
                </div>
              )}

              {/* Citizen Photo (if uploaded) */}
              {citizenPhotoUrl && (
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5" />
                    <span>Citizen Photo Attachment</span>
                  </h3>
                  <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-100 max-h-80">
                    <img
                      src={citizenPhotoUrl}
                      alt="Citizen Evidence"
                      className="w-full h-auto object-cover max-h-80"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Resolution Proof Card (If Resolved) */}
          {complaint.status === 'RESOLVED' && (
            <div className="bg-emerald-50/40 rounded-2xl border border-emerald-200 p-6 sm:p-8 shadow-2xs">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-emerald-950">Resolution Verification Proof</h2>
                  <p className="text-xs text-emerald-700">
                    Field resolution verified and closed by municipal team
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {resolutionPhotoUrl && (
                  <div>
                    <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block mb-2">
                      Proof of Work Photo
                    </span>
                    <div className="rounded-xl overflow-hidden border border-emerald-300 bg-white max-h-96">
                      <img
                        src={resolutionPhotoUrl}
                        alt="Resolution Proof"
                        className="w-full h-auto object-cover max-h-96"
                      />
                    </div>
                  </div>
                )}

                {complaint.resolution_note && (
                  <div>
                    <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block mb-1.5">
                      Resolution Work Summary
                    </span>
                    <div className="p-4 bg-white rounded-xl border border-emerald-200 text-slate-800 text-sm leading-relaxed font-medium">
                      {complaint.resolution_note}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Interactive Map */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-navy-950 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-teal-600" />
                <span>Geographic Location</span>
              </h3>
              <span className="font-mono text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                {Number(complaint.latitude).toFixed(6)}, {Number(complaint.longitude).toFixed(6)}
              </span>
            </div>
            <ComplaintMap complaints={[complaint]} height="320px" />
          </div>

          {/* Audit Lifecycle Timeline */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-8 shadow-2xs">
            <h3 className="text-sm font-bold text-navy-950 mb-6 flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-600" />
              <span>Grievance Lifecycle Audit Trail</span>
            </h3>
            <AuditTimeline logs={complaint.logs} />
          </div>
        </div>

        {/* Right 1 Column: Metadata & AI Classification Sidebar */}
        <div className="space-y-6">
          {/* AI Intelligence Card */}
          <div className="bg-gradient-to-br from-navy-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center border border-teal-500/30">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">AI Classification</h3>
                <p className="text-[11px] text-teal-300 font-mono">
                  Engine: {complaint.ai_source || 'Gemini 2.5'}
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between">
                <span className="text-slate-400 font-medium">Category</span>
                <span className="font-bold text-white">{complaint.category}</span>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between">
                <span className="text-slate-400 font-medium">Department</span>
                <span className="font-bold text-teal-300">{complaint.department}</span>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between">
                <span className="text-slate-400 font-medium">Priority Assessed</span>
                <PriorityBadge priority={complaint.priority} size="sm" />
              </div>
            </div>
          </div>

          {/* Metadata Summary Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Grievance Metadata
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-slate-500">Unified Case ID</span>
                <span className="font-mono font-extrabold text-teal-700">
                  {complaint.case_id || complaint.tracking_id}
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-slate-500">Tracking Ref</span>
                <span className="font-mono font-bold text-slate-700">{complaint.tracking_id}</span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-slate-500">Database ID</span>
                <span className="font-mono font-bold text-slate-800">{complaint.id}</span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-slate-500">Submission Date</span>
                <span className="font-medium text-slate-800">{formatDate(complaint.created_at)}</span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-slate-500">Last Updated</span>
                <span className="font-medium text-slate-800">{formatDate(complaint.updated_at)}</span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-slate-500">Assigned Officer ID</span>
                <span className="font-bold text-navy-950">
                  {complaint.assigned_officer_id ? `Officer #${complaint.assigned_officer_id}` : 'Unassigned'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Duplicate Group</span>
                <span className="font-mono text-slate-700">
                  {complaint.duplicate_group_id || 'None (Original)'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* Status Modal */}
      {/* ========================================================================= */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-scaleIn">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-navy-950">Update Complaint Status</h3>
              <button
                type="button"
                onClick={() => setShowStatusModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStatusSubmit} className="p-6 space-y-4">
              {statusError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-600" />
                  <span>{statusError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Current Status
                </label>
                <StatusBadge status={complaint.status} size="md" />
              </div>

              <div>
                <label
                  htmlFor="details-target-status"
                  className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1"
                >
                  New Target Status <span className="text-rose-500">*</span>
                </label>
                <select
                  id="details-target-status"
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  {allowedTransitions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="details-status-note"
                  className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1"
                >
                  Audit Note / Remarks
                </label>
                <textarea
                  id="details-status-note"
                  rows={3}
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder="Reason for lifecycle change..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setShowStatusModal(false)}
                  disabled={statusSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={statusSubmitting}
                  disabled={!targetStatus}
                >
                  Save Status
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Resolve Modal */}
      {/* ========================================================================= */}
      {showResolveModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-scaleIn">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-navy-950 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Submit Resolution Proof</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowResolveModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResolveSubmit} className="p-6 space-y-4">
              {resolveError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-600" />
                  <span>{resolveError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Resolution Proof Photo <span className="text-rose-500">*</span>
                </label>

                {resolvePhotoPreview ? (
                  <div className="relative rounded-xl overflow-hidden border border-slate-300 max-h-56 flex items-center justify-center bg-slate-900">
                    <img
                      src={resolvePhotoPreview}
                      alt="Resolution Preview"
                      className="max-h-56 w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setResolvePhoto(null);
                        setResolvePhotoPreview(null);
                      }}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-slate-900/80 text-white hover:bg-rose-600 shadow-md"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-slate-300 hover:border-teal-500 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-teal-50/20">
                    <Upload className="w-6 h-6 text-teal-600 mb-2" />
                    <span className="text-sm font-bold text-slate-700">Select Resolution Photo</span>
                    <span className="text-xs text-slate-500 mt-1">JPEG, PNG or WebP (Max 5 MB)</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handlePhotoSelect}
                      className="hidden"
                      required
                    />
                  </label>
                )}
              </div>

              <div>
                <label
                  htmlFor="details-resolve-note"
                  className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                >
                  Resolution Note <span className="text-rose-500">*</span>
                </label>
                <textarea
                  id="details-resolve-note"
                  rows={3}
                  value={resolveNote}
                  onChange={(e) => setResolveNote(e.target.value)}
                  placeholder="Detail the work carried out to rectify the civic problem..."
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setShowResolveModal(false)}
                  disabled={resolveSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="teal"
                  size="md"
                  isLoading={resolveSubmitting}
                  disabled={!resolvePhoto || !resolveNote.trim()}
                  icon={CheckCircle2}
                >
                  Complete Resolution
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Assign Modal */}
      {/* ========================================================================= */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-scaleIn">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-navy-950 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-purple-600" />
                <span>Assign to Department Officer</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAssignSubmit} className="p-6 space-y-4">
              {assignError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-600" />
                  <span>{assignError}</span>
                </div>
              )}

              <div>
                <label
                  htmlFor="details-officer-select"
                  className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                >
                  Select Officer <span className="text-rose-500">*</span>
                </label>
                {assignLoading ? (
                  <div className="p-3 bg-slate-50 rounded-xl flex items-center gap-2 text-xs text-slate-500">
                    <Spinner size="sm" color="teal" />
                    <span>Loading department officers...</span>
                  </div>
                ) : officersList.length === 0 ? (
                  <div className="p-3 bg-amber-50 text-amber-800 text-xs rounded-xl border border-amber-200">
                    No matching officers registered for {complaint.department}.
                  </div>
                ) : (
                  <select
                    id="details-officer-select"
                    value={selectedOfficerId}
                    onChange={(e) => setSelectedOfficerId(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {officersList.map((off) => (
                      <option key={off.id} value={off.id}>
                        {off.name} ({off.department})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label
                  htmlFor="details-assign-note"
                  className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                >
                  Assignment Remarks
                </label>
                <textarea
                  id="details-assign-note"
                  rows={2}
                  value={assignNote}
                  onChange={(e) => setAssignNote(e.target.value)}
                  placeholder="Instructions for the assigned officer..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setShowAssignModal(false)}
                  disabled={assignSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={assignSubmitting}
                  disabled={!selectedOfficerId || officersList.length === 0}
                  icon={UserCheck}
                >
                  Confirm Assignment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </OfficerLayout>
  );
}
