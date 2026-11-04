import React from 'react';
import { resetConfirmationMessage } from '../utils/transitReset';

export function ResetConfirmation({ isAr, onCancel, onConfirm }: { isAr: boolean; onCancel(): void; onConfirm(): void }) {
  return <div className="fixed inset-0 z-50 bg-slate-950/70 p-4 flex items-center justify-center">
    <section role="alertdialog" aria-modal="true" aria-labelledby="reset-title" aria-describedby="reset-description"
      className="w-full max-w-sm max-h-[85dvh] overflow-y-auto rounded-3xl p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4">
      <h3 id="reset-title" className="font-black text-base text-slate-900 dark:text-white">{isAr ? 'تأكيد إعادة الضبط' : 'Confirm reset'}</h3>
      <p id="reset-description" className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{resetConfirmationMessage(isAr)}</p>
      <div className="flex flex-wrap gap-2">
        <button autoFocus type="button" onClick={onCancel} className="min-h-11 flex-1 rounded-xl px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm font-bold">{isAr ? 'إلغاء' : 'Cancel'}</button>
        <button type="button" onClick={onConfirm} className="min-h-11 flex-1 rounded-xl px-3 py-2 bg-rose-600 text-white text-sm font-bold">{isAr ? 'إعادة ضبط البيانات' : 'Reset data'}</button>
      </div>
    </section>
  </div>;
}
