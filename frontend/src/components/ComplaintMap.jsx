import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Link } from 'react-router-dom';
import { ExternalLink, Layers, Globe } from 'lucide-react';
import StatusBadge from './StatusBadge';
import PriorityBadge from './PriorityBadge';
import { formatDate } from '../utils/formatDate';

// Status-specific pin colors
const statusColors = {
  OPEN: '#f59e0b', // amber
  IN_PROGRESS: '#0284c7', // sky
  RESOLVED: '#10b981', // emerald
  NEEDS_INFO: '#8b5cf6', // purple
  REJECTED: '#f43f5e', // rose
};

// Create SVG-based custom DivIcon for Leaflet
const createStatusPin = (status = 'OPEN', isSelected = false) => {
  const color = statusColors[status] || '#0d9488';
  const size = isSelected ? 36 : 28;
  const borderSize = isSelected ? 3 : 2;

  return L.divIcon({
    className: 'custom-status-pin',
    html: `
      <div style="
        background: ${color};
        width: ${size}px;
        height: ${size}px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: ${borderSize}px solid #ffffff;
        box-shadow: 0 4px 10px rgba(0,0,0,0.35);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: transform 0.15s ease;
      ">
        <div style="width: ${size / 3.5}px; height: ${size / 3.5}px; background: #ffffff; border-radius: 50%;"></div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
};

// Auto-fit bounds component
function FitBounds({ complaints }) {
  const map = useMap();

  useEffect(() => {
    const validCoords = complaints
      .filter((c) => c.latitude != null && c.longitude != null && !isNaN(c.latitude) && !isNaN(c.longitude))
      .map((c) => [Number(c.latitude), Number(c.longitude)]);

    if (validCoords.length === 1) {
      map.setView(validCoords[0], 15, { animate: true });
    } else if (validCoords.length > 1) {
      const bounds = L.latLngBounds(validCoords);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16, animate: true });
    }
  }, [complaints, map]);

  return null;
}

export default function ComplaintMap({
  complaints = [],
  selectedComplaintId = null,
  onSelectComplaint,
  height = '500px',
  className = '',
  defaultLayer = 'satellite',
}) {
  const [mapStyle, setMapStyle] = useState(defaultLayer); // 'satellite' | 'street'

  // Filter valid complaints with coordinates
  const mappedComplaints = useMemo(() => {
    return complaints.filter(
      (c) =>
        c.latitude != null &&
        c.longitude != null &&
        !isNaN(Number(c.latitude)) &&
        !isNaN(Number(c.longitude))
    );
  }, [complaints]);

  // Default center: Tiruchengode / Namakkal / Tamil Nadu
  const defaultCenter = [11.35, 77.89];

  return (
    <div
      className={`relative w-full rounded-2xl overflow-hidden border border-slate-200/90 shadow-card bg-slate-900 ${className}`}
      style={{ height }}
    >
      <MapContainer
        center={defaultCenter}
        zoom={13}
        scrollWheelZoom={true}
        className="w-full h-full z-0"
      >
        {mapStyle === 'satellite' ? (
          <TileLayer
            key="satellite"
            attribution="Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        ) : (
          <TileLayer
            key="street"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        )}

        <FitBounds complaints={mappedComplaints} />

        {mappedComplaints.map((c) => {
          const isSelected = selectedComplaintId === c.id;
          const pinIcon = createStatusPin(c.status, isSelected);

          return (
            <Marker
              key={c.id}
              position={[Number(c.latitude), Number(c.longitude)]}
              icon={pinIcon}
              eventHandlers={{
                click: () => {
                  if (onSelectComplaint) onSelectComplaint(c);
                },
              }}
            >
              <Popup className="civic-popup" minWidth={260} maxWidth={320}>
                <div className="p-1 space-y-2.5">
                  {/* Top Bar: Case ID & Badges */}
                  <div className="flex items-center justify-between gap-1 border-b border-slate-100 pb-2">
                    <span className="font-mono text-xs font-bold text-navy-950 bg-navy-50 px-2 py-0.5 rounded border border-navy-100">
                      {c.case_id || c.tracking_id || `CP-${c.id}`}
                    </span>
                    <div className="flex items-center gap-1">
                      <PriorityBadge priority={c.priority} size="sm" />
                      <StatusBadge status={c.status} size="sm" />
                    </div>
                  </div>

                  {/* Category & Department */}
                  <div className="text-xs">
                    <span className="font-bold text-slate-800">{c.category}</span>
                    <span className="text-slate-500 font-medium ml-1">• {c.department}</span>
                  </div>

                  {/* Citizen Text snippet */}
                  <p className="text-xs text-slate-700 line-clamp-2 leading-relaxed italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                    "{c.citizen_text}"
                  </p>

                  {/* Duplicate Alert Pill if applicable */}
                  {c.duplicate_group_id && (
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                      <Layers className="w-3 h-3 text-amber-600 flex-shrink-0" />
                      <span>Duplicate Group: {c.duplicate_group_id}</span>
                    </div>
                  )}

                  {/* Location & Date */}
                  <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1">
                    <span className="font-mono">
                      {Number(c.latitude).toFixed(4)}, {Number(c.longitude).toFixed(4)}
                    </span>
                    <span>{formatDate(c.created_at)}</span>
                  </div>

                  {/* Action Link */}
                  <div className="pt-1">
                    <Link
                      to={`/officer/complaints/${c.id}`}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-navy-900 hover:bg-navy-800 rounded-lg shadow-xs transition-colors"
                    >
                      <span>Manage Complaint</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Top-Right Satellite / Street Layer Switcher */}
      <div className="absolute top-3 right-3 z-[1000] bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl p-1 shadow-md flex items-center gap-1">
        <button
          type="button"
          onClick={() => setMapStyle('satellite')}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
            mapStyle === 'satellite'
              ? 'bg-navy-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Satellite</span>
        </button>
        <button
          type="button"
          onClick={() => setMapStyle('street')}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
            mapStyle === 'street'
              ? 'bg-navy-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span>Street Map</span>
        </button>
      </div>

      {/* Map Legend Overlay */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl p-2.5 shadow-md flex items-center gap-3 text-xs">
        <span className="font-bold text-slate-700 text-[11px] uppercase tracking-wider">Status:</span>
        <div className="flex items-center gap-1 text-[11px] text-slate-700">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
          <span>Open</span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-slate-700">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block" />
          <span>In Progress</span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-slate-700">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
          <span>Resolved</span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-slate-700">
          <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block" />
          <span>Needs Info</span>
        </div>
      </div>
    </div>
  );
}
