import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Send,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RotateCcw,
  Cpu,
  MapPin,
  Calendar,
} from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import Button from '../components/Button';
import Textarea from '../components/Textarea';
import VoiceInput from '../components/VoiceInput';
import LocationPicker from '../components/LocationPicker';
import PhotoUpload from '../components/PhotoUpload';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import DuplicateAlert from '../components/DuplicateAlert';
import CaseIdBadge from '../components/CaseIdBadge';
import { createComplaint } from '../services/complaintService';
import { formatDate } from '../utils/formatDate';
import useGeolocation from '../hooks/useGeolocation';
import { useLanguage } from '../context/LanguageContext';

const SUPPORTED_CATEGORIES = [
  { value: '', labelEn: 'Auto-Detect by AI (Recommended)', labelTa: 'AI தானியங்கி கண்டறிதல் (பரிந்துரைக்கப்படுகிறது)' },
  { value: 'Pothole', labelEn: 'Pothole & Roads', labelTa: 'சாலை பள்ளம் & சேதம்' },
  { value: 'Garbage', labelEn: 'Garbage & Sanitation', labelTa: 'குப்பை கழிவு மேலாண்மை' },
  { value: 'Water', labelEn: 'Water Supply', labelTa: 'குடிநீர் விநியோகம்' },
  { value: 'Streetlight', labelEn: 'Streetlight', labelTa: 'தெருவிளக்கு பழுது' },
  { value: 'Drainage', labelEn: 'Drainage & Sewage', labelTa: 'சாக்கடை / வடிகால்' },
  { value: 'Other', labelEn: 'Other Municipal Issue', labelTa: 'பிற நகராட்சிப் பிரச்சினை' },
];

