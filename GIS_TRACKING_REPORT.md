# CIVICPULSE AI — LIVE SATELLITE GIS & GEOSPATIAL TRACKING REPORT

**Project:** CivicPulse AI  
**Module:** Live Satellite GIS, Reverse Geocoding, Nearby Search & Route Estimation (`/api/v1/gis/*`)  

---

## 1. Overview

The **CivicPulse AI Live GIS Module** provides interactive geospatial visualization, satellite/street basemap switching, reverse geocoding, radius-based complaint discovery, and Haversine route & ETA estimation across Web and Android.

---

## 2. Basemap Layers & Interactive Map (`CitizenCivicHub.jsx`)

The Web GIS Hub (`/gis`) upgrades the Leaflet map with multi-layer tile switching:
1. **Street Map Layer (`street`)**: OpenStreetMap high-contrast municipal street vector tiles (`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`).
2. **Satellite Imagery Layer (`satellite`)**: Esri World Imagery high-resolution aerial/satellite tiles (`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`).
3. **Interactive Overlays**:
   - **Live Citizen/Officer GPS Marker**: Displays current GPS position with accuracy radius (`±m`).
   - **Configurable Search Radius Circle**: Visualizes `200m`, `500m`, `1 km`, `2 km`, or `5 km` search boundary.
   - **Priority-Coded Complaint Pins**: Color-coded markers (`HIGH` Red, `MEDIUM` Amber, `LOW` Green, `RESOLVED` Teal) with rich popups.
   - **Route Vector Polyline**: Dashed navigation line connecting the user's GPS coordinate to any selected complaint with live distance and ETA.

---

## 3. Geospatial Backend Endpoints

### 3.1 Reverse Geocoding (`GET /api/v1/gis/reverse-geocode`)
- Resolves `(latitude, longitude)` into structured municipal location metadata:
  - `formatted_address`
  - `ward`
  - `city` / `district` / `state` (`Tamil Nadu`)
  - `source` (`nominatim` or `tamilnadu_gis_index`)
- Includes a built-in **16-city Tamil Nadu Municipal Hub Index** (Chennai, Coimbatore, Madurai, Tiruchirappalli, Salem, Tirunelveli, Erode, Vellore, Thoothukudi, Dindigul, Thanjavur, Hosur, Nagercoil, Avadi, Tiruppur, Karur) that guarantees instant sub-millisecond ward & landmark resolution even when offline (`DISABLE_ONLINE_GEOCODING=1`).

### 3.2 Nearby Complaints Discovery (`GET /api/v1/gis/nearby`)
- Uses exact Haversine great-circle distance (`services/geo_utils.py`) to filter and rank all complaints within `radius_m` (`50m` to `50,000m`) of `(latitude, longitude)`.
- Supports optional `category` and `status` filters and returns each complaint enriched with `distance_m`, sorted nearest-first.

### 3.3 Route & ETA Estimation (`GET /api/v1/gis/route-estimate`)
- Calculates:
  - `straight_line_m`: Exact Haversine distance in meters.
  - `distance_m` & `distance_km`: Estimated urban road distance (`1.28x` municipal road winding factor).
  - `bearing_degrees` & `compass_direction`: 8-point compass bearing (`N`, `NE`, `E`, `SE`, `S`, `SW`, `W`, `NW`).
  - `estimated_minutes`: Travel time estimate for `driving` (`28 km/h` urban average), `two_wheeler` (`32 km/h`), or `walking` (`4.8 km/h`).

