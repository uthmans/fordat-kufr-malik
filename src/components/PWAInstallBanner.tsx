import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useTransit } from '../context/TransitContext';
import { Download, Share, X, Check, Smartphone } from 'lucide-react';

export const PWAInstallBanner: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const { language } = useTransit();
  const [dismissed, setDismissed] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  const isAr = language === 'ar';

  if (isInstalled || dismissed) return null;

  return (
    <>
      <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 text-slate-950 p-2.5 px-4 rounded-2xl shadow-md flex flex-wrap items-center justify-between gap-3 mb-4 animate-in fade-in duration-200">
        <div className="flex items-center gap-2.5 min-w-0 flex-1 basis-48">
          <div className="w-8 h-8 rounded-xl bg-slate-950 text-amber-400 flex items-center justify-center shrink-0">
            <Smartphone size={16} />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-black">
              {isAr ? 'تثبيت تطبيق سرفيس كفر مالك' : 'Install Kufr Malik Transit'}
            </h4>
            <p className="text-[11px] font-medium text-slate-900 opacity-90">
              {isAr
                ? 'تشغيل سريع ومباشر من شاشة الهاتف دون إنترنت'
                : 'Fast offline access directly on your mobile home screen'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isInstallable ? (
            <button
              onClick={install}
              className="py-1.5 px-3 bg-slate-950 hover:bg-slate-900 text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
            >
              <Download size={13} />
              <span>{isAr ? 'تثبيت الآن' : 'Install App'}</span>
            </button>
          ) : isIOS ? (
            <button
              onClick={() => setShowIOSGuide(true)}
              className="py-1.5 px-3 bg-slate-950 hover:bg-slate-900 text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
            >
              <Share size={13} />
              <span>{isAr ? 'إضافة للآيفون' : 'Add to iPhone'}</span>
            </button>
          ) : (
            <button
              onClick={install}
              className="py-1.5 px-3 bg-slate-950 hover:bg-slate-900 text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
            >
              <Download size={13} />
              <span>{isAr ? 'تثبيت' : 'Install'}</span>
            </button>
          )}

          <button
            onClick={() => setDismissed(true)}
            className="p-1 rounded-full text-slate-800 hover:text-slate-950 hover:bg-amber-400"
            aria-label="Dismiss banner"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* iOS Safari Guide Modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm p-5 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                {isAr ? 'تثبيت التطبيق على أجهزة iPhone / iPad' : 'Install on iPhone / iPad'}
              </h3>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 bg-slate-100 dark:bg-slate-800"
              >
                <X size={16} />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs text-slate-700 dark:text-slate-300">
              <div className="flex items-start gap-2.5 p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-bold flex items-center justify-center shrink-0">
                  1
                </span>
                <p>
                  {isAr
                    ? 'اضغط على زر المشاركة (Share) في أسفل متصفح Safari.'
                    : 'Tap the Share icon at the bottom of Safari.'}
                </p>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-bold flex items-center justify-center shrink-0">
                  2
                </span>
                <p>
                  {isAr
                    ? 'مرر للأسفل واختر "إضافة إلى الشاشة الرئيسية" (Add to Home Screen).'
                    : 'Scroll down and tap "Add to Home Screen".'}
                </p>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-bold flex items-center justify-center shrink-0">
                  3
                </span>
                <p>
                  {isAr
                    ? 'اضغط "إضافة" (Add) في الزاوية العلوية لتثبيت الأيقونة.'
                    : 'Tap "Add" in the top-right corner to complete.'}
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2.5 bg-slate-900 text-white dark:bg-slate-800 font-bold text-xs rounded-xl"
            >
              {isAr ? 'فهمت، إغلاق' : 'Got it, Close'}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
