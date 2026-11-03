import type { Driver, SeatRequest, TripLogEntry } from '../types';

export function bookingAcceptanceError(request: SeatRequest | undefined, driver: Driver | undefined) {
  if (!request || request.status !== 'pending') return 'not_pending';
  if (!driver || driver.id !== request.driverId) return 'driver_unavailable';
  if (!Number.isInteger(request.seatCount) || request.seatCount < 1) return 'invalid_seat_count';
  if (!Number.isInteger(driver.maxCapacity) || driver.maxCapacity < 1 ||
      !Number.isInteger(driver.passengers) || driver.passengers < 0) return 'invalid_capacity';
  if (driver.passengers + request.seatCount > driver.maxCapacity) return 'insufficient_seats';
  return null;
}

export interface BookingState {
  drivers: Driver[];
  requests: SeatRequest[];
  logs: TripLogEntry[];
}

// Produce all three changes together only after the request has passed validation.
export function acceptBooking(state: BookingState, requestId: string, driverId: string | null, now: number): BookingState | null {
  const request = state.requests.find((r) => r.id === requestId);
  const driver = state.drivers.find((d) => d.id === driverId);
  if (bookingAcceptanceError(request, driver)) return null;
  if (!request || !driver) return null;
  const logId = `booking-${request.id}`;
  if (state.logs.some((entry) => entry.id === logId)) return null;
  return {
    drivers: state.drivers.map((d) => d.id === driver.id ? {
      ...d, passengers: d.passengers + request.seatCount, lastActiveTime: now,
      autoPausedForInactivity: false, lastUpdated: new Date(now).toISOString()
    } : d),
    requests: state.requests.map((r) => r.id === request.id ? { ...r, status: 'accepted' } : r),
    logs: [{ id: logId, driverId: driver.id, passengerName: request.passengerName,
      seatCount: request.seatCount, phone: request.phone, status: 'confirmed', confirmedAt: now }, ...state.logs]
  };
}
