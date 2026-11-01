# CIVICPULSE AI — FINAL PROJECT REPORT

**Project Title:** CivicPulse AI — AI-Powered Smart Civic Complaint, Public Safety & Emergency Response Platform  
**Team:** Alronclad  
**Institution:** KSR Institute of Engineering and Technology (KSRIET)  
**Hackathon:** ARSW001  

---

## 1. Executive Summary

**CivicPulse AI** is an end-to-end bilingual (Tamil & English) smart municipal governance and emergency response platform built for Tamil Nadu. It unifies **Citizen Grievance Reporting**, **Live Satellite GIS Tracking**, **Tamil/English Voice & Gemini AI Assistance**, **SOS Public Safety Emergency Dispatch**, **Field Worker Repair Workflows**, and **Officer/Admin Command Consoles** on top of a single shared **FastAPI + SQLite** backend (`backend/civicpulse.db`).

---

## 2. Core Platform Pillars

### 2.1 Bilingual Tamil & English Voice & AI Triage
- Citizens can speak or type in **Tamil (`ta-IN`)**, **English (`en-IN`)**, or code-switched Tamil/English.
- Native Tamil Unicode script (`\u0B80`–`\u0BFF`) is strictly preserved end-to-end and never converted into Tanglish.
- **Gemini 2.5 Flash** (backed by a `< 10ms` deterministic bilingual keyword engine) classifies complaints into 6 municipal categories (`Pothole`, `Garbage`, `Water`, `Streetlight`, `Drainage`, `Other`), assigns department routing, and evaluates severity (`HIGH`, `MEDIUM`, `LOW`).

### 2.2 Haversine Geospatial Duplicate Detection & Live Satellite GIS
- Automatically detects duplicate complaints within **100 meters** (`haversine_distance <= 100.0m`) with token similarity `> 0.60`, linking them under a shared `DUP-XXXXXXXX` cluster while preserving every citizen's individual tracking ID (`CP-XXXXXXXX`).
- Interactive **Satellite + Street GIS Map** (`/gis` on Web, `CivicHubScreen` on Android) provides reverse geocoding (`/api/v1/gis/reverse-geocode`), radius-based nearby complaint search (`/api/v1/gis/nearby`), and Haversine road route & ETA estimation (`/api/v1/gis/route-estimate`).

### 2.3 SOS Emergency Response System
- Dedicated emergency channel (`/sos` on Web, `SOS & AI` tab on Android) with a mandatory confirmation gate (`confirmed: true`), 7 emergency categories, live GPS coordinates, optional evidence photo, trusted contacts, and direct `112` / `108` / `101` hotline integration.
- Restricted **SOS Emergency Command Center** (`/officer/emergency` on Web, Officer Console on Android) allows only authenticated `OFFICER` and `ADMIN` responders to acknowledge, dispatch, and resolve `SOS-XXXXXXXX` alerts.

### 2.4 4-Tier Role Workflow (`CITIZEN` $\rightarrow$ `ADMIN` $\rightarrow$ `OFFICER` $\rightarrow$ `WORKER`)
- **Admins (`ADMIN`)** oversee all municipal wards, manage personnel (`/officer/admin/officers`), and inspect hotspot analytics (`/officer/analytics`).
- **Officers (`OFFICER`)** manage department queues, dispatch **Field Workers (`WORKER`)** (`/api/v1/officer/complaints/{id}/assign-worker`), and close complaints with mandatory resolution proof photos (`<= 5 MB`) and notes.
- **Field Workers (`WORKER`)** view assigned field tasks (`/officer/worker`), calculate route distance & ETA, and upload before/after repair photos (`/api/v1/worker/complaints/{id}/progress`).