export default function ReportComplaint() {
  const { t, language } = useLanguage();
  const routeLocation = useLocation();

  // Form State
  const [description, setDescription] = useState(routeLocation.state?.prefillText || '');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [addressInfo, setAddressInfo] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [submissionResult, setSubmissionResult] = useState(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => `web-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);

  useEffect(() => {
    if (routeLocation.state?.prefillText) {
      setDescription(routeLocation.state.prefillText);
    }
  }, [routeLocation.state]);

  // Geolocation Hook
  const {
    coordinates,
    setCoordinates,
    loading: isDetectingGPS,
    error: gpsError,
    getCoordinates,
  } = useGeolocation();

  // Append voice transcript into description
  const handleVoiceAppend = (transcriptText) => {
    setVoiceTranscript((prev) => (prev ? `${prev} ${transcriptText}` : transcriptText));
    setDescription((prev) => (prev ? `${prev.trim()} ${transcriptText}` : transcriptText));
    setFormError(null);
  };

  // Handle manual map click / coordinate adjustment
  const handleLocationChange = (lat, lng) => {
    setCoordinates({ lat, lng });
  };

  const getMediaUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1').replace(/\/api\/v1\/?$/, '');
    return `${base}/${path.replace(/^\/+/, '')}`;
  };

  // Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    const cleanText = description.trim();
    if (!cleanText) {
      setFormError(
        language === 'ta'
          ? 'புகாரின் விவரத்தை உள்ளிடவும்.'
          : 'Please enter a detailed description of the civic issue.'
      );
      return;
    }

    if (
      coordinates.lat === undefined ||
      coordinates.lng === undefined ||
      isNaN(coordinates.lat) ||
      isNaN(coordinates.lng) ||
      coordinates.lat < -90 ||
      coordinates.lat > 90 ||
      coordinates.lng < -180 ||
      coordinates.lng > 180
    ) {
      setFormError(
        language === 'ta'
          ? 'சரியான ஜி.பி.எஸ் இருப்பிடக் குறியீடுகள் தேவை.'
          : 'Valid GPS latitude and longitude coordinates are required.'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      // Combine category hint and address landmark into citizen_text if provided
      let finalDescription = cleanText;
      if (selectedCategory && !finalDescription.toLowerCase().includes(selectedCategory.toLowerCase())) {
        finalDescription = `[${selectedCategory}] ${finalDescription}`;
      }
      if (addressInfo.trim()) {
        finalDescription = `${finalDescription} (Location: ${addressInfo.trim()})`;
      }

      const response = await createComplaint({
        citizen_text: finalDescription,
        voice_transcript: voiceTranscript ? voiceTranscript.trim() : null,
        latitude: coordinates.lat,
        longitude: coordinates.lng,
        photo: photoFile,
        idempotency_key: idempotencyKey,
      });

      setSubmissionResult(response);
      setIsSubmitting(false);
    } catch (err) {
      setFormError(err.userMessage || 'Failed to submit complaint. Please check server connection.');
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setDescription('');
    setSelectedCategory('');
    setAddressInfo('');
    setPhotoFile(null);
    setVoiceTranscript('');
    setSubmissionResult(null);
    setFormError(null);
    setIdempotencyKey(`web-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
  };

  const isGeminiSource = (src) => {
    const s = String(src || '').toUpperCase();
    return s.includes('GEMINI');
  };

  return (
    <MainLayout
      pageTitle={language === 'ta' ? 'புதிய புகார் பதிவு' : 'Report a Civic Grievance'}
      subtitle={
        language === 'ta'
          ? 'உங்கள் பகுதியில் உள்ள குறைபாட்டை குரல், புகைப்படம் அல்லது தட்டச்சு மூலம் பதிவு செய்யுங்கள்'
          : 'Submit your municipal issue with GPS coordinates and photo evidence. CivicPulse AI will classify and route it automatically.'
      }
      maxWidth="max-w-4xl"
    >
      {/* Success View */}
      {submissionResult ? (
        <div className="bg-white rounded-2xl border border-teal-200 p-6 sm:p-10 shadow-lg space-y-8 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 border-b border-slate-100 pb-5">
            <div className="w-14 h-14 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-8 h-8 text-teal-700" />
            </div>
            <div>
              <span className="text-xs font-bold text-teal-700 uppercase tracking-widest font-mono">
                {language === 'ta' ? 'புகார் வெற்றிகரமாகப் பதிவு செய்யப்பட்டது' : 'Complaint Registered Successfully'}
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-navy-950 mt-0.5">
                {language === 'ta'
                  ? `வழக்கு எண்: ${submissionResult.case_id || submissionResult.tracking_id}`
                  : `Case ID: ${submissionResult.case_id || submissionResult.tracking_id}`}
              </h2>
              <p className="text-xs text-slate-600 mt-1">
                {language === 'ta'
                  ? 'உங்கள் புகாரைக் கண்காணிக்க இந்த எண்ணைப் பயன்படுத்தவும்.'
                  : 'Save this unique Case ID to monitor inspection, officer assignment, and resolution progress across Web & Mobile.'}
              </p>
            </div>
          </div>

          {/* Unified Case ID Banner with Copy, Share, Status & Track */}
          <CaseIdBadge
            variant="banner"
            caseId={submissionResult.case_id || submissionResult.tracking_id}
            trackingId={submissionResult.tracking_id}
            status={submissionResult.status}
            priority={submissionResult.priority}
            createdAt={submissionResult.created_at}
            showCopy={true}
            showShare={true}
            showTrackLink={true}
          />

          {/* AI Triage Classification Breakdown */}
          <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-navy-900 uppercase tracking-wider">
                <Cpu className="w-4 h-4 text-teal-600" />
                <span>AI Automated Triage Results</span>
              </div>
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                  isGeminiSource(submissionResult.ai_source)
                    ? 'bg-teal-50 text-teal-800 border-teal-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}
              >
                {isGeminiSource(submissionResult.ai_source)
                  ? 'Classified by Google Gemini AI'
                  : 'Classified by Rule-Based Keyword Fallback'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-[11px] text-slate-500 block">Classified Category</span>
                <span className="text-sm font-bold text-navy-950 block mt-0.5">
                  {t(`cat_${submissionResult.category}`, submissionResult.category)}
                </span>
              </div>

              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-[11px] text-slate-500 block">Assigned Department</span>
                <span className="text-sm font-bold text-navy-950 block mt-0.5">
                  {submissionResult.department}
                </span>
              </div>

              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-[11px] text-slate-500 block">GPS Location</span>
                <span className="text-xs font-mono font-bold text-navy-950 flex items-center gap-1 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-teal-600" />
                  {Number(submissionResult.latitude).toFixed(4)}°N, {Number(submissionResult.longitude).toFixed(4)}°E
                </span>
              </div>

              <div className="bg-white p-3 rounded-lg border border-slate-200 flex flex-col justify-between">
                <span className="text-[11px] text-slate-500 block">Priority & Status</span>
                <div className="flex items-center gap-2 mt-1">
                  <PriorityBadge priority={submissionResult.priority} size="sm" />
                  <StatusBadge status={submissionResult.status} size="sm" />
                </div>
              </div>
            </div>
          </div>

          {/* Duplicate detection notice if matched */}
          {submissionResult.duplicate_group_id && (
            <DuplicateAlert
              groupId={submissionResult.duplicate_group_id}
              confidence={submissionResult.duplicate_confidence}
            />
          )}

          {/* Description & Attached Photo Preview */}
          <div className="space-y-3 text-xs">
            <div>
              <span className="font-semibold text-slate-600">Submitted Complaint Text:</span>
              <p className="mt-1 p-3.5 bg-slate-50 rounded-lg text-slate-800 border border-slate-100 leading-relaxed italic">
                "{submissionResult.citizen_text}"
              </p>
            </div>

            {submissionResult.photo_url && (
              <div>
                <span className="font-semibold text-slate-600 block mb-1.5">Attached Photo Evidence:</span>
                <img
                  src={getMediaUrl(submissionResult.photo_url)}
                  alt="Submitted complaint evidence"
                  className="max-h-56 rounded-xl border border-slate-200 object-cover"
                />
              </div>
            )}
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100">
            <Button variant="outline" size="md" onClick={handleResetForm} icon={RotateCcw}>
              Submit Another Grievance
            </Button>

            <div className="flex items-center gap-2.5 flex-wrap">
              <Link
                to={`/track/${encodeURIComponent(
                  submissionResult.case_id || submissionResult.tracking_id
                )}`}
              >
                <Button variant="teal" size="md" icon={ArrowRight} iconPosition="right">
                  {language === 'ta'
                    ? 'புகாரைக் கண்காணிக்க / விவரங்களைக் காண்க'
                    : 'Track & View Complaint Details'}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      ) : (
        /* Submission Form */
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-card space-y-6">
            {/* Step 1: Voice Dictation Tool */}
            <div>
              <span className="text-xs font-bold text-teal-700 uppercase tracking-wider mb-2 block font-mono">
                Step 1: Voice Input (Optional • Tamil & English)
              </span>
              <VoiceInput onTranscriptAppend={handleVoiceAppend} />
            </div>

            {/* Step 2: Detailed Text Description & Category Hint */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <span className="text-xs font-bold text-teal-700 uppercase tracking-wider block font-mono">
                Step 2: Issue Details
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                    {language === 'ta' ? 'புகார் வகை (AI தானாகவும் கண்டறியும்)' : 'Issue Category (Or Auto-Detect)'}
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:border-teal-600 focus:outline-none"
                  >
                    {SUPPORTED_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {language === 'ta' ? c.labelTa : c.labelEn}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                    {language === 'ta' ? 'தெரு பெயர் / அடையாளம் (விருப்பத்தேர்வு)' : 'Street / Landmark (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={addressInfo}
                    onChange={(e) => setAddressInfo(e.target.value)}
                    placeholder={language === 'ta' ? 'எ.கா. பேருந்து நிலையம் அருகில்' : 'e.g. Near Gandhipuram Bus Stand'}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:border-teal-600 focus:outline-none"
                  />
                </div>
              </div>

              <Textarea
                label={t('description', 'Complaint Description')}
                placeholder="விவரமாக புகாரை பதிவு செய்யவும் / Describe the issue with street name, nearest landmark or danger level..."
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  if (formError) setFormError(null);
                }}
                rows={4}
                required
                maxLength={600}
                showCount
                helperText="Both Tamil and English descriptions are supported. AI will auto-categorize and assign priority."
              />
            </div>

            {/* Step 3: Photo Evidence Upload */}
            <div className="space-y-2 pt-4 border-t border-slate-100">
              <span className="text-xs font-bold text-teal-700 uppercase tracking-wider block font-mono">
                Step 3: Photo Evidence
              </span>
              <PhotoUpload
                file={photoFile}
                onChange={setPhotoFile}
                disabled={isSubmitting}
              />
            </div>

            {/* Step 4: Location Selection with Leaflet Map */}
            <div className="space-y-2 pt-4 border-t border-slate-100">
              <span className="text-xs font-bold text-teal-700 uppercase tracking-wider block font-mono">
                Step 4: Location Coordinates
              </span>
              <LocationPicker
                latitude={coordinates.lat}
                longitude={coordinates.lng}
                onChange={handleLocationChange}
                onDetectGPS={getCoordinates}
                isDetectingGPS={isDetectingGPS}
                gpsError={gpsError}
              />
            </div>

            {/* Form Error Banner */}
            {formError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Submit Action */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-500">
                Municipal complaints are reviewed according to Tamil Nadu e-Governance standards.
              </div>

              <Button
                type="submit"
                variant="teal"
                size="lg"
                icon={Send}
                isLoading={isSubmitting}
                className="w-full sm:w-auto"
              >
                {t('submit', 'Submit Grievance')}
              </Button>
            </div>
          </div>
        </form>
      )}
    </MainLayout>
  );
}
