import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import {
  Calculator,
  Clock,
  Calendar,
  Euro,
  Save,
  AlertCircle,
  CheckCircle,
  Info,
  TrendingUp,
  Receipt,
  Loader2,
} from 'lucide-react';
import {
  checkEligibility,
  calculateMyFutureFund,
  validateAnnualCap,
} from '@/components/payroll/MyFutureFundCalculator.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import ProfileCompletionBanner from '@/components/profile/ProfileCompletionBanner';
import WorkingHoursSummary from '@/components/payroll/WorkingHoursSummary';
import {
  formatCurrency,
  getCutOffDate,
  getPaymentDate,
  calculateBaseHours,
  calculateFullPayroll,
  isBonusMonth,
  calculateQuarterlyBonus,
} from '@/components/payroll/IrishTaxCalculator';
import { calculatePeriodPay } from '@/components/payroll/TimeCardCalculator';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function PayrollEntry() {
  const queryClient = useQueryClient();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [calculatedPayroll, setCalculatedPayroll] = useState(null);

  const [selectedTaxBasis, setSelectedTaxBasis] = useState('');
  const [otherEarningsItems, setOtherEarningsItems] = useState([]);
  const [newEarningDesc, setNewEarningDesc] = useState('');
  const [newEarningValue, setNewEarningValue] = useState(0);
  const [otherDeductionsItems, setOtherDeductionsItems] = useState([]);
  const [newDeductionDesc, setNewDeductionDesc] = useState('');
  const [newDeductionValue, setNewDeductionValue] = useState(0);

  const [formData, setFormData] = useState({
    overtime_hours_1_5x: 0,
    overtime_pay_1_5x: 0,
    overtime_hours_2_0x: 0,
    overtime_pay_2_0x: 0,
    overtime_hours: 0,
    overtime_pay: 0,
    sick_leave_hours: 0,
    sick_leave_pay: 0,
    pto_hours: 0,
    bank_holiday_hours: 0,
    bank_holiday_worked_hours: 0,
    bank_holiday_worked_pay: 0,
    quarterly_bonus: 0,
    health_insurance: 0,
    unpaid_leave_hours: 0,
    night_premium_hours: 0,
    night_premium_pay: 0,
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
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const employee = employees?.[0];

  // Fetch employee's shift policy
  const { data: shiftPolicy } = useQuery({
    queryKey: ['shiftPolicy', employee?.shift_policy_id],
    queryFn: () => base44.entities.ShiftPolicy.filter({ id: employee?.shift_policy_id }),
    enabled: !!employee?.shift_policy_id,
  });

  const employeeShiftPolicy = shiftPolicy?.[0];

  // Fetch pension auto-enrolment record
  const { data: pensionRecords } = useQuery({
    queryKey: ['pensionAutoEnrolment', employee?.id],
    queryFn: () => base44.entities.PensionAutoEnrolment.filter({ employee_id: employee?.id }),
    enabled: !!employee?.id,
  });

  const pensionRecord = pensionRecords?.[0];

  // Fetch employee settings for validation
  const { data: settingsData } = useQuery({
    queryKey: ['employeeSettings', employee?.id],
    queryFn: () => base44.entities.EmployeeSettings.filter({ employee_id: employee?.id }),
    enabled: !!employee?.id,
  });

  // Fetch weekly time cards for night premium calculation - PERÍODO COMPLETO DO MÊS
  const { data: weeklyTimeCards } = useQuery({
    queryKey: ['weeklyTimeCards', employee?.id, selectedYear, selectedMonth],
    queryFn: async () => {
      const cutOffDate = getCutOffDate(selectedYear, selectedMonth);
      const startDate = new Date(getCutOffDate(selectedYear, selectedMonth - 1));
      startDate.setDate(startDate.getDate() + 1);
      
      console.log('[WeeklyTimeCards] Fetching for period:', {
        startDate: startDate.toISOString().split('T')[0],
        cutOffDate: cutOffDate.toISOString().split('T')[0],
        year: selectedYear,
        month: selectedMonth,
      });
      
      // Get all time cards for this employee in this year
      const allCards = await base44.entities.WeeklyTimeCard.filter({
        employee_id: employee?.id,
        year: selectedYear,
      });
      
      // Filter cards that fall within the payroll period (cut-off to cut-off)
      const filteredCards = allCards.filter(card => {
        // Calcular o início da semana ISO
        const yearStart = new Date(Date.UTC(selectedYear, 0, 1));
        const weekStart = new Date(yearStart);
        weekStart.setUTCDate(yearStart.getUTCDate() + (card.week_number - 1) * 7);
        
        const isInPeriod = weekStart >= startDate && weekStart <= cutOffDate;
        
        if (isInPeriod) {
          console.log('[WeeklyTimeCards] Week included:', {
            week: card.week_number,
            weekStart: weekStart.toISOString().split('T')[0],
            inPeriod: isInPeriod,
          });
        }
        
        return isInPeriod;
      });
      
      console.log('[WeeklyTimeCards] Total cards in period:', filteredCards.length);
      return filteredCards;
    },
    enabled: !!employee?.id,
  });

  // Fetch other earnings
  const { data: otherEarnings, refetch: refetchOtherEarnings } = useQuery({
    queryKey: ['otherEarnings', employee?.id, selectedYear, selectedMonth],
    queryFn: () => base44.entities.OtherEarnings.filter({
      employee_id: employee?.id,
      payroll_period_year: selectedYear,
      payroll_period_month: selectedMonth,
    }),
    enabled: !!employee?.id,
  });

  // Fetch other deductions
  const { data: otherDeductions, refetch: refetchOtherDeductions } = useQuery({
    queryKey: ['otherDeductions', employee?.id, selectedYear, selectedMonth],
    queryFn: () => base44.entities.OtherDeduction.filter({
      employee_id: employee?.id,
      payroll_period_year: selectedYear,
      payroll_period_month: selectedMonth,
    }),
    enabled: !!employee?.id,
  });

  useEffect(() => {
    if (otherEarnings) {
      setOtherEarningsItems(otherEarnings);
    }
  }, [otherEarnings]);

  useEffect(() => {
    if (otherDeductions) {
      setOtherDeductionsItems(otherDeductions);
    }
  }, [otherDeductions]);

  useEffect(() => {
    if (employee?.tax_basis && !selectedTaxBasis) {
      setSelectedTaxBasis(employee.tax_basis);
    }
  }, [employee]);

  // Fetch existing payroll entry
  const { data: existingEntries, isLoading: entryLoading, refetch: refetchEntry } = useQuery({
    queryKey: ['payrollEntry', employee?.id, selectedYear, selectedMonth],
    queryFn: () => base44.entities.PayrollEntry.filter({
      employee_id: employee?.id,
      period_year: selectedYear,
      period_month: selectedMonth,
    }),
    enabled: !!employee?.id,
  });

  const existingEntry = existingEntries?.[0];

  // Force refetch when year/month changes
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['overtime'] });
    queryClient.invalidateQueries({ queryKey: ['weekend'] });
    queryClient.invalidateQueries({ queryKey: ['leave'] });
    queryClient.invalidateQueries({ queryKey: ['sickLeave'] });
    queryClient.invalidateQueries({ queryKey: ['absence'] });
    queryClient.invalidateQueries({ queryKey: ['bankHolidayWorked'] });
  }, [selectedYear, selectedMonth, queryClient]);

  // Fetch YTD data based on Payment Date (not period)
  const { data: ytdEntries } = useQuery({
    queryKey: ['ytdEntries', employee?.id, selectedYear, selectedMonth],
    queryFn: async () => {
      // Get all payroll entries for employee
      const allEntries = await base44.entities.PayrollEntry.list();
      return allEntries.filter(e => e.employee_id === employee?.id);
    },
    enabled: !!employee?.id,
  });

  // Fetch overtime records
  const { data: overtimeRecords } = useQuery({
    queryKey: ['overtime', employee?.id, selectedYear, selectedMonth],
    queryFn: () => base44.entities.OvertimeRecord.filter({
      employee_id: employee?.id,
      payroll_period_year: selectedYear,
      payroll_period_month: selectedMonth,
    }),
    enabled: !!employee?.id,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Fetch weekend roster
  const { data: weekendRosters } = useQuery({
    queryKey: ['weekend', employee?.id, selectedYear, selectedMonth],
    queryFn: () => base44.entities.WeekendRoster.filter({
      employee_id: employee?.id,
      payroll_period_year: selectedYear,
      payroll_period_month: selectedMonth,
    }),
    enabled: !!employee?.id,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Fetch leave records
  const { data: leaveRecords } = useQuery({
    queryKey: ['leave', employee?.id, selectedYear, selectedMonth],
    queryFn: async () => {
      console.log('🔍 Fetching leave records for:', { employee_id: employee?.id, year: selectedYear, month: selectedMonth });
      const records = await base44.entities.LeaveRecord.filter({
        employee_id: employee?.id,
        payroll_period_year: selectedYear,
        payroll_period_month: selectedMonth,
      });
      console.log('📋 Leave records found:', records);
      return records;
    },
    enabled: !!employee?.id,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  // Fetch sick leave records
  const { data: sickLeaveRecords } = useQuery({
    queryKey: ['sickLeave', employee?.id, selectedYear, selectedMonth],
    queryFn: async () => {
      console.log('🔍 Fetching sick leave for:', { employee_id: employee?.id, year: selectedYear, month: selectedMonth });
      const records = await base44.entities.SickLeaveRecord.filter({
        employee_id: employee?.id,
        payroll_period_year: selectedYear,
        payroll_period_month: selectedMonth,
      });
      console.log('🤒 Sick leave found:', records);
      return records;
    },
    enabled: !!employee?.id,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  // Fetch absence/lateness records
  const { data: absenceRecords } = useQuery({
    queryKey: ['absence', employee?.id, selectedYear, selectedMonth],
    queryFn: async () => {
      console.log('🔍 Fetching absence records for:', { employee_id: employee?.id, year: selectedYear, month: selectedMonth });
      const records = await base44.entities.AbsenceLateness.filter({
        employee_id: employee?.id,
        payroll_period_year: selectedYear,
        payroll_period_month: selectedMonth,
      });
      console.log('❌ Absence records found:', records);
      return records;
    },
    enabled: !!employee?.id,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  // Fetch bank holiday worked records
  const { data: bankHolidayWorked } = useQuery({
    queryKey: ['bankHolidayWorked', employee?.id, selectedYear, selectedMonth],
    queryFn: async () => {
      const allRecords = await base44.entities.BankHoliday.filter({
        employee_id: employee?.id,
        year: selectedYear,
        status: 'Work',
      });
      // Filter by payroll month
      return allRecords.filter(record => {
        const period = getPayrollPeriod(record.date);
        return period.year === selectedYear && period.month === selectedMonth;
      });
    },
    enabled: !!employee?.id,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Initialize form with existing data
  useEffect(() => {
    if (existingEntry) {
      // Weekend breakdown from existing entry
      const saturdayHours = existingEntry.weekend_saturday_hours || 0;
      const sundayHours = existingEntry.weekend_sunday_hours || 0;
      const saturdayPay = existingEntry.weekend_saturday_pay || 0;
      const sundayPay = existingEntry.weekend_sunday_pay || 0;
      
      setFormData({
        overtime_hours_1_5x: existingEntry.overtime_hours_1_5x || 0,
        overtime_pay_1_5x: existingEntry.overtime_pay_1_5x || 0,
        overtime_hours_2_0x: existingEntry.overtime_hours_2_0x || 0,
        overtime_pay_2_0x: existingEntry.overtime_pay_2_0x || 0,
        overtime_hours: existingEntry.overtime_hours || 0,
        overtime_pay: existingEntry.overtime_pay || 0,
        weekend_saturday_hours: saturdayHours,
        weekend_saturday_pay: saturdayPay,
        weekend_sunday_hours: sundayHours,
        weekend_sunday_pay: sundayPay,
        weekend_hours: saturdayHours + sundayHours,
        weekend_pay: saturdayPay + sundayPay,
        sick_leave_hours: existingEntry.sick_leave_hours || 0,
        sick_leave_pay: existingEntry.sick_leave_pay || 0,
        pto_hours: existingEntry.pto_hours || 0,
        bank_holiday_hours: existingEntry.bank_holiday_hours || 0,
        bank_holiday_worked_hours: existingEntry.bank_holiday_worked_hours || 0,
        bank_holiday_worked_pay: existingEntry.bank_holiday_worked_pay || 0,
        quarterly_bonus: existingEntry.quarterly_bonus || 0,
        health_insurance: existingEntry.health_insurance || 0,
        other_earnings: existingEntry.other_earnings || 0,
        unpaid_leave_hours: existingEntry.unpaid_leave_hours || 0,
      });
    } else {
      // Calculate from records - group by rate (not just 1.5x and 2.0x)
      const overtimeByRate = {};
      overtimeRecords?.forEach(r => {
        const rate = r.rate_multiplier || 1.5;
        if (!overtimeByRate[rate]) {
          overtimeByRate[rate] = { hours: 0, pay: 0 };
        }
        overtimeByRate[rate].hours += (r.hours || 0);
        overtimeByRate[rate].pay += (r.overtime_pay || 0);
      });

      // Legacy groups for backward compatibility
      const overtime1_5x = overtimeRecords?.filter(r => r.rate_multiplier === 1.5) || [];
      const overtime2_0x = overtimeRecords?.filter(r => r.rate_multiplier >= 2.0) || [];

      const totalOvertimeHours1_5x = overtime1_5x.reduce((acc, r) => acc + (r.hours || 0), 0);
      const totalOvertimePay1_5x = overtime1_5x.reduce((acc, r) => acc + (r.overtime_pay || 0), 0);
      const totalOvertimeHours2_0x = overtime2_0x.reduce((acc, r) => acc + (r.hours || 0), 0);
      const totalOvertimePay2_0x = overtime2_0x.reduce((acc, r) => acc + (r.overtime_pay || 0), 0);
      const totalOvertimeHours = totalOvertimeHours1_5x + totalOvertimeHours2_0x;
      const totalOvertimePay = totalOvertimePay1_5x + totalOvertimePay2_0x;
      // Weekend - separate Saturday and Sunday with pre-calculated pay
      const saturdayRosters = weekendRosters?.filter(r => new Date(r.date).getDay() === 6) || [];
      const sundayRosters = weekendRosters?.filter(r => new Date(r.date).getDay() === 0) || [];
      const totalSaturdayHours = saturdayRosters.reduce((acc, r) => acc + (r.hours || 0), 0);
      const totalSaturdayPay = saturdayRosters.reduce((acc, r) => acc + (r.pay || 0), 0);
      const totalSundayHours = sundayRosters.reduce((acc, r) => acc + (r.hours || 0), 0);
      const totalSundayPay = sundayRosters.reduce((acc, r) => acc + (r.pay || 0), 0);
      const totalWeekendHours = totalSaturdayHours + totalSundayHours;
      const totalWeekendPay = totalSaturdayPay + totalSundayPay;
      
      const totalPtoHours = leaveRecords?.filter(l => l.leave_type === 'annual_leave').reduce((acc, l) => acc + (l.total_hours || 0), 0) || 0;
      const totalBankHolidayHours = leaveRecords?.filter(l => l.leave_type === 'bank_holiday').reduce((acc, l) => acc + (l.total_hours || 0), 0) || 0;
      const totalSickHours = sickLeaveRecords?.reduce((acc, s) => acc + (s.total_hours || 0), 0) || 0;
      const totalSickPay = sickLeaveRecords?.reduce((acc, s) => acc + (s.statutory_pay || 0), 0) || 0;
      const totalUnpaidHours = absenceRecords?.reduce((acc, a) => acc + (a.total_hours || 0), 0) || 0;
      const totalBankHolidayWorkedHours = bankHolidayWorked?.reduce((acc, b) => acc + (b.hours_worked || 0), 0) || 0;
      const totalBankHolidayWorkedPay = bankHolidayWorked?.reduce((acc, b) => acc + (b.pay || 0), 0) || 0;

      const bonus = isBonusMonth(selectedMonth) && employee
        ? calculateQuarterlyBonus(employee.base_hourly_rate, employee.weekly_contracted_hours)
        : 0;

      setFormData({
        overtime_hours_1_5x: totalOvertimeHours1_5x,
        overtime_pay_1_5x: totalOvertimePay1_5x,
        overtime_hours_2_0x: totalOvertimeHours2_0x,
        overtime_pay_2_0x: totalOvertimePay2_0x,
        overtime_hours: totalOvertimeHours,
        overtime_pay: totalOvertimePay,
        weekend_saturday_hours: totalSaturdayHours,
        weekend_saturday_pay: totalSaturdayPay,
        weekend_sunday_hours: totalSundayHours,
        weekend_sunday_pay: totalSundayPay,
        weekend_hours: totalWeekendHours,
        weekend_pay: totalWeekendPay,
        sick_leave_hours: totalSickHours,
        sick_leave_pay: totalSickPay,
        pto_hours: totalPtoHours,
        bank_holiday_hours: totalBankHolidayHours,
        bank_holiday_worked_hours: totalBankHolidayWorkedHours,
        bank_holiday_worked_pay: totalBankHolidayWorkedPay,
        quarterly_bonus: bonus,
        health_insurance: employee?.health_insurance_benefit || 0,
        unpaid_leave_hours: totalUnpaidHours,
        });
    }
  }, [existingEntry, overtimeRecords, weekendRosters, leaveRecords, sickLeaveRecords, absenceRecords, bankHolidayWorked, employee, selectedMonth]);

  const totalOtherEarnings = otherEarningsItems.reduce((acc, item) => acc + (item.amount || 0), 0);
  const totalOtherDeductions = otherDeductionsItems.reduce((acc, item) => acc + (item.amount || 0), 0);

  // Calculate payment date first
  const cutOffDate = getCutOffDate(selectedYear, selectedMonth);
  const paymentDate = getPaymentDate(selectedYear, selectedMonth);
  const baseHours = employee ? calculateBaseHours(selectedYear, selectedMonth, employee.weekly_contracted_hours) : 0;

  // Calculate YTD totals based on Payment Date (not period)
  // Only include entries with payment_date in the same tax year and before current payment date
  const ytdTotals = React.useMemo(() => {
    if (!ytdEntries || !paymentDate) return { gross: 0, paye: 0, usc: 0, prsi: 0, my_future_fund: 0 };
    
    const currentPaymentDate = paymentDate;
    const paymentYear = currentPaymentDate.getFullYear();
    const paymentMonth = currentPaymentDate.getMonth() + 1;
    
    // Tax year starts in January (payment date determines tax year)
    const relevantEntries = ytdEntries.filter(e => {
      if (!e.payment_date) return false;
      
      const entryPaymentDate = new Date(e.payment_date);
      const entryPaymentYear = entryPaymentDate.getFullYear();
      const entryPaymentMonth = entryPaymentDate.getMonth() + 1;
      
      // Same tax year and payment month is before current payment month
      return entryPaymentYear === paymentYear && entryPaymentMonth < paymentMonth;
    });
    
    return relevantEntries.reduce((acc, entry) => ({
      gross: acc.gross + (entry.gross_pay || 0),
      paye: acc.paye + (entry.paye || 0),
      usc: acc.usc + (entry.usc || 0),
      prsi: acc.prsi + (entry.prsi || 0),
      my_future_fund: acc.my_future_fund + (entry.my_future_fund_employee || 0),
      }), { gross: 0, paye: 0, usc: 0, prsi: 0, my_future_fund: 0 });
      }, [ytdEntries, paymentDate]);

  // Calculate rolling annual earnings for My Future Fund
  const rollingAnnualEarnings = React.useMemo(() => {
    if (!ytdEntries || !paymentDate) return 0;
    const paymentYear = paymentDate.getFullYear();
    const relevantEntries = ytdEntries.filter(e => {
      if (!e.payment_date) return false;
      const entryPaymentDate = new Date(e.payment_date);
      return entryPaymentDate.getFullYear() === paymentYear;
    });
    return relevantEntries.reduce((sum, e) => sum + (e.gross_pay || 0), 0);
  }, [ytdEntries, paymentDate]);

  // Check My Future Fund eligibility and calculate contribution
  const myFutureFund = React.useMemo(() => {
    if (!employee?.profile_complete || !paymentDate) return null;
    
    const eligibility = checkEligibility(
      employee,
      pensionRecord,
      calculatedPayroll?.grossPay || 0,
      format(paymentDate, 'yyyy-MM-dd'),
      'monthly'
    );

    if (!eligibility.eligible || pensionRecord?.opt_out_status) {
      return { eligibility, contribution: null };
    }

    const contribution = calculateMyFutureFund(
      calculatedPayroll?.grossPay || 0,
      format(paymentDate, 'yyyy-MM-dd'),
      'monthly'
    );

    // Validate annual cap
    const ytdPension = ytdTotals.my_future_fund || 0;
    const capValidation = validateAnnualCap(ytdPension, contribution.employeeContribution, contribution.annualisedEarnings);

    if (!capValidation.valid) {
      contribution.employeeContribution = capValidation.cappedContribution;
      contribution.employerContribution = capValidation.cappedContribution;
      contribution.stateContribution = capValidation.cappedContribution / 3;
      contribution.totalContribution = contribution.employeeContribution + contribution.employerContribution + contribution.stateContribution;
    }

    return { eligibility, contribution, capValidation };
  }, [employee, pensionRecord, paymentDate, calculatedPayroll?.grossPay, ytdTotals]);

  // Calculate payroll when data changes - use memoized values
  const totalPtoHours = React.useMemo(() => 
    leaveRecords?.filter(l => l.leave_type === 'annual_leave').reduce((acc, l) => acc + (l.total_hours || 0), 0) || 0,
    [leaveRecords]
  );

  const totalBankHolidayHours = React.useMemo(() => 
    leaveRecords?.filter(l => l.leave_type === 'bank_holiday').reduce((acc, l) => acc + (l.total_hours || 0), 0) || 0,
    [leaveRecords]
  );

  const totalSickHours = React.useMemo(() => 
    sickLeaveRecords?.reduce((acc, s) => acc + (s.total_hours || 0), 0) || 0,
    [sickLeaveRecords]
  );

  const totalSickPay = React.useMemo(() => 
    sickLeaveRecords?.reduce((acc, s) => acc + (s.statutory_pay || 0), 0) || 0,
    [sickLeaveRecords]
  );

  const totalUnpaidHours = React.useMemo(() => 
    absenceRecords?.reduce((acc, a) => acc + (a.total_hours || 0), 0) || 0,
    [absenceRecords]
  );

  useEffect(() => {
    if (!employee?.profile_complete) return;

    const scheduledHours = calculateBaseHours(selectedYear, selectedMonth, employee.weekly_contracted_hours);
    
    // Overtime breakdown - always recalculate from overtimeRecords
    const overtime1_5x = overtimeRecords?.filter(r => r.rate_multiplier === 1.5) || [];
    const overtime2_0x = overtimeRecords?.filter(r => r.rate_multiplier >= 2.0) || [];
    const totalOvertimeHours1_5x = overtime1_5x.reduce((acc, r) => acc + (r.hours || 0), 0);
    const totalOvertimePay1_5x = overtime1_5x.reduce((acc, r) => acc + (r.overtime_pay || 0), 0);
    const totalOvertimeHours2_0x = overtime2_0x.reduce((acc, r) => acc + (r.hours || 0), 0);
    const totalOvertimePay2_0x = overtime2_0x.reduce((acc, r) => acc + (r.overtime_pay || 0), 0);
    const totalOvertimeHours = totalOvertimeHours1_5x + totalOvertimeHours2_0x;
    const totalOvertimePay = totalOvertimePay1_5x + totalOvertimePay2_0x;
    
    // Weekend breakdown - always recalculate from weekendRosters
    const saturdayRosters = weekendRosters?.filter(r => new Date(r.date).getDay() === 6) || [];
    const sundayRosters = weekendRosters?.filter(r => new Date(r.date).getDay() === 0) || [];
    const totalSaturdayHours = saturdayRosters.reduce((acc, r) => acc + (r.hours || 0), 0);
    const totalSaturdayPay = saturdayRosters.reduce((acc, r) => acc + (r.pay || 0), 0);
    const totalSundayHours = sundayRosters.reduce((acc, r) => acc + (r.hours || 0), 0);
    const totalSundayPay = sundayRosters.reduce((acc, r) => acc + (r.pay || 0), 0);
    const totalWeekendHours = totalSaturdayHours + totalSundayHours;
    const totalWeekendPay = totalSaturdayPay + totalSundayPay;

    const totalBankHolidayWorkedHours = bankHolidayWorked?.reduce((acc, b) => acc + (b.hours_worked || 0), 0) || 0;
    const totalBankHolidayWorkedPay = bankHolidayWorked?.reduce((acc, b) => acc + (b.pay || 0), 0) || 0;

    // CRITICAL: Unpaid absence reduces Scheduled Hours → Paid Hours
    const paidHours = Math.max(0, scheduledHours - 
      totalSaturdayHours - 
      totalSundayHours - 
      totalPtoHours - 
      totalBankHolidayHours - 
      totalUnpaidHours - 
      totalBankHolidayWorkedHours
    );
    
    // Calcular horas e pagamento baseado no Time Card real ou shift pattern padrão
    let nightPremiumHours = 0;
    let nightPremiumAdditional = 0; // Apenas o adicional (extra pago)
    let regularPayFromTimeCard = 0;
    let totalPayFromTimeCard = 0;
    
    // CRITICAL: Generate virtual time cards for ALL weeks in period based on shift pattern
    // This ensures night premium is calculated for entire pay period, not just saved weeks
    const cutOffDate = getCutOffDate(selectedYear, selectedMonth);
    const periodStartDate = new Date(getCutOffDate(selectedYear, selectedMonth - 1));
    periodStartDate.setDate(periodStartDate.getDate() + 1);
    
    // Calculate all ISO weeks in the pay period
    const getISOWeek = (date) => {
      const target = new Date(date.valueOf());
      const dayNum = (date.getUTCDay() + 6) % 7;
      target.setUTCDate(target.getUTCDate() - dayNum + 3);
      const firstThursday = target.valueOf();
      target.setUTCMonth(0, 1);
      if (target.getUTCDay() !== 4) {
        target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7);
      }
      return 1 + Math.ceil((firstThursday - target) / 604800000);
    };
    
    const allWeeksInPeriod = [];
    const currentDate = new Date(periodStartDate);
    const processedWeeks = new Set();
    
    while (currentDate <= cutOffDate) {
      const weekNum = getISOWeek(currentDate);
      const weekKey = `${selectedYear}-${weekNum}`;
      
      if (!processedWeeks.has(weekKey)) {
        processedWeeks.add(weekKey);
        allWeeksInPeriod.push({ year: selectedYear, week_number: weekNum });
      }
      
      currentDate.setDate(currentDate.getDate() + 7); // Next week
    }
    
    console.log('[PayrollEntry] Period weeks:', {
      periodStart: periodStartDate.toISOString().split('T')[0],
      cutOff: cutOffDate.toISOString().split('T')[0],
      totalWeeks: allWeeksInPeriod.length,
      weeks: allWeeksInPeriod,
    });
    
    // Collect all non-worked dates (leave, sick leave, absence, bank holidays)
    const nonWorkedDates = new Set();
    
    // Add leave dates
    leaveRecords?.forEach(leave => {
      const start = new Date(leave.start_date);
      const end = new Date(leave.end_date);
      const current = new Date(start);
      while (current <= end) {
        const dayOfWeek = current.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Skip weekends
          nonWorkedDates.add(current.toISOString().split('T')[0]);
        }
        current.setDate(current.getDate() + 1);
      }
    });
    
    // Add sick leave dates
    sickLeaveRecords?.forEach(sick => {
      const start = new Date(sick.start_date);
      const end = new Date(sick.end_date);
      const current = new Date(start);
      while (current <= end) {
        const dayOfWeek = current.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Skip weekends
          nonWorkedDates.add(current.toISOString().split('T')[0]);
        }
        current.setDate(current.getDate() + 1);
      }
    });
    
    // Add absence dates
    absenceRecords?.forEach(absence => {
      nonWorkedDates.add(absence.date);
    });

    // Add bank holiday worked dates (exclude from regular hours; paid separately at 2.0x)
    bankHolidayWorked?.forEach(b => {
      try {
        const d = typeof b.date === 'string' ? new Date(b.date) : new Date(b.date);
        const dateStr = d.toISOString().split('T')[0];
        nonWorkedDates.add(dateStr);
      } catch {}
    });
    
    console.log('[PayrollEntry] Non-worked dates:', Array.from(nonWorkedDates));
    
    // Merge saved time cards with virtual time cards based on shift pattern
    const completeTimeCards = allWeeksInPeriod.map(weekInfo => {
      const savedCard = weeklyTimeCards?.find(
        card => card.year === weekInfo.year && card.week_number === weekInfo.week_number
      );
      
      if (savedCard) {
        console.log('[PayrollEntry] Using saved time card for week', weekInfo.week_number);
        
        // CRITICAL: Apply leave/sick/absence exclusions to saved cards too
        // Calculate week start date to check each day
        const yearStart = new Date(Date.UTC(weekInfo.year, 0, 1));
        const weekStart = new Date(yearStart);
        weekStart.setUTCDate(yearStart.getUTCDate() + (weekInfo.week_number - 1) * 7);
        
        // Get Monday of this ISO week
        const dayOfWeek = weekStart.getUTCDay();
        const daysToMonday = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
        weekStart.setUTCDate(weekStart.getUTCDate() + daysToMonday);
        
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        const adjustedCard = { ...savedCard };
        
        days.forEach((day, index) => {
          const currentDate = new Date(weekStart);
          currentDate.setUTCDate(weekStart.getUTCDate() + index);
          const dateStr = currentDate.toISOString().split('T')[0];
          
          // Check if this day is a non-worked day (leave, absence, etc.)
          const isNonWorked = nonWorkedDates.has(dateStr);
          
          if (isNonWorked) {
            // Override saved times with empty (exclude from night premium)
            adjustedCard[`${day}_start`] = '';
            adjustedCard[`${day}_end`] = '';
            adjustedCard[`${day}_break`] = 0;
            adjustedCard[`${day}_lunch`] = 0;
            console.log(`[PayrollEntry] Excluding ${day} ${dateStr} from saved time card (non-worked)`);
          }
        });
        
        return adjustedCard;
      }
      
      // Generate virtual time card based on shift pattern
      if (employeeShiftPolicy) {
        console.log('[PayrollEntry] Generating virtual time card for week', weekInfo.week_number, 'based on shift policy');
        
        // Calculate week start date
        const yearStart = new Date(Date.UTC(weekInfo.year, 0, 1));
        const weekStart = new Date(yearStart);
        weekStart.setUTCDate(yearStart.getUTCDate() + (weekInfo.week_number - 1) * 7);
        
        // Get Monday of this ISO week
        const dayOfWeek = weekStart.getUTCDay();
        const daysToMonday = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
        weekStart.setUTCDate(weekStart.getUTCDate() + daysToMonday);
        
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        const virtualCard = {
          employee_id: employee.id,
          year: weekInfo.year,
          week_number: weekInfo.week_number,
          _virtual: true,
        };
        
        days.forEach((day, index) => {
          const currentDate = new Date(weekStart);
          currentDate.setUTCDate(weekStart.getUTCDate() + index);
          const dateStr = currentDate.toISOString().split('T')[0];
          
          // Check if this day is a non-worked day (leave, absence, etc.)
          const isNonWorked = nonWorkedDates.has(dateStr);
          
          if (isNonWorked) {
            // Mark as non-worked (empty times)
            virtualCard[`${day}_start`] = '';
            virtualCard[`${day}_end`] = '';
            virtualCard[`${day}_break`] = 0;
            virtualCard[`${day}_lunch`] = 0;
            console.log(`[PayrollEntry] Excluding ${day} ${dateStr} from night premium (non-worked)`);
          } else if (index < 5) {
            // Mon-Fri: use shift pattern
            virtualCard[`${day}_start`] = employeeShiftPolicy.start_time;
            virtualCard[`${day}_end`] = employeeShiftPolicy.end_time;
            virtualCard[`${day}_break`] = employeeShiftPolicy.paid_break_minutes || 0;
            virtualCard[`${day}_lunch`] = employeeShiftPolicy.unpaid_lunch_minutes || 30;
          } else {
            // Weekend: empty unless worked
            virtualCard[`${day}_start`] = '';
            virtualCard[`${day}_end`] = '';
            virtualCard[`${day}_break`] = 0;
            virtualCard[`${day}_lunch`] = 0;
          }
        });
        
        return virtualCard;
      }
      
      return null;
    }).filter(Boolean);
    
    // CRITICAL: Só calcular night premium se o shift policy tem configuração de night premium
    const hasNightPremium = employeeShiftPolicy?.night_premium_start_time && 
                            employeeShiftPolicy.night_premium_start_time.trim() !== '';
    
    if (completeTimeCards.length > 0 && hasNightPremium) {
      console.log('[PayrollEntry] Using Shift Policy for Night Premium:', {
        policyId: employeeShiftPolicy?.id,
        policyName: employeeShiftPolicy?.shift_name,
        startTime: employeeShiftPolicy?.start_time,
        endTime: employeeShiftPolicy?.end_time,
        nightPremiumStart: employeeShiftPolicy?.night_premium_start_time,
        nightPremiumRate: employeeShiftPolicy?.night_premium_rate,
      });
      
      const periodCalc = calculatePeriodPay(
        completeTimeCards, 
        employeeShiftPolicy, 
        employee.base_hourly_rate
      );
      
      nightPremiumHours = periodCalc.nightPremiumHours;
      nightPremiumAdditional = periodCalc.nightPremiumPay; // Já retorna apenas o adicional
      regularPayFromTimeCard = periodCalc.regularPay;
      totalPayFromTimeCard = periodCalc.totalPay;
      
      console.log('[PayrollEntry] Time Card Calculation (with virtual cards):', {
        totalHours: periodCalc.totalHours,
        regularHours: periodCalc.regularHours,
        regularPay: periodCalc.regularPay,
        nightPremiumHours: periodCalc.nightPremiumHours,
        nightPremiumAdditional: periodCalc.nightPremiumPay,
        totalPay: periodCalc.totalPay,
        weekCount: completeTimeCards.length,
        savedCards: weeklyTimeCards?.length || 0,
        virtualCards: completeTimeCards.filter(c => c._virtual).length,
        shiftPolicyApplied: !!employeeShiftPolicy,
      });
    } else if (completeTimeCards.length > 0 && !hasNightPremium) {
      console.log('[PayrollEntry] Day Shift - No Night Premium calculation');
      // Calcular apenas horas regulares sem night premium
      const periodCalc = calculatePeriodPay(
        completeTimeCards, 
        { ...employeeShiftPolicy, night_premium_start_time: null }, // Force no night premium
        employee.base_hourly_rate
      );
      
      regularPayFromTimeCard = periodCalc.regularPay;
      totalPayFromTimeCard = periodCalc.totalPay;
      nightPremiumHours = 0;
      nightPremiumAdditional = 0;
    }

    // CRITICAL: Base Pay deve refletir Regular Hours (sem night premium adicional)
    // O night premium adicional é separado em "other_earnings"
    // Forçar Base Pay a usar as mesmas horas do resumo (paidHours)
    const baseHoursToUse = paidHours;
    const basePayToUse = baseHoursToUse * employee.base_hourly_rate;

    const result = calculateFullPayroll({
      baseHours: baseHoursToUse,
      hourlyRate: employee.base_hourly_rate,
      weekendHours: totalWeekendHours,
      weekendPayAmount: totalWeekendPay,
      overtimeHours: totalOvertimeHours,
      overtimePayAmount: totalOvertimePay,
      sickLeaveHours: totalSickHours,
      sickPayAmount: totalSickPay,
      ptoHours: totalPtoHours,
      bankHolidayHours: totalBankHolidayHours,
      bankHolidayWorkedPay: totalBankHolidayWorkedPay,
      quarterlyBonus: formData.quarterly_bonus,
      healthInsurance: formData.health_insurance,
      otherEarnings: totalOtherEarnings + nightPremiumAdditional, // Adicionar night premium ao gross
      unpaidLeaveHours: totalUnpaidHours,
      annualTaxCredits: employee.annual_tax_credits,
      standardRateCutOff: employee.standard_rate_cut_off,
      taxBasis: selectedTaxBasis || employee.tax_basis,
      hasMedicalCard: employee.has_medical_card,
      prsiClass: employee.prsi_class,
      prsiSubclass: employee.prsi_subclass || 'A1',
      prsiRate: employee.prsi_rate,
      usc_band_1_rate: employee.usc_band_1_rate,
      usc_band_2_rate: employee.usc_band_2_rate,
      usc_band_3_rate: employee.usc_band_3_rate,
      usc_band_4_rate: employee.usc_band_4_rate,
      usc_band_1_threshold: employee.usc_band_1_threshold,
      usc_band_2_threshold: employee.usc_band_2_threshold,
      usc_band_3_threshold: employee.usc_band_3_threshold,
      ytdGross: ytdTotals.gross,
      ytdPAYE: ytdTotals.paye,
      ytdUSC: ytdTotals.usc,
      ytdPRSI: ytdTotals.prsi,
      paymentDate: format(paymentDate, 'yyyy-MM-dd'),
    });

    // Apply post-tax deductions
    const myFutureFundDeduction = myFutureFund?.contribution?.employeeContribution || 0;
    const finalNetPay = Math.max(0, result.netPay - totalOtherDeductions - myFutureFundDeduction);

    setCalculatedPayroll({
      ...result,
      otherDeductions: totalOtherDeductions,
      myFutureFundEmployee: myFutureFundDeduction,
      myFutureFundEmployer: myFutureFund?.contribution?.employerContribution || 0,
      myFutureFundState: myFutureFund?.contribution?.stateContribution || 0,
      finalNetPay,
      nightPremiumHours,
      nightPremiumAdditional, // Apenas o adicional
      regularHours: baseHoursToUse,
      shiftPolicy: employeeShiftPolicy,
      overtime_hours_1_5x: totalOvertimeHours1_5x,
      overtime_pay_1_5x: totalOvertimePay1_5x,
      overtime_hours_2_0x: totalOvertimeHours2_0x,
      overtime_pay_2_0x: totalOvertimePay2_0x,
      overtime_hours: totalOvertimeHours,
      overtime_pay: totalOvertimePay,
      weekend_saturday_hours: totalSaturdayHours,
      weekend_saturday_pay: totalSaturdayPay,
      weekend_sunday_hours: totalSundayHours,
      weekend_sunday_pay: totalSundayPay,
      weekend_hours: totalWeekendHours,
      weekend_pay: totalWeekendPay,
      sick_leave_hours: totalSickHours,
      pto_hours: totalPtoHours,
      bank_holiday_hours: totalBankHolidayHours,
      bank_holiday_worked_hours: totalBankHolidayWorkedHours,
      bankHolidayWorkedPay: totalBankHolidayWorkedPay,
    });
  }, [
    employee, 
    employeeShiftPolicy, 
    selectedYear, 
    selectedMonth, 
    selectedTaxBasis,
    weekendRosters, 
    overtimeRecords, 
    bankHolidayWorked, 
    ytdTotals, 
    totalOtherDeductions, 
    totalOtherEarnings,
    myFutureFund,
    totalPtoHours,
    totalBankHolidayHours,
    totalSickHours,
    totalSickPay,
    totalUnpaidHours,
    formData.quarterly_bonus, 
    formData.health_insurance, 
    weeklyTimeCards,
    paymentDate
  ]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      console.log('=== SAVE MUTATION START ===');
      console.log('calculatedPayroll:', calculatedPayroll);
      console.log('employee:', employee);
      
      if (!calculatedPayroll || !employee) {
        console.error('Missing data - calculatedPayroll:', !!calculatedPayroll, 'employee:', !!employee);
        throw new Error('Missing payroll data or employee information');
      }

      const cutOffDate = getCutOffDate(selectedYear, selectedMonth);
      const paymentDate = getPaymentDate(selectedYear, selectedMonth);
      const baseHours = calculateBaseHours(selectedYear, selectedMonth, employee.weekly_contracted_hours);
      
      // Weekend breakdown
      const saturdayRosters = weekendRosters?.filter(r => new Date(r.date).getDay() === 6) || [];
      const sundayRosters = weekendRosters?.filter(r => new Date(r.date).getDay() === 0) || [];
      const totalSaturdayHours = saturdayRosters.reduce((acc, r) => acc + (r.hours || 0), 0);
      const totalSaturdayPay = saturdayRosters.reduce((acc, r) => acc + (r.pay || 0), 0);
      const totalSundayHours = sundayRosters.reduce((acc, r) => acc + (r.hours || 0), 0);
      const totalSundayPay = sundayRosters.reduce((acc, r) => acc + (r.pay || 0), 0);
      const totalWeekendHours = totalSaturdayHours + totalSundayHours;
      const totalWeekendPay = totalSaturdayPay + totalSundayPay;

      // Auto-enrol in My Future Fund if eligible and not yet enrolled (skip audit log for non-admin)
      if (myFutureFund?.eligibility?.eligible && !pensionRecord && myFutureFund?.contribution) {
        try {
          const enrolmentDate = format(paymentDate, 'yyyy-MM-dd');
          const optOutAllowedFrom = new Date(paymentDate);
          optOutAllowedFrom.setMonth(optOutAllowedFrom.getMonth() + 6);

          await base44.entities.PensionAutoEnrolment.create({
            employee_id: employee.id,
            eligibility_status: 'eligible',
            eligibility_reason: 'Auto-enrolled via payroll',
            enrolment_date: enrolmentDate,
            opt_out_allowed_from: format(optOutAllowedFrom, 'yyyy-MM-dd'),
            opt_out_status: false,
            contribution_phase: myFutureFund.contribution.phase,
            rolling_annual_earnings: myFutureFund.contribution.annualisedEarnings || 0,
            last_eligibility_check: enrolmentDate,
          });
        } catch (error) {
          console.log('Pension auto-enrolment skipped (permissions):', error);
        }
      }

      const payload = {
        employee_id: employee.id,
        period_year: selectedYear,
        period_month: selectedMonth,
        cut_off_date: format(cutOffDate, 'yyyy-MM-dd'),
        payment_date: format(paymentDate, 'yyyy-MM-dd'),
        base_hours: baseHours,
        base_pay: calculatedPayroll.basePay,
        weekend_saturday_hours: totalSaturdayHours,
        weekend_saturday_pay: totalSaturdayPay,
        weekend_sunday_hours: totalSundayHours,
        weekend_sunday_pay: totalSundayPay,
        weekend_hours: totalWeekendHours,
        weekend_pay: totalWeekendPay,
        overtime_hours_1_5x: calculatedPayroll.overtime_hours_1_5x || 0,
        overtime_pay_1_5x: calculatedPayroll.overtime_pay_1_5x || 0,
        overtime_hours_2_0x: calculatedPayroll.overtime_hours_2_0x || 0,
        overtime_pay_2_0x: calculatedPayroll.overtime_pay_2_0x || 0,
        overtime_hours: calculatedPayroll.overtime_hours || 0,
        overtime_pay: calculatedPayroll.overtime_pay || 0,
        sick_leave_hours: calculatedPayroll.sick_leave_hours || formData.sick_leave_hours,
        sick_leave_pay: calculatedPayroll.sickPay || formData.sick_leave_pay,
        pto_hours: calculatedPayroll.pto_hours || formData.pto_hours,
        pto_pay: calculatedPayroll.ptoPay,
        bank_holiday_hours: calculatedPayroll.bank_holiday_hours || formData.bank_holiday_hours,
        bank_holiday_pay: calculatedPayroll.bankHolidayPay,
        bank_holiday_worked_hours: calculatedPayroll.bank_holiday_worked_hours || formData.bank_holiday_worked_hours,
        bank_holiday_worked_pay: calculatedPayroll.bankHolidayWorkedPay || formData.bank_holiday_worked_pay,
        quarterly_bonus: formData.quarterly_bonus,
        health_insurance: formData.health_insurance,
        other_earnings: totalOtherEarnings + (calculatedPayroll?.nightPremiumAdditional || 0),
        unpaid_leave_hours: formData.unpaid_leave_hours,
        unpaid_leave_deduction: 0,
        gross_pay: calculatedPayroll.grossPay,
        paye: calculatedPayroll.paye,
        usc: calculatedPayroll.usc,
        prsi: calculatedPayroll.prsi,
        total_deductions: calculatedPayroll.totalDeductions,
        my_future_fund_employee: calculatedPayroll.myFutureFundEmployee || 0,
        my_future_fund_employer: calculatedPayroll.myFutureFundEmployer || 0,
        my_future_fund_state: calculatedPayroll.myFutureFundState || 0,
        net_pay: calculatedPayroll.netPay,
        ytd_gross: calculatedPayroll.ytd.gross,
        ytd_paye: calculatedPayroll.ytd.paye,
        ytd_usc: calculatedPayroll.ytd.usc,
        ytd_prsi: calculatedPayroll.ytd.prsi,
        ytd_my_future_fund: (ytdTotals.my_future_fund || 0) + (calculatedPayroll.myFutureFundEmployee || 0),
        ytd_net: calculatedPayroll.ytd.net,
        status: 'draft',
        };

      console.log('Payload:', payload);
      console.log('Existing entry:', existingEntry);
      
      if (existingEntry?.id) {
        console.log('Updating existing entry:', existingEntry.id);
        const result = await base44.entities.PayrollEntry.update(existingEntry.id, payload);
        console.log('Update result:', result);
        return result;
      } else {
        console.log('Creating new entry');
        const result = await base44.entities.PayrollEntry.create(payload);
        console.log('Create result:', result);
        return result;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payrollEntry'] });
      queryClient.invalidateQueries({ queryKey: ['ytdEntries'] });
      toast.success('Payroll entry saved successfully');
      refetchEntry();
    },
    onError: (error) => {
      toast.error(error?.message || 'Failed to save payroll entry');
      console.error('Save error:', error);
    },
  });

  const isLoading = userLoading || employeeLoading || entryLoading;

  // Check profile completion
  const getMissingFields = () => {
    if (!employee) return ['Complete Profile Setup'];
    const fields = [];
    if (!employee.full_name) fields.push('Full Name');
    if (!employee.annual_tax_credits) fields.push('Tax Credits');
    if (!employee.standard_rate_cut_off) fields.push('Rate Cut-Off');
    if (!employee.prsi_class) fields.push('PRSI Class');
    if (!employee.tax_basis) fields.push('Tax Basis');
    return fields;
  };

  const missingFields = getMissingFields();
  const isProfileComplete = employee?.profile_complete;

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

  return (
    <div className="min-h-screen bg-slate-50 overflow-x-hidden">
      <div className="mx-auto max-w-6xl px-2 py-4 sm:px-4 md:px-8 md:py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-8"
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Payroll Entry</h1>
              <p className="mt-1 text-sm text-slate-500">
                Review and calculate your monthly payroll
              </p>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                <SelectTrigger className="w-32 sm:w-40 bg-white text-sm">
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
                <SelectTrigger className="w-24 sm:w-28 bg-white text-sm">
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

        {!isProfileComplete ? (
          <div className="space-y-6">
            <ProfileCompletionBanner missingFields={missingFields} />
            <Card className="p-12 text-center">
              <AlertCircle className="mx-auto h-16 w-16 text-amber-400" />
              <h2 className="mt-4 text-xl font-semibold text-slate-900">
                Profile Setup Required
              </h2>
              <p className="mt-2 text-slate-500">
                Complete your employee profile before accessing payroll calculations
              </p>
            </Card>
          </div>
        ) : (
          <div className="grid gap-4 sm:gap-6 lg:gap-8 lg:grid-cols-3">
            {/* Left Column - Inputs */}
            <div className="space-y-4 sm:space-y-6 lg:col-span-2">
              {/* Period Info */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-emerald-600" />
                      Period Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
                      <div className="rounded-lg bg-slate-50 p-3 sm:p-4">
                        <p className="text-xs sm:text-sm text-slate-500">Cut-off</p>
                        <p className="text-sm sm:text-lg font-semibold text-slate-900 mt-1">
                          {format(cutOffDate, 'dd MMM')}
                        </p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3 sm:p-4">
                        <p className="text-xs sm:text-sm text-slate-500">Payment</p>
                        <p className="text-sm sm:text-lg font-semibold text-slate-900 mt-1">
                          {format(paymentDate, 'dd MMM')}
                        </p>
                      </div>
                      <div className="rounded-lg bg-emerald-50 p-3 sm:p-4 col-span-2 sm:col-span-1">
                        <p className="text-xs sm:text-sm text-emerald-600">Scheduled</p>
                        <p className="text-sm sm:text-lg font-semibold text-emerald-700 mt-1">
                          {(() => {
                            const scheduledHours = calculateBaseHours(selectedYear, selectedMonth, employee.weekly_contracted_hours);
                            return scheduledHours.toFixed(1);
                          })()}h
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Working Hours */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
              >
                <WorkingHoursSummary
                  formData={formData}
                  weekendRosters={weekendRosters}
                  overtimeRecords={overtimeRecords}
                  scheduledHours={baseHours}
                  employee={employee}
                  leaveRecords={leaveRecords}
                  sickLeaveRecords={sickLeaveRecords}
                  absenceRecords={absenceRecords}
                />
              </motion.div>

              {/* Additional Earnings */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.3 }}
              >
                <Card>
                  <CardHeader>
                   <CardTitle className="flex items-center gap-2">
                     <Euro className="h-5 w-5 text-emerald-600" />
                     Additional Earnings
                   </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 sm:space-y-4">
                   <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                     <div className="space-y-2">
                       <Label>Bonus (€)</Label>
                       <Input
                         type="number"
                         step="0.01"
                         min="0"
                         value={formData.quarterly_bonus.toFixed(2)}
                         onChange={(e) => setFormData(prev => ({ ...prev, quarterly_bonus: parseFloat(e.target.value) || 0 }))}
                         className={isBonusMonth(selectedMonth) ? 'border-amber-300 bg-amber-50' : ''}
                       />
                       {isBonusMonth(selectedMonth) && (
                         <p className="text-xs text-amber-600">Bonus month auto-calculated (editable)</p>
                       )}
                     </div>
                     <div className="space-y-2">
                       <Label>Health Insurance (€)</Label>
                       <Input
                         type="number"
                         step="0.01"
                         min="0"
                         value={formData.health_insurance}
                         onChange={(e) => setFormData(prev => ({ ...prev, health_insurance: parseFloat(e.target.value) || 0 }))}
                       />
                     </div>
                   </div>

                   <Separator className="my-4" />

                   <div className="space-y-3">
                     <div className="flex items-center justify-between">
                       <Label className="text-sm font-semibold">Other Taxable Earnings</Label>
                       <Button
                         type="button"
                         variant="outline"
                         size="sm"
                         onClick={() => {
                           if (newEarningDesc && newEarningValue > 0) {
                             const newItem = {
                               employee_id: employee.id,
                               payroll_period_year: selectedYear,
                               payroll_period_month: selectedMonth,
                               description: newEarningDesc,
                               amount: newEarningValue,
                             };
                             base44.entities.OtherEarnings.create(newItem).then(() => {
                               refetchOtherEarnings();
                               setNewEarningDesc('');
                               setNewEarningValue(0);
                               toast.success('Earning added');
                             });
                           }
                         }}
                       >
                         Add
                       </Button>
                     </div>
                     <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
                       <Input placeholder="Description" value={newEarningDesc} onChange={(e) => setNewEarningDesc(e.target.value)} className="text-sm" />
                       <Input type="number" step="0.01" placeholder="Value" value={newEarningValue} onChange={(e) => setNewEarningValue(parseFloat(e.target.value) || 0)} className="text-sm" />
                     </div>
                     {otherEarningsItems.length > 0 && (
                       <div className="rounded-lg border bg-slate-50 p-3 space-y-2">
                         {otherEarningsItems.map((item) => (
                           <div key={item.id} className="flex justify-between items-center text-sm">
                             <span className="text-slate-700">{item.description}</span>
                             <div className="flex items-center gap-2">
                               <span className="font-medium">{formatCurrency(item.amount)}</span>
                               <Button
                                 type="button"
                                 variant="ghost"
                                 size="sm"
                                 className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                                 onClick={() => {
                                   base44.entities.OtherEarnings.delete(item.id).then(() => {
                                     refetchOtherEarnings();
                                     toast.success('Earning removed');
                                   });
                                 }}
                               >
                                 ×
                               </Button>
                             </div>
                           </div>
                         ))}
                         <div className="pt-2 border-t flex justify-between font-medium text-emerald-700">
                           <span>Total Other Earnings</span>
                           <span>{formatCurrency(totalOtherEarnings)}</span>
                         </div>
                       </div>
                     )}

                     </div>
                     </CardContent>
                     </Card>
                     </motion.div>

                  {/* Other Deductions (Post-Tax) */}
                  <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.35 }}
                  >
                  <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Receipt className="h-5 w-5 text-red-600" />
                      Other Deductions (€)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold">Post-Tax Deductions</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (!newDeductionDesc) {
                              toast.error('Description is required');
                              return;
                            }
                            if (newDeductionValue <= 0) {
                              toast.error('Amount must be greater than 0');
                              return;
                            }
                            const newTotal = totalOtherDeductions + newDeductionValue;
                            const currentNetPay = calculatedPayroll?.netPay || 0;
                            if (newTotal > currentNetPay) {
                              toast.error('Total deductions cannot exceed Net Pay');
                              return;
                            }
                            const newItem = {
                              employee_id: employee.id,
                              payroll_period_year: selectedYear,
                              payroll_period_month: selectedMonth,
                              description: newDeductionDesc,
                              amount: newDeductionValue,
                            };
                            base44.entities.OtherDeduction.create(newItem).then(() => {
                              refetchOtherDeductions();
                              setNewDeductionDesc('');
                              setNewDeductionValue(0);
                              toast.success('Deduction added');
                            });
                          }}
                        >
                          + Add Row
                        </Button>
                      </div>
                      <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
                        <Input 
                          placeholder="Description *" 
                          value={newDeductionDesc} 
                          onChange={(e) => setNewDeductionDesc(e.target.value)}
                          className="text-sm"
                        />
                        <Input 
                          type="number" 
                          step="0.01" 
                          min="0"
                          placeholder="Amount (€) *" 
                          value={newDeductionValue || ''} 
                          onChange={(e) => setNewDeductionValue(parseFloat(e.target.value) || 0)}
                          className="text-sm"
                        />
                      </div>
                      {otherDeductionsItems.length > 0 && (
                        <div className="rounded-lg border bg-slate-50 p-3 space-y-2">
                          {otherDeductionsItems.map((item) => (
                            <div key={item.id} className="flex justify-between items-center text-sm">
                              <span className="text-slate-700">{item.description}</span>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-red-600">-{formatCurrency(item.amount)}</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                                  onClick={() => {
                                    base44.entities.OtherDeduction.delete(item.id).then(() => {
                                      refetchOtherDeductions();
                                      toast.success('Deduction removed');
                                    });
                                  }}
                                >
                                  ×
                                </Button>
                              </div>
                            </div>
                          ))}
                          <div className="pt-2 border-t flex justify-between font-medium text-red-700">
                            <span>Total Other Deductions</span>
                            <span>-{formatCurrency(totalOtherDeductions)}</span>
                          </div>
                        </div>
                      )}
                      {calculatedPayroll?.myFutureFundEmployee > 0 && (
                       <>
                         <div className="space-y-2">
                           <p className="text-xs font-semibold text-slate-500 uppercase">My Future Fund (Post-Tax)</p>
                           <div className="flex justify-between text-sm text-blue-600">
                             <span>Your Contribution</span>
                             <span className="font-medium">-{formatCurrency(calculatedPayroll.myFutureFundEmployee)}</span>
                           </div>
                         </div>

                         <Separator />
                       </>
                      )}
                      {totalOtherDeductions > 0 && calculatedPayroll?.netPay && (
                       <Alert className="border-amber-200 bg-amber-50">
                         <Info className="h-4 w-4 text-amber-600" />
                         <AlertDescription className="text-xs text-amber-800">
                           These deductions reduce Net Pay only and do not affect tax calculations.
                         </AlertDescription>
                       </Alert>
                      )}
                    </div>
                  </CardContent>
                  </Card>
                  </motion.div>
                  </div>

            {/* Right Column - Calculation Results */}
            <div className="space-y-4 sm:space-y-6">
              {/* Summary Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.4 }}
              >
                <Card className="border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calculator className="h-5 w-5 text-emerald-600" />
                      Payroll Summary
                    </CardTitle>
                    <CardDescription>
                      Payment: {format(paymentDate, 'dd MMM yyyy')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 sm:space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-500">Tax Basis</Label>
                      <Select value={selectedTaxBasis} onValueChange={setSelectedTaxBasis}>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cumulative">Cumulative</SelectItem>
                          <SelectItem value="week1">Week 1</SelectItem>
                          <SelectItem value="emergency">Emergency</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Separator />

                    <div className="space-y-1.5 sm:space-y-2">
                      {calculatedPayroll?.basePay > 0 && (
                       <div className="flex justify-between gap-2 text-xs sm:text-sm">
                         <span className="text-slate-500 truncate">
                           Base Pay – {calculatedPayroll.regularHours?.toFixed(1) || '0.0'}h
                         </span>
                         <span className="font-medium whitespace-nowrap">{formatCurrency(calculatedPayroll.basePay)}</span>
                       </div>
                      )}
                      {calculatedPayroll?.nightPremiumAdditional > 0 && calculatedPayroll?.nightPremiumHours > 0 && (
                       <div className="flex justify-between gap-2 text-xs sm:text-sm">
                         <span className="text-amber-600 truncate">
                           Night +{calculatedPayroll?.shiftPolicy?.night_premium_rate ? `${((calculatedPayroll.shiftPolicy.night_premium_rate - 1) * 100).toFixed(0)}%` : '25%'} – {calculatedPayroll.nightPremiumHours?.toFixed(1)}h
                         </span>
                         <span className="font-medium text-amber-600 whitespace-nowrap">{formatCurrency(calculatedPayroll.nightPremiumAdditional)}</span>
                       </div>
                      )}
                      {calculatedPayroll?.overtime_pay_1_5x > 0 && (
                        <div className="flex justify-between gap-2 text-xs sm:text-sm">
                          <span className="text-slate-500">OT 1.5x</span>
                          <span className="font-medium whitespace-nowrap">{formatCurrency(calculatedPayroll.overtime_pay_1_5x)}</span>
                        </div>
                      )}
                      {calculatedPayroll?.overtime_pay_2_0x > 0 && (
                        <div className="flex justify-between gap-2 text-xs sm:text-sm">
                          <span className="text-slate-500">OT 2.0x</span>
                          <span className="font-medium whitespace-nowrap">{formatCurrency(calculatedPayroll.overtime_pay_2_0x)}</span>
                        </div>
                      )}
                      {(weekendRosters?.filter(r => new Date(r.date).getDay() === 6).reduce((acc, r) => acc + (r.pay || 0), 0) || 0) > 0 && (
                        <div className="flex justify-between gap-2 text-xs sm:text-sm">
                          <span className="text-slate-500">Sat 1.5x</span>
                          <span className="font-medium whitespace-nowrap">{formatCurrency(weekendRosters?.filter(r => new Date(r.date).getDay() === 6).reduce((acc, r) => acc + (r.pay || 0), 0) || 0)}</span>
                        </div>
                      )}
                      {(weekendRosters?.filter(r => new Date(r.date).getDay() === 0).reduce((acc, r) => acc + (r.pay || 0), 0) || 0) > 0 && (
                        <div className="flex justify-between gap-2 text-xs sm:text-sm">
                          <span className="text-slate-500">Sun 2.0x</span>
                          <span className="font-medium whitespace-nowrap">{formatCurrency(weekendRosters?.filter(r => new Date(r.date).getDay() === 0).reduce((acc, r) => acc + (r.pay || 0), 0) || 0)}</span>
                        </div>
                      )}
                      {calculatedPayroll?.sickPay > 0 && (
                        <div className="flex justify-between gap-2 text-xs sm:text-sm">
                          <span className="text-slate-500">Sick Pay</span>
                          <span className="font-medium whitespace-nowrap">{formatCurrency(calculatedPayroll.sickPay)}</span>
                        </div>
                      )}
                      {calculatedPayroll?.ptoPay > 0 && (
                        <div className="flex justify-between gap-2 text-xs sm:text-sm">
                          <span className="text-slate-500 truncate">PTO – Annual</span>
                          <span className="font-medium whitespace-nowrap">{formatCurrency(calculatedPayroll.ptoPay)}</span>
                        </div>
                      )}
                      {calculatedPayroll?.bankHolidayPay > 0 && (
                        <div className="flex justify-between gap-2 text-xs sm:text-sm">
                          <span className="text-slate-500 truncate">PTO – Bank Hol.</span>
                          <span className="font-medium whitespace-nowrap">{formatCurrency(calculatedPayroll.bankHolidayPay)}</span>
                        </div>
                      )}
                      {calculatedPayroll?.bankHolidayWorkedPay > 0 && (
                        <div className="flex justify-between gap-2 text-xs sm:text-sm">
                          <span className="text-slate-500 truncate">Bank Hol. 2.0x</span>
                          <span className="font-medium whitespace-nowrap">{formatCurrency(calculatedPayroll.bankHolidayWorkedPay)}</span>
                        </div>
                      )}
                      {formData.health_insurance > 0 && (
                        <div className="flex justify-between gap-2 text-xs sm:text-sm">
                          <span className="text-slate-500 truncate">Health Ins.</span>
                          <span className="font-medium whitespace-nowrap">{formatCurrency(formData.health_insurance)}</span>
                        </div>
                      )}
                      {totalOtherEarnings > 0 && (
                        <div className="flex justify-between gap-2 text-xs sm:text-sm">
                          <span className="text-slate-500">Other</span>
                          <span className="font-medium whitespace-nowrap">{formatCurrency(totalOtherEarnings)}</span>
                        </div>
                      )}
                      {formData.quarterly_bonus > 0 && (
                        <div className="flex justify-between gap-2 text-xs sm:text-sm">
                          <span className="text-slate-500">Bonus</span>
                          <span className="font-medium whitespace-nowrap">{formatCurrency(formData.quarterly_bonus)}</span>
                        </div>
                      )}


                    </div>

                    <Separator />

                    <div className="flex justify-between">
                      <span className="text-sm sm:text-base font-semibold text-slate-700">Gross Pay</span>
                      <span className="text-base sm:text-lg font-bold text-slate-900">{formatCurrency(calculatedPayroll?.grossPay || 0)}</span>
                    </div>

                    <Separator />

                    <div className="space-y-1.5 sm:space-y-2">
                      <div className="flex justify-between gap-2 text-xs sm:text-sm text-red-600">
                        <span>PAYE</span>
                        <span className="font-medium whitespace-nowrap">-{formatCurrency(calculatedPayroll?.paye || 0)}</span>
                      </div>
                      <div className="flex justify-between gap-2 text-xs sm:text-sm text-red-600">
                        <span>USC</span>
                        <span className="font-medium whitespace-nowrap">-{formatCurrency(calculatedPayroll?.usc || 0)}</span>
                      </div>
                      <div className="flex justify-between gap-2 text-xs sm:text-sm text-red-600">
                       <span>PRSI</span>
                       <span className="font-medium whitespace-nowrap">-{formatCurrency(calculatedPayroll?.prsi || 0)}</span>
                      </div>
                      </div>

                      <Separator />

                      <div className="flex justify-between">
                        <span className="text-sm sm:text-base font-semibold text-slate-700">Total</span>
                        <span className="text-sm sm:text-base font-bold text-red-600 whitespace-nowrap">-{formatCurrency(calculatedPayroll?.totalDeductions || 0)}</span>
                      </div>

                      <Separator />

                      {(totalOtherDeductions > 0 || calculatedPayroll?.myFutureFundEmployee > 0) && (
                        <>
                          <div className="space-y-1.5 sm:space-y-2">
                            <p className="text-xs font-semibold text-slate-500 uppercase">Post-Tax</p>
                            {calculatedPayroll?.myFutureFundEmployee > 0 && (
                              <div className="flex justify-between gap-2 text-xs sm:text-sm text-blue-600">
                                <span className="truncate">Pension</span>
                                <span className="font-medium whitespace-nowrap">-{formatCurrency(calculatedPayroll.myFutureFundEmployee)}</span>
                              </div>
                            )}
                            {otherDeductionsItems.map((item) => (
                              <div key={item.id} className="flex justify-between gap-2 text-xs sm:text-sm text-red-600">
                                <span className="truncate">{item.description}</span>
                                <span className="font-medium whitespace-nowrap">-{formatCurrency(item.amount)}</span>
                              </div>
                            ))}
                          </div>

                          <Separator />
                        </>
                      )}

                      <div className="rounded-lg bg-emerald-100 p-3 sm:p-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm sm:text-base font-bold text-emerald-800">Net Pay</span>
                          <span className="text-xl sm:text-2xl font-bold text-emerald-700">
                            {formatCurrency(calculatedPayroll?.finalNetPay || calculatedPayroll?.netPay || 0)}
                          </span>
                        </div>
                      </div>

                      <Button
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-sm sm:text-base"
                      size="lg"
                      onClick={() => saveMutation.mutate()}
                      disabled={saveMutation.isPending}
                      >
                      {saveMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save
                        </>
                      )}
                      </Button>

                    {existingEntry && (
                      <p className="text-center text-xs text-slate-400">
                        Last saved: {format(new Date(existingEntry.updated_date), 'dd MMM yyyy HH:mm')}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* YTD Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.5 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <TrendingUp className="h-5 w-5 text-blue-600" />
                      Year to Date
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">YTD Gross</span>
                      <span className="font-medium whitespace-nowrap">{formatCurrency(calculatedPayroll?.ytd?.gross || 0)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">YTD PAYE</span>
                      <span className="font-medium text-red-600 whitespace-nowrap">-{formatCurrency(calculatedPayroll?.ytd?.paye || 0)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">YTD USC</span>
                      <span className="font-medium text-red-600 whitespace-nowrap">-{formatCurrency(calculatedPayroll?.ytd?.usc || 0)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">YTD PRSI</span>
                      <span className="font-medium text-red-600 whitespace-nowrap">-{formatCurrency(calculatedPayroll?.ytd?.prsi || 0)}</span>
                    </div>
                    {ytdTotals.my_future_fund > 0 && (
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-500 truncate">YTD Pension</span>
                        <span className="font-medium text-blue-600 whitespace-nowrap">-{formatCurrency(ytdTotals.my_future_fund)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between gap-2">
                      <span className="font-semibold text-slate-700">YTD Net</span>
                      <span className="font-bold text-emerald-600 whitespace-nowrap">{formatCurrency(calculatedPayroll?.ytd?.net || 0)}</span>
                    </div>
                    </CardContent>
                    </Card>
                    </motion.div>

              {/* Tax Info */}
              <Alert className="border-blue-200 bg-blue-50">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-xs text-blue-800">
                  Revenue Ireland 2026. Tax: {selectedTaxBasis}.
                  {employee?.has_medical_card && ' USC reduced (Medical Card).'}
                </AlertDescription>
              </Alert>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}