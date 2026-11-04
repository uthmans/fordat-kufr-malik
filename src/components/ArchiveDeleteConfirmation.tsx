import React from 'react';

export function ArchiveDeleteConfirmation({ count, isAr, onCancel, onConfirm }: { count: number; isAr: boolean; onCancel(): void; onConfirm(): void }) {
  return <div className="fixed inset-0 z-50 bg-slate-950/70 p-4 flex items-center justify-center">
    <section role="alertdialog" aria-modal="true" aria-labelledby="archive-delete-title" aria-describedby="archive-delete-description"
      className="w-full max-w-sm max-h-[85dvh] overflow-y-auto rounded-3xl p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4">
      <h3 id="archive-delete-title" className="font-black text-base text-slate-900 dark:text-white">{isAr ? 'تأكيد حذف الرحلات المحفوظة' : 'Delete saved trips?'}</h3>
      <p id="archive-delete-description" className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        {isAr ? `سيتم حذف ${count} من الرحلات المحفوظة المحددة. لا يمكن التراجع. الرحلات المضافة بعد فتح هذه النافذة ستبقى محفوظة.`
          : `This permanently deletes ${count} selected saved ${count === 1 ? 'trip' : 'trips'}. Trips added after this dialog opened will be kept.`}
      </p>
      <div className="flex flex-wrap gap-2">
        <button autoFocus type="button" onClick={onCancel} className="min-h-11 flex-1 rounded-xl px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm font-bold">{isAr ? 'إلغاء' : 'Cancel'}</button>
        <button type="button" onClick={onConfirm} className="min-h-11 flex-1 rounded-xl px-3 py-2 bg-rose-600 text-white text-sm font-bold">{isAr ? 'حذف المحدد' : 'Delete selected'}</button>
      </div>
    </section>
  </div>;
}
