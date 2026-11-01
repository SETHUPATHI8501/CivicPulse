# CIVICPULSE AI — COMPLETE API DOCUMENTATION

**Base URL (Local):** `http://localhost:8000/api/v1`  
**Base URL (LAN / Android Physical Device):** `http://<HOST_LAN_IP>:8000/api/v1`  
**Interactive OpenAPI / Swagger UI:** `http://localhost:8000/docs`

---

## 1. Health & Public Citizen Endpoints

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` or `/api/v1/health` | Public | Verifies FastAPI server and SQLite `SELECT 1` connectivity. |
| `GET` | `/api/v1/complaints/public-stats` | Public | Real-time KPI counts (`total_complaints`, `open_complaints`, `in_progress_complaints`, `resolved_complaints`, `high_priority_complaints`, `categories`). |
| `POST` | `/api/v1/complaints` | Public | Submit complaint via JSON or `multipart/form-data`. Automatically generates unified `case_id` (`CP-2026-XXXXX`), supports `X-Idempotency-Key`, and runs AI classification + Haversine duplicate detection. |
| `POST` | `/api/v1/complaints/with-photo` | Public | Submit complaint with multipart `photo` (`<= 5 MB`), optional `X-Idempotency-Key`, and unified `case_id` (`CP-2026-XXXXX`). |
| `GET` | `/api/v1/complaints` | Public | List complaints with pagination and optional `status`, `category`, and `case_id` (`CP-2026-XXXXX`) filters. |
| `GET` | `/api/v1/complaints/track/{case_or_tracking_id}` | Public | Track a complaint by unified `case_id` (`CP-2026-00093`) or legacy `tracking_id` (`CP-6D07D491`) with full `logs` timeline and resolution proof. |
| `GET` | `/api/v1/complaints/case/{case_id}` | Public | Direct Case ID lookup alias returning the full `ComplaintResponse` record. |

---

## 2. Authentication & Personnel Endpoints

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/token` | Public | Authenticate `ADMIN`, `OFFICER`, or `WORKER` (`email`, `password`) and return JWT `access_token` + `role`. |
| `GET` | `/api/v1/auth/me` | `WORKER` / `OFFICER` / `ADMIN` | Return profile of currently authenticated personnel. |
| `POST` | `/api/v1/officers` | `ADMIN` | Create a new `ADMIN`, `OFFICER`, or `WORKER` account. |
| `GET` | `/api/v1/officers` | `ADMIN` | List all municipal personnel with optional `department` filter. |

---

## 3. Officer, Field Worker & Resolution Endpoints

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/officer/complaints` | `OFFICER` / `ADMIN` | List complaints with optional `status`, `category`, and `case_id` search filter. |
| `GET` | `/api/v1/officer/complaints/{id}` | `OFFICER` / `ADMIN` | Retrieve detailed complaint record with unified `case_id` and audit logs. |
| `PATCH` | `/api/v1/officer/complaints/{id}/assign` | `ADMIN` | Assign complaint to a department officer and broadcast `OFFICER_ASSIGNED` with `case_id`. |
| `PATCH` | `/api/v1/officer/complaints/{id}/assign-worker` | `OFFICER` / `ADMIN` | Dispatch a field worker (`WORKER`) to a complaint and notify citizen with `case_id`. |
| `PATCH` | `/api/v1/officer/complaints/{id}/status` | `OFFICER` / `ADMIN` | Transition complaint status (`OPEN` $\rightarrow$ `IN_PROGRESS` / `NEEDS_INFO` / `REJECTED`) and broadcast `COMPLAINT_STATUS_UPDATED` with `case_id`. |
| `POST` | `/api/v1/officer/complaints/{id}/resolve` | `OFFICER` / `ADMIN` | Resolve an `IN_PROGRESS` complaint with mandatory `photo` (`<= 5 MB`) and `resolution_note`, broadcasting `COMPLAINT_RESOLVED` with `case_id`. |
| `GET` | `/api/v1/worker/complaints` | `WORKER` / `OFFICER` / `ADMIN` | Retrieve assigned field worker task queue with `case_id`. |
| `PATCH` or `POST` | `/api/v1/worker/complaints/{id}/progress` | `WORKER` / `OFFICER` / `ADMIN` | Upload field worker `before_photo`, `after_photo`, `work_status`, and `completion_note`. |

---

## 4. Live GIS, Voice AI, Gemini Assistant & SOS Emergency Endpoints

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/gis/reverse-geocode` | Public | Reverse geocode `(latitude, longitude, lang)` into a readable English or Tamil municipal address. |
| `GET` | `/api/v1/gis/nearby` | Public | Find complaints within `radius_km` / `radius_m` of `(latitude, longitude)` with unified `case_id`. |
| `GET` | `/api/v1/gis/route-estimate` | Public | Calculate straight-line distance, road distance, compass bearing, ETA minutes, and Google Maps route link. |
| `POST` | `/api/v1/voice/process` | Public | Process Tamil (`ta-IN`), English (`en-IN`), or mixed voice transcript while preserving Tamil Unicode script. |
| `POST` | `/api/v1/ai/assistant` | Public / Optional JWT | Role-aware (`CITIZEN`, `WORKER`, `OFFICER`, `ADMIN`) Gemini + Fallback Civic Assistant supporting `CP-2026-XXXXX` and `SOS-2026-XXXXX` lookups. |
| `GET` | `/api/v1/ai/intelligence-summary` | `OFFICER` / `ADMIN` | SLA overdue (`> 48h`), duplicate clusters, and bilingual executive intelligence summary. |
| `POST` | `/api/v1/sos` or `/api/v1/sos/with-photo` | Public | Trigger an SOS emergency alert with separate sequential `SOS-2026-XXXXX` Case ID, GPS coordinates, and optional photo. |
| `GET` | `/api/v1/sos/track/{tracking_id}` | Public | Track an SOS alert by its `SOS-2026-XXXXX` ID. |
| `POST` or `PATCH` | `/api/v1/sos/track/{tracking_id}/cancel` | Public | Cancel an SOS alert by its `SOS-2026-XXXXX` ID. |
| `GET` | `/api/v1/sos` | `OFFICER` / `ADMIN` | Restricted SOS Emergency Command feed for responders (`401`/`403` for public/workers). |
| `PATCH` | `/api/v1/sos/{sos_id}/status` | `OFFICER` / `ADMIN` | Update SOS alert status (`ACKNOWLEDGED`, `OFFICER_ASSIGNED`, `RESPONDING`, `RESOLVED`, `CANCELLED`). |
| `GET` | `/api/v1/notifications` | Public / Optional JWT | Poll real-time civic and SOS notifications (searchable by `case_id` or `tracking_id`). |
| `WS` | `/api/v1/ws/updates` | Public | Real-time WebSocket stream broadcasting `COMPLAINT_CREATED`, `OFFICER_ASSIGNED`, `COMPLAINT_STATUS_UPDATED`, `COMPLAINT_RESOLVED`, and `SOS_CREATED` events. |
