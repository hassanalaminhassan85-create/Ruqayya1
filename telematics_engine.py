#!/usr/bin/env python3
"""
Complex Telematics Tracking Engine
Calculates real-time distance, speed anomalies, Maiduguri geofencing status,
driver fatigue score, and fuel efficiency metrics.
"""

import math
import json
import time
from typing import Dict, Any, List, Tuple

# Maiduguri Fleet Hub Coordinates
HUB_LAT = 11.8311
HUB_LNG = 13.1509
GEOFENCE_RADIUS_KM = 35.0  # 35km urban operation boundary

MAIDUGURI_WAYPOINTS = [
    {"name": "Post Office Central Terminal", "lat": 11.8311, "lng": 13.1509},
    {"name": "Monday Market Distribution Hub", "lat": 11.8365, "lng": 13.1486},
    {"name": "Custom Area Depot", "lat": 11.8540, "lng": 13.1720},
    {"name": "Bolori Highway Junction", "lat": 11.8520, "lng": 13.1310},
    {"name": "Bulumkutu Bypass", "lat": 11.8210, "lng": 13.1110},
    {"name": "Muna Garage Terminal", "lat": 11.8480, "lng": 13.2080},
    {"name": "Tashan Bama Corridor", "lat": 11.7990, "lng": 13.1890},
]

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates the Great Circle distance between two coordinates in kilometers."""
    R = 6371.0  # Earth's radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def resolve_nearest_waypoint(lat: float, lng: float) -> Tuple[str, float]:
    """Finds the closest Maiduguri landmark to current GPS coordinates."""
    min_dist = float('inf')
    best_name = "Maiduguri Metropolitan Zone"
    for wp in MAIDUGURI_WAYPOINTS:
        d = haversine_distance(lat, lng, wp["lat"], wp["lng"])
        if d < min_dist:
            min_dist = d
            best_name = wp["name"]
    return best_name, round(min_dist, 2)

def analyze_driver_telematics(driver_id: str, lat: float, lng: float, speed_kmh: float, driving_hours: float) -> Dict[str, Any]:
    """
    Complex Telematics Evaluation:
    - Nearest landmark geocoding
    - Geofence compliance
    - Overspeeding risk factor
    - Fatigue index (0 - 100)
    - Fuel consumption rate (L / 100km)
    """
    nearest_place, dist_to_place = resolve_nearest_waypoint(lat, lng)
    dist_from_hub = round(haversine_distance(HUB_LAT, HUB_LNG, lat, lng), 2)
    
    geofence_status = "INSIDE_ZONE" if dist_from_hub <= GEOFENCE_RADIUS_KM else "GEOFENCE_BREACH"
    
    # Speed Risk Analysis
    if speed_kmh > 80:
        speed_risk = "CRITICAL_OVERSPEED"
    elif speed_kmh > 65:
        speed_risk = "WARNING_ELEVATED_SPEED"
    elif speed_kmh > 0:
        speed_risk = "OPTIMAL_IN_TRANSIT"
    else:
        speed_risk = "STATIONARY_IDLE"
        
    # Fatigue Calculation Formula: F = min(100, (Driving Hours * 15) + (Speed / 10))
    fatigue_index = min(100, round((driving_hours * 15) + (speed_kmh / 10), 1))
    fatigue_level = "HIGH" if fatigue_index >= 75 else ("MODERATE" if fatigue_index >= 45 else "LOW")
    
    # Fuel Efficiency Algorithm: base 12L/100km + speed penalty
    if speed_kmh == 0:
        eff_l_100km = 1.5  # Idle burn rate per hour
    else:
        eff_l_100km = round(12.0 + (max(0, speed_kmh - 50) * 0.15), 1)

    return {
        "driver_id": driver_id,
        "location": {
            "latitude": lat,
            "longitude": lng,
            "resolved_name": f"{nearest_place} ({dist_to_place}km away)",
            "distance_from_hub_km": dist_from_hub,
            "geofence": geofence_status
        },
        "telematics": {
            "speed_kmh": speed_kmh,
            "speed_risk": speed_risk,
            "fatigue_index": fatigue_index,
            "fatigue_level": fatigue_level,
            "estimated_fuel_burn_rate": eff_l_100km,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        }
    }

if __name__ == "__main__":
    # Test sample driver calculation
    sample_res = analyze_driver_telematics("DRV-101", 11.8365, 13.1486, 62.5, 4.5)
    print(json.dumps(sample_res, indent=2))
