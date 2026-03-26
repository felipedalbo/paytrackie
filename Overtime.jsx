import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, getDay, isWeekend } from 'date-fns';
import { motion } from 'framer-motion';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import {
  Clock,
  Plus,
  Trash2,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { toast } from 'sonner';
import ProfileCompletionBanner from '@/components/profile/ProfileCompletionBanner';
import { 
  getPayrollPeriod, 
  calculateOvertimePay, 
  isBankHoliday, 
  formatCurrency,
} from '@/components/payroll/IrishTaxCalculator';
import { getApplicableOvertimePolicy } from '@/components/payroll/OvertimePolicyHelper';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function Overtime() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overtime');
  const [isOvertimeDialogOpen, setIsOvertimeDialogOpen] = useState(false);
  const [isWeekendDialogOpen, setIsWeekendDialogOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  const [overtimeForm, setOvertimeForm] = useState({
    date: '',
    hours: '',
    notes: '',
  });

  const [weekendForm, setWeekendForm] = useState({
    date: '',
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

  // Fetch applicable overtime policy
  const { data: overtimePolicy } = useQuery({
    queryKey: ['applicableOvertimePolicy', employee?.id],
    queryFn: () => getApplicableOvertimePolicy(employee?.id),
    enabled: !!employee?.id,
  });

  // Fetch overtime records
  const { data: overtimeRecords, isLoading: overtimeLoading } = useQuery({
    queryKey: ['overtimeRecords', employee?.id, selectedYear, selectedMonth],
    queryFn: () => base44.entities.OvertimeRecord.filter({
      employee_id: employee?.id,
      payroll_period_year: selectedYear,
      payroll_period_month: selectedMonth,
    }),
    enabled: !!employee?.id,
  });

  // Fetch weekend roster
  const { data: weekendRosters, isLoading: weekendLoading } = useQuery({
    queryKey: ['weekendRosters', employee?.id, selectedYear, selectedMonth],
    queryFn: () => base44.entities.WeekendRoster.filter({
      employee_id: employee?.id,
      payroll_period_year: selectedYear,
      payroll_period_month: selectedMonth,
    }),
    enabled: !!employee?.id,
  });

  // Determine day type and rate from overtime policy
  const getDayType = (dateStr) => {
    const date = new Date(dateStr);
    const dayOfWeek = getDay(date);
    
    if (isBankHoliday(dateStr)) {
      return { type: 'bank_holiday', multiplier: overtimePolicy?.bank_holiday_multiplier || 2.0 };
    }
    if (dayOfWeek === 0) {
      return { type: 'sunday', multiplier: overtimePolicy?.sunday_multiplier || 2.0 };
    }
    if (dayOfWeek === 6) {
      return { type: 'saturday', multiplier: overtimePolicy?.saturday_multiplier || 1.5 };
    }
    return { type: 'weekday', multiplier: overtimePolicy?.weekday_multiplier || 1.5 };
  };

  // Create overtime mutation
  const createOvertimeMutation = useMutation({
    mutationFn: async (data) => {
      if (!overtimePolicy) {
        throw new Error('No overtime policy configured. Please contact administrator.');
      }

      if (!data.date || !data.hours) {
        throw new Error('Date and hours are required');
      }

      const hours = parseFloat(data.hours);
      if (isNaN(hours) || hours <= 0) {
        throw new Error('Invalid hours value');
      }

      const { type, multiplier } = getDayType(data.date);
      const pay = calculateOvertimePay(hours, employee.base_hourly_rate, type, multiplier);
      const payrollPeriod = getPayrollPeriod(data.date);

      const record = await base44.entities.OvertimeRecord.create({
        employee_id: employee.id,
        date: data.date,
        hours: hours,
        rate_multiplier: multiplier,
        overtime_pay: pay,
        day_type: type,
        notes: data.notes || '',
        payroll_period_year: payrollPeriod.year,
        payroll_period_month: payrollPeriod.month,
        status: 'pending',
      });

      return record;
    },
    onSuccess: () => {
      setIsOvertimeDialogOpen(false);
      setOvertimeForm({ date: '', hours: '', notes: '' });
      queryClient.invalidateQueries({ queryKey: ['overtimeRecords'] });
      toast.success('Overtime recorded successfully');
    },
    onError: (error) => {
      const errorMessage = error?.message || error?.toString() || 'Failed to record overtime';
      toast.error(errorMessage);
      console.error('Overtime error:', error);
    },
  });

  // Create weekend roster mutation
  const createWeekendMutation = useMutation({
    mutationFn: async (data) => {
      if (!overtimePolicy) {
        throw new Error('No overtime policy configured. Please contact administrator.');
      }

      if (!data.date) {
        throw new Error('Date is required');
      }

      const dateObj = new Date(data.date);
      if (!isWeekend(dateObj)) {
        throw new Error('Please select a weekend date (Saturday or Sunday)');
      }

      const hoursPerDay = employee.weekly_contracted_hours / 5;
      const dayOfWeek = dateObj.getDay();
      const multiplier = dayOfWeek === 0 ? overtimePolicy.sunday_multiplier : overtimePolicy.saturday_multiplier;
      const pay = hoursPerDay * employee.base_hourly_rate * multiplier;
      const payrollPeriod = getPayrollPeriod(data.date);

      const record = await base44.entities.WeekendRoster.create({
        employee_id: employee.id,
        date: data.date,
        hours: hoursPerDay,
        pay: pay,
        notes: data.notes || '',
        payroll_period_year: payrollPeriod.year,
        payroll_period_month: payrollPeriod.month,
      });

      return record;
    },
    onSuccess: () => {
      setIsWeekendDialogOpen(false);
      setWeekendForm({ date: '', notes: '' });
      queryClient.invalidateQueries({ queryKey: ['weekendRosters'] });
      toast.success('Weekend work recorded successfully');
    },
    onError: (error) => {
      const errorMessage = error?.message || error?.toString() || 'Failed to record weekend work';
      toast.error(errorMessage);
      console.error('Weekend error:', error);
    },
  });

  // Delete overtime mutation
  const deleteOvertimeMutation = useMutation({
    mutationFn: (id) => base44.entities.OvertimeRecord.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overtimeRecords'] });
      toast.success('Overtime record deleted');
    },
  });

  // Delete weekend roster mutation
  const deleteWeekendMutation = useMutation({
    mutationFn: (id) => base44.entities.WeekendRoster.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekendRosters'] });
      toast.success('Weekend record deleted');
    },
  });

  const isLoading = userLoading || employeeLoading || overtimeLoading || weekendLoading;
  const isProfileComplete = employee?.profile_complete;

  // Calculate totals
  const totalOvertimeHours = overtimeRecords?.reduce((acc, r) => acc + (r.hours || 0), 0) || 0;
  const totalOvertimePay = overtimeRecords?.reduce((acc, r) => acc + (r.overtime_pay || 0), 0) || 0;
  const totalWeekendHours = weekendRosters?.reduce((acc, r) => acc + (r.hours || 0), 0) || 0;
  const totalWeekendPay = weekendRosters?.reduce((acc, r) => acc + (r.pay || 0), 0) || 0;

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
          <h1 className="text-3xl font-bold text-slate-900">Overtime & Weekend Work</h1>
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
              <h1 className="text-3xl font-bold text-slate-900">Overtime & Weekend Work</h1>
              <p className="mt-1 text-slate-500">
                Record your overtime hours and weekend roster
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                <SelectTrigger className="w-40 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((month, i) => (
                    <SelectItem key={i} value={(i + 1).toString()}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

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
          </div>
        </motion.div>

        {/* Summary Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="mb-8 grid gap-6 md:grid-cols-2"
        >
          <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-600">Total Overtime</p>
                  <p className="text-3xl font-bold text-purple-900">{totalOvertimeHours.toFixed(1)}h</p>
                  <p className="mt-1 text-lg font-semibold text-purple-700">{formatCurrency(totalOvertimePay)}</p>
                </div>
                <div className="rounded-xl bg-purple-100 p-4">
                  <Clock className="h-8 w-8 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-amber-600">Weekend Work</p>
                  <p className="text-3xl font-bold text-amber-900">{totalWeekendHours.toFixed(1)}h</p>
                  <p className="mt-1 text-lg font-semibold text-amber-700">{formatCurrency(totalWeekendPay)}</p>
                </div>
                <div className="rounded-xl bg-amber-100 p-4">
                  <Calendar className="h-8 w-8 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Rate Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="mb-8"
        >
          <Card className="bg-slate-50">
            <CardContent className="py-4">
              <div className="flex flex-wrap items-center gap-6 text-sm">
                <div>
                  <span className="text-slate-500">Weekday:</span>
                  <span className="ml-2 font-semibold text-slate-900">{overtimePolicy?.weekday_multiplier || 1.5}x ({formatCurrency(employee.base_hourly_rate * (overtimePolicy?.weekday_multiplier || 1.5))}/h)</span>
                </div>
                <div>
                  <span className="text-slate-500">Saturday:</span>
                  <span className="ml-2 font-semibold text-slate-900">{overtimePolicy?.saturday_multiplier || 1.5}x ({formatCurrency(employee.base_hourly_rate * (overtimePolicy?.saturday_multiplier || 1.5))}/h)</span>
                </div>
                <div>
                  <span className="text-slate-500">Sunday:</span>
                  <span className="ml-2 font-semibold text-slate-900">{overtimePolicy?.sunday_multiplier || 2.0}x ({formatCurrency(employee.base_hourly_rate * (overtimePolicy?.sunday_multiplier || 2.0))}/h)</span>
                </div>
                <div>
                  <span className="text-slate-500">Bank Holiday:</span>
                  <span className="ml-2 font-semibold text-slate-900">{overtimePolicy?.bank_holiday_multiplier || 2.0}x ({formatCurrency(employee.base_hourly_rate * (overtimePolicy?.bank_holiday_multiplier || 2.0))}/h)</span>
                </div>
              </div>
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
            <div className="mb-6 flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="overtime">Overtime</TabsTrigger>
                <TabsTrigger value="weekend">Weekend Roster</TabsTrigger>
              </TabsList>

              {activeTab === 'overtime' ? (
                <Dialog open={isOvertimeDialogOpen} onOpenChange={setIsOvertimeDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-purple-600 hover:bg-purple-700">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Overtime
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Record Overtime</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      createOvertimeMutation.mutate(overtimeForm);
                    }} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Date *</Label>
                        <DatePicker
                          selected={overtimeForm.date ? new Date(overtimeForm.date) : null}
                          onChange={(date) => {
                            if (date) {
                              const year = date.getFullYear();
                              const month = String(date.getMonth() + 1).padStart(2, '0');
                              const day = String(date.getDate()).padStart(2, '0');
                              setOvertimeForm(prev => ({ ...prev, date: `${year}-${month}-${day}` }));
                            } else {
                              setOvertimeForm(prev => ({ ...prev, date: '' }));
                            }
                          }}
                          dateFormat="dd/MM/yyyy"
                          placeholderText="DD/MM/YYYY"
                          className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          required
                        />
                        {overtimeForm.date && (
                          <p className="text-xs text-slate-500">
                            Day type: <span className="font-medium capitalize">
                              {getDayType(overtimeForm.date).type.replace('_', ' ')} 
                              ({getDayType(overtimeForm.date).multiplier}x rate)
                            </span>
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label>Hours *</Label>
                        <Input
                          type="number"
                          step="0.5"
                          min="0.5"
                          max="24"
                          value={overtimeForm.hours}
                          onChange={(e) => setOvertimeForm(prev => ({ ...prev, hours: e.target.value }))}
                          required
                        />
                      </div>

                      {overtimeForm.date && overtimeForm.hours && parseFloat(overtimeForm.hours) > 0 && (
                        <div className="rounded-lg bg-purple-50 p-3">
                          <p className="text-sm text-purple-800">
                            Estimated Pay: <span className="font-semibold">
                              {formatCurrency(calculateOvertimePay(
                                parseFloat(overtimeForm.hours),
                                employee.base_hourly_rate,
                                getDayType(overtimeForm.date).type,
                                getDayType(overtimeForm.date).multiplier
                              ))}
                            </span>
                          </p>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label>Notes (optional)</Label>
                        <Textarea
                          value={overtimeForm.notes}
                          onChange={(e) => setOvertimeForm(prev => ({ ...prev, notes: e.target.value }))}
                          placeholder="Any additional notes..."
                        />
                      </div>

                      <div className="flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={() => setIsOvertimeDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" className="bg-purple-600 hover:bg-purple-700" disabled={createOvertimeMutation.isPending}>
                          {createOvertimeMutation.isPending ? 'Saving...' : 'Save'}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              ) : (
                <Dialog open={isWeekendDialogOpen} onOpenChange={setIsWeekendDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-amber-600 hover:bg-amber-700">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Weekend Work
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Record Weekend Work</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      createWeekendMutation.mutate(weekendForm);
                    }} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Date (Weekend only) *</Label>
                        <DatePicker
                          selected={weekendForm.date ? new Date(weekendForm.date) : null}
                          onChange={(date) => {
                            if (date) {
                              const year = date.getFullYear();
                              const month = String(date.getMonth() + 1).padStart(2, '0');
                              const day = String(date.getDate()).padStart(2, '0');
                              setWeekendForm(prev => ({ ...prev, date: `${year}-${month}-${day}` }));
                            } else {
                              setWeekendForm(prev => ({ ...prev, date: '' }));
                            }
                          }}
                          dateFormat="dd/MM/yyyy"
                          placeholderText="DD/MM/YYYY"
                          className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          required
                        />
                        {weekendForm.date && !isWeekend(new Date(weekendForm.date)) && (
                          <p className="flex items-center gap-1 text-xs text-red-600">
                            <AlertCircle className="h-3 w-3" />
                            Please select a Saturday or Sunday
                          </p>
                        )}
                      </div>

                      {weekendForm.date && isWeekend(new Date(weekendForm.date)) && (
                        <div className="rounded-lg bg-amber-50 p-3 space-y-1">
                          <p className="text-sm text-amber-800">
                            Auto-calculated hours: <span className="font-semibold">
                              {(employee.weekly_contracted_hours / 5).toFixed(1)}h
                            </span>
                          </p>
                          <p className="text-sm text-amber-800">
                            Day: <span className="font-semibold">
                              {new Date(weekendForm.date).getDay() === 0 ? 'Sunday' : 'Saturday'} 
                              ({new Date(weekendForm.date).getDay() === 0 ? overtimePolicy?.sunday_multiplier : overtimePolicy?.saturday_multiplier}x)
                            </span>
                          </p>
                          <p className="text-sm text-amber-800">
                            Pay: <span className="font-semibold">
                              {formatCurrency((employee.weekly_contracted_hours / 5) * employee.base_hourly_rate * 
                                (new Date(weekendForm.date).getDay() === 0 ? overtimePolicy?.sunday_multiplier : overtimePolicy?.saturday_multiplier))}
                            </span>
                          </p>
                          <p className="text-xs text-amber-600">
                            Based on your weekly contracted hours ({employee.weekly_contracted_hours}h) ÷ 5
                          </p>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label>Notes (optional)</Label>
                        <Textarea
                          value={weekendForm.notes}
                          onChange={(e) => setWeekendForm(prev => ({ ...prev, notes: e.target.value }))}
                          placeholder="Any additional notes..."
                        />
                      </div>

                      <div className="flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={() => setIsWeekendDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button 
                          type="submit" 
                          className="bg-amber-600 hover:bg-amber-700" 
                          disabled={createWeekendMutation.isPending}
                        >
                          {createWeekendMutation.isPending ? 'Saving...' : 'Save'}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            <TabsContent value="overtime">
              <Card>
                <CardContent className="pt-6">
                  {!overtimeRecords || overtimeRecords.length === 0 ? (
                    <div className="py-12 text-center">
                      <Clock className="mx-auto h-12 w-12 text-slate-300" />
                      <p className="mt-4 text-slate-500">No overtime records for this period</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Day Type</TableHead>
                          <TableHead>Hours</TableHead>
                          <TableHead>Rate</TableHead>
                          <TableHead>Pay</TableHead>
                          <TableHead>Notes</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {overtimeRecords.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell className="font-medium">
                              {format(new Date(record.date), 'dd MMM yyyy')}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={
                                record.day_type === 'sunday' || record.day_type === 'bank_holiday'
                                  ? 'border-red-200 bg-red-50 text-red-700'
                                  : 'border-purple-200 bg-purple-50 text-purple-700'
                              }>
                                {record.day_type?.replace('_', ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">{record.hours?.toFixed(1)}h</TableCell>
                            <TableCell>{record.rate_multiplier}x</TableCell>
                            <TableCell className="font-medium text-emerald-600">
                              {formatCurrency(record.overtime_pay)}
                            </TableCell>
                            <TableCell className="text-slate-500 max-w-xs truncate">
                              {record.notes || '-'}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-slate-400 hover:text-red-600"
                                onClick={() => deleteOvertimeMutation.mutate(record.id)}
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

            <TabsContent value="weekend">
              <Card>
                <CardContent className="pt-6">
                  {!weekendRosters || weekendRosters.length === 0 ? (
                    <div className="py-12 text-center">
                      <Calendar className="mx-auto h-12 w-12 text-slate-300" />
                      <p className="mt-4 text-slate-500">No weekend work recorded for this period</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Hours</TableHead>
                          <TableHead>Pay</TableHead>
                          <TableHead>Notes</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {weekendRosters.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell className="font-medium">
                              {format(new Date(record.date), 'EEEE, dd MMM yyyy')}
                            </TableCell>
                            <TableCell className="font-medium">{record.hours?.toFixed(1)}h</TableCell>
                            <TableCell className="font-medium text-emerald-600">
                              {formatCurrency(record.pay)}
                            </TableCell>
                            <TableCell className="text-slate-500 max-w-xs truncate">
                              {record.notes || '-'}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-slate-400 hover:text-red-600"
                                onClick={() => deleteWeekendMutation.mutate(record.id)}
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