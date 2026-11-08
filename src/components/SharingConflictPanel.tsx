import React from 'react';
import { PRAYER_SHIFT_CONFIGS, DEPARTURE_COUNTDOWN_CONFIGS } from '../data/initialDrivers';
import { sharingSettingsSignature, type SharingConflict, type SharingResolution } from '../utils/sharingReconciliation';

export function SharingConflictPanel({ conflict, isAr, onResolve }: {
  conflict: SharingConflict; isAr: boolean; onResolve: (resolution: SharingResolution) => void;
}) {
  return <section aria-label={isAr ? 'تأكيد بيانات المشاركة' : 'Confirm sharing settings'}
    className="rounded-2xl p-3 bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100 border border-amber-300 space-y-3">
    <h4 className="font-bold">{isAr ? 'البيانات مختلفة. أيّ بيانات تريد استخدامها؟' : 'These settings differ. Which should we use?'}</h4>
    <p className="text-xs">{isAr ? 'لن نغيّر بياناتك أو نبدأ النشر حتى تختار.' : 'We will not replace your settings or start publishing until you choose.'}</p>
    {(['phone', 'published'] as const).map(choice => {
      const driver = choice === 'phone' ? conflict.local : conflict.published.snapshot;
      const shift = PRAYER_SHIFT_CONFIGS[driver.prayerShift || (driver.isLateShift ? 'after_maghrib' : 'regular_day')];
      const notice = driver.departureCountdown ? DEPARTURE_COUNTDOWN_CONFIGS[driver.departureCountdown] : null;
      return <div key={choice} className="bg-white dark:bg-slate-900 rounded-xl p-3 space-y-2 text-xs break-words">
        <strong>{choice === 'phone' ? (isAr ? 'المحفوظ على هذا الهاتف' : 'Saved on this phone') : (isAr ? 'آخر بيانات منشورة' : 'Last published settings')}</strong>
        <p>{driver.isOnDuty ? (isAr ? 'الدوام مفعّل' : 'On duty') : (isAr ? 'الدوام متوقف' : 'Off duty')}
          {' · '}{isAr ? 'الركاب المحفوظون: ' : 'Saved passengers: '}<bdi>{driver.passengers} / {driver.maxCapacity}</bdi></p>
        <p>{shift[isAr ? 'labelAr' : 'labelEn']}{' · '}{notice ? notice[isAr ? 'labelAr' : 'labelEn'] : (isAr ? 'دون تنبيه مغادرة' : 'No departure notice')}</p>
        {(driver.departureNoteAr || driver.departureNoteEn) && <p dir="auto">{isAr ? driver.departureNoteAr || driver.departureNoteEn : driver.departureNoteEn || driver.departureNoteAr}</p>}
        <button type="button" onClick={() => onResolve({ driverId: conflict.local.id, choice, revision: conflict.published.revision,
          localSignature: sharingSettingsSignature(conflict.local) })}
          className="w-full min-h-12 p-3 bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950 rounded-xl font-bold whitespace-normal">
          {choice === 'phone' ? (isAr ? 'استخدم بيانات هذا الهاتف' : 'Use this phone’s settings') : (isAr ? 'استخدم البيانات المنشورة' : 'Use published settings')}
        </button>
      </div>;
    })}
  </section>;
}
