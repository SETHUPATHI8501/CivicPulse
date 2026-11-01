# CIVICPULSE AI — TAMIL & ENGLISH VOICE & GEMINI AI ASSISTANT REPORT

**Project:** CivicPulse AI  
**Module:** Bilingual Voice Command Triage (`/api/v1/voice/process`) & Gemini AI Civic Assistant (`/api/v1/ai/assistant`)  

---

## 1. Native Tamil Unicode Preservation Policy

A core architectural requirement of **CivicPulse AI** is authentic bilingual accessibility for citizens across Tamil Nadu:

1. **Strict Tamil Unicode Preservation (`\u0B80`–`\u0BFF`)**:
   - Tamil speech-to-text transcripts and text inputs are preserved in native Tamil script (e.g., `"எங்கள் பகுதியில் பெரிய சாலை குழி மற்றும் தண்ணீர் கசிவு உள்ளது"`).
   - The system **never** transliterates or degrades Tamil Unicode script into romanized "Tanglish".
2. **Language Detection (`detect_script_language`)**:
   - Automatically classifies input as:
     - `ta` (Tamil script only)
     - `en` (English Latin script only)
     - `mixed` (Code-switched Tamil + English, e.g., `"Karur bus stand அருகில் பெரிய சாலை குழி உள்ளது"`)

---

## 2. Voice Assistant Architecture (`POST /api/v1/voice/process`)

### 2.1 Speech-to-Text (STT) & Text-to-Speech (TTS)
- **Web (`frontend/src/pages/CitizenCivicHub.jsx`)**:
  - Uses browser `SpeechRecognition` / `webkitSpeechRecognition` with selectable `ta-IN` (Tamil - India) and `en-IN` (English - India) locales.
  - Speaks back AI responses aloud using `window.speechSynthesis` (`SpeechSynthesisUtterance`) matched to `ta-IN` or `en-IN` voices.
- **Android (`mobile/src/screens/CivicHubScreen.js`)**:
  - Supports native Android Tamil/English voice keyboard dictation and one-tap Tamil/English civic voice presets, sending the transcript to `/api/v1/voice/process`.

### 2.2 Voice Intent & Triage Extraction
When a transcript is submitted to `POST /api/v1/voice/process`, the backend returns:
- `preserved_transcript`: Exact Unicode-preserved text.
- `detected_language`: `ta` | `en` | `mixed`.
- `intent`:
  - `EMERGENCY_SOS` (triggers immediate SOS recommendation if fire/accident/electrocution/flood life-safety keywords are detected)
  - `TRACK_STATUS` (extracts `CP-XXXXXXXX` or `SOS-XXXXXXXX` tracking IDs)
  - `NEARBY_ISSUES` (queries nearby complaints around user's GPS)
  - `REPORT_COMPLAINT` (runs full AI classification to pre-fill category, department, and priority)
- `spoken_response`: Natural Tamil or English response suitable for TTS audio playback.

---

## 3. Gemini AI Civic Assistant (`POST /api/v1/ai/assistant`)

### 3.1 Real Database Grounding
Unlike generic chatbots, the CivicPulse AI Assistant queries `civicpulse.db` before generating a response:
1. **Municipal KPI Snapshot**: Total complaints, Open, In-Progress, Resolved, High-Priority, SLA overdue (`> 48h`), and active SOS counts.
2. **Specific Complaint Lookup**: Automatically detects `CP-XXXXXXXX` in the prompt or `tracking_id` parameter and injects the complaint's live status, category, department, priority, and resolution notes.
3. **Geospatial Context**: If `latitude` and `longitude` are provided, injects the count and top categories of complaints within `1,000m`.

### 3.2 3.5-Second Timeout & Deterministic Fallback
- When `GEMINI_API_KEY` is configured, the assistant queries `gemini-2.5-flash` via a thread-safe `3.5s` timeout budget.
- If the external API is unreachable or times out, the deterministic bilingual fallback engine immediately generates an accurate Tamil or English response grounded in the live SQLite database metrics (`ai_source: "fallback"`).

---

## 4. Officer & Admin Intelligence Summary (`GET /api/v1/ai/intelligence-summary`)

Provides municipal decision-makers with:
- **SLA Overdue Detection**: Counts and lists complaints open for more than 48 hours.
- **Duplicate Cluster Ranking**: Identifies top `DUP-*` geospatial clusters where multiple citizens reported the same defect.
- **Bilingual Executive Briefs**: Generates actionable Tamil (`executive_summary_ta`) and English (`executive_summary_en`) operational summaries.

