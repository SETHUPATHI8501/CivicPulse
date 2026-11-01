import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Circle, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Flame,
  AlertTriangle,
  MapPin,
  RefreshCw,
  Globe,
  Layers,
  ShieldAlert,
  BarChart3,
} from 'lucide-react';
import OfficerLayout from '../layouts/OfficerLayout';
import Button from '../components/Button';
import Spinner from '../components/Spinner';
import ErrorState from '../components/ErrorState';
import { getAnalyticsSummary, getHotspots } from '../services/officerService';
import { useLanguage } from '../context/LanguageContext';

const INTENSITY_STYLES = {
  HIGH: { color: '#ef4444', fillColor: '#ef4444', badge: 'bg-rose-100 text-rose-800 border-rose-200' },
  MEDIUM: { color: '#f59e0b', fillColor: '#f59e0b', badge: 'bg-amber-100 text-amber-800 border-amber-200' },
  LOW: { color: '#14b8a6', fillColor: '#14b8a6', badge: 'bg-teal-100 text-teal-800 border-teal-200' },
};

function FitHotspotBounds({ hotspots }) {
  const map = useMap();

  useEffect(() => {
    const valid = (hotspots || [])
      .filter((h) => h.center_latitude != null && h.center_longitude != null)
      .map((h) => [Number(h.center_latitude), Number(h.center_longitude)]);

    if (valid.length === 1) {
      map.setView(valid[0], 14, { animate: true });
    } else if (valid.length > 1) {
      const bounds = L.latLngBounds(valid);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15, animate: true });
    }
  }, [hotspots, map]);

  return null;
}

