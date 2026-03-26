import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TrendingUp, Shield, Info, CheckCircle, XCircle, Clock } from 'lucide-react';
import { ELIGIBILITY_RULES, PENSION_RATES } from '@/components/payroll/MyFutureFundCalculator.jsx';
import { formatCurrency } from '@/components/payroll/IrishTaxCalculator';

export default function MyFutureFundWidget({ eligibility, contribution, pensionRecord, paymentDate }) {
  if (!eligibility) {
    return null;
  }

  const getStatusIcon = () => {
    if (eligibility.eligible && !pensionRecord?.opt_out_status) {
      return <CheckCircle className="h-5 w-5 text-green-600" />;
    }
    if (pensionRecord?.opt_out_status) {
      return <XCircle className="h-5 w-5 text-red-600" />;
    }
    return <Clock className="h-5 w-5 text-amber-600" />;
  };

  const getStatusBadge = () => {
    if (eligibility.eligible && !pensionRecord?.opt_out_status) {
      return <Badge className="bg-green-100 text-green-800">Enrolled</Badge>;
    }
    if (pensionRecord?.opt_out_status) {
      return <Badge className="bg-red-100 text-red-800">Opted Out</Badge>;
    }
    return <Badge className="bg-amber-100 text-amber-800">Not Eligible</Badge>;
  };

  return (
    <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-600" />
            <CardTitle>My Future Fund</CardTitle>
          </div>
          {getStatusBadge()}
        </div>
        <CardDescription>
          Auto-Enrolment Pension • Effective 01-01-2026
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Eligibility Status */}
        <div className="flex items-start gap-3 rounded-lg bg-white p-4 border">
          {getStatusIcon()}
          <div className="flex-1">
            <p className="font-semibold text-sm text-slate-700">Eligibility Status</p>
            {eligibility.eligible ? (
              <div className="mt-1 space-y-1 text-xs text-slate-600">
                <p>✓ Age {eligibility.age} (23-60 required)</p>
                <p>✓ Annualised earnings {formatCurrency(eligibility.annualisedEarnings)} (&gt;€20,000)</p>
                <p>✓ No employer pension/PRSA</p>
              </div>
            ) : (
              <div className="mt-1 space-y-1">
                {eligibility.reasons.map((reason, idx) => (
                  <p key={idx} className="text-xs text-red-600">✗ {reason}</p>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Contribution Breakdown - Only if eligible and not opted out */}
        {eligibility.eligible && !pensionRecord?.opt_out_status && contribution && (
          <>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Your Contribution ({contribution.appliedRate}%)</span>
                <span className="font-semibold text-blue-700">
                  {formatCurrency(contribution.employeeContribution)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Employer Contribution ({contribution.appliedRate}%)</span>
                <span className="font-semibold text-green-700">
                  {formatCurrency(contribution.employerContribution)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">State Contribution</span>
                <span className="font-semibold text-emerald-700">
                  {formatCurrency(contribution.stateContribution)}
                </span>
              </div>
              <div className="pt-2 border-t flex justify-between">
                <span className="font-semibold text-slate-900">Total Monthly Pension</span>
                <span className="font-bold text-blue-700 text-lg">
                  {formatCurrency(contribution.totalContribution)}
                </span>
              </div>
            </div>

            <Alert className="border-blue-200 bg-blue-50">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-xs text-blue-800">
                Phase: {contribution.phase} • Contributions capped at €80,000 annual earnings
                <br />
                Post-tax deduction • No tax relief applies
              </AlertDescription>
            </Alert>
          </>
        )}

        {/* Opted Out Information */}
        {pensionRecord?.opt_out_status && (
          <Alert className="border-amber-200 bg-amber-50">
            <Clock className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-xs text-amber-800">
              You opted out on {new Date(pensionRecord.opt_out_date).toLocaleDateString()}
              <br />
              Automatic re-enrolment scheduled: {new Date(pensionRecord.re_enrolment_date).toLocaleDateString()}
            </AlertDescription>
          </Alert>
        )}

        {/* Enrolment Information */}
        {pensionRecord?.enrolment_date && !pensionRecord?.opt_out_status && (
          <div className="text-xs text-slate-500">
            Enrolled: {new Date(pensionRecord.enrolment_date).toLocaleDateString()}
            {pensionRecord.opt_out_allowed_from && (
              <span className="ml-2">
                • Opt-out available from: {new Date(pensionRecord.opt_out_allowed_from).toLocaleDateString()}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}