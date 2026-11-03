import React from 'react';

interface PhoneDisplayProps {
  phone: string;
  className?: string;
}

export const PhoneDisplay: React.FC<PhoneDisplayProps> = ({ phone, className = '' }) => {
  return (
    <span
      dir="ltr"
      style={{ unicodeBidi: 'isolate', direction: 'ltr' }}
      className={`inline-block font-mono tracking-normal select-all ${className}`}
    >
      {phone}
    </span>
  );
};
