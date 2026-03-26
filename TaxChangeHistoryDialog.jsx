import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

export default function TaxChangeHistoryDialog({ open, onOpenChange, employeeId }) {
  const { data: taxProfiles, isLoading } = useQuery({
    queryKey: ['taxProfiles', employeeId],
    queryFn: () => base44.entities.TaxProfile.filter({ employee_id: employeeId }),
    enabled: !!employeeId && open,
  });

  const { data: auditLogs } = useQuery({
    queryKey: ['taxAuditLogs', employeeId],
    queryFn: () => base44.entities.AuditLog.filter({ 
      employee_id: employeeId,
      entity_type: 'TaxProfile' 
    }),
    enabled: !!employeeId && open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tax Profile Change History</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <Skeleton className="h-64" />
        ) : (
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Field</TableHead>
                  <TableHead>Old Value</TableHead>
                  <TableHead>New Value</TableHead>
                  <TableHead>Changed By</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs?.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs">{format(new Date(log.created_date), 'dd MMM yyyy HH:mm')}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.field_changed}</Badge>
                    </TableCell>
                    <TableCell className="text-slate-500">{log.old_value || '-'}</TableCell>
                    <TableCell className="font-medium">{log.new_value}</TableCell>
                    <TableCell className="text-slate-500 text-xs">{log.performed_by}</TableCell>
                    <TableCell className="text-slate-500 text-xs max-w-xs truncate">{log.details}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {taxProfiles && taxProfiles.length > 0 && (
              <div className="mt-4">
                <h3 className="font-semibold mb-2">Tax Profile History</h3>
                <div className="space-y-2">
                  {taxProfiles.map((profile) => (
                    <div key={profile.id} className="border rounded-lg p-3 bg-slate-50">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div><span className="text-slate-500">Effective:</span> <span className="font-medium">{format(new Date(profile.effective_from), 'dd MMM yyyy')}</span></div>
                        <div><span className="text-slate-500">Tax Credits:</span> <span className="font-medium">€{profile.annual_tax_credits}</span></div>
                        <div><span className="text-slate-500">Cut-Off:</span> <span className="font-medium">€{profile.standard_rate_cut_off}</span></div>
                        <div><span className="text-slate-500">PRSI Rate:</span> <span className="font-medium">{(profile.prsi_rate * 100).toFixed(1)}%</span></div>
                        <div className="col-span-2"><span className="text-slate-500">Reason:</span> <span className="font-medium text-xs">{profile.change_reason}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}