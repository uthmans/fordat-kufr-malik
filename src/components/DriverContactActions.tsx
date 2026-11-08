import React from 'react';
import { Phone, MessageSquare } from 'lucide-react';
import { buildDriverCallUrl } from '../utils/whatsapp';

export function DriverContactActions({ phone, name, isAr, onWhatsApp }: {
  phone: string; name: string; isAr: boolean; onWhatsApp: () => void;
}) {
  const callUrl = buildDriverCallUrl(phone);
  const base = 'min-w-0 min-h-12 p-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 whitespace-normal break-words leading-snug';
  return <div className="grid grid-cols-2 gap-2">
    {callUrl ? <a href={callUrl} aria-label={isAr ? `اتصل بـ ${name}` : `Call ${name}`}
      className={`${base} bg-amber-500 text-slate-950 hover:bg-amber-400`}>
      <Phone size={18} className="shrink-0" aria-hidden="true" />
      <span>{isAr ? 'اتصال' : 'Call'}</span>
    </a> : <button type="button" disabled className={`${base} bg-slate-100 text-slate-500`}>
      {isAr ? 'الرقم غير متاح' : 'Number unavailable'}
    </button>}
    <button type="button" onClick={onWhatsApp} disabled={!callUrl}
      aria-label={isAr ? `واتساب ${name}` : `WhatsApp ${name}`}
      className={`${base} bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50`}>
      <MessageSquare size={18} className="shrink-0" aria-hidden="true" />
      <span>{isAr ? 'واتساب' : 'WhatsApp'}</span>
    </button>
  </div>;
}
