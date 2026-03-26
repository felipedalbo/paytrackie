import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, addDays, isPast } from 'date-fns';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { UserPlus, Trash2, AlertTriangle, CheckCircle, Clock, Info } from 'lucide-react';
import { toast } from 'sonner';

export default function TrialUserManagement() {
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedTrial, setSelectedTrial] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    trial_hours: 168, // 7 days default
    notes: '',
  });

  // Fetch all trial users
  const { data: trialUsers, isLoading } = useQuery({
    queryKey: ['trialUsers'],
    queryFn: () => base44.entities.TrialUser.list('-created_date'),
  });

  // Create trial user mutation
  const createTrialMutation = useMutation({
    mutationFn: async (data) => {
      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + data.trial_hours * 60 * 60 * 1000);

      // Create trial user record
      const trialUser = await base44.entities.TrialUser.create({
        email: data.email,
        trial_start_date: format(startDate, 'yyyy-MM-dd HH:mm:ss'),
        trial_end_date: format(endDate, 'yyyy-MM-dd HH:mm:ss'),
        trial_days: Math.round(data.trial_hours / 24 * 10) / 10,
        is_active: true,
        converted_to_paid: false,
        notes: data.notes,
      });

      // Invite user to the app
      await base44.users.inviteUser(data.email, 'user');

      return trialUser;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trialUsers'] });
      setShowCreateDialog(false);
      setFormData({ email: '', trial_hours: 168, notes: '' });
      toast.success('Trial user created and invitation sent');
    },
    onError: (error) => {
      toast.error(error?.message || 'Failed to create trial user');
    },
  });

  // Delete trial data mutation
  const deleteTrialDataMutation = useMutation({
    mutationFn: async (trialEmail) => {
      // Find all employees created by this trial user
      const employees = await base44.entities.Employee.filter({
        created_by: trialEmail,
      });

      // Delete all related data for each employee
      for (const employee of employees) {
        // Delete payroll entries
        const payrolls = await base44.entities.PayrollEntry.filter({
          employee_id: employee.id,
        });
        for (const p of payrolls) {
          await base44.entities.PayrollEntry.delete(p.id);
        }

        // Delete overtime records
        const overtime = await base44.entities.OvertimeRecord.filter({
          employee_id: employee.id,
        });
        for (const o of overtime) {
          await base44.entities.OvertimeRecord.delete(o.id);
        }

        // Delete leave records
        const leaves = await base44.entities.LeaveRecord.filter({
          employee_id: employee.id,
        });
        for (const l of leaves) {
          await base44.entities.LeaveRecord.delete(l.id);
        }

        // Delete sick leave
        const sickLeaves = await base44.entities.SickLeaveRecord.filter({
          employee_id: employee.id,
        });
        for (const s of sickLeaves) {
          await base44.entities.SickLeaveRecord.delete(s.id);
        }

        // Delete weekend rosters
        const weekends = await base44.entities.WeekendRoster.filter({
          employee_id: employee.id,
        });
        for (const w of weekends) {
          await base44.entities.WeekendRoster.delete(w.id);
        }

        // Delete absence records
        const absences = await base44.entities.AbsenceLateness.filter({
          employee_id: employee.id,
        });
        for (const a of absences) {
          await base44.entities.AbsenceLateness.delete(a.id);
        }

        // Delete bank holidays
        const bankHolidays = await base44.entities.BankHoliday.filter({
          employee_id: employee.id,
        });
        for (const b of bankHolidays) {
          await base44.entities.BankHoliday.delete(b.id);
        }

        // Delete other earnings/deductions
        const earnings = await base44.entities.OtherEarnings.filter({
          employee_id: employee.id,
        });
        for (const e of earnings) {
          await base44.entities.OtherEarnings.delete(e.id);
        }

        const deductions = await base44.entities.OtherDeduction.filter({
          employee_id: employee.id,
        });
        for (const d of deductions) {
          await base44.entities.OtherDeduction.delete(d.id);
        }

        // Delete employee
        await base44.entities.Employee.delete(employee.id);
      }

      // Mark trial as inactive
      const trials = await base44.entities.TrialUser.filter({
        email: trialEmail,
      });
      if (trials.length > 0) {
        await base44.entities.TrialUser.update(trials[0].id, {
          is_active: false,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trialUsers'] });
      setShowDeleteDialog(false);
      setSelectedTrial(null);
      toast.success('Trial data deleted successfully');
    },
    onError: (error) => {
      toast.error(error?.message || 'Failed to delete trial data');
    },
  });

  // Convert to paid mutation
  const convertToPaidMutation = useMutation({
    mutationFn: async (trialId) => {
      return base44.entities.TrialUser.update(trialId, {
        converted_to_paid: true,
        is_active: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trialUsers'] });
      toast.success('User converted to paid subscription');
    },
  });

  // Cancel trial mutation
  const cancelTrialMutation = useMutation({
    mutationFn: async (trialId) => {
      return base44.entities.TrialUser.update(trialId, {
        is_active: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trialUsers'] });
      toast.success('Trial cancelled');
    },
  });

  const handleCreate = () => {
    if (!formData.email || formData.trial_hours <= 0) {
      toast.error('Email and valid trial duration are required');
      return;
    }
    createTrialMutation.mutate(formData);
  };

  const activeTrials = trialUsers?.filter(
    (t) => t.is_active && !isPast(new Date(t.trial_end_date))
  );
  const expiredTrials = trialUsers?.filter(
    (t) => t.is_active && isPast(new Date(t.trial_end_date))
  );
  const convertedTrials = trialUsers?.filter((t) => t.converted_to_paid);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-blue-600" />
                Trial User Management
              </CardTitle>
              <CardDescription>
                Create temporary trial accounts with automatic expiration
              </CardDescription>
            </div>
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Create Trial User
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Alert className="mb-6 border-blue-200 bg-blue-50">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              Trial users can test the system for a limited time. After expiration, their data
              must be manually deleted to prevent mixing with real user data.
            </AlertDescription>
          </Alert>

          {isLoading ? (
            <div className="py-8 text-center text-slate-500">Loading...</div>
          ) : (
            <div className="space-y-8">
              {/* Active Trials */}
              {activeTrials && activeTrials.length > 0 && (
                <div>
                  <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-emerald-700">
                    <CheckCircle className="h-5 w-5" />
                    Active Trials ({activeTrials.length})
                  </h3>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead>Start Date</TableHead>
                          <TableHead>End Date</TableHead>
                          <TableHead>Days Left</TableHead>
                          <TableHead>Notes</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activeTrials.map((trial) => {
                          const timeLeft = new Date(trial.trial_end_date) - new Date();
                          const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
                          const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                          const daysLeft = Math.floor(hoursLeft / 24);
                          
                          return (
                            <TableRow key={trial.id}>
                              <TableCell className="font-medium">{trial.email}</TableCell>
                              <TableCell>
                                {format(new Date(trial.trial_start_date), 'dd MMM yyyy HH:mm')}
                              </TableCell>
                              <TableCell>
                                {format(new Date(trial.trial_end_date), 'dd MMM yyyy HH:mm')}
                              </TableCell>
                              <TableCell>
                                <Badge className="bg-emerald-100 text-emerald-700">
                                  {daysLeft > 0 ? `${daysLeft}d ` : ''}{hoursLeft % 24}h {minutesLeft}m
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-slate-600">
                                {trial.notes || '-'}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => convertToPaidMutation.mutate(trial.id)}
                                  >
                                    Convert to Paid
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => cancelTrialMutation.mutate(trial.id)}
                                  >
                                    Cancel Trial
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Expired Trials */}
              {expiredTrials && expiredTrials.length > 0 && (
                <div>
                  <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-red-700">
                    <AlertTriangle className="h-5 w-5" />
                    Expired Trials ({expiredTrials.length})
                  </h3>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead>Expired On</TableHead>
                          <TableHead>Notes</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {expiredTrials.map((trial) => (
                          <TableRow key={trial.id} className="bg-red-50">
                            <TableCell className="font-medium">{trial.email}</TableCell>
                            <TableCell>
                              {format(new Date(trial.trial_end_date), 'dd MMM yyyy HH:mm')}
                            </TableCell>
                            <TableCell className="text-sm text-slate-600">
                              {trial.notes || '-'}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => convertToPaidMutation.mutate(trial.id)}
                                >
                                  Convert to Paid
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => {
                                    setSelectedTrial(trial);
                                    setShowDeleteDialog(true);
                                  }}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete Data
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Converted Trials */}
              {convertedTrials && convertedTrials.length > 0 && (
                <div>
                  <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-blue-700">
                    <CheckCircle className="h-5 w-5" />
                    Converted to Paid ({convertedTrials.length})
                  </h3>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead>Trial Period</TableHead>
                          <TableHead>Converted On</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {convertedTrials.map((trial) => (
                          <TableRow key={trial.id}>
                            <TableCell className="font-medium">{trial.email}</TableCell>
                            <TableCell>
                              {format(new Date(trial.trial_start_date), 'dd MMM HH:mm')} -{' '}
                              {format(new Date(trial.trial_end_date), 'dd MMM yyyy HH:mm')}
                            </TableCell>
                            <TableCell>
                              {format(new Date(trial.updated_date), 'dd MMM yyyy HH:mm')}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {!trialUsers || trialUsers.length === 0 && (
                <div className="py-12 text-center">
                  <Clock className="mx-auto h-12 w-12 text-slate-300" />
                  <p className="mt-4 text-slate-500">No trial users yet</p>
                  <p className="text-sm text-slate-400">Create your first trial user to get started</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Trial Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Trial User</DialogTitle>
            <DialogDescription>
              Set up a temporary trial account with automatic expiration
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Email Address *</Label>
              <Input
                type="email"
                placeholder="trial@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Trial Duration *</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Input
                    type="number"
                    min="0"
                    placeholder="Hours"
                    value={Math.floor(formData.trial_hours)}
                    onChange={(e) => {
                      const hours = parseInt(e.target.value) || 0;
                      const minutes = formData.trial_hours % 1;
                      setFormData({ ...formData, trial_hours: hours + minutes });
                    }}
                  />
                  <p className="text-xs text-slate-500 mt-1">Hours</p>
                </div>
                <div>
                  <Input
                    type="number"
                    min="0"
                    max="59"
                    placeholder="Minutes"
                    value={Math.round((formData.trial_hours % 1) * 60)}
                    onChange={(e) => {
                      const minutes = parseInt(e.target.value) || 0;
                      const hours = Math.floor(formData.trial_hours);
                      setFormData({ ...formData, trial_hours: hours + minutes / 60 });
                    }}
                  />
                  <p className="text-xs text-slate-500 mt-1">Minutes</p>
                </div>
              </div>
              <p className="text-xs text-slate-400">
                Total: {Math.floor(formData.trial_hours)}h {Math.round((formData.trial_hours % 1) * 60)}m ({Math.round(formData.trial_hours / 24 * 10) / 10} days)
              </p>
            </div>

            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                placeholder="Internal notes about this trial user..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createTrialMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {createTrialMutation.isPending ? 'Creating...' : 'Create Trial User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Trial Data</DialogTitle>
            <DialogDescription>
              This will permanently delete all data created by this trial user
            </DialogDescription>
          </DialogHeader>

          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              <strong>Warning:</strong> This action cannot be undone. All payroll entries, leave
              records, overtime, and employee data for{' '}
              <strong>{selectedTrial?.email}</strong> will be permanently deleted.
            </AlertDescription>
          </Alert>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTrialDataMutation.mutate(selectedTrial.email)}
              disabled={deleteTrialDataMutation.isPending}
            >
              {deleteTrialDataMutation.isPending ? 'Deleting...' : 'Delete All Data'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}