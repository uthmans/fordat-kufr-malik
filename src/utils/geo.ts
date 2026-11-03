import { RouteNode, DriverStatus } from '../types';
import { ROUTE_NODES, DETOUR_NODES, RAMALLAH_LANDMARKS } from '../data/routeNodes';

// Haversine formula to calculate distance between two lat/lng in meters
export function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Distance from point P to line segment AB
function distToSegment(
  pLat: number,
  pLng: number,
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number {
  const l2 = getDistanceMeters(aLat, aLng, bLat, bLng) ** 2;
  if (l2 === 0) return getDistanceMeters(pLat, pLng, aLat, aLng);

  const t = Math.max(
    0,
    Math.min(
      1,
      ((pLat - aLat) * (bLat - aLat) + (pLng - aLng) * (bLng - aLng)) /
        ((bLat - aLat) ** 2 + (bLng - aLng) ** 2 || 1)
    )
  );

  const projLat = aLat + t * (bLat - aLat);
  const projLng = aLng + t * (bLng - aLng);
  return getDistanceMeters(pLat, pLng, projLat, projLng);
}

// Calculate minimum distance from point to the full route polyline
export function getDistanceToCorridor(lat: number, lng: number): number {
  let minDistance = Infinity;
  for (let i = 0; i < ROUTE_NODES.length - 1; i++) {
    const a = ROUTE_NODES[i];
    const b = ROUTE_NODES[i + 1];
    const dist = distToSegment(lat, lng, a.lat, a.lng, b.lat, b.lng);
    if (dist < minDistance) {
      minDistance = dist;
    }
  }
  return minDistance;
}

// Find nearest route node
export function getNearestNode(lat: number, lng: number): { node: RouteNode; distanceMeters: number } {
  let nearest = ROUTE_NODES[0];
  let minDistance = Infinity;

  for (const node of ROUTE_NODES) {
    const dist = getDistanceMeters(lat, lng, node.lat, node.lng);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = node;
    }
  }

  return { node: nearest, distanceMeters: minDistance };
}

// Check nearest detour
export function getNearestDetour(lat: number, lng: number): { detour: (typeof DETOUR_NODES)[0]; distanceMeters: number } {
  let nearest = DETOUR_NODES[0];
  let minDistance = Infinity;

  for (const detour of DETOUR_NODES) {
    const dist = getDistanceMeters(lat, lng, detour.lat, detour.lng);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = detour;
    }
  }

  return { detour: nearest, distanceMeters: minDistance };
}

export interface AutoAnalysisResult {
  status: DriverStatus;
  detectedNode: RouteNode;
  isDetour: boolean;
  detourNameEn?: string;
  detourNameAr?: string;
  progressPercent: number; // 0 to 100
  bearing: 'southbound' | 'northbound' | 'stationary';
  proximityTextEn: string;
  proximityTextAr: string;
  customStopEn?: string;
  customStopAr?: string;
}

// Clean Proximity Location Text (strictly "Kufr Malik" / "كفر مالك", and "Ramallah" / "الموقف")
export function generateProximityText(
  driverNameEn: string,
  driverNameAr: string,
  status: DriverStatus,
  nearestNode: RouteNode,
  distToNode: number,
  bearing: 'southbound' | 'northbound' | 'stationary',
  isDetour: boolean,
  detourNameEn?: string,
  detourNameAr?: string
): { proximityTextEn: string; proximityTextAr: string } {
  if (isDetour && detourNameEn && detourNameAr) {
    return {
      proximityTextEn: `${driverNameEn} is bypassing via ${detourNameEn}`,
      proximityTextAr: `${driverNameAr} يسلك تحويلة ${detourNameAr}`
    };
  }

  // Strictly "Kufr Malik" / "كفر مالك" - No parenthetical secondary status
  if (status === 'in_kufr_malik') {
    return {
      proximityTextEn: `${driverNameEn} is in Kufr Malik`,
      proximityTextAr: `${driverNameAr} في كفر مالك`
    };
  }

  // Strictly "Ramallah" / "الموقف" (At Station)
  if (status === 'in_ramallah') {
    return {
      proximityTextEn: `${driverNameEn} in Ramallah (At Station)`,
      proximityTextAr: `${driverNameAr} في الموقف (جاهز للتحرك)`
    };
  }

  // On the road
  if (distToNode < 500) {
    return {
      proximityTextEn: `${driverNameEn} is in ${nearestNode.nameEn}`,
      proximityTextAr: `${driverNameAr} في ${nearestNode.nameAr}`
    };
  }

  if (bearing === 'southbound') {
    return {
      proximityTextEn: `${driverNameEn} is passing ${nearestNode.nameEn}`,
      proximityTextAr: `${driverNameAr} يمر من ${nearestNode.nameAr}`
    };
  } else {
    return {
      proximityTextEn: `${driverNameEn} is passing ${nearestNode.nameEn} (to Kufr Malik)`,
      proximityTextAr: `${driverNameAr} يمر من ${nearestNode.nameAr} (عائداً لكفر مالك)`
    };
  }
}

