import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Euro } from 'lucide-react';

export default function SystemLogo({ size = 'default', showText = true, textSize = 'default', className = '' }) {
  const { data: settings } = useQuery({
    queryKey: ['systemSettings', 'company_logo'],
    queryFn: async () => {
      const result = await base44.entities.SystemSettings.filter({ setting_key: 'company_logo' });
      return result?.[0];
    },
  });

  const logoUrl = settings?.setting_value;

  const sizeClasses = {
    small: 'h-8 w-8',
    default: 'h-10 w-10',
    large: 'h-12 w-12',
    xlarge: 'h-16 w-16',
  };

  const iconSizeClasses = {
    small: 'h-4 w-4',
    default: 'h-5 w-5',
    large: 'h-6 w-6',
    xlarge: 'h-8 w-8',
  };

  const textSizeClasses = {
    small: 'text-sm',
    default: 'text-base',
    large: 'text-lg',
    xlarge: 'text-xl',
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className={`${sizeClasses[size]} flex items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-200 overflow-hidden`}>
        {logoUrl ? (
          <img src={logoUrl} alt="Company Logo" className="h-full w-full object-cover" />
        ) : (
          <Euro className={`${iconSizeClasses[size]} text-white`} />
        )}
      </div>
      {showText && (
        <div>
          <h1 className={`font-bold text-slate-900 ${textSizeClasses[size]}`}>
            Pay Track <span className="text-orange-500">IE</span>
          </h1>
          <p className="text-xs text-slate-500">Payroll Control</p>
        </div>
      )}
    </div>
  );
}