export default function HeatmapAnalytics() {
  const { language } = useLanguage();

  const [gridSize, setGridSize] = useState(500);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [intensityFilter, setIntensityFilter] = useState('');
  const [mapStyle, setMapStyle] = useState('satellite');

  const [summary, setSummary] = useState(null);
  const [hotspots, setHotspots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { grid_size: gridSize };
      if (categoryFilter) params.category = categoryFilter;
      if (intensityFilter) params.intensity = intensityFilter;

      const [sumRes, hotRes] = await Promise.all([
        getAnalyticsSummary(params),
        getHotspots(params),
      ]);
      setSummary(sumRes);
      setHotspots(hotRes?.hotspots || []);
    } catch (err) {
      setError(err.userMessage || 'Failed to load spatial hotspot intelligence.');
    } finally {
      setLoading(false);
    }
  }, [gridSize, categoryFilter, intensityFilter]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const defaultCenter = [11.35, 77.89];

  return (
    <OfficerLayout>
      <div className="space-y-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-teal-700 bg-teal-50 border border-teal-200 px-3 py-1 rounded-full mb-2">
              <Flame className="w-3.5 h-3.5 text-teal-600" />
              <span>GIS Spatial Intelligence</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-950 tracking-tight">
              {language === 'ta' ? 'புகார் அடர்த்தி & ஹாட்ஸ்பாட் பகுப்பாய்வு' : 'Hotspot Analytics & Satellite GIS'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Meter-scale spatial clustering identifying high-density civic grievance zones across Tamil Nadu wards.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={gridSize}
              onChange={(e) => setGridSize(Number(e.target.value))}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:border-teal-600 focus:outline-none"
            >
              <option value={250}>Grid: 250m (Fine)</option>
              <option value={500}>Grid: 500m (Standard)</option>
              <option value={1000}>Grid: 1000m (District)</option>
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:border-teal-600 focus:outline-none"
            >
              <option value="">All Categories</option>
              <option value="Pothole">Pothole</option>
              <option value="Garbage">Garbage</option>
              <option value="Water">Water</option>
              <option value="Streetlight">Streetlight</option>
              <option value="Drainage">Drainage</option>
              <option value="Other">Other</option>
            </select>

            <select
              value={intensityFilter}
              onChange={(e) => setIntensityFilter(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:border-teal-600 focus:outline-none"
            >
              <option value="">All Intensities</option>
              <option value="HIGH">High Intensity</option>
              <option value="MEDIUM">Medium Intensity</option>
              <option value="LOW">Low Intensity</option>
            </select>

            <Button
              variant="outline"
              size="sm"
              icon={RefreshCw}
              onClick={fetchAnalytics}
              isLoading={loading}
            >
              Refresh
            </Button>
          </div>
        </div>

        {error ? (
          <ErrorState message={error} onRetry={fetchAnalytics} />
        ) : loading && !summary ? (
          <div className="py-20 flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-200">
            <Spinner size="lg" color="teal" className="mb-3" />
            <p className="text-xs font-semibold text-slate-500">Computing spatial hotspot clusters...</p>
          </div>
        ) : (
          <>
            {/* Summary KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-card border-t-4 border-t-navy-900">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase mb-2">
                  <span>Detected Hotspots</span>
                  <Layers className="w-4 h-4 text-navy-900" />
                </div>
                <p className="text-3xl font-black text-navy-950">{summary?.total_hotspots ?? 0}</p>
                <p className="text-xs text-slate-400 mt-1">
                  Across {summary?.total_complaints_in_hotspots ?? 0} clustered complaints
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-card border-t-4 border-t-rose-500">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase mb-2">
                  <span>High-Priority Zones</span>
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                </div>
                <p className="text-3xl font-black text-rose-600">
                  {summary?.high_intensity_count ?? 0}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Med: {summary?.medium_intensity_count ?? 0} • Low: {summary?.low_intensity_count ?? 0}
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-card border-t-4 border-t-teal-500">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase mb-2">
                  <span>Dominant Category</span>
                  <BarChart3 className="w-4 h-4 text-teal-600" />
                </div>
                <p className="text-2xl font-black text-teal-700 truncate">
                  {summary?.most_affected_category || 'None'}
                </p>
                <p className="text-xs text-slate-400 mt-1">Primary driver of spatial clusters</p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-card border-t-4 border-t-amber-500">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase mb-2">
                  <span>Highest Risk Centroid</span>
                  <MapPin className="w-4 h-4 text-amber-600" />
                </div>
                <p className="text-lg font-black text-slate-800 font-mono truncate">
                  {summary?.highest_risk_area?.area_label || 'N/A'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {summary?.highest_risk_area
                    ? `Severity Score: ${summary.highest_risk_area.severity_score}`
                    : 'No active risk zones'}
                </p>
              </div>
            </div>

            {/* Interactive Satellite Hotspot Map */}
            <div className="relative w-full h-[500px] rounded-2xl overflow-hidden border border-slate-200 shadow-card bg-slate-900">
              <MapContainer
                center={defaultCenter}
                zoom={13}
                scrollWheelZoom={true}
                className="w-full h-full z-0"
              >
                {mapStyle === 'satellite' ? (
                  <TileLayer
                    key="satellite"
                    attribution="Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics"
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  />
                ) : (
                  <TileLayer
                    key="street"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                )}

                <FitHotspotBounds hotspots={hotspots} />

                {hotspots.map((spot) => {
                  const style = INTENSITY_STYLES[spot.intensity] || INTENSITY_STYLES.LOW;
                  return (
                    <Circle
                      key={spot.cluster_id}
                      center={[Number(spot.center_latitude), Number(spot.center_longitude)]}
                      radius={Math.max(Number(spot.radius_meters) || 120, 120)}
                      pathOptions={{
                        color: style.color,
                        fillColor: style.fillColor,
                        fillOpacity: 0.38,
                        weight: 2,
                      }}
                    >
                      <Popup minWidth={240}>
                        <div className="p-1 space-y-2 text-xs">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                            <span className="font-mono font-bold text-navy-950">{spot.cluster_id}</span>
                            <span className={`px-2 py-0.5 rounded font-bold text-[10px] border ${style.badge}`}>
                              {spot.intensity} INTENSITY
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500">Dominant Issue:</span>{' '}
                            <span className="font-bold text-slate-900">{spot.dominant_category}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2 rounded border border-slate-100">
                            <div>
                              <span className="text-[10px] text-slate-400 block">Complaints</span>
                              <span className="font-bold text-slate-800">{spot.complaint_count}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block">Severity Score</span>
                              <span className="font-bold text-rose-600">{spot.severity_score}</span>
                            </div>
                          </div>
                          <div className="text-[11px] font-mono text-slate-500">
                            Centroid: {Number(spot.center_latitude).toFixed(4)}°N, {Number(spot.center_longitude).toFixed(4)}°E
                          </div>
                        </div>
                      </Popup>
                    </Circle>
                  );
                })}
              </MapContainer>

              {/* Layer Toggle */}
              <div className="absolute top-3 right-3 z-[1000] bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl p-1 shadow-md flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setMapStyle('satellite')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    mapStyle === 'satellite' ? 'bg-navy-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Satellite View</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMapStyle('street')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    mapStyle === 'street' ? 'bg-navy-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span>Street Map</span>
                </button>
              </div>
            </div>

            {/* Ranked Hotspot Clusters Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
              <div className="p-5 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-navy-950">Ranked Spatial Hotspot Clusters</h2>
                  <p className="text-xs text-slate-500">
                    Sorted by composite severity score (complaint volume × priority weight).
                  </p>
                </div>
                <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
                  {hotspots.length} zones
                </span>
              </div>

              {hotspots.length === 0 ? (
                <div className="p-10 text-center text-sm text-slate-500">
                  No spatial hotspot clusters matched the selected filter criteria.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-3 px-4">Cluster ID</th>
                        <th className="py-3 px-4">Intensity</th>
                        <th className="py-3 px-4">Dominant Category</th>
                        <th className="py-3 px-4">Complaints</th>
                        <th className="py-3 px-4">Severity Score</th>
                        <th className="py-3 px-4">Radius</th>
                        <th className="py-3 px-4">Coordinates</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      {hotspots.map((spot) => {
                        const style = INTENSITY_STYLES[spot.intensity] || INTENSITY_STYLES.LOW;
                        return (
                          <tr key={spot.cluster_id} className="hover:bg-slate-50/80">
                            <td className="py-3 px-4 font-mono font-bold text-navy-900">{spot.cluster_id}</td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${style.badge}`}>
                                {spot.intensity}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-semibold text-slate-800">{spot.dominant_category}</td>
                            <td className="py-3 px-4 font-bold text-slate-900">{spot.complaint_count}</td>
                            <td className="py-3 px-4 font-bold text-rose-600">{spot.severity_score}</td>
                            <td className="py-3 px-4 text-slate-600">{spot.radius_meters}m</td>
                            <td className="py-3 px-4 font-mono text-slate-500">
                              {Number(spot.center_latitude).toFixed(4)}°N, {Number(spot.center_longitude).toFixed(4)}°E
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </OfficerLayout>
  );
}

