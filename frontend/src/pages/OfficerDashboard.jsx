import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Layers,
  MapPin,
  Filter,
  Search,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  HelpCircle,
  XCircle,
  FileText,
  Upload,
  UserCheck,
  Shield,
  Eye,
  CheckCircle,
  ExternalLink,
  ChevronRight,
  Map as MapIcon,
  List as ListIcon,
  X,
  AlertCircle,
  ArrowRight,
  Calendar,
} from 'lucide-react';
import OfficerLayout from '../layouts/OfficerLayout';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  getOfficerComplaints,
  updateComplaintStatus,
  resolveComplaint,
  listOfficers,
  assignComplaint,
} from '../services/officerService';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import Button from '../components/Button';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import ComplaintMap from '../components/ComplaintMap';
import { formatDate, formatRelativeTime } from '../utils/formatDate';

export default function OfficerDashboard() {
  const { officer, isAdmin } = useAuth();
  const { t } = useLanguage();

  // Data states
  const [complaints, setComplaints] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Controls
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards' | 'map'

  // Modals state
  const [statusModalComplaint, setStatusModalComplaint] = useState(null);
  const [statusForm, setStatusForm] = useState({ targetStatus: '', note: '' });
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [statusError, setStatusError] = useState('');

  const [resolveModalComplaint, setResolveModalComplaint] = useState(null);
  const [resolvePhoto, setResolvePhoto] = useState(null);
  const [resolvePhotoPreview, setResolvePhotoPreview] = useState(null);
  const [resolveNote, setResolveNote] = useState('');
  const [resolveSubmitting, setResolveSubmitting] = useState(false);
  const [resolveError, setResolveError] = useState('');

  const [assignModalComplaint, setAssignModalComplaint] = useState(null);
  const [availableOfficers, setAvailableOfficers] = useState([]);
  const [selectedOfficerId, setSelectedOfficerId] = useState('');
  const [assignNote, setAssignNote] = useState('');
  const [assignLoadingOfficers, setAssignLoadingOfficers] = useState(false);
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [assignError, setAssignError] = useState('');

  // Success Feedback Toast
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Fetch Complaints Queue
  const fetchComplaints = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = { limit: 100 };
      if (statusFilter !== 'ALL') {
        params.status = statusFilter;
      }
      const data = await getOfficerComplaints(params);
      setComplaints(data.items || []);
      setTotalCount(data.total || 0);
    } catch (err) {
      setError(err.userMessage || 'Failed to load complaints queue. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  // Client-side filtering for priority and search query
  const filteredComplaints = useMemo(() => {
    return complaints.filter((c) => {
      // Priority filter
      if (priorityFilter !== 'ALL' && c.priority !== priorityFilter) {
        return false;
      }
      // Search query (tracking ID, citizen text, category, department)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const tracking = (c.tracking_id || '').toLowerCase();
        const text = (c.citizen_text || '').toLowerCase();
        const cat = (c.category || '').toLowerCase();
        const dept = (c.department || '').toLowerCase();
        if (!tracking.includes(q) && !text.includes(q) && !cat.includes(q) && !dept.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [complaints, priorityFilter, searchQuery]);

  // Statistics summaries
  const stats = useMemo(() => {
    const total = complaints.length;
    const open = complaints.filter((c) => c.status === 'OPEN').length;
    const inProgress = complaints.filter((c) => c.status === 'IN_PROGRESS').length;
    const resolved = complaints.filter((c) => c.status === 'RESOLVED').length;
    const needsInfo = complaints.filter((c) => c.status === 'NEEDS_INFO').length;
    return { total, open, inProgress, resolved, needsInfo };
  }, [complaints]);

  // =========================================================================
  // Status Modal Handlers
  // =========================================================================
  const openStatusModal = (complaint) => {
    setStatusModalComplaint(complaint);
    // Suggest default transition based on current state
    let defaultTarget = '';
    if (complaint.status === 'OPEN') defaultTarget = 'IN_PROGRESS';
    else if (complaint.status === 'IN_PROGRESS') defaultTarget = 'NEEDS_INFO';
    else if (complaint.status === 'NEEDS_INFO') defaultTarget = 'IN_PROGRESS';

    setStatusForm({ targetStatus: defaultTarget, note: '' });
    setStatusError('');
  };

  const getAllowedTransitions = (currentStatus) => {
    switch (currentStatus) {
      case 'OPEN':
        return [
          { value: 'IN_PROGRESS', label: 'In Progress (Start Work)' },
          { value: 'NEEDS_INFO', label: 'Needs Info (Request Citizen Details)' },
          { value: 'REJECTED', label: 'Reject Complaint' },
        ];
      case 'IN_PROGRESS':
        return [
          { value: 'NEEDS_INFO', label: 'Needs Info (Request More Details)' },
        ];
      case 'NEEDS_INFO':
        return [
          { value: 'IN_PROGRESS', label: 'In Progress (Resume Work)' },
          { value: 'OPEN', label: 'Re-open' },
          { value: 'REJECTED', label: 'Reject' },
        ];
      default:
        return [];
    }
  };

  const handleStatusSubmit = async (e) => {
    e.preventDefault();
    if (!statusModalComplaint || !statusForm.targetStatus) return;

    setStatusSubmitting(true);
    setStatusError('');
    try {
      await updateComplaintStatus(statusModalComplaint.id, {
        status: statusForm.targetStatus,
        note: statusForm.note.trim() || undefined,
      });
      showToast(`Complaint ${statusModalComplaint.tracking_id} updated to ${statusForm.targetStatus}`);
      setStatusModalComplaint(null);
      fetchComplaints();
    } catch (err) {
      setStatusError(err.userMessage || 'Failed to update status. Please verify transition rules.');
    } finally {
      setStatusSubmitting(false);
    }
  };

  // =========================================================================
  // Resolution Modal Handlers
  // =========================================================================
  const openResolveModal = (complaint) => {
    setResolveModalComplaint(complaint);
    setResolvePhoto(null);
    setResolvePhotoPreview(null);
    setResolveNote('');
    setResolveError('');
  };

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setResolveError('Invalid image format. Only JPEG, PNG, and WebP are accepted.');
      return;
    }

    // Validate size (5 MB = 5 * 1024 * 1024 bytes)
    if (file.size > 5 * 1024 * 1024) {
      setResolveError('Photo file size exceeds 5 MB limit. Please select a smaller photo.');
      return;
    }

    setResolveError('');
    setResolvePhoto(file);
    const previewUrl = URL.createObjectURL(file);
    setResolvePhotoPreview(previewUrl);
  };

  const handleResolveSubmit = async (e) => {
    e.preventDefault();
    if (!resolveModalComplaint) return;

    if (!resolvePhoto) {
      setResolveError('A proof of resolution photo is mandatory.');
      return;
    }

    if (!resolveNote.trim()) {
      setResolveError('Please provide a detailed resolution summary note describing the work done.');
      return;
    }

    setResolveSubmitting(true);
    setResolveError('');
    try {
      await resolveComplaint(resolveModalComplaint.id, resolvePhoto, resolveNote);
      showToast(`Complaint ${resolveModalComplaint.tracking_id} successfully marked as RESOLVED!`);
      setResolveModalComplaint(null);
      fetchComplaints();
    } catch (err) {
      setResolveError(err.userMessage || 'Failed to submit complaint resolution proof.');
    } finally {
      setResolveSubmitting(false);
    }
  };

  // =========================================================================
  // Admin Assignment Modal Handlers
  // =========================================================================
  const openAssignModal = async (complaint) => {
    setAssignModalComplaint(complaint);
    setSelectedOfficerId('');
    setAssignNote('');
    setAssignError('');
    setAssignLoadingOfficers(true);

    try {
      // First try to fetch officers matching department
      const data = await listOfficers(complaint.department);
      if (data.items && data.items.length > 0) {
        setAvailableOfficers(data.items);
        setSelectedOfficerId(String(data.items[0].id));
      } else {
        // Fallback: list all officers
        const allData = await listOfficers();
        setAvailableOfficers(allData.items || []);
        if (allData.items?.length > 0) {
          setSelectedOfficerId(String(allData.items[0].id));
        }
      }
    } catch (err) {
      setAssignError('Unable to load officer list. Please verify your admin privileges.');
    } finally {
      setAssignLoadingOfficers(false);
    }
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!assignModalComplaint || !selectedOfficerId) {
      setAssignError('Please select a municipal officer to assign.');
      return;
    }

    setAssignSubmitting(true);
    setAssignError('');
    try {
      await assignComplaint(assignModalComplaint.id, selectedOfficerId, assignNote);
      showToast(`Complaint ${assignModalComplaint.tracking_id} successfully assigned to officer.`);
      setAssignModalComplaint(null);
      fetchComplaints();
    } catch (err) {
      setAssignError(err.userMessage || 'Failed to assign complaint. Ensure officer department matches.');
    } finally {
      setAssignSubmitting(false);
    }
  };

  return (
    <OfficerLayout>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-navy-950 text-white px-5 py-3 rounded-xl shadow-2xl border border-teal-500/50 flex items-center gap-3 animate-slideUp">
          <CheckCircle className="w-5 h-5 text-teal-400 flex-shrink-0" />
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

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-950 tracking-tight font-display">
              {isAdmin ? 'Municipal Complaints Overview' : 'Officer Queue'}
            </h1>
            <span className="text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded-full">
              {isAdmin ? 'Administrative View' : officer?.department}
            </span>
          </div>
          <p className="text-sm text-slate-500">
            {isAdmin
              ? 'Supervise and assign citizen grievances across all municipal departments.'
              : `Grievances assigned to ${officer?.name || 'Officer'} for field resolution.`}
          </p>
        </div>

        {/* View Switcher & Refresh */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-white p-1 rounded-xl border border-slate-200 shadow-2xs flex items-center">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'table'
                  ? 'bg-navy-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <ListIcon className="w-3.5 h-3.5" />
              <span>{t('listView', 'List')}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'cards'
                  ? 'bg-navy-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Cards</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('map')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'map'
                  ? 'bg-navy-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span>{t('mapView', 'Map')}</span>
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            icon={RefreshCw}
            isLoading={isLoading}
            onClick={fetchComplaints}
            title="Refresh queue"
          >
            {t('refresh', 'Refresh')}
          </Button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {t('totalAssigned', 'Assigned')}
            </span>
            <div className="w-8 h-8 rounded-lg bg-navy-50 text-navy-800 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-navy-950">{stats.total}</span>
            <span className="text-xs text-slate-400">grievances</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {t('pendingOpen', 'Open / Pending')}
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-600">{stats.open}</span>
            <span className="text-xs text-slate-400">awaiting action</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {t('inProgress', 'In Progress')}
            </span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-sky-600">{stats.inProgress}</span>
            <span className="text-xs text-slate-400">underway</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {t('resolvedTotal', 'Resolved')}
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-600">{stats.resolved}</span>
            <span className="text-xs text-slate-400">completed</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs mb-6">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Tracking ID, issue description, category..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="NEEDS_INFO">Needs Info</option>
              <option value="RESOLVED">Resolved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Priority:</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="ALL">All Priorities</option>
              <option value="HIGH">High Priority</option>
              <option value="MEDIUM">Medium Priority</option>
              <option value="LOW">Low Priority</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main View Area */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-2xs">
          <Spinner size="lg" color="teal" className="mx-auto mb-4" />
          <p className="text-sm font-semibold text-slate-600">Loading complaints queue...</p>
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchComplaints} />
      ) : filteredComplaints.length === 0 ? (
        <EmptyState
          title={t('emptyTitle', 'No complaints found')}
          description={
            searchQuery || statusFilter !== 'ALL' || priorityFilter !== 'ALL'
              ? 'No grievances match your current filters. Try resetting search criteria.'
              : 'There are currently no complaints in your assigned queue.'
          }
          actionLabel="Reset Filters"
          onAction={() => {
            setStatusFilter('ALL');
            setPriorityFilter('ALL');
            setSearchQuery('');
          }}
        />
      ) : viewMode === 'map' ? (
        /* Map View */
        <div className="space-y-4">
          <ComplaintMap complaints={filteredComplaints} height="600px" />
          <p className="text-xs text-slate-500 text-right">
            Showing {filteredComplaints.length} geotagged grievances on map. Click pins for summary and actions.
          </p>
        </div>
      ) : viewMode === 'cards' ? (
        /* Cards View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredComplaints.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs hover:shadow-card transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="font-mono text-xs font-extrabold text-navy-950 bg-navy-50 px-2 py-0.5 rounded border border-navy-100">
                    {c.tracking_id}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <PriorityBadge priority={c.priority} size="sm" />
                    <StatusBadge status={c.status} size="sm" />
                  </div>
                </div>

                <div className="mb-2">
                  <span className="text-xs font-bold text-slate-900">{c.category}</span>
                  <span className="text-xs text-slate-500 font-medium ml-1.5">• {c.department}</span>
                </div>

                <p className="text-sm text-slate-700 font-medium line-clamp-3 leading-relaxed mb-4">
                  {c.citizen_text}
                </p>

                {c.duplicate_group_id && (
                  <div className="mb-3 text-[11px] font-semibold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 inline-flex items-center gap-1.5">
                    <Layers className="w-3 h-3 text-amber-600" />
                    <span>Duplicate Group: {c.duplicate_group_id}</span>
                  </div>
                )}
              </div>

              <div>
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 mb-3">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {formatRelativeTime(c.created_at)}
                  </span>
                  <span className="font-mono text-[11px]">
                    {Number(c.latitude).toFixed(3)}, {Number(c.longitude).toFixed(3)}
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  <Link
                    to={`/officer/complaints/${c.id}`}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-600" />
                    <span>Details</span>
                  </Link>

                  {c.status !== 'RESOLVED' && c.status !== 'REJECTED' && (
                    <button
                      type="button"
                      onClick={() => openStatusModal(c)}
                      className="px-2.5 py-1.5 bg-navy-50 hover:bg-navy-100 text-navy-800 rounded-lg text-xs font-bold transition-colors border border-navy-200"
                      title="Update lifecycle status"
                    >
                      Status
                    </button>
                  )}

                  {c.status === 'IN_PROGRESS' && (
                    <button
                      type="button"
                      onClick={() => openResolveModal(c)}
                      className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs"
                      title="Resolve issue with photo proof"
                    >
                      Resolve
                    </button>
                  )}

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => openAssignModal(c)}
                      className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-800 rounded-lg text-xs font-bold transition-colors border border-purple-200"
                      title="Assign to department officer"
                    >
                      Assign
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-5 py-3.5">
                    Tracking ID
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Category & Department
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Description
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Priority
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Status
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Submitted
                  </th>
                  <th scope="col" className="px-5 py-3.5 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredComplaints.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-mono text-xs font-extrabold text-navy-950">
                          {c.tracking_id}
                        </span>
                        {c.duplicate_group_id && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded mt-1 border border-amber-200/80 max-w-fit">
                            <Layers className="w-2.5 h-2.5" />
                            Group {c.duplicate_group_id.slice(0, 8)}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900 text-xs">{c.category}</span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          {c.department}
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-4 max-w-xs">
                      <p className="text-xs text-slate-700 line-clamp-2 leading-relaxed">
                        {c.citizen_text}
                      </p>
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap">
                      <PriorityBadge priority={c.priority} size="sm" />
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap">
                      <StatusBadge status={c.status} size="sm" />
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap text-xs text-slate-500">
                      {formatRelativeTime(c.created_at)}
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <Link
                          to={`/officer/complaints/${c.id}`}
                          className="p-1.5 text-slate-600 hover:text-navy-900 hover:bg-slate-100 rounded-lg transition-colors"
                          title="View complete complaint details"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>

                        {c.status !== 'RESOLVED' && c.status !== 'REJECTED' && (
                          <button
                            type="button"
                            onClick={() => openStatusModal(c)}
                            className="px-2 py-1 text-xs font-bold text-navy-800 bg-navy-50 hover:bg-navy-100 rounded-md border border-navy-200 transition-colors"
                            title="Update status"
                          >
                            Status
                          </button>
                        )}

                        {c.status === 'IN_PROGRESS' && (
                          <button
                            type="button"
                            onClick={() => openResolveModal(c)}
                            className="px-2 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md shadow-2xs transition-colors"
                            title="Resolve with photo proof"
                          >
                            Resolve
                          </button>
                        )}

                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => openAssignModal(c)}
                            className="px-2 py-1 text-xs font-bold text-purple-800 bg-purple-50 hover:bg-purple-100 rounded-md border border-purple-200 transition-colors"
                            title="Assign to officer"
                          >
                            Assign
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. Status Transition Modal */}
      {/* ========================================================================= */}
      {statusModalComplaint && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-scaleIn">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-navy-950">Update Complaint Status</h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Tracking ID: {statusModalComplaint.tracking_id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStatusModalComplaint(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
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
                <div className="flex items-center gap-2">
                  <StatusBadge status={statusModalComplaint.status} size="md" />
                </div>
              </div>

              <div>
                <label
                  htmlFor="target-status-select"
                  className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1"
                >
                  New Target Status <span className="text-rose-500">*</span>
                </label>
                <select
                  id="target-status-select"
                  value={statusForm.targetStatus}
                  onChange={(e) => setStatusForm({ ...statusForm, targetStatus: e.target.value })}
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
                >
                  <option value="" disabled>
                    Select next lifecycle status...
                  </option>
                  {getAllowedTransitions(statusModalComplaint.status).map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Note: Directly resolving requires proof of work photo via the "Resolve" action.
                </p>
              </div>

              <div>
                <label
                  htmlFor="status-note-input"
                  className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1"
                >
                  Operational Note / Reason
                </label>
                <textarea
                  id="status-note-input"
                  rows={3}
                  value={statusForm.note}
                  onChange={(e) => setStatusForm({ ...statusForm, note: e.target.value })}
                  placeholder="e.g. Field inspection completed. Work crew deployed to site."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setStatusModalComplaint(null)}
                  disabled={statusSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={statusSubmitting}
                  disabled={!statusForm.targetStatus}
                >
                  Update Lifecycle
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. Complaint Resolution Modal (Multipart Form) */}
      {/* ========================================================================= */}
      {resolveModalComplaint && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-scaleIn">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-navy-950 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>Resolve Complaint</span>
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Tracking ID: {resolveModalComplaint.tracking_id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setResolveModalComplaint(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
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

              {/* Resolution Photo Upload */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  {t('resolutionPhoto', 'Proof of Resolution Photo')}{' '}
                  <span className="text-rose-500">*</span>
                </label>

                {resolvePhotoPreview ? (
                  <div className="relative rounded-xl overflow-hidden border border-slate-300 bg-slate-900 max-h-56 flex items-center justify-center group">
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
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-slate-900/80 text-white hover:bg-rose-600 transition-colors shadow-md"
                      title="Remove image"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <div className="absolute bottom-2 left-2 bg-slate-900/80 text-white text-[10px] font-mono px-2 py-0.5 rounded">
                      {(resolvePhoto.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-slate-300 hover:border-teal-500 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-teal-50/20 group">
                    <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                      <Upload className="w-6 h-6" />
                    </div>
                    <span className="text-sm font-bold text-slate-700">
                      Upload Field Resolution Photo
                    </span>
                    <span className="text-xs text-slate-500 mt-1">
                      JPEG, PNG or WebP format (Max 5 MB)
                    </span>
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

              {/* Resolution Note */}
              <div>
                <label
                  htmlFor="resolve-note-input"
                  className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                >
                  {t('resolutionNote', 'Resolution Work Summary')}{' '}
                  <span className="text-rose-500">*</span>
                </label>
                <textarea
                  id="resolve-note-input"
                  rows={3}
                  value={resolveNote}
                  onChange={(e) => setResolveNote(e.target.value)}
                  placeholder="Detailed work description (e.g. Pothole filled with cold asphalt mix, leveled and compacted. Road restored to traffic flow.)"
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setResolveModalComplaint(null)}
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
                  Mark Issue Resolved
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. Admin Officer Assignment Modal */}
      {/* ========================================================================= */}
      {assignModalComplaint && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-scaleIn">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-navy-950 flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-purple-600" />
                  <span>Assign Complaint to Officer</span>
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Tracking ID: {assignModalComplaint.tracking_id} • Dept: {assignModalComplaint.department}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAssignModalComplaint(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
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
                  htmlFor="officer-select"
                  className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                >
                  Select Department Officer <span className="text-rose-500">*</span>
                </label>
                {assignLoadingOfficers ? (
                  <div className="p-3 bg-slate-50 rounded-xl flex items-center gap-2 text-xs text-slate-500">
                    <Spinner size="sm" color="teal" />
                    <span>Loading available officers...</span>
                  </div>
                ) : availableOfficers.length === 0 ? (
                  <div className="p-3 bg-amber-50 text-amber-800 text-xs rounded-xl border border-amber-200">
                    No active officers found for this department. Register a new officer in Officer Directory.
                  </div>
                ) : (
                  <select
                    id="officer-select"
                    value={selectedOfficerId}
                    onChange={(e) => setSelectedOfficerId(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
                  >
                    {availableOfficers.map((off) => (
                      <option key={off.id} value={off.id}>
                        {off.name} ({off.department}) - {off.email}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label
                  htmlFor="assign-note-input"
                  className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                >
                  Administrative Assignment Note
                </label>
                <textarea
                  id="assign-note-input"
                  rows={2}
                  value={assignNote}
                  onChange={(e) => setAssignNote(e.target.value)}
                  placeholder="e.g. Assigned for urgent road inspection as per Ward 4 supervisor directive."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setAssignModalComplaint(null)}
                  disabled={assignSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={assignSubmitting}
                  disabled={!selectedOfficerId || availableOfficers.length === 0}
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

