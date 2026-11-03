import { Driver, DriverStatus, PrayerShiftPreset } from '../types';

export const INITIAL_DRIVERS: Driver[] = [
  {
    id: 'driver-1',
    nameEn: 'Alaa Hamayel',
    nameAr: 'علاء حمايل',
    phone: '+972597073155',
    pinCode: '1234',
    isOnDuty: true,
    isLateShift: true,
    prayerShift: 'after_maghrib',
    lastTripLabelEn: 'Active After Maghrib',
    lastTripLabelAr: 'شغال بعد المغرب',
    status: 'in_kufr_malik',
    passengers: 4,
    maxCapacity: 7,
    lastActiveTime: Date.now() - 5 * 60 * 1000,
    autoPausedForInactivity: false,
    lastUpdated: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    departureNoteEn: 'Boarding passengers in Kufr Malik',
    departureNoteAr: 'تحميل الركاب في كفر مالك',
    currentStopEn: 'Kufr Malik',
    currentStopAr: 'كفر مالك',
    proximityStatusEn: 'Alaa Hamayel is in Kufr Malik',
    proximityStatusAr: 'علاء حمايل في كفر مالك',
    currentLocation: {
      lat: 31.9840,
      lng: 35.3115,
      timestamp: Date.now(),
      accuracy: 8
    },
    detectedNodeId: 'kufr_malik',
    isDetour: false,
    gpsMode: 'simulation',
    bearing: 'stationary'
  },
  {
    id: 'driver-2',
    nameEn: 'Oday Hamayel',
    nameAr: 'عدي حمايل',
    phone: '+972599035608',
    pinCode: '1234',
    isOnDuty: true,
    isLateShift: false,
    prayerShift: 'regular_day',
    lastTripLabelEn: 'Regular Day Shift',
    lastTripLabelAr: 'دوام نهاري عادي',
    status: 'to_ramallah',
    passengers: 7,
    maxCapacity: 7,
    lastActiveTime: Date.now() - 4 * 60 * 1000,
    autoPausedForInactivity: false,
    lastUpdated: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    departureNoteEn: 'Passing Yabroud Checkpoint towards Ramallah',
    departureNoteAr: 'يمر من حاجز يبرود نحو الموقف',
    currentStopEn: 'Yabroud Checkpoint',
    currentStopAr: 'حاجز يبرود',
    proximityStatusEn: 'Oday Hamayel is passing Yabroud Checkpoint',
    proximityStatusAr: 'عدي حمايل يمر من حاجز يبرود',
    currentLocation: {
      lat: 31.9670,
      lng: 35.2440,
      timestamp: Date.now(),
      accuracy: 12
    },
    detectedNodeId: 'yabroud_checkpoint',
    isDetour: false,
    gpsMode: 'simulation',
    bearing: 'southbound'
  },
  {
    id: 'driver-3',
    nameEn: 'Abu Haroon',
    nameAr: 'أبو هارون',
    phone: '+972599394909',
    pinCode: '1234',
    isOnDuty: true,
    isLateShift: true,
    prayerShift: 'after_isha',
    departureCountdown: 'in_10_mins',
    departureCountdownSetAt: Date.now() - 2 * 60 * 1000,
    lastTripLabelEn: 'Active After Isha',
    lastTripLabelAr: 'شغال بعد العشاء',
    status: 'in_ramallah',
    passengers: 5,
    maxCapacity: 7,
    lastActiveTime: Date.now() - 1 * 60 * 1000,
    autoPausedForInactivity: false,
    lastUpdated: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
    departureNoteEn: 'Waiting at Ramallah Station',
    departureNoteAr: 'بانتظار الركاب في الموقف',
    currentStopEn: 'Ramallah (At Station)',
    currentStopAr: 'في الموقف (جاهز للتحرك)',
    proximityStatusEn: 'Abu Haroon in Ramallah (At Station)',
    proximityStatusAr: 'أبو هارون في الموقف (جاهز للتحرك)',
    currentLocation: {
      lat: 31.9038,
      lng: 35.2034,
      timestamp: Date.now(),
      accuracy: 6
    },
    detectedNodeId: 'ramallah',
    isDetour: false,
    gpsMode: 'simulation',
    bearing: 'stationary'
  },
  {
    id: 'driver-4',
    nameEn: 'Abu Qusai',
    nameAr: 'أبو قصي',
    phone: '+972599329031',
    pinCode: '1234',
    isOnDuty: true,
    isLateShift: false,
    prayerShift: 'regular_day',
    lastTripLabelEn: 'Regular Day Shift',
    lastTripLabelAr: 'دوام نهاري عادي',
    status: 'to_kufr_malik',
    passengers: 6,
    maxCapacity: 7,
    lastActiveTime: Date.now() - 3 * 60 * 1000,
    autoPausedForInactivity: false,
    lastUpdated: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    departureNoteEn: 'Heading back to Kufr Malik near Ein Sinia',
    departureNoteAr: 'في الطريق عائداً قرب عين سينيا',
    currentStopEn: 'Ein Sinia Junction',
    currentStopAr: 'مفرق عين سينيا',
    proximityStatusEn: 'Abu Qusai is near Ein Sinia Junction',
    proximityStatusAr: 'أبو قصي قرب مفرق عين سينيا',
    currentLocation: {
      lat: 31.9610,
      lng: 35.2280,
      timestamp: Date.now(),
      accuracy: 10
    },
    detectedNodeId: 'ein_sinia',
    isDetour: false,
    gpsMode: 'simulation',
    bearing: 'northbound'
  },
  {
    id: 'driver-5',
    nameEn: 'Sanad Adel',
    nameAr: 'سند عادل',
    phone: '+972595552626',
    pinCode: '1234',
    isOnDuty: true,
    isLateShift: false,
    prayerShift: 'regular_day',
    lastTripLabelEn: 'Regular Day Shift',
    lastTripLabelAr: 'دوام نهاري عادي',
    status: 'in_kufr_malik',
    passengers: 1,
    maxCapacity: 7,
    lastActiveTime: Date.now() - 6 * 60 * 1000,
    autoPausedForInactivity: false,
    lastUpdated: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
    departureNoteEn: 'Loading passengers in Kufr Malik',
    departureNoteAr: 'تحميل الركاب في كفر مالك',
    currentStopEn: 'Kufr Malik',
    currentStopAr: 'كفر مالك',
    proximityStatusEn: 'Sanad Adel is in Kufr Malik',
    proximityStatusAr: 'سند عادل في كفر مالك',
    currentLocation: {
      lat: 31.9840,
      lng: 35.3115,
      timestamp: Date.now(),
      accuracy: 8
    },
    detectedNodeId: 'kufr_malik',
    isDetour: false,
    gpsMode: 'simulation',
    bearing: 'stationary'
  },
  {
    id: 'driver-6',
    nameEn: 'Wahid',
    nameAr: 'وحيد',
    phone: '+972599232930',
    pinCode: '1234',
    isOnDuty: true,
    isLateShift: true,
    prayerShift: 'after_maghrib',
    lastTripLabelEn: 'Active After Maghrib',
    lastTripLabelAr: 'شغال بعد المغرب',
    status: 'to_ramallah',
    passengers: 3,
    maxCapacity: 7,
    lastActiveTime: Date.now() - 7 * 60 * 1000,
    autoPausedForInactivity: false,
    lastUpdated: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
    departureNoteEn: 'Near Al Shini Market',
    departureNoteAr: 'قريب من سوبرماركت الشيني',
    currentStopEn: 'Near Al Shini Market',
    currentStopAr: 'قريب من سوبرماركت الشيني',
    proximityStatusEn: 'Wahid is near Al Shini Market',
    proximityStatusAr: 'وحيد قريب من سوبرماركت الشيني',
    currentLocation: {
      lat: 31.9140,
      lng: 35.2065,
      timestamp: Date.now(),
      accuracy: 10
    },
    detectedNodeId: 'ramallah',
    isDetour: false,
    gpsMode: 'simulation',
    bearing: 'southbound'
  },
  {
    id: 'driver-7',
    nameEn: 'Neman Moadi',
    nameAr: 'نعمان معدي',
    phone: '+970599200740',
    pinCode: '1234',
    isOnDuty: true,
    isLateShift: false,
    prayerShift: 'final_trip',
    departureCountdown: 'in_5_mins',
    departureCountdownSetAt: Date.now() - 1 * 60 * 1000,
    lastTripLabelEn: 'Final Round Trip',
    lastTripLabelAr: 'آخر رحلة قريبة',
    status: 'in_ramallah',
    passengers: 4,
    maxCapacity: 7,
    lastActiveTime: Date.now() - 10 * 60 * 1000,
    autoPausedForInactivity: false,
    lastUpdated: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    departureNoteEn: 'Waiting at Ramallah Station',
    departureNoteAr: 'بانتظار الركاب في الموقف',
    currentStopEn: 'Ramallah (At Station)',
    currentStopAr: 'في الموقف (جاهز للتحرك)',
    proximityStatusEn: 'Neman Moadi in Ramallah (At Station)',
    proximityStatusAr: 'نعمان معدي في الموقف (جاهز للتحرك)',
    currentLocation: {
      lat: 31.9038,
      lng: 35.2034,
      timestamp: Date.now(),
      accuracy: 7
    },
    detectedNodeId: 'ramallah',
    isDetour: false,
    gpsMode: 'simulation',
    bearing: 'stationary'
  },
  {
    id: 'driver-8',
    nameEn: 'Akram Abu El Noor',
    nameAr: 'أكرم أبو النور',
    phone: '+972599374234',
    pinCode: '1234',
    isOnDuty: false,
    isLateShift: true,
    prayerShift: 'after_isha',
    lastTripLabelEn: 'Active After Isha',
    lastTripLabelAr: 'شغال بعد العشاء',
    status: 'in_kufr_malik',
    passengers: 0,
    maxCapacity: 7,
    lastActiveTime: Date.now() - 30 * 60 * 1000,
    autoPausedForInactivity: false,
    lastUpdated: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    departureNoteEn: 'Off Duty - Active after Isha prayer',
    departureNoteAr: 'غير متاح حالياً - شغال بعد العشاء',
    currentStopEn: 'Kufr Malik',
    currentStopAr: 'كفر مالك',
    proximityStatusEn: 'Akram Abu El Noor is in Kufr Malik',
    proximityStatusAr: 'أكرم أبو النور في كفر مالك',
    currentLocation: {
      lat: 31.9840,
      lng: 35.3115,
      timestamp: Date.now(),
      accuracy: 8
    },
    detectedNodeId: 'kufr_malik',
    isDetour: false,
    gpsMode: 'simulation',
    bearing: 'stationary'
  }
];


