import { normalizeVillagerName } from './identityStorage';
import { buildVillagerReservationUrl, cleanWhatsAppNumber } from './whatsapp';

interface ReservationInput {
  driverId: string;
  phone: string;
  name: string;
  seats: number;
  capacity: number;
  isArabic: boolean;
}

export interface PreparedReservation {
  driverId: string;
  name: string;
  seats: number;
  url: string;
  message: string;
}

type HandoffResult = { ok: true; value: PreparedReservation } |
  { ok: false; error: 'name' | 'seats' | 'phone' | 'request' };

// One controller per modal session: retrying the chat link does not submit again.
export class ReservationHandoff {
  private prepared: PreparedReservation | null = null;

  reset() { this.prepared = null; }

  submit(input: ReservationInput, save: (reservation: PreparedReservation) => unknown, open: (url: string) => void): HandoffResult {
    if (this.prepared) return { ok: true, value: this.prepared };
    const name = normalizeVillagerName(input.name);
    if (!name) return { ok: false, error: 'name' };
    if (!Number.isInteger(input.seats) || input.seats < 1 || !Number.isInteger(input.capacity) || input.seats > input.capacity) {
      return { ok: false, error: 'seats' };
    }
    if (!/^[1-9]\d{7,14}$/.test(cleanWhatsAppNumber(input.phone))) return { ok: false, error: 'phone' };
    const url = buildVillagerReservationUrl(input.phone, name, input.seats, input.isArabic);
    const reservation = { driverId: input.driverId, name, seats: input.seats, url, message: new URL(url).searchParams.get('text') || '' };
    // Only mark the handoff ready after the current app state accepts the request.
    // Explicit false or a thrown error leaves the draft retryable and unopened.
    try {
      if (save(reservation) === false) return { ok: false, error: 'request' };
    } catch { return { ok: false, error: 'request' }; }
    this.prepared = reservation;
    // Keep this synchronous inside the submit tap. No timer or awaited work.
    // A null window handle with noopener does not reliably indicate popup failure.
    try { open(url); } catch { /* The modal retains a native retry link. */ }
    return { ok: true, value: reservation };
  }
}
