import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar, Info, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { useBankHolidayBalance } from './useBankHolidayBalance';

export default function BankHolidayEntitlementLedger({ employeeId, year }) {
  const { 
    totalGranted, 
    totalConsumed, 
    totalRemaining, 
    entitlements: entitlementsWithFIFO, 
    consumptions,
    isLoading 
  } = useBankHolidayBalance(employeeId, year);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-12">
            <Clock className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-blue-600" />
          Bank Holiday Entitlement Ledger {year}
        </CardTitle>
        <CardDescription>
          Ledger-based tracking: Entitlements granted vs consumed
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6 max-h-[600px] overflow-y-auto">
        {/* Summary */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
            <p className="text-sm text-blue-600">Total Granted</p>
            <p className="text-2xl font-bold text-blue-900">{totalGranted.toFixed(1)}h</p>
          </div>
          <div className="rounded-lg border-2 border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-600">Total Consumed</p>
            <p className="text-2xl font-bold text-amber-900">{totalConsumed.toFixed(1)}h</p>
          </div>
          <div className="rounded-lg border-2 border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm text-emerald-600">Remaining</p>
            <p className="text-2xl font-bold text-emerald-900">{totalRemaining.toFixed(1)}h</p>
          </div>
        </div>

        <Alert className="border-blue-200 bg-blue-50">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <strong>How it works:</strong> Each worked or assumed bank holiday grants entitlement hours. 
            When you take bank holiday leave, it consumes from these entitlements.
          </AlertDescription>
        </Alert>

        {/* Entitlements Table */}
        {entitlementsWithFIFO && entitlementsWithFIFO.length > 0 ? (
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Entitlements Granted</h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bank Holiday</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Granted</TableHead>
                    <TableHead>Consumed</TableHead>
                    <TableHead>Remaining</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entitlementsWithFIFO.map((ent) => {
                    const granted = ent.hours_granted || 0;
                    const consumed = ent.fifoConsumed || 0;
                    const remaining = ent.fifoRemaining !== undefined ? ent.fifoRemaining : granted;
                    
                    console.log(`📊 Rendering ${ent.bank_holiday_name}: consumed=${consumed}, remaining=${remaining}`);
                    
                    return (
                      <TableRow key={ent.id}>
                        <TableCell className="font-medium">{ent.bank_holiday_name}</TableCell>
                        <TableCell>{format(new Date(ent.bank_holiday_date), 'dd MMM yyyy')}</TableCell>
                        <TableCell className="font-medium text-blue-600">
                          +{granted.toFixed(1)}h
                        </TableCell>
                        <TableCell className="text-amber-600">
                          {consumed > 0 ? `-${consumed.toFixed(1)}h` : '-'}
                        </TableCell>
                        <TableCell className="font-medium text-emerald-600">
                          {remaining.toFixed(1)}h
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {ent.grant_reason?.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {remaining <= 0 ? (
                            <Badge className="bg-slate-500 text-white">Fully Used</Badge>
                          ) : consumed > 0 && remaining < granted ? (
                            <Badge className="bg-amber-100 text-amber-700">Partial</Badge>
                          ) : (
                            <Badge className="bg-emerald-100 text-emerald-700">Available</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          <div className="py-12 text-center">
            <Calendar className="mx-auto h-12 w-12 text-slate-300" />
            <p className="mt-4 text-slate-500">No bank holiday entitlements for {year}</p>
            <p className="text-sm text-slate-400">
              Entitlements are granted automatically based on company policy
            </p>
          </div>
        )}

        {/* Consumption History */}
        {consumptions && consumptions.length > 0 && (
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Consumption History</h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date Consumed</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {consumptions.map((cons) => (
                    <TableRow key={cons.id}>
                      <TableCell>{format(new Date(cons.consumption_date), 'dd MMM yyyy')}</TableCell>
                      <TableCell className="font-medium text-amber-600">
                        -{cons.hours_consumed.toFixed(1)}h
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {cons.consumption_reason?.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm">{cons.notes || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}