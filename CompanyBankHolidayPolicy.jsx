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
import { Calendar, AlertCircle, CheckCircle, Shield, Edit, History } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { generateBankHolidayEntitlements } from '@/components/leave/BankHolidayEntitlementGenerator';

export default function CompanyBankHolidayPolicy() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    policy_type: 'ASSUME_WORKED',
    default_daily_hours: 7.5,
    overtime_multiplier: 2.0,
    effective_from: new Date().toISOString().split('T')[0],
    description: '',
  });

  // Fetch current user
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  // Fetch active policy
  const { data: policies, isLoading } = useQuery({
    queryKey: ['companyBankHolidayPolicy'],
    queryFn: () => base44.entities.CompanyBankHolidayPolicy.filter({ is_active: true }),
    initialData: [],
  });

  const activePolicy = policies?.[0];

  // Fetch all policies for history
  const { data: allPolicies } = useQuery({
    queryKey: ['allCompanyBankHolidayPolicies'],
    queryFn: () => base44.entities.CompanyBankHolidayPolicy.list('-created_date'),
    initialData: [],
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data) => {
      // Deactivate current policy if exists
      if (activePolicy?.id) {
        await base44.entities.CompanyBankHolidayPolicy.update(activePolicy.id, { is_active: false });
      }

      // Create new policy
      const newPolicy = await base44.entities.CompanyBankHolidayPolicy.create({
        ...data,
        is_active: true,
      });

      // Fetch current user employee record
      const currentEmployees = await base44.entities.Employee.filter({ created_by: user?.email });
      const currentEmployee = currentEmployees?.[0];

      // Log policy change
      await base44.entities.AuditLog.create({
        action: 'create',
        entity_type: 'CompanyBankHolidayPolicy',
        entity_id: newPolicy.id,
        field_changed: 'policy_type',
        old_value: activePolicy?.policy_type || 'none',
        new_value: data.policy_type,
        performed_by: user?.email,
        details: `${currentEmployee?.full_name || user?.email}: Company Bank Holiday Policy changed to ${data.policy_type}. Reason: ${data.description || 'No reason provided'}`,
      });

      // If policy is ASSUME_WORKED, generate entitlements for all employees
      if (data.policy_type === 'ASSUME_WORKED') {
        const allEmployees = await base44.entities.Employee.filter({ employment_status: 'active' });
        const currentYear = new Date().getFullYear();
        
        // Generate for current year and previous year (if we're in Q1)
        const yearsToGenerate = [currentYear];
        if (new Date().getMonth() < 3) { // January-March
          yearsToGenerate.push(currentYear - 1);
        }

        for (const employee of allEmployees) {
          for (const year of yearsToGenerate) {
            try {
              await generateBankHolidayEntitlements(employee.id, year, newPolicy);
            } catch (error) {
              console.error(`Failed to generate entitlements for employee ${employee.id}, year ${year}:`, error);
            }
          }
        }
      }

      return newPolicy;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companyBankHolidayPolicy'] });
      queryClient.invalidateQueries({ queryKey: ['allCompanyBankHolidayPolicies'] });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
      toast.success('Company Bank Holiday Policy updated');
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(error?.message || 'Failed to update policy');
    },
  });

  const resetForm = () => {
    setFormData({
      policy_type: 'ASSUME_WORKED',
      default_daily_hours: 7.5,
      overtime_multiplier: 2.0,
      effective_from: new Date().toISOString().split('T')[0],
      description: '',
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  const getPolicyDescription = (policyType) => {
    if (policyType === 'ASSUME_WORKED') {
      return 'All employees are assumed to have worked all Irish Bank Holidays and receive automatic entitlements. Individual overrides can be set per employee.';
    }
    return 'Only employees who explicitly worked on Bank Holidays receive entitlements. Must be manually recorded per employee.';
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Current Policy */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                Company Bank Holiday Policy
              </CardTitle>
              <CardDescription>
                Organisation of Working Time Act 1997 - Company-wide bank holiday entitlement policy
              </CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Edit className="mr-2 h-4 w-4" />
                  Update Policy
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Update Company Bank Holiday Policy</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <Alert className="border-amber-200 bg-amber-50">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-800">
                      <strong>Important:</strong> Changing the policy will deactivate the current policy and create a new one. 
                      This action is fully audited and cannot be undone.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Policy Type *</Label>
                      <Select
                        value={formData.policy_type}
                        onValueChange={(v) => setFormData({ ...formData, policy_type: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ASSUME_WORKED">Assume Worked (Default)</SelectItem>
                          <SelectItem value="WORKED_ONLY">Worked Only</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-slate-500">
                        {getPolicyDescription(formData.policy_type)}
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Default Daily Hours *</Label>
                        <Input
                          type="number"
                          step="0.5"
                          min="1"
                          max="12"
                          value={formData.default_daily_hours}
                          onChange={(e) => setFormData({ ...formData, default_daily_hours: parseFloat(e.target.value) })}
                          required
                        />
                        <p className="text-xs text-slate-500">Hours granted per bank holiday (typically 7.5)</p>
                      </div>

                      <div className="space-y-2">
                        <Label>Overtime Multiplier</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={formData.overtime_multiplier}
                          onChange={(e) => setFormData({ ...formData, overtime_multiplier: parseFloat(e.target.value) })}
                          disabled
                        />
                        <p className="text-xs text-slate-500">Fixed at 2.0x for bank holidays</p>
                      </div>
                    </div>

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
                      <Label>Reason for Change * (Required for audit)</Label>
                      <Textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Explain why this policy change is being made..."
                        required
                        rows={3}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={saveMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
                      {saveMutation.isPending ? 'Updating...' : 'Update Policy'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>

        <CardContent>
          {!activePolicy ? (
            <Alert className="border-amber-200 bg-amber-50">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                No active bank holiday policy configured. Please create one to manage bank holiday entitlements.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-6">
              <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-4">
                    <div>
                      <Badge className="mb-2 bg-blue-600 text-white">
                        {activePolicy.policy_type === 'ASSUME_WORKED' ? 'Assume Worked' : 'Worked Only'}
                      </Badge>
                      <p className="text-sm text-blue-800">
                        {getPolicyDescription(activePolicy.policy_type)}
                      </p>
                    </div>

                    <div className="grid gap-4 text-sm sm:grid-cols-3">
                      <div>
                        <p className="text-blue-600">Default Daily Hours</p>
                        <p className="font-semibold text-blue-900">{activePolicy.default_daily_hours}h</p>
                      </div>
                      <div>
                        <p className="text-blue-600">Overtime Multiplier</p>
                        <p className="font-semibold text-blue-900">{activePolicy.overtime_multiplier}x</p>
                      </div>
                      <div>
                        <p className="text-blue-600">Effective From</p>
                        <p className="font-semibold text-blue-900">
                          {format(new Date(activePolicy.effective_from), 'dd MMM yyyy')}
                        </p>
                      </div>
                    </div>

                    {activePolicy.description && (
                      <div className="rounded-lg bg-white p-3">
                        <p className="text-xs text-slate-500">Reason for current policy:</p>
                        <p className="text-sm text-slate-700">{activePolicy.description}</p>
                      </div>
                    )}
                  </div>

                  <CheckCircle className="h-6 w-6 text-emerald-600" />
                </div>
              </div>

              <Alert className="border-blue-200 bg-blue-50">
                <Shield className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  <strong>Compliance Note:</strong> This policy applies company-wide. Individual employee overrides 
                  can be set for specific bank holidays. All changes are logged for audit purposes under the 
                  Organisation of Working Time Act 1997.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Policy History */}
      {allPolicies.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-5 w-5 text-slate-600" />
              Policy History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {allPolicies.map((policy, index) => (
                <div
                  key={policy.id}
                  className={`rounded-lg border p-4 ${
                    policy.is_active ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={policy.is_active ? 'default' : 'secondary'}>
                          {policy.policy_type}
                        </Badge>
                        {policy.is_active && (
                          <Badge className="bg-emerald-600 text-white">Current</Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-700">
                        <strong>Effective:</strong> {format(new Date(policy.effective_from), 'dd MMM yyyy')}
                      </p>
                      <p className="text-sm text-slate-600">
                        {policy.default_daily_hours}h per day • {policy.overtime_multiplier}x overtime
                      </p>
                      {policy.description && (
                        <p className="text-xs text-slate-500 italic">{policy.description}</p>
                      )}
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