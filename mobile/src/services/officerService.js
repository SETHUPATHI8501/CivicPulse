import { Platform } from 'react-native';
import apiClient from './api';

/**
 * Fetch complaints queue for logged in officer or admin
 * Endpoint: GET /api/v1/officer/complaints
 */
export async function getOfficerComplaints(params = {}) {
  const response = await apiClient.get('/officer/complaints', { params });
  return response.data;
}

/**
 * Fetch single complaint details by numeric ID
 * Endpoint: GET /api/v1/complaints/{id}
 */
export async function getComplaintDetails(complaintId) {
  const response = await apiClient.get(`/complaints/${complaintId}`);
  return response.data;
}

/**
 * Update complaint status transition
 * Endpoint: PATCH /api/v1/officer/complaints/{id}/status
 */
export async function updateComplaintStatus(complaintId, payload) {
  const response = await apiClient.patch(`/officer/complaints/${complaintId}/status`, payload);
  return response.data;
}

/**
 * Resolve complaint with mandatory resolution photo and note
 * Endpoint: PATCH /api/v1/officer/complaints/{id}/resolve
 */
export async function resolveComplaint(complaintId, photoAsset, resolutionNote) {
  const formData = new FormData();
  formData.append('resolution_note', resolutionNote.trim());

  const uri = photoAsset.uri;
  const filename =
    photoAsset.fileName ||
    uri.split('/').pop() ||
    `resolution_${Date.now()}.jpg`;
  const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
  const mimeType =
    photoAsset.mimeType ||
    (ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg');

  if (Platform.OS === 'web' && photoAsset.file) {
    formData.append('resolution_photo', photoAsset.file, filename);
  } else {
    formData.append('resolution_photo', {
      uri,
      name: filename.match(/\.(jpg|jpeg|png|webp)$/i) ? filename : `${filename}.jpg`,
      type: mimeType,
    });
  }

  const response = await apiClient.patch(`/officer/complaints/${complaintId}/resolve`, formData);
  return response.data;
}

/**
 * Admin: List all registered officers
 * Endpoint: GET /api/v1/officers
 */
export async function listOfficers(department) {
  const params = department ? { department } : {};
  const response = await apiClient.get('/officers', { params });
  return response.data;
}

/**
 * Admin: Create a new municipal officer account
 * Endpoint: POST /api/v1/officers
 */
export async function createOfficer(officerData) {
  const response = await apiClient.post('/officers', {
    name: officerData.name.trim(),
    email: officerData.email.trim().toLowerCase(),
    password: officerData.password,
    department: officerData.department.trim(),
    role: officerData.role || 'OFFICER',
  });
  return response.data;
}

/**
 * Admin: Assign a complaint to a specific officer
 * Endpoint: PATCH /api/v1/officer/complaints/{id}/assign
 */
export async function assignComplaint(complaintId, officerId, note) {
  const response = await apiClient.patch(`/officer/complaints/${complaintId}/assign`, {
    officer_id: Number(officerId),
    note: note ? note.trim() : undefined,
  });
  return response.data;
}

/**
 * Analytics: Get spatial hotspot summary
 * Endpoint: GET /api/v1/analytics/summary
 */
export async function getAnalyticsSummary(params = {}) {
  const response = await apiClient.get('/analytics/summary', { params });
  return response.data;
}

/**
 * Analytics: Get ranked spatial hotspot clusters
 * Endpoint: GET /api/v1/analytics/hotspots
 */
export async function getHotspots(params = {}) {
  const response = await apiClient.get('/analytics/hotspots', { params });
  return response.data;
}

export default {
  getOfficerComplaints,
  getComplaintDetails,
  updateComplaintStatus,
  resolveComplaint,
  listOfficers,
  createOfficer,
  assignComplaint,
  getAnalyticsSummary,
  getHotspots,
};

