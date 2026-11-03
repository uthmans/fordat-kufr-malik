import type { GPSLocation } from '../types';
import { getDistanceMeters, getRouteProgressPercent } from './geo';

// Keep an anchor until movement is larger than GPS uncertainty. This lets small
// updates accumulate instead of requiring a large jump between consecutive fixes.
export function inferRouteDirection(current: GPSLocation, anchor?: GPSLocation) {
  const stationary = { bearing: 'stationary' as const, anchor: current };
  if (!anchor || ![anchor.lat, anchor.lng, anchor.timestamp].every(Number.isFinite) ||
      Math.abs(anchor.lat) > 90 || Math.abs(anchor.lng) > 180 ||
      current.timestamp - anchor.timestamp > 120000) return stationary;
  if (current.timestamp <= anchor.timestamp) return { bearing: 'stationary' as const, anchor };
  const uncertainty = Math.max(25, (anchor.accuracy || 0) + (current.accuracy || 0));
  const distance = getDistanceMeters(anchor.lat, anchor.lng, current.lat, current.lng);
  const progressChange = getRouteProgressPercent(current.lat, current.lng) - getRouteProgressPercent(anchor.lat, anchor.lng);
  if (distance <= uncertainty || Math.abs(progressChange) / 100 * 23000 <= uncertainty) {
    return { bearing: 'stationary' as const, anchor };
  }
  return { bearing: progressChange > 0 ? 'southbound' as const : 'northbound' as const, anchor: current };
}
