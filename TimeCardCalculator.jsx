// Time Card Calculator - Calcula horas trabalhadas e night premium baseado no time card real
// Integra com ShiftPolicy para obter configurações de night premium

import { timeToMinutes, calculateNightMinutes } from './ShiftCalculator';

/**
 * Calcula as horas trabalhadas e night premium para um dia específico no time card
 * @param {string} startTime - Horário de início (HH:MM)
 * @param {string} endTime - Horário de fim (HH:MM)
 * @param {number} breakMinutes - Minutos de break pago
 * @param {number} lunchMinutes - Minutos de almoço não pago
 * @param {object} shiftPolicy - Política de turno com night_premium_start_time e night_premium_rate
 * @param {number} baseHourlyRate - Taxa horária base do funcionário
 * @returns {object} Cálculo detalhado { totalHours, regularHours, nightPremiumHours, regularPay, nightPremiumPay, totalPay }
 */
export function calculateDayPay(startTime, endTime, breakMinutes, lunchMinutes, shiftPolicy, baseHourlyRate) {
  if (!startTime || !endTime) {
    return {
      totalHours: 0,
      regularHours: 0,
      nightPremiumHours: 0,
      regularPay: 0,
      nightPremiumPay: 0,
      totalPay: 0,
    };
  }

  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  const crossesMidnight = end <= start;

  // Total de minutos trabalhados (bruto)
  const totalMinutes = crossesMidnight 
    ? ((24 * 60) - start) + end
    : end - start;

  // Minutos trabalhados (líquidos) = total - lunch (break é pago, não deduzir)
  const workedMinutes = Math.max(0, totalMinutes - lunchMinutes);
  const totalHours = workedMinutes / 60;

  // Se não há night premium configurado, retorna apenas horas regulares
  if (!shiftPolicy?.night_premium_start_time) {
    const regularPay = totalHours * baseHourlyRate;
    return {
      totalHours,
      regularHours: totalHours,
      nightPremiumHours: 0,
      regularPay,
      nightPremiumPay: 0,
      totalPay: regularPay,
    };
  }

  // Calcular minutos dentro do período de night premium
  const nightMinutes = calculateNightMinutes(
    startTime,
    endTime,
    crossesMidnight,
    shiftPolicy.night_premium_start_time,
    totalMinutes // passa total bruto para calcular o overlap correto
  );

  // Ajustar night minutes proporcionalmente ao tempo líquido trabalhado
  const nightWorkedMinutes = Math.min(nightMinutes, workedMinutes);
  const nightPremiumHours = nightWorkedMinutes / 60;
  const regularHours = Math.max(0, totalHours - nightPremiumHours);

  // Calcular pagamento
  const regularPay = regularHours * baseHourlyRate;
  const nightPremiumRate = shiftPolicy.night_premium_rate || 1.25;
  
  // Night premium: apenas o adicional (diferença pela porcentagem extra)
  const nightPremiumAdditional = nightPremiumHours * baseHourlyRate * (nightPremiumRate - 1.0);
  // Pagamento total das horas noturnas (base + adicional)
  const nightTotalPay = nightPremiumHours * baseHourlyRate * nightPremiumRate;
  const totalPay = regularPay + nightTotalPay;

  return {
    totalHours,
    regularHours,
    nightPremiumHours,
    regularPay,
    nightPremiumPay: nightPremiumAdditional, // Retorna apenas o adicional
    nightTotalPay, // Pagamento total das horas noturnas
    totalPay,
  };
}

/**
 * Calcula totais para uma semana inteira de time card
 * @param {object} weeklyTimeCard - Registro WeeklyTimeCard com campos monday_start, monday_end, etc.
 * @param {object} shiftPolicy - Política de turno
 * @param {number} baseHourlyRate - Taxa horária base
 * @returns {object} Totais { totalHours, regularHours, nightPremiumHours, regularPay, nightPremiumPay, totalPay, breakdown }
 */
export function calculateWeekPay(weeklyTimeCard, shiftPolicy, baseHourlyRate) {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  
  let totalHours = 0;
  let regularHours = 0;
  let nightPremiumHours = 0;
  let regularPay = 0;
  let nightPremiumPay = 0;
  let totalPay = 0;

  const breakdown = {};

  days.forEach(day => {
    const startTime = weeklyTimeCard[`${day}_start`];
    const endTime = weeklyTimeCard[`${day}_end`];
    const breakMinutes = weeklyTimeCard[`${day}_break`] || 0;
    const lunchMinutes = weeklyTimeCard[`${day}_lunch`] || 0;

    const dayCalc = calculateDayPay(startTime, endTime, breakMinutes, lunchMinutes, shiftPolicy, baseHourlyRate);

    breakdown[day] = dayCalc;

    totalHours += dayCalc.totalHours;
    regularHours += dayCalc.regularHours;
    nightPremiumHours += dayCalc.nightPremiumHours;
    regularPay += dayCalc.regularPay;
    nightPremiumPay += dayCalc.nightPremiumPay;
    totalPay += dayCalc.totalPay;
  });

  return {
    totalHours,
    regularHours,
    nightPremiumHours,
    regularPay,
    nightPremiumPay,
    totalPay,
    breakdown,
  };
}

/**
 * Calcula totais para múltiplas semanas (período de payroll completo)
 * @param {array} weeklyTimeCards - Array de registros WeeklyTimeCard
 * @param {object} shiftPolicy - Política de turno
 * @param {number} baseHourlyRate - Taxa horária base
 * @returns {object} Totais do período
 */
export function calculatePeriodPay(weeklyTimeCards, shiftPolicy, baseHourlyRate) {
  if (!weeklyTimeCards || weeklyTimeCards.length === 0) {
    return {
      totalHours: 0,
      regularHours: 0,
      nightPremiumHours: 0,
      regularPay: 0,
      nightPremiumPay: 0,
      totalPay: 0,
      weekBreakdown: [],
    };
  }

  let totalHours = 0;
  let regularHours = 0;
  let nightPremiumHours = 0;
  let regularPay = 0;
  let nightPremiumPay = 0;
  let totalPay = 0;

  const weekBreakdown = [];

  weeklyTimeCards.forEach(card => {
    const weekCalc = calculateWeekPay(card, shiftPolicy, baseHourlyRate);
    
    weekBreakdown.push({
      year: card.year,
      week_number: card.week_number,
      ...weekCalc,
    });

    totalHours += weekCalc.totalHours;
    regularHours += weekCalc.regularHours;
    nightPremiumHours += weekCalc.nightPremiumHours;
    regularPay += weekCalc.regularPay;
    nightPremiumPay += weekCalc.nightPremiumPay;
    totalPay += weekCalc.totalPay;
  });

  return {
    totalHours,
    regularHours,
    nightPremiumHours,
    regularPay,
    nightPremiumPay,
    totalPay,
    weekBreakdown,
  };
}

export default {
  calculateDayPay,
  calculateWeekPay,
  calculatePeriodPay,
};