import api from './api';

/**
 * Officer & Admin Authentication
 */
export async function loginOfficer(email, password) {
  const response = await api.post('/auth/token', {
    email: email.trim().toLowerCase(),
    password,
  });
  return response.data; // TokenResponse: { access_token, token_type, role, department, name }
}

export async function getOfficerProfile() {
  const response = await api.get('/auth/me');
  return response.data; // OfficerResponse: { id, name, email, department, role, is_active, created_at }
}

/**
 * Officer Complaint Queue & Details
 */
export async function getOfficerComplaints(params = {}) {
  const response = await api.get('/officer/complaints', { params });
  return response.data; // ComplaintListResponse: { total, items, skip, limit }
}

export async function getComplaintDetails(complaintId) {
  const response = await api.get(`/complaints/${complaintId}`);
  return response.data; // ComplaintResponse
}

/**
 * Complaint Status Transition
 * @param {number} complaintId
 * @param {Object} payload - { status, note }
 */
export async function updateComplaintStatus(complaintId, payload) {
  const response = await api.patch(`/officer/complaints/${complaintId}/status`, payload);
  return response.data; // ComplaintResponse
}

/**
 * Complaint Resolution (Multipart Form Data)
 * @param {number} complaintId
 * @param {File} photoFile
 * @param {string} resolutionNote
 */
export async function resolveComplaint(complaintId, photoFile, resolutionNote) {
  const formData = new FormData();
  formData.append('resolution_photo', photoFile);
  formData.append('resolution_note', resolutionNote.trim());

  const response = await api.patch(`/officer/complaints/${complaintId}/resolve`, formData);
  return response.data; // ComplaintResponse
}

/**
 * Administrator Functions
 */
export async function listOfficers(department) {
  const params = department ? { department } : {};
  const response = await api.get('/officers', { params });
  return response.data; // OfficerListResponse: { total, items }
}

export async function createOfficer(officerData) {
  const response = await api.post('/officers', {
    name: officerData.name.trim(),
    email: officerData.email.trim().toLowerCase(),
    password: officerData.password,
    department: officerData.department.trim(),
    role: officerData.role || 'OFFICER',
  });
  return response.data; // OfficerResponse
}

export async function assignComplaint(complaintId, officerId, note) {
  const response = await api.patch(`/officer/complaints/${complaintId}/assign`, {
    officer_id: Number(officerId),
    note: note ? note.trim() : undefined,
  });
  return response.data; // ComplaintResponse
}

export async function getAllComplaints(params = {}) {
  const response = await api.get('/complaints', { params });
  return response.data; // ComplaintListResponse
}