// Evaluate GPS Location for a driver with Ramallah micro-location detection
export function evaluateGPSLocation(
  lat: number,
  lng: number,
  prevProgress: number = 0,
  driverNameEn: string = 'Driver',
  driverNameAr: string = 'السائق'
): AutoAnalysisResult {
  const kmNode = ROUTE_NODES[0];
  const rmNode = ROUTE_NODES[ROUTE_NODES.length - 1];

  const distToKM = getDistanceMeters(lat, lng, kmNode.lat, kmNode.lng);
  const distToRM = getDistanceMeters(lat, lng, rmNode.lat, rmNode.lng);
  const distToCorridor = getDistanceToCorridor(lat, lng);
  const { node: nearestNode, distanceMeters: nodeDist } = getNearestNode(lat, lng);

  const { detour, distanceMeters: detourDist } = getNearestDetour(lat, lng);
  const isDetour = distToCorridor > 1600 || detourDist < 2200;

  const totalLength = rmNode.distanceKmFromStart;
  let progressPercent = (nearestNode.distanceKmFromStart / totalLength) * 100;
  progressPercent = Math.max(0, Math.min(100, Math.round(progressPercent)));

  const isMovingTowardsRamallah = progressPercent >= prevProgress;
  const bearing: 'southbound' | 'northbound' | 'stationary' =
    distToKM < 700 || distToRM < 450
      ? 'stationary'
      : isMovingTowardsRamallah
      ? 'southbound'
      : 'northbound';

  if (isDetour) {
    const text = generateProximityText(
      driverNameEn,
      driverNameAr,
      'detour',
      nearestNode,
      nodeDist,
      bearing,
      true,
      detour.nameEn,
      detour.nameAr
    );
    return {
      status: 'detour',
      detectedNode: nearestNode,
      isDetour: true,
      detourNameEn: detour.nameEn,
      detourNameAr: detour.nameAr,
      progressPercent,
      bearing,
      proximityTextEn: text.proximityTextEn,
      proximityTextAr: text.proximityTextAr
    };
  }

  // 1. Within Kufr Malik (< 750m) - Clean strictly "Kufr Malik" / "كفر مالك"
  if (distToKM < 750) {
    const text = generateProximityText(
      driverNameEn,
      driverNameAr,
      'in_kufr_malik',
      kmNode,
      distToKM,
      'stationary',
      false
    );
    return {
      status: 'in_kufr_malik',
      detectedNode: kmNode,
      isDetour: false,
      progressPercent: 0,
      bearing: 'stationary',
      proximityTextEn: text.proximityTextEn,
      proximityTextAr: text.proximityTextAr,
      customStopEn: 'Kufr Malik',
      customStopAr: 'كفر مالك'
    };
  }

  // 2. RAMALLAH MICRO-LOCATION DETECTION:
  // Check landmarks in order of proximity:
  // Station (In Ramallah / At Station) -> Friends School -> Al Shini Market -> Entering Ramallah
  const stationLandmark = RAMALLAH_LANDMARKS[0]; // ramallah_station
  const friendsLandmark = RAMALLAH_LANDMARKS[1]; // friends_school
  const shiniLandmark = RAMALLAH_LANDMARKS[2];   // al_shini_market
  const enteringLandmark = RAMALLAH_LANDMARKS[3]; // entering_ramallah

  const distToStation = getDistanceMeters(lat, lng, stationLandmark.lat, stationLandmark.lng);
  const distToFriends = getDistanceMeters(lat, lng, friendsLandmark.lat, friendsLandmark.lng);
  const distToShini = getDistanceMeters(lat, lng, shiniLandmark.lat, shiniLandmark.lng);
  const distToEntering = getDistanceMeters(lat, lng, enteringLandmark.lat, enteringLandmark.lng);

  // A. In Ramallah (At Station) - "في الموقف (جاهز للتحرك)"
  if (distToStation <= stationLandmark.radiusMeters || distToRM < 450) {
    return {
      status: 'in_ramallah',
      detectedNode: rmNode,
      isDetour: false,
      progressPercent: 100,
      bearing: 'stationary',
      proximityTextEn: `${driverNameEn} in Ramallah (At Station)`,
      proximityTextAr: `${driverNameAr} في الموقف (جاهز للتحرك)`,
      customStopEn: 'Ramallah (At Station)',
      customStopAr: 'في الموقف (جاهز للتحرك)'
    };
  }

  // B. Near Friends School - "قريب من مدرسة الفرندز"
  if (distToFriends <= friendsLandmark.radiusMeters || (distToRM < 1100 && distToRM >= 450)) {
    const status: DriverStatus = bearing === 'northbound' ? 'to_kufr_malik' : 'to_ramallah';
    return {
      status,
      detectedNode: rmNode,
      isDetour: false,
      progressPercent: 96,
      bearing,
      proximityTextEn: `${driverNameEn} is near Friends School`,
      proximityTextAr: `${driverNameAr} قريب من مدرسة الفرندز`,
      customStopEn: 'Near Friends School',
      customStopAr: 'قريب من مدرسة الفرندز'
    };
  }

  // C. Near Al Shini Market - "قريب من سوبرماركت الشيني"
  if (distToShini <= shiniLandmark.radiusMeters || (distToRM < 2000 && distToRM >= 1100)) {
    const status: DriverStatus = bearing === 'northbound' ? 'to_kufr_malik' : 'to_ramallah';
    return {
      status,
      detectedNode: rmNode,
      isDetour: false,
      progressPercent: 92,
      bearing,
      proximityTextEn: `${driverNameEn} is near Al Shini Market`,
      proximityTextAr: `${driverNameAr} قريب من سوبرماركت الشيني`,
      customStopEn: 'Near Al Shini Market',
      customStopAr: 'قريب من سوبرماركت الشيني'
    };
  }

  // D. Entering Ramallah - "داخل إلى رام الله"
  if (distToEntering <= enteringLandmark.radiusMeters || (distToRM < 3200 && distToRM >= 2000)) {
    if (bearing === 'southbound') {
      return {
        status: 'to_ramallah',
        detectedNode: rmNode,
        isDetour: false,
        progressPercent: 86,
        bearing: 'southbound',
        proximityTextEn: `${driverNameEn} is entering Ramallah`,
        proximityTextAr: `${driverNameAr} داخل إلى رام الله`,
        customStopEn: 'Entering Ramallah',
        customStopAr: 'داخل إلى رام الله'
      };
    } else {
      return {
        status: 'to_kufr_malik',
        detectedNode: rmNode,
        isDetour: false,
        progressPercent: 86,
        bearing: 'northbound',
        proximityTextEn: `${driverNameEn} is leaving Ramallah (to Kufr Malik)`,
        proximityTextAr: `${driverNameAr} يغادر الموقف (عائداً لكفر مالك)`,
        customStopEn: 'Leaving Ramallah',
        customStopAr: 'يغادر الموقف'
      };
    }
  }

  // 3. Regular Route Progression (Between Kufr Malik and Ramallah outskirts)
  const status: DriverStatus = bearing === 'southbound' ? 'to_ramallah' : 'to_kufr_malik';
  const text = generateProximityText(
    driverNameEn,
    driverNameAr,
    status,
    nearestNode,
    nodeDist,
    bearing,
    false
  );

  return {
    status,
    detectedNode: nearestNode,
    isDetour: false,
    progressPercent,
    bearing,
    proximityTextEn: text.proximityTextEn,
    proximityTextAr: text.proximityTextAr,
    customStopEn: nearestNode.nameEn,
    customStopAr: nearestNode.nameAr
  };
}

