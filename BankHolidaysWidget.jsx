import React, { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { Textarea } from '@/components/ui/textarea';
import { Calendar, Info, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { generateBankHolidays } from '@/components/payroll/IrishTaxCalculator';

import { useBankHolidayBalance } from './useBankHolidayBalance';

export default function BankHolidaysWidget({ employee, selectedYear }) {
  const [selectedHolidayDate, setSelectedHolidayDate] = useState('');
  const [holidayStatus, setHolidayStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [isOverrideDialogOpen, setIsOverrideDialogOpen] = useState(false);

  const queryClient = useQueryClient();

  // Fetch overrides
  const { data: overrides = [] } = useQuery({
    queryKey: ['bankHolidayOverrides', employee?.id, selectedYear],
    queryFn: () => base44.entities.EmployeeBankHolidayOverride.filter({
      employee_id: employee?.id,
      year: selectedYear,
    }),
    enabled: !!employee?.id,
  });

  // Fetch company policy
  const { data: companyPolicies = [] } = useQuery({
    queryKey: ['companyBankHolidayPolicy'],
    queryFn: () => base44.entities.CompanyBankHolidayPolicy.list(),
  });

  const activePolicy = companyPolicies.find(p => p.is_active);

  // Use shared hook for FIFO balance calculations
  const { totalGranted, totalConsumed, totalRemaining } = useBankHolidayBalance(employee?.id, selectedYear);

  // Override mutation
  const createOverrideMutation = useMutation({
    mutationFn: async (data) => {
      const holidayDate = selectedHolidayDate;
      const holiday = generateBankHolidays(selectedYear).find(h => h.date === holidayDate);

      if (!holiday) {
        throw new Error('Invalid bank holiday date');
      }

      // Check if override exists
      const existing = overrides.find(o => o.bank_holiday_date === holidayDate);

      if (existing) {
        return await base44.entities.EmployeeBankHolidayOverride.update(existing.id, {
          status: data.status,
          hours_worked: data.status === 'WORKED' ? (activePolicy?.default_daily_hours || 7.5) : null,
          notes: data.notes || '',
        });
      } else {
        return await base44.entities.EmployeeBankHolidayOverride.create({
          employee_id: employee.id,
          year: selectedYear,
          bank_holiday_date: holidayDate,
          bank_holiday_name: holiday.name,
          status: data.status,
          hours_worked: data.status === 'WORKED' ? (activePolicy?.default_daily_hours || 7.5) : null,
          notes: data.notes || '',
        });
      }
    },
    onSuccess: () => {
      setIsOverrideDialogOpen(false);
      setSelectedHolidayDate('');
      setHolidayStatus('');
      setNotes('');
      queryClient.invalidateQueries({ queryKey: ['bankHolidayOverrides'] });
      queryClient.invalidateQueries({ queryKey: ['bankHolidayEntitlements'] });
      toast.success('Bank holiday status updated');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update bank holiday status');
    },
  });

  // Delete override mutation
  const deleteOverrideMutation = useMutation({
    mutationFn: (id) => base44.entities.EmployeeBankHolidayOverride.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bankHolidayOverrides'] });
      queryClient.invalidateQueries({ queryKey: ['bankHolidayEntitlements'] });
      toast.success('Bank holiday override removed');
    },
  });

  const handleOverrideSubmit = () => {
    if (!selectedHolidayDate || !holidayStatus) {
      toast.error('Please select a bank holiday and status');
      return;
    }

    createOverrideMutation.mutate({
      status: holidayStatus,
      notes: notes,
    });
  };

  // Get all official holidays
  const officialHolidays = generateBankHolidays(selectedYear);

  // Build holiday list with overrides
  const holidaysWithStatus = officialHolidays.map(holiday => {
    const override = overrides.find(o => o.bank_holiday_date === holiday.date);
    return {
      ...holiday,
      status: override?.status || (activePolicy?.policy_type === 'ASSUME_WORKED' ? 'ASSUMED_WORKED' : 'NOT_SET'),
      override: override,
    };
  });

  return (
    <Card className="p-6 pb-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-emerald-100 p-2">
            <Calendar className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <span className="font-medium text-slate-700">Bank Holidays</span>
            <p className="text-xs text-slate-500">
              {selectedYear} - {activePolicy?.policy_type === 'ASSUME_WORKED' ? 'Assume Worked' : 'Worked Only'}
            </p>
          </div>
        </div>

      </div>

      {/* Balance Summary */}
      <div className="mb-2 flex items-end justify-between">
        <span className="text-3xl font-bold text-slate-900">
          {totalRemaining.toFixed(1)}h
        </span>
        <span className="text-sm text-slate-400">
          of {totalGranted.toFixed(1)}h
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div 
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${totalGranted > 0 ? (totalRemaining / totalGranted) * 100 : 0}%` }}
        />
      </div>
      <div className="mt-2 text-xs text-slate-500">
        {totalConsumed.toFixed(1)}h used
      </div>


    </Card>
  );
}