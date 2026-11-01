import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  AlertTriangle,
  Bot,
  Compass,
  MapPin,
  Mic,
  MicOff,
  Volume2,
  Send,
  ShieldAlert,
  PhoneCall,
  CheckCircle2,
  Navigation,
  RefreshCw,
  Search,
  Sparkles,
  XCircle,
} from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import ComplaintMap from '../components/ComplaintMap';
import PhotoUpload from '../components/PhotoUpload';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import { useLanguage } from '../context/LanguageContext';
import {
  reverseGeocode,
  getNearbyComplaints,
  processVoiceInput,
  askCivicAssistant,
  submitSOSAlert,
  trackSOSAlert,
  cancelSOSAlert,
  speakText,
} from '../services/advancedService';

const EMERGENCY_TYPES = [
  'Road accident',
  'Fire hazard',
  'Flooding or waterlogging',
  'Fallen electric pole or dangerous electrical hazard',
  'Dangerous open manhole',
  'Severe public infrastructure hazard',
  'Other public safety emergency',
];

export default function CitizenCivicHub({ defaultTab = 'gis' }) {
  const { language } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  const initialTab = location.pathname.includes('sos')
    ? 'sos'
    : location.pathname.includes('assistant')
    ? 'assistant'
    : defaultTab;

  const [activeTab, setActiveTab] = useState(initialTab);

  // Shared GPS & Reverse Geocoding State
  const [coords, setCoords] = useState({ latitude: 11.3802, longitude: 77.8944, accuracy: 18 });
  const [addressInfo, setAddressInfo] = useState(null);
  const [locating, setLocating] = useState(false);

  // Tab 1: Live GIS & Nearby Complaints
  const [radiusKm, setRadiusKm] = useState(10);
  const [catFilter, setCatFilter] = useState('ALL');
  const [nearbyItems, setNearbyItems] = useState([]);
  const [loadingNearby, setLoadingNearby] = useState(false);

  // Tab 2: Voice & Gemini AI Assistant
  const [voiceLang, setVoiceLang] = useState(language === 'ta' ? 'ta' : 'en');
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceAnalysis, setVoiceAnalysis] = useState(null);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      sender: 'ai',
      text:
        language === 'ta'
          ? 'வணக்கம்! நான் CivicPulse AI உதவியாளர். தமிழ் அல்லது ஆங்கிலத்தில் உங்கள் நகராட்சி புகார்கள், நிலை அறிதல் (CP-XXXXXXXX), அல்லது அவசர உதவி குறித்து கேட்கலாம்.'
          : 'Hello! I am the CivicPulse AI Civic Assistant. Ask me in Tamil or English to classify an issue, check a tracking ID (CP-XXXXXXXX), or guide you through reporting.',
      source: 'SYSTEM',
    },
  ]);

  // Tab 3: SOS Emergency System
  const [sosStep, setSosStep] = useState('FORM'); // FORM -> CONFIRM -> SUBMITTED
  const [sosType, setSosType] = useState(EMERGENCY_TYPES[3]);
  const [sosDesc, setSosDesc] = useState('');
  const [sosName, setSosName] = useState('');
  const [sosPhone, setSosPhone] = useState('');
  const [trustedContact, setTrustedContact] = useState('');
  const [sosPhoto, setSosPhoto] = useState(null);
  const [sosSubmitting, setSosSubmitting] = useState(false);
  const [sosResult, setSosResult] = useState(null);
  const [sosTrackInput, setSosTrackInput] = useState('');
  const [sosError, setSosError] = useState('');

  useEffect(() => {
    if (location.pathname.includes('sos')) setActiveTab('sos');
    else if (location.pathname.includes('assistant')) setActiveTab('assistant');
    else if (location.pathname.includes('gis')) setActiveTab('gis');
  }, [location.pathname]);

  const fetchReverseGeocodeAndNearby = useCallback(
    async (lat, lon, rad = radiusKm, cat = catFilter) => {
      setLoadingNearby(true);
      try {
        const [geo, near] = await Promise.all([
          reverseGeocode(lat, lon, language),
          getNearbyComplaints({
            latitude: lat,
            longitude: lon,
            radius_km: rad,
            category: cat,
            limit: 60,
          }),
        ]);
        setAddressInfo(geo);
        setNearbyItems(near?.items || []);
      } catch (err) {
        console.warn('GIS fetch error:', err);
      } finally {
        setLoadingNearby(false);
      }
    },
    [radiusKm, catFilter, language]
  );

  useEffect(() => {
    fetchReverseGeocodeAndNearby(coords.latitude, coords.longitude, radiusKm, catFilter);
  }, [coords.latitude, coords.longitude, radiusKm, catFilter, fetchReverseGeocodeAndNearby]);

  const handleDetectGPS = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
          accuracy: Math.round(pos.coords.accuracy || 15),
        });
        setLocating(false);
      },
      () => {
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Voice Recognition Handler (Tamil ta-IN & English en-IN)
  const handleStartVoiceRecognition = () => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      alert(
        language === 'ta'
          ? 'உங்கள் உலாவியில் குரல் அங்கீகாரம் இல்லை. கீழே உள்ள பெட்டியில் தட்டச்சு செய்யவும்.'
          : 'Browser Speech Recognition is unavailable. Please type your transcript below to test AI voice processing.'
      );
      return;
    }

    const recognition = new SpeechRec();
    recognition.lang = voiceLang === 'ta' ? 'ta-IN' : 'en-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    setIsListening(true);
    recognition.onresult = async (event) => {
      const spoken = event.results[0][0].transcript;
      setVoiceTranscript(spoken);
      setIsListening(false);
      try {
        const res = await processVoiceInput(spoken, voiceLang);
        setVoiceAnalysis(res);
        if (res.tts_response) {
          speakText(res.tts_response, res.tts_language_code);
        }
      } catch (e) {
        console.warn(e);
      }
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  const handleAnalyzeTranscript = async (textToAnalyze) => {
    const target = (textToAnalyze ?? voiceTranscript).trim();
    if (!target) return;
    setVoiceTranscript(target);
    try {
      const res = await processVoiceInput(target, voiceLang);
      setVoiceAnalysis(res);
      if (res.tts_response) {
        speakText(res.tts_response, res.tts_language_code);
      }
    } catch (e) {
      console.warn(e);
    }
  };

  const handleSendChat = async (e) => {
    if (e) e.preventDefault();
    const prompt = chatInput.trim();
    if (!prompt) return;

    setMessages((prev) => [...prev, { sender: 'user', text: prompt }]);
    setChatInput('');
    setChatLoading(true);

    try {
      const res = await askCivicAssistant({
        prompt,
        role_context: 'CITIZEN',
        language: voiceLang,
      });
      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: res.reply,
          source: res.ai_source,
          classification: res.suggested_classification,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: err.userMessage || 'Unable to reach AI assistant right now.',
          source: 'ERROR',
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleConfirmAndSubmitSOS = async () => {
    setSosSubmitting(true);
    setSosError('');
    try {
      const trustedList = trustedContact.trim()
        ? [{ name: 'Trusted Contact', phone: trustedContact.trim() }]
        : [];
      const created = await submitSOSAlert(
        {
          emergency_type: sosType,
          description: sosDesc.trim() || `Emergency hazard reported: ${sosType}`,
          latitude: coords.latitude,
          longitude: coords.longitude,
          address_text: addressInfo?.address,
          citizen_name: sosName.trim() || 'Citizen',
          citizen_phone: sosPhone.trim() || null,
          trusted_contacts: trustedList,
        },
        sosPhoto
      );
      setSosResult(created);
      setSosStep('SUBMITTED');
    } catch (err) {
      setSosError(err.userMessage || 'Failed to submit SOS alert.');
    } finally {
      setSosSubmitting(false);
    }
  };

  const handleTrackSOS = async (e) => {
    e.preventDefault();
    if (!sosTrackInput.trim()) return;
    setSosError('');
    try {
      const found = await trackSOSAlert(sosTrackInput.trim());
      setSosResult(found);
      setSosStep('SUBMITTED');
    } catch (err) {
      setSosError(err.userMessage || 'SOS Tracking ID not found.');
    }
  };

  const handleCancelSOS = async () => {
    if (!sosResult?.tracking_id) return;
    try {
      const updated = await cancelSOSAlert(sosResult.tracking_id, 'Cancelled by citizen via portal.');
      setSosResult(updated);
    } catch (err) {
      setSosError(err.userMessage || 'Could not cancel SOS.');
    }
  };

  return (
    <MainLayout
      pageTitle={
        activeTab === 'sos'
          ? language === 'ta'
            ? 'SOS பொதுப் பாதுகாப்பு அவசர உதவி மையம்'
            : 'SOS Public Safety & Emergency Response'
          : activeTab === 'assistant'
          ? language === 'ta'
            ? 'தமிழ் & ஆங்கில குரல் மற்றும் AI உதவியாளர்'
            : 'Bilingual Voice & Gemini AI Civic Assistant'
          : language === 'ta'
          ? 'நேரடி செயற்கைக்கோள் GIS வரைபடம் & அருகிலுள்ள புகார்கள்'
          : 'Live Satellite GIS Map & Nearby Civic Intelligence'
      }
      subtitle="Speak in Tamil or English • Pin the Issue • AI Triages It • Emergency SOS Protection"
    >
      {/* Unified Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-6 bg-white p-2 rounded-2xl border border-slate-200 shadow-xs">
        <button
          type="button"
          onClick={() => setActiveTab('gis')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === 'gis'
              ? 'bg-navy-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Compass className="w-4 h-4 text-teal-400" />
          <span>{language === 'ta' ? 'செயற்கைக்கோள் GIS வரைபடம்' : 'Satellite GIS & Nearby'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('assistant')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === 'assistant'
              ? 'bg-teal-700 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Bot className="w-4 h-4" />
          <span>{language === 'ta' ? 'தமிழ் குரல் & AI உதவியாளர்' : 'Tamil/English Voice & AI Assistant'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('sos')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ml-auto ${
            activeTab === 'sos'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
              : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>{language === 'ta' ? 'SOS அவசர உதவி' : 'SOS Emergency Alert'}</span>
        </button>
      </div>

      {/* ================================================================= */}
      {/* TAB 1: LIVE SATELLITE GIS & NEARBY CIVIC ISSUES                   */}
      {/* ================================================================= */}
      {activeTab === 'gis' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 flex-shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-teal-700">
                    Live GPS & Reverse Geocoded Address
                  </span>
                  <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono">
                    {coords.latitude.toFixed(4)}°N, {coords.longitude.toFixed(4)}°E (±{coords.accuracy}m)
                  </span>
                </div>
                <p className="text-sm font-bold text-slate-900 mt-0.5">
                  {addressInfo?.address || 'Tiruchengode Municipal Bus Stand, Namakkal District'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleDetectGPS}
                disabled={locating}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-teal-600 text-white hover:bg-teal-700 transition-colors"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>{locating ? 'Locating GPS...' : 'Detect My Live GPS'}</span>
              </button>

              <select
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-slate-50"
              >
                <option value={2}>Within 2 km</option>
                <option value={5}>Within 5 km</option>
                <option value={10}>Within 10 km</option>
                <option value={25}>Within 25 km</option>
                <option value={50}>Within 50 km</option>
              </select>

              <select
                value={catFilter}
                onChange={(e) => setCatFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-slate-50"
              >
                <option value="ALL">All Categories</option>
                <option value="Pothole">Pothole</option>
                <option value="Garbage">Garbage</option>
                <option value="Water">Water Supply</option>
                <option value="Streetlight">Streetlight</option>
                <option value="Drainage">Drainage</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-3 shadow-xs">
              <ComplaintMap
                latitude={coords.latitude}
                longitude={coords.longitude}
                interactive={true}
                height="460px"
                defaultSatellite={true}
                markers={nearbyItems}
                onLocationChange={(lat, lng) =>
                  setCoords((prev) => ({ ...prev, latitude: lat, longitude: lng }))
                }
              />
              <div className="mt-2 px-2 flex items-center justify-between text-[11px] text-slate-500">
                <span>
                  Satellite basemap (Esri World Imagery) + OpenStreetMap street layer with live GPS tracking.
                </span>
                <span className="font-bold text-teal-700">
                  {nearbyItems.length} complaints within {radiusKm} km
                </span>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col max-h-[510px]">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-sm font-extrabold text-slate-900">
                  Nearby Civic Issues ({nearbyItems.length})
                </h3>
                <button
                  type="button"
                  onClick={() =>
                    fetchReverseGeocodeAndNearby(coords.latitude, coords.longitude, radiusKm, catFilter)
                  }
                  className="text-xs font-semibold text-teal-600 hover:text-teal-800 inline-flex items-center gap-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingNearby ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 pr-1 mt-2">
                {nearbyItems.length === 0 ? (
                  <p className="text-xs text-slate-500 py-8 text-center">
                    No complaints found within {radiusKm} km. Try expanding the search radius.
                  </p>
                ) : (
                  nearbyItems.map((item) => {
                    const displayCaseId = item.case_id || item.tracking_id;
                    return (
                      <div key={item.id} className="py-3 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <Link
                            to={`/track/${displayCaseId}`}
                            className="text-xs font-mono font-bold text-teal-700 hover:underline"
                          >
                            {displayCaseId}
                          </Link>
                          <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                            {item.distance_km} km away
                          </span>
                        </div>
                        <p className="text-xs text-slate-800 font-medium line-clamp-2">
                          {item.citizen_text}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <StatusBadge status={item.status} size="sm" />
                          <PriorityBadge priority={item.priority} size="sm" />
                          <span className="text-[11px] text-slate-500 font-semibold">
                            {item.category}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 2: TAMIL & ENGLISH VOICE + GEMINI AI CIVIC ASSISTANT          */}
      {/* ================================================================= */}
      {activeTab === 'assistant' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Voice-to-Text & Tamil Unicode Triage */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-teal-600">
                  Tamil & English Speech-to-Text
                </span>
                <h3 className="text-base font-extrabold text-slate-900">
                  Voice Complaint & Command Studio
                </h3>
              </div>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setVoiceLang('ta')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                    voiceLang === 'ta' ? 'bg-navy-900 text-white' : 'text-slate-600'
                  }`}
                >
                  தமிழ் (ta-IN)
                </button>
                <button
                  type="button"
                  onClick={() => setVoiceLang('en')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                    voiceLang === 'en' ? 'bg-navy-900 text-white' : 'text-slate-600'
                  }`}
                >
                  English (en-IN)
                </button>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col items-center text-center space-y-3">
              <button
                type="button"
                onClick={handleStartVoiceRecognition}
                className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all ${
                  isListening
                    ? 'bg-rose-600 text-white animate-pulse ring-4 ring-rose-200'
                    : 'bg-teal-600 hover:bg-teal-700 text-white'
                }`}
              >
                {isListening ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
              </button>
              <p className="text-xs font-bold text-slate-700">
                {isListening
                  ? voiceLang === 'ta'
                    ? 'கேட்கிறது... தமிழில் பேசவும்'
                    : 'Listening... Speak in English or Tamil'
                  : voiceLang === 'ta'
                  ? 'மைக்ரோஃபோனை அழுத்தி தமிழில் பேசவும் (தமிழ் எழுத்துரு பாதுகாக்கப்படும்)'
                  : 'Tap microphone to speak in Tamil or English'}
              </p>
            </div>

            {/* Quick Sample Voice Phrases */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase">
                Quick Voice Test Phrases (Click to test):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'எங்கள் தெருவில் தண்ணீர் தேங்கி இருக்கிறது.',
                  'எங்கள் பகுதியில் குப்பைகள் அகற்றப்படவில்லை.',
                  'There is a large pothole near my street causing traffic hazard.',
                ].map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => handleAnalyzeTranscript(sample)}
                    className="text-left text-[11px] bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-200 px-2.5 py-1.5 rounded-lg font-medium transition-colors"
                  >
                    “{sample}”
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Editable Voice Transcript (Unicode Tamil / English):
              </label>
              <textarea
                rows={3}
                value={voiceTranscript}
                onChange={(e) => setVoiceTranscript(e.target.value)}
                placeholder="எங்கள் பகுதியில் குப்பைகள் அகற்றப்படவில்லை / Large pothole on main road..."
                className="w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleAnalyzeTranscript(voiceTranscript)}
                  className="px-3.5 py-2 rounded-xl bg-navy-900 text-white text-xs font-bold hover:bg-navy-800"
                >
                  Analyze Voice & Speak Response
                </button>
                {voiceTranscript && (
                  <button
                    type="button"
                    onClick={() => navigate('/report', { state: { prefillText: voiceTranscript } })}
                    className="px-3.5 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold hover:bg-teal-700"
                  >
                    Proceed to Submit Complaint →
                  </button>
                )}
              </div>
            </div>

            {voiceAnalysis && (
              <div className="p-3.5 rounded-xl bg-teal-50/80 border border-teal-200 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-teal-900 uppercase">
                    AI Voice Triage Preview
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      speakText(voiceAnalysis.tts_response, voiceAnalysis.tts_language_code)
                    }
                    className="inline-flex items-center gap-1 text-teal-700 font-bold hover:underline"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Replay TTS</span>
                  </button>
                </div>
                <p className="text-slate-800 font-medium">{voiceAnalysis.tts_response}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <span className="px-2 py-0.5 rounded bg-white border border-teal-200 font-bold text-teal-800">
                    Lang: {voiceAnalysis.detected_language.toUpperCase()}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-white border border-teal-200 font-bold text-slate-800">
                    Category: {voiceAnalysis.suggested_category}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-white border border-teal-200 font-bold text-rose-700">
                    Priority: {voiceAnalysis.suggested_priority}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Interactive Gemini AI Civic Assistant Chat */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col h-[560px]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-navy-900 to-teal-700 text-white flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-teal-300" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Gemini AI Civic Intelligence Assistant
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Live database-grounded answers in Tamil (தமிழ்) & English
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-1">
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${
                    m.sender === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs sm:text-sm whitespace-pre-line ${
                      m.sender === 'user'
                        ? 'bg-navy-900 text-white'
                        : 'bg-slate-100 text-slate-900 border border-slate-200'
                    }`}
                  >
                    {m.text}
                    {m.sender === 'ai' && (
                      <div className="mt-2 pt-2 border-t border-slate-200/70 flex items-center justify-between gap-3 text-[10px] text-slate-500">
                        <span>Source: {m.source || 'AI_ENGINE'}</span>
                        <button
                          type="button"
                          onClick={() =>
                            speakText(m.text, voiceLang === 'ta' ? 'ta-IN' : 'en-IN')
                          }
                          className="inline-flex items-center gap-1 text-teal-700 font-bold hover:underline"
                        >
                          <Volume2 className="w-3 h-3" />
                          <span>Listen</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="text-xs text-slate-400 italic">
                  CivicPulse AI is analyzing municipal telemetry...
                </div>
              )}
            </div>

            <form onSubmit={handleSendChat} className="pt-3 border-t border-slate-100 flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={
                  voiceLang === 'ta'
                    ? 'தமிழில் கேட்கவும் (எ.கா. CP-06DB9830 நிலை என்ன?)'
                    : 'Ask about complaint status (e.g. CP-06DB9830), duplicate rules, or safety...'
                }
                className="flex-1 rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={chatLoading}
                className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold inline-flex items-center gap-1.5"
              >
                <Send className="w-4 h-4" />
                <span>Send</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 3: SOS PUBLIC SAFETY EMERGENCY SYSTEM                         */}
      {/* ================================================================= */}
      {activeTab === 'sos' && (
        <div className="space-y-6">
          {/* Official Emergency Hotline Disclaimer Banner */}
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900">
                <p className="font-extrabold uppercase tracking-wider">
                  Important Public Safety Notice
                </p>
                <p className="mt-0.5">
                  CivicPulse SOS alerts municipal emergency response officers immediately. It is a supplementary civic channel and does not automatically dial police/ambulance without human verification.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <a
                href="tel:112"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-extrabold shadow-xs"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Dial 112 (Emergency)</span>
              </a>
              <a
                href="tel:108"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-extrabold"
              >
                <span>108 Ambulance</span>
              </a>
              <a
                href="tel:101"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-orange-600 text-white text-xs font-extrabold"
              >
                <span>101 Fire</span>
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-white rounded-2xl border border-rose-200 p-6 shadow-xs space-y-5">
              {sosError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700">
                  {sosError}
                </div>
              )}

              {sosStep === 'FORM' && (
                <>
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-md shadow-rose-600/20">
                      <ShieldAlert className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-extrabold text-slate-900">
                        Report Public Safety Emergency (SOS)
                      </h3>
                      <p className="text-xs text-slate-500">
                        Captures live GPS coordinates ({coords.latitude.toFixed(4)}°N, {coords.longitude.toFixed(4)}°E) & alerts municipal responders
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        1. Select Emergency Hazard Type *
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {EMERGENCY_TYPES.map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setSosType(type)}
                            className={`text-left p-3 rounded-xl border text-xs font-bold transition-all ${
                              sosType === type
                                ? 'bg-rose-50 border-rose-500 text-rose-900 ring-2 ring-rose-200'
                                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        2. Emergency Description & Exact Landmark *
                      </label>
                      <textarea
                        rows={3}
                        value={sosDesc}
                        onChange={(e) => setSosDesc(e.target.value)}
                        placeholder="Describe the hazard (e.g. Live sparking electric wire fallen across road near bus stand)..."
                        className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <input
                        type="text"
                        value={sosName}
                        onChange={(e) => setSosName(e.target.value)}
                        placeholder="Your Name (Optional)"
                        className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
                      />
                      <input
                        type="tel"
                        value={sosPhone}
                        onChange={(e) => setSosPhone(e.target.value)}
                        placeholder="Callback Phone (Optional)"
                        className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
                      />
                      <input
                        type="tel"
                        value={trustedContact}
                        onChange={(e) => setTrustedContact(e.target.value)}
                        placeholder="Trusted Contact Phone"
                        className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
                      />
                    </div>

                    <PhotoUpload
                      photo={sosPhoto}
                      onChange={setSosPhoto}
                      label="3. Optional Hazard Photo Evidence"
                    />

                    <button
                      type="button"
                      onClick={() => setSosStep('CONFIRM')}
                      className="w-full py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-sm shadow-lg shadow-rose-600/25 transition-all"
                    >
                      PROCEED TO SOS CONFIRMATION →
                    </button>
                  </div>
                </>
              )}

              {sosStep === 'CONFIRM' && (
                <div className="p-5 rounded-2xl bg-rose-50 border-2 border-rose-400 space-y-4 text-center">
                  <ShieldAlert className="w-12 h-12 text-rose-600 mx-auto" />
                  <h3 className="text-lg font-extrabold text-rose-950">
                    Confirm Emergency SOS Activation
                  </h3>
                  <p className="text-xs text-rose-800 max-w-md mx-auto">
                    You are about to transmit a <strong>CRITICAL ({sosType})</strong> alert at{' '}
                    <strong>{addressInfo?.address || `${coords.latitude}, ${coords.longitude}`}</strong>{' '}
                    to the Municipal Emergency Response Dashboard.
                  </p>
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setSosStep('FORM')}
                      className="px-5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-bold"
                    >
                      Cancel / Go Back
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmAndSubmitSOS}
                      disabled={sosSubmitting}
                      className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold shadow-md"
                    >
                      {sosSubmitting ? 'Transmitting SOS...' : 'CONFIRM & TRANSMIT SOS NOW'}
                    </button>
                  </div>
                </div>
              )}

              {sosStep === 'SUBMITTED' && sosResult && (
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-6 h-6 text-teal-600" />
                      <div>
                        <span className="text-[11px] font-bold text-slate-400 uppercase">
                          Emergency SOS Case ID
                        </span>
                        <h4 className="text-lg font-mono font-extrabold text-slate-900">
                          {sosResult.case_id || sosResult.tracking_id}
                        </h4>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-rose-100 text-rose-800">
                      {sosResult.status}
                    </span>
                  </div>

                  <div className="text-xs space-y-1 text-slate-700">
                    <p>
                      <strong>Hazard Type:</strong> {sosResult.emergency_type}
                    </p>
                    <p>
                      <strong>Location:</strong> {sosResult.address_text} ({sosResult.latitude},{' '}
                      {sosResult.longitude})
                    </p>
                    <p>
                      <strong>Description:</strong> {sosResult.description}
                    </p>
                    {sosResult.assigned_officer_name && (
                      <p className="text-teal-700 font-bold">
                        <strong>Assigned Responder:</strong> {sosResult.assigned_officer_name}
                      </p>
                    )}
                  </div>

                  {sosResult.logs?.length > 0 && (
                    <div className="pt-3 border-t border-slate-200 space-y-2">
                      <span className="text-[11px] font-extrabold uppercase text-slate-500">
                        Emergency Audit Trail
                      </span>
                      {sosResult.logs.map((lg) => (
                        <div key={lg.id} className="text-xs bg-white p-2.5 rounded-lg border border-slate-200">
                          <span className="font-bold text-slate-900">{lg.action}</span> —{' '}
                          <span className="text-slate-600">{lg.note}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-3 pt-2">
                    {sosResult.status !== 'CANCELLED' && sosResult.status !== 'RESOLVED' && (
                      <button
                        type="button"
                        onClick={handleCancelSOS}
                        className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Cancel Accidental SOS</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setSosResult(null);
                        setSosStep('FORM');
                      }}
                      className="px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
                    >
                      Report Another Incident
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Track Existing SOS & Emergency Location Map */}
            <div className="lg:col-span-5 space-y-5">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
                <h4 className="text-sm font-extrabold text-slate-900">
                  Track Existing SOS Alert Status
                </h4>
                <form onSubmit={handleTrackSOS} className="flex gap-2">
                  <input
                    type="text"
                    value={sosTrackInput}
                    onChange={(e) => setSosTrackInput(e.target.value)}
                    placeholder="Enter SOS-2026-00001"
                    className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono uppercase"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-navy-900 text-white text-xs font-bold inline-flex items-center gap-1"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Track</span>
                  </button>
                </form>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-xs">
                <ComplaintMap
                  latitude={coords.latitude}
                  longitude={coords.longitude}
                  interactive={true}
                  height="300px"
                  defaultSatellite={true}
                  onLocationChange={(lat, lng) =>
                    setCoords((prev) => ({ ...prev, latitude: lat, longitude: lng }))
                  }
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}

