import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getOfficerProfile } from '../services/officerService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem('civicpulse_auth_token') || null;
    } catch {
      return null;
    }
  });

  const [officer, setOfficer] = useState(() => {
    try {
      const saved = localStorage.getItem('civicpulse_auth_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(Boolean(token && !officer));

  // Sync state to localStorage
  const login = (authToken, officerProfile) => {
    setToken(authToken);
    setOfficer(officerProfile);
    try {
      localStorage.setItem('civicpulse_auth_token', authToken);
      localStorage.setItem('civicpulse_auth_user', JSON.stringify(officerProfile));
    } catch {
      // Storage error ignored
    }
  };

  const logout = useCallback(() => {
    setToken(null);
    setOfficer(null);
    try {
      localStorage.removeItem('civicpulse_auth_token');
      localStorage.removeItem('civicpulse_auth_user');
    } catch {
      // Storage error ignored
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!token) return null;
    try {
      const profile = await getOfficerProfile();
      setOfficer(profile);
      try {
        localStorage.setItem('civicpulse_auth_user', JSON.stringify(profile));
      } catch {
        // Storage error ignored
      }
      return profile;
    } catch (err) {
      if (err.response?.status === 401) {
        logout();
      }
      return null;
    }
  }, [token, logout]);

  // If token is present on startup but user details are missing or stale, fetch profile
  useEffect(() => {
    let isMounted = true;
    if (token && (!officer || !officer.id)) {
      setLoading(true);
      getOfficerProfile()
        .then((profile) => {
          if (isMounted) {
            setOfficer(profile);
            try {
              localStorage.setItem('civicpulse_auth_user', JSON.stringify(profile));
            } catch {
              // Storage error ignored
            }
          }
        })
        .catch((err) => {
          if (isMounted && err.response?.status === 401) {
            logout();
          }
        })
        .finally(() => {
          if (isMounted) setLoading(false);
        });
    } else {
      setLoading(false);
    }
    return () => {
      isMounted = false;
    };
  }, [token]);

  const isAuthenticated = Boolean(token && officer);
  const isAdmin = officer?.role?.toUpperCase() === 'ADMIN';
  const isOfficer = officer?.role?.toUpperCase() === 'OFFICER' || isAdmin;

  return (
    <AuthContext.Provider
      value={{
        token,
        officer,
        user: officer,
        loading,
        isAuthenticated,
        isAdmin,
        isOfficer,
        login,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
