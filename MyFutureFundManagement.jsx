import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, CheckCircle, XCircle, Clock, RefreshCw, Eye, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { checkEligibility, canOptOut, calculateReEnrolmentDate } from '@/components/payroll/MyFutureFundCalculator.jsx';
import { formatCurrency } from '@/components/payroll/IrishTaxCalculator';

export default function MyFutureFundManagement() {
  const queryClient = useQueryClient();
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  // Fetch all employees
  const { data: employees } = useQuery({
    queryKey: ['allEmployees'],
    queryFn: () => base44.entities.Employee.list(),
  });

  // Fetch all pension records
  const { data: pensionRecords } = useQuery({
    queryKey: ['allPensionRecords'],
    queryFn: () => base44.entities.PensionAutoEnrolment.list(),
  });

  // Fetch all payroll entries for rolling earnings calculation
  const { data: payrollEntries } = useQuery({
    queryKey: ['allPayrollEntries'],
    queryFn: () => base44.entities.PayrollEntry.list(),
  });

  // Recalculate eligibility mutation
  const recheckEligibilityMutation = useMutation({
    mutationFn: async (employee) => {
      const pensionRecord = pensionRecords?.find(p => p.employee_id === employee.id);
      
      // Use estimated monthly gross for eligibility check
      const estimatedMonthlyGross = (employee.base_hourly_rate || 0) * (employee.weekly_contracted_hours || 0) * 52 / 12;
      
      const eligibility = checkEligibility(
        employee,
        pensionRecord,
        estimatedMonthlyGross,
        new Date().toISOString().split('T')[0],
        'monthly'
      );

      if (pensionRecord) {
        await base44.entities.PensionAutoEnrolment.update(pensionRecord.id, {
          eligibility_status: eligibility.eligible ? 'eligible' : 'not_eligible',
          eligibility_reason: eligibility.reasons.join('; ') || 'Eligible for auto-enrolment',
          rolling_annual_earnings: eligibility.annualisedEarnings || 0,
          last_eligibility_check: new Date().toISOString().split('T')[0],
        });
      }

      const currentUser = await base44.auth.me();
      await base44.entities.AuditLog.create({
        employee_id: employee.id,
        action: 'update',
        entity_type: 'PensionAutoEnrolment',
        performed_by: currentUser?.email || 'admin',
        details: `${employee.full_name}: Eligibility rechecked: ${eligibility.eligible ? 'Eligible' : 'Not eligible'}`,
      });

      return eligibility;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allPensionRecords'] });
      toast.success('Eligibility rechecked successfully');
    },
    onError: (error) => {
      toast.error('Failed to recheck eligibility');
      console.error(error);
    },
  });

  // Process opt-out mutation
  const processOptOutMutation = useMutation({
    mutationFn: async ({ employeeId, pensionRecordId, reason }) => {
      const employee = employees?.find(e => e.id === employeeId);
      const optOutDate = new Date().toISOString().split('T')[0];
      const reEnrolmentDate = calculateReEnrolmentDate(optOutDate);

      await base44.entities.PensionAutoEnrolment.update(pensionRecordId, {
        opt_out_status: true,
        opt_out_date: optOutDate,
        opt_out_reason: reason,
        re_enrolment_date: reEnrolmentDate,
        eligibility_status: 'opted_out',
      });

      const currentUser = await base44.auth.me();
      await base44.entities.AuditLog.create({
        employee_id: employeeId,
        action: 'update',
        entity_type: 'PensionAutoEnrolment',
        performed_by: currentUser?.email || 'admin',
        details: `${employee?.full_name || 'Employee'} opted out on ${optOutDate}. Re-enrolment scheduled for ${reEnrolmentDate}. Reason: ${reason}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allPensionRecords'] });
      toast.success('Opt-out processed successfully');
    },
    onError: (error) => {
      toast.error('Failed to process opt-out');
      console.error(error);
    },
  });

  const getStatusBadge = (employee) => {
    const pension = pensionRecords?.find(p => p.employee_id === employee.id);
    
    if (!pension) {
      return <Badge variant="outline">Not Enrolled</Badge>;
    }
    
    if (pension.opt_out_status) {
      return <Badge className="bg-red-100 text-red-800">Opted Out</Badge>;
    }
    
    if (pension.eligibility_status === 'eligible') {
      return <Badge className="bg-green-100 text-green-800">Enrolled</Badge>;
    }
    
    return <Badge className="bg-amber-100 text-amber-800">Not Eligible</Badge>;
  };

  const getEmployeeEarnings = (employeeId) => {
    const currentYear = new Date().getFullYear();
    const employeePayroll = payrollEntries?.filter(e => 
      e.employee_id === employeeId && 
      new Date(e.payment_date).getFullYear() === currentYear
    ) || [];
    
    return employeePayroll.reduce((sum, e) => sum + (e.gross_pay || 0), 0);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-blue-600" />
              My Future Fund Management
            </CardTitle>
            <CardDescription>
              Auto-Enrolment Pension • Effective 01-01-2026
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Alert className="mb-4 border-blue-200 bg-blue-50">
          <Shield className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-sm text-blue-800">
            <strong>Legal Requirements:</strong> Employees aged 23-60 with annual earnings &gt;€20,000 
            are automatically enrolled. Contributions are post-tax with no relief.
          </AlertDescription>
        </Alert>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Age</TableHead>
              <TableHead>Annual Earnings</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Enrolment Date</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees?.map((employee) => {
              const pension = pensionRecords?.find(p => p.employee_id === employee.id);
              const earnings = getEmployeeEarnings(employee.id);
              const age = employee.date_of_birth ? 
                Math.floor((new Date() - new Date(employee.date_of_birth)) / (365.25 * 24 * 60 * 60 * 1000)) : 
                'N/A';

              return (
                <TableRow key={employee.id}>
                  <TableCell className="font-medium">{employee.full_name}</TableCell>
                  <TableCell>{age}</TableCell>
                  <TableCell>{formatCurrency(earnings)}</TableCell>
                  <TableCell>{getStatusBadge(employee)}</TableCell>
                  <TableCell>
                    {pension?.enrolment_date ? 
                      new Date(pension.enrolment_date).toLocaleDateString() : 
                      '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => recheckEligibilityMutation.mutate(employee)}
                        disabled={recheckEligibilityMutation.isPending}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      {pension && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedEmployee(employee)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Pension Details - {employee.full_name}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <p className="text-slate-500">Eligibility Status</p>
                                  <p className="font-medium">{pension.eligibility_status}</p>
                                </div>
                                <div>
                                  <p className="text-slate-500">Contribution Phase</p>
                                  <p className="font-medium">{pension.contribution_phase}</p>
                                </div>
                                <div>
                                  <p className="text-slate-500">Rolling Earnings</p>
                                  <p className="font-medium">{formatCurrency(pension.rolling_annual_earnings || 0)}</p>
                                </div>
                                <div>
                                  <p className="text-slate-500">Last Check</p>
                                  <p className="font-medium">
                                    {pension.last_eligibility_check ? 
                                      new Date(pension.last_eligibility_check).toLocaleDateString() : 
                                      'Never'}
                                  </p>
                                </div>
                              </div>

                              {pension.eligibility_reason && (
                                <Alert>
                                  <AlertTriangle className="h-4 w-4" />
                                  <AlertDescription className="text-sm">
                                    {pension.eligibility_reason}
                                  </AlertDescription>
                                </Alert>
                              )}

                              {pension.opt_out_status && (
                                <Alert className="border-amber-200 bg-amber-50">
                                  <Clock className="h-4 w-4 text-amber-600" />
                                  <AlertDescription className="text-sm text-amber-800">
                                    Opted out on {new Date(pension.opt_out_date).toLocaleDateString()}
                                    <br />
                                    Re-enrolment: {new Date(pension.re_enrolment_date).toLocaleDateString()}
                                    <br />
                                    Reason: {pension.opt_out_reason}
                                  </AlertDescription>
                                </Alert>
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}