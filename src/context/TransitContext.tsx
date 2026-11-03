import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Driver, DriverStatus, Language, ActiveTab, SeatRequest, TripLogEntry, ArchivedTrip, PrayerShiftPreset, DepartureCountdown } from '../types';
import { INITIAL_DRIVERS, PRAYER_SHIFT_CONFIGS } from '../data/initialDrivers';
import { DETOUR_NODES } from '../data/routeNodes';
import { evaluateGPSLocation, interpolateRoutePoint } from '../utils/geo';
import { acceptBooking, BookingState } from '../utils/bookingAcceptance';
import { AUTH_DRIVER_KEY, VILLAGER_NAME_KEY, normalizeVillagerName, readDriverSession, readVillagerName, storeIdentity } from '../utils/identityStorage';

const DRIVERS_KEY = 'kufr_malik_transit_drivers_v8';
const REQUESTS_KEY = 'kufr_malik_transit_requests_v6';
const TRIP_LOGS_KEY = 'kufr_malik_transit_triplogs_v6';
const TRIP_HISTORY_KEY = 'kufr_malik_transit_history_v6';
const ADMIN_AUTH_KEY = 'kufr_malik_admin_auth_v6';
const LANG_KEY = 'kufr_malik_transit_lang';
const CONTRAST_KEY = 'kufr_malik_transit_contrast';

const MASTER_ADMIN_PIN = '9999';

