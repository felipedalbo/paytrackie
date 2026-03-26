import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Shield } from 'lucide-react';
import { getAllPRSIClasses, getSubclassesForClass } from '@/components/payroll/PRSIRules';

export default function BulkPRSIUpdateDialog({ open, onOpenChange }) {
  const queryClient = useQueryClient();
  const [prsiClass, setPrsiClass] = useState('A');
  const [prsiSubclass, setPrsiSubclass] = useState('A1');
  const [justification, setJustification] = useState('');

  const prsiClasses = getAllPRSIClasses(2026);
  const subclasses = getSubclassesForClass(prsiClass, 2026);

  const bulkUpdateMutation = useMutation({
    mutationFn: async () => {
      if (!justification.trim()) {
        throw new Error('Justification is required');
      }

      const currentUser = await base44.auth.me();
      const allEmployees = await base44.entities.Employee.list();

      // Update all employees
      for (const employee of allEmployees) {
        // Update employee PRSI
        await base44.entities.Employee.update(employee.id, {
          prsi_class: prsiClass,
          prsi_subclass: prsiSubclass,
        });

        // Create PRSI history record
        await base44.entities.PRSIHistory.create({
          employee_id: employee.id,
          prsi_class: prsiClass,
          prsi_subclass: prsiSubclass,
          effective_from: new Date().toISOString().split('T')[0],
          changed_by: currentUser.email,
          change_reason: justification,
        });

        // Log audit trail
        await base44.entities.AuditLog.create({
          employee_id: employee.id,
          action: 'bulk_update',
          entity_type: 'Employee',
          entity_id: employee.id,
          field_changed: 'PRSI Class/Subclass',
          old_value: `${employee.prsi_class}/${employee.prsi_subclass}`,
          new_value: `${prsiClass}/${prsiSubclass}`,
          performed_by: currentUser.email,
          details: `Bulk PRSI update: ${justification}`,
        });
      }

      return allEmployees.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success(`Updated PRSI for ${count} employees`);
      setPrsiClass('A');
      setPrsiSubclass('A1');
      setJustification('');
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update PRSI classes');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-600" />
            Bulk PRSI Update
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
            <p className="text-sm text-amber-800">
              ⚠️ This will update PRSI class/subclass for ALL employees
            </p>
          </div>

          <div className="space-y-2">
            <Label>PRSI Class</Label>
            <Select value={prsiClass} onValueChange={(v) => {
              setPrsiClass(v);
              const subs = getSubclassesForClass(v, 2026);
              if (subs.length > 0) setPrsiSubclass(subs[0].value);
            }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {prsiClasses.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>PRSI Subclass</Label>
            <Select value={prsiSubclass} onValueChange={setPrsiSubclass}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {subclasses.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Justification (Required)</Label>
            <Textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Reason for bulk PRSI update..."
              className="h-20"
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => bulkUpdateMutation.mutate()}
              disabled={bulkUpdateMutation.isPending || !justification.trim()}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {bulkUpdateMutation.isPending ? 'Updating...' : 'Update All Employees'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}