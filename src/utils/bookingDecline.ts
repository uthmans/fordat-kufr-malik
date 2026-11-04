import type { BookingState } from './bookingAcceptance';

// Decline is a pending-request action, not cancellation of a confirmed booking.
export function declineBooking(state: BookingState, requestId: string, driverId: string | null) {
  if (!driverId || !state.drivers.some(driver => driver.id === driverId)) return null;
  const request = state.requests.find(item => item.id === requestId);
  if (!request || request.driverId !== driverId || request.status !== 'pending') return null;
  // Also reject an inconsistent/stale request snapshot with an existing acceptance.
  if (state.logs.some(entry => entry.id === `booking-${requestId}`)) return null;
  return state.requests.map(item => item.id === requestId ? { ...item, status: 'declined' as const } : item);
}
