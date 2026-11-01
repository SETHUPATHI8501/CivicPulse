import apiClient from './api';

export async function reverseGeocode(latitude, longitude, lang = 'en') {
  const response = await apiClient.get('/gis/reverse-geocode', {
    params: { latitude, longitude, lang },
  });
  return response.data;
}

export async function getNearbyComplaints({
  latitude,
  longitude,
  radius_km = 5.0,
  category,
  status,
  limit = 50,
}) {
  const params = { latitude, longitude, radius_km, limit };
  if (category && category !== 'ALL') params.category = category;
  if (status && status !== 'ALL') params.status = status;
  const response = await apiClient.get('/gis/nearby', { params });
  return response.data;
}

export async function estimateRoute(fromLat, fromLon, toLat, toLon) {
  const response = await apiClient.get('/gis/route-estimate', {
    params: {
      from_lat: fromLat,
      from_lon: fromLon,
      to_lat: toLat,
      to_lon: toLon,
    },
  });
  return response.data;
}

export async function processVoiceInput(transcript, preferredLanguage = 'en') {
  const response = await apiClient.post('/voice/process', {
    transcript,
    preferred_language: preferredLanguage,
  });
  return response.data;
}

export async function askCivicAssistant({
  prompt,
  role_context = 'CITIZEN',
  language = 'en',
  tracking_id = null,
}) {
  const response = await apiClient.post('/ai/assistant', {
    prompt,
    role_context,
    language,
    tracking_id,
  });
  return response.data;
}

export async function getIntelligenceSummary() {
  const response = await apiClient.get('/ai/intelligence-summary');
  return response.data;
}

export async function submitSOSAlert(payload, photoFile = null) {
  if (photoFile) {
    const formData = new FormData();
    formData.append('emergency_type', payload.emergency_type);
    formData.append('description', payload.description);
    formData.append('latitude', String(payload.latitude));
    formData.append('longitude', String(payload.longitude));
    if (payload.address_text) formData.append('address_text', payload.address_text);
    if (payload.citizen_name) formData.append('citizen_name', payload.citizen_name);
    if (payload.citizen_phone) formData.append('citizen_phone', payload.citizen_phone);
    if (payload.trusted_contacts) {
      formData.append('trusted_contacts_json', JSON.stringify(payload.trusted_contacts));
    }
    formData.append('photo', photoFile);
    const response = await apiClient.post('/sos/with-photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }
  const response = await apiClient.post('/sos', payload);
  return response.data;
}

export async function trackSOSAlert(trackingId) {
  const response = await apiClient.get(`/sos/track/${encodeURIComponent(trackingId.trim())}`);
  return response.data;
}

export async function cancelSOSAlert(trackingId, note = 'Cancelled by citizen.') {
  const response = await apiClient.patch(
    `/sos/track/${encodeURIComponent(trackingId.trim())}/cancel`,
    { note }
  );
  return response.data;
}

export async function listSOSAlerts(statusFilter = null) {
  const params = {};
  if (statusFilter && statusFilter !== 'ALL') params.status = statusFilter;
  const response = await apiClient.get('/sos', { params });
  return response.data;
}

export async function updateSOSStatus(sosId, { status, note, assigned_officer_id }) {
  const response = await apiClient.patch(`/sos/${sosId}/status`, {
    status,
    note,
    assigned_officer_id,
  });
  return response.data;
}

export async function listWorkers(department = null) {
  const params = {};
  if (department) params.department = department;
  const response = await apiClient.get('/officer/workers', { params });
  return response.data;
}

export async function assignWorkerToComplaint(complaintId, workerId, note = '') {
  const response = await apiClient.patch(`/officer/complaints/${complaintId}/assign-worker`, {
    worker_id: Number(workerId),
    note,
  });
  return response.data;
}

export async function getWorkerComplaints(statusFilter = null) {
  const params = {};
  if (statusFilter && statusFilter !== 'ALL') params.status = statusFilter;
  const response = await apiClient.get('/worker/complaints', { params });
  return response.data;
}

export async function submitWorkerProgress(
  complaintId,
  { workStatus = 'WORK_COMPLETED', completionNote, beforePhoto = null, afterPhoto = null }
) {
  const formData = new FormData();
  formData.append('work_status', workStatus);
  formData.append('completion_note', completionNote);
  if (beforePhoto) formData.append('before_photo', beforePhoto);
  if (afterPhoto) formData.append('after_photo', afterPhoto);

  const response = await apiClient.patch(
    `/worker/complaints/${complaintId}/progress`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return response.data;
}

export async function getNotifications(trackingId = null) {
  const params = {};
  if (trackingId) params.tracking_id = trackingId;
  const response = await apiClient.get('/notifications', { params });
  return response.data;
}

export function speakText(text, langCode = 'en-IN') {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return false;
  }
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langCode;
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

/**
 * Subscribe to real-time backend WebSocket events (/api/v1/ws/updates)
 * for instant Case ID synchronization across Mobile and Web clients.
 */
export function connectLiveUpdates(onEvent) {
  if (typeof window === 'undefined' || typeof WebSocket === 'undefined') {
    return () => {};
  }

  const rawApiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
  const wsUrl = `${rawApiBase.replace(/^http/, 'ws').replace(/\/+$/, '')}/ws/updates`;

  let ws = null;
  let closedByCaller = false;
  let reconnectTimer = null;

  const connect = () => {
    if (closedByCaller) return;
    try {
      ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload && payload.event && payload.event !== 'PONG' && onEvent) {
            onEvent(payload);
          }
        } catch {
          // ignore malformed messages
        }
      };
      ws.onclose = () => {
        if (!closedByCaller) {
          reconnectTimer = setTimeout(connect, 5000);
        }
      };
      ws.onerror = () => {
        try {
          ws.close();
        } catch {
          // ignore
        }
      };
    } catch {
      if (!closedByCaller) {
        reconnectTimer = setTimeout(connect, 6000);
      }
    }
  };

  connect();

  return () => {
    closedByCaller = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (ws) {
      try {
        ws.close();
      } catch {
        // ignore
      }
    }
  };
}


