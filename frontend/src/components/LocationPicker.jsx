import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation, Crosshair } from 'lucide-react';
import Button from './Button';
import Spinner from './Spinner';

// Custom crisp vector pin icon
const createMapPin = () =>
  L.divIcon({
    className: 'custom-civic-pin',
    html: `
      <div style="
        background: #0d9488;
        width: 30px;
        height: 30px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 2.5px solid #ffffff;
        box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="width: 8px; height: 8px; background: #ffffff; border-radius: 50%;"></div>
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30],
  });

// Subcomponent to recenter map view when coordinates change
function MapRecenter({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && !isNaN(center[0]) && !isNaN(center[1])) {
      map.setView(center, map.getZoom(), { animate: true });
    }
  }, [center, map]);
  return null;
}

// Subcomponent to handle map clicks
function MapClickHandler({ onSelectLocation }) {
  useMapEvents({
    click(e) {
      onSelectLocation(
        parseFloat(e.latlng.lat.toFixed(6)),
        parseFloat(e.latlng.lng.toFixed(6))
      );
    },
  });
  return null;
}

export default function LocationPicker({
  latitude,
  longitude,
  onChange,
  onDetectGPS,
  isDetectingGPS = false,
  gpsError = null,
  className = '',
}) {
  const customPin = useMemo(() => createMapPin(), []);
  const center = useMemo(() => [latitude, longitude], [latitude, longitude]);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Location controls bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center flex-shrink-0">
            <MapPin className="w-4 h-4 text-teal-700" />
          </div>
          <div className="text-xs">
            <span className="font-semibold text-slate-800 block">Selected GPS Coordinates:</span>
            <span className="font-mono text-slate-600">
              {latitude?.toFixed(6) || '—'}, {longitude?.toFixed(6) || '—'}
            </span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          icon={Navigation}
          onClick={onDetectGPS}
          disabled={isDetectingGPS}
          className="border-teal-300 text-teal-800 hover:bg-teal-50"
        >
          {isDetectingGPS ? 'Detecting GPS...' : 'Use My GPS Location'}
        </Button>
      </div>

      {gpsError && (
        <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
          {gpsError}
        </p>
      )}

      {/* Interactive Map */}
      <div className="relative rounded-xl overflow-hidden border border-slate-300 shadow-inner h-[260px] sm:h-[320px] z-0">
        <MapContainer
          center={center}
          zoom={14}
          scrollWheelZoom={false}
          className="w-full h-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={center} icon={customPin} />
          <MapRecenter center={center} />
          <MapClickHandler onSelectLocation={onChange} />
        </MapContainer>

        {/* Tip overlay */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 sm:right-auto bg-white/95 backdrop-blur-xs text-[11px] text-slate-700 py-1.5 px-3 rounded-md shadow-md border border-slate-200 pointer-events-none flex items-center gap-1.5 z-[1000]">
          <Crosshair className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" />
          <span>Click anywhere on the map to fine-tune issue location.</span>
        </div>
      </div>
    </div>
  );
}

