import React from 'react';
import type { PublicationState } from '../utils/sharedAvailability';

const messages: Record<PublicationState, [string, string]> = {
  stopped: ['المشاركة متوقفة. تغييرات هذا الهاتف لا تصل للركاب. ابدأ المشاركة ثم تأكد من الدوام وعدد الركاب.', 'Sharing is stopped. Changes on this phone are not reaching passengers. Start sharing, then confirm duty and passenger count.'],
  offline: ['انقطع الإنترنت. لا يمكن إرسال تحديثات جديدة للركاب حالياً.', 'You are offline. New updates cannot reach passengers right now.'],
  gps_error: ['توجد مشكلة في الموقع. لا تعتمد على استمرار مشاركة موقعك حتى تُحلّ.', 'There is a location problem. Location sharing may be interrupted until it is resolved.'],
  waiting: ['جارٍ انتظار تأكيد أول تحديث منشور. لم نتأكد بعد من وصوله للركاب.', 'Waiting for confirmation of a published update. Delivery to passengers is not confirmed yet.'],
  stale: ['آخر تحديث قديم. موقعك الحالي غير مؤكد للركاب. تحقق من GPS والإنترنت.', 'The last update is out of date. Passengers cannot confirm your current location. Check GPS and internet.'],
  pending: ['لديك تغييرات بانتظار النشر. ما زال الركاب يرون آخر تحديث مؤكد.', 'Changes are waiting to be published. Passengers still see the last confirmed update.'],
  live: ['تم تأكيد نشر موقعك وتحديثاتك للركاب.', 'Your location and updates have been confirmed as published to passengers.'],
  off_duty: ['تم نشر أنك خارج الدوام. لا يُنشر موقعك الدقيق وأنت خارج الدوام.', 'Your off-duty status is published. Your precise location is not published while off duty.']
};

export function PublicationStatus({ state, isAr }: { state: PublicationState; isAr: boolean }) {
  return <p role="status" className={`text-xs leading-relaxed font-bold p-3 rounded-xl ${state === 'live'
    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
    : 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'}`}>
    {messages[state][isAr ? 0 : 1]}
  </p>;
}