export interface StatusConfig {
  key: DriverStatus;
  labelEn: string;
  labelAr: string;
  subEn: string;
  subAr: string;
  color: {
    bg: string;
    border: string;
    text: string;
    badgeBg: string;
    accent: string;
  };
  iconName: string;
}

export const STATUS_CONFIGS: Record<DriverStatus, StatusConfig> = {
  in_kufr_malik: {
    key: 'in_kufr_malik',
    labelEn: 'In Kufr Malik',
    labelAr: 'في كفر مالك',
    subEn: 'Kufr Malik',
    subAr: 'كفر مالك',
    color: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      border: 'border-emerald-500',
      text: 'text-emerald-800 dark:text-emerald-300',
      badgeBg: 'bg-emerald-600 text-white',
      accent: '#059669'
    },
    iconName: 'MapPin'
  },
  to_ramallah: {
    key: 'to_ramallah',
    labelEn: 'On the way to Ramallah',
    labelAr: 'في الطريق إلى الموقف',
    subEn: 'Southbound',
    subAr: 'على الطريق',
    color: {
      bg: 'bg-blue-50 dark:bg-blue-950/40',
      border: 'border-blue-500',
      text: 'text-blue-800 dark:text-blue-300',
      badgeBg: 'bg-blue-600 text-white',
      accent: '#2563eb'
    },
    iconName: 'ArrowRight'
  },
  in_ramallah: {
    key: 'in_ramallah',
    labelEn: 'In Ramallah',
    labelAr: 'في الموقف',
    subEn: 'Ramallah',
    subAr: 'الموقف',
    color: {
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      border: 'border-amber-500',
      text: 'text-amber-800 dark:text-amber-300',
      badgeBg: 'bg-amber-600 text-white',
      accent: '#d97706'
    },
    iconName: 'Building2'
  },
  to_kufr_malik: {
    key: 'to_kufr_malik',
    labelEn: 'Heading back to Kufr Malik',
    labelAr: 'في الطريق إلى كفر مالك',
    subEn: 'Northbound',
    subAr: 'عائد للبلد',
    color: {
      bg: 'bg-purple-50 dark:bg-purple-950/40',
      border: 'border-purple-500',
      text: 'text-purple-800 dark:text-purple-300',
      badgeBg: 'bg-purple-600 text-white',
      accent: '#7c3aed'
    },
    iconName: 'ArrowLeft'
  },
  detour: {
    key: 'detour',
    labelEn: 'Detour Active',
    labelAr: 'مسار بديل',
    subEn: 'Bypass route',
    subAr: 'طريق التفافي',
    color: {
      bg: 'bg-orange-50 dark:bg-orange-950/40',
      border: 'border-orange-500',
      text: 'text-orange-800 dark:text-orange-300',
      badgeBg: 'bg-orange-600 text-white',
      accent: '#ea580c'
    },
    iconName: 'AlertTriangle'
  }
};

