import apiClient, { getStoredToken, setStoredToken, removeStoredToken } from './api';

/**
 * Authenticate officer or admin with email & password
 * @param {string} email
 * @param {string} password
 * @returns {Promise<Object>} TokenResponse { access_token, token_type, role, department, name }
 */
export async function loginOfficer(email, password) {
  const response = await apiClient.post('/auth/token', {
    email: email.trim().toLowerCase(),
    password,
  });
  const data = response.data;
  if (data?.access_token) {
    await setStoredToken(data.access_token);
  }
  return data;
}

/**
 * Fetch the authenticated officer's profile
 * @returns {Promise<Object>} OfficerResponse
 */
export async function getOfficerProfile() {
  const response = await apiClient.get('/auth/me');
  return response.data;
}

/**
 * Remove stored token and sign out
 */
export async function logoutOfficer() {
  await removeStoredToken();
}

/**
 * Check if officer is currently authenticated
 */
export async function isAuthenticated() {
  const token = await getStoredToken();
  return Boolean(token);
}

export default {
  loginOfficer,
  getOfficerProfile,
  logoutOfficer,
  isAuthenticated,
};

