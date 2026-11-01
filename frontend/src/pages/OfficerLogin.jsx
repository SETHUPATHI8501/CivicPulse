import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Shield,
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  Sparkles,
  KeyRound,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { loginOfficer, getOfficerProfile } from '../services/officerService';
import Button from '../components/Button';
import LanguageSelector from '../components/LanguageSelector';

export default function OfficerLogin() {
  const { isAuthenticated, login } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Destination after successful login
  const from = location.state?.from?.pathname || '/officer/dashboard';

  // If already authenticated, redirect
  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email.trim() || !password) {
      setErrorMessage('Please enter both your official email address and password.');
      return;
    }

    setIsLoading(true);
    try {
      // 1. Obtain JWT access token
      const tokenData = await loginOfficer(email, password);
      const authToken = tokenData.access_token;

      // Temporary save token so immediate profile call can use it via interceptor
      localStorage.setItem('civicpulse_auth_token', authToken);

      // 2. Fetch full officer profile
      const profile = await getOfficerProfile();

      // 3. Save into AuthContext
      login(authToken, profile);

      // 4. Redirect to intended destination (or worker portal if WORKER)
      if (profile?.role === 'WORKER') {
        navigate('/officer/worker', { replace: true });
      } else {
        navigate(from, { replace: true });
      }
    } catch (err) {
      localStorage.removeItem('civicpulse_auth_token');
      localStorage.removeItem('civicpulse_auth_user');

      if (err.response?.status === 401) {
        setErrorMessage('Invalid official email or password. Please verify your municipal credentials.');
      } else if (err.userMessage) {
        setErrorMessage(err.userMessage);
      } else {
        setErrorMessage('Unable to connect to municipal authentication service. Please check your network.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Demo credential quick-fill helpers
  const handleQuickFill = (demoEmail, demoPass) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setErrorMessage('');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center relative overflow-hidden px-4 sm:px-6 lg:px-8 py-12">
      {/* Background Decorative Gradient Blobs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-navy-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* Top Bar with Language Selector and Citizen Portal Link */}
      <div className="absolute top-6 left-6 right-6 flex items-center justify-between z-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-xs font-semibold transition-colors"
        >
          <ArrowRight className="w-3.5 h-3.5 rotate-180" />
          <span>{t('citizenPortal', 'Back to Citizen Portal')}</span>
        </Link>
        <div className="bg-slate-800/80 backdrop-blur-sm rounded-full p-1 border border-slate-700">
          <LanguageSelector variant="toggle" />
        </div>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-navy-800 via-navy-900 to-teal-900 border border-teal-500/30 text-teal-400 shadow-xl shadow-teal-500/10 mb-4">
            <Shield className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-display">
            CivicPulse <span className="text-teal-400">AI</span>
          </h1>
          <p className="mt-2 text-sm text-slate-400 font-medium">
            {t('officerLoginDesc', 'Authorized Municipal Grievance & Emergency Portal')}
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-800/90 backdrop-blur-md py-8 px-6 sm:px-10 rounded-2xl border border-slate-700/80 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error Banner */}
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-xs leading-relaxed animate-fadeIn">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label
                htmlFor="officer-email"
                className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider"
              >
                {t('email', 'Official Email Address')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="officer-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="officer@civicpulse.gov"
                  required
                  autoComplete="username"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label
                htmlFor="officer-password"
                className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider"
              >
                {t('password', 'Security Password')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="officer-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <Button
                type="submit"
                variant="teal"
                size="lg"
                fullWidth
                isLoading={isLoading}
                icon={KeyRound}
              >
                {isLoading ? t('loggingIn', 'Verifying...') : t('loginButton', 'Sign In to Portal')}
              </Button>
            </div>
          </form>

          {/* Quick Demo Credentials Accordion / Helper */}
          <div className="mt-8 pt-6 border-t border-slate-700/80">
            <div className="flex items-center gap-2 mb-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-teal-400" />
              <span>Development Quick-Login</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleQuickFill('admin@civicpulse.gov', 'AdminPassword2026!')}
                className="text-left p-2.5 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-700/60 hover:border-teal-500/50 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white group-hover:text-teal-400">Admin</span>
                  <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded font-mono">
                    ADMIN
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5 font-mono truncate">
                  admin@civicpulse.gov
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('anitha.roads@civicpulse.gov', 'AnithaSecurePass2026!')}
                className="text-left p-2.5 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-700/60 hover:border-teal-500/50 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white group-hover:text-teal-400">Officer</span>
                  <span className="text-[10px] bg-teal-500/20 text-teal-300 px-1.5 py-0.5 rounded font-mono">
                    OFFICER
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5 font-mono truncate">
                  anitha.roads@civicpulse.gov
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('raju.worker@civicpulse.gov', 'RajuWorkerPass2026!')}
                className="text-left p-2.5 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-700/60 hover:border-amber-500/50 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white group-hover:text-amber-400">Worker</span>
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-mono">
                    WORKER
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5 font-mono truncate">
                  raju.worker@civicpulse.gov
                </p>
              </button>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <p className="mt-8 text-center text-xs text-slate-500">
          CivicPulse AI Municipal Government Platform • ARSW001 Hackathon
        </p>
      </div>
    </div>
  );
}
