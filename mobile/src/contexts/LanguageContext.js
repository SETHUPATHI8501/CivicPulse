import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LANGUAGE_STORAGE_KEY = 'civicpulse_mobile_lang';

export const translations = {
  en: {
    // Branding & Navigation
    appName: 'CivicPulse AI',
    appTagline: 'Smart Municipal Grievance Redressal',
    home: 'Home',
    reportIssue: 'Report',
    trackStatus: 'Track',
    officerPortal: 'Officer Portal',
    officerQueue: 'Queue',
    adminAnalytics: 'Hotspots',
    settings: 'Settings',

    // Language
    selectLanguage: 'Choose Language / மொழியை தேர்வு செய்க',
    english: 'English',
    tamil: 'தமிழ்',
    continue: 'Continue',

    // Welcome Screen
    welcomeTitle: 'Your City. Your Voice. Better Tomorrow.',
    welcomeSubtitle: 'AI-powered civic grievance filing with geotagging and verified redressal for Tamil Nadu municipalities.',
    getStarted: 'Get Started as Citizen',
    officerLoginPrompt: 'Are you a Municipal Officer?',
    officerLoginBtn: 'Officer Login',

    // Dashboard
    civicTelemetry: 'LIVE MUNICIPAL TELEMETRY',
    overviewTitle: 'Civic Transparency in Numbers',
    overviewSubtitle: 'Real-time synchronization with municipal database',
    totalComplaints: 'Total Complaints',
    openComplaints: 'Open Issues',
    inProgressComplaints: 'In Progress',
    resolvedComplaints: 'Resolved Issues',
    highPriority: 'High Priority',
    resolutionRate: 'Resolution Rate',
    reportAnIssue: 'Report a Civic Issue',
    trackAnIssue: 'Track Grievance Status',
    supportedCategories: 'Grievance Categories',
    latestUpdates: 'Latest Municipal Grievances',
    emergencyHelplines: 'Municipal Helplines (Tamil Nadu)',
    municipalControl: 'Municipal Control',
    policeTraffic: 'Police / Traffic',

    // Report Complaint
    reportTitle: 'Report Civic Issue',
    reportSubtitle: 'AI Triage • GPS Tagging • Duplicate Check',
    issueDescription: 'COMPLAINT DESCRIPTION (ENGLISH OR TAMIL)',
    descriptionPlaceholder: 'Describe the issue, street name, nearest landmark, and severity...',
    quickTemplates: 'Quick Tamil / English Issue Templates',
    selectCategory: 'ISSUE CATEGORY (OR AUTO-DETECT)',
    autoDetectAI: 'Auto-Detect by AI (Recommended)',
    photoEvidence: 'PHOTO EVIDENCE (OPTIONAL)',
    takePhoto: 'Camera',
    chooseGallery: 'Gallery',
    removePhoto: 'Remove Photo',
    gpsLocation: 'GPS LOCATION & LANDMARK',
    detectGPS: 'Detect GPS',
    landmarkPlaceholder: 'Nearest landmark or street name (optional)',
    submitComplaint: 'Submit Civic Grievance',
    submittingComplaint: 'Classifying with AI & Submitting...',
    registeredSuccess: 'Complaint Registered Successfully',
    saveTrackingNote: 'Save this unique Tracking ID to check field inspection and resolution status.',
    aiTriageResult: 'AI Automated Triage Result',
    classifiedByGemini: 'Classified by Google Gemini AI',
    classifiedByFallback: 'Classified by Rule-Based Keyword Fallback',
    duplicateWarningTitle: 'Nearby Similar Complaint Detected',
    duplicateWarningDesc: 'This issue has been linked with an active nearby report so municipal engineers can resolve them together.',
    trackThisNow: 'Track This Complaint Now',
    reportAnother: 'Report Another Issue',

    // Categories
    catPothole: 'Pothole & Roads',
    catGarbage: 'Garbage & Sanitation',
    catWater: 'Water Supply',
    catStreetlight: 'Streetlight',
    catDrainage: 'Drainage & Sewage',
    catOther: 'General Municipal',

    // Statuses
    statusOpen: 'Open',
    statusInProgress: 'In Progress',
    statusNeedsInfo: 'Needs Info',
    statusResolved: 'Resolved',
    statusRejected: 'Rejected',

    // Priorities
    priorityHigh: 'High Priority',
    priorityMedium: 'Medium Priority',
    priorityLow: 'Low Priority',

    // Officer & Admin
    officerConsoleTitle: 'Officer Operations Queue',
    adminConsoleTitle: 'Municipal Admin Operations',
    searchPlaceholder: 'Search Tracking ID, category, or keyword...',
    assignOfficerTitle: 'Admin: Assign Ward Officer',
    updateStatusTitle: 'Update Status & Remarks',
    resolveWithProofTitle: 'Resolve with Mandatory Photo Proof',
    resolutionNoteLabel: 'MANDATORY RESOLUTION NOTE',
    resolutionPhotoLabel: 'PROOF OF WORK PHOTO (REQUIRED)',
    markResolvedBtn: 'Verify & Mark Resolved',
    auditHistoryTitle: 'Audit Trail & History',

    // Common
    loading: 'Loading...',
    refresh: 'Refresh',
    retry: 'Try Again',
    error: 'Error',
    networkError: 'Cannot connect to CivicPulse AI backend server. Please verify your connection.',
  },
  ta: {
    // Branding & Navigation
    appName: 'CivicPulse AI',
    appTagline: 'நகராட்சி குறைதீர்ப்பு தளம்',
    home: 'முகப்பு',
    reportIssue: 'புகார் பதிவு',
    trackStatus: 'நிலை அறிதல்',
    officerPortal: 'அதிகாரி தளம்',
    officerQueue: 'புகார்கள்',
    adminAnalytics: 'ஹாட்ஸ்பாட்',
    settings: 'அமைப்புகள்',

    // Language
    selectLanguage: 'மொழியை தேர்வு செய்க / Choose Language',
    english: 'English',
    tamil: 'தமிழ்',
    continue: 'தொடரவும்',

    // Welcome Screen
    welcomeTitle: 'உங்கள் நகரம். உங்கள் குரல். சிறந்த எதிர்காலம்.',
    welcomeSubtitle: 'செயற்கை நுண்ணறிவுடன் ஜி.பி.எஸ் இருப்பிடத்துடன் புகார்களைப் பதிவு செய்து விரைவாகத் தீர்வு காணும் தளம்.',
    getStarted: 'குடிமகனாகத் தொடங்குக',
    officerLoginPrompt: 'நீங்கள் நகராட்சி அதிகாரியா?',
    officerLoginBtn: 'அதிகாரி உள்நுழைவு',

    // Dashboard
    civicTelemetry: 'நேரலை நகராட்சி புள்ளிவிவரங்கள்',
    overviewTitle: 'வெளிப்படையான நகராட்சி மேலாண்மை',
    overviewSubtitle: 'நகராட்சி தரவுத்தளத்துடன் நேரலை ஒத்திசைவு',
    totalComplaints: 'மொத்த புகார்கள்',
    openComplaints: 'நிலுவை புகார்கள்',
    inProgressComplaints: 'நடவடிக்கையில்',
    resolvedComplaints: 'தீர்க்கப்பட்டவை',
    highPriority: 'அவசர முன்னுரிமை',
    resolutionRate: 'தீர்வு விகிதம்',
    reportAnIssue: 'குடிமைப் புகார் பதிவு செய்க',
    trackAnIssue: 'புகாரின் நிலை அறிய',
    supportedCategories: 'புகார் வகைகள்',
    latestUpdates: 'சமீபத்திய நகராட்சிப் புகார்கள்',
    emergencyHelplines: 'அவசர உதவி எண்கள் (தமிழ்நாடு)',
    municipalControl: 'நகராட்சி கட்டுப்பாடு',
    policeTraffic: 'காவல்துறை / போக்குவரத்து',

    // Report Complaint
    reportTitle: 'புதிய புகார் பதிவு',
    reportSubtitle: 'AI வகைப்படுத்தல் • ஜிபிஎஸ் இருப்பிடம்',
    issueDescription: 'புகார் விவரம் (தமிழ் அல்லது ஆங்கிலத்தில்)',
    descriptionPlaceholder: 'பிரச்சினையின் விவரம், தெரு பெயர் மற்றும் அடையாளத்தை உள்ளிடவும்...',
    quickTemplates: 'விரைவு தமிழ் / ஆங்கில மாதிரிகள்',
    selectCategory: 'புகார் வகை (அல்லது AI தானியங்கி)',
    autoDetectAI: 'AI தானியங்கி கண்டறிதல் (பரிந்துரை)',
    photoEvidence: 'புகைப்பட ஆதாரம் (விருப்பத்தேர்வு)',
    takePhoto: 'கேமரா',
    chooseGallery: 'கேலரி',
    removePhoto: 'படத்தை நீக்கு',
    gpsLocation: 'ஜி.பி.எஸ் இருப்பிடம் & அடையாளம்',
    detectGPS: 'ஜிபிஎஸ் கண்டறி',
    landmarkPlaceholder: 'அருகிலுள்ள அடையாளம் / தெரு பெயர்',
    submitComplaint: 'புகாரைப் பதிவு செய்க',
    submittingComplaint: 'AI மூலம் வகைப்படுத்திப் பதிவு செய்கிறது...',
    registeredSuccess: 'புகார் வெற்றிகரமாகப் பதிவு செய்யப்பட்டது',
    saveTrackingNote: 'புகாரின் நிலையைக் கண்காணிக்க இந்த எண்ணைச் சேமித்துக் கொள்ளவும்.',
    aiTriageResult: 'AI தானியங்கி வகைப்பாடு முடிவு',
    classifiedByGemini: 'Google Gemini AI மூலம் வகைப்படுத்தப்பட்டது',
    classifiedByFallback: 'விதிமுறை அடிப்படையில் வகைப்படுத்தப்பட்டது (Fallback)',
    duplicateWarningTitle: 'அருகில் இதே போன்ற புகார் கண்டறியப்பட்டுள்ளது',
    duplicateWarningDesc: 'விரைவான தீர்வுக்காக உங்கள் புகார் ஏற்கனவே உள்ள புகாருடன் இணைக்கப்பட்டுள்ளது.',
    trackThisNow: 'இப்போதே நிலையைக் கண்காணிக்க',
    reportAnother: 'மற்றொரு புகார் பதிவு செய்க',

    // Categories
    catPothole: 'சாலை பள்ளம் & சேதம்',
    catGarbage: 'குப்பை கழிவு மேலாண்மை',
    catWater: 'குடிநீர் விநியோகம்',
    catStreetlight: 'தெருவிளக்கு பழுது',
    catDrainage: 'சாக்கடை / வடிகால்',
    catOther: 'பொது நகராட்சிப் பிரச்சினை',

    // Statuses
    statusOpen: 'பதிவு செய்யப்பட்டது',
    statusInProgress: 'ஆய்வில் உள்ளது',
    statusNeedsInfo: 'தகவல் தேவை',
    statusResolved: 'தீர்க்கப்பட்டது',
    statusRejected: 'நிராகரிக்கப்பட்டது',

    // Priorities
    priorityHigh: 'அவசரம் (High)',
    priorityMedium: 'நடுத்தரம் (Medium)',
    priorityLow: 'குறைவு (Low)',

    // Officer & Admin
    officerConsoleTitle: 'அதிகாரி பணிப் பட்டியல்',
    adminConsoleTitle: 'நகராட்சி நிர்வாக தளம்',
    searchPlaceholder: 'கண்காணிப்பு எண் அல்லது வகை மூலம் தேடுக...',
    assignOfficerTitle: 'நிர்வாகி: அதிகாரி ஒதுக்கீடு',
    updateStatusTitle: 'நிலை மாற்றம் & குறிப்புகள்',
    resolveWithProofTitle: 'புகைப்பட ஆதாரத்துடன் தீர்வு பதிவு',
    resolutionNoteLabel: 'தீர்வு விவரக் குறிப்பு (கட்டாயம்)',
    resolutionPhotoLabel: 'பணி முடிந்த புகைப்பட ஆதாரம் (கட்டாயம்)',
    markResolvedBtn: 'தீர்வை உறுதி செய்',
    auditHistoryTitle: 'நடவடிக்கை வரலாறு',

    // Common
    loading: 'ஏற்றப்படுகிறது...',
    refresh: 'புதுப்பி',
    retry: 'மீண்டும் முயற்சி செய்க',
    error: 'பிழை',
    networkError: 'சேவையகத்துடன் இணைக்க முடியவில்லை. இணைய இணைப்பை சரிபார்க்கவும்.',
  },
};

const LanguageContext = createContext({
  language: 'en',
  setLanguage: () => {},
  t: (key) => key,
});

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState('en');

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (saved === 'en' || saved === 'ta') {
          setLanguageState(saved);
        }
      } catch {
        // Ignored
      }
    })();
  }, []);

  const setLanguage = async (newLang) => {
    if (newLang === 'en' || newLang === 'ta') {
      setLanguageState(newLang);
      try {
        await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, newLang);
      } catch {
        // Ignored
      }
    }
  };

  const t = (key) => {
    return translations[language]?.[key] || translations['en']?.[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
export default LanguageContext;
