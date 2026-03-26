import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, differenceInCalendarDays, isWeekend, addDays } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Sun,
  Umbrella,
  Clock,
  Plus,
  Trash2,
  AlertCircle,
  Check,
  X,
  UserX,
  Info,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import ProfileCompletionBanner from '@/components/profile/ProfileCompletionBanner';
import { getPayrollPeriod, calculateWorkingDays, TAX_RATES_2026, calculateSickPay } from '@/components/payroll/IrishTaxCalculator';
import BankHolidayEntitlementLedger from '@/components/leave/BankHolidayEntitlementLedger';
import BankHolidaysWidget from '@/components/leave/BankHolidaysWidget';
import { getBankHolidayBalance, consumeBankHolidayEntitlement, generateBankHolidayEntitlements } from '@/components/leave/BankHolidayEntitlementGenerator';
import { useBankHolidayBalance } from '@/components/leave/useBankHolidayBalance';

export default function LeaveManagement() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('leave');
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
  const [isSickDialogOpen, setIsSickDialogOpen] = useState(false);
  const [isAbsenceDialogOpen, setIsAbsenceDialogOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const [leaveForm, setLeaveForm] = useState({
    leave_type: 'annual_leave',
    start_date: '',
    end_date: '',
    start_time: '09:00',
    end_time: '17:30',
    notes: '',
  });

  const [sickForm, setSickForm] = useState({
    start_date: '',
    end_date: '',
    hours_per_day: 7.5,
    notes: '',
  });

  const [absenceForm, setAbsenceForm] = useState({
    date: '',
    start_time: '09:00',
    end_time: '17:30',
    notes: '',
  });

  // Fetch current user
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  // Fetch employee profile
  const { data: employees, isLoading: employeeLoading } = useQuery({
    queryKey: ['employee', user?.email],
    queryFn: () => base44.entities.Employee.filter({ created_by: user?.email }),
    enabled: !!user?.email,
  });

  const employee = employees?.[0];

  // Fetch company bank holiday policy
  const { data: companyPolicies } = useQuery({
    queryKey: ['companyBankHolidayPolicy'],
    queryFn: () => base44.entities.CompanyBankHolidayPolicy.filter({ is_active: true }),
    enabled: !!employee?.id,
    initialData: [],
  });

  const companyPolicy = companyPolicies?.[0];

  // Use shared hook for FIFO balance calculations
  const { totalGranted: bankHolidayTotal, totalConsumed: bankHolidayUsed, entitlements: bankHolidayEntitlements } = useBankHolidayBalance(employee?.id, selectedYear);

  // Fetch leave records
  const { data: leaveRecords, isLoading: leaveLoading, refetch: refetchLeave } = useQuery({
    queryKey: ['leaveRecords', employee?.id, selectedYear],
    queryFn: () => base44.entities.LeaveRecord.filter({
      employee_id: employee?.id,
      payroll_period_year: selectedYear,
    }),
    enabled: !!employee?.id,
  });

  // Fetch sick leave records
  const { data: sickLeaveRecords, isLoading: sickLoading, refetch: refetchSick } = useQuery({
    queryKey: ['sickLeaveRecords', employee?.id, selectedYear],
    queryFn: () => base44.entities.SickLeaveRecord.filter({
      employee_id: employee?.id,
      payroll_period_year: selectedYear,
    }),
    enabled: !!employee?.id,
  });

  // Fetch absence/lateness records
  const { data: absenceRecords, isLoading: absenceLoading, refetch: refetchAbsence } = useQuery({
    queryKey: ['absenceRecords', employee?.id, selectedYear],
    queryFn: () => base44.entities.AbsenceLateness.filter({
      employee_id: employee?.id,
      payroll_period_year: selectedYear,
    }),
    enabled: !!employee?.id,
  });

  // Fetch employee settings for unpaid lunch
  const { data: settingsData } = useQuery({
    queryKey: ['employeeSettings', employee?.id],
    queryFn: () => base44.entities.EmployeeSettings.filter({ employee_id: employee?.id }),
    enabled: !!employee?.id,
  });

  const employeeSettings = settingsData?.[0];

  // Calculate hours between two times
  const calculateHours = (startTime, endTime) => {
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    return (endMinutes - startMinutes) / 60;
  };

  // Calculate working days and hours for leave
  const calculateLeaveHours = (startDate, endDate, startTime, endTime) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let workDays = 0;
    const current = new Date(start);

    while (current <= end) {
      if (!isWeekend(current)) {
        workDays++;
      }
      current.setDate(current.getDate() + 1);
    }

    const hoursPerDay = calculateHours(startTime, endTime);
    return workDays * hoursPerDay;
  };

  // Create leave mutation
  const createLeaveMutation = useMutation({
    mutationFn: async (data) => {
      // Calculate hours per day from employee data (standard daily hours)
      const standardDailyHours = employee.weekly_contracted_hours / 5;
      const workDays = calculateWorkingDays(data.start_date, data.end_date);
      
      // Apply minimum hours rule: use lesser of entered hours or standard daily hours
      const requestedHoursPerDay = calculateHours(data.start_time, data.end_time);
      const actualHoursPerDay = Math.min(requestedHoursPerDay, standardDailyHours);
      const totalHours = workDays * actualHoursPerDay;
      
      // Validate balance based on leave type
      if (data.leave_type === 'annual_leave') {
        const remaining = annualLeaveTotal - annualLeaveUsed;
        if (totalHours > remaining) {
          throw new Error('You have exceeded your available annual leave balance.');
        }
      } else if (data.leave_type === 'bank_holiday') {
        // NEW: Validate against bank holiday entitlement ledger
        const remaining = bankHolidayTotal - bankHolidayUsed;
        if (totalHours > remaining) {
          throw new Error(`Insufficient bank holiday entitlement. Available: ${remaining.toFixed(1)}h, Requested: ${totalHours.toFixed(1)}h`);
        }
      }
      
      const payrollPeriod = getPayrollPeriod(data.start_date);

      const leaveRecord = await base44.entities.LeaveRecord.create({
        employee_id: employee.id,
        leave_type: data.leave_type,
        start_date: data.start_date,
        end_date: data.end_date,
        start_time: data.start_time,
        end_time: data.end_time,
        total_hours: totalHours,
        notes: data.notes,
        payroll_period_year: payrollPeriod.year,
        payroll_period_month: payrollPeriod.month,
        status: 'pending',
      });

      // If bank holiday leave, consume from entitlement ledger
      if (data.leave_type === 'bank_holiday') {
        console.log('[Bank Holiday] Consuming entitlement for employee:', employee.id);
        try {
          const consumptionResult = await consumeBankHolidayEntitlement(
            employee.id,
            leaveRecord.id,
            data.start_date,
            data.end_date,
            actualHoursPerDay
          );

          console.log('[Bank Holiday] Consumption result:', consumptionResult);

          if (!consumptionResult.success) {
            // Rollback leave record
            console.log('[Bank Holiday] Consumption failed, rolling back...');
            await base44.entities.LeaveRecord.delete(leaveRecord.id);
            throw new Error(consumptionResult.message);
          }
        } catch (error) {
          console.error('[Bank Holiday] Error during consumption:', error);
          // Ensure rollback
          await base44.entities.LeaveRecord.delete(leaveRecord.id);
          throw error;
        }
      }

      return leaveRecord;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaveRecords', employee.id, selectedYear] });
      queryClient.invalidateQueries({ queryKey: ['bankHolidayEntitlements', employee.id, selectedYear] });
      queryClient.invalidateQueries({ queryKey: ['bankHolidayConsumptions', employee.id, selectedYear] });
      toast.success('Leave request submitted');
      setIsLeaveDialogOpen(false);
      setLeaveForm({
        leave_type: 'annual_leave',
        start_date: '',
        end_date: '',
        start_time: '09:00',
        end_time: '17:30',
        notes: '',
      });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to submit leave request');
      console.error(error);
    },
  });

  // Create sick leave mutation
  const createSickMutation = useMutation({
    mutationFn: async (data) => {
      const workDays = calculateWorkingDays(data.start_date, data.end_date);
      const standardDailyHours = employee.weekly_contracted_hours / 5;
      
      // Apply minimum hours rule: use lesser of entered hours or standard daily hours
      const actualHoursPerDay = Math.min(data.hours_per_day, standardDailyHours);
      const totalHours = workDays * actualHoursPerDay;
      
      // Validate against statutory sick pay limit (5 days/year)
      if (sickDaysUsed + workDays > TAX_RATES_2026.SICK_PAY.MAX_DAYS_PER_YEAR) {
        throw new Error('You have exceeded your available hours balance. Adjust dates or reduce the period.');
      }
      
      // Calculate sick pay with minimum hours rule applied (70% daily pay or €110/day cap)
      const statutoryPay = calculateSickPay(workDays, employee.base_hourly_rate, actualHoursPerDay);
      const payrollPeriod = getPayrollPeriod(data.start_date);

      return base44.entities.SickLeaveRecord.create({
        employee_id: employee.id,
        start_date: data.start_date,
        end_date: data.end_date,
        hours_per_day: actualHoursPerDay,
        total_hours: totalHours,
        total_days: workDays,
        statutory_pay: statutoryPay,
        notes: data.notes,
        payroll_period_year: payrollPeriod.year,
        payroll_period_month: payrollPeriod.month,
        status: 'pending',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sickLeaveRecords'] });
      toast.success('Sick leave recorded');
      setIsSickDialogOpen(false);
      setSickForm({
        start_date: '',
        end_date: '',
        hours_per_day: 7.5,
        notes: '',
      });
      refetchSick();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to record sick leave');
      console.error(error);
    },
  });

  // Create absence/lateness mutation
  const createAbsenceMutation = useMutation({
    mutationFn: async (data) => {
      const [startH, startM] = data.start_time.split(':').map(Number);
      const [endH, endM] = data.end_time.split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;
      const totalMinutes = endMinutes - startMinutes;
      
      // NO unpaid lunch deduction - raw hours only
      let totalHours = totalMinutes / 60;
      
      // Apply minimum hours rule: use lesser of entered hours or standard daily hours
      const standardDailyHours = employee.weekly_contracted_hours / 5;
      totalHours = Math.min(totalHours, standardDailyHours);
      
      const payrollPeriod = getPayrollPeriod(data.date);

      return base44.entities.AbsenceLateness.create({
        employee_id: employee.id,
        date: data.date,
        start_time: data.start_time,
        end_time: data.end_time,
        total_hours: totalHours,
        notes: data.notes,
        payroll_period_year: payrollPeriod.year,
        payroll_period_month: payrollPeriod.month,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['absenceRecords'] });
      toast.success('Absence/lateness recorded');
      setIsAbsenceDialogOpen(false);
      setAbsenceForm({
        date: '',
        start_time: '09:00',
        end_time: '17:30',
        notes: '',
      });
      refetchAbsence();
    },
    onError: (error) => {
      toast.error('Failed to record absence');
      console.error(error);
    },
  });

  // Delete leave mutation
  const deleteLeaveMutation = useMutation({
    mutationFn: async (leaveRecord) => {
      // If it's a bank holiday leave, reverse the consumption
      if (leaveRecord.leave_type === 'bank_holiday') {
        // Find consumption records linked to this leave
        const consumptions = await base44.entities.BankHolidayConsumption.filter({
          leave_record_id: leaveRecord.id,
        });

        // Reverse each consumption
        for (const consumption of consumptions) {
          // Update the entitlement to reduce consumed_hours
          const entitlement = await base44.entities.BankHolidayEntitlement.filter({
            id: consumption.entitlement_id,
          });

          if (entitlement && entitlement[0]) {
            const ent = entitlement[0];
            const newConsumedHours = Math.max(0, (ent.consumed_hours || 0) - consumption.hours_consumed);
            const newRemainingHours = (ent.hours_granted || 0) - newConsumedHours;

            await base44.entities.BankHolidayEntitlement.update(ent.id, {
              consumed_hours: newConsumedHours,
              remaining_hours: newRemainingHours,
              is_consumed: newRemainingHours <= 0,
            });
          }

          // Delete the consumption record
          await base44.entities.BankHolidayConsumption.delete(consumption.id);
        }
      }

      // Delete the leave record
      return base44.entities.LeaveRecord.delete(leaveRecord.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaveRecords', employee.id, selectedYear] });
      queryClient.invalidateQueries({ queryKey: ['bankHolidayEntitlements', employee.id, selectedYear] });
      queryClient.invalidateQueries({ queryKey: ['bankHolidayConsumptions', employee.id, selectedYear] });
      toast.success('Leave record deleted');
    },
  });

  // Delete sick leave mutation
  const deleteSickMutation = useMutation({
    mutationFn: (id) => base44.entities.SickLeaveRecord.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sickLeaveRecords'] });
      toast.success('Sick leave record deleted');
      refetchSick();
    },
  });

  // Delete absence/lateness mutation
  const deleteAbsenceMutation = useMutation({
    mutationFn: (id) => base44.entities.AbsenceLateness.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['absenceRecords'] });
      toast.success('Absence record deleted');
      refetchAbsence();
    },
  });

  const isLoading = userLoading || employeeLoading || leaveLoading || sickLoading || absenceLoading;
  const isProfileComplete = employee?.profile_complete;

  // Calculate balances
  const annualLeaveUsed = leaveRecords?.filter(l => l.leave_type === 'annual_leave')
    .reduce((acc, l) => acc + (l.total_hours || 0), 0) || 0;
  const annualLeaveTotal = TAX_RATES_2026.LEAVE.ANNUAL_DAYS * TAX_RATES_2026.LEAVE.HOURS_PER_DAY;

  const sickDaysUsed = sickLeaveRecords?.reduce((acc, s) => acc + (s.total_days || 0), 0) || 0;
  const sickDaysTotal = TAX_RATES_2026.SICK_PAY.MAX_DAYS_PER_YEAR;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-[600px]" />
        </div>
      </div>
    );
  }

  if (!isProfileComplete) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <h1 className="text-3xl font-bold text-slate-900">Leave Management</h1>
          <ProfileCompletionBanner missingFields={['Complete Profile Setup']} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl p-4 md:p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-8"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Leave & Time Off</h1>
              <p className="mt-1 text-slate-500">
                Manage your annual leave, bank holidays, and sick leave
              </p>
            </div>

            <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="w-28 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026, 2027].map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </motion.div>

        {/* Balance Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="mb-8 grid gap-6 md:grid-cols-3"
        >
          <Card>
            <CardContent className="pt-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-sky-100 p-2">
                    <Sun className="h-5 w-5 text-sky-600" />
                  </div>
                  <span className="font-medium text-slate-700">Annual Leave</span>
                </div>
              </div>
              <div className="mb-2 flex items-end justify-between">
                <span className="text-3xl font-bold text-slate-900">
                  {(annualLeaveTotal - annualLeaveUsed).toFixed(1)}h
                </span>
                <span className="text-sm text-slate-400">
                  of {annualLeaveTotal}h
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div 
                  className="h-full rounded-full bg-sky-500 transition-all"
                  style={{ width: `${Math.max(0, ((annualLeaveTotal - annualLeaveUsed) / annualLeaveTotal) * 100)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-400">
                {(annualLeaveUsed / 7.5).toFixed(1)} days used of 25 days
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-emerald-100 p-2">
                    <Calendar className="h-5 w-5 text-emerald-600" />
                  </div>
                  <span className="font-medium text-slate-700">Bank Holidays</span>
                </div>
              </div>
              <div className="mb-2 flex items-end justify-between">
                <span className="text-3xl font-bold text-slate-900">
                  {(bankHolidayTotal - bankHolidayUsed).toFixed(1)}h
                </span>
                <span className="text-sm text-slate-400">
                  of {bankHolidayTotal.toFixed(1)}h
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div 
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${bankHolidayTotal > 0 ? Math.max(0, ((bankHolidayTotal - bankHolidayUsed) / bankHolidayTotal) * 100) : 0}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Ledger-based: {bankHolidayEntitlements?.length || 0} entitlements
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-rose-100 p-2">
                    <Umbrella className="h-5 w-5 text-rose-600" />
                  </div>
                  <span className="font-medium text-slate-700">Sick Leave</span>
                </div>
              </div>
              <div className="mb-2 flex items-end justify-between">
                <span className="text-3xl font-bold text-slate-900">
                  {Math.max(0, sickDaysTotal - sickDaysUsed)} days
                </span>
                <span className="text-sm text-slate-400">
                  of {sickDaysTotal} days
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div 
                  className="h-full rounded-full bg-rose-500 transition-all"
                  style={{ width: `${Math.max(0, ((sickDaysTotal - sickDaysUsed) / sickDaysTotal) * 100)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Statutory Sick Pay (2026)
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <TabsList>
                <TabsTrigger value="leave">Leave Requests</TabsTrigger>
                <TabsTrigger value="entitlements">Bank Holiday</TabsTrigger>
                <TabsTrigger value="sick">Sick Leave</TabsTrigger>
                <TabsTrigger value="absence">Absence/Lateness</TabsTrigger>
              </TabsList>

              {activeTab === 'entitlements' ? (
                null
              ) : activeTab === 'absence' ? (
                <Dialog open={isAbsenceDialogOpen} onOpenChange={setIsAbsenceDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-slate-600 hover:bg-slate-700">
                      <Plus className="mr-2 h-4 w-4" />
                      Record Absence/Lateness
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Record Absence/Lateness - Unpaid</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      createAbsenceMutation.mutate(absenceForm);
                    }} className="space-y-4">
                      <Alert className="border-blue-200 bg-blue-50">
                        <Info className="h-4 w-4 text-blue-600" />
                        <AlertDescription className="text-xs text-blue-800">
                          Total Hours = End Time − Start Time (minimum rule applies: capped at {(employee.weekly_contracted_hours / 5).toFixed(1)}h/day)
                        </AlertDescription>
                      </Alert>

                      <div className="space-y-2">
                        <Label>Date</Label>
                        <Input
                          type="date"
                          value={absenceForm.date}
                          onChange={(e) => setAbsenceForm(prev => ({ ...prev, date: e.target.value }))}
                          required
                        />
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Start Time</Label>
                          <Input
                            type="time"
                            value={absenceForm.start_time}
                            onChange={(e) => setAbsenceForm(prev => ({ ...prev, start_time: e.target.value }))}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>End Time</Label>
                          <Input
                            type="time"
                            value={absenceForm.end_time}
                            onChange={(e) => setAbsenceForm(prev => ({ ...prev, end_time: e.target.value }))}
                            required
                          />
                        </div>
                      </div>

                      {absenceForm.start_time && absenceForm.end_time && employee && (
                        <div className="rounded-lg bg-slate-50 p-3">
                          <p className="text-sm text-slate-600">
                            Total Hours: <span className="font-semibold">
                              {(() => {
                                const [startH, startM] = absenceForm.start_time.split(':').map(Number);
                                const [endH, endM] = absenceForm.end_time.split(':').map(Number);
                                const startMinutes = startH * 60 + startM;
                                const endMinutes = endH * 60 + endM;
                                const totalMinutes = endMinutes - startMinutes;
                                const rawHours = totalMinutes / 60;
                                const standardDailyHours = employee.weekly_contracted_hours / 5;
                                const actualHours = Math.min(rawHours, standardDailyHours);
                                return actualHours.toFixed(2);
                              })()}h
                            </span>
                            <span className="text-xs text-slate-400 ml-1">
                              (minimum rule applied)
                            </span>
                          </p>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label>Notes (optional)</Label>
                        <Textarea
                          value={absenceForm.notes}
                          onChange={(e) => setAbsenceForm(prev => ({ ...prev, notes: e.target.value }))}
                          placeholder="Reason for absence/lateness..."
                        />
                      </div>

                      <div className="flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={() => setIsAbsenceDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" className="bg-slate-600 hover:bg-slate-700" disabled={createAbsenceMutation.isPending}>
                          Save Record
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              ) : activeTab === 'leave' ? (
                <Dialog open={isLeaveDialogOpen} onOpenChange={setIsLeaveDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-emerald-600 hover:bg-emerald-700">
                      <Plus className="mr-2 h-4 w-4" />
                      Record Leave
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Request Time Off</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      createLeaveMutation.mutate(leaveForm);
                    }} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Leave Type</Label>
                        <Select
                          value={leaveForm.leave_type}
                          onValueChange={(v) => setLeaveForm(prev => ({ ...prev, leave_type: v }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="annual_leave">Annual Leave</SelectItem>
                            <SelectItem value="bank_holiday">Bank Holiday</SelectItem>
                            <SelectItem value="unpaid_leave">Unpaid Leave</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Start Date</Label>
                          <Input
                            type="date"
                            value={leaveForm.start_date}
                            onChange={(e) => setLeaveForm(prev => ({ ...prev, start_date: e.target.value }))}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>End Date</Label>
                          <Input
                            type="date"
                            value={leaveForm.end_date}
                            onChange={(e) => setLeaveForm(prev => ({ ...prev, end_date: e.target.value }))}
                            required
                          />
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Start Time</Label>
                          <Input
                            type="time"
                            value={leaveForm.start_time}
                            onChange={(e) => setLeaveForm(prev => ({ ...prev, start_time: e.target.value }))}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>End Time</Label>
                          <Input
                            type="time"
                            value={leaveForm.end_time}
                            onChange={(e) => setLeaveForm(prev => ({ ...prev, end_time: e.target.value }))}
                            required
                          />
                        </div>
                      </div>

                      <Alert className="border-blue-200 bg-blue-50">
                        <Info className="h-4 w-4 text-blue-600" />
                        <AlertDescription className="text-xs text-blue-800">
                          <strong>Start date</strong> = first day of leave, <strong>End date</strong> = last day of leave
                        </AlertDescription>
                      </Alert>

                      {leaveForm.start_date && leaveForm.end_date && leaveForm.start_time && leaveForm.end_time && employee && (
                       <div className="rounded-lg bg-slate-50 p-3 space-y-1">
                         <p className="text-sm text-slate-600">
                           Total: <span className="font-semibold">
                             {(() => {
                               const workDays = calculateWorkingDays(leaveForm.start_date, leaveForm.end_date);
                               const requestedHoursPerDay = calculateHours(leaveForm.start_time, leaveForm.end_time);
                               const standardDailyHours = employee.weekly_contracted_hours / 5;
                               const actualHoursPerDay = Math.min(requestedHoursPerDay, standardDailyHours);
                               return (workDays * actualHoursPerDay).toFixed(1);
                             })()} hours
                           </span>
                           <span className="text-slate-400 ml-1">
                             ({calculateWorkingDays(leaveForm.start_date, leaveForm.end_date)} days × minimum rule)
                           </span>
                         </p>
                         {leaveForm.leave_type === 'bank_holiday' && (
                           <p className="text-xs text-blue-600">
                             Available balance: {(bankHolidayTotal - bankHolidayUsed).toFixed(1)}h
                           </p>
                         )}
                       </div>
                      )}

                      <div className="space-y-2">
                        <Label>Notes (optional)</Label>
                        <Textarea
                          value={leaveForm.notes}
                          onChange={(e) => setLeaveForm(prev => ({ ...prev, notes: e.target.value }))}
                          placeholder="Any additional notes..."
                        />
                      </div>

                      <div className="flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={() => setIsLeaveDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={createLeaveMutation.isPending}>
                          Submit Request
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              ) : (
                <Dialog open={isSickDialogOpen} onOpenChange={setIsSickDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-rose-600 hover:bg-rose-700">
                      <Plus className="mr-2 h-4 w-4" />
                      Record Sick Leave
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Record Sick Leave</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      createSickMutation.mutate(sickForm);
                    }} className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Start Date</Label>
                          <Input
                            type="date"
                            value={sickForm.start_date}
                            onChange={(e) => setSickForm(prev => ({ ...prev, start_date: e.target.value }))}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>End Date</Label>
                          <Input
                            type="date"
                            value={sickForm.end_date}
                            onChange={(e) => setSickForm(prev => ({ ...prev, end_date: e.target.value }))}
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Hours per Day</Label>
                        <Input
                          type="number"
                          step="0.5"
                          value={sickForm.hours_per_day}
                          onChange={(e) => setSickForm(prev => ({ ...prev, hours_per_day: parseFloat(e.target.value) }))}
                          required
                        />
                      </div>

                      {sickForm.start_date && sickForm.end_date && (
                        <div className="rounded-lg bg-rose-50 p-3 space-y-1">
                          <p className="text-sm text-rose-800">
                            Days: <span className="font-semibold">
                              {calculateWorkingDays(sickForm.start_date, sickForm.end_date)}
                            </span>
                          </p>
                          <p className="text-sm text-rose-800">
                            Estimated Sick Pay: <span className="font-semibold">
                              €{calculateSickPay(
                                calculateWorkingDays(sickForm.start_date, sickForm.end_date),
                                employee?.base_hourly_rate || 15.93,
                                sickForm.hours_per_day
                              ).toFixed(2)}
                            </span>
                          </p>
                          <p className="text-xs text-rose-600">
                            (70% of daily pay, max €110/day)
                          </p>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label>Notes (optional)</Label>
                        <Textarea
                          value={sickForm.notes}
                          onChange={(e) => setSickForm(prev => ({ ...prev, notes: e.target.value }))}
                          placeholder="Any additional notes..."
                        />
                      </div>

                      <div className="flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={() => setIsSickDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" className="bg-rose-600 hover:bg-rose-700" disabled={createSickMutation.isPending}>
                          Save Record
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            <TabsContent value="entitlements">
              <div className="space-y-6">
                <BankHolidaysWidget employee={employee} selectedYear={selectedYear} />
                <BankHolidayEntitlementLedger 
                  employeeId={employee?.id}
                  year={selectedYear}
                />
              </div>
            </TabsContent>

            <TabsContent value="leave">
              <Card>
                <CardContent className="pt-6">
                  {!leaveRecords || leaveRecords.length === 0 ? (
                    <div className="py-12 text-center">
                      <Calendar className="mx-auto h-12 w-12 text-slate-300" />
                      <p className="mt-4 text-slate-500">No leave requests yet</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Dates</TableHead>
                          <TableHead>Hours</TableHead>
                          <TableHead>Notes</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {leaveRecords.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell>
                              <Badge variant="outline" className={
                                record.leave_type === 'annual_leave' 
                                  ? 'border-sky-200 bg-sky-50 text-sky-700'
                                  : record.leave_type === 'bank_holiday'
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                  : 'border-slate-200 bg-slate-50 text-slate-700'
                              }>
                                {record.leave_type?.replace('_', ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {format(new Date(record.start_date), 'dd MMM')} - {format(new Date(record.end_date), 'dd MMM yyyy')}
                            </TableCell>
                            <TableCell className="font-medium">{record.total_hours?.toFixed(1)}h</TableCell>
                            <TableCell className="text-slate-500 max-w-xs truncate">
                              {record.notes || '-'}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-slate-400 hover:text-red-600"
                                onClick={() => deleteLeaveMutation.mutate(record)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sick">
              <Card>
                <CardContent className="pt-6">
                  {!sickLeaveRecords || sickLeaveRecords.length === 0 ? (
                    <div className="py-12 text-center">
                      <Umbrella className="mx-auto h-12 w-12 text-slate-300" />
                      <p className="mt-4 text-slate-500">No sick leave records</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Dates</TableHead>
                          <TableHead>Days</TableHead>
                          <TableHead>Hours</TableHead>
                          <TableHead>Sick Pay</TableHead>
                          <TableHead>Notes</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sickLeaveRecords.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell>
                              {format(new Date(record.start_date), 'dd MMM')} - {format(new Date(record.end_date), 'dd MMM yyyy')}
                            </TableCell>
                            <TableCell className="font-medium">{record.total_days}</TableCell>
                            <TableCell>{record.total_hours?.toFixed(1)}h</TableCell>
                            <TableCell className="font-medium text-emerald-600">
                              €{record.statutory_pay?.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-slate-500 max-w-xs truncate">
                              {record.notes || '-'}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-slate-400 hover:text-red-600"
                                onClick={() => deleteSickMutation.mutate(record.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="absence">
              <Card>
                <CardContent className="pt-6">
                  {!absenceRecords || absenceRecords.length === 0 ? (
                    <div className="py-12 text-center">
                      <UserX className="mx-auto h-12 w-12 text-slate-300" />
                      <p className="mt-4 text-slate-500">No absence/lateness records</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Time Period</TableHead>
                          <TableHead>Unpaid Hours</TableHead>
                          <TableHead>Notes</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {absenceRecords.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell className="font-medium">
                              {format(new Date(record.date), 'dd MMM yyyy')}
                            </TableCell>
                            <TableCell>
                              {record.start_time} - {record.end_time}
                            </TableCell>
                            <TableCell className="font-medium text-red-600">
                              {record.total_hours?.toFixed(2)}h
                            </TableCell>
                            <TableCell className="text-slate-500 max-w-xs truncate">
                              {record.notes || '-'}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-slate-400 hover:text-red-600"
                                onClick={() => deleteAbsenceMutation.mutate(record.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
}