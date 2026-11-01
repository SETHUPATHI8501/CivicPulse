# CIVICPULSE AI — SOS EMERGENCY RESPONSE SYSTEM REPORT

**Project:** CivicPulse AI  
**Module:** Public Safety & SOS Emergency Response System (`/api/v1/sos`)  

---

## 1. Overview & Safety Architecture

The **CivicPulse AI SOS Emergency Response System** enables citizens facing urgent civic or public safety hazards to transmit high-priority, GPS-pinned emergency alerts directly to the Municipal Emergency Control Room while providing immediate access to India's official emergency hotlines (`112`, `108`, `101`).

### Key Safety Guardrails
1. **Mandatory Confirmation Gate (`confirmed: true`)**:
   - Both the backend API (`POST /api/v1/sos`) and the Web/Mobile UIs enforce an explicit confirmation gate (`400 Bad Request` if `confirmed=False`) to prevent accidental pocket-dials or unintended activations.
2. **Official Emergency Hotline Disclaimer**:
   - Every SOS screen clearly displays direct-dial links for **112 (All-in-One Police/Emergency)**, **108 (Medical Ambulance)**, and **101 (Fire & Rescue)**, stating that CivicPulse AI augments municipal response and does not replace national emergency dispatch.
3. **Strict Privacy & Role-Based Authorization**:
   - Citizens can track or cancel their own SOS alert using their unique `SOS-XXXXXXXX` token (`GET /api/v1/sos/track/{sos_id}`).
   - Listing all SOS alerts (`GET /api/v1/sos`) and updating responder status (`PATCH /api/v1/sos/{id}/status`) are strictly restricted to authenticated **Officers (`OFFICER`)** and **Administrators (`ADMIN`)**. Unauthenticated users receive `401 Unauthorized`, and `WORKER` accounts receive `403 Forbidden`.

---

## 2. Supported Emergency Categories & Auto-Routing

| Emergency Type | Routed Municipal Department | Default Priority |
| :--- | :--- | :--- |
| `Women Safety` | Public Safety / Police Liaison | `HIGH` |
| `Medical Emergency` | Emergency Medical / 108 Liaison | `HIGH` |
| `Fire Hazard` | Fire & Rescue Services | `HIGH` |
| `Flood / Disaster` | Disaster Management / Flood Control | `HIGH` |
| `Road Accident` | Roads / Public Works | `HIGH` |
| `Electrical Hazard` | Electricity / Streetlights | `HIGH` |
| `Public Safety Hazard` | Municipal Emergency Control Room | `HIGH` |

When an SOS alert is created, the backend automatically:
1. Reverse-geocodes the GPS coordinates (`latitude`, `longitude`) into a human-readable Tamil Nadu municipal address (`address_text`).
2. Assigns an available officer from the matching department (or defaults to the Municipal Administrator).
3. Creates an initial `SOS_TRIGGERED` audit log in `sos_logs`.
4. Broadcasts a `HIGH` severity notification to `OFFICER` and `ADMIN` consoles via `civic_notifications` and WebSocket (`/api/v1/ws/updates`).

---

## 3. SOS Lifecycle & Endpoints

### 3.1 Lifecycle States
- `ACTIVE`: Newly triggered by citizen; awaiting control room acknowledgment.
- `ACKNOWLEDGED`: Control room officer has verified the alert and initiated triage.
- `DISPATCHED`: Field response unit / emergency liaison has been dispatched to the GPS coordinates.
- `RESOLVED`: Emergency hazard mitigated and closed with responder notes.
- `CANCELLED`: Cancelled by citizen (false alarm / resolved on site) or control room.

### 3.2 API Reference

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/sos` | Public (Citizen) | Trigger an SOS alert (supports JSON or `multipart/form-data` with optional photo). Requires `confirmed=true`. |
| `GET` | `/api/v1/sos/track/{sos_id}` | Public (Token) | Retrieve real-time status and audit timeline for a specific `SOS-XXXXXXXX` ID. |
| `POST` | `/api/v1/sos/track/{sos_id}/cancel` | Public (Token) | Cancel an active SOS alert with an audit note. |
| `GET` | `/api/v1/sos` | `OFFICER`, `ADMIN` | List SOS emergency alerts with status filtering and active count summary. |
| `PATCH` | `/api/v1/sos/{alert_id}/status` | `OFFICER`, `ADMIN` | Update SOS status (`ACKNOWLEDGED`, `DISPATCHED`, `RESOLVED`, `CANCELLED`) and record audit log. |

