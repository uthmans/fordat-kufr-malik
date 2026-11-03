import { RouteNode } from '../types';

export const ROUTE_NODES: RouteNode[] = [
  {
    id: 'kufr_malik',
    nameEn: 'Kufr Malik',
    nameAr: 'كفر مالك',
    subEn: 'Kufr Malik',
    subAr: 'كفر مالك',
    lat: 31.9840,
    lng: 35.3115,
    order: 0,
    distanceKmFromStart: 0
  },
  {
    id: 'silwad',
    nameEn: 'Silwad',
    nameAr: 'سلواد',
    subEn: 'Silwad Bridge',
    subAr: 'مدخل وجسر سلواد',
    lat: 31.9790,
    lng: 35.2630,
    order: 1,
    distanceKmFromStart: 5.2
  },
  {
    id: 'yabroud_checkpoint',
    nameEn: 'Yabroud Checkpoint',
    nameAr: 'حاجز يبرود',
    subEn: 'Yabroud Intersection',
    subAr: 'مفترق وحاجز يبرود',
    lat: 31.9670,
    lng: 35.2440,
    order: 2,
    distanceKmFromStart: 8.5
  },
  {
    id: 'ein_sinia',
    nameEn: 'Ein Sinia',
    nameAr: 'عين سينيا',
    subEn: 'Ein Sinia Junction',
    subAr: 'مفرق عين سينيا',
    lat: 31.9610,
    lng: 35.2280,
    order: 3,
    distanceKmFromStart: 12.1
  },
  {
    id: 'al_jalazon',
    nameEn: 'Al Jalazon',
    nameAr: 'الجلزون',
    subEn: 'Al Jalazon / Surda Road',
    subAr: 'الجلزون وسردا',
    lat: 31.9390,
    lng: 35.2150,
    order: 4,
    distanceKmFromStart: 17.4
  },
  {
    id: 'ramallah',
    nameEn: 'Ramallah',
    nameAr: 'الموقف',
    subEn: 'Ramallah',
    subAr: 'الموقف',
    lat: 31.9038,
    lng: 35.2034,
    order: 5,
    distanceKmFromStart: 23.0
  }
];

export interface RamallahLandmarkNode {
  id: string;
  nameEn: string;
  nameAr: string;
  statusTextEn: string;
  statusTextAr: string;
  lat: number;
  lng: number;
  radiusMeters: number;
}

export const RAMALLAH_LANDMARKS: RamallahLandmarkNode[] = [
  {
    id: 'ramallah_station',
    nameEn: 'Ramallah (At Station)',
    nameAr: 'الموقف (جاهز للتحرك)',
    statusTextEn: 'in Ramallah (At Station)',
    statusTextAr: 'في الموقف (جاهز للتحرك)',
    lat: 31.9038,
    lng: 35.2034,
    radiusMeters: 450
  },
  {
    id: 'friends_school',
    nameEn: 'Near Friends School',
    nameAr: 'قريب من مدرسة الفرندز',
    statusTextEn: 'is near Friends School',
    statusTextAr: 'قريب من مدرسة الفرندز',
    lat: 31.9085,
    lng: 35.2050,
    radiusMeters: 400
  },
  {
    id: 'al_shini_market',
    nameEn: 'Near Al Shini Market',
    nameAr: 'قريب من سوبرماركت الشيني',
    statusTextEn: 'is near Al Shini Market',
    statusTextAr: 'قريب من سوبرماركت الشيني',
    lat: 31.9140,
    lng: 35.2065,
    radiusMeters: 450
  },
  {
    id: 'entering_ramallah',
    nameEn: 'Entering Ramallah',
    nameAr: 'داخل إلى رام الله',
    statusTextEn: 'is entering Ramallah',
    statusTextAr: 'داخل إلى رام الله',
    lat: 31.9230,
    lng: 35.2090,
    radiusMeters: 700
  }
];

export const DETOUR_NODES = [
  {
    id: 'turmusaya_detour',
    nameEn: 'Turmusaya Detour',
    nameAr: 'تحويلة ترمسعيا / سنجل',
    subEn: 'Northern Bypass (Route 60)',
    subAr: 'المسار الالتفافي الشمالي',
    lat: 32.0360,
    lng: 35.2860
  },
  {
    id: 'deir_dibwan_detour',
    nameEn: 'Deir Dibwan Detour',
    nameAr: 'تحويلة دير دبوان / برقة',
    subEn: 'Eastern Mountain Bypass',
    subAr: 'المسار الالتفافي الشرقي',
    lat: 31.9420,
    lng: 35.2810
  }
];
