import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import {
  User,
  Calendar,
  Clock,
  Euro,
  Shield,
  CreditCard,
  AlertTriangle,
  Check,
  Save,
  Briefcase,
  Heart,
  Info,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { TAX_RATES_2026 } from '@/components/payroll/IrishTaxCalculator';
import { getSubclassesForClass } from '@/components/payroll/PRSIRules';
import WeeklyTimeCard from '@/components/profile/WeeklyTimeCard';
import MyFutureFundWidget from '@/components/pension/MyFutureFundWidget';
import { checkEligibility } from '@/components/payroll/MyFutureFundCalculator.jsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { generateBankHolidayEntitlements } from '@/components/leave/BankHolidayEntitlementGenerator';

export default function Profile() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    full_name: '',
    date_of_birth: '',
    pps_number: '',
    contract_type: '',
    contract_start_date: '',
    shift_policy_id: '',
    weekly_contracted_hours: 37.5,
    base_hourly_rate: 15.93,
    annual_salary: 31063.50,
    annual_tax_credits: 3750,
    standard_rate_cut_off: 44000,
    prsi_class: 'A',
    prsi_subclass: 'A1',
    has_medical_card: false,
    tax_basis: 'cumulative',
    health_insurance_benefit: 0,
  });
  
  const [settingsForm, setSettingsForm] = useState({
    start_time: '09:00',
    end_time: '17:30',
    paid_break_minutes: 0,
    unpaid_lunch_minutes: 30,
  });

  const [weeklyTimeData, setWeeklyTimeData] = useState({
    monday_start: '09:00',
    monday_end: '17:30',
    monday_break: 30,
    monday_lunch: 60,
    tuesday_start: '09:00',
    tuesday_end: '17:30',
    tuesday_break: 30,
    tuesday_lunch: 60,
    wednesday_start: '09:00',
    wednesday_end: '17:30',
    wednesday_break: 30,
    wednesday_lunch: 60,
    thursday_start: '09:00',
    thursday_end: '17:30',
    thursday_break: 30,
    thursday_lunch: 60,
    friday_start: '09:00',
    friday_end: '17:30',
    friday_break: 30,
    friday_lunch: 60,
    saturday_start: '',
    saturday_end: '',
    saturday_break: 30,
    saturday_lunch: 60,
    sunday_start: '',
    sunday_end: '',
    sunday_break: 30,
    sunday_lunch: 60,
  });

  // Calcular semana ISO atual
  const getCurrentISOWeek = () => {
    const date = new Date();
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  };

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedWeek, setSelectedWeek] = useState(getCurrentISOWeek());
  
  const [hasChanges, setHasChanges] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [timeCardManualOverrides, setTimeCardManualOverrides] = useState({});

  // Fetch current user
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  // Fetch employee profile
  const { data: employees, isLoading: employeeLoading, refetch } = useQuery({
    queryKey: ['employee', user?.email],
    queryFn: () => base44.entities.Employee.filter({ created_by: user?.email }),
    enabled: !!user?.email,
  });

  const employee = employees?.[0];
  const isAdmin = employee?.is_admin || user?.role === 'admin';

  // Fetch shift policies
  const { data: shiftPolicies } = useQuery({
    queryKey: ['shiftPolicies'],
    queryFn: () => base44.entities.ShiftPolicy.list(),
    initialData: [],
  });

  // Fetch selected shift policy
  const { data: selectedShiftPolicy } = useQuery({
    queryKey: ['selectedShiftPolicy', formData.shift_policy_id],
    queryFn: () => base44.entities.ShiftPolicy.filter({ id: formData.shift_policy_id }),
    enabled: !!formData.shift_policy_id,
  });

  // Fetch pension auto-enrolment record
  const { data: pensionRecords } = useQuery({
    queryKey: ['pensionAutoEnrolment', employee?.id],
    queryFn: () => base44.entities.PensionAutoEnrolment.filter({ employee_id: employee?.id }),
    enabled: !!employee?.id,
  });

  const pensionRecord = pensionRecords?.[0];

  // Fetch YTD earnings for My Future Fund eligibility
  const { data: ytdEntries } = useQuery({
    queryKey: ['ytdEntriesForPension', employee?.id],
    queryFn: async () => {
      const allEntries = await base44.entities.PayrollEntry.filter({ employee_id: employee?.id });
      const currentYear = new Date().getFullYear();
      return allEntries.filter(e => {
        const paymentDate = new Date(e.payment_date);
        return paymentDate.getFullYear() === currentYear;
      });
    },
    enabled: !!employee?.id,
  });

  // Calculate rolling annual earnings
  const rollingAnnualEarnings = React.useMemo(() => {
    if (!ytdEntries) return 0;
    return ytdEntries.reduce((sum, e) => sum + (e.gross_pay || 0), 0);
  }, [ytdEntries]);

  // Check My Future Fund eligibility
  const pensionEligibility = React.useMemo(() => {
    if (!employee) return null;
    // Calculate current month's gross pay estimate
    const estimatedMonthlyGross = (employee.base_hourly_rate || 0) * (employee.weekly_contracted_hours || 0) * 52 / 12;
    return checkEligibility(employee, pensionRecord, estimatedMonthlyGross, new Date().toISOString().split('T')[0], 'monthly');
  }, [employee, pensionRecord]);

  // Fetch employee settings
  const { data: settingsData, isLoading: settingsLoading, refetch: refetchSettings } = useQuery({
    queryKey: ['employeeSettings', employee?.id],
    queryFn: () => base44.entities.EmployeeSettings.filter({ employee_id: employee?.id }),
    enabled: !!employee?.id,
  });

  // Fetch weekend roster data
  const { data: weekendRosters } = useQuery({
    queryKey: ['weekendRosters', employee?.id, selectedYear, selectedMonth],
    queryFn: () => base44.entities.WeekendRoster.filter({
      employee_id: employee?.id,
      payroll_period_year: selectedYear,
      payroll_period_month: selectedMonth,
    }),
    enabled: !!employee?.id,
  });

  // Fetch saved WeeklyTimeCard for selected week
  const { data: savedWeeklyTimeCards } = useQuery({
    queryKey: ['weeklyTimeCard', employee?.id, selectedYear, selectedWeek],
    queryFn: () => base44.entities.WeeklyTimeCard.filter({
      employee_id: employee?.id,
      year: selectedYear,
      week_number: selectedWeek,
    }),
    enabled: !!employee?.id,
  });

  const settings = settingsData?.[0];
  const isSettingsLocked = settings?.is_locked;

  // Initialize form with existing data
  useEffect(() => {
    if (employee) {
      setFormData({
        full_name: employee.full_name || user?.full_name || '',
        date_of_birth: employee.date_of_birth || '',
        pps_number: employee.pps_number || '',
        contract_type: employee.contract_type || '',
        contract_start_date: employee.contract_start_date || '',
        shift_policy_id: employee.shift_policy_id || '',
        weekly_contracted_hours: employee.weekly_contracted_hours || 37.5,
        base_hourly_rate: employee.base_hourly_rate || 15.93,
        annual_salary: employee.annual_salary || 0,
        annual_tax_credits: employee.annual_tax_credits || 3750,
        standard_rate_cut_off: employee.standard_rate_cut_off || 44000,
        prsi_class: employee.prsi_class || 'A',
        prsi_subclass: employee.prsi_subclass || 'A1',
        has_medical_card: employee.has_medical_card || false,
        tax_basis: employee.tax_basis || 'cumulative',
        health_insurance_benefit: employee.health_insurance_benefit || 0,
      });
    } else if (user) {
      setFormData(prev => ({
        ...prev,
        full_name: user.full_name || '',
      }));
    }
    
    if (settings) {
      setSettingsForm({
        start_time: settings.start_time || '09:00',
        end_time: settings.end_time || '17:30',
        paid_break_minutes: settings.paid_break_minutes || 0,
        unpaid_lunch_minutes: settings.unpaid_lunch_minutes || 30,
      });
    }
  }, [employee, user, settings]);

  // Carregar WeeklyTimeCard salvo ao trocar de semana - PRIORIDADE ABSOLUTA
  useEffect(() => {
    const savedCard = savedWeeklyTimeCards?.[0];
    
    // Se houver dados salvos, SEMPRE usar eles (prioridade absoluta)
    if (savedCard) {
      console.log('[Profile] Loading saved WeeklyTimeCard:', savedCard);
      setWeeklyTimeData({
        monday_start: savedCard.monday_start || '',
        monday_end: savedCard.monday_end || '',
        monday_break: savedCard.monday_break || 30,
        monday_lunch: savedCard.monday_lunch || 60,
        tuesday_start: savedCard.tuesday_start || '',
        tuesday_end: savedCard.tuesday_end || '',
        tuesday_break: savedCard.tuesday_break || 30,
        tuesday_lunch: savedCard.tuesday_lunch || 60,
        wednesday_start: savedCard.wednesday_start || '',
        wednesday_end: savedCard.wednesday_end || '',
        wednesday_break: savedCard.wednesday_break || 30,
        wednesday_lunch: savedCard.wednesday_lunch || 60,
        thursday_start: savedCard.thursday_start || '',
        thursday_end: savedCard.thursday_end || '',
        thursday_break: savedCard.thursday_break || 30,
        thursday_lunch: savedCard.thursday_lunch || 60,
        friday_start: savedCard.friday_start || '',
        friday_end: savedCard.friday_end || '',
        friday_break: savedCard.friday_break || 30,
        friday_lunch: savedCard.friday_lunch || 60,
        saturday_start: savedCard.saturday_start || '',
        saturday_end: savedCard.saturday_end || '',
        saturday_break: savedCard.saturday_break || 30,
        saturday_lunch: savedCard.saturday_lunch || 60,
        sunday_start: savedCard.sunday_start || '',
        sunday_end: savedCard.sunday_end || '',
        sunday_break: savedCard.sunday_break || 30,
        sunday_lunch: savedCard.sunday_lunch || 60,
      });
    } else if (formData.shift_policy_id && selectedShiftPolicy?.[0]) {
      // Apenas preencher da policy se NÃO houver dados salvos
      console.log('[Profile] No saved data - using shift policy defaults');
      const policy = selectedShiftPolicy[0];
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
      
      setWeeklyTimeData(prev => {
        const updated = { ...prev };
        days.forEach(day => {
          // Só preenche se o campo estiver vazio
          if (!prev[`${day}_start`] && !prev[`${day}_end`]) {
            updated[`${day}_start`] = policy.start_time;
            updated[`${day}_end`] = policy.end_time;
            updated[`${day}_break`] = policy.paid_break_minutes || 30;
            updated[`${day}_lunch`] = policy.unpaid_lunch_minutes || 60;
          }
        });
        return updated;
      });
    }
  }, [savedWeeklyTimeCards, selectedYear, selectedWeek, formData.shift_policy_id, selectedShiftPolicy]);



  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data) => {
      // Sync full_name with User entity
      if (data.full_name && data.full_name !== user?.full_name) {
        await base44.auth.updateMe({ full_name: data.full_name });
      }
      
      const isComplete = checkProfileComplete(data);
      const payload = { ...data, profile_complete: isComplete };
      const currentUser = await base44.auth.me();
      const isNewEmployee = !employee?.id;
      const wasIncomplete = employee && !employee.profile_complete;
      
      console.log('[Profile Save] isComplete:', isComplete, 'isNewEmployee:', isNewEmployee, 'wasIncomplete:', wasIncomplete);
      
      // Check if PRSI changed - create history record
      if (employee?.id && (employee.prsi_class !== data.prsi_class || employee.prsi_subclass !== data.prsi_subclass)) {
        await base44.entities.PRSIHistory.create({
          employee_id: employee.id,
          prsi_class: data.prsi_class,
          prsi_subclass: data.prsi_subclass,
          effective_from: new Date().toISOString().split('T')[0],
          changed_by: currentUser.email,
          change_reason: 'Profile update',
        });
      }
      
      let savedEmployee;
      if (employee?.id) {
        savedEmployee = await base44.entities.Employee.update(employee.id, payload);
        savedEmployee.id = employee.id;
      } else {
        savedEmployee = await base44.entities.Employee.create(payload);
      }

      console.log('[Profile Save] Saved employee:', savedEmployee);

      // ALWAYS generate bank holiday entitlements if profile is complete and has contract start date
      // The generation function will skip duplicates automatically
      if (isComplete && data.contract_start_date) {
        console.log('[Profile Save] Profile complete with contract date - generating bank holiday entitlements...');
        
        // Fetch company policy
        const allPolicies = await base44.entities.CompanyBankHolidayPolicy.list();
        console.log('[Profile Save] All policies:', allPolicies);
        
        const companyPolicies = await base44.entities.CompanyBankHolidayPolicy.filter({ is_active: true });
        console.log('[Profile Save] Filtered policies (is_active=true):', companyPolicies);
        
        const companyPolicy = companyPolicies?.[0];
        console.log('[Profile Save] Selected policy:', companyPolicy);

        if (companyPolicy && companyPolicy.policy_type === 'ASSUME_WORKED') {
          const startYear = new Date(data.contract_start_date).getFullYear();
          const currentYear = new Date().getFullYear();
          
          console.log(`[Profile Save] Will generate entitlements from ${startYear} to ${currentYear}`);

          let totalCreated = 0;
          // Generate entitlements for all years from contract start to current year
          for (let year = startYear; year <= currentYear; year++) {
            console.log(`[Profile Save] Generating for year ${year}...`);
            const result = await generateBankHolidayEntitlements(savedEmployee.id, year, companyPolicy);
            console.log(`[Profile Save] Year ${year} result:`, result);
            totalCreated += result.created;
          }

          if (totalCreated > 0) {
            toast.success(`Profile saved! Generated ${totalCreated} bank holiday entitlements`);
          } else {
            console.log('[Profile Save] Entitlements already exist (0 created)');
          }
        } else {
          console.warn('[Profile Save] No ASSUME_WORKED policy found or policy is inactive');
        }
      } else {
        console.log('[Profile Save] Skipping entitlement generation - profile incomplete or no contract date');
      }
      
      return savedEmployee;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee'] });
      queryClient.invalidateQueries({ queryKey: ['weeklyTimeCard'] });
      queryClient.invalidateQueries({ queryKey: ['bankHolidayEntitlements'] });
      queryClient.invalidateQueries({ queryKey: ['bankHolidayBalance'] });
      queryClient.invalidateQueries({ queryKey: ['bankHolidayConsumptions'] });
      queryClient.invalidateQueries({ queryKey: ['leaveRecords'] });
      toast.success('Profile saved successfully');
      setHasChanges(false);
      setShowSuccessMessage(true);
      refetch();
      
      // Hide success message after 5 seconds
      setTimeout(() => {
        setShowSuccessMessage(false);
      }, 5000);
    },
    onError: (error) => {
      const errorMessage = error?.message || error?.toString() || 'Failed to save profile';
      toast.error(errorMessage);
      console.error('Profile save error:', error);
    },
  });

  // Save settings mutation (combined with profile save)
  const saveSettingsMutation = useMutation({
    mutationFn: async (data) => {
      const payload = {
        employee_id: employee.id,
        ...data,
        is_locked: !isAdmin ? true : (settings?.is_locked || false),
      };
      
      if (settings?.id) {
        return base44.entities.EmployeeSettings.update(settings.id, payload);
      } else {
        return base44.entities.EmployeeSettings.create(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employeeSettings'] });
      refetchSettings();
    },
    onError: (error) => {
      const errorMessage = error?.message || error?.toString() || 'Failed to save work schedule';
      toast.error(errorMessage);
      console.error('Settings save error:', error);
    },
  });

  const checkProfileComplete = (data) => {
    return !!(
      data.full_name &&
      data.date_of_birth &&
      data.contract_type &&
      data.contract_start_date &&
      data.shift_policy_id &&
      data.weekly_contracted_hours &&
      data.base_hourly_rate &&
      data.annual_tax_credits &&
      data.standard_rate_cut_off &&
      data.prsi_class &&
      data.tax_basis
    );
  };

  const handleChange = async (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      
      // Auto-calculate annual salary from hourly rate and weekly hours
      if (field === 'base_hourly_rate' || field === 'weekly_contracted_hours') {
        const hourlyRate = field === 'base_hourly_rate' ? parseFloat(value) : prev.base_hourly_rate;
        const weeklyHours = field === 'weekly_contracted_hours' ? parseFloat(value) : prev.weekly_contracted_hours;
        if (hourlyRate && weeklyHours) {
          updated.annual_salary = hourlyRate * weeklyHours * 52;
        }
      }
      
      // Auto-calculate hourly rate from annual salary and weekly hours
      if (field === 'annual_salary' && value) {
        const annualSalary = parseFloat(value);
        const weeklyHours = prev.weekly_contracted_hours;
        if (annualSalary && weeklyHours) {
          updated.base_hourly_rate = annualSalary / (weeklyHours * 52);
        }
      }
      
      return updated;
    });
    setHasChanges(true);

    // Auto-preencher será feito pelo useEffect que carrega WeeklyTimeCard
    // Não sobrescrever aqui para evitar race conditions
  };

  const handleWeeklyTimeChange = async (field, value) => {
    // Atualizar estado local primeiro
    const updatedTimeData = { ...weeklyTimeData, [field]: value };
    setWeeklyTimeData(updatedTimeData);
    setHasChanges(true);
    
    // Marcar como manualmente alterado
    setTimeCardManualOverrides(prev => ({ ...prev, [field]: true }));
    
    // Auto-salvar imediatamente
    if (employee?.id) {
      try {
        // Buscar registro existente
        const existingCards = await base44.entities.WeeklyTimeCard.filter({
          employee_id: employee.id,
          year: selectedYear,
          week_number: selectedWeek,
        });
        
        if (existingCards && existingCards.length > 0) {
          // Atualizar registro existente com TODOS os dados
          await base44.entities.WeeklyTimeCard.update(existingCards[0].id, updatedTimeData);
        } else {
          // Criar novo registro com TODOS os dados
          await base44.entities.WeeklyTimeCard.create({
            employee_id: employee.id,
            year: selectedYear,
            week_number: selectedWeek,
            ...updatedTimeData,
          });
        }
        
        // Invalidar query para garantir dados atualizados
        queryClient.invalidateQueries({ 
          queryKey: ['weeklyTimeCard', employee.id, selectedYear, selectedWeek] 
        });
      } catch (error) {
        console.error('Failed to auto-save time card:', error);
        toast.error('Failed to save time card changes');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Save profile first
    try {
      await saveMutation.mutateAsync(formData);
      
      // Then save work schedule settings if employee exists
      if (employee?.id) {
        await saveSettingsMutation.mutateAsync(settingsForm);
      }
      
      toast.success('Profile and work schedule saved successfully');
    } catch (error) {
      // Errors already handled in mutations
    }
  };

  const getYearOptions = () => {
    const years = [];
    const startYear = currentYear - 5;
    const endYear = currentYear + 10;
    for (let year = startYear; year <= endYear; year++) {
      years.push(year);
    }
    return years;
  };

  const getWeeksInMonth = (year, month) => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    return Math.ceil((lastDay.getDate() + firstDay.getDay()) / 7);
  };

  // Transform weekend roster data into a map by date
  const weekendDataMap = React.useMemo(() => {
    if (!weekendRosters) return {};
    
    const map = {};
    weekendRosters.forEach(roster => {
      if (roster.date) {
        map[roster.date] = {
          start_time: roster.start_time || '',
          end_time: roster.end_time || '',
          break_minutes: roster.break_minutes || 30,
          lunch_minutes: roster.lunch_minutes || 60,
        };
      }
    });
    return map;
  }, [weekendRosters]);

  const isLoading = userLoading || employeeLoading || settingsLoading;

  // Validate tax credits
  const isUnusualTaxCredits = formData.annual_tax_credits < 1000 || formData.annual_tax_credits > 10000;
  const isUnusualCutOff = formData.standard_rate_cut_off < 20000 || formData.standard_rate_cut_off > 100000;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-[600px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl p-4 md:p-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900">Employee Profile</h1>
            <p className="mt-1 text-slate-500">
              Complete all required fields to access payroll features
            </p>
          </div>
        </motion.div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal Information */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-emerald-600" />
                  Personal Information
                </CardTitle>
                <CardDescription>
                  Your basic personal details
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name *</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => handleChange('full_name', e.target.value)}
                    placeholder="Enter your full name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date_of_birth">Date of Birth *</Label>
                  <Input
                    id="date_of_birth"
                    type="date"
                    value={formData.date_of_birth}
                    onChange={(e) => handleChange('date_of_birth', e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pps_number">
                    PPS Number
                    <span className="ml-2 text-xs text-slate-400">(Recommended)</span>
                  </Label>
                  <Input
                    id="pps_number"
                    value={formData.pps_number}
                    onChange={(e) => handleChange('pps_number', e.target.value.toUpperCase())}
                    placeholder="1234567AB"
                    maxLength={9}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Contract Details */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-emerald-600" />
                  Contract Details
                </CardTitle>
                <CardDescription>
                  Your employment contract information
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contract_type">Contract Type *</Label>
                  <Select
                    value={formData.contract_type}
                    onValueChange={(v) => handleChange('contract_type', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select contract type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full-time">Full-time</SelectItem>
                      <SelectItem value="part-time">Part-time</SelectItem>
                      <SelectItem value="fixed-term">Fixed-term</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contract_start_date">Contract Start Date *</Label>
                  <Input
                    id="contract_start_date"
                    type="date"
                    value={formData.contract_start_date}
                    onChange={(e) => handleChange('contract_start_date', e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="shift_policy_id">
                    Shift Policy *
                  </Label>
                  <Select
                    value={formData.shift_policy_id}
                    onValueChange={(v) => handleChange('shift_policy_id', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select your shift policy">
                        {formData.shift_policy_id && shiftPolicies?.length > 0 ? (
                          (() => {
                            const selected = shiftPolicies.find(s => s.id === formData.shift_policy_id);
                            return selected ? `${selected.shift_name} (${selected.start_time} - ${selected.end_time})` : "Select your shift policy";
                          })()
                        ) : (
                          "Select your shift policy"
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {shiftPolicies && shiftPolicies.length > 0 ? (
                        shiftPolicies.map((shift) => (
                          <SelectItem key={shift.id} value={shift.id}>
                            {shift.shift_name} ({shift.start_time} - {shift.end_time})
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>Loading shift policies...</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500">
                    Your time card will be auto-filled with this policy's schedule (you can override individual days)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="weekly_contracted_hours">Weekly Contracted Hours *</Label>
                  <Input
                    id="weekly_contracted_hours"
                    type="number"
                    step="0.5"
                    min="1"
                    max="48"
                    value={formData.weekly_contracted_hours}
                    onChange={(e) => handleChange('weekly_contracted_hours', parseFloat(e.target.value))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="base_hourly_rate">
                    Base Hourly Rate (€) *
                  </Label>
                  <Input
                    id="base_hourly_rate"
                    type="number"
                    step="any"
                    min="0"
                    value={formData.base_hourly_rate}
                    onChange={(e) => handleChange('base_hourly_rate', parseFloat(e.target.value))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="annual_salary">
                    Annual Salary (€)
                    <span className="ml-2 text-xs text-slate-400">
                      Auto-calculated
                    </span>
                  </Label>
                  <Input
                    id="annual_salary"
                    type="number"
                    step="any"
                    min="0"
                    value={formData.annual_salary || (formData.base_hourly_rate * formData.weekly_contracted_hours * 52)}
                    onChange={(e) => handleChange('annual_salary', parseFloat(e.target.value))}
                  />
                  <p className="text-xs text-slate-500">
                    Calculated as: Hourly Rate × Weekly Hours × 52 weeks
                  </p>
                </div>
                </CardContent>
                </Card>
                </motion.div>

          {/* Tax Information */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-emerald-600" />
                  Tax Information
                </CardTitle>
                <CardDescription>
                  Enter your tax credits and PRSI details from Revenue
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="annual_tax_credits">Annual Tax Credits (€) *</Label>
                    <Input
                      id="annual_tax_credits"
                      type="number"
                      step="any"
                      min="0"
                      value={formData.annual_tax_credits}
                      onChange={(e) => handleChange('annual_tax_credits', parseFloat(e.target.value))}
                      required
                    />
                    {isUnusualTaxCredits && (
                      <p className="flex items-center gap-1 text-xs text-amber-600">
                        <AlertTriangle className="h-3 w-3" />
                        Value seems unusual. Typical range: €1,000 - €10,000
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="standard_rate_cut_off">Standard Rate Cut-Off Point (€) *</Label>
                    <Input
                      id="standard_rate_cut_off"
                      type="number"
                      step="any"
                      min="0"
                      value={formData.standard_rate_cut_off}
                      onChange={(e) => handleChange('standard_rate_cut_off', parseFloat(e.target.value))}
                      required
                    />
                    {isUnusualCutOff && (
                      <p className="flex items-center gap-1 text-xs text-amber-600">
                        <AlertTriangle className="h-3 w-3" />
                        Value seems unusual. Typical range: €20,000 - €100,000
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="prsi_class">PRSI Class *</Label>
                    <Select
                      value={formData.prsi_class}
                      onValueChange={(v) => {
                        handleChange('prsi_class', v);
                        const subs = getSubclassesForClass(v, 2026);
                        if (subs.length > 0) {
                          handleChange('prsi_subclass', subs[0].value);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select PRSI class" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A">Class A - Private Sector</SelectItem>
                        <SelectItem value="B">Class B - Garda/Defence</SelectItem>
                        <SelectItem value="C">Class C - Officers</SelectItem>
                        <SelectItem value="D">Class D - Public Service</SelectItem>
                        <SelectItem value="H">Class H - Health Service</SelectItem>
                        <SelectItem value="J">Class J - Low Earnings</SelectItem>
                        <SelectItem value="K">Class K - Public Service Pensioner</SelectItem>
                        <SelectItem value="M">Class M - Over 66</SelectItem>
                        <SelectItem value="S">Class S - Self-Employed</SelectItem>
                        <SelectItem value="P">Class P - Voluntary</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="prsi_subclass">PRSI Subclass *</Label>
                    <Select
                      value={formData.prsi_subclass || 'A1'}
                      onValueChange={(v) => handleChange('prsi_subclass', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Subclass" />
                      </SelectTrigger>
                      <SelectContent>
                        {getSubclassesForClass(formData.prsi_class || 'A', 2026).map(s => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tax_basis">Tax Basis *</Label>
                    <Select
                      value={formData.tax_basis}
                      onValueChange={(v) => handleChange('tax_basis', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select tax basis" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cumulative">Cumulative</SelectItem>
                        <SelectItem value="week1">Week 1 (Non-cumulative)</SelectItem>
                        <SelectItem value="emergency">Emergency</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-start space-x-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <Checkbox
                    id="has_medical_card"
                    checked={formData.has_medical_card}
                    onCheckedChange={(checked) => handleChange('has_medical_card', checked)}
                  />
                  <div className="space-y-1">
                    <Label htmlFor="has_medical_card" className="cursor-pointer font-medium">
                      I have a Medical Card
                    </Label>
                    <p className="text-sm text-slate-500">
                      Medical card holders may be entitled to reduced USC rates
                    </p>
                  </div>
                </div>

                <Alert className="border-blue-200 bg-blue-50">
                  <Info className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    You can find your tax credits and cut-off point on your Revenue Tax Credit Certificate 
                    or by logging into <a href="https://www.ros.ie" target="_blank" rel="noopener noreferrer" 
                    className="font-medium underline">myAccount</a>.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </motion.div>

          {/* Additional Benefits */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.4 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5 text-emerald-600" />
                  Additional Benefits
                </CardTitle>
                <CardDescription>
                  Optional benefit-in-kind information
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-w-sm space-y-2">
                  <Label htmlFor="health_insurance_benefit">
                    Monthly Health Insurance Benefit (€)
                    <span className="ml-2 text-xs text-slate-400">(Taxable)</span>
                  </Label>
                  <Input
                    id="health_insurance_benefit"
                    type="number"
                    step="any"
                    min="0"
                    value={formData.health_insurance_benefit}
                    onChange={(e) => handleChange('health_insurance_benefit', parseFloat(e.target.value) || 0)}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>
          
          {/* Weekly Time Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.5 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-emerald-600" />
                  Weekly Time Card
                  {isSettingsLocked && !isAdmin && (
                    <Badge className="ml-2 bg-blue-100 text-blue-700">Start/End Times Editable Only</Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {!settings ? (
                    <span className="text-amber-600 font-medium">⚠️ Setup your weekly schedule</span>
                  ) : isSettingsLocked && !isAdmin ? (
                    "Break and Lunch are locked. Only Start/End times can be edited."
                  ) : (
                    "Configure your work schedule for each day of the week"
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Week Selector */}
                <div className="flex flex-wrap items-center gap-4">
                  <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getYearOptions().map(year => (
                        <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'].map((month, i) => (
                        <SelectItem key={i} value={(i + 1).toString()}>{month}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={() => setSelectedWeek(Math.max(1, selectedWeek - 1))}
                      disabled={selectedWeek === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium px-3">Week {selectedWeek}</span>
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={() => setSelectedWeek(Math.min(getWeeksInMonth(selectedYear, selectedMonth), selectedWeek + 1))}
                      disabled={selectedWeek >= getWeeksInMonth(selectedYear, selectedMonth)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Weekly Time Card Grid */}
                <WeeklyTimeCard
                  timeData={weeklyTimeData}
                  onTimeChange={handleWeeklyTimeChange}
                  isLocked={isSettingsLocked}
                  isAdmin={isAdmin}
                  selectedYear={selectedYear}
                  selectedMonth={selectedMonth}
                  selectedWeek={selectedWeek}
                  weekendData={weekendDataMap}
                />

                {!settings && (
                  <Alert className="border-amber-200 bg-amber-50">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-800">
                      <strong>Important:</strong> After first save, only Start/End times will remain editable. Break and Lunch will be locked.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* My Future Fund Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.7 }}
          >
            <MyFutureFundWidget
              eligibility={pensionEligibility}
              contribution={null}
              pensionRecord={pensionRecord}
              paymentDate={new Date().toISOString().split('T')[0]}
            />
          </motion.div>

          {/* Success Message - Only shown after save */}
          {showSuccessMessage && checkProfileComplete(formData) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="border-2 border-emerald-200 bg-emerald-50">
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="rounded-full bg-emerald-100 p-2">
                    <Check className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-medium text-emerald-800">Profile Complete. You can now access all payroll features</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Save Button - Final Position */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.8 }}
          >
            <div className="flex justify-end gap-4">
              <Button
                type="submit"
                size="lg"
                className="bg-emerald-600 hover:bg-emerald-700"
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? (
                  <>
                    <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Profile
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        </form>
      </div>
    </div>
  );
}