import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from './api';

const RECENT_MOBILE_CASES_KEY = 'civicpulse_mobile_recent_cases_v1';

export async function saveRecentMobileCase(complaint) {
  if (!complaint) return;
  try {
    const caseId = complaint.case_id || complaint.tracking_id;
    if (!caseId) return;
    const raw = await AsyncStorage.getItem(RECENT_MOBILE_CASES_KEY);
    const existing = raw ? JSON.parse(raw) : [];
    const filtered = existing.filter((c) => (c.case_id || c.tracking_id) !== caseId);
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
    await AsyncStorage.setItem(
      RECENT_MOBILE_CASES_KEY,
      JSON.stringify([entry, ...filtered].slice(0, 12))
    );
  } catch {
    // ignore storage errors
  }
}

export async function getRecentMobileCases() {
  try {
    const raw = await AsyncStorage.getItem(RECENT_MOBILE_CASES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Submit a new citizen complaint (automatically uses multipart if photoAsset is attached)
 * @param {Object} payload - { citizen_text, voice_transcript, latitude, longitude, photoAsset, idempotency_key }
 */
export async function createComplaint(payload) {
  if (payload.photoAsset && payload.photoAsset.uri) {
    return createComplaintWithPhoto(payload);
  }

  const headers = {};
  if (payload.idempotency_key) {
    headers['X-Idempotency-Key'] = payload.idempotency_key;
  }

  const response = await apiClient.post(
    '/complaints',
    {
      citizen_text: payload.citizen_text.trim(),
      voice_transcript: payload.voice_transcript ? payload.voice_transcript.trim() : null,
      latitude: Number(payload.latitude),
      longitude: Number(payload.longitude),
      idempotency_key: payload.idempotency_key || null,
    },
    { headers }
  );
  await saveRecentMobileCase(response.data);
  return response.data;
}

/**
 * Submit a new citizen complaint with photo evidence via multipart/form-data
 * Endpoint: POST /api/v1/complaints/with-photo
 */
export async function createComplaintWithPhoto(payload) {
  const formData = new FormData();
  formData.append('citizen_text', payload.citizen_text.trim());
  formData.append('latitude', String(Number(payload.latitude)));
  formData.append('longitude', String(Number(payload.longitude)));

  if (payload.voice_transcript && payload.voice_transcript.trim()) {
    formData.append('voice_transcript', payload.voice_transcript.trim());
  }

  if (payload.photoAsset && payload.photoAsset.uri) {
    const uri = payload.photoAsset.uri;
    const filename =
      payload.photoAsset.fileName ||
      uri.split('/').pop() ||
      `complaint_${Date.now()}.jpg`;
    const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
    const mimeType =
      payload.photoAsset.mimeType ||
      (ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg');

    if (Platform.OS === 'web' && payload.photoAsset.file) {
      formData.append('photo', payload.photoAsset.file, filename);
    } else {
      formData.append('photo', {
        uri,
        name: filename.match(/\.(jpg|jpeg|png|webp)$/i) ? filename : `${filename}.jpg`,
        type: mimeType,
      });
    }
  }

  const headers = {};
  if (payload.idempotency_key) {
    headers['X-Idempotency-Key'] = payload.idempotency_key;
  }

  const response = await apiClient.post('/complaints/with-photo', formData, { headers });
  await saveRecentMobileCase(response.data);
  return response.data;
}

/**
 * Fetch live public statistics for citizen portal & dashboard telemetry
 * Endpoint: GET /api/v1/complaints/public-stats
 */
export async function getPublicStats() {
  const response = await apiClient.get('/complaints/public-stats');
  return response.data;
}

/**
 * Track a complaint by Case ID (e.g. CP-2026-00093) or legacy tracking ID (e.g. CP-6D07D491)
 * Endpoint: GET /api/v1/complaints/track/{tracking_id}
 */
export async function trackComplaint(trackingId) {
  const cleanId = String(trackingId).trim().toUpperCase();
  const response = await apiClient.get(`/complaints/track/${encodeURIComponent(cleanId)}`);
  await saveRecentMobileCase(response.data);
  return response.data;
}

/**
 * Fetch complaints list with pagination and filtering
 * Endpoint: GET /api/v1/complaints
 */
export async function getComplaints(params = {}) {
  const response = await apiClient.get('/complaints', { params });
  return response.data;
}

/**
 * Check backend health
 * Endpoint: GET /api/v1/complaints/public-stats
 */
export async function checkHealth() {
  try {
    const response = await apiClient.get('/complaints/public-stats');
    return { ok: true, data: response.data };
  } catch (error) {
    return { ok: false, error: error.userMessage || error.message };
  }
}

export default {
  createComplaint,
  createComplaintWithPhoto,
  getPublicStats,
  trackComplaint,
  getComplaints,
  checkHealth,
};
