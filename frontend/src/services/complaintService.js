import api from './api';

const RECENT_CASES_STORAGE_KEY = 'civicpulse_recent_cases_v1';

export function saveRecentCase(complaint) {
  if (!complaint || typeof window === 'undefined') return;
  try {
    const caseId = complaint.case_id || complaint.tracking_id;
    if (!caseId) return;
    const raw = window.localStorage.getItem(RECENT_CASES_STORAGE_KEY);
    const existing = raw ? JSON.parse(raw) : [];
    const filtered = existing.filter((item) => (item.case_id || item.tracking_id) !== caseId);
    const entry = {
      id: complaint.id,
      case_id: caseId,
      tracking_id: complaint.tracking_id || caseId,
      category: complaint.category,
      department: complaint.department,
      status: complaint.status,
      priority: complaint.priority,
      citizen_text: complaint.citizen_text,
      created_at: complaint.created_at || new Date().toISOString(),
    };
    window.localStorage.setItem(
      RECENT_CASES_STORAGE_KEY,
      JSON.stringify([entry, ...filtered].slice(0, 12))
    );
  } catch {
    // ignore storage errors
  }
}

export function getRecentCases() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_CASES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Submit a new citizen complaint (JSON)
 * @param {Object} payload - { citizen_text, voice_transcript, latitude, longitude, idempotency_key, is_private }
 * @returns {Promise<Object>} Created ComplaintResponse
 */
export async function createComplaint(payload) {
  if (payload.photo) {
    return createComplaintWithPhoto(payload);
  }
  const headers = {};
  if (payload.idempotency_key) {
    headers['X-Idempotency-Key'] = payload.idempotency_key;
  }
  const response = await api.post(
    '/complaints',
    {
      citizen_text: payload.citizen_text.trim(),
      voice_transcript: payload.voice_transcript ? payload.voice_transcript.trim() : null,
      latitude: Number(payload.latitude),
      longitude: Number(payload.longitude),
      idempotency_key: payload.idempotency_key || null,
      is_private: Boolean(payload.is_private),
    },
    { headers }
  );
  saveRecentCase(response.data);
  return response.data;
}

/**
 * Submit a new citizen complaint with optional photo evidence (Multipart FormData)
 * @param {Object} payload - { citizen_text, voice_transcript, latitude, longitude, photo, idempotency_key }
 * @returns {Promise<Object>} Created ComplaintResponse
 */
export async function createComplaintWithPhoto(payload) {
  const formData = new FormData();
  formData.append('citizen_text', payload.citizen_text.trim());
  formData.append('latitude', String(Number(payload.latitude)));
  formData.append('longitude', String(Number(payload.longitude)));
  if (payload.voice_transcript && payload.voice_transcript.trim()) {
    formData.append('voice_transcript', payload.voice_transcript.trim());
  }
  if (payload.photo) {
    formData.append('photo', payload.photo);
  }
  const headers = {};
  if (payload.idempotency_key) {
    headers['X-Idempotency-Key'] = payload.idempotency_key;
  }
  const response = await api.post('/complaints/with-photo', formData, { headers });
  saveRecentCase(response.data);
  return response.data;
}

/**
 * Fetch aggregated public complaint statistics for citizen dashboard
 * @returns {Promise<Object>} PublicStatsResponse
 */
export async function getPublicStats() {
  const response = await api.get('/complaints/public-stats');
  return response.data;
}

/**
 * Track a complaint by its unified Case ID (e.g. CP-2026-00093) or legacy tracking ID (e.g. CP-6D07D491)
 * @param {string} trackingId
 * @returns {Promise<Object>} ComplaintResponse
 */
export async function trackComplaint(trackingId) {
  const cleanId = String(trackingId).trim().toUpperCase();
  const response = await api.get(`/complaints/track/${encodeURIComponent(cleanId)}`);
  saveRecentCase(response.data);
  return response.data;
}

/**
 * Fetch complaints list with pagination and filtering
 * @param {Object} params - { skip, limit, status, category, case_id }
 * @returns {Promise<Object>} ComplaintListResponse { total, items, skip, limit }
 */
export async function getComplaints(params = {}) {
  const response = await api.get('/complaints', { params });
  return response.data;
}
