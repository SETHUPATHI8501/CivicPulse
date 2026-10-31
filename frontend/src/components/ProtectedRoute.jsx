import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Spinner from './Spinner';
import { ShieldAlert } from 'lucide-react';
import Button from './Button';

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" color="teal" />
          <p className="text-sm text-slate-500 font-medium">Verifying officer session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/officer/login" state={{ from: location }} replace />;
  }

  if (adminOnly && !isAdmin) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-card border border-rose-200 p-8 text-center">
          <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-100">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Administrator Access Required</h2>
          <p className="text-sm text-slate-600 mb-6 leading-relaxed">
            This module is restricted to municipal administrators. Your account does not have sufficient operational privileges.
          </p>
          <Button variant="primary" fullWidth onClick={() => window.location.assign('/officer/dashboard')}>
            Return to Officer Queue
          </Button>
        </div>
      </div>
    );
  }

  return children;
}

