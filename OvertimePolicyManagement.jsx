import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Clock, AlertCircle, CheckCircle, Edit, History, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';

export default function OvertimePolicyManagement() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    policy_name: '',
    weekday_multiplier: 1.5,
    saturday_multiplier: 1.5,
    sunday_multiplier: 2.0,
    bank_holiday_multiplier: 2.0,
    applies_to: 'ALL_EMPLOYEES',
    employee_ids: [],
    effective_from: new Date().toISOString().split('T')[0],
    description: '',
  });
  const [selectedEmployees, setSelectedEmployees] = useState([]);

  // Fetch current user
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  // Fetch all employees
  const { data: allEmployees } = useQuery({
    queryKey: ['allEmployees'],
    queryFn: () => base44.entities.Employee.list(),
    initialData: [],
  });

  // Fetch active policies
  const { data: policies, isLoading } = useQuery({
    queryKey: ['overtimePolicies'],
    queryFn: () => base44.entities.OvertimePolicy.filter({ is_active: true }),
    initialData: [],
  });

  // Fetch all policies for history
  const { data: allPolicies } = useQuery({
    queryKey: ['allOvertimePolicies'],
    queryFn: () => base44.entities.OvertimePolicy.list('-created_date'),
    initialData: [],
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const newPolicy = await base44.entities.OvertimePolicy.create({
        ...data,
        employee_ids: data.applies_to === 'SPECIFIC_EMPLOYEES' ? selectedEmployees : [],
        is_active: true,
      });

      // Fetch current user employee record
      const currentEmployees = await base44.entities.Employee.filter({ created_by: user?.email });
      const currentEmployee = currentEmployees?.[0];

      // Log policy change
      await base44.entities.AuditLog.create({
        action: 'create',
        entity_type: 'OvertimePolicy',
        entity_id: newPolicy.id,
        field_changed: 'overtime_policy',
        new_value: JSON.stringify({
          weekday: data.weekday_multiplier,
          saturday: data.saturday_multiplier,
          sunday: data.sunday_multiplier,
          bank_holiday: data.bank_holiday_multiplier,
          applies_to: data.applies_to,
        }),
        performed_by: user?.email,
        details: `${currentEmployee?.full_name || user?.email}: Overtime Policy "${data.policy_name}" created. Applies to: ${data.applies_to}. Reason: ${data.description || 'No reason provided'}`,
      });

      return newPolicy;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overtimePolicies'] });
      queryClient.invalidateQueries({ queryKey: ['allOvertimePolicies'] });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
      toast.success('Overtime Policy created successfully');
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(error?.message || 'Failed to create policy');
    },
  });

  // Deactivate mutation
  const deactivateMutation = useMutation({
    mutationFn: async (policyId) => {
      await base44.entities.OvertimePolicy.update(policyId, { is_active: false });
      
      // Fetch current user employee record
      const currentEmployees = await base44.entities.Employee.filter({ created_by: user?.email });
      const currentEmployee = currentEmployees?.[0];

      await base44.entities.AuditLog.create({
        action: 'update',
        entity_type: 'OvertimePolicy',
        entity_id: policyId,
        field_changed: 'is_active',
        old_value: 'true',
        new_value: 'false',
        performed_by: user?.email,
        details: `${currentEmployee?.full_name || user?.email}: Overtime Policy deactivated`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overtimePolicies'] });
      toast.success('Policy deactivated');
    },
  });

  const resetForm = () => {
    setFormData({
      policy_name: '',
      weekday_multiplier: 1.5,
      saturday_multiplier: 1.5,
      sunday_multiplier: 2.0,
      bank_holiday_multiplier: 2.0,
      applies_to: 'ALL_EMPLOYEES',
      employee_ids: [],
      effective_from: new Date().toISOString().split('T')[0],
      description: '',
    });
    setSelectedEmployees([]);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.applies_to === 'SPECIFIC_EMPLOYEES' && selectedEmployees.length === 0) {
      toast.error('Please select at least one employee');
      return;
    }
    saveMutation.mutate(formData);
  };

  const toggleEmployee = (empId) => {
    setSelectedEmployees(prev => 
      prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]
    );
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-purple-600" />
                Overtime Policies
              </CardTitle>
              <CardDescription>
                Manage overtime rate multipliers for different day types
              </CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-purple-600 hover:bg-purple-700">
                  <Edit className="mr-2 h-4 w-4" />
                  Create Policy
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Overtime Policy</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Policy Name *</Label>
                      <Input
                        value={formData.policy_name}
                        onChange={(e) => setFormData({ ...formData, policy_name: e.target.value })}
                        placeholder="e.g., Standard Overtime Policy 2026"
                        required
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Weekday (Mon-Fri) *</Label>
                        <Input
                          type="number"
                          step="0.1"
                          min="1"
                          max="5"
                          value={formData.weekday_multiplier}
                          onChange={(e) => setFormData({ ...formData, weekday_multiplier: parseFloat(e.target.value) })}
                          required
                        />
                        <p className="text-xs text-slate-500">Multiplier for weekday overtime</p>
                      </div>

                      <div className="space-y-2">
                        <Label>Saturday *</Label>
                        <Input
                          type="number"
                          step="0.1"
                          min="1"
                          max="5"
                          value={formData.saturday_multiplier}
                          onChange={(e) => setFormData({ ...formData, saturday_multiplier: parseFloat(e.target.value) })}
                          required
                        />
                        <p className="text-xs text-slate-500">Multiplier for Saturday work</p>
                      </div>

                      <div className="space-y-2">
                        <Label>Sunday *</Label>
                        <Input
                          type="number"
                          step="0.1"
                          min="1"
                          max="5"
                          value={formData.sunday_multiplier}
                          onChange={(e) => setFormData({ ...formData, sunday_multiplier: parseFloat(e.target.value) })}
                          required
                        />
                        <p className="text-xs text-slate-500">Multiplier for Sunday work</p>
                      </div>

                      <div className="space-y-2">
                        <Label>Bank Holidays *</Label>
                        <Input
                          type="number"
                          step="0.1"
                          min="1"
                          max="5"
                          value={formData.bank_holiday_multiplier}
                          onChange={(e) => setFormData({ ...formData, bank_holiday_multiplier: parseFloat(e.target.value) })}
                          required
                        />
                        <p className="text-xs text-slate-500">Multiplier for bank holidays</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Applies To *</Label>
                      <Select
                        value={formData.applies_to}
                        onValueChange={(v) => {
                          setFormData({ ...formData, applies_to: v });
                          if (v === 'ALL_EMPLOYEES') setSelectedEmployees([]);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL_EMPLOYEES">All Employees</SelectItem>
                          <SelectItem value="SPECIFIC_EMPLOYEES">Specific Employees</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {formData.applies_to === 'SPECIFIC_EMPLOYEES' && (
                      <div className="space-y-2">
                        <Label>Select Employees *</Label>
                        <div className="max-h-48 overflow-y-auto rounded-lg border p-4 space-y-2">
                          {allEmployees.map(emp => (
                            <div key={emp.id} className="flex items-center space-x-3">
                              <Checkbox
                                checked={selectedEmployees.includes(emp.id)}
                                onCheckedChange={() => toggleEmployee(emp.id)}
                              />
                              <Label className="cursor-pointer font-normal">
                                {emp.full_name} ({emp.created_by})
                              </Label>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-slate-500">
                          {selectedEmployees.length} employee(s) selected
                        </p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Effective From *</Label>
                      <Input
                        type="date"
                        value={formData.effective_from}
                        onChange={(e) => setFormData({ ...formData, effective_from: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Description/Reason *</Label>
                      <Textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Explain the purpose of this policy..."
                        required
                        rows={3}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={saveMutation.isPending} className="bg-purple-600 hover:bg-purple-700">
                      {saveMutation.isPending ? 'Creating...' : 'Create Policy'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>

        <CardContent>
          {policies.length === 0 ? (
            <Alert className="border-amber-200 bg-amber-50">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                No active overtime policies. Create one to define overtime rate multipliers.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              {policies.map((policy) => {
                const appliedEmployees = policy.applies_to === 'ALL_EMPLOYEES' 
                  ? allEmployees 
                  : allEmployees.filter(e => policy.employee_ids?.includes(e.id));

                return (
                  <div
                    key={policy.id}
                    className="rounded-lg border-2 border-purple-200 bg-purple-50 p-6"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-purple-900">{policy.policy_name}</h3>
                          <Badge className="bg-purple-600 text-white">Active</Badge>
                        </div>
                        <p className="text-sm text-purple-700">{policy.description}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deactivateMutation.mutate(policy.id)}
                        className="text-purple-600 hover:text-purple-700"
                      >
                        Deactivate
                      </Button>
                    </div>

                    <div className="grid gap-4 text-sm sm:grid-cols-4 mb-4">
                      <div className="rounded-lg bg-white p-3">
                        <p className="text-purple-600 text-xs">Weekday</p>
                        <p className="font-semibold text-purple-900">{policy.weekday_multiplier}x</p>
                      </div>
                      <div className="rounded-lg bg-white p-3">
                        <p className="text-purple-600 text-xs">Saturday</p>
                        <p className="font-semibold text-purple-900">{policy.saturday_multiplier}x</p>
                      </div>
                      <div className="rounded-lg bg-white p-3">
                        <p className="text-purple-600 text-xs">Sunday</p>
                        <p className="font-semibold text-purple-900">{policy.sunday_multiplier}x</p>
                      </div>
                      <div className="rounded-lg bg-white p-3">
                        <p className="text-purple-600 text-xs">Bank Holiday</p>
                        <p className="font-semibold text-purple-900">{policy.bank_holiday_multiplier}x</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-purple-600" />
                      <span className="text-purple-700">
                        Applies to: <strong>
                          {policy.applies_to === 'ALL_EMPLOYEES' 
                            ? `All Employees (${allEmployees.length})`
                            : `${appliedEmployees.length} Selected Employee(s)`}
                        </strong>
                      </span>
                    </div>

                    <div className="mt-2 text-xs text-purple-600">
                      Effective from: {format(new Date(policy.effective_from), 'dd MMM yyyy')}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Policy History */}
      {allPolicies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-5 w-5 text-slate-600" />
              Policy History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {allPolicies.map((policy) => (
                <div
                  key={policy.id}
                  className={`rounded-lg border p-4 ${
                    policy.is_active ? 'border-purple-200 bg-purple-50' : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{policy.policy_name}</span>
                        {policy.is_active && (
                          <Badge className="bg-purple-600 text-white">Active</Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-600">
                        {policy.weekday_multiplier}x / {policy.saturday_multiplier}x / {policy.sunday_multiplier}x / {policy.bank_holiday_multiplier}x
                      </p>
                      <p className="text-xs text-slate-500">
                        {policy.applies_to === 'ALL_EMPLOYEES' ? 'All Employees' : 'Specific Employees'}
                      </p>
                    </div>
                    <p className="text-xs text-slate-400">
                      {format(new Date(policy.created_date), 'dd MMM yyyy HH:mm')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}