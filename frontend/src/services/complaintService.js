import api from './api';

/**
 * Submit a new citizen complaint
 * @param {Object} payload - { citizen_text, voice_transcript, latitude, longitude }
 * @returns {Promise<Object>} Created ComplaintResponse
 */
export async function createComplaint(payload) {
  const response = await api.post('/complaints', {
    citizen_text: payload.citizen_text.trim(),
    voice_transcript: payload.voice_transcript ? payload.voice_transcript.trim() : null,
    latitude: Number(payload.latitude),
    longitude: Number(payload.longitude),
  });
  return response.data;
}

/**
 * Track a complaint by its unique tracking ID (e.g. CP-B7C97719)
 * @param {string} trackingId
 * @returns {Promise<Object>} ComplaintResponse
 */
export async function trackComplaint(trackingId) {
  const cleanId = String(trackingId).trim().toUpperCase();
  const response = await api.get(`/complaints/track/${encodeURIComponent(cleanId)}`);
  return response.data;
}

/**
 * Fetch complaints list with pagination and filtering
 * @param {Object} params - { skip, limit, status, category }
 * @returns {Promise<Object>} ComplaintListResponse { total, items, skip, limit }
 */
export async function getComplaints(params = {}) {
  const response = await api.get('/complaints', { params });
  return response.data;
}

