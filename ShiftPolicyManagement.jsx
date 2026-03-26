import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, Plus, Pencil, Trash2, AlertCircle, Moon, Sun } from 'lucide-react';
import { toast } from 'sonner';
import { calculateCrossesMidnight, calculateTotalShiftMinutes, formatMinutesToHours } from '@/components/payroll/ShiftCalculator';

export default function ShiftPolicyManagement() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingShift, setEditingShift] = useState(null);
  const [formData, setFormData] = useState({
    shift_name: '',
    start_time: '09:00',
    end_time: '17:00',
    unpaid_lunch_minutes: 30,
    paid_break_minutes: 15,
    paid_break_default: true,
    paid_break_editable_by: 'ADMIN_ONLY',
    night_premium_start_time: '22:00',
    night_premium_rate: 1.25,
    country: 'IE',
    is_active: true,
    description: '',
  });

  // Fetch shift policies
  const { data: shiftPolicies, isLoading } = useQuery({
    queryKey: ['shiftPolicies'],
    queryFn: () => base44.entities.ShiftPolicy.list(),
    initialData: [],
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const crossesMidnight = calculateCrossesMidnight(data.start_time, data.end_time);
      const payload = { ...data, crosses_midnight: crossesMidnight };

      if (editingShift) {
        return base44.entities.ShiftPolicy.update(editingShift.id, payload);
      } else {
        return base44.entities.ShiftPolicy.create(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shiftPolicies'] });
      toast.success(editingShift ? 'Shift policy updated' : 'Shift policy created');
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(error?.message || 'Failed to save shift policy');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ShiftPolicy.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shiftPolicies'] });
      toast.success('Shift policy deleted');
    },
  });

  const resetForm = () => {
    setEditingShift(null);
    setFormData({
      shift_name: '',
      start_time: '09:00',
      end_time: '17:00',
      unpaid_lunch_minutes: 30,
      paid_break_minutes: 15,
      paid_break_default: true,
      paid_break_editable_by: 'ADMIN_ONLY',
      night_premium_start_time: '22:00',
      night_premium_rate: 1.25,
      country: 'IE',
      is_active: true,
      description: '',
    });
  };

  const handleEdit = (shift) => {
    setEditingShift(shift);
    setFormData({
      shift_name: shift.shift_name,
      start_time: shift.start_time,
      end_time: shift.end_time,
      unpaid_lunch_minutes: shift.unpaid_lunch_minutes,
      paid_break_minutes: shift.paid_break_minutes,
      paid_break_default: shift.paid_break_default,
      paid_break_editable_by: shift.paid_break_editable_by,
      night_premium_start_time: shift.night_premium_start_time || '22:00',
      night_premium_rate: shift.night_premium_rate || 1.25,
      country: shift.country || 'IE',
      is_active: shift.is_active,
      description: shift.description || '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  const crossesMidnight = calculateCrossesMidnight(formData.start_time, formData.end_time);
  const totalMinutes = calculateTotalShiftMinutes(formData.start_time, formData.end_time, crossesMidnight);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              Shift Policy Management
            </CardTitle>
            <CardDescription>
              Define shift patterns, breaks, and night premiums (Irish Working Time Act 1997)
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="mr-2 h-4 w-4" />
                New Shift Policy
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingShift ? 'Edit Shift Policy' : 'Create Shift Policy'}
                </DialogTitle>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Info */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-slate-900">Basic Information</h3>
                  
                  <div className="space-y-2">
                    <Label>Shift Name *</Label>
                    <Input
                      value={formData.shift_name}
                      onChange={(e) => setFormData({ ...formData, shift_name: e.target.value })}
                      placeholder="e.g., Day Shift, Night Shift, Evening Shift"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Time (24h) *</Label>
                      <Input
                        type="time"
                        value={formData.start_time}
                        onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>End Time (24h) *</Label>
                      <Input
                        type="time"
                        value={formData.end_time}
                        onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  {crossesMidnight && (
                    <Alert className="border-amber-200 bg-amber-50">
                      <Moon className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-amber-800">
                        This shift crosses midnight. Total duration: {formatMinutesToHours(totalMinutes)}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label>Description (optional)</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Any additional notes..."
                    />
                  </div>
                </div>

                {/* Breaks */}
                <div className="space-y-4 border-t pt-4">
                  <h3 className="font-semibold text-slate-900">Breaks (Admin Only)</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Unpaid Lunch (minutes)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={formData.unpaid_lunch_minutes}
                        onChange={(e) => setFormData({ ...formData, unpaid_lunch_minutes: parseInt(e.target.value) || 0 })}
                      />
                      <p className="text-xs text-slate-500">Deducted from worked hours</p>
                    </div>

                    <div className="space-y-2">
                      <Label>Paid Break (minutes)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={formData.paid_break_minutes}
                        onChange={(e) => setFormData({ ...formData, paid_break_minutes: parseInt(e.target.value) || 0 })}
                      />
                      <p className="text-xs text-slate-500">Included if paid_break_default is ON</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <Label>Paid Break Default</Label>
                      <p className="text-xs text-slate-500">Include paid break in worked hours by default</p>
                    </div>
                    <Switch
                      checked={formData.paid_break_default}
                      onCheckedChange={(checked) => setFormData({ ...formData, paid_break_default: checked })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Paid Break Editable By</Label>
                    <Select
                      value={formData.paid_break_editable_by}
                      onValueChange={(value) => setFormData({ ...formData, paid_break_editable_by: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ADMIN_ONLY">Admin Only</SelectItem>
                        <SelectItem value="EMPLOYEE">Employee</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Night Premium */}
                <div className="space-y-4 border-t pt-4">
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                    <Moon className="h-4 w-4 text-blue-600" />
                    Night Premium (Admin Only)
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Night Premium Starts At</Label>
                      <Input
                        type="time"
                        value={formData.night_premium_start_time}
                        onChange={(e) => setFormData({ ...formData, night_premium_start_time: e.target.value })}
                      />
                      <p className="text-xs text-slate-500">e.g., 22:00 (10 PM)</p>
                    </div>

                    <div className="space-y-2">
                      <Label>Night Premium Rate</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="1"
                        max="3"
                        value={formData.night_premium_rate}
                        onChange={(e) => setFormData({ ...formData, night_premium_rate: parseFloat(e.target.value) || 1.25 })}
                      />
                      <p className="text-xs text-slate-500">1.25 = +25% premium</p>
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <Label>Active</Label>
                    <p className="text-xs text-slate-500">Whether this shift policy can be assigned to employees</p>
                  </div>
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 border-t pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saveMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
                    {saveMutation.isPending ? 'Saving...' : (editingShift ? 'Update' : 'Create')}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <p className="text-center py-8 text-slate-500">Loading shift policies...</p>
        ) : shiftPolicies.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="mx-auto h-12 w-12 text-slate-300" />
            <p className="mt-4 text-slate-500">No shift policies defined yet</p>
            <p className="text-sm text-slate-400">Create your first shift policy to get started</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shift Name</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Breaks</TableHead>
                <TableHead>Night Premium</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shiftPolicies.map((shift) => {
                const crosses = shift.crosses_midnight || calculateCrossesMidnight(shift.start_time, shift.end_time);
                const total = calculateTotalShiftMinutes(shift.start_time, shift.end_time, crosses);
                
                return (
                  <TableRow key={shift.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{shift.shift_name}</p>
                        {shift.description && (
                          <p className="text-xs text-slate-500">{shift.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {crosses ? <Moon className="h-3 w-3 text-blue-600" /> : <Sun className="h-3 w-3 text-amber-600" />}
                        <span className="text-sm">
                          {shift.start_time} - {shift.end_time}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">{formatMinutesToHours(total)}</p>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm space-y-1">
                        <p>Unpaid: {shift.unpaid_lunch_minutes}m</p>
                        <p>Paid: {shift.paid_break_minutes}m {shift.paid_break_default && '✓'}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {shift.night_premium_start_time ? (
                        <div className="text-sm">
                          <p>From {shift.night_premium_start_time}</p>
                          <p className="text-xs text-slate-500">{shift.night_premium_rate}x rate</p>
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={shift.is_active ? 'default' : 'secondary'}>
                        {shift.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(shift)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => {
                            if (confirm('Delete this shift policy?')) {
                              deleteMutation.mutate(shift.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}