export interface PrayerShiftConfig {
  key: PrayerShiftPreset;
  labelEn: string;
  labelAr: string;
  subEn: string;
  subAr: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  iconName: string;
}

export const PRAYER_SHIFT_CONFIGS: Record<PrayerShiftPreset, PrayerShiftConfig> = {
  regular_day: {
    key: 'regular_day',
    labelEn: 'Regular Day Shift',
    labelAr: 'دوام نهاري عادي',
    subEn: 'Standard daily shifts',
    subAr: 'رحلات نهارية اعتيادية',
    badgeBg: 'bg-slate-100 dark:bg-slate-800',
    badgeBorder: 'border-slate-300 dark:border-slate-700',
    badgeText: 'text-slate-700 dark:text-slate-300',
    iconName: 'Sun'
  },
  after_maghrib: {
    key: 'after_maghrib',
    labelEn: 'Active After Maghrib',
    labelAr: 'شغال بعد المغرب',
    subEn: 'Post-Maghrib evening trips',
    subAr: 'مناوبة بعد صلاة المغرب',
    badgeBg: 'bg-amber-100 dark:bg-amber-950/60',
    badgeBorder: 'border-amber-300 dark:border-amber-700/60',
    badgeText: 'text-amber-800 dark:text-amber-300',
    iconName: 'Sunset'
  },
  after_isha: {
    key: 'after_isha',
    labelEn: 'Active After Isha',
    labelAr: 'شغال بعد العشاء',
    subEn: 'Late night service',
    subAr: 'مناوبة ليلية متأخرة بعد العشاء',
    badgeBg: 'bg-purple-100 dark:bg-purple-950/60',
    badgeBorder: 'border-purple-300 dark:border-purple-700/60',
    badgeText: 'text-purple-800 dark:text-purple-300',
    iconName: 'Moon'
  },
  final_trip: {
    key: 'final_trip',
    labelEn: 'Final Round Trip',
    labelAr: 'آخر رحلة قريبة',
    subEn: 'Last departure soon',
    subAr: 'الرحلة الأخيرة لليوم قريباً',
    badgeBg: 'bg-rose-100 dark:bg-rose-950/60',
    badgeBorder: 'border-rose-300 dark:border-rose-700/60',
    badgeText: 'text-rose-800 dark:text-rose-300',
    iconName: 'Flag'
  }
};