interface TransitContextType {
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
  const [drivers, setDrivers] = useState<Driver[]>(() => {
    try {
      const saved = localStorage.getItem(DRIVERS_KEY) || localStorage.getItem('kufr_malik_transit_drivers_v7');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 8 && parsed[0].nameEn) {
          return parsed.map((d: Driver) => ({
            ...d,
            prayerShift: d.prayerShift || (d.isLateShift ? 'after_maghrib' : 'regular_day'),
            lastActiveTime: d.lastActiveTime || Date.now(),
            autoPausedForInactivity: d.autoPausedForInactivity || false
          }));
        }
      }
    } catch {}
    return INITIAL_DRIVERS;
  });


  // Restore only a known roster ID, including sessions saved by older app versions.
  const [authenticatedDriverId, setAuthenticatedDriverId] = useState<string | null>(() => readDriverSession(drivers));
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
  const [seatRequests, setSeatRequests] = useState<SeatRequest[]>(() => {
    try {
      const saved = localStorage.getItem(REQUESTS_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'req-sample-1',
        driverId: 'driver-1',
        passengerName: 'Ahmad Kanaan',
        seatCount: 1,
        phone: '+972599111222',
        timestamp: Date.now() - 5 * 60 * 1000,
        status: 'pending'
      },
      {
        id: 'req-sample-2',
        driverId: 'driver-3',
        passengerName: 'Um Mohammad',
        seatCount: 2,
        phone: '+972598333444',
        timestamp: Date.now() - 2 * 60 * 1000,
        status: 'pending'
      }
    ];
  });

  // Active Trip Log (passengers for current round)
  const [tripLogs, setTripLogs] = useState<TripLogEntry[]>(() => {
    try {
      const saved = localStorage.getItem(TRIP_LOGS_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'log-1',
        driverId: 'driver-1',
        passengerName: 'Zaid Khader',
        seatCount: 2,
        phone: '+972599555666',
        status: 'confirmed',
        confirmedAt: Date.now() - 15 * 60 * 1000
      },
      {
        id: 'log-2',
        driverId: 'driver-1',
        passengerName: 'Ibrahim Hamed',
        seatCount: 1,
        phone: '+972568777888',
        status: 'confirmed',
        confirmedAt: Date.now() - 8 * 60 * 1000
      }
    ];
  });

  // Archived Trips History
  const [tripHistory, setTripHistory] = useState<ArchivedTrip[]>(() => {
    try {
      const saved = localStorage.getItem(TRIP_HISTORY_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'arch-1',
        driverId: 'driver-1',
        timestamp: Date.now() - 2 * 3600 * 1000,
        formattedDate: 'Today, 08:30 AM',
        passengersCount: 7,
        locationStatus: 'in_ramallah',
        entries: [
          { id: 'h-1', driverId: 'driver-1', passengerName: 'Abu Fadi', seatCount: 2, phone: '+972599112233', status: 'confirmed', confirmedAt: Date.now() - 3 * 3600 * 1000 },
          { id: 'h-2', driverId: 'driver-1', passengerName: 'Khaled', seatCount: 3, phone: '+972598223344', status: 'confirmed', confirmedAt: Date.now() - 2.8 * 3600 * 1000 },
          { id: 'h-3', driverId: 'driver-1', passengerName: 'Tariq', seatCount: 2, phone: '+972569334455', status: 'confirmed', confirmedAt: Date.now() - 2.5 * 3600 * 1000 }
        ]
      }
    ];
  });

  // Read the latest accepted changes even before React renders a second tap.
  const bookingStateRef = useRef<BookingState>({ drivers, requests: seatRequests, logs: tripLogs });
  bookingStateRef.current = { drivers, requests: seatRequests, logs: tripLogs };

  // Real GPS state
  const [isTrackingRealGPS, setIsTrackingRealGPS] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

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
    setTripHistory(newHistory);
    try { localStorage.setItem(TRIP_HISTORY_KEY, JSON.stringify(newHistory)); } catch {}
    broadcastSync('UPDATE_TRIP_HISTORY', newHistory);
  }, []);

  // Multi-tab listener
  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    const channel = new BroadcastChannel('kufr_malik_transit_hub_v6');

    channel.onmessage = (event) => {
      const { type, payload } = event.data || {};
      if (type === 'UPDATE_DRIVERS' && Array.isArray(payload)) {
        bookingStateRef.current.drivers = payload;
        setDrivers(payload);
      } else if (type === 'UPDATE_REQUESTS' && Array.isArray(payload)) {
        bookingStateRef.current.requests = payload;
        setSeatRequests(payload);
      } else if (type === 'UPDATE_TRIP_LOGS' && Array.isArray(payload)) {
        bookingStateRef.current.logs = payload;
        setTripLogs(payload);
      } else if (type === 'UPDATE_TRIP_HISTORY' && Array.isArray(payload)) {
        setTripHistory(payload);
      } else if (type === 'GPS_SIM_PROGRESS') {
        if (typeof payload?.progress === 'number') {
          setSimulationProgressState(payload.progress);
        }
        if (typeof payload?.isDetour === 'boolean') {
          setIsDetourSimulated(payload.isDetour);
        }
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

    // PIN check against driver pin, default 1234, or Master admin 9999
    if (driver.pinCode === pin || pin === '1234' || pin === MASTER_ADMIN_PIN) {
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
    const updated = drivers.map((d) => {
      if (d.id === driverId) {
        return {
          ...d,
          departureCountdown: countdown,
          departureCountdownSetAt: countdown ? Date.now() : undefined,
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
    const FORTY_FIVE_MINS = 45 * 60 * 1000;
    const interval = setInterval(() => {
      const now = Date.now();
      setDrivers((prev) => {
        let hasChanges = false;
        const updated = prev.map((d) => {
          if (
            d.isOnDuty &&
            d.status === 'in_kufr_malik' &&
            d.lastActiveTime &&
            now - d.lastActiveTime > FORTY_FIVE_MINS
          ) {
            hasChanges = true;
            return {
              ...d,
              isOnDuty: false,
              autoPausedForInactivity: true,
              lastUpdated: new Date().toISOString()
            };
          }
          return d;
        });

        if (hasChanges) {
          try { localStorage.setItem(DRIVERS_KEY, JSON.stringify(updated)); } catch {}
          broadcastSync('UPDATE_DRIVERS', updated);
          return updated;
        }
        return prev;
      });
    }, 30000);

    return () => clearInterval(interval);
  }, []);


  // Driver Profile Updates (by driver or admin)
  const updateDriverProfile = (driverId: string, updates: Partial<Driver>) => {
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
  const updateDriverLocation = useCallback((driverId: string, lat: number, lng: number, accuracy?: number) => {
    setDrivers((prevDrivers) => {
      const target = prevDrivers.find((d) => d.id === driverId);
      if (!target) return prevDrivers;

      const analysis = evaluateGPSLocation(
        lat,
        lng,
        target.currentLocation ? 50 : 0,
        target.nameEn,
        target.nameAr
      );

      const updated = prevDrivers.map((d) => {
        if (d.id === driverId) {
          return {
            ...d,
            status: analysis.status,
            currentLocation: {
              lat,
              lng,
              accuracy: accuracy || 10,
              timestamp: Date.now()
            },
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
    if (!navigator.geolocation) {
      setGpsError(language === 'ar' ? 'نظام GPS غير مدعوم في هذا المتصفح' : 'Geolocation is not supported');
      return;
    }

    setGpsError(null);
    setIsTrackingRealGPS(true);
    setIsSimulatingGPS(false);

    try {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          setGpsError(null);
          updateDriverLocation(
            selectedDriverId,
            pos.coords.latitude,
            pos.coords.longitude,
            pos.coords.accuracy
          );
        },
        (err) => {
          setGpsError(err.message || 'GPS Signal Lost');
        },
        {
          enableHighAccuracy: true,
          maximumAge: 1000,
          timeout: 10000
        }
      );
    } catch (e: any) {
      setGpsError(e.message || 'Error initializing GPS');
    }
  };

  const stopRealGPSTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTrackingRealGPS(false);
  };

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
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
      updateDriverLocation(selectedDriverId, detour.lat, detour.lng, 15);
    } else {
      const pt = interpolateRoutePoint(progress);
      updateDriverLocation(selectedDriverId, pt.lat, pt.lng, 5);
    }
  };

  const toggleDetourSimulation = () => {
    const nextDetour = !isDetourSimulated;
    setIsDetourSimulated(nextDetour);
    broadcastSync('GPS_SIM_PROGRESS', { progress: simulationProgress, isDetour: nextDetour });

    if (nextDetour) {
      const detour = DETOUR_NODES[0];
      updateDriverLocation(selectedDriverId, detour.lat, detour.lng, 15);
    } else {
      const pt = interpolateRoutePoint(simulationProgress);
      updateDriverLocation(selectedDriverId, pt.lat, pt.lng, 5);
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
          updateDriverLocation(selectedDriverId, detour.lat, detour.lng, 15);
        } else {
          const pt = interpolateRoutePoint(next);
          updateDriverLocation(selectedDriverId, pt.lat, pt.lng, 5);
        }

        broadcastSync('GPS_SIM_PROGRESS', { progress: next, isDetour: isDetourSimulated });
        return next;
      });
    }, 1500);

    return () => clearInterval(interval);
  }, [isSimulatingGPS, simulationDirection, isDetourSimulated, selectedDriverId, updateDriverLocation]);

  // Passenger counter
  const updateDriverPassengers = (id: string, count: number) => {
    const clamped = Math.max(0, Math.min(7, count));
    if (typeof window !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(20); } catch {}
    }
    const updated = drivers.map((d) =>
      d.id === id
        ? {
            ...d,
            passengers: clamped,
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
    const driver = drivers.find((d) => d.id === driverId);
    const driverEntries = tripLogs.filter((l) => l.driverId === driverId);
    const totalSeats = driverEntries.reduce((sum, e) => sum + e.seatCount, 0) || (driver?.passengers ?? 0);

    const now = new Date();
    const formattedDate = now.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const newArchivedTrip: ArchivedTrip = {
      id: `arch-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      driverId,
      timestamp: Date.now(),
      formattedDate,
      passengersCount: Math.min(7, totalSeats),
      locationStatus: driver?.status || 'in_kufr_malik',
      entries: driverEntries
    };

    saveTripHistory([newArchivedTrip, ...tripHistory]);
    clearTripLog(driverId);
    updateDriverPassengers(driverId, 0);

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
        seatRequests,
        requestSeat,
        acceptSeatRequest,
        declineSeatRequest,
        tripLogs,
        tripHistory,
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
