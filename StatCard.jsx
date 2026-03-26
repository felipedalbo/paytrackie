import React from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export default function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend, 
  trendValue,
  variant = 'default',
  className 
}) {
  const variants = {
    default: 'bg-white border-slate-200',
    primary: 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-0',
    secondary: 'bg-gradient-to-br from-slate-700 to-slate-800 text-white border-0',
    warning: 'bg-gradient-to-br from-amber-500 to-orange-500 text-white border-0',
    danger: 'bg-gradient-to-br from-red-500 to-rose-600 text-white border-0',
  };

  const isLight = variant === 'default';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={cn(
        'relative overflow-hidden p-6 transition-all duration-300 hover:shadow-lg',
        variants[variant],
        className
      )}>
        {/* Background decoration */}
        <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
        <div className="absolute -right-2 -top-2 h-16 w-16 rounded-full bg-white/5" />
        
        <div className="relative">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className={cn(
                'text-sm font-medium',
                isLight ? 'text-slate-500' : 'text-white/80'
              )}>
                {title}
              </p>
              <p className={cn(
                'text-2xl font-bold tracking-tight',
                isLight ? 'text-slate-900' : 'text-white'
              )}>
                {value}
              </p>
              {subtitle && (
                <p className={cn(
                  'text-xs',
                  isLight ? 'text-slate-400' : 'text-white/60'
                )}>
                  {subtitle}
                </p>
              )}
            </div>
            
            {Icon && (
              <div className={cn(
                'rounded-xl p-3',
                isLight ? 'bg-slate-100' : 'bg-white/10'
              )}>
                <Icon className={cn(
                  'h-5 w-5',
                  isLight ? 'text-slate-600' : 'text-white'
                )} />
              </div>
            )}
          </div>
          
          {trend && (
            <div className="mt-4 flex items-center gap-2">
              <span className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                trend === 'up' 
                  ? 'bg-emerald-100 text-emerald-700' 
                  : 'bg-red-100 text-red-700'
              )}>
                {trend === 'up' ? '↑' : '↓'} {trendValue}
              </span>
              <span className={cn(
                'text-xs',
                isLight ? 'text-slate-400' : 'text-white/60'
              )}>
                vs last month
              </span>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}