export interface DepartureCountdownConfig {
  key: 'leaving_now' | 'in_5_mins' | 'in_10_mins';
  labelEn: string;
  labelAr: string;
  pillBg: string;
  pillText: string;
  dotColor: string;
}

export const DEPARTURE_COUNTDOWN_CONFIGS: Record<'leaving_now' | 'in_5_mins' | 'in_10_mins', DepartureCountdownConfig> = {
  in_10_mins: {
    key: 'in_10_mins',
    labelEn: 'Departing in 10 mins',
    labelAr: 'طالع كمان 10 دقائق',
    pillBg: 'bg-amber-500 text-slate-950 shadow-sm ring-2 ring-amber-300/60',
    pillText: 'text-amber-600 dark:text-amber-400',
    dotColor: 'bg-amber-400'
  },
  in_5_mins: {
    key: 'in_5_mins',
    labelEn: 'Departing in 5 mins',
    labelAr: 'طالع كمان 5 دقائق',
    pillBg: 'bg-orange-500 text-white shadow-sm ring-2 ring-orange-300/60',
    pillText: 'text-orange-600 dark:text-orange-400',
    dotColor: 'bg-orange-400 animate-ping'
  },
  leaving_now: {
    key: 'leaving_now',
    labelEn: 'Leaving Now',
    labelAr: 'طالع الآن',
    pillBg: 'bg-rose-600 text-white shadow-md ring-2 ring-rose-400/80 animate-pulse',
    pillText: 'text-rose-600 dark:text-rose-400',
    dotColor: 'bg-white animate-ping'
  }
};

