/**
 * WhatsApp integration & Phone formatting utilities
 */

export function cleanWhatsAppNumber(phone: string): string {
  let cleaned = phone.replace(/[^0-9]/g, '');
  // If local Palestinian mobile starting with 059 or 056, convert to 9705x
  if (cleaned.startsWith('05')) {
    cleaned = '970' + cleaned.substring(1);
  }
  return cleaned;
}

export function buildVillagerReservationUrl(
  driverPhone: string,
  passengerName: string,
  seatsCount: number,
  isAr: boolean
): string {
  const cleanPhone = cleanWhatsAppNumber(driverPhone);
  const seatsTextAr = seatsCount === 1 ? 'مقعد واحد' : seatsCount === 2 ? 'مقعدين' : `${seatsCount} مقاعد`;
  const seatsTextEn = seatsCount === 1 ? '1 seat' : `${seatsCount} seats`;
  const message = isAr
    ? `سلام عليكم، أنا ${passengerName || 'أحد الركاب'}، حابب أحجز ${seatsTextAr}`
    : `Salam alaykum, I am ${passengerName || 'a passenger'}, I would like to reserve ${seatsTextEn}`;

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}


export function buildDriverConfirmationUrl(
  passengerPhone: string,
  isAr: boolean
): string {
  const cleanPhone = cleanWhatsAppNumber(passengerPhone);
  const message = isAr
    ? 'تم تأكيد حجزك، أنا بالدرب إليك'
    : 'Your reservation is confirmed, I am on the way to you';

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

export function buildGeneralDriverWhatsAppUrl(
  driverPhone: string,
  driverName: string,
  isAr: boolean
): string {
  const cleanPhone = cleanWhatsAppNumber(driverPhone);
  const message = isAr
    ? `سلام عليكم يا ${driverName}، هل يوجد متسع في سيارتك؟`
    : `Salam alaykum ${driverName}, do you have seats available?`;

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}
