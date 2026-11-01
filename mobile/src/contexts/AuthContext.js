import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { loginOfficer, getOfficerProfile, logoutOfficer } from '../services/authService';
import { getStoredToken } from '../services/api';

const AuthContext = createContext({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check stored token and restore session on app launch
  const checkAuth = useCallback(async () => {
    try {
      const storedToken = await getStoredToken();
      if (storedToken) {
        setToken(storedToken);
        try {
          const profile = await getOfficerProfile();
          setUser(profile);
        } catch {
          // If profile fetch fails (e.g. expired token), clear it
          await logoutOfficer();
          setToken(null);
          setUser(null);
        }
      }
    } catch {
      // Ignored
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email, password) => {
    const res = await loginOfficer(email, password);
    setToken(res.access_token);
    setUser({
      name: res.name,
      email: email.trim().toLowerCase(),
      role: res.role,
      department: res.department,
    });
    return res;
  };

  const logout = async () => {
    await logoutOfficer();
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: Boolean(token),
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
export default AuthContext;

