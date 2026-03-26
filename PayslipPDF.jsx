import React from 'react';
import { format } from 'date-fns';
import { formatCurrency, isBonusMonth } from './IrishTaxCalculator';
import { TrendingUp, User, Calendar, Building2, Euro } from 'lucide-react';
import SystemLogo from '@/components/shared/SystemLogo';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function PayslipPDF({ entry, employee }) {
  return (
    <div className="p-8 bg-white" style={{ minHeight: '100vh' }}>
      {/* Header */}
      <div className="text-center border-b-4 border-emerald-600 pb-6 mb-8">
        <div className="flex items-center justify-center mb-4">
          <SystemLogo size="large" showText={true} textSize="large" />
        </div>
        <h1 className="text-4xl font-bold text-slate-900 mb-2">PAYSLIP</h1>
        <p className="text-xl text-slate-600">
          {MONTHS[(entry.period_month || 1) - 1]} {entry.period_year}
        </p>
        {isBonusMonth(entry.period_month) && entry.quarterly_bonus > 0 && (
          <div className="inline-block mt-2 bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-sm font-medium">
            ⭐ Bonus Month
          </div>
        )}
      </div>

      {/* Employee & Payment Info */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-slate-500 text-sm font-medium mb-2">
            <User className="h-5 w-5" />
            EMPLOYEE INFORMATION
          </div>
          <div className="bg-slate-50 p-4 rounded-lg space-y-2">
            <div>
              <p className="text-xs text-slate-500 uppercase">Name</p>
              <p className="font-semibold text-lg">{employee?.full_name}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase">PPS Number</p>
              <p className="font-medium">{employee?.pps_number || 'Not provided'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase">Contract Type</p>
              <p className="font-medium capitalize">{employee?.contract_type || 'N/A'}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-slate-500 text-sm font-medium mb-2">
            <Calendar className="h-5 w-5" />
            PAYMENT DETAILS
          </div>
          <div className="bg-slate-50 p-4 rounded-lg space-y-2">
            <div>
              <p className="text-xs text-slate-500 uppercase">Cut-off Date</p>
              <p className="font-medium">
                {entry.cut_off_date ? format(new Date(entry.cut_off_date), 'dd MMMM yyyy') : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase">Payment Date</p>
              <p className="font-semibold text-emerald-700 text-lg">
                {entry.payment_date ? format(new Date(entry.payment_date), 'dd MMMM yyyy') : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase">Tax Basis</p>
              <p className="font-medium capitalize">{employee?.tax_basis || 'Cumulative'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Earnings Section */}
      <div className="mb-6">
        <div className="bg-emerald-600 text-white px-4 py-2 font-semibold text-sm uppercase mb-3 rounded-t-lg">
          💰 Earnings
        </div>
        <div className="border border-slate-200 rounded-b-lg">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Description</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Hours</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="hover:bg-slate-50">
                <td className="py-3 px-4 text-slate-700">Base Pay</td>
                <td className="text-right py-3 px-4 font-medium">{entry.base_hours?.toFixed(1)}h</td>
                <td className="text-right py-3 px-4 font-semibold">{formatCurrency(entry.base_pay)}</td>
              </tr>
              
              {entry.weekend_saturday_hours > 0 && (
                <tr className="hover:bg-slate-50">
                  <td className="py-3 px-4 text-slate-700">Saturday Work <span className="text-xs text-slate-500">(1.5x)</span></td>
                  <td className="text-right py-3 px-4 font-medium">{entry.weekend_saturday_hours?.toFixed(1)}h</td>
                  <td className="text-right py-3 px-4 font-semibold">{formatCurrency(entry.weekend_saturday_pay)}</td>
                </tr>
              )}
              
              {entry.weekend_sunday_hours > 0 && (
                <tr className="hover:bg-slate-50">
                  <td className="py-3 px-4 text-slate-700">Sunday Work <span className="text-xs text-slate-500">(2.0x)</span></td>
                  <td className="text-right py-3 px-4 font-medium">{entry.weekend_sunday_hours?.toFixed(1)}h</td>
                  <td className="text-right py-3 px-4 font-semibold">{formatCurrency(entry.weekend_sunday_pay)}</td>
                </tr>
              )}
              
              {entry.overtime_hours_1_5x > 0 && (
                <tr className="hover:bg-slate-50">
                  <td className="py-3 px-4 text-slate-700">Overtime <span className="text-xs text-slate-500">(1.5x)</span></td>
                  <td className="text-right py-3 px-4 font-medium">{entry.overtime_hours_1_5x?.toFixed(1)}h</td>
                  <td className="text-right py-3 px-4 font-semibold">{formatCurrency(entry.overtime_pay_1_5x)}</td>
                </tr>
              )}
              
              {entry.overtime_hours_2_0x > 0 && (
                <tr className="hover:bg-slate-50">
                  <td className="py-3 px-4 text-slate-700">Overtime <span className="text-xs text-slate-500">(2.0x)</span></td>
                  <td className="text-right py-3 px-4 font-medium">{entry.overtime_hours_2_0x?.toFixed(1)}h</td>
                  <td className="text-right py-3 px-4 font-semibold">{formatCurrency(entry.overtime_pay_2_0x)}</td>
                </tr>
              )}
              
              {entry.sick_leave_hours > 0 && (
                <tr className="hover:bg-slate-50">
                  <td className="py-3 px-4 text-slate-700">Sick Pay (Statutory)</td>
                  <td className="text-right py-3 px-4 font-medium">{entry.sick_leave_hours?.toFixed(1)}h</td>
                  <td className="text-right py-3 px-4 font-semibold">{formatCurrency(entry.sick_leave_pay)}</td>
                </tr>
              )}
              
              {entry.pto_hours > 0 && (
                <tr className="hover:bg-slate-50">
                  <td className="py-3 px-4 text-slate-700">Annual Leave</td>
                  <td className="text-right py-3 px-4 font-medium">{entry.pto_hours?.toFixed(1)}h</td>
                  <td className="text-right py-3 px-4 font-semibold">{formatCurrency(entry.pto_pay)}</td>
                </tr>
              )}
              
              {entry.bank_holiday_hours > 0 && (
                <tr className="hover:bg-slate-50">
                  <td className="py-3 px-4 text-slate-700">Bank Holiday</td>
                  <td className="text-right py-3 px-4 font-medium">{entry.bank_holiday_hours?.toFixed(1)}h</td>
                  <td className="text-right py-3 px-4 font-semibold">{formatCurrency(entry.bank_holiday_pay)}</td>
                </tr>
              )}
              
              {entry.bank_holiday_worked_hours > 0 && (
                <tr className="hover:bg-slate-50">
                  <td className="py-3 px-4 text-slate-700">Bank Holiday Worked <span className="text-xs text-slate-500">(2.0x)</span></td>
                  <td className="text-right py-3 px-4 font-medium">{entry.bank_holiday_worked_hours?.toFixed(1)}h</td>
                  <td className="text-right py-3 px-4 font-semibold">{formatCurrency(entry.bank_holiday_worked_pay)}</td>
                </tr>
              )}
              
              {entry.quarterly_bonus > 0 && (
                <tr className="bg-amber-50 hover:bg-amber-100">
                  <td className="py-3 px-4 text-amber-800 font-medium">Quarterly Bonus ⭐</td>
                  <td className="text-right py-3 px-4"></td>
                  <td className="text-right py-3 px-4 font-bold text-amber-800">{formatCurrency(entry.quarterly_bonus)}</td>
                </tr>
              )}
              
              {entry.health_insurance > 0 && (
                <tr className="hover:bg-slate-50">
                  <td className="py-3 px-4 text-slate-700">Health Insurance <span className="text-xs text-slate-500">(BIK)</span></td>
                  <td className="text-right py-3 px-4"></td>
                  <td className="text-right py-3 px-4 font-semibold">{formatCurrency(entry.health_insurance)}</td>
                </tr>
              )}
              
              {entry.other_earnings > 0 && (
                <tr className="hover:bg-slate-50">
                  <td className="py-3 px-4 text-slate-700">Other Earnings</td>
                  <td className="text-right py-3 px-4"></td>
                  <td className="text-right py-3 px-4 font-semibold">{formatCurrency(entry.other_earnings)}</td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-emerald-50 border-t-2 border-emerald-600">
              <tr>
                <td className="py-4 px-4 font-bold text-emerald-800 text-base">GROSS PAY</td>
                <td className="text-right py-4 px-4"></td>
                <td className="text-right py-4 px-4 font-bold text-emerald-800 text-xl">{formatCurrency(entry.gross_pay)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Deductions Section */}
      <div className="mb-6">
        <div className="bg-red-600 text-white px-4 py-2 font-semibold text-sm uppercase mb-3 rounded-t-lg">
          📉 Deductions
        </div>
        <div className="border border-slate-200 rounded-b-lg">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Description</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="hover:bg-slate-50">
                <td className="py-3 px-4 text-slate-700">PAYE (Income Tax)</td>
                <td className="text-right py-3 px-4 font-semibold text-red-600">-{formatCurrency(entry.paye)}</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="py-3 px-4 text-slate-700">USC (Universal Social Charge)</td>
                <td className="text-right py-3 px-4 font-semibold text-red-600">-{formatCurrency(entry.usc)}</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="py-3 px-4 text-slate-700">PRSI (Social Insurance)</td>
                <td className="text-right py-3 px-4 font-semibold text-red-600">-{formatCurrency(entry.prsi)}</td>
              </tr>
              {entry.my_future_fund_employee > 0 && (
                <tr className="hover:bg-slate-50">
                  <td className="py-3 px-4 text-blue-700">My Future Fund (Post-Tax)</td>
                  <td className="text-right py-3 px-4 font-semibold text-blue-600">-{formatCurrency(entry.my_future_fund_employee)}</td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-red-50 border-t-2 border-red-600">
              <tr>
                <td className="py-4 px-4 font-bold text-red-800 text-base">TOTAL DEDUCTIONS</td>
                <td className="text-right py-4 px-4 font-bold text-red-800 text-xl">-{formatCurrency((entry.total_deductions || 0) + (entry.my_future_fund_employee || 0))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Net Pay - Highlight */}
      <div className="mb-8 bg-gradient-to-r from-emerald-500 to-emerald-600 p-6 rounded-xl shadow-lg">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-emerald-100 text-sm font-medium uppercase mb-1">Net Pay (Take Home)</p>
            <p className="text-white text-4xl font-bold">{formatCurrency((entry.net_pay || 0) - (entry.my_future_fund_employee || 0))}</p>
          </div>
          <div className="text-white">
            <Euro className="h-16 w-16 opacity-30" />
          </div>
        </div>
      </div>

      {/* Year to Date */}
      <div className="bg-slate-50 p-6 rounded-xl border-2 border-slate-200">
        <div className="flex items-center gap-2 text-slate-600 font-semibold mb-4 uppercase text-sm">
          <TrendingUp className="h-5 w-5" />
          Year to Date Summary
        </div>
        <div className="grid grid-cols-5 gap-4">
          <div className="text-center">
            <p className="text-xs text-slate-500 uppercase mb-1">YTD Gross</p>
            <p className="font-bold text-lg text-slate-900">{formatCurrency(entry.ytd_gross)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500 uppercase mb-1">YTD PAYE</p>
            <p className="font-bold text-lg text-red-600">-{formatCurrency(entry.ytd_paye)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500 uppercase mb-1">YTD USC</p>
            <p className="font-bold text-lg text-red-600">-{formatCurrency(entry.ytd_usc)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500 uppercase mb-1">YTD PRSI</p>
            <p className="font-bold text-lg text-red-600">-{formatCurrency(entry.ytd_prsi)}</p>
          </div>
          <div className="text-center bg-emerald-100 rounded-lg py-2">
            <p className="text-xs text-emerald-700 uppercase mb-1 font-medium">YTD Net</p>
            <p className="font-bold text-lg text-emerald-700">{formatCurrency(entry.ytd_net)}</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 pt-6 border-t border-slate-200">
        <p className="text-xs text-slate-400 text-center">
          This payslip is for informational purposes only. Please retain for your records.
          <br />
          Generated on {format(new Date(), 'dd MMMM yyyy')} • Pay Track IE Payroll Control
        </p>
      </div>
    </div>
  );
}