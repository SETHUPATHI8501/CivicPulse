# CivicPulse AI

**Theme:** Our Town, Reimagined  
**Problem Statement:** ARSW001  
**Team:** Alronclad  
**Institution:** KSR Institute for Engineering and Technology  

---

## 1. Project Overview

CivicPulse AI is an AI-powered municipal grievance redressal and transparent governance platform. It empowers citizens to submit civic issues in Tamil or English via voice or text, automatically triages issues to appropriate municipal departments using AI, clusters duplicate complaints using geospatial algorithms, and gives municipal field officers a secure workflow to manage, inspect, and resolve civic grievances with photographic proof.

### Core Architecture & Tech Stack
- **Frontend:** React 18, Vite 6, Tailwind CSS, Lucide React, Leaflet & React-Leaflet
- **Backend:** Python 3.12, FastAPI, Uvicorn, SQLAlchemy 2.0
- **Database:** SQLite (local development / hackathon demo)
- **AI Classification:** Google Gemini API with robust rule-based Tamil/English fallback classifier
- **Geospatial & Duplicates:** Haversine distance formula & Jaccard token similarity clustering
- **Authentication:** JWT (HMAC-SHA256) bearer token with role-based access control (`ADMIN` and `OFFICER`)

---

## 2. Quick Start for Hackathon Judging & Development

### A. Backend Setup

1. **Navigate to the backend directory:**
   ```bash
   cd CivicPulse-AI/backend
   ```

2. **Create and activate a Python virtual environment:**
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On Linux / macOS:
   source venv/bin/activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Start the FastAPI backend server:**
   ```bash
   uvicorn main:app --host 127.0.0.1 --port 8000 --reload
   ```
   - Swagger Interactive API Documentation: [http://localhost:8000/docs](http://localhost:8000/docs)
   - API Health Check: [http://localhost:8000/health](http://localhost:8000/health)

---

### B. Frontend Setup

1. **Navigate to the frontend directory:**
   ```bash
   cd CivicPulse-AI/frontend
   ```

2. **Install frontend dependencies:**
   ```bash
   npm install
   ```

3. **Start the Vite development server:**
   ```bash
   npm run dev
   ```
   - Citizen Portal: [http://localhost:5173/](http://localhost:5173/)
   - Officer & Admin Portal: [http://localhost:5173/officer/login](http://localhost:5173/officer/login)

4. **Production Build & Preview:**
   ```bash
   npm run build
   npm run preview
   ```

---

## 3. Demo Credentials

| Role | Official Email | Password | Department | Access Level |
|---|---|---|---|---|
| **Administrator** | `admin@civicpulse.gov` | `AdminPassword2026!` | Administration | Full municipal supervision, assign complaints, officer directory |
| **Field Officer** | `anitha.roads@civicpulse.gov` | `AnithaSecurePass2026!` | Roads / Public Works | Assigned complaints queue, lifecycle transitions, resolve with photo |

*Note: In development mode, the login page features quick-login helper buttons for instant judge evaluation.*

---

## 4. Live Hackathon Demo Walkthrough (Repeatable Script)

To run the automated end-to-end demo walkthrough:
```bash
cd CivicPulse-AI/backend
python demo_walkthrough.py
```

### Manual Demo Steps:
1. **Citizen Submission (Tamil/English)**:
   - Visit `http://localhost:5173/report`.
   - Toggle language to Tamil (தமிழ்).
   - Submit text: `"காவேரி நகர் மெயின் ரோட்டில் மிகப்பெரிய ஆபத்தான தார் சாலை பள்ளம் ஏற்பட்டுள்ளது."`
   - System displays GPS coordinates and issues a unique tracking ID (e.g., `CP-5E9BA7AC`).
2. **AI Triage & Classification**:
   - Issue is classified as `Pothole`, priority `HIGH`, routed to `Roads / Public Works`.
3. **Admin Assignment**:
   - Log in at `/officer/login` as `admin@civicpulse.gov`.
   - Navigate to `/officer/dashboard`, find the complaint, click **Assign**, and select Officer Anitha.
4. **Officer Field Action**:
   - Log in as `anitha.roads@civicpulse.gov`.
   - Update complaint status to `IN_PROGRESS` with operational notes.
5. **Photo Resolution Proof**:
   - Click **Resolve Issue**, select a proof-of-work JPEG/PNG photo, and enter the resolution note.
   - Status transitions to `RESOLVED`.
6. **Citizen Verification**:
   - Visit `http://localhost:5173/track` and enter the tracking ID.
   - Citizen sees `RESOLVED` status badge, field resolution photo, officer note, and complete audit timeline.

---

## 5. Automated Testing Suite

Execute the full backend test suite:
```bash
cd CivicPulse-AI/backend
python -m pytest tests/ -v
```
*(All 56 tests pass across duplicate detection, officer management, API schemas, and full-lifecycle integration).*

Execute frontend build verification:
```bash
cd CivicPulse-AI/frontend
npm run build
```
*(Zero compilation errors; route-level code-splitting with vendor chunks).*

---

## 6. Database Backup & Restore

A thread-safe online backup procedure is provided:
```bash
cd CivicPulse-AI/backend
python backup_db.py
```
Backups are saved to `backend/backups/civicpulse_backup_<timestamp>.db` and automatically verified for relational integrity.
