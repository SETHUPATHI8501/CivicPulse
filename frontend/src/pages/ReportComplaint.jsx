import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Send,
  Sparkles,
  MapPin,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Search,
  RotateCcw,
  Languages,
  ShieldCheck,
  Cpu,
} from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import Button from '../components/Button';
import Textarea from '../components/Textarea';
import VoiceInput from '../components/VoiceInput';
import LocationPicker from '../components/LocationPicker';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import DuplicateAlert from '../components/DuplicateAlert';
import { createComplaint } from '../services/complaintService';
import useGeolocation from '../hooks/useGeolocation';
import { useLanguage } from '../context/LanguageContext';

export default function ReportComplaint() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();

  // Form State
  const [description, setDescription] = useState('');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [submissionResult, setSubmissionResult] = useState(null);

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

  // Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    const cleanText = description.trim();
    if (!cleanText) {
      setFormError('Please enter a detailed description of the civic issue.');
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
      setFormError('Valid GPS latitude and longitude coordinates are required.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await createComplaint({
        citizen_text: cleanText,
        voice_transcript: voiceTranscript ? voiceTranscript.trim() : null,
        latitude: coordinates.lat,
        longitude: coordinates.lng,
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
    setVoiceTranscript('');
    setSubmissionResult(null);
    setFormError(null);
  };

  return (
    <MainLayout
      pageTitle={language === 'ta' ? 'புதிய புகார் பதிவு' : 'Report a Civic Grievance'}
      subtitle={
        language === 'ta'
          ? 'உங்கள் பகுதியில் உள்ள குறைபாட்டை குரல் அல்லது தட்டச்சு மூலம் பதிவு செய்யுங்கள்'
          : 'Submit your municipal issue with GPS coordinates. CivicPulse AI will classify and route it automatically.'
      }
      maxWidth="max-w-4xl"
    >
      {/* Success View */}
      {submissionResult ? (
        <div className="bg-white rounded-2xl border border-teal-200 p-6 sm:p-10 shadow-lg space-y-8 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 border-b border-slate-100 pb-6">
            <div className="w-14 h-14 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-8 h-8 text-teal-700" />
            </div>
            <div>
              <span className="text-xs font-bold text-teal-700 uppercase tracking-widest font-mono">
                Complaint Registered Successfully
              </span>
              <h2 className="text-2xl font-extrabold text-navy-950 mt-0.5">
                Tracking ID:{' '}
                <span className="font-mono text-teal-700 font-black">
                  {submissionResult.tracking_id}
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Save this unique tracking identifier to monitor inspection, assignment, and resolution progress.
              </p>
            </div>
          </div>

          {/* AI Triage Classification Breakdown */}
          <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-navy-900 uppercase tracking-wider">
              <Cpu className="w-4 h-4 text-teal-600" />
              <span>AI Automated Triage Results</span>
              <span className="text-[10px] text-slate-400 font-normal">
                (Source: {submissionResult.ai_source})
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
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

              <div className="bg-white p-3 rounded-lg border border-slate-200 flex flex-col justify-between">
                <span className="text-[11px] text-slate-500 block">Assigned Priority & Status</span>
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

          {/* Description Preview */}
          <div className="space-y-1 text-xs">
            <span className="font-semibold text-slate-600">Submitted Complaint Text:</span>
            <p className="p-3.5 bg-slate-50 rounded-lg text-slate-800 border border-slate-100 leading-relaxed italic">
              "{submissionResult.citizen_text}"
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100">
            <Button variant="outline" size="md" onClick={handleResetForm} icon={RotateCcw}>
              Submit Another Grievance
            </Button>

            <Link to={`/track?id=${encodeURIComponent(submissionResult.tracking_id)}`}>
              <Button variant="teal" size="md" icon={ArrowRight} iconPosition="right">
                Track This Complaint Now
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        /* Submission Form */
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-card space-y-6">
            {/* Step 1: Voice Dictation Tool */}
            <div>
              <span className="text-xs font-bold text-teal-700 uppercase tracking-wider mb-2 block font-mono">
                Step 1: Voice Input (Optional)
              </span>
              <VoiceInput onTranscriptAppend={handleVoiceAppend} />
            </div>

            {/* Step 2: Detailed Text Description */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="text-xs font-bold text-teal-700 uppercase tracking-wider block font-mono">
                Step 2: Issue Description
              </span>
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

            {/* Step 3: Location Selection with Leaflet Map */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="text-xs font-bold text-teal-700 uppercase tracking-wider block font-mono">
                Step 3: Location Coordinates
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

