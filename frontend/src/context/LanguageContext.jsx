import React, { createContext, useContext, useState, useEffect } from 'react';

const translations = {
  en: {
    // Brand & Navigation
    brandName: 'CivicPulse AI',
    brandTagline: 'AI-Powered Smart Civic Complaint Platform',
    home: 'Home',
    reportComplaint: 'Report Issue',
    trackComplaint: 'Track Status',
    officerPortal: 'Officer Portal',
    analytics: 'Hotspot Analytics',

    // Common Actions
    submit: 'Submit',
    submitting: 'Submitting...',
    cancel: 'Cancel',
    save: 'Save',
    search: 'Search',
    filter: 'Filter',
    clear: 'Clear',
    viewDetails: 'View Details',
    track: 'Track Issue',
    refresh: 'Refresh',
    retry: 'Try Again',
    back: 'Go Back',
    close: 'Close',

    // Statuses
    status_OPEN: 'Open',
    status_IN_PROGRESS: 'In Progress',
    status_RESOLVED: 'Resolved',
    status_NEEDS_INFO: 'Needs Info',
    status_REJECTED: 'Rejected',

    // Priorities
    priority_HIGH: 'High Priority',
    priority_MEDIUM: 'Medium Priority',
    priority_LOW: 'Low Priority',

    // Categories
    cat_Pothole: 'Roads & Potholes',
    cat_Garbage: 'Garbage & Sanitation',
    cat_Water: 'Water Supply',
    cat_Streetlight: 'Streetlighting',
    cat_Drainage: 'Drainage & Sewage',
    cat_Other: 'General Civic Issue',

    // Form labels & placeholders
    description: 'Complaint Description',
    voiceNote: 'Voice Recording',
    location: 'GPS Location',
    photo: 'Photo Evidence',
    trackingId: 'Tracking ID',
    department: 'Assigned Department',
    reportedOn: 'Reported On',
    duplicateNotice: 'Duplicate Detected',
    duplicateGroup: 'Joined Group',

    // Empty & Error states
    emptyTitle: 'No complaints found',
    emptyDesc: 'There are no complaints matching your criteria at this moment.',
    errorTitle: 'Something went wrong',
    errorDesc: 'Unable to load civic information. Please check your network connection and retry.',

    // Footer
    footerDesc: 'CivicPulse AI is an automated municipal grievance redressal system leveraging artificial intelligence and geospatial intelligence for transparent governance.',
    hackathonInfo: 'ARSW001 Hackathon Project • Team Alronclad • KSR Institute for Engineering and Technology',
    copyright: 'CivicPulse AI. Municipal Civic Technology Platform.',
    quickLinks: 'Quick Links',
    emergencyHelpline: 'Emergency Services',

    // Officer & Admin Portal
    officerLogin: 'Officer Portal Login',
    officerLoginDesc: 'Authorized municipal grievance management access',
    email: 'Official Email',
    password: 'Password',
    loginButton: 'Sign In to Portal',
    loggingIn: 'Verifying Credentials...',
    officerDashboard: 'Officer Operations Dashboard',
    adminPortal: 'Administration Portal',
    logout: 'Sign Out',
    assignedComplaints: 'Assigned Complaints',
    adminOfficerDir: 'Officer Directory',
    citizenPortal: 'Citizen Portal',
    statusUpdate: 'Update Status',
    resolveComplaint: 'Resolve Complaint',
    resolutionPhoto: 'Proof of Resolution Photo',
    resolutionNote: 'Resolution Work Summary',
    assignOfficer: 'Assign Officer',
    newOfficer: 'Register Officer',
    mapView: 'Map View',
    listView: 'List View',
    priority: 'Priority',
    status: 'Status',
    category: 'Category',
    actions: 'Actions',
    totalAssigned: 'Total Assigned',
    inProgress: 'In Progress',
    pendingOpen: 'Pending / Open',
    resolvedTotal: 'Resolved Issues',
  },
  ta: {
    // Brand & Navigation
    brandName: 'CivicPulse AI',
    brandTagline: 'செயற்கை நுண்ணறிவு மக்கள் குறைதீர்க்கும் தளம்',
    home: 'முகப்பு',
    reportComplaint: 'புகார் பதிவு செய்க',
    trackComplaint: 'புகார் நிலை அறிக',
    officerPortal: 'அதிகாரி தளம்',
    analytics: 'பகுப்பாய்வு',

    // Common Actions
    submit: 'சமர்ப்பிக்க',
    submitting: 'பதிவேற்றப்படுகிறது...',
    cancel: 'ரத்து செய்',
    save: 'சேமி',
    search: 'தேடுக',
    filter: 'வடிகட்டு',
    clear: 'அழி',
    viewDetails: 'விவரம் காண்க',
    track: 'நிலை காண்க',
    refresh: 'புதுப்பி',
    retry: 'மீண்டும் முயற்சி செய்க',
    back: 'பின்செல்க',
    close: 'மூடுக',

    // Statuses
    status_OPEN: 'திறந்துள்ளது',
    status_IN_PROGRESS: 'செயல்பாட்டில்',
    status_RESOLVED: 'தீர்க்கப்பட்டது',
    status_NEEDS_INFO: 'விவரம் தேவை',
    status_REJECTED: 'நிராகரிக்கப்பட்டது',

    // Priorities
    priority_HIGH: 'அதிமுக்கியம்',
    priority_MEDIUM: 'நடுத்தர முன்னுரிமை',
    priority_LOW: 'குறைந்த முன்னுரிமை',

    // Categories
    cat_Pothole: 'சாலை & குழி',
    cat_Garbage: 'குப்பை & சுகாதாரம்',
    cat_Water: 'குடிநீர் விநியோகம்',
    cat_Streetlight: 'தெருவிளக்கு',
    cat_Drainage: 'சாக்கடை & வடிகால்',
    cat_Other: 'பொது பிரச்சினை',

    // Form labels & placeholders
    description: 'புகார் விளக்கம்',
    voiceNote: 'குரல் பதிவு',
    location: 'இருப்பிடம்',
    photo: 'புகைப்பட ஆதாரம்',
    trackingId: 'கண்காணிப்பு எண்',
    department: 'ஒதுக்கப்பட்ட துறை',
    reportedOn: 'பதிவு செய்யப்பட்ட நாள்',
    duplicateNotice: 'ஒத்த புகார் கண்டறியப்பட்டது',
    duplicateGroup: 'இணைக்கப்பட்ட குழு',

    // Empty & Error states
    emptyTitle: 'புகார்கள் ஏதும் இல்லை',
    emptyDesc: 'தங்களின் தேடலுக்குரிய புகார்கள் தற்சமயம் எதுவும் காணப்படவில்லை.',
    errorTitle: 'பிழை ஏற்பட்டது',
    errorDesc: 'தகவல்களைப் பெற முடியவில்லை. இணைய இணைப்பைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்.',

    // Footer
    footerDesc: 'சிவிக்பல்ஸ் AI என்பது செயற்கை நுண்ணறிவு மற்றும் இருப்பிட தொழில்நுட்பத்தை பயன்படுத்தி நகராட்சி புகார்களை வெளிப்படையாக தீர்க்கும் தளம்.',
    hackathonInfo: 'ARSW001 ஹேக்கத்தான் திட்டம் • குழு Alronclad • KSR பொறியியல் மற்றும் தொழில்நுட்பக் கல்லூரி',
    copyright: 'CivicPulse AI. நகராட்சி பொது தொழில்நுட்ப தளம்.',
    quickLinks: 'முக்கிய இணைப்புகள்',
    emergencyHelpline: 'அவசர உதவி எண்கள்',

    // Officer & Admin Portal
    officerLogin: 'அதிகாரி உள்நுழைவு',
    officerLoginDesc: 'நகராட்சி குறைதீர்ப்பு நிர்வாக அணுகல்',
    email: 'அலுவல் மின்னஞ்சல்',
    password: 'கடவுச்சொல்',
    loginButton: 'உள்நுழைக',
    loggingIn: 'சரிபார்க்கப்படுகிறது...',
    officerDashboard: 'அதிகாரி செயல்பாட்டு தளம்',
    adminPortal: 'நிர்வாக தளம்',
    logout: 'வெளியேறு',
    assignedComplaints: 'ஒதுக்கப்பட்ட புகார்கள்',
    adminOfficerDir: 'அதிகாரிகள் பட்டியல்',
    citizenPortal: 'பொதுமக்கள் தளம்',
    statusUpdate: 'நிலை மாற்றம்',
    resolveComplaint: 'புகாரைத் தீர்க்கவும்',
    resolutionPhoto: 'தீர்வு புகைப்பட ஆதாரம்',
    resolutionNote: 'தீர்க்கப்பட்ட பணி விவரம்',
    assignOfficer: 'அதிகாரியை நியமி',
    newOfficer: 'புதிய அதிகாரி பதிவு',
    mapView: 'வரைபட பார்வை',
    listView: 'பட்டியல் பார்வை',
    priority: 'முன்னுரிமை',
    status: 'நிலை',
    category: 'வகை',
    actions: 'செயல்கள்',
    totalAssigned: 'மொத்தம் ஒதுக்கப்பட்டவை',
    inProgress: 'செயல்பாட்டில்',
    pendingOpen: 'நிலுவையில் உள்ளவை',
    resolvedTotal: 'தீர்க்கப்பட்டவை',
  },
};

const LanguageContext = createContext(null);

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    try {
      return localStorage.getItem('civicpulse_language') || 'en';
    } catch {
      return 'en';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('civicpulse_language', language);
    } catch {
      // Storage error ignored
    }
  }, [language]);

  const t = (key, fallback = '') => {
    const langDict = translations[language] || translations.en;
    if (langDict[key] !== undefined) {
      return langDict[key];
    }
    const fallbackDict = translations.en;
    return fallbackDict[key] !== undefined ? fallbackDict[key] : fallback || key;
  };

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === 'en' ? 'ta' : 'en'));
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export default LanguageContext;

