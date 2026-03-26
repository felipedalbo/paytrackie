import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { PRSI_CLASSES_2026, getSubclassesForClass } from '@/components/payroll/PRSIRules';

export default function BulkUpdatesDialog({ open, onOpenChange }) {
  const [activeTab, setActiveTab] = useState('salary');
  const [hourlyRate, setHourlyRate] = useState('');
  const [annualSalary, setAnnualSalary] = useState('');
  const [prsiRate, setPrsiRate] = useState('');
  const [taxCredits, setTaxCredits] = useState('');
  const [cutOff, setCutOff] = useState('');
  const [uscBand1Rate, setUscBand1Rate] = useState('');
  const [uscBand2Rate, setUscBand2Rate] = useState('');
  const [uscBand3Rate, setUscBand3Rate] = useState('');
  const [uscBand4Rate, setUscBand4Rate] = useState('');
  const [uscBand1Threshold, setUscBand1Threshold] = useState('');
  const [uscBand2Threshold, setUscBand2Threshold] = useState('');
  const [uscBand3Threshold, setUscBand3Threshold] = useState('');
  const [justification, setJustification] = useState('');
  const [prsiClass, setPrsiClass] = useState('A');
  const [prsiSubclass, setPrsiSubclass] = useState('A1');
  const [shiftPolicyId, setShiftPolicyId] = useState('');
  const [selectedEmployees, setSelectedEmployees] = useState([]);

  const queryClient = useQueryClient();
  
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: allEmployees } = useQuery({
    queryKey: ['allEmployees'],
    queryFn: () => base44.entities.Employee.list(),
  });

  const { data: shiftPolicies } = useQuery({
    queryKey: ['shiftPolicies'],
    queryFn: () => base44.entities.ShiftPolicy.filter({ is_active: true }),
    initialData: [],
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async () => {
      if (!justification) {
        throw new Error('Justification is required');
      }

      if (selectedEmployees.length === 0) {
        throw new Error('Please select at least one employee');
      }

      const employeesToUpdate = allEmployees.filter(emp => selectedEmployees.includes(emp.id));
      const updatePromises = [];
      const now = new Date().toISOString().split('T')[0];

      if (hourlyRate) {
        employeesToUpdate.forEach(emp => {
          updatePromises.push(
            base44.entities.Employee.update(emp.id, {
              base_hourly_rate: parseFloat(hourlyRate),
            })
          );
        });
      }

      if (annualSalary) {
        employeesToUpdate.forEach(emp => {
          updatePromises.push(
            base44.entities.Employee.update(emp.id, {
              annual_salary: parseFloat(annualSalary),
            })
          );
        });
      }

      if (prsiRate) {
        employeesToUpdate.forEach(emp => {
          updatePromises.push(
            base44.entities.Employee.update(emp.id, {
              prsi_rate: parseFloat(prsiRate) / 100,
            })
          );
        });
      }

      if (taxCredits) {
        employeesToUpdate.forEach(emp => {
          updatePromises.push(
            base44.entities.TaxProfile.create({
              employee_id: emp.id,
              effective_from: now,
              annual_tax_credits: parseFloat(taxCredits),
              standard_rate_cut_off: emp.standard_rate_cut_off || 44000,
              has_medical_card: emp.has_medical_card || false,
              tax_basis: emp.tax_basis || 'cumulative',
              prsi_rate: emp.prsi_rate || 0.042,
              changed_by: user?.email,
              change_reason: justification,
            })
          );
          updatePromises.push(
            base44.entities.Employee.update(emp.id, {
              annual_tax_credits: parseFloat(taxCredits),
            })
          );
        });
      }

      if (cutOff) {
        employeesToUpdate.forEach(emp => {
          updatePromises.push(
            base44.entities.TaxProfile.create({
              employee_id: emp.id,
              effective_from: now,
              annual_tax_credits: emp.annual_tax_credits || 3750,
              standard_rate_cut_off: parseFloat(cutOff),
              has_medical_card: emp.has_medical_card || false,
              tax_basis: emp.tax_basis || 'cumulative',
              prsi_rate: emp.prsi_rate || 0.042,
              changed_by: user?.email,
              change_reason: justification,
            })
          );
          updatePromises.push(
            base44.entities.Employee.update(emp.id, {
              standard_rate_cut_off: parseFloat(cutOff),
            })
          );
        });
      }

      if (uscBand1Rate || uscBand2Rate || uscBand3Rate || uscBand4Rate || uscBand1Threshold || uscBand2Threshold || uscBand3Threshold) {
        employeesToUpdate.forEach(emp => {
          const updateData = {};
          if (uscBand1Rate) updateData.usc_band_1_rate = parseFloat(uscBand1Rate) / 100;
          if (uscBand2Rate) updateData.usc_band_2_rate = parseFloat(uscBand2Rate) / 100;
          if (uscBand3Rate) updateData.usc_band_3_rate = parseFloat(uscBand3Rate) / 100;
          if (uscBand4Rate) updateData.usc_band_4_rate = parseFloat(uscBand4Rate) / 100;
          if (uscBand1Threshold) updateData.usc_band_1_threshold = parseFloat(uscBand1Threshold);
          if (uscBand2Threshold) updateData.usc_band_2_threshold = parseFloat(uscBand2Threshold);
          if (uscBand3Threshold) updateData.usc_band_3_threshold = parseFloat(uscBand3Threshold);
          
          updatePromises.push(
            base44.entities.Employee.update(emp.id, updateData)
          );
        });
      }

      // PRSI updates
      if (activeTab === 'prsi' && prsiClass && prsiSubclass) {
        employeesToUpdate.forEach(emp => {
          // Create PRSI history record
          updatePromises.push(
            base44.entities.PRSIHistory.create({
              employee_id: emp.id,
              prsi_class: prsiClass,
              prsi_subclass: prsiSubclass,
              effective_from: now,
              changed_by: user?.email,
              change_reason: justification || 'Bulk PRSI update',
            })
          );

          // Update employee record
          updatePromises.push(
            base44.entities.Employee.update(emp.id, {
              prsi_class: prsiClass,
              prsi_subclass: prsiSubclass,
            })
          );
        });
      }

      // Shift Policy updates
      if (shiftPolicyId) {
        employeesToUpdate.forEach(emp => {
          updatePromises.push(
            base44.entities.Employee.update(emp.id, {
              shift_policy_id: shiftPolicyId === 'none' ? null : shiftPolicyId,
            })
          );
        });
      }

      await Promise.all(updatePromises);

      await base44.entities.AuditLog.create({
        action: 'bulk_update',
        entity_type: 'Employee',
        performed_by: user?.email,
        details: `Bulk update applied. Reason: ${justification}`,
      });

      return employeesToUpdate.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['allEmployees'] });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
      toast.success(`${count} employees updated successfully`);
      onOpenChange(false);
      setHourlyRate('');
      setAnnualSalary('');
      setPrsiRate('');
      setTaxCredits('');
      setCutOff('');
      setUscBand1Rate('');
      setUscBand2Rate('');
      setUscBand3Rate('');
      setUscBand4Rate('');
      setUscBand1Threshold('');
      setUscBand2Threshold('');
      setUscBand3Threshold('');
      setJustification('');
      setPrsiClass('A');
      setPrsiSubclass('A1');
      setShiftPolicyId('');
      setSelectedEmployees([]);
      setActiveTab('salary');
    },
    onError: (error) => {
      toast.error(error?.message || 'Bulk update failed');
      console.error(error);
    },
  });

  // Available subclasses for selected class
  const availableSubclasses = getSubclassesForClass(prsiClass);

  // Update prsiSubclass when prsiClass changes to first available option
  React.useEffect(() => {
    if (availableSubclasses.length > 0) {
      setPrsiSubclass(availableSubclasses[0].value);
    }
  }, [prsiClass]);

  const toggleEmployee = (empId) => {
    setSelectedEmployees(prev => 
      prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]
    );
  };

  const toggleAll = () => {
    if (selectedEmployees.length === allEmployees?.length) {
      setSelectedEmployees([]);
    } else {
      setSelectedEmployees(allEmployees?.map(e => e.id) || []);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    bulkUpdateMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Updates - Selected Employees</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Alert className="border-blue-200 bg-blue-50">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              Select employees to update. Only fill in fields you want to change.
            </AlertDescription>
          </Alert>

          {/* Employee Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="font-semibold">Select Employees ({selectedEmployees.length} selected)</Label>
              <Button type="button" variant="outline" size="sm" onClick={toggleAll}>
                {selectedEmployees.length === allEmployees?.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
            <div className="max-h-48 overflow-y-auto border rounded-lg p-3 space-y-2 bg-slate-50">
              {allEmployees?.map(emp => (
                <div key={emp.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`emp-${emp.id}`}
                    checked={selectedEmployees.includes(emp.id)}
                    onChange={() => toggleEmployee(emp.id)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <Label htmlFor={`emp-${emp.id}`} className="cursor-pointer text-sm font-normal">
                    {emp.full_name || emp.created_by}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="salary">Salary</TabsTrigger>
              <TabsTrigger value="tax">Tax</TabsTrigger>
              <TabsTrigger value="usc">USC Rates</TabsTrigger>
              <TabsTrigger value="prsi">PRSI</TabsTrigger>
              <TabsTrigger value="shift">Shift</TabsTrigger>
            </TabsList>

            <TabsContent value="salary" className="space-y-4">
              <div className="space-y-2">
                <Label>Hourly Rate (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  placeholder="Leave empty to skip"
                />
              </div>

              <div className="space-y-2">
                <Label>Annual Salary (€)</Label>
                <Input
                  type="number"
                  step="1"
                  value={annualSalary}
                  onChange={(e) => setAnnualSalary(e.target.value)}
                  placeholder="Leave empty to skip"
                />
              </div>
            </TabsContent>

            <TabsContent value="tax" className="space-y-4">
              <div className="space-y-2">
                <Label>PRSI Rate (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={prsiRate}
                  onChange={(e) => setPrsiRate(e.target.value)}
                  placeholder="e.g., 4.2"
                />
              </div>

              <div className="space-y-2">
                <Label>Annual Tax Credits (€)</Label>
                <Input
                  type="number"
                  step="1"
                  value={taxCredits}
                  onChange={(e) => setTaxCredits(e.target.value)}
                  placeholder="Leave empty to skip"
                />
              </div>

              <div className="space-y-2">
                <Label>Standard Rate Cut-Off (€)</Label>
                <Input
                  type="number"
                  step="1"
                  value={cutOff}
                  onChange={(e) => setCutOff(e.target.value)}
                  placeholder="Leave empty to skip"
                />
              </div>
            </TabsContent>

            <TabsContent value="usc" className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold mb-3">USC Rates (%)</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Band 1 Rate (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={uscBand1Rate}
                      onChange={(e) => setUscBand1Rate(e.target.value)}
                      placeholder="Default: 0.5"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Band 2 Rate (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={uscBand2Rate}
                      onChange={(e) => setUscBand2Rate(e.target.value)}
                      placeholder="Default: 2"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Band 3 Rate (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={uscBand3Rate}
                      onChange={(e) => setUscBand3Rate(e.target.value)}
                      placeholder="Default: 3"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Band 4 Rate (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={uscBand4Rate}
                      onChange={(e) => setUscBand4Rate(e.target.value)}
                      placeholder="Default: 8"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-3">USC Thresholds (€)</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Band 1 Threshold (€)</Label>
                    <Input
                      type="number"
                      step="1"
                      value={uscBand1Threshold}
                      onChange={(e) => setUscBand1Threshold(e.target.value)}
                      placeholder="Default: 12,012"
                    />
                    <p className="text-xs text-slate-500">Income up to this amount</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Band 2 Threshold (€)</Label>
                    <Input
                      type="number"
                      step="1"
                      value={uscBand2Threshold}
                      onChange={(e) => setUscBand2Threshold(e.target.value)}
                      placeholder="Default: 28,700"
                    />
                    <p className="text-xs text-slate-500">Income up to this amount</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Band 3 Threshold (€)</Label>
                    <Input
                      type="number"
                      step="1"
                      value={uscBand3Threshold}
                      onChange={(e) => setUscBand3Threshold(e.target.value)}
                      placeholder="Default: 70,044"
                    />
                    <p className="text-xs text-slate-500">Income up to this amount</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-400">Band 4 Threshold</Label>
                    <Input
                      type="text"
                      value="No limit"
                      disabled
                      className="bg-slate-50 text-slate-500"
                    />
                    <p className="text-xs text-slate-500">All income above Band 3</p>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="prsi" className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Update PRSI class and subclass for all employees. This will create PRSI history records.
                </AlertDescription>
              </Alert>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>PRSI Class</Label>
                  <Select value={prsiClass} onValueChange={(value) => {
                    setPrsiClass(value);
                    const subclasses = getSubclassesForClass(value);
                    setPrsiSubclass(subclasses[0] || '');
                  }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from(new Set(PRSI_CLASSES_2026.map(r => r.class_code))).map(cls => (
                        <SelectItem key={cls} value={cls}>Class {cls}</SelectItem>
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
                      {availableSubclasses.map(sub => (
                        <SelectItem key={sub.value} value={sub.value}>{sub.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="shift" className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Assign a shift policy to employees. This defines work hours, breaks, and night premiums.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label>Shift Policy</Label>
                <Select value={shiftPolicyId} onValueChange={setShiftPolicyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select shift policy" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Remove Shift Policy</SelectItem>
                    {shiftPolicies?.map((shift) => (
                      <SelectItem key={shift.id} value={shift.id}>
                        {shift.shift_name} ({shift.start_time} - {shift.end_time})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">
                  Applies shift-based scheduling with automatic break and night premium calculations
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <div className="space-y-2">
            <Label>Justification * (Required)</Label>
            <Textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Explain why these changes are being made..."
              required
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={bulkUpdateMutation.isPending || selectedEmployees.length === 0}
            >
              {bulkUpdateMutation.isPending ? 'Updating...' : `Apply to ${selectedEmployees.length} Employee${selectedEmployees.length !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}