import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
  FileText,
  Download,
  Calendar,
  Euro,
  Building2,
  User,
  TrendingUp,
  Printer,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import ProfileCompletionBanner from '@/components/profile/ProfileCompletionBanner';
import PayslipPDF from '@/components/payroll/PayslipPDF';
import { formatCurrency, isBonusMonth } from '@/components/payroll/IrishTaxCalculator';
import { toast } from 'sonner';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function Payslips() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const payslipRef = useRef(null);

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

  // Fetch payroll entries from December (year-1) to November (year)
  const { data: payrollEntries, isLoading: payrollLoading } = useQuery({
    queryKey: ['payrollEntries', employee?.id, selectedYear],
    queryFn: async () => {
      if (!employee?.id) return [];
      
      // Fetch December of previous year
      const prevYearDec = await base44.entities.PayrollEntry.filter({
        employee_id: employee.id,
        period_year: selectedYear - 1,
        period_month: 12,
      });
      
      // Fetch January to November of selected year
      const currentYearEntries = await base44.entities.PayrollEntry.filter({
        employee_id: employee.id,
        period_year: selectedYear,
      });
      
      const janToNov = currentYearEntries.filter(e => e.period_month <= 11);
      
      return [...prevYearDec, ...janToNov];
    },
    enabled: !!employee?.id,
  });

  const isLoading = userLoading || employeeLoading || payrollLoading;
  const isProfileComplete = employee?.profile_complete;

  const handleDownloadPDF = async () => {
    if (!payslipRef.current) return;

    try {
      toast.loading('Generating PDF...');
      
      const canvas = await html2canvas(payslipRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 0;

      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      pdf.save(`Payslip_${MONTHS[(selectedPayslip?.period_month || 1) - 1]}_${selectedPayslip?.period_year}.pdf`);
      
      toast.dismiss();
      toast.success('PDF downloaded successfully');
    } catch (error) {
      toast.dismiss();
      toast.error('Failed to generate PDF');
      console.error(error);
    }
  };

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
          <h1 className="text-3xl font-bold text-slate-900">Payslips</h1>
          <ProfileCompletionBanner missingFields={['Complete Profile Setup']} />
        </div>
      </div>
    );
  }

  const sortedEntries = payrollEntries?.sort((a, b) => b.period_month - a.period_month) || [];

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
              <h1 className="text-3xl font-bold text-slate-900">Summary</h1>
              <p className="mt-1 text-slate-500">
                View and download your monthly summary
              </p>
            </div>

            <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="w-28 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2023, 2024, 2025, 2026, 2027].map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </motion.div>

        {/* Payslip List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Payslip History</CardTitle>
              <CardDescription>
                Dec {selectedYear - 1} to Nov {selectedYear}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sortedEntries.length === 0 ? (
                <div className="py-12 text-center">
                  <FileText className="mx-auto h-12 w-12 text-slate-300" />
                  <p className="mt-4 text-slate-500">No payslips available for {selectedYear}</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead>Payment Date</TableHead>
                      <TableHead>Gross Pay</TableHead>
                      <TableHead>Deductions</TableHead>
                      <TableHead>Net Pay</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedEntries.map((entry) => (
                      <TableRow key={entry.id} className="cursor-pointer hover:bg-slate-50">
                        <TableCell className="font-medium">
                          {MONTHS[entry.period_month - 1]} {entry.period_year}
                          {isBonusMonth(entry.period_month) && entry.quarterly_bonus > 0 && (
                            <Badge className="ml-2 bg-amber-100 text-amber-700">Bonus</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {entry.payment_date ? format(new Date(entry.payment_date), 'dd MMM yyyy') : '-'}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(entry.gross_pay)}
                        </TableCell>
                        <TableCell className="text-red-600">
                          -{formatCurrency((entry.total_deductions || 0) + (entry.my_future_fund_employee || 0))}
                        </TableCell>
                        <TableCell className="font-bold text-emerald-600">
                          {formatCurrency((entry.net_pay || 0) - (entry.my_future_fund_employee || 0))}
                        </TableCell>
                        <TableCell>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setSelectedPayslip(entry)}
                              >
                                <FileText className="mr-2 h-4 w-4" />
                                View
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle className="flex items-center justify-between">
                                  <span>Payslip - {MONTHS[(entry.period_month || 1) - 1]} {entry.period_year}</span>
                                  <Button onClick={handleDownloadPDF} className="bg-emerald-600 hover:bg-emerald-700">
                                    <Download className="mr-2 h-4 w-4" />
                                    Download PDF
                                  </Button>
                                </DialogTitle>
                              </DialogHeader>
                              
                              <div ref={payslipRef}>
                                <PayslipPDF entry={entry} employee={employee} />
                              </div>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* YTD Summary - Corrected Calculation */}
        {sortedEntries.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="mt-8"
          >
            <Card className="border-2 border-slate-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                  Year to Date Summary
                </CardTitle>
                <CardDescription>Dec {selectedYear - 1} to Nov {selectedYear}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-5">
                  <div className="rounded-lg bg-slate-50 p-4 text-center">
                    <p className="text-sm text-slate-500">YTD Gross</p>
                    <p className="text-xl font-bold text-slate-900">
                      {formatCurrency(sortedEntries.reduce((sum, e) => sum + (e.gross_pay || 0), 0))}
                    </p>
                  </div>
                  <div className="rounded-lg bg-red-50 p-4 text-center">
                    <p className="text-sm text-red-600">YTD PAYE</p>
                    <p className="text-xl font-bold text-red-700">
                      -{formatCurrency(sortedEntries.reduce((sum, e) => sum + (e.paye || 0), 0))}
                    </p>
                  </div>
                  <div className="rounded-lg bg-orange-50 p-4 text-center">
                    <p className="text-sm text-orange-600">YTD USC</p>
                    <p className="text-xl font-bold text-orange-700">
                      -{formatCurrency(sortedEntries.reduce((sum, e) => sum + (e.usc || 0), 0))}
                    </p>
                  </div>
                  <div className="rounded-lg bg-purple-50 p-4 text-center">
                    <p className="text-sm text-purple-600">YTD PRSI</p>
                    <p className="text-xl font-bold text-purple-700">
                      -{formatCurrency(sortedEntries.reduce((sum, e) => sum + (e.prsi || 0), 0))}
                    </p>
                  </div>
                  <div className="rounded-lg bg-emerald-50 p-4 text-center">
                    <p className="text-sm text-emerald-600">YTD Net</p>
                    <p className="text-xl font-bold text-emerald-700">
                      {formatCurrency(sortedEntries.reduce((sum, e) => sum + (e.net_pay || 0), 0))}
                    </p>
                  </div>
                </div>
                
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-xs text-slate-500">YTD Bonuses</p>
                    <p className="font-semibold text-amber-700">
                      {formatCurrency(sortedEntries.reduce((sum, e) => sum + (e.quarterly_bonus || 0), 0))}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-xs text-slate-500">YTD Health Insurance (BIK)</p>
                    <p className="font-semibold text-slate-700">
                      {formatCurrency(sortedEntries.reduce((sum, e) => sum + (e.health_insurance || 0), 0))}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}