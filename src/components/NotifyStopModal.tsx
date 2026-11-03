import React, { useState } from 'react';
import { Driver, Language, RouteNode } from '../types';
import { ROUTE_NODES } from '../data/routeNodes';
import { cleanWhatsAppNumber } from '../utils/whatsapp';
import { PhoneDisplay } from './PhoneDisplay';
import { X, Check, MessageSquare } from 'lucide-react';

interface NotifyStopModalProps {
  driver: Driver;
  language: Language;
  onClose: () => void;
}

export const NotifyStopModal: React.FC<NotifyStopModalProps> = ({
  driver,
  language,
  onClose
}) => {
  const isAr = language === 'ar';
  const [selectedStop, setSelectedStop] = useState(ROUTE_NODES[0].id);
  const [passengersCount, setPassengersCount] = useState(1);
  const [copied, setCopied] = useState(false);

  const stopObj = ROUTE_NODES.find((s: RouteNode) => s.id === selectedStop) || ROUTE_NODES[0];
  const stopName = isAr ? stopObj.nameAr : stopObj.nameEn;
  const driverName = isAr ? driver.nameAr : driver.nameEn;

  const messageText = isAr
    ? `سلام عليكم، أنا بانتظارك عند (${stopName}) - عدد الركاب: ${passengersCount}. هل يوجد متسع في سيارتك؟`
    : `Salam alaykum, I am waiting at (${stopName}) for ${passengersCount} passenger(s). Is there space in your van?`;

  const cleanPhone = cleanWhatsAppNumber(driver.phone);
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(messageText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="font-black text-sm text-slate-900 dark:text-slate-100">
              {isAr ? 'تواصل مع السائق عبر واتساب' : 'WhatsApp Driver Message'}
            </h3>
            <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
              <span>{isAr ? `السائق: ${driverName}` : `Driver: ${driverName}`}</span>
              <span>·</span>
              <PhoneDisplay phone={driver.phone} />
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 bg-slate-100 dark:bg-slate-800"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 py-4">
          {/* Select Pick-up Location */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {isAr ? 'مكان انتظارك على الخط:' : 'Your Waiting Point on the Route:'}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ROUTE_NODES.map((stop: RouteNode) => (
                <button
                  key={stop.id}
                  type="button"
                  onClick={() => setSelectedStop(stop.id)}
                  className={`text-left p-2.5 rounded-xl border text-xs font-medium transition-all ${
                    selectedStop === stop.id
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-bold'
                      : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="block truncate">{isAr ? stop.nameAr : stop.nameEn}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Number of passengers */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {isAr ? 'عدد الركاب:' : 'Passengers:'}
            </label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setPassengersCount(num)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                    passengersCount === num
                      ? 'bg-[#25D366] text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          {/* Draft text */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
              {isAr ? 'نص رسالة واتساب:' : 'WhatsApp message text:'}
            </span>
            <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-sans italic">
              "{messageText}"
            </p>
          </div>
        </div>

        {/* WhatsApp Action button */}
        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 px-4 bg-[#25D366] hover:bg-[#20ba59] text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-md active:scale-98 transition-all"
          >
            <MessageSquare size={16} className="fill-white" />
            <span>{isAr ? 'إرسال عبر واتساب (WhatsApp)' : 'Send via WhatsApp'}</span>
          </a>

          <button
            type="button"
            onClick={handleCopy}
            className="w-full py-2 px-3 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
          >
            {copied ? <Check size={14} className="text-emerald-500" /> : null}
            <span>{copied ? (isAr ? 'تم النسخ!' : 'Copied!') : (isAr ? 'نسخ نص الرسالة' : 'Copy Text')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
