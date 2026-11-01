import React, { useState, useEffect, useCallback } from 'react';
import {
  Wrench,
  ShieldAlert,
  Navigation,
  CheckCircle2,
  Upload,
  RefreshCw,
  ExternalLink,
  Bell,
} from 'lucide-react';
import OfficerLayout from '../layouts/OfficerLayout';
import ComplaintMap from '../components/ComplaintMap';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import { useAuth } from '../context/AuthContext';
import {
  getWorkerComplaints,
  submitWorkerProgress,
  listSOSAlerts,
  updateSOSStatus,
  estimateRoute,
  getNotifications,
  connectLiveUpdates,
} from '../services/advancedService';

export default function WorkerPortal({ defaultMode = 'worker' }) {
  const { officer } = useAuth();
  const [mode, setMode] = useState(defaultMode); // 'worker' or 'sos'

  // Worker Tasks State
  const [tasks, setTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [workStatus, setWorkStatus] = useState('WORK_COMPLETED');
  const [completionNote, setCompletionNote] = useState('');
  const [beforePhoto, setBeforePhoto] = useState(null);
  const [afterPhoto, setAfterPhoto] = useState(null);
  const [submittingWork, setSubmittingWork] = useState(false);

  // SOS Emergency Command State (Officer/Admin)
  const [sosList, setSosList] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState('');

  const canViewSOS = officer && ['ADMIN', 'OFFICER'].includes((officer.role || '').toUpperCase());

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [workerData, notifData] = await Promise.all([
        getWorkerComplaints(),
        getNotifications(),
      ]);
      const items = workerData?.items || [];
      setTasks(items);
      if (items.length > 0 && !selectedTask) {
        setSelectedTask(items[0]);
      }
      setNotifications(notifData || []);

      if (canViewSOS) {
        const sosRes = await listSOSAlerts();
        setSosList(sosRes?.items || []);
      }
    } catch (err) {
      console.warn('WorkerPortal load error:', err);
    } finally {
      setLoading(false);
    }
  }, [canViewSOS, selectedTask]);

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 15000);
    const disconnect = connectLiveUpdates(() => {
      loadData();
    });
    return () => {
      clearInterval(timer);
      disconnect();
    };
  }, [loadData]);

  useEffect(() => {
    if (selectedTask) {
      estimateRoute(11.3635, 77.8282, selectedTask.latitude, selectedTask.longitude)
        .then(setRouteInfo)
        .catch(() => setRouteInfo(null));
    }
  }, [selectedTask]);

  const handleSubmitWorkerUpdate = async (e) => {
    e.preventDefault();
    if (!selectedTask) return;
    setSubmittingWork(true);
    setFeedback('');
    try {
      const updated = await submitWorkerProgress(selectedTask.id, {
        workStatus,
        completionNote: completionNote.trim() || 'Field inspection and repair work completed.',
        beforePhoto,
        afterPhoto,
      });
      setSelectedTask(updated);
      setCompletionNote('');
      setBeforePhoto(null);
      setAfterPhoto(null);
      setFeedback(`Successfully recorded ${workStatus} for ${updated.case_id || updated.tracking_id}!`);
      loadData();
    } catch (err) {
      setFeedback(err.userMessage || 'Failed to submit worker update.');
    } finally {
      setSubmittingWork(false);
    }
  };

  const handleUpdateSOS = async (sosId, newStatus, noteText) => {
    try {
      await updateSOSStatus(sosId, {
        status: newStatus,
        note: noteText,
      });
      loadData();
    } catch (err) {
      alert(err.userMessage || 'Failed to update SOS status.');
    }
  };

  return (
    <OfficerLayout>
      <div className="space-y-6">
        {/* Top Mode Switcher & Live Notification Ticker */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMode('worker')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
                mode === 'worker'
                  ? 'bg-navy-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Wrench className="w-4 h-4 text-teal-400" />
              <span>Field Worker Workspace ({tasks.length})</span>
            </button>

            {canViewSOS && (
              <button
                type="button"
                onClick={() => setMode('sos')}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
                  mode === 'sos'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                <ShieldAlert className="w-4 h-4" />
                <span>Emergency SOS Command ({sosList.length})</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {notifications.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                <Bell className="w-3.5 h-3.5 text-teal-600" />
                <span className="truncate max-w-[260px] font-semibold">
                  {notifications[0].title}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={loadData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Sync Live</span>
            </button>
          </div>
        </div>

        {/* =============================================================== */}
        {/* MODE 1: FIELD WORKER WORKSPACE                                  */}
        {/* =============================================================== */}
        {mode === 'worker' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Assigned Tasks Queue */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3 max-h-[680px] overflow-y-auto">
              <h3 className="text-sm font-extrabold text-slate-900">
                Assigned Field Work Queue ({tasks.length})
              </h3>
              {tasks.length === 0 ? (
                <p className="text-xs text-slate-500 py-8 text-center">
                  No field tasks currently assigned to your account.
                </p>
              ) : (
                tasks.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTask(t)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all space-y-1.5 ${
                      selectedTask?.id === t.id
                        ? 'bg-teal-50/70 border-teal-500 ring-2 ring-teal-100'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-extrabold text-navy-900">
                        {t.case_id || t.tracking_id}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <StatusBadge status={t.status} size="sm" />
                        <PriorityBadge priority={t.priority} size="sm" />
                      </div>
                    </div>
                    <p className="text-xs text-slate-800 font-medium line-clamp-2">
                      {t.citizen_text}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {t.address_text || `${t.latitude.toFixed(4)}°N, ${t.longitude.toFixed(4)}°E`}
                    </p>
                  </button>
                ))
              )}
            </div>

            {/* Selected Task Navigation + Before/After Evidence Upload */}
            <div className="lg:col-span-7 space-y-5">
              {selectedTask ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                    <div>
                      <span className="text-xs font-mono font-extrabold text-teal-700">
                        {selectedTask.case_id || selectedTask.tracking_id} • {selectedTask.category}
                      </span>
                      <h3 className="text-base font-extrabold text-slate-900 mt-0.5">
                        {selectedTask.citizen_text}
                      </h3>
                    </div>
                    {routeInfo && (
                      <a
                        href={routeInfo.google_maps_directions_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold hover:bg-teal-700"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        <span>
                          Navigate ({routeInfo.estimated_road_distance_km} km • ~
                          {routeInfo.estimated_travel_minutes} min {routeInfo.compass_direction})
                        </span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  <ComplaintMap
                    latitude={selectedTask.latitude}
                    longitude={selectedTask.longitude}
                    interactive={false}
                    height="240px"
                    defaultSatellite={true}
                  />

                  {feedback && (
                    <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 text-xs font-bold text-teal-800">
                      {feedback}
                    </div>
                  )}

                  <form onSubmit={handleSubmitWorkerUpdate} className="space-y-4 pt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Field Work Action
                        </label>
                        <select
                          value={workStatus}
                          onChange={(e) => setWorkStatus(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold"
                        >
                          <option value="IN_PROGRESS">Mark Work In Progress</option>
                          <option value="WORK_COMPLETED">Submit Field Work Completion</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Before & After Photos (Optional, &lt;= 5MB)
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={(e) => setBeforePhoto(e.target.files?.[0] || null)}
                            className="text-[11px] w-full"
                            title="Before Photo"
                          />
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={(e) => setAfterPhoto(e.target.files?.[0] || null)}
                            className="text-[11px] w-full"
                            title="After Photo"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Field Inspection & Work Completion Notes *
                      </label>
                      <textarea
                        rows={3}
                        required
                        value={completionNote}
                        onChange={(e) => setCompletionNote(e.target.value)}
                        placeholder="Describe materials used, site inspection findings, and repair completion..."
                        className="w-full rounded-xl border border-slate-300 p-3 text-xs"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submittingWork}
                      className="w-full py-3 rounded-xl bg-navy-900 hover:bg-navy-800 text-white text-xs font-extrabold inline-flex items-center justify-center gap-2"
                    >
                      <Upload className="w-4 h-4 text-teal-400" />
                      <span>
                        {submittingWork
                          ? 'Uploading Field Update...'
                          : 'Submit Worker Field Evidence & Notify Officer'}
                      </span>
                    </button>
                  </form>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-xs text-slate-500">
                  Select a task from the queue to view satellite location and upload field evidence.
                </div>
              )}
            </div>
          </div>
        )}

        {/* =============================================================== */}
        {/* MODE 2: RESTRICTED OFFICER/ADMIN SOS EMERGENCY COMMAND          */}
        {/* =============================================================== */}
        {mode === 'sos' && canViewSOS && (
          <div className="space-y-4">
            <div className="bg-rose-950 text-white p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-rose-600">
                  Restricted Emergency Layer
                </span>
                <h3 className="text-lg font-extrabold mt-1">
                  Active Public Safety & SOS Incidents ({sosList.length})
                </h3>
                <p className="text-xs text-rose-200">
                  Visible only to authenticated municipal officers and administrators.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sosList.map((sos) => (
                <div
                  key={sos.id}
                  className="bg-white rounded-2xl border-2 border-rose-200 p-5 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-extrabold text-rose-700">
                      {sos.case_id || sos.tracking_id}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-rose-100 text-rose-800">
                      {sos.status}
                    </span>
                  </div>
                  <h4 className="text-sm font-extrabold text-slate-900">{sos.emergency_type}</h4>
                  <p className="text-xs text-slate-700">{sos.description}</p>
                  <p className="text-[11px] text-slate-500 font-semibold">
                    📍 {sos.address_text} ({sos.latitude.toFixed(4)}°N, {sos.longitude.toFixed(4)}°E)
                  </p>

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateSOS(
                          sos.id,
                          'ACKNOWLEDGED',
                          'Emergency control room acknowledged alert.'
                        )
                      }
                      className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-bold"
                    >
                      Acknowledge
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateSOS(
                          sos.id,
                          'RESPONDING',
                          'Emergency response team dispatched to coordinates.'
                        )
                      }
                      className="px-3 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-bold"
                    >
                      Mark Responding
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateSOS(
                          sos.id,
                          'RESOLVED',
                          'Hazard secured and verified by field responder.'
                        )
                      }
                      className="px-3 py-1.5 rounded-lg bg-navy-900 text-white text-xs font-bold inline-flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Resolve</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </OfficerLayout>
  );
}

