import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import {
  Users,
  Shield,
  Edit,
  Trash2,
  Search,
  Euro,
  FileText,
  Clock,
  AlertCircle,
  Check,
  X,
  Download,
  Settings,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { formatCurrency } from '@/components/payroll/IrishTaxCalculator';
import { ScrollArea } from '@/components/ui/scroll-area';
import BulkUpdatesDialog from '@/components/admin/BulkUpdatesDialog';
import TaxChangeHistoryDialog from '@/components/admin/TaxChangeHistoryDialog';
import BulkPRSIUpdateDialog from '@/components/admin/BulkPRSIUpdateDialog';
import MyFutureFundManagement from '@/components/admin/MyFutureFundManagement';
import ShiftPolicyManagement from '@/components/admin/ShiftPolicyManagement';
import CompanyBankHolidayPolicy from '@/components/admin/CompanyBankHolidayPolicy';
import OvertimePolicyManagement from '@/components/admin/OvertimePolicyManagement';
import SystemSettingsPanel from '@/components/admin/SystemSettingsPanel';
import { generateBankHolidayEntitlements } from '@/components/leave/BankHolidayEntitlementGenerator';

export default function AdminPanel() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('employees');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isBulkUpdatesDialogOpen, setIsBulkUpdatesDialogOpen] = useState(false);
  const [isBulkPRSIDialogOpen, setIsBulkPRSIDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [selectedEmployeeForHistory, setSelectedEmployeeForHistory] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('user');
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);

  // Fetch current user
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  // Fetch current employee to check admin status
  const { data: currentEmployees } = useQuery({
    queryKey: ['currentEmployee', user?.email],
    queryFn: () => base44.entities.Employee.filter({ created_by: user?.email }),
    enabled: !!user?.email,
  });

  const currentEmployee = currentEmployees?.[0];
  const isAdmin = currentEmployee?.is_admin || user?.role === 'admin';

  // Fetch all employees (admin only)
  const { data: employees, isLoading: employeesLoading, refetch: refetchEmployees } = useQuery({
    queryKey: ['allEmployees'],
    queryFn: () => base44.entities.Employee.list(),
    enabled: isAdmin,
  });

  // Fetch all users (admin only)
  const { data: allUsers, isLoading: usersLoading, refetch: refetchUsers } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list(),
    enabled: isAdmin,
  });

  // Check for duplicate employees
  const duplicateEmployees = React.useMemo(() => {
    if (!employees) return [];
    
    const emailMap = {};
    employees.forEach(emp => {
      const email = emp.created_by;
      if (!emailMap[email]) {
        emailMap[email] = [];
      }
      emailMap[email].push(emp);
    });
    
    return Object.entries(emailMap)
      .filter(([email, emps]) => emps.length > 1)
      .map(([email, emps]) => ({ email, employees: emps }));
  }, [employees]);

  // Fetch audit logs
  const { data: auditLogs, isLoading: logsLoading } = useQuery({
    queryKey: ['auditLogs'],
    queryFn: () => base44.entities.AuditLog.list('-created_date', 50),
    enabled: isAdmin,
  });

  // Fetch all payroll entries
  const { data: allPayrollEntries } = useQuery({
    queryKey: ['allPayrollEntries'],
    queryFn: () => base44.entities.PayrollEntry.list('-created_date', 100),
    enabled: isAdmin,
  });

  // Fetch shift policies for display
  const { data: shiftPolicies } = useQuery({
    queryKey: ['shiftPolicies'],
    queryFn: () => base44.entities.ShiftPolicy.list(),
    enabled: isAdmin,
    initialData: [],
  });

  // Invite user mutation
  const inviteUserMutation = useMutation({
    mutationFn: async ({ email, role }) => {
      return base44.users.inviteUser(email, role);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allUsers'] });
      toast.success('Invitation sent successfully');
      setIsInviteDialogOpen(false);
      setInviteEmail('');
      setInviteRole('user');
      refetchUsers();
    },
    onError: (error) => {
      toast.error(error?.message || 'Failed to invite user');
      console.error(error);
    },
  });

  // Update user role mutation
  const updateUserRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }) => {
      return base44.entities.User.update(userId, { role: newRole });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allUsers'] });
      toast.success('User role updated successfully');
      refetchUsers();
    },
    onError: (error) => {
      toast.error(error?.message || 'Failed to update user role');
      console.error(error);
    },
  });

  // Update employee mutation
  const updateEmployeeMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      // Convert percentage values to decimals
      const updateData = { ...data };
      if (updateData.prsi_rate !== undefined) {
        updateData.prsi_rate = updateData.prsi_rate / 100;
      }
      
      // Create tax profile if tax data changed
      if (data.annual_tax_credits || data.standard_rate_cut_off || data.prsi_rate) {
        const emp = employees.find(e => e.id === id);
        await base44.entities.TaxProfile.create({
          employee_id: id,
          effective_from: new Date().toISOString().split('T')[0],
          annual_tax_credits: data.annual_tax_credits || emp.annual_tax_credits,
          standard_rate_cut_off: data.standard_rate_cut_off || emp.standard_rate_cut_off,
          has_medical_card: emp.has_medical_card || false,
          tax_basis: emp.tax_basis || 'cumulative',
          prsi_rate: updateData.prsi_rate || emp.prsi_rate || 0.042,
          changed_by: user?.email,
          change_reason: 'Admin individual update',
        });
      }

      // Create audit log
      await base44.entities.AuditLog.create({
        employee_id: id,
        action: 'update',
        entity_type: 'Employee',
        entity_id: id,
        field_changed: 'multiple',
        old_value: JSON.stringify(selectedEmployee),
        new_value: JSON.stringify(updateData),
        performed_by: user?.email,
        details: 'Admin update',
      });
      
      return base44.entities.Employee.update(id, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allEmployees'] });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
      toast.success('Employee updated successfully');
      setIsEditDialogOpen(false);
      refetchEmployees();
    },
    onError: (error) => {
      toast.error('Failed to update employee');
      console.error(error);
    },
  });

  // Bulk update mutation
  const bulkUpdateMutation = useMutation({
    mutationFn: async (newRate) => {
      const updates = employees.map(emp => 
        base44.entities.Employee.update(emp.id, { base_hourly_rate: newRate })
      );
      
      await base44.entities.AuditLog.create({
        action: 'bulk_update',
        entity_type: 'Employee',
        field_changed: 'base_hourly_rate',
        new_value: newRate.toString(),
        performed_by: user?.email,
        details: `Bulk update: ${employees.length} employees`,
      });
      
      return Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allEmployees'] });
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
      toast.success('All employees updated successfully');
      setIsBulkDialogOpen(false);
      refetchEmployees();
    },
    onError: (error) => {
      toast.error('Failed to update employees');
      console.error(error);
    },
  });

  // Generate bank holiday entitlements for existing employees
  const generateEntitlementsMutation = useMutation({
    mutationFn: async () => {
      // Fetch all employees fresh
      const allEmployees = await base44.entities.Employee.list();
      console.log('Total employees:', allEmployees.length);
      
      // Fetch company policy
      const companyPolicies = await base44.entities.CompanyBankHolidayPolicy.filter({ is_active: true });
      const companyPolicy = companyPolicies?.[0];
      console.log('Company policy:', companyPolicy);

      if (!companyPolicy) {
        throw new Error('No active bank holiday policy found. Please configure one first.');
      }

      if (companyPolicy.policy_type !== 'ASSUME_WORKED') {
        throw new Error('Company policy must be ASSUME_WORKED to auto-generate entitlements');
      }

      let totalGenerated = 0;
      const currentYear = new Date().getFullYear();

      // Process all employees with complete profiles and contract start date
      const eligibleEmployees = allEmployees.filter(e => e.profile_complete && e.contract_start_date);
      console.log('Eligible employees:', eligibleEmployees.length, eligibleEmployees.map(e => ({
        name: e.full_name,
        id: e.id,
        contract_start: e.contract_start_date,
        profile_complete: e.profile_complete
      })));
      
      if (eligibleEmployees.length === 0) {
        throw new Error('No eligible employees found. Employees must have complete profiles and contract start dates.');
      }

      const details = [];
      for (const emp of eligibleEmployees) {
        const startYear = new Date(emp.contract_start_date).getFullYear();
        console.log(`Processing ${emp.full_name} (${emp.id}), contract start: ${emp.contract_start_date}, years: ${startYear} to ${currentYear}`);

        // Generate entitlements for all years from contract start to current year
        for (let year = startYear; year <= currentYear; year++) {
          console.log(`  Generating for year ${year}...`);
          const result = await generateBankHolidayEntitlements(emp.id, year, companyPolicy);
          console.log(`  Result for ${year}:`, result);
          if (result.success) {
            totalGenerated += result.created;
            details.push(`${emp.full_name} (${year}): ${result.created} entitlements`);
          }
        }
      }

      console.log('Generation details:', details);
      return { totalGenerated, employeesProcessed: eligibleEmployees.length, details };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bankHolidayEntitlements'] });
      queryClient.invalidateQueries({ queryKey: ['bankHolidayBalance'] });
      console.log('Success! Details:', data.details);
      toast.success(`Generated ${data.totalGenerated} entitlements for ${data.employeesProcessed} employees`);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to generate entitlements');
      console.error('Generation error:', error);
    },
  });

  const handleEdit = (employee) => {
    setSelectedEmployee(employee);
    setEditForm({
      full_name: employee.full_name || '',
      shift_policy_id: employee.shift_policy_id || '',
      base_hourly_rate: employee.base_hourly_rate || 15.93,
      annual_salary: employee.annual_salary || 0,
      weekly_contracted_hours: employee.weekly_contracted_hours || 37.5,
      annual_tax_credits: employee.annual_tax_credits || 3750,
      standard_rate_cut_off: employee.standard_rate_cut_off || 44000,
      prsi_rate: (employee.prsi_rate || 0.042) * 100,
      usc_band_1_rate: employee.usc_band_1_rate || 0.005,
      usc_band_2_rate: employee.usc_band_2_rate || 0.02,
      usc_band_3_rate: employee.usc_band_3_rate || 0.03,
      usc_band_4_rate: employee.usc_band_4_rate || 0.08,
      usc_band_1_threshold: employee.usc_band_1_threshold || 1001,
      usc_band_2_threshold: employee.usc_band_2_threshold || 2391.66,
      usc_band_3_threshold: employee.usc_band_3_threshold || 5837,
      is_admin: employee.is_admin || false,
    });
    setIsEditDialogOpen(true);
  };

  const handleViewHistory = (employee) => {
    setSelectedEmployeeForHistory(employee.id);
    setIsHistoryDialogOpen(true);
  };

  const filteredEmployees = employees?.filter(emp =>
    emp.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.created_by?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isLoading = userLoading || employeesLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-[600px]" />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-8">
        <div className="mx-auto max-w-6xl">
          <Card className="p-12 text-center">
            <Shield className="mx-auto h-16 w-16 text-red-400" />
            <h2 className="mt-4 text-xl font-semibold text-slate-900">
              Access Denied
            </h2>
            <p className="mt-2 text-slate-500">
              You do not have administrator privileges to access this panel.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl p-4 md:p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-slate-900 p-3">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Admin Panel</h1>
              <p className="text-slate-500">Manage employees, payroll, and system settings</p>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="mb-8 grid gap-6 md:grid-cols-4"
        >
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total Employees</p>
                  <p className="text-3xl font-bold text-slate-900">{employees?.length || 0}</p>
                </div>
                <div className="rounded-xl bg-blue-100 p-3">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Profiles Complete</p>
                  <p className="text-3xl font-bold text-emerald-600">
                    {employees?.filter(e => e.profile_complete).length || 0}
                  </p>
                </div>
                <div className="rounded-xl bg-emerald-100 p-3">
                  <Check className="h-6 w-6 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Payroll Entries</p>
                  <p className="text-3xl font-bold text-slate-900">{allPayrollEntries?.length || 0}</p>
                </div>
                <div className="rounded-xl bg-purple-100 p-3">
                  <FileText className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Audit Actions</p>
                  <p className="text-3xl font-bold text-slate-900">{auditLogs?.length || 0}</p>
                </div>
                <div className="rounded-xl bg-amber-100 p-3">
                  <Clock className="h-6 w-6 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="employees">Employees</TabsTrigger>
              <TabsTrigger value="shifts">Shift Policies</TabsTrigger>
              <TabsTrigger value="overtime">Overtime Policies</TabsTrigger>
              <TabsTrigger value="bankholiday">Bank Holidays</TabsTrigger>
              <TabsTrigger value="pension">My Future Fund</TabsTrigger>
              <TabsTrigger value="settings">System Settings</TabsTrigger>
              <TabsTrigger value="audit">Audit Log</TabsTrigger>
            </TabsList>

            <TabsContent value="employees">
              {duplicateEmployees.length > 0 && (
                <Alert className="mb-6 border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    <strong>⚠️ DUPLICATE EMPLOYEES DETECTED:</strong> {duplicateEmployees.length} user(s) have multiple employee records. This causes issues with bank holiday entitlements. Please contact support to merge duplicate records.
                    <ul className="mt-2 ml-4 list-disc">
                      {duplicateEmployees.map(({ email, employees: emps }) => (
                        <li key={email}>
                          <strong>{email}</strong>: {emps.length} records found (IDs: {emps.map(e => e.id.substring(0, 8)).join(', ')})
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* User Management Section */}
              <Card className="mb-6">
                <CardHeader>
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <CardTitle>User Management</CardTitle>
                      <CardDescription>Invite users and manage access roles</CardDescription>
                    </div>
                    <Button 
                      className="bg-blue-600 hover:bg-blue-700"
                      onClick={() => setIsInviteDialogOpen(true)}
                    >
                      <Users className="mr-2 h-4 w-4" />
                      Invite User
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Employee Record</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allUsers?.map((usr) => {
                        const employeeRecord = employees?.find(e => e.created_by === usr.email);
                        return (
                          <TableRow key={usr.id}>
                            <TableCell className="font-medium">{usr.full_name || '-'}</TableCell>
                            <TableCell className="text-slate-500">{usr.email}</TableCell>
                            <TableCell>
                              <Select
                                value={usr.role}
                                onValueChange={(newRole) => {
                                  if (confirm(`Change ${usr.full_name || usr.email}'s role to ${newRole}?`)) {
                                    updateUserRoleMutation.mutate({ userId: usr.id, newRole });
                                  }
                                }}
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="user">User</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              {employeeRecord ? (
                                <Badge className="bg-emerald-100 text-emerald-700">
                                  {employeeRecord.profile_complete ? 'Complete' : 'Incomplete'}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-slate-400">No record</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-slate-500 text-sm">
                              {format(new Date(usr.created_date), 'dd MMM yyyy')}
                            </TableCell>
                            <TableCell>
                              {usr.role === 'admin' && (
                                <Badge className="bg-slate-900 text-white text-xs">Admin</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <CardTitle>Employee Management</CardTitle>
                      <CardDescription>View and edit employee records</CardDescription>
                    </div>
                    <div className="flex gap-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          placeholder="Search employees..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-64 pl-10"
                        />
                      </div>
                      <Button 
                        className="bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => setIsBulkUpdatesDialogOpen(true)}
                      >
                        <Settings className="mr-2 h-4 w-4" />
                        Bulk Updates
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Contract</TableHead>
                        <TableHead>Shift</TableHead>
                        <TableHead>Hourly Rate</TableHead>
                        <TableHead>Weekly Hours</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEmployees?.map((emp) => {
                        const empShift = shiftPolicies?.find(s => s.id === emp.shift_policy_id);
                        return (
                          <TableRow key={emp.id}>
                            <TableCell className="font-medium">{emp.full_name || '-'}</TableCell>
                            <TableCell className="text-slate-500">{emp.created_by}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{emp.contract_type || 'N/A'}</Badge>
                            </TableCell>
                            <TableCell>
                              {empShift ? (
                                <div className="text-xs">
                                  <p className="font-medium text-slate-900">{empShift.shift_name}</p>
                                  <p className="text-slate-500">{empShift.start_time}-{empShift.end_time}</p>
                                </div>
                              ) : (
                                <span className="text-slate-400 text-xs">Standard</span>
                              )}
                            </TableCell>
                            <TableCell className="font-medium">{formatCurrency(emp.base_hourly_rate)}</TableCell>
                            <TableCell>{emp.weekly_contracted_hours}h</TableCell>
                            <TableCell>
                              <Badge className={
                                emp.profile_complete
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-amber-100 text-amber-700'
                              }>
                                {emp.profile_complete ? 'Complete' : 'Incomplete'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {emp.is_admin && (
                                <Badge className="bg-slate-900 text-white">Admin</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm" onClick={() => handleEdit(emp)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleViewHistory(emp)}>
                                  <Clock className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="payroll">
              <Card>
                <CardHeader>
                  <CardTitle>Payroll Overview</CardTitle>
                  <CardDescription>Recent payroll entries across all employees</CardDescription>
                </CardHeader>
                <CardContent>
                  {!allPayrollEntries || allPayrollEntries.length === 0 ? (
                    <div className="py-12 text-center">
                      <FileText className="mx-auto h-12 w-12 text-slate-300" />
                      <p className="mt-4 text-slate-500">No payroll entries yet</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Period</TableHead>
                          <TableHead>Gross Pay</TableHead>
                          <TableHead>Deductions</TableHead>
                          <TableHead>Net Pay</TableHead>
                          <TableHead>Created</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allPayrollEntries.slice(0, 20).map((entry) => {
                          const emp = employees?.find(e => e.id === entry.employee_id);
                          return (
                            <TableRow key={entry.id}>
                              <TableCell className="font-medium">
                                {emp?.full_name || 'Unknown'}
                              </TableCell>
                              <TableCell>
                                {entry.period_month}/{entry.period_year}
                              </TableCell>
                              <TableCell className="font-medium">
                                {formatCurrency(entry.gross_pay)}
                              </TableCell>
                              <TableCell className="text-red-600">
                                -{formatCurrency(entry.total_deductions)}
                              </TableCell>
                              <TableCell className="font-bold text-emerald-600">
                                {formatCurrency(entry.net_pay)}
                              </TableCell>
                              <TableCell className="text-slate-500">
                                {format(new Date(entry.created_date), 'dd MMM yyyy')}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="shifts">
              <ShiftPolicyManagement />
            </TabsContent>

            <TabsContent value="overtime">
              <OvertimePolicyManagement />
            </TabsContent>

            <TabsContent value="bankholiday">
              <div className="space-y-6">
                <Card className="border-blue-200 bg-blue-50">
                  <CardHeader>
                    <CardTitle className="text-blue-900">Generate Bank Holiday Entitlements</CardTitle>
                    <CardDescription className="text-blue-700">
                      Generate bank holiday entitlements for all existing employees who don't have them yet
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      onClick={() => generateEntitlementsMutation.mutate()}
                      disabled={generateEntitlementsMutation.isPending}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {generateEntitlementsMutation.isPending ? (
                        <>
                          <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <ChevronRight className="mr-2 h-4 w-4" />
                          Generate Entitlements for Existing Employees
                        </>
                      )}
                    </Button>
                    <p className="mt-3 text-sm text-blue-700">
                      This will generate entitlements from contract start date to current year for all employees with complete profiles.
                    </p>
                  </CardContent>
                </Card>
                <CompanyBankHolidayPolicy />
              </div>
            </TabsContent>

            <TabsContent value="pension">
              <MyFutureFundManagement />
            </TabsContent>

            <TabsContent value="settings">
              <SystemSettingsPanel />
            </TabsContent>

            <TabsContent value="audit">
              <Card>
                <CardHeader>
                  <CardTitle>Audit Log</CardTitle>
                  <CardDescription>Track all system changes (GDPR compliant)</CardDescription>
                </CardHeader>
                <CardContent>
                  {!auditLogs || auditLogs.length === 0 ? (
                    <div className="py-12 text-center">
                      <Clock className="mx-auto h-12 w-12 text-slate-300" />
                      <p className="mt-4 text-slate-500">No audit logs yet</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>Entity</TableHead>
                          <TableHead>Field</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Details</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auditLogs.map((log) => {
                          const emp = employees?.find(e => e.id === log.employee_id);
                          return (
                            <TableRow key={log.id}>
                              <TableCell className="text-slate-500">
                                {format(new Date(log.created_date), 'dd MMM yyyy HH:mm')}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={
                                  log.action === 'create'
                                    ? 'border-green-200 bg-green-50 text-green-700'
                                    : log.action === 'update'
                                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                                    : log.action === 'delete'
                                    ? 'border-red-200 bg-red-50 text-red-700'
                                    : 'border-slate-200 bg-slate-50 text-slate-700'
                                }>
                                  {log.action}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-medium">{log.entity_type}</TableCell>
                              <TableCell>{log.field_changed || '-'}</TableCell>
                              <TableCell>
                                <div>
                                  <p className="font-medium text-slate-900">{emp?.full_name || 'Unknown'}</p>
                                  <p className="text-xs text-slate-500">{log.performed_by}</p>
                                </div>
                              </TableCell>
                              <TableCell className="max-w-xs truncate text-slate-500">
                                {log.details || '-'}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader className="px-6 pt-6">
              <DialogTitle>Edit Employee</DialogTitle>
            </DialogHeader>
            <ScrollArea className="flex-1 h-[500px]">
              <div className="px-6">
            <form onSubmit={(e) => {
              e.preventDefault();
              updateEmployeeMutation.mutate({ id: selectedEmployee?.id, data: editForm });
            }} className="space-y-4 pb-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input
                  value={editForm.full_name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, full_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Shift Policy</Label>
                <Select
                  value={editForm.shift_policy_id}
                  onValueChange={(v) => setEditForm(prev => ({ ...prev, shift_policy_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Standard Schedule" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Standard Schedule</SelectItem>
                    {shiftPolicies?.map((shift) => (
                      <SelectItem key={shift.id} value={shift.id}>
                        {shift.shift_name} ({shift.start_time}-{shift.end_time})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Hourly Rate (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editForm.base_hourly_rate}
                    onChange={(e) => setEditForm(prev => ({ ...prev, base_hourly_rate: parseFloat(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Annual Salary (€)</Label>
                  <Input
                    type="number"
                    step="1"
                    value={editForm.annual_salary}
                    onChange={(e) => setEditForm(prev => ({ ...prev, annual_salary: parseFloat(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Weekly Hours</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={editForm.weekly_contracted_hours}
                    onChange={(e) => setEditForm(prev => ({ ...prev, weekly_contracted_hours: parseFloat(e.target.value) }))}
                  />
                </div>
              </div>
              
              <h3 className="font-semibold text-sm mt-4">Tax Information</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tax Credits (€)</Label>
                  <Input
                    type="number"
                    value={editForm.annual_tax_credits}
                    onChange={(e) => setEditForm(prev => ({ ...prev, annual_tax_credits: parseFloat(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rate Cut-Off (€)</Label>
                  <Input
                    type="number"
                    value={editForm.standard_rate_cut_off}
                    onChange={(e) => setEditForm(prev => ({ ...prev, standard_rate_cut_off: parseFloat(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>PRSI Rate (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={editForm.prsi_rate}
                    onChange={(e) => setEditForm(prev => ({ ...prev, prsi_rate: parseFloat(e.target.value) }))}
                  />
                </div>
              </div>
              
              <h3 className="font-semibold text-sm mt-4">USC Rates (%)</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Band 1 Rate (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={(editForm.usc_band_1_rate || 0.005) * 100}
                    onChange={(e) => setEditForm(prev => ({ ...prev, usc_band_1_rate: parseFloat(e.target.value) / 100 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Band 2 Rate (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={(editForm.usc_band_2_rate || 0.02) * 100}
                    onChange={(e) => setEditForm(prev => ({ ...prev, usc_band_2_rate: parseFloat(e.target.value) / 100 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Band 3 Rate (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={(editForm.usc_band_3_rate || 0.03) * 100}
                    onChange={(e) => setEditForm(prev => ({ ...prev, usc_band_3_rate: parseFloat(e.target.value) / 100 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Band 4 Rate (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={(editForm.usc_band_4_rate || 0.08) * 100}
                    onChange={(e) => setEditForm(prev => ({ ...prev, usc_band_4_rate: parseFloat(e.target.value) / 100 }))}
                  />
                </div>
              </div>
              
              <h3 className="font-semibold text-sm mt-4">USC Thresholds (€)</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Band 1 Threshold (€)</Label>
                  <Input
                    type="number"
                    step="1"
                    value={editForm.usc_band_1_threshold || 12012}
                    onChange={(e) => setEditForm(prev => ({ ...prev, usc_band_1_threshold: parseFloat(e.target.value) }))}
                  />
                  <p className="text-xs text-slate-500">Income up to this amount</p>
                </div>
                <div className="space-y-2">
                  <Label>Band 2 Threshold (€)</Label>
                  <Input
                    type="number"
                    step="1"
                    value={editForm.usc_band_2_threshold || 28700}
                    onChange={(e) => setEditForm(prev => ({ ...prev, usc_band_2_threshold: parseFloat(e.target.value) }))}
                  />
                  <p className="text-xs text-slate-500">Income up to this amount</p>
                </div>
                <div className="space-y-2">
                  <Label>Band 3 Threshold (€)</Label>
                  <Input
                    type="number"
                    step="1"
                    value={editForm.usc_band_3_threshold || 70044}
                    onChange={(e) => setEditForm(prev => ({ ...prev, usc_band_3_threshold: parseFloat(e.target.value) }))}
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
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_admin"
                  checked={editForm.is_admin}
                  onChange={(e) => setEditForm(prev => ({ ...prev, is_admin: e.target.checked }))}
                  className="h-4 w-4"
                />
                <Label htmlFor="is_admin" className="cursor-pointer">Admin privileges</Label>
              </div>
            </form>
              </div>
            </ScrollArea>
            <DialogFooter className="px-6 pb-6 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                type="button" 
                disabled={updateEmployeeMutation.isPending}
                onClick={() => {
                  const form = document.querySelector('form');
                  if (form) {
                    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                  }
                }}
              >
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <BulkUpdatesDialog
          open={isBulkUpdatesDialogOpen}
          onOpenChange={setIsBulkUpdatesDialogOpen}
        />

        <BulkPRSIUpdateDialog
          open={isBulkPRSIDialogOpen}
          onOpenChange={setIsBulkPRSIDialogOpen}
        />

        <TaxChangeHistoryDialog
          open={isHistoryDialogOpen}
          onOpenChange={setIsHistoryDialogOpen}
          employeeId={selectedEmployeeForHistory}
        />

        {/* Invite User Dialog */}
        <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Invite New User</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!inviteEmail) {
                toast.error('Please enter an email address');
                return;
              }
              inviteUserMutation.mutate({ email: inviteEmail, role: inviteRole });
            }} className="space-y-4">
              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input
                  type="email"
                  placeholder="user@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">
                  {inviteRole === 'admin' 
                    ? 'Full access to admin panel and all features' 
                    : 'Access to personal payroll and time tracking only'}
                </p>
              </div>
              <Alert className="border-blue-200 bg-blue-50">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-xs text-blue-800">
                  User will receive an invitation email to set up their account.
                </AlertDescription>
              </Alert>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsInviteDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={inviteUserMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
                  {inviteUserMutation.isPending ? 'Sending...' : 'Send Invitation'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}