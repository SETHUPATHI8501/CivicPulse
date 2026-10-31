import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Building2,
  Mail,
  Lock,
  Calendar,
  CheckCircle2,
  Filter,
  RefreshCw,
  Search,
  X,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import OfficerLayout from '../layouts/OfficerLayout';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { listOfficers, createOfficer } from '../services/officerService';
import Button from '../components/Button';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { formatDate } from '../utils/formatDate';

const MUNICIPAL_DEPARTMENTS = [
  'Roads / Public Works',
  'Sanitation',
  'Water Supply',
  'Electrical',
  'Drainage / Public Works',
  'Administration',
];

export default function AdminOfficers() {
  const { officer: currentAdmin, isAdmin } = useAuth();
  const { t } = useLanguage();

  const [officers, setOfficers] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Register Modal state
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [newOfficer, setNewOfficer] = useState({
    name: '',
    email: '',
    password: '',
    department: 'Roads / Public Works',
    role: 'OFFICER',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [registerSubmitting, setRegisterSubmitting] = useState(false);
  const [registerError, setRegisterError] = useState('');

  // Toast
  const [toastMessage, setToastMessage] = useState(null);
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadOfficers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const dept = departmentFilter !== 'ALL' ? departmentFilter : undefined;
      const data = await listOfficers(dept);
      setOfficers(data.items || []);
      setTotalCount(data.total || 0);
    } catch (err) {
      setError(err.userMessage || 'Failed to retrieve officer directory.');
    } finally {
      setIsLoading(false);
    }
  }, [departmentFilter]);

  useEffect(() => {
    loadOfficers();
  }, [loadOfficers]);

  // Client-side search
  const filteredOfficers = officers.filter((off) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      off.name.toLowerCase().includes(q) ||
      off.email.toLowerCase().includes(q) ||
      off.department.toLowerCase().includes(q)
    );
  });

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setRegisterError('');

    if (newOfficer.name.trim().length < 2) {
      setRegisterError('Officer full name must be at least 2 characters.');
      return;
    }
    if (!newOfficer.email.includes('@') || !newOfficer.email.includes('.')) {
      setRegisterError('Please enter a valid official email address.');
      return;
    }
    if (newOfficer.password.length < 6) {
      setRegisterError('Security password must contain at least 6 characters.');
      return;
    }

    setRegisterSubmitting(true);
    try {
      await createOfficer(newOfficer);
      showToast(`Officer account for ${newOfficer.name} created successfully!`);
      setShowRegisterModal(false);
      setNewOfficer({
        name: '',
        email: '',
        password: '',
        department: 'Roads / Public Works',
        role: 'OFFICER',
      });
      loadOfficers();
    } catch (err) {
      setRegisterError(err.userMessage || 'Failed to create officer account. Email may already be in use.');
    } finally {
      setRegisterSubmitting(false);
    }
  };

  return (
    <OfficerLayout>
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-navy-950 text-white px-5 py-3 rounded-xl shadow-2xl border border-teal-500/50 flex items-center gap-3 animate-slideUp">
          <CheckCircle2 className="w-5 h-5 text-teal-400 flex-shrink-0" />
          <span className="text-sm font-semibold">{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-950 tracking-tight font-display">
              Officer Directory & Roles
            </h1>
            <span className="text-xs font-bold text-purple-800 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-full">
              Admin Exclusive
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Manage municipal field officers, department assignments, and system administrators.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={RefreshCw}
            isLoading={isLoading}
            onClick={loadOfficers}
            title="Refresh list"
          >
            Refresh
          </Button>

          <Button
            variant="teal"
            size="md"
            icon={UserPlus}
            onClick={() => {
              setRegisterError('');
              setShowRegisterModal(true);
            }}
          >
            Register Officer
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs mb-6">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, department..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Department Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Department:</span>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="ALL">All Departments</option>
              {MUNICIPAL_DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Directory Table */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-2xs">
          <Spinner size="lg" color="teal" className="mx-auto mb-4" />
          <p className="text-sm font-semibold text-slate-600">Loading officer records...</p>
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={loadOfficers} />
      ) : filteredOfficers.length === 0 ? (
        <EmptyState
          title="No officers found"
          description="No municipal officers match the selected filter criteria."
          actionLabel="Register First Officer"
          onAction={() => setShowRegisterModal(true)}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-6 py-3.5">
                    Officer Name
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Official Email
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Department
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Role
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOfficers.map((off) => (
                  <tr key={off.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-navy-900 text-teal-400 font-bold text-xs flex items-center justify-center uppercase shadow-2xs">
                          {off.name ? off.name.slice(0, 2) : 'OF'}
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 block">{off.name}</span>
                          <span className="text-[11px] font-mono text-slate-400">ID: #{off.id}</span>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-slate-600">
                      {off.email}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-medium text-slate-800 text-xs bg-slate-100 px-2.5 py-1 rounded-md">
                        {off.department}
                      </span>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`text-[11px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                          off.role === 'ADMIN'
                            ? 'bg-purple-100 text-purple-800 border border-purple-200'
                            : 'bg-teal-100 text-teal-800 border border-teal-200'
                        }`}
                      >
                        {off.role}
                      </span>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span>Active</span>
                      </span>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                      {formatDate(off.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Register New Officer Modal */}
      {/* ========================================================================= */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-scaleIn">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-navy-950 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-teal-600" />
                  <span>Register Municipal Officer</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Create a new authorized credential for field grievance operations.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRegisterModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterSubmit} className="p-6 space-y-4">
              {registerError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-600" />
                  <span>{registerError}</span>
                </div>
              )}

              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newOfficer.name}
                  onChange={(e) => setNewOfficer({ ...newOfficer, name: e.target.value })}
                  placeholder="e.g. Ramesh Kumar"
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Official Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  value={newOfficer.email}
                  onChange={(e) => setNewOfficer({ ...newOfficer, email: e.target.value })}
                  placeholder="ramesh.roads@civicpulse.gov"
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Initial Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newOfficer.password}
                    onChange={(e) => setNewOfficer({ ...newOfficer, password: e.target.value })}
                    placeholder="At least 6 characters"
                    required
                    minLength={6}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-3.5 pr-10 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Department & Role Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Department <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={newOfficer.department}
                    onChange={(e) => setNewOfficer({ ...newOfficer, department: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
                  >
                    {MUNICIPAL_DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Access Role <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={newOfficer.role}
                    onChange={(e) => setNewOfficer({ ...newOfficer, role: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
                  >
                    <option value="OFFICER">OFFICER (Assigned Complaints)</option>
                    <option value="ADMIN">ADMIN (Full Municipality)</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3">
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setShowRegisterModal(false)}
                  disabled={registerSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="teal"
                  size="md"
                  isLoading={registerSubmitting}
                  icon={UserPlus}
                >
                  Create Account
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </OfficerLayout>
  );
}

