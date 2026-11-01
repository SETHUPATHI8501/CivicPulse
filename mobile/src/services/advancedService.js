import apiClient from './api';

export const reverseGeocodePoint = async (latitude, longitude) => {
  const res = await apiClient.get('/gis/reverse-geocode', {
    params: { latitude, longitude },
  });
  return res.data;
};

export const getNearbyComplaints = async ({
  latitude,
  longitude,
  radius_m = 500,
  category,
  status,
  limit = 50,
}) => {
  const params = { latitude, longitude, radius_m, limit };
  if (category && category !== 'ALL') params.category = category;
  if (status && status !== 'ALL') params.status = status;
  const res = await apiClient.get('/gis/nearby', { params });
  return res.data;
};

export const estimateRoute = async ({
  from_lat,
  from_lng,
  to_lat,
  to_lng,
  mode = 'driving',
}) => {
  const res = await apiClient.get('/gis/route-estimate', {
    params: { from_lat, from_lng, to_lat, to_lng, mode },
  });
  return res.data;
};

export const processVoiceCommand = async ({
  transcript,
  language = 'auto',
  latitude,
  longitude,
}) => {
  const res = await apiClient.post('/voice/process', {
    transcript,
    language,
    latitude,
    longitude,
  });
  return res.data;
};

export const askCivicAssistant = async ({
  message,
  language = 'en',
  tracking_id,
  latitude,
  longitude,
}) => {
  const res = await apiClient.post('/ai/assistant', {
    message,
    language,
    tracking_id: tracking_id || undefined,
    latitude: latitude ?? undefined,
    longitude: longitude ?? undefined,
  });
  return res.data;
};

export const createSosAlert = async ({
  emergency_type,
  description,
  latitude,
  longitude,
  accuracy_m,
  reporter_name,
  reporter_phone,
  trusted_contacts = [],
  voice_transcript,
  confirmed = true,
}) => {
  const res = await apiClient.post('/sos', {
    emergency_type,
    description,
    latitude: Number(latitude),
    longitude: Number(longitude),
    accuracy_m: accuracy_m ? Number(accuracy_m) : undefined,
    reporter_name,
    reporter_phone,
    trusted_contacts,
    voice_transcript,
    confirmed: Boolean(confirmed),
  });
  return res.data;
};

export const trackSosAlert = async (sosId) => {
  const res = await apiClient.get(`/sos/track/${encodeURIComponent(sosId.trim())}`);
  return res.data;
};

export const cancelSosAlert = async (sosId, note = 'Cancelled by citizen') => {
  const res = await apiClient.post(`/sos/track/${encodeURIComponent(sosId.trim())}/cancel`, {
    note,
  });
  return res.data;
};

export const listSosAlerts = async (params = {}) => {
  const res = await apiClient.get('/sos', { params });
  return res.data;
};

export const updateSosAlertStatus = async (alertId, { status, note, assigned_officer_id }) => {
  const res = await apiClient.patch(`/sos/${alertId}/status`, {
    status,
    note,
    assigned_officer_id,
  });
  return res.data;
};

export const getWorkerComplaints = async (params = {}) => {
  const res = await apiClient.get('/worker/complaints', { params });
  return res.data;
};

export const submitWorkerProgress = async (complaintId, { status = 'IN_PROGRESS', note }) => {
  const formData = new FormData();
  formData.append('status', status);
  formData.append('note', note);
  const res = await apiClient.post(`/worker/complaints/${complaintId}/progress`, formData);
  return res.data;
};

export const getNotifications = async (role = 'CITIZEN', limit = 25) => {
  const res = await apiClient.get('/notifications', { params: { role, limit } });
  return res.data;
};

