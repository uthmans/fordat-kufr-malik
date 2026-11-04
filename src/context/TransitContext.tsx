import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Driver, DriverStatus, Language, ActiveTab, SeatRequest, TripLogEntry, ArchivedTrip, PrayerShiftPreset, DepartureCountdown } from '../types';
import { INITIAL_DRIVERS, PRAYER_SHIFT_CONFIGS } from '../data/initialDrivers';
import { DETOUR_NODES } from '../data/routeNodes';
import { evaluateGPSLocation, interpolateRoutePoint } from '../utils/geo';
import { acceptBooking, BookingState } from '../utils/bookingAcceptance';
import { DriverLocationWatch } from '../utils/driverLocationWatch';
import { inferRouteDirection } from '../utils/routeDirection';
import { pauseInactiveDrivers, recordDutyMovement } from '../utils/dutyActivity';
import { isDemoRequest, isDemoLog, isDemoArchive } from '../utils/dataFreshness';
import { AUTH_DRIVER_KEY, VILLAGER_NAME_KEY, normalizeVillagerName, readDriverSession, readVillagerName, storeIdentity } from '../utils/identityStorage';
import { isValidDriverPin, matchesDriverPin } from '../utils/driverPin';
import { isSeatRequest, isTripLog, isArchivedTrip, readStoredCollection, restoreDrivers, readSyncMessage } from '../utils/transitData';
import { archiveTrip } from '../utils/tripArchive';

const DRIVERS_KEY = 'kufr_malik_transit_drivers_v8';
const REQUESTS_KEY = 'kufr_malik_transit_requests_v6';
const TRIP_LOGS_KEY = 'kufr_malik_transit_triplogs_v6';
const TRIP_HISTORY_KEY = 'kufr_malik_transit_history_v6';
const ADMIN_AUTH_KEY = 'kufr_malik_admin_auth_v6';
const LANG_KEY = 'kufr_malik_transit_lang';
const CONTRAST_KEY = 'kufr_malik_transit_contrast';

const MASTER_ADMIN_PIN = '9999';

interface TransitContextType {
  showDemoData: boolean;
  setShowDemoData: (value: boolean) => void;
  dataNow: number;
  isOnline: boolean;
  drivers: Driver[];
  currentDriver: Driver | undefined;
  selectedDriverId: string;
  setSelectedDriverId: (id: string) => void;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  highContrast: boolean;
  setHighContrast: (val: boolean) => void;

  // Driver Authentication
  authenticatedDriverId: string | null;
  loginDriver: (driverId: string, pin: string) => boolean;
  logoutDriver: () => void;
  activateDriverOnLogin: (driverId: string) => void;
  villagerName: string;
  rememberVillagerName: (name: string) => string;

  // Driver Availability & Shift controls
  toggleDriverDuty: (driverId: string) => void;
  toggleDriverLateShift: (driverId: string) => void;
  setDriverPrayerShift: (driverId: string, shift: PrayerShiftPreset) => void;
  setDepartureCountdown: (driverId: string, countdown: DepartureCountdown) => void;
  resumeDutyFromInactivity: (driverId: string) => void;

  // Driver Profile Updates
  updateDriverProfile: (driverId: string, updates: Partial<Driver>) => void;

  // Passenger counter
  incrementPassengers: (id: string) => void;
  decrementPassengers: (id: string) => void;
  updateDriverPassengers: (id: string, count: number) => void;
  updateDriverNote: (id: string, noteEn: string, noteAr: string) => void;
  resetAll: () => void;


  // Real GPS Geolocation
  isTrackingRealGPS: boolean;
  startRealGPSTracking: () => void;
  stopRealGPSTracking: () => void;
  gpsError: string | null;

  // GPS Simulation
  isSimulatingGPS: boolean;
  toggleGPSSimulation: () => void;
  simulationProgress: number;
  setSimulationProgress: (val: number) => void;
  simulationDirection: 'to_ramallah' | 'to_kufr_malik';
  setSimulationDirection: (dir: 'to_ramallah' | 'to_kufr_malik') => void;
  isDetourSimulated: boolean;
  toggleDetourSimulation: () => void;

