import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Spinner from './components/Spinner';

// Route-level lazy loading for optimal bundle splitting and performance
const Home = lazy(() => import('./pages/Home'));
const ReportComplaint = lazy(() => import('./pages/ReportComplaint'));
const TrackComplaint = lazy(() => import('./pages/TrackComplaint'));
const CitizenCivicHub = lazy(() => import('./pages/CitizenCivicHub'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Officer, Worker & Admin Pages
const OfficerLogin = lazy(() => import('./pages/OfficerLogin'));
const OfficerDashboard = lazy(() => import('./pages/OfficerDashboard'));
const ComplaintDetails = lazy(() => import('./pages/ComplaintDetails'));
const HeatmapAnalytics = lazy(() => import('./pages/HeatmapAnalytics'));
const AdminOfficers = lazy(() => import('./pages/AdminOfficers'));
const WorkerPortal = lazy(() => import('./pages/WorkerPortal'));

function PageLoader() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 bg-slate-50">
      <Spinner size="lg" color="teal" className="mb-3" />
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
        Loading CivicPulse AI...
      </span>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Citizen Routes */}
              <Route path="/" element={<Home />} />
              <Route path="/report" element={<ReportComplaint />} />
              <Route path="/track" element={<TrackComplaint />} />
              <Route path="/track/:trackingId" element={<TrackComplaint />} />
              <Route path="/gis" element={<CitizenCivicHub defaultTab="gis" />} />
              <Route path="/assistant" element={<CitizenCivicHub defaultTab="assistant" />} />
              <Route path="/sos" element={<CitizenCivicHub defaultTab="sos" />} />
              <Route path="/analytics" element={<Navigate to="/gis" replace />} />

              {/* Officer & Admin Authentication */}
              <Route path="/officer/login" element={<OfficerLogin />} />
              <Route path="/officer" element={<Navigate to="/officer/dashboard" replace />} />

              {/* Protected Officer & Worker Routes */}
              <Route
                path="/officer/dashboard"
                element={
                  <ProtectedRoute>
                    <OfficerDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/officer/worker"
                element={
                  <ProtectedRoute>
                    <WorkerPortal defaultMode="worker" />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/officer/emergency"
                element={
                  <ProtectedRoute>
                    <WorkerPortal defaultMode="sos" />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/officer/analytics"
                element={
                  <ProtectedRoute>
                    <HeatmapAnalytics />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/officer/complaints/:id"
                element={
                  <ProtectedRoute>
                    <ComplaintDetails />
                  </ProtectedRoute>
                }
              />

              {/* Protected Admin-Only Routes */}
              <Route
                path="/officer/admin/officers"
                element={
                  <ProtectedRoute adminOnly={true}>
                    <AdminOfficers />
                  </ProtectedRoute>
                }
              />

              {/* 404 Not Found Fallback */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}
