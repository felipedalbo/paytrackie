import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format, startOfYear, endOfYear } from 'date-fns';
import { motion } from 'framer-motion';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Calendar,
  Clock,
  FileText,
  AlertCircle,
  Euro,
  PiggyBank,
  Receipt,
  Banknote,
  ArrowRight,
  Building2,
  Sun,
  Umbrella,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import StatCard from '@/components/ui/StatCard';
import ProfileCompletionBanner from '@/components/profile/ProfileCompletionBanner';
import BankHolidaysWidget from '@/components/leave/BankHolidaysWidget';
import { formatCurrency, getCutOffDate, getPaymentDate, isBonusMonth } from '@/components/payroll/IrishTaxCalculator';
import { useBankHolidayBalance } from '@/components/leave/useBankHolidayBalance';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function Dashboard() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

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

  // Fetch payroll entries for the year
  const { data: payrollEntries, isLoading: payrollLoading } = useQuery({
    queryKey: ['payroll', employee?.id, selectedYear],
    queryFn: () => base44.entities.PayrollEntry.filter({ 
      employee_id: employee?.id,
      period_year: selectedYear 
    }),
    enabled: !!employee?.id,
  });

  // Fetch leave records
  const { data: leaveRecords } = useQuery({
    queryKey: ['leave', employee?.id, selectedYear],
    queryFn: () => base44.entities.LeaveRecord.filter({ 
      employee_id: employee?.id,
      payroll_period_year: selectedYear 
    }),
    enabled: !!employee?.id,
  });

  // Fetch sick leave records
  const { data: sickLeaveRecords } = useQuery({
    queryKey: ['sickLeave', employee?.id, selectedYear],
    queryFn: () => base44.entities.SickLeaveRecord.filter({ 
      employee_id: employee?.id,
      payroll_period_year: selectedYear 
    }),
    enabled: !!employee?.id,
  });

  const isLoading = userLoading || employeeLoading || payrollLoading;

  // Check profile completion
  const getMissingFields = () => {
    if (!employee) return ['Complete Profile Setup'];
    const fields = [];
    if (!employee.full_name) fields.push('Full Name');
    if (!employee.date_of_birth) fields.push('Date of Birth');
    if (!employee.contract_type) fields.push('Contract Type');
    if (!employee.contract_start_date) fields.push('Contract Start Date');
    if (!employee.weekly_contracted_hours) fields.push('Weekly Hours');
    if (!employee.base_hourly_rate) fields.push('Hourly Rate');
    if (!employee.annual_tax_credits) fields.push('Tax Credits');
    if (!employee.standard_rate_cut_off) fields.push('Rate Cut-Off');
    if (!employee.prsi_class) fields.push('PRSI Class');
    if (!employee.tax_basis) fields.push('Tax Basis');
    return fields;
  };

  const missingFields = getMissingFields();
  const isProfileComplete = missingFields.length === 0;

  // Get current month payroll
  const currentPayroll = payrollEntries?.find(
    p => p.period_month === selectedMonth
  );

  // Calculate YTD totals
  const ytdTotals = payrollEntries?.reduce((acc, entry) => ({
    gross: acc.gross + (entry.gross_pay || 0),
    paye: acc.paye + (entry.paye || 0),
    usc: acc.usc + (entry.usc || 0),
    prsi: acc.prsi + (entry.prsi || 0),
    myFutureFund: acc.myFutureFund + (entry.my_future_fund_employee || 0),
    net: acc.net + ((entry.net_pay || 0) - (entry.my_future_fund_employee || 0)),
    bonus: acc.bonus + (entry.quarterly_bonus || 0),
  }), { gross: 0, paye: 0, usc: 0, prsi: 0, myFutureFund: 0, net: 0, bonus: 0 }) || { gross: 0, paye: 0, usc: 0, prsi: 0, myFutureFund: 0, net: 0, bonus: 0 };

  // Calculate leave balances
  const annualLeaveUsed = leaveRecords?.filter(l => l.leave_type === 'annual_leave')
    .reduce((acc, l) => acc + (l.total_hours || 0), 0) || 0;
  const annualLeaveTotal = 25 * 7.5; // 187.5 hours

  const sickDaysUsed = sickLeaveRecords?.reduce((acc, s) => acc + (s.total_days || 0), 0) || 0;
  const sickDaysTotal = 5; // 2026 statutory entitlement

  const cutOffDate = getCutOffDate(selectedYear, selectedMonth);
  const paymentDate = getPaymentDate(selectedYear, selectedMonth);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl p-4 md:p-8">
        {/* Header */}
        <div className="mb-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-3xl font-bold text-slate-900">
                  Welcome back, {employee?.full_name?.split(' ')[0] || user?.full_name?.split(' ')[0] || 'there'}
                </h1>
                <p className="mt-1 text-slate-500">
                  Track your salary, deductions, and leave balances
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
        </div>

        {/* Profile Completion Banner */}
        {!isProfileComplete && (
          <div className="mb-8">
            <ProfileCompletionBanner missingFields={missingFields} />
          </div>
        )}

        {isProfileComplete ? (
          <>
            {/* Monthly Overview Cards */}
            <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Net Pay"
                value={formatCurrency((currentPayroll?.net_pay || 0) - (currentPayroll?.my_future_fund_employee || 0))}
                subtitle={`${MONTHS[selectedMonth - 1]} ${selectedYear}`}
                icon={Wallet}
                variant="primary"
              />
              <StatCard
                title="Gross Pay"
                value={formatCurrency(currentPayroll?.gross_pay || 0)}
                subtitle="Before deductions"
                icon={Euro}
              />
              <StatCard
                title="Total Deductions"
                value={formatCurrency((currentPayroll?.total_deductions || 0) + (currentPayroll?.my_future_fund_employee || 0))}
                subtitle="PAYE + USC + PRSI + Pension"
                icon={TrendingDown}
                variant="warning"
              />
              <StatCard
                title="YTD Net"
                value={formatCurrency(ytdTotals.net)}
                subtitle={`Jan - ${MONTHS[selectedMonth - 1]} ${selectedYear}`}
                icon={PiggyBank}
                variant="secondary"
              />
            </div>

            {/* Payroll Dates & Bonus */}
            <div className="mb-8 grid gap-6 md:grid-cols-3">
              <Card className="p-6">
                <div className="flex items-center gap-4">
                  <div className="rounded-xl bg-emerald-100 p-3">
                    <Calendar className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Cut-off Date</p>
                    <p className="text-lg font-semibold text-slate-900">
                      {format(cutOffDate, 'dd MMM yyyy')}
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center gap-4">
                  <div className="rounded-xl bg-blue-100 p-3">
                    <Banknote className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Payment Date</p>
                    <p className="text-lg font-semibold text-slate-900">
                      {format(paymentDate, 'dd MMM yyyy')}
                    </p>
                  </div>
                </div>
              </Card>

              <Card className={`p-6 ${isBonusMonth(selectedMonth) ? 'border-amber-200 bg-amber-50' : ''}`}>
                <div className="flex items-center gap-4">
                  <div className={`rounded-xl p-3 ${isBonusMonth(selectedMonth) ? 'bg-amber-100' : 'bg-slate-100'}`}>
                    <Receipt className={`h-6 w-6 ${isBonusMonth(selectedMonth) ? 'text-amber-600' : 'text-slate-600'}`} />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Quarterly Bonus</p>
                    <p className="text-lg font-semibold text-slate-900">
                      {isBonusMonth(selectedMonth) 
                        ? formatCurrency(currentPayroll?.quarterly_bonus || 0)
                        : 'Not this month'}
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Deductions Breakdown */}
            <div className="mb-8">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">
                Deductions Breakdown - {MONTHS[selectedMonth - 1]}
              </h2>
              <div className="grid gap-6 md:grid-cols-3">
                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">PAYE</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {formatCurrency(currentPayroll?.paye || 0)}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        YTD: {formatCurrency(ytdTotals.paye)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-red-100 p-3">
                      <Building2 className="h-5 w-5 text-red-600" />
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">USC</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {formatCurrency(currentPayroll?.usc || 0)}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        YTD: {formatCurrency(ytdTotals.usc)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-orange-100 p-3">
                      <TrendingDown className="h-5 w-5 text-orange-600" />
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">PRSI</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {formatCurrency(currentPayroll?.prsi || 0)}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        YTD: {formatCurrency(ytdTotals.prsi)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-purple-100 p-3">
                      <Receipt className="h-5 w-5 text-purple-600" />
                    </div>
                  </div>
                </Card>
              </div>
            </div>

            {/* Leave Balances */}
            <div className="mb-8">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">
                Leave Balances - {selectedYear}
              </h2>
              <div className="grid gap-6 md:grid-cols-3">
                <Card className="p-6">
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
                      style={{ width: `${((annualLeaveTotal - annualLeaveUsed) / annualLeaveTotal) * 100}%` }}
                    />
                  </div>
                </Card>

                <BankHolidaysWidget employee={employee} selectedYear={selectedYear} />

                <Card className="p-6">
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
                      {sickDaysTotal - sickDaysUsed} days
                    </span>
                    <span className="text-sm text-slate-400">
                      of {sickDaysTotal} days
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div 
                      className="h-full rounded-full bg-rose-500 transition-all"
                      style={{ width: `${((sickDaysTotal - sickDaysUsed) / sickDaysTotal) * 100}%` }}
                    />
                  </div>
                </Card>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Link to={createPageUrl('PayrollEntry')}>
                <Card className="group cursor-pointer p-6 transition-all hover:border-emerald-200 hover:shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-emerald-100 p-2 transition-colors group-hover:bg-emerald-200">
                        <FileText className="h-5 w-5 text-emerald-600" />
                      </div>
                      <span className="font-medium text-slate-700">Payroll Entry</span>
                    </div>
                    <ArrowRight className="h-5 w-5 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-emerald-600" />
                  </div>
                </Card>
              </Link>

              <Link to={createPageUrl('LeaveManagement')}>
                <Card className="group cursor-pointer p-6 transition-all hover:border-sky-200 hover:shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-sky-100 p-2 transition-colors group-hover:bg-sky-200">
                        <Calendar className="h-5 w-5 text-sky-600" />
                      </div>
                      <span className="font-medium text-slate-700">Leave & Time Off</span>
                    </div>
                    <ArrowRight className="h-5 w-5 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-sky-600" />
                  </div>
                </Card>
              </Link>

              <Link to={createPageUrl('Payslips')}>
                <Card className="group cursor-pointer p-6 transition-all hover:border-purple-200 hover:shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-purple-100 p-2 transition-colors group-hover:bg-purple-200">
                        <Receipt className="h-5 w-5 text-purple-600" />
                      </div>
                      <span className="font-medium text-slate-700">View Payslips</span>
                    </div>
                    <ArrowRight className="h-5 w-5 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-purple-600" />
                  </div>
                </Card>
              </Link>

            </div>
          </>
        ) : (
          <Card className="p-12 text-center">
            <AlertCircle className="mx-auto h-16 w-16 text-amber-400" />
            <h2 className="mt-4 text-xl font-semibold text-slate-900">
              Profile Setup Required
            </h2>
            <p className="mt-2 text-slate-500">
              Complete your employee profile to access all payroll features
            </p>
            <Link to={createPageUrl('Profile')}>
              <Button className="mt-6 bg-emerald-600 hover:bg-emerald-700">
                Complete Profile
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </Card>
        )}
      </div>
    </div>
  );
}