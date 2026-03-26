import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * Shared hook for bank holiday balance calculations with FIFO logic
 * Ensures consistency across Dashboard, Leave Management, and Ledger
 */
export function useBankHolidayBalance(employeeId, year) {
  // Fetch entitlements
  const { data: entitlements, isLoading: entitlementsLoading } = useQuery({
    queryKey: ['bankHolidayEntitlements', employeeId, year],
    queryFn: async () => {
      const data = await base44.entities.BankHolidayEntitlement.filter({
        employee_id: employeeId,
        year: year,
      });
      return data.sort((a, b) => new Date(a.bank_holiday_date) - new Date(b.bank_holiday_date));
    },
    enabled: !!employeeId,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Fetch consumption records
  const { data: consumptions, isLoading: consumptionsLoading } = useQuery({
    queryKey: ['bankHolidayConsumptions', employeeId, year],
    queryFn: async () => {
      const allConsumptions = await base44.entities.BankHolidayConsumption.filter({
        employee_id: employeeId,
      });
      
      const filtered = allConsumptions.filter(c => {
        const consumptionYear = new Date(c.consumption_date).getFullYear();
        return consumptionYear === year;
      });
      
      return filtered.sort((a, b) => new Date(a.consumption_date) - new Date(b.consumption_date));
    },
    enabled: !!employeeId,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Calculate totals with FIFO
  const totalGranted = (entitlements || []).reduce((sum, e) => sum + (e.hours_granted || 0), 0);
  const totalConsumed = (consumptions || []).reduce((sum, c) => sum + Math.abs(c.hours_consumed || 0), 0);
  const totalRemaining = totalGranted - totalConsumed;

  // FIFO distribution
  const entitlementsWithFIFO = entitlements ? (() => {
    let remainingToAllocate = totalConsumed;
    
    return entitlements.map((ent) => {
      const granted = ent.hours_granted || 0;
      
      if (remainingToAllocate <= 0) {
        return { ...ent, fifoConsumed: 0, fifoRemaining: granted };
      }
      
      const consumedFromThis = Math.min(granted, remainingToAllocate);
      remainingToAllocate -= consumedFromThis;
      
      return {
        ...ent,
        fifoConsumed: consumedFromThis,
        fifoRemaining: granted - consumedFromThis,
      };
    });
  })() : [];

  return {
    totalGranted,
    totalConsumed,
    totalRemaining,
    entitlements: entitlementsWithFIFO,
    consumptions: consumptions || [],
    isLoading: entitlementsLoading || consumptionsLoading,
  };
}