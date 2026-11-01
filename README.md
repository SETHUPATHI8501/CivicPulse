# CivicPulse AI — Smart Civic Complaint, Public Safety & Emergency Response Platform

**Team:** Alronclad   
**Hackathon Track:** ARSW001 — Smart Community & Municipal Governance  
**Core Product Vision:** *"Speak in Tamil. Pin the issue. AI triages it. Duplicates merge. Officers prove the fix."*

<img width="720" height="1600" alt="WhatsApp Image 2026-11-01 at 4 53 34 AM" src="https://github.com/user-attachments/assets/4e08d1f4-ba75-48f9-a055-1a8f1c8404fe" />

---

## 1. Platform Overview

**CivicPulse AI** is a unified, production-grade municipal intelligence, grievance redressal, and emergency response platform built for Tamil Nadu municipalities. It connects **Citizens**, **Field Workers (`WORKER`)**, **Department Officers (`OFFICER`)**, and **Municipal Administrators (`ADMIN`)** through a single shared **FastAPI + SQLite** backend (`backend/civicpulse.db`).

### Key Capabilities
1. **Bilingual Tamil & English Voice & Text Reporting**: Native Tamil Unicode (`\u0B80`–`\u0BFF`) preservation (never converting Tamil to Tanglish), Web Speech API (`ta-IN`/`en-IN`), Text-to-Speech (TTS) audio feedback, and voice command extraction (`/api/v1/voice/process`).
2. **Dual-Engine AI Triage (`Gemini 2.5 Flash` + Deterministic Fallback)**: Classifies complaints into 6 municipal categories (`Pothole`, `Garbage`, `Water`, `Streetlight`, `Drainage`, `Other`), maps departments, and assigns priority (`HIGH`, `MEDIUM`, `LOW`) within a strict 3-second budget.
3. **Geospatial Duplicate Detection**: Uses the Haversine formula (`<= 100m`) + token similarity (`> 0.60`) to cluster duplicate reports under `DUP-XXXXXXXX`.
4. **Live Satellite GIS & Route Intelligence**: Street + Esri World Imagery Satellite map layers, live GPS tracking, reverse geocoding (`/api/v1/gis/reverse-geocode`), radius-based nearby complaint search (`/api/v1/gis/nearby`), and Haversine route & ETA estimation (`/api/v1/gis/route-estimate`).
5. **SOS Emergency Response System**: Citizen SOS activation with mandatory safety confirmation gate, 7 emergency types, live GPS + photo evidence, `112`/`108`/`101` hotline integration, `SOS-XXXXXXXX` tracking, and a restricted Officer/Admin SOS Emergency Command Center (`/api/v1/sos`).
6. **Field Worker (`WORKER`) & Officer Proof-of-Work**: Officers dispatch field workers (`/api/v1/officer/complaints/{id}/assign-worker`), workers upload before/after repair photos (`/api/v1/worker/complaints/{id}/progress`), and officers upload mandatory resolution proof (`<= 5 MB`) to close tickets.
7. **Dedicated Gemini AI Civic Assistant**: Grounded in real SQLite telemetry (`/api/v1/ai/assistant`, `/api/v1/ai/intelligence-summary`) for Citizen, Worker, Officer, and Admin roles.

---

## 2. Repository Structure

```text
CivicPulse-AI/
├── backend/                  # FastAPI + SQLAlchemy 2.0 + SQLite shared backend
│   ├── api/                  # REST & WebSocket routers (auth, complaints, officer, analytics, advanced)
│   ├── services/             # AI classifier, fallback, duplicate detector, geo_utils, advanced_service
│   ├── schemas/              # Pydantic v2 request/response validation schemas
│   ├── tests/                # 77 automated pytest integration & unit tests
│   ├── uploads/              # Citizen, Worker, Resolution & SOS photo storage
│   ├── civicpulse.db         # Production SQLite database (92 complaints, 175 logs, 5 accounts)
│   └── main.py               # FastAPI application entrypoint
├── frontend/                 # React 19 + Vite 6 + Tailwind CSS v4 + React-Leaflet Web App
│   └── src/
│       ├── pages/            # Home, ReportComplaint, TrackComplaint, CitizenCivicHub,
│       │                     # OfficerLogin, OfficerDashboard, WorkerPortal, HeatmapAnalytics, AdminOfficers
│       └── services/         # Axios API clients (complaintService, officerService, advancedService)
├── mobile/                   # React Native 0.76.9 + Expo SDK 52 Android Application (gov.civicpulse.ai)
│   └── src/
│       ├── screens/          # CitizenDashboard, ReportComplaint, TrackComplaint, CivicHubScreen,
│       │                     # OfficerLogin, OfficerDashboard, OfficerComplaintDetail, AdminAnalytics, Settings
│       └── services/         # Mobile Axios clients + SecureStore JWT management
├── ADVANCED_FEATURES_REPORT.md
├── SOS_MODULE_REPORT.md
├── VOICE_AI_REPORT.md
├── GIS_TRACKING_REPORT.md
├── SYSTEM_ARCHITECTURE.md
├── API_DOCUMENTATION.md
├── TEST_REPORT.md
├── FINAL_PROJECT_REPORT.md
└── FINAL_HACKATHON_READINESS_REPORT.md
```

---

## 3. Quick Start Guide

### 3.1 Start the FastAPI Backend (`Port 8000`)
```powershell
cd backend
.\venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000
```
- Swagger API Docs: `http://localhost:8000/docs`
- Health Check: `http://localhost:8000/health`

### 3.2 Start the React Web Application (`Port 5173`)
```powershell
cd frontend
npm run dev
```
- Citizen Portal: `http://localhost:5173`
- Live Satellite GIS, Voice AI & SOS Hub: `http://localhost:5173/gis`, `/assistant`, `/sos`
- Officer / Worker / Admin Portal: `http://localhost:5173/officer/login`

### 3.3 Run the Android Mobile Application (`Expo SDK 52`)
- **Installable EAS Cloud APK (Build `a073ea3a-ecbf-407e-b6c2-559b6a562933`)**:
  `https://expo.dev/artifacts/eas/J5GBrCCwLfd-liIobmKK42LSoraHlg0qkwc91glvCoc.apk`
- Or start Metro locally:
```powershell
cd mobile
npx expo start
```

---

## 4. Demo Accounts (Shared Across Web & Android)

| Role | Email | Password | Department |
| :--- | :--- | :--- | :--- |
| **Officer (`OFFICER`)** | `anitha.roads@civicpulse.gov` | `AnithaSecurePass2026!` | Roads / Public Works |
| **Officer (`OFFICER`)** | `karthik.sanitation@civicpulse.gov` | `KarthikSecurePass2026!` | Sanitation |
| **Officer (`OFFICER`)** | `meena.water@civicpulse.gov` | `MeenaSecurePass2026!` | Water Supply |
| **Field Worker (`WORKER`)** | `raju.worker@civicpulse.gov` | `RajuWorkerPass2026!` | Roads / Public Works |
