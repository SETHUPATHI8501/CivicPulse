# CIVICPULSE AI — UNIFIED CASE ID GENERATION & REAL-TIME SYNCHRONIZATION REPORT

**Project:** CivicPulse AI  
**Team:** Alronclad — KSR Institute of Engineering and Technology (KSRIET)  
**Date:** 2026-11-01  
**Golden Rule Enforced:** `ONE COMPLAINT = ONE CASE ID = ONE SHARED BACKEND RECORD`

---

## 1. Executive Summary

A complete **Unified Case ID Generation and Real-Time Synchronization System** has been implemented across the shared FastAPI backend (`backend/`), React 19 Web Application (`frontend/`), and React Native + Expo SDK 52 Android Application (`mobile/`).

- **Sequential Municipal Case IDs (`CP-YEAR-SEQUENTIAL_NUMBER`):** Every citizen complaint submitted via Android or Web is assigned an atomic, backend-generated Case ID (`CP-2026-00001`, `CP-2026-00002`, ..., `CP-2026-00093`, `CP-2026-00094`, ...).
- **Separate Emergency SOS Identifiers (`SOS-YEAR-SEQUENTIAL_NUMBER`):** Emergency SOS incidents use a dedicated `SOS` sequence (`SOS-2026-00001`, `SOS-2026-00002`, ...) so SOS alerts never collide with or advance ordinary `CP-` complaint Case IDs.
- **Zero Data Loss & Full Backward Compatibility:** All `92` existing complaints in `backend/civicpulse.db` retain their original `id` and `tracking_id` values (`CP-6D07D491` .. `CP-77B36589`) while also receiving backfilled sequential `case_id` values (`CP-2026-00001` .. `CP-2026-00093`). Both `case_id` and `tracking_id` resolve to the exact same record.
- **Real-Time Synchronization (`WS /api/v1/ws/updates` + Polling Fallback):** Complaints submitted on Mobile appear immediately in Web Officer/Admin/Citizen dashboards, and status updates or resolutions submitted on Web appear immediately in the Mobile application.

---

## 2. Database & Backend Architecture

### 2.1 Atomic Sequence Table (`case_sequences`)
- **Table:** `case_sequences (prefix VARCHAR(16), year INTEGER, current_val INTEGER, PRIMARY KEY (prefix, year))`
- **Generator (`generate_unique_case_id` in `backend/services/complaint_service.py`):**
  - Uses an in-process thread lock (`_CASE_ID_LOCK`) combined with an atomic SQLite `INSERT ... ON CONFLICT(prefix, year) DO UPDATE SET current_val = current_val + 1` statement and uniqueness verification against `complaints` / `sos_alerts`.
  - Prevents duplicate Case IDs even under simultaneous multi-client (`ThreadPoolExecutor`) submissions.
- **Idempotency Protection (`idempotency_key` / `X-Idempotency-Key`):**
  - Both `POST /api/v1/complaints` and `POST /api/v1/complaints/with-photo` accept `idempotency_key` (in body or `X-Idempotency-Key` header). Repeated requests or network retries with the same key return the existing complaint record and Case ID without advancing the sequence.

### 2.2 Complaint Privacy & Access Control (`is_private` & `citizen_token`)
- Private complaints (`is_private = True`) generate a `citizen_token` returned upon creation.
- Unauthorized users or unassigned officers attempting to access a private complaint without `X-Citizen-Token` or `ADMIN` / assigned `OFFICER` / assigned `WORKER` JWT credentials receive `403 Forbidden`.

---

## 3. Cross-Platform UI Synchronization (`frontend/` & `mobile/`)

| Module | Web Application (`frontend/`) | Android Mobile Application (`mobile/`) |
| :--- | :--- | :--- |
| **Reusable Case ID Component** | `frontend/src/components/CaseIdBadge.jsx` (Banner & Inline modes, Copy, Share, Track link, Bilingual Tamil/English text) | `mobile/src/components/CaseIdCard.js` (Selectable Case ID, Copy, Native `Share.share`, Track & View Details actions) |
| **Citizen Submission Confirmation** | `ReportComplaint.jsx` displays `CP-2026-XXXXX`, bilingual note (`வழக்கு எண்: ...`), AI triage, duplicate group, GPS, and Copy/Share/Track buttons | `ReportComplaintScreen.js` displays `CaseIdCard` with `CP-2026-XXXXX`, AI triage, duplicate warning, GPS, and 4 action buttons |
| **Citizen Tracking & History** | `TrackComplaint.jsx` supports `/track/CP-2026-00093` and `?id=CP-2026-00093`, recent Case ID chips (`localStorage`), and live WebSocket updates | `TrackComplaintScreen.js` supports `CP-2026-00093`, recent Case ID pills (`AsyncStorage`), and live WebSocket updates |
| **Officer, Worker & Admin Dashboards** | `OfficerDashboard.jsx`, `ComplaintDetails.jsx`, `WorkerPortal.jsx`, `ComplaintMap.jsx` display `case_id`, search by `case_id`, and auto-sync via `connectLiveUpdates` | `OfficerDashboardScreen.js`, `OfficerComplaintDetailScreen.js`, `CivicHubScreen.js` display `case_id`, filter by `case_id`, and auto-sync via `connectLiveUpdates` |

---

## 4. Automated Test & Build Verification

- **Backend Automated Test Suite (`pytest`):** **`90 passed, 0 failed`** (`8.51s`), including all `13` new tests in `backend/tests/test_case_id_synchronization.py`.
- **React Web Production Build (`npm run build`):** **`PASS`** (`1725 modules transformed`, `0` errors).
- **Android Expo Production Bundle (`npx expo export --platform android`):** **`PASS`** (`2452 modules`, `0` errors).
- **SQLite Integrity & Record Preservation:** `PRAGMA integrity_check = ok`, `92` complaints preserved, `case_sequences = [('CP', 2026, 93), ('SOS', 2026, 0)]`.