  // Simplified Seat Requests
  seatRequests: SeatRequest[];
  requestSeat: (
    driverId: string,
    passengerName: string,
    seatCount: number,
    phone?: string
  ) => void;
  acceptSeatRequest: (requestId: string) => boolean;
  declineSeatRequest: (requestId: string) => void;

  // Driver Trip Log & Archive
  tripLogs: TripLogEntry[];
  tripHistory: ArchivedTrip[];
  addTripLogEntry: (driverId: string, passengerName: string, seatCount: number, phone?: string) => void;
  clearTripLog: (driverId: string) => void;
  archiveCurrentTrip: (driverId: string) => void;
  deleteArchivedTrip: (tripId: string) => void;
  clearAllTripHistory: () => void;

  // Admin Portal
  isAdminAuthenticated: boolean;
  adminLogin: (pin: string) => boolean;
  adminLogout: () => void;
  adminUpdateDriver: (driverId: string, updates: Partial<Driver>) => void;
}

const TransitContext = createContext<TransitContextType | undefined>(undefined);

export const TransitProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [showDemoData, setShowDemoDataState] = useState(() => {
    try { return localStorage.getItem('kufr_malik_show_demo_v1') === 'true'; } catch { return false; }
  });
  const setShowDemoData = (value: boolean) => {
    setShowDemoDataState(value);
    try { localStorage.setItem('kufr_malik_show_demo_v1', String(value)); } catch {}
  };
  const [dataNow, setDataNow] = useState(Date.now);
  const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
  useEffect(() => {
    const refresh = () => { setDataNow(Date.now()); setIsOnline(navigator.onLine); };
    const interval = setInterval(refresh, 15000);
    window.addEventListener('online', refresh);
    window.addEventListener('offline', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', refresh);
      window.removeEventListener('offline', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  const [drivers, setDrivers] = useState<Driver[]>(() => {
    const saved = restoreDrivers();
    return saved.length ? saved : INITIAL_DRIVERS;
  });


  // Restore only a known roster ID, including sessions saved by older app versions.
  const [authenticatedDriverId, setAuthenticatedDriverId] = useState<string | null>(() => readDriverSession(drivers));
  const authenticatedDriverIdRef = useRef(authenticatedDriverId);
  authenticatedDriverIdRef.current = authenticatedDriverId;
  const [selectedDriverId, setSelectedDriverId] = useState<string>(authenticatedDriverId || drivers[0]?.id || 'driver-1');
  const [villagerName, setVillagerName] = useState(readVillagerName);

  const rememberVillagerName = useCallback((name: string) => {
    const normalized = normalizeVillagerName(name);
    setVillagerName(normalized);
    storeIdentity(VILLAGER_NAME_KEY, normalized);
    return normalized;
  }, []);

  // Admin Auth State
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    try {
      return localStorage.getItem(ADMIN_AUTH_KEY) === 'true';
    } catch {}
    return false;
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>(authenticatedDriverId ? 'driver' : 'villager');

  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved === 'ar' || saved === 'en') return saved;
    } catch {}
    return 'ar';
  });

  const [highContrast, setHighContrastState] = useState<boolean>(() => {
    try {
      return localStorage.getItem(CONTRAST_KEY) === 'true';
    } catch {
      return false;
    }
  });

  // Sample initial requests
  const [seatRequests, setSeatRequests] = useState<SeatRequest[]>(() => readStoredCollection(REQUESTS_KEY, isSeatRequest));

  // Active Trip Log (passengers for current round)
  const [tripLogs, setTripLogs] = useState<TripLogEntry[]>(() => readStoredCollection(TRIP_LOGS_KEY, isTripLog));

  // Archived Trips History
  const [tripHistory, setTripHistory] = useState<ArchivedTrip[]>(() => readStoredCollection(TRIP_HISTORY_KEY, isArchivedTrip));
  const tripHistoryRef = useRef(tripHistory);
  tripHistoryRef.current = tripHistory;

  // Read the latest accepted changes even before React renders a second tap.
  const bookingStateRef = useRef<BookingState>({ drivers, requests: seatRequests, logs: tripLogs });
  bookingStateRef.current = { drivers, requests: seatRequests, logs: tripLogs };

  // Real GPS state
  const [isTrackingRealGPS, setIsTrackingRealGPS] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const gpsWatchRef = useRef<DriverLocationWatch | null>(null);

  // Simulation state
  const [isSimulatingGPS, setIsSimulatingGPS] = useState(false);
  const [simulationProgress, setSimulationProgressState] = useState(30);
  const [simulationDirection, setSimulationDirection] = useState<'to_ramallah' | 'to_kufr_malik'>('to_ramallah');
  const [isDetourSimulated, setIsDetourSimulated] = useState(false);

  // Broadcast sync helper
  const broadcastSync = (type: string, payload: any) => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const channel = new BroadcastChannel('kufr_malik_transit_hub_v6');
        channel.postMessage({ type, payload });
        channel.close();
      } catch {}
    }
  };

  const saveDrivers = useCallback((newDrivers: Driver[]) => {
    bookingStateRef.current.drivers = newDrivers;
    setDrivers(newDrivers);
    try { localStorage.setItem(DRIVERS_KEY, JSON.stringify(newDrivers)); } catch {}
    broadcastSync('UPDATE_DRIVERS', newDrivers);
  }, []);

  const saveRequests = useCallback((newRequests: SeatRequest[]) => {
    bookingStateRef.current.requests = newRequests;
    setSeatRequests(newRequests);
    try { localStorage.setItem(REQUESTS_KEY, JSON.stringify(newRequests)); } catch {}
    broadcastSync('UPDATE_REQUESTS', newRequests);
  }, []);

  const saveTripLogs = useCallback((newLogs: TripLogEntry[]) => {
    bookingStateRef.current.logs = newLogs;
    setTripLogs(newLogs);
    try { localStorage.setItem(TRIP_LOGS_KEY, JSON.stringify(newLogs)); } catch {}
    broadcastSync('UPDATE_TRIP_LOGS', newLogs);
  }, []);

  const saveTripHistory = useCallback((newHistory: ArchivedTrip[]) => {
    tripHistoryRef.current = newHistory;
    setTripHistory(newHistory);
    try { localStorage.setItem(TRIP_HISTORY_KEY, JSON.stringify(newHistory)); } catch {}
    broadcastSync('UPDATE_TRIP_HISTORY', newHistory);
  }, []);

  // Multi-tab listener
  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    // Some browsers expose the API while denying channel creation.
    let channel: BroadcastChannel;
    try { channel = new BroadcastChannel('kufr_malik_transit_hub_v6'); } catch { return; }

    channel.onmessage = (event) => {
      const message = readSyncMessage(event.data);
      if (!message) return;
      if (message.type === 'UPDATE_DRIVERS') {
        const payload = message.payload;
        setDataNow(Date.now());
        bookingStateRef.current.drivers = payload;
        setDrivers(payload);
      } else if (message.type === 'UPDATE_REQUESTS') {
        const payload = message.payload;
        bookingStateRef.current.requests = payload;
        setSeatRequests(payload);
      } else if (message.type === 'UPDATE_TRIP_LOGS') {
        const payload = message.payload;
        bookingStateRef.current.logs = payload;
        setTripLogs(payload);
      } else if (message.type === 'UPDATE_TRIP_HISTORY') {
        tripHistoryRef.current = message.payload;
        setTripHistory(message.payload);
      } else if (message.type === 'GPS_SIM_PROGRESS') {
        setSimulationProgressState(message.payload.progress);
        setIsDetourSimulated(message.payload.isDetour);
      }
    };

    return () => {
      channel.close();
    };
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try { localStorage.setItem(LANG_KEY, lang); } catch {}
  };

  const setHighContrast = (val: boolean) => {
    setHighContrastState(val);
    try { localStorage.setItem(CONTRAST_KEY, String(val)); } catch {}
  };

  // Auto-activate driver on morning login
  const activateDriverOnLogin = useCallback((driverId: string) => {
    setDrivers((prev) => {
      const target = prev.find((d) => d.id === driverId);
      if (!target) return prev;
      const updated = prev.map((d) =>
        d.id === driverId
          ? {
              ...d,
              isOnDuty: true,
              autoPausedForInactivity: false,
              lastActiveTime: Date.now(),
              lastUpdated: new Date().toISOString()
            }
          : d
      );
      try { localStorage.setItem(DRIVERS_KEY, JSON.stringify(updated)); } catch {}
      broadcastSync('UPDATE_DRIVERS', updated);
      return updated;
    });
  }, []);

  // Driver Authentication Logic
  const loginDriver = (driverId: string, pin: string): boolean => {
    const driver = drivers.find((d) => d.id === driverId);
    if (!driver) return false;

    // Only the selected driver's assigned PIN can open this local profile.
    if (matchesDriverPin(driver, pin)) {
      if (authenticatedDriverIdRef.current !== driverId) stopRealGPSTracking();
      authenticatedDriverIdRef.current = driverId;
      setAuthenticatedDriverId(driverId);
      setSelectedDriverId(driverId);
      storeIdentity(AUTH_DRIVER_KEY, driverId);
      setActiveTab('driver');
      
      // Automatic Morning Login Duty: auto-set isOnDuty to true and clear inactivity pause
      activateDriverOnLogin(driverId);

      if (typeof window !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(40); } catch {}
      }
      return true;
    }
    return false;
  };

  const logoutDriver = () => {
    authenticatedDriverIdRef.current = null;
    // A shared phone must not keep updating the previous driver's GPS position.
    stopRealGPSTracking();
    setIsSimulatingGPS(false);
    setAuthenticatedDriverId(null);
    storeIdentity(AUTH_DRIVER_KEY, null);
    setActiveTab('driver');
  };

  // Admin Login Logic (Master PIN: 9999)
  const adminLogin = (pin: string): boolean => {
    if (pin.trim() === MASTER_ADMIN_PIN) {
      setIsAdminAuthenticated(true);
      try { localStorage.setItem(ADMIN_AUTH_KEY, 'true'); } catch {}
      if (typeof window !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate([50, 50, 50]); } catch {}
      }
      return true;
    }
    return false;
  };

  const adminLogout = () => {
    setIsAdminAuthenticated(false);
    try { localStorage.removeItem(ADMIN_AUTH_KEY); } catch {}
  };

  // On Duty / Off Duty Toggle
  const toggleDriverDuty = (driverId: string) => {
    const updated = drivers.map((d) => {
      if (d.id === driverId) {
        return {
          ...d,
          isOnDuty: !d.isOnDuty,
          departureCountdown: d.isOnDuty ? null : d.departureCountdown,
          departureCountdownSetAt: d.isOnDuty ? undefined : d.departureCountdownSetAt,
          autoPausedForInactivity: false,
          lastActiveTime: Date.now(),
          lastUpdated: new Date().toISOString()
        };
      }
      return d;
    });
    saveDrivers(updated);
    if (typeof window !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(30); } catch {}
    }
  };

  // Cultural Prayer-Based Shift Preset Selector
  const setDriverPrayerShift = (driverId: string, shift: PrayerShiftPreset) => {
    const config = PRAYER_SHIFT_CONFIGS[shift];
    const isLate = shift === 'after_maghrib' || shift === 'after_isha';
    const updated = drivers.map((d) => {
      if (d.id === driverId) {
        return {
          ...d,
          prayerShift: shift,
          isLateShift: isLate,
          lastTripLabelEn: config.labelEn,
          lastTripLabelAr: config.labelAr,
          lastActiveTime: Date.now(),
          lastUpdated: new Date().toISOString()
        };
      }
      return d;
    });
    saveDrivers(updated);
    if (typeof window !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(30); } catch {}
    }
  };

  // Quick Departure Announcement Countdown
  const setDepartureCountdown = (driverId: string, countdown: DepartureCountdown) => {
    const now = Date.now();
    setDataNow(now);
    const updated = drivers.map((d) => {
      if (d.id === driverId && (d.isOnDuty || countdown === null)) {
        return {
          ...d,
          departureCountdown: countdown,
          departureCountdownSetAt: countdown ? now : undefined,
          lastActiveTime: now,
          lastUpdated: new Date(now).toISOString()
        };
      }
      return d;
    });
    saveDrivers(updated);
    if (typeof window !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(30); } catch {}
    }
  };

  // Resume Duty when Auto-Paused for Inactivity
  const resumeDutyFromInactivity = (driverId: string) => {
    const updated = drivers.map((d) => {
      if (d.id === driverId) {
        return {
          ...d,
          isOnDuty: true,
          autoPausedForInactivity: false,
          lastActiveTime: Date.now(),
          lastUpdated: new Date().toISOString()
        };
      }
      return d;
    });
    saveDrivers(updated);
    if (typeof window !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([40, 40, 40]); } catch {}
    }
  };

  // Late Shift Indicator Toggle (legacy fallback)
  const toggleDriverLateShift = (driverId: string) => {
    const updated: Driver[] = drivers.map((d): Driver => {
      if (d.id === driverId) {
        const nextState = !d.isLateShift;
        const newShift: PrayerShiftPreset = nextState ? 'after_maghrib' : 'regular_day';
        return {
          ...d,
          isLateShift: nextState,
          prayerShift: newShift,
          lastTripLabelEn: nextState ? 'Active After Maghrib' : 'Regular Day Shift',
          lastTripLabelAr: nextState ? 'شغال بعد المغرب' : 'دوام نهاري عادي',
          lastActiveTime: Date.now(),
          lastUpdated: new Date().toISOString()
        };
      }
      return d;
    });
    saveDrivers(updated);

    if (typeof window !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(30); } catch {}
    }
  };

  // Kufr Malik 45-minute Inactivity Auto-Timeout Monitor
  useEffect(() => {
    const checkInactivity = () => {
      const now = Date.now();
      setDrivers((prev) => {
        const updated = pauseInactiveDrivers(prev, now);
        if (updated !== prev) {
          bookingStateRef.current.drivers = updated;
          try { localStorage.setItem(DRIVERS_KEY, JSON.stringify(updated)); } catch {}
          broadcastSync('UPDATE_DRIVERS', updated);
          return updated;
        }
        return prev;
      });
    };
    const checkWhenVisible = () => {
      if (document.visibilityState === 'visible') checkInactivity();
    };
    checkInactivity();
    const interval = setInterval(checkInactivity, 30000);
    document.addEventListener('visibilitychange', checkWhenVisible);
    window.addEventListener('focus', checkInactivity);
    window.addEventListener('pageshow', checkInactivity);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', checkWhenVisible);
      window.removeEventListener('focus', checkInactivity);
      window.removeEventListener('pageshow', checkInactivity);
    };
  }, []);


  // Driver Profile Updates (by driver or admin)
  const updateDriverProfile = (driverId: string, updates: Partial<Driver>) => {
    if (updates.pinCode !== undefined && !isValidDriverPin(updates.pinCode)) return;
    const updated = drivers.map((d) => {
      if (d.id === driverId) {
        return {
          ...d,
          ...updates,
          lastUpdated: new Date().toISOString()
        };
      }
      return d;
    });
    saveDrivers(updated);
  };

  const adminUpdateDriver = (driverId: string, updates: Partial<Driver>) => {
    updateDriverProfile(driverId, updates);
  };

  // Dynamic GPS Proximity text updater
  const updateDriverLocation = useCallback((driverId: string, lat: number, lng: number, accuracy?: number, liveDriverId?: string, sampleTimestamp = Date.now()) => {
    setDrivers((prevDrivers) => {
      if (liveDriverId && authenticatedDriverIdRef.current !== liveDriverId) return prevDrivers;
      const target = prevDrivers.find((d) => d.id === driverId);
      if (!target) return prevDrivers;

      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return prevDrivers;
      const gpsMode: Driver['gpsMode'] = liveDriverId ? 'live' : 'simulation';
      if (!Number.isFinite(sampleTimestamp) || sampleTimestamp <= 0 ||
          (target.gpsMode === gpsMode && sampleTimestamp <= target.currentLocation?.timestamp)) return prevDrivers;
      const location = { lat, lng, accuracy: typeof accuracy === 'number' && Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : 10, timestamp: sampleTimestamp };
      const movement = inferRouteDirection(location, target.gpsMode === gpsMode ? target.directionAnchor : undefined);

      const analysis = evaluateGPSLocation(
        lat,
        lng,
        movement.bearing,
        target.nameEn,
        target.nameAr,
        target.status
      );

      const updated = prevDrivers.map((d) => {
        if (d.id === driverId) {
          return {
            ...d,
            status: analysis.status,
            ...recordDutyMovement(d, location, gpsMode, Date.now()),
            currentLocation: location,
            directionAnchor: movement.anchor,
            gpsMode,
            detectedNodeId: analysis.detectedNode.id,
            isDetour: analysis.isDetour,
            detourNameEn: analysis.detourNameEn,
            detourNameAr: analysis.detourNameAr,
            currentStopEn: analysis.customStopEn || analysis.detectedNode.nameEn,
            currentStopAr: analysis.customStopAr || analysis.detectedNode.nameAr,
            proximityStatusEn: analysis.proximityTextEn,
            proximityStatusAr: analysis.proximityTextAr,
            bearing: analysis.bearing,
            lastUpdated: new Date().toISOString()
          };
        }
        return d;
      });

      try { localStorage.setItem(DRIVERS_KEY, JSON.stringify(updated)); } catch {}
      broadcastSync('UPDATE_DRIVERS', updated);
      return updated;
    });
  }, []);

  // HTML5 Geolocation Tracking
  const startRealGPSTracking = () => {
    const driverId = authenticatedDriverIdRef.current;
    if (!driverId || !bookingStateRef.current.drivers.some((driver) => driver.id === driverId)) {
      setGpsError(language === 'ar' ? 'سجل دخولك كسائق لتشغيل GPS الهاتف' : 'Sign in as a driver to use phone GPS');
      return;
    }
    if (!navigator.geolocation) {
      setGpsError(language === 'ar' ? 'نظام GPS غير مدعوم في هذا المتصفح' : 'Geolocation is not supported');
      return;
    }

    setGpsError(null);
    setIsTrackingRealGPS(true);
    setIsSimulatingGPS(false);

    try {
      if (!gpsWatchRef.current) gpsWatchRef.current = new DriverLocationWatch(
        navigator.geolocation,
        (ownerId, pos) => {
          if (authenticatedDriverIdRef.current !== ownerId) return;
          setGpsError(null);
          updateDriverLocation(
            ownerId,
            pos.coords.latitude,
            pos.coords.longitude,
            pos.coords.accuracy,
            ownerId,
            pos.timestamp
          );
        },
        (err) => {
          if (err.code === 1) setIsTrackingRealGPS(false);
          setGpsError(err.message || 'GPS Signal Lost');
        }
      );
      gpsWatchRef.current.start(driverId);
    } catch (e: any) {
      gpsWatchRef.current?.stop();
      setIsTrackingRealGPS(false);
      setGpsError(e.message || 'Error initializing GPS');
    }
  };

  const stopRealGPSTracking = () => {
    gpsWatchRef.current?.stop();
    setIsTrackingRealGPS(false);
  };

  useEffect(() => {
    return () => {
      gpsWatchRef.current?.stop();
    };
  }, []);

  // Simulation controls
  const toggleGPSSimulation = () => {
    if (!isSimulatingGPS) {
      stopRealGPSTracking();
    }
    setIsSimulatingGPS((prev) => !prev);
  };

  const setSimulationProgress = (progress: number) => {
    setSimulationProgressState(progress);
    broadcastSync('GPS_SIM_PROGRESS', { progress, isDetour: isDetourSimulated });

    if (isDetourSimulated) {
      const detour = DETOUR_NODES[0];
      updateDriverLocation(authenticatedDriverIdRef.current || selectedDriverId, detour.lat, detour.lng, 15);
    } else {
      const pt = interpolateRoutePoint(progress);
      updateDriverLocation(authenticatedDriverIdRef.current || selectedDriverId, pt.lat, pt.lng, 5);
    }
  };

  const toggleDetourSimulation = () => {
    const nextDetour = !isDetourSimulated;
    setIsDetourSimulated(nextDetour);
    broadcastSync('GPS_SIM_PROGRESS', { progress: simulationProgress, isDetour: nextDetour });

    if (nextDetour) {
      const detour = DETOUR_NODES[0];
      updateDriverLocation(authenticatedDriverIdRef.current || selectedDriverId, detour.lat, detour.lng, 15);
    } else {
      const pt = interpolateRoutePoint(simulationProgress);
      updateDriverLocation(authenticatedDriverIdRef.current || selectedDriverId, pt.lat, pt.lng, 5);
    }
  };

  useEffect(() => {
    if (!isSimulatingGPS) return;

    const interval = setInterval(() => {
      setSimulationProgressState((prev) => {
        let next = prev;
        if (simulationDirection === 'to_ramallah') {
          next = prev + 3;
          if (next >= 100) {
            next = 100;
            setSimulationDirection('to_kufr_malik');
          }
        } else {
          next = prev - 3;
          if (next <= 0) {
            next = 0;
            setSimulationDirection('to_ramallah');
          }
        }

        if (isDetourSimulated) {
          const detour = DETOUR_NODES[0];
          updateDriverLocation(authenticatedDriverIdRef.current || selectedDriverId, detour.lat, detour.lng, 15);
        } else {
          const pt = interpolateRoutePoint(next);
          updateDriverLocation(authenticatedDriverIdRef.current || selectedDriverId, pt.lat, pt.lng, 5);
        }

        broadcastSync('GPS_SIM_PROGRESS', { progress: next, isDetour: isDetourSimulated });
        return next;
      });
    }, 1500);

    return () => clearInterval(interval);
  }, [isSimulatingGPS, simulationDirection, isDetourSimulated, selectedDriverId, updateDriverLocation]);

  // Passenger counter
  const updateDriverPassengers = (id: string, count: number) => {
    const driver = drivers.find((candidate) => candidate.id === id);
    if (!driver || !Number.isInteger(count) || !Number.isInteger(driver.maxCapacity) || driver.maxCapacity < 1) return;
    const clamped = Math.max(0, Math.min(driver.maxCapacity, count));
    if (typeof window !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(20); } catch {}
    }
    const updated = drivers.map((d) =>
      d.id === id
        ? {
            ...d,
            passengers: clamped,
            seatCountUpdatedAt: Date.now(),
            lastActiveTime: Date.now(),
            autoPausedForInactivity: false,
            lastUpdated: new Date().toISOString()
          }
        : d
    );
    saveDrivers(updated);
  };

  const incrementPassengers = (id: string) => {
    const driver = drivers.find((d) => d.id === id);
    if (!driver) return;
    updateDriverPassengers(id, driver.passengers + 1);
  };

  const decrementPassengers = (id: string) => {
    const driver = drivers.find((d) => d.id === id);
    if (!driver) return;
    updateDriverPassengers(id, driver.passengers - 1);
  };

  const updateDriverNote = (id: string, noteEn: string, noteAr: string) => {
    const updated = drivers.map((d) =>
      d.id === id
        ? {
            ...d,
            departureNoteEn: noteEn,
            departureNoteAr: noteAr,
            lastActiveTime: Date.now(),
            autoPausedForInactivity: false,
            lastUpdated: new Date().toISOString()
          }
        : d
    );
    saveDrivers(updated);
  };


  // Simplified Seat Requests (Name + Seats only)
  const requestSeat = (
    driverId: string,
    passengerName: string,
    seatCount: number,
    phone?: string
  ) => {
    const primaryName = rememberVillagerName(passengerName);
    if (!primaryName) return;
    const newReq: SeatRequest = {
      id: `req-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      driverId,
      passengerName: primaryName,
      seatCount,
      phone,
      timestamp: Date.now(),
      status: 'pending'
    };

    const updated = [newReq, ...seatRequests];
    saveRequests(updated);
  };

  const acceptSeatRequest = (requestId: string) => {
    const next = acceptBooking(bookingStateRef.current, requestId, authenticatedDriverId, Date.now());
    if (!next) return false;
    bookingStateRef.current = next;
    saveDrivers(next.drivers);
    saveTripLogs(next.logs);
    saveRequests(next.requests);

    if (typeof window !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([40, 60, 40]); } catch {}
    }

    return true;
  };

  const declineSeatRequest = (requestId: string) => {
    if (typeof window !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(50); } catch {}
    }
    const updated = seatRequests.map((r) =>
      r.id === requestId ? { ...r, status: 'declined' as const } : r
    );
    saveRequests(updated);
  };

  const addTripLogEntry = (
    driverId: string,
    passengerName: string,
    seatCount: number,
    phone?: string
  ) => {
    const entry: TripLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 3)}`,
      driverId,
      passengerName,
      seatCount,
      phone,
      status: 'confirmed',
      confirmedAt: Date.now()
    };
    saveTripLogs([entry, ...tripLogs]);
  };

  const clearTripLog = (driverId: string) => {
    const updated = tripLogs.filter((l) => l.driverId !== driverId);
    saveTripLogs(updated);
    if (typeof window !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(30); } catch {}
    }
  };

  // Archive Current Trip & Reset Active Log for new trip
  const archiveCurrentTrip = (driverId: string) => {
    const now = Date.now();
    const formattedDate = new Date(now).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const latest = bookingStateRef.current;
    const next = archiveTrip({ drivers: latest.drivers, logs: latest.logs, history: tripHistoryRef.current },
      driverId, now, `arch-${now}-${Math.random().toString(36).slice(2, 8)}`, formattedDate, showDemoData);
    if (!next) return;
    // Commit all in-memory changes before another tap can use stale React state.
    bookingStateRef.current = { ...latest, drivers: next.drivers, logs: next.logs };
    tripHistoryRef.current = next.history;
    saveTripHistory(next.history);
    saveTripLogs(next.logs);
    saveDrivers(next.drivers);
    setDataNow(now);

    if (typeof window !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([30, 40, 30]); } catch {}
    }
  };

  const deleteArchivedTrip = (tripId: string) => {
    const updated = tripHistory.filter((t) => t.id !== tripId);
    saveTripHistory(updated);
  };

  const clearAllTripHistory = () => {
    saveTripHistory([]);
  };

  const resetAll = () => {
    authenticatedDriverIdRef.current = null;
    saveDrivers(INITIAL_DRIVERS);
    localStorage.removeItem(REQUESTS_KEY);
    localStorage.removeItem(TRIP_LOGS_KEY);
    localStorage.removeItem(TRIP_HISTORY_KEY);
    localStorage.removeItem(AUTH_DRIVER_KEY);
    localStorage.removeItem(ADMIN_AUTH_KEY);
    setAuthenticatedDriverId(null);
    setIsAdminAuthenticated(false);
    setSeatRequests([]);
    setTripLogs([]);
    setTripHistory([]);
    setIsSimulatingGPS(false);
    setIsDetourSimulated(false);
    stopRealGPSTracking();
  };

  const effectiveDriverId = authenticatedDriverId || selectedDriverId;
  const currentDriver = drivers.find((d) => d.id === effectiveDriverId) || drivers[0];

  return (
    <TransitContext.Provider
      value={{
        showDemoData,
        setShowDemoData,
        dataNow,
        isOnline,
        drivers,
        currentDriver,
        selectedDriverId,
        setSelectedDriverId,
        activeTab,
        setActiveTab,
        language,
        setLanguage,
        highContrast,
        setHighContrast,
        authenticatedDriverId,
        loginDriver,
        logoutDriver,
        villagerName,
        rememberVillagerName,
        activateDriverOnLogin,
        toggleDriverDuty,
        toggleDriverLateShift,
        setDriverPrayerShift,
        setDepartureCountdown,
        resumeDutyFromInactivity,
        updateDriverProfile,
        incrementPassengers,
        decrementPassengers,
        updateDriverPassengers,
        updateDriverNote,
        resetAll,
        isTrackingRealGPS,
        startRealGPSTracking,
        stopRealGPSTracking,
        gpsError,
        isSimulatingGPS,
        toggleGPSSimulation,
        simulationProgress,
        setSimulationProgress,
        simulationDirection,
        setSimulationDirection,
        isDetourSimulated,
        toggleDetourSimulation,
        seatRequests: showDemoData ? seatRequests : seatRequests.filter((request) => !isDemoRequest(request)),
        requestSeat,
        acceptSeatRequest,
        declineSeatRequest,
        tripLogs: showDemoData ? tripLogs : tripLogs.filter((entry) => !isDemoLog(entry)),
        tripHistory: showDemoData ? tripHistory : tripHistory.filter((trip) => !isDemoArchive(trip)),
        addTripLogEntry,
        clearTripLog,
        archiveCurrentTrip,
        deleteArchivedTrip,
        clearAllTripHistory,
        isAdminAuthenticated,
        adminLogin,
        adminLogout,
        adminUpdateDriver
      }}
    >
      {children}
    </TransitContext.Provider>
  );
};

export const useTransit = () => {
  const context = useContext(TransitContext);
  if (!context) throw new Error('useTransit must be used within a TransitProvider');
  return context;
};
