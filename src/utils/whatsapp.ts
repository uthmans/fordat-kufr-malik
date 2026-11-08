/**
 * WhatsApp integration & Phone formatting utilities
 */

export function cleanWhatsAppNumber(phone: string): string {
  // Arabic and Persian keyboard digits must be converted before punctuation and
  // RTL formatting marks are removed, otherwise the actual number is lost.
  let cleaned = phone
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[^0-9]/g, '');
  // wa.me uses country-code digits without an international dial-out prefix.
  if (cleaned.startsWith('00')) cleaned = cleaned.substring(2);
  // If local Palestinian mobile starting with 059 or 056, convert to 9705x
  if (cleaned.startsWith('05')) {
    cleaned = '970' + cleaned.substring(1);
  }
  return cleaned;
}

export function buildDriverCallUrl(phone: string): string | null {
  const number = cleanWhatsAppNumber(phone);
  return /^[1-9]\d{7,14}$/.test(number) ? `tel:+${number}` : null;
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
