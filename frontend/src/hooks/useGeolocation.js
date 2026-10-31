import { useState, useCallback } from 'react';

const DEFAULT_LAT = parseFloat(import.meta.env.VITE_DEFAULT_MAP_LAT || '11.3410');
const DEFAULT_LNG = parseFloat(import.meta.env.VITE_DEFAULT_MAP_LNG || '77.7172');

export default function useGeolocation() {
  const [coordinates, setCoordinates] = useState({
    lat: DEFAULT_LAT,
    lng: DEFAULT_LNG,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [accuracy, setAccuracy] = useState(null);

  const getCoordinates = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoordinates({
          lat: parseFloat(position.coords.latitude.toFixed(6)),
          lng: parseFloat(position.coords.longitude.toFixed(6)),
        });
        setAccuracy(position.coords.accuracy);
        setLoading(false);
      },
      (err) => {
        let msg = 'Unable to retrieve location coordinates.';
        switch (err.code) {
          case err.PERMISSION_DENIED:
            msg = 'Location permission was denied. You can select your location on the map manually.';
            break;
          case err.POSITION_UNAVAILABLE:
            msg = 'Location information is currently unavailable.';
            break;
          case err.TIMEOUT:
            msg = 'Location request timed out. Please try again or use the map.';
            break;
        }
        setError(msg);
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  }, []);

  return {
    coordinates,
    setCoordinates,
    loading,
    error,
    accuracy,
    getCoordinates,
  };
}

