import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function BulkTaxUpdateDialog({ open, onOpenChange, employees, user, field }) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState('');
  const [justification, setJustification] = useState('');

  const fieldLabels = {
    prsi_rate: 'PRSI Rate (%)',
    annual_tax_credits: 'Annual Tax Credits (€)',
    standard_rate_cut_off: 'Standard Rate Cut-Off (€)',
  };

  const bulkUpdateMutation = useMutation({
    mutationFn: async () => {
      const numValue = field === 'prsi_rate' ? parseFloat(value) / 100 : parseFloat(value);
      
      // Create tax profiles for all employees
      const profilePromises = employees.map(emp =>
        base44.entities.TaxProfile.create({
          employee_id: emp.id,
          effective_from: new Date().toISOString().split('T')[0],
          annual_tax_credits: field === 'annual_tax_credits' ? numValue : emp.annual_tax_credits,
          standard_rate_cut_off: field === 'standard_rate_cut_off' ? numValue : emp.standard_rate_cut_off,
          has_medical_card: emp.has_medical_card || false,
          tax_basis: emp.tax_basis || 'cumulative',
          prsi_rate: field === 'prsi_rate' ? numValue : 0.042,
          changed_by: user?.email,
          change_reason: justification,
        })
      );

      // Update employee records
      const updatePromises = employees.map(emp =>
        base44.entities.Employee.update(emp.id, {
          [field === 'prsi_rate' ? 'prsi_class' : field]: field === 'prsi_rate' ? emp.prsi_class : numValue,
        })
      );

      // Log audit
      await base44.entities.AuditLog.create({
        action: 'bulk_update',
        entity_type: 'TaxProfile',
        field_changed: field,
        new_value: numValue.toString(),
        performed_by: user?.email,
        details: `Bulk update: ${employees.length} employees. Reason: ${justification}`,
      });

      await Promise.all([...profilePromises, ...updatePromises]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allEmployees'] });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
      toast.success(`Bulk update completed for ${employees.length} employees`);
      onOpenChange(false);
      setValue('');
      setJustification('');
    },
    onError: (error) => {
      toast.error('Failed to perform bulk update');
      console.error(error);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bulk Update - {fieldLabels[field]}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Alert className="border-amber-200 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              This will update {fieldLabels[field]} for all {employees?.length} employees and create audit log entries.
            </AlertDescription>
          </Alert>
          <div className="space-y-2">
            <Label>{fieldLabels[field]}</Label>
            <Input
              type="number"
              step={field === 'prsi_rate' ? '0.1' : '1'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={field === 'prsi_rate' ? 'e.g. 4.2' : 'Enter value'}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Justification *</Label>
            <Textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Reason for this change..."
              required
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => bulkUpdateMutation.mutate()} disabled={!value || !justification || bulkUpdateMutation.isPending}>
            {bulkUpdateMutation.isPending ? 'Updating...' : 'Update All'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}