import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Clock, Calendar, Briefcase, Sun, Coffee, Zap, XCircle } from 'lucide-react';
import { formatCurrency } from '@/components/payroll/IrishTaxCalculator';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function WorkingHoursSummary({ 
  formData, 
  weekendRosters, 
  overtimeRecords, 
  scheduledHours,
  employee,
  leaveRecords,
  sickLeaveRecords,
  absenceRecords 
}) {
  // Calculate from records
  const saturdayHours = weekendRosters?.filter(r => new Date(r.date).getDay() === 6).reduce((acc, r) => acc + (r.hours || 0), 0) || 0;
  const saturdayPay = weekendRosters?.filter(r => new Date(r.date).getDay() === 6).reduce((acc, r) => acc + (r.pay || 0), 0) || 0;
  const sundayHours = weekendRosters?.filter(r => new Date(r.date).getDay() === 0).reduce((acc, r) => acc + (r.hours || 0), 0) || 0;
  const sundayPay = weekendRosters?.filter(r => new Date(r.date).getDay() === 0).reduce((acc, r) => acc + (r.pay || 0), 0) || 0;

  const totalPtoHours = leaveRecords?.filter(l => l.leave_type === 'annual_leave').reduce((acc, l) => acc + (l.total_hours || 0), 0) || 0;
  const totalBankHolidayHours = leaveRecords?.filter(l => l.leave_type === 'bank_holiday').reduce((acc, l) => acc + (l.total_hours || 0), 0) || 0;
  const totalSickHours = sickLeaveRecords?.reduce((acc, s) => acc + (s.total_hours || 0), 0) || 0;
  const totalSickPay = sickLeaveRecords?.reduce((acc, s) => acc + (s.statutory_pay || 0), 0) || 0;
  const totalUnpaidHours = absenceRecords?.reduce((acc, a) => acc + (a.total_hours || 0), 0) || 0;

  // Group overtime by multiplier
  const overtimeByMultiplier = {};
  overtimeRecords?.forEach(record => {
    const multiplier = record.rate_multiplier || 1.5;
    if (!overtimeByMultiplier[multiplier]) {
      overtimeByMultiplier[multiplier] = { hours: 0, pay: 0, count: 0 };
    }
    overtimeByMultiplier[multiplier].hours += (record.hours || 0);
    overtimeByMultiplier[multiplier].pay += (record.overtime_pay || 0);
    overtimeByMultiplier[multiplier].count += 1;
  });

  // Calculate actual worked hours (Base Hours)
  const actualBaseHours = Math.max(0, scheduledHours - 
    saturdayHours - 
    sundayHours - 
    totalPtoHours - 
    totalBankHolidayHours - 
    totalUnpaidHours - 
    formData.bank_holiday_worked_hours
  );

  const basePay = actualBaseHours * employee.base_hourly_rate;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-emerald-600" />
          Working Hours Summary
        </CardTitle>
        <CardDescription>
          Complete breakdown of all working hours and pay
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Base Hours */}
          <div className="rounded-lg border-2 border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-slate-600" />
                <div>
                  <Label className="text-slate-700 font-semibold">Regular Hours</Label>
                  <p className="text-xs text-slate-500">Standard working time</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-slate-900">{actualBaseHours.toFixed(1)}h</p>
              </div>
            </div>
            <div className="text-xs text-slate-500 space-y-1 bg-white rounded p-2">
              <div className="flex justify-between">
                <span>Scheduled Hours:</span>
                <span className="font-medium">{scheduledHours.toFixed(1)}h</span>
              </div>
              {(saturdayHours + sundayHours + totalPtoHours + totalBankHolidayHours + totalUnpaidHours + formData.bank_holiday_worked_hours) > 0 && (
                <div className="flex justify-between text-amber-600">
                  <span>Less: Other categories</span>
                  <span className="font-medium">
                    -{(saturdayHours + sundayHours + totalPtoHours + totalBankHolidayHours + totalUnpaidHours + formData.bank_holiday_worked_hours).toFixed(1)}h
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Overtime by Multiplier */}
          {Object.keys(overtimeByMultiplier).length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-purple-700">
                <Zap className="h-4 w-4" />
                Overtime
              </div>
              <div className="grid gap-3">
                {Object.entries(overtimeByMultiplier)
                  .sort(([a], [b]) => parseFloat(a) - parseFloat(b))
                  .map(([multiplier, data]) => (
                    <div key={multiplier} className="rounded-lg border border-purple-200 bg-purple-50 p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-purple-700 font-medium">{multiplier}x Overtime</Label>
                          <p className="text-xs text-purple-600">{data.count} record{data.count !== 1 ? 's' : ''}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-purple-900">{data.hours.toFixed(1)}h</p>
                          <p className="text-sm text-purple-700 font-medium">{formatCurrency(data.pay)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Weekend Work */}
          {(saturdayHours > 0 || sundayHours > 0) && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-700">
                <Sun className="h-4 w-4" />
                Weekend Work
              </div>
              <div className="grid gap-3">
                {saturdayHours > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-amber-700 font-medium">Saturday</Label>
                        <p className="text-xs text-amber-600">Weekend rate</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-amber-900">{saturdayHours.toFixed(1)}h</p>
                        <p className="text-sm text-amber-700 font-medium">{formatCurrency(saturdayPay)}</p>
                      </div>
                    </div>
                  </div>
                )}
                {sundayHours > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-amber-700 font-medium">Sunday</Label>
                        <p className="text-xs text-amber-600">Premium rate</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-amber-900">{sundayHours.toFixed(1)}h</p>
                        <p className="text-sm text-amber-700 font-medium">{formatCurrency(sundayPay)}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Paid Time Off */}
          {(totalPtoHours > 0 || totalBankHolidayHours > 0) && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-blue-700">
                <Calendar className="h-4 w-4" />
                Paid Time Off
              </div>
              <div className="grid gap-3">
                {totalPtoHours > 0 && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-blue-700 font-medium">Annual Leave</Label>
                        <p className="text-xs text-blue-600">Paid vacation days</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-blue-900">{totalPtoHours.toFixed(1)}h</p>
                        <p className="text-sm text-blue-700 font-medium">
                          {formatCurrency(totalPtoHours * employee.base_hourly_rate)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {totalBankHolidayHours > 0 && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-blue-700 font-medium">Bank Holiday</Label>
                        <p className="text-xs text-blue-600">Public holiday entitlement</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-blue-900">{totalBankHolidayHours.toFixed(1)}h</p>
                        <p className="text-sm text-blue-700 font-medium">
                          {formatCurrency(totalBankHolidayHours * employee.base_hourly_rate)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bank Holiday Worked */}
          {formData.bank_holiday_worked_hours > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-red-700">
                <Zap className="h-4 w-4" />
                Bank Holiday Worked
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-red-700 font-medium">Worked on Public Holiday</Label>
                    <p className="text-xs text-red-600">Premium rate applied</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-red-900">{formData.bank_holiday_worked_hours.toFixed(1)}h</p>
                    <p className="text-sm text-red-700 font-medium">{formatCurrency(formData.bank_holiday_worked_pay)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sick Leave */}
          {totalSickHours > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-green-700">
                <Coffee className="h-4 w-4" />
                Sick Leave
              </div>
              <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-green-700 font-medium">Statutory Sick Pay</Label>
                    <p className="text-xs text-green-600">Paid sick leave days</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-green-900">{totalSickHours.toFixed(1)}h</p>
                    <p className="text-sm text-green-700 font-medium">{formatCurrency(totalSickPay)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Unpaid Leave */}
          {totalUnpaidHours > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-red-700">
                <XCircle className="h-4 w-4" />
                Unpaid Absence
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-red-700 font-medium">Absence/Lateness</Label>
                    <p className="text-xs text-red-600">Unpaid time off</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-red-900">{totalUnpaidHours.toFixed(1)}h</p>
                    <p className="text-sm text-red-700 font-medium">Not paid</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Link to={createPageUrl('LeaveManagement')} className="flex-1">
              <Button variant="outline" size="sm" className="w-full">
                <Calendar className="mr-2 h-4 w-4" />
                Manage Leave
              </Button>
            </Link>
            <Link to={createPageUrl('Overtime')} className="flex-1">
              <Button variant="outline" size="sm" className="w-full">
                <Zap className="mr-2 h-4 w-4" />
                Add Overtime
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}