// Full polyline points along the corridor including Ramallah micro-nodes
const DETAILED_ROUTE_WAYPOINTS = [
  { lat: 31.9840, lng: 35.3115, km: 0 },     // Kufr Malik
  { lat: 31.9790, lng: 35.2630, km: 5.2 },   // Silwad
  { lat: 31.9670, lng: 35.2440, km: 8.5 },   // Yabroud Checkpoint
  { lat: 31.9610, lng: 35.2280, km: 12.1 },  // Ein Sinia
  { lat: 31.9390, lng: 35.2150, km: 17.4 },  // Al Jalazon
  { lat: 31.9230, lng: 35.2090, km: 20.2 },  // Entering Ramallah
  { lat: 31.9140, lng: 35.2065, km: 21.4 },  // Near Al Shini Market
  { lat: 31.9085, lng: 35.2050, km: 22.3 },  // Near Friends School
  { lat: 31.9038, lng: 35.2034, km: 23.0 }   // Ramallah Station (الموقف)
];

// Interpolate a point along the route given progress 0..100
export function interpolateRoutePoint(percent: number): { lat: number; lng: number } {
  const clamped = Math.max(0, Math.min(100, percent));
  const totalLength = DETAILED_ROUTE_WAYPOINTS[DETAILED_ROUTE_WAYPOINTS.length - 1].km;
  const targetKm = (clamped / 100) * totalLength;

  for (let i = 0; i < DETAILED_ROUTE_WAYPOINTS.length - 1; i++) {
    const a = DETAILED_ROUTE_WAYPOINTS[i];
    const b = DETAILED_ROUTE_WAYPOINTS[i + 1];

    if (targetKm >= a.km && targetKm <= b.km) {
      const segLength = b.km - a.km;
      const t = segLength > 0 ? (targetKm - a.km) / segLength : 0;

      return {
        lat: a.lat + t * (b.lat - a.lat),
        lng: a.lng + t * (b.lng - a.lng)
      };
    }
  }

  const last = DETAILED_ROUTE_WAYPOINTS[DETAILED_ROUTE_WAYPOINTS.length - 1];
  return { lat: last.lat, lng: last.lng };
}
