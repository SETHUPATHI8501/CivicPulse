import math
from typing import Dict, Tuple

EARTH_RADIUS_METERS = 6371000.0
METERS_PER_LAT_DEGREE = 111320.0


def is_valid_coordinate(latitude: float, longitude: float) -> bool:
    """
    Validate GPS coordinate bounds:
    - Latitude in [-90.0, 90.0]
    - Longitude in [-180.0, 180.0]
    - Rejects null island (0.0, 0.0) or NaN/Inf
    """
    if latitude is None or longitude is None:
        return False
    if math.isnan(latitude) or math.isnan(longitude) or math.isinf(latitude) or math.isinf(longitude):
        return False
    if not (-90.0 <= latitude <= 90.0) or not (-180.0 <= longitude <= 180.0):
        return False
    if abs(latitude) < 1e-6 and abs(longitude) < 1e-6:
        return False
    return True


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate geodesic distance between two points in meters using Haversine formula.
    """
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    a = min(1.0, max(0.0, a))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return EARTH_RADIUS_METERS * c


def meters_to_lat_degrees(meters: float) -> float:
    """Convert meter distance to approximate degrees latitude."""
    return meters / METERS_PER_LAT_DEGREE


def meters_to_lng_degrees(meters: float, lat: float) -> float:
    """Convert meter distance to approximate degrees longitude at given latitude."""
    lat_rad = math.radians(lat)
    cos_lat = max(math.cos(lat_rad), 0.01)
    return meters / (METERS_PER_LAT_DEGREE * cos_lat)


def get_grid_cell_id(lat: float, lon: float, grid_size_meters: float = 500.0) -> str:
    """
    Compute deterministic grid cell identifier for a coordinate.
    Bins coordinates into meter-scale geographic grid bins.
    Format: CELL_<lat_index>_<lon_index>
    """
    delta_lat = meters_to_lat_degrees(grid_size_meters)
    delta_lon = meters_to_lng_degrees(grid_size_meters, lat)

    lat_idx = int(math.floor(lat / delta_lat))
    lon_idx = int(math.floor(lon / delta_lon))
    return f"CELL_{lat_idx}_{lon_idx}"


def get_cell_bounds(cell_id: str, grid_size_meters: float = 500.0) -> Dict[str, Dict[str, float]]:
    """
    Compute geographic bounding box and center coordinate for a cell ID.
    Returns:
    {
        "sw": {"lat": min_lat, "lng": min_lon},
        "ne": {"lat": max_lat, "lng": max_lon},
        "center": {"lat": center_lat, "lng": center_lon}
    }
    """
    parts = cell_id.split("_")
    lat_idx = int(parts[1])
    lon_idx = int(parts[2])

    delta_lat = meters_to_lat_degrees(grid_size_meters)
    min_lat = lat_idx * delta_lat
    max_lat = min_lat + delta_lat
    center_lat = (min_lat + max_lat) / 2.0

    delta_lon = meters_to_lng_degrees(grid_size_meters, center_lat)
    min_lon = lon_idx * delta_lon
    max_lon = min_lon + delta_lon
    center_lon = (min_lon + max_lon) / 2.0

    return {
        "sw": {"lat": round(min_lat, 6), "lng": round(min_lon, 6)},
        "ne": {"lat": round(max_lat, 6), "lng": round(max_lon, 6)},
        "center": {"lat": round(center_lat, 6), "lng": round(center_lon, 6)},
    }

