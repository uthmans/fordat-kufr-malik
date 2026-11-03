export type DriverStatus = 
  | 'in_kufr_malik'       // "In Kufr Malik / في كفر مالك"
  | 'to_ramallah'         // "On the way to Ramallah / في الطريق إلى رام الله"
  | 'in_ramallah'         // "In Ramallah / في رام الله"
  | 'to_kufr_malik'       // "Heading back to Kufr Malik / في الطريق إلى كفر مالك"
  | 'detour';             // "Detour Active / مسار بديل"

export type TripDirection = 'all' | 'to_ramallah' | 'to_kufr_malik' | 'detour';

export interface GPSLocation {
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number | null;
  speed?: number | null;
  timestamp: number;
}

export interface RouteNode {
  id: string;
  nameEn: string;
  nameAr: string;
  subEn: string;
  subAr: string;
  lat: number;
  lng: number;
  order: number;
  distanceKmFromStart: number;
}

export interface SeatRequest {
  id: string;
  driverId: string;
  passengerName: string;
  seatCount: number;
  phone?: string;
  timestamp: number;
  status: 'pending' | 'accepted' | 'declined';
}

export interface TripLogEntry {
  id: string;
  driverId: string;
  passengerName: string;
  seatCount: number;
  phone?: string;
  status: 'confirmed';
  confirmedAt: number;
}

export interface ArchivedTrip {
  id: string;
  driverId: string;
  timestamp: number;
  formattedDate: string;
  passengersCount: number;
  locationStatus: DriverStatus;
  entries: TripLogEntry[];
}

export type PrayerShiftPreset = 'regular_day' | 'after_maghrib' | 'after_isha' | 'final_trip';

export type DepartureCountdown = 'leaving_now' | 'in_5_mins' | 'in_10_mins' | null;

export interface Driver {
  id: string;
  nameEn: string;
  nameAr: string;
  phone: string;
  pinCode: string; // 4-digit PIN for authentication (default 1234)
  isOnDuty: boolean; // "Active Today / على رأس عمله" vs "Off Duty / غير متاح اليوم"
  isLateShift: boolean; // Legacy fallback
  prayerShift?: PrayerShiftPreset; // Cultural village shift presets
  departureCountdown?: DepartureCountdown; // Quick departure announcement
  departureCountdownSetAt?: number;
  lastActiveTime?: number; // Inactivity tracker
  autoPausedForInactivity?: boolean; // Kufr Malik 45-min stationary auto-off flag
  lastTripLabelEn?: string;
  lastTripLabelAr?: string;
  status: DriverStatus;
  passengers: number; // 0 to 7
  maxCapacity: number; // 7
  lastUpdated: string; // ISO string
  departureNoteEn: string;
  departureNoteAr: string;
  currentStopEn: string;
  currentStopAr: string;
  // Dynamic Proximity Text
  proximityStatusEn: string;
  proximityStatusAr: string;
  // GPS fields
  currentLocation: GPSLocation;
  directionAnchor?: GPSLocation;
  detectedNodeId: string;
  isDetour: boolean;
  detourNameEn?: string;
  detourNameAr?: string;
  gpsMode: 'live' | 'simulation' | 'idle';
  bearing?: 'southbound' | 'northbound' | 'stationary';
}

export type Language = 'en' | 'ar';
export type ActiveTab = 'villager' | 'driver' | 'settings';

