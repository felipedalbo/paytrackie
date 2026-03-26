import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock } from 'lucide-react';
import { format, startOfWeek, addDays, getISOWeek } from 'date-fns';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function WeeklyTimeCard({ 
  timeData, 
  onTimeChange, 
  isLocked,
  isAdmin,
  selectedYear,
  selectedMonth,
  selectedWeek,
  weekendData = {}
}) {
  const getDateForDay = (dayIndex) => {
    // Calculate the date for each day of the selected week
    const firstDayOfMonth = new Date(selectedYear, selectedMonth - 1, 1);
    const weekStart = addDays(firstDayOfMonth, (selectedWeek - 1) * 7);
    const monday = startOfWeek(weekStart, { weekStartsOn: 1 });
    return addDays(monday, dayIndex);
  };
  const formatTime12h = (time24) => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours);
    const period = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${hour12}:${minutes} ${period}`;
  };

  const convertTo24h = (time12) => {
    if (!time12) return '';
    const match = time12.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return time12;
    
    let [_, hours, minutes, period] = match;
    hours = parseInt(hours);
    
    if (period.toUpperCase() === 'PM' && hours !== 12) {
      hours += 12;
    } else if (period.toUpperCase() === 'AM' && hours === 12) {
      hours = 0;
    }
    
    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  };

  const isWeekendDay = (day) => day === 'Saturday' || day === 'Sunday';

  // Get week number from the first day (Monday)
  const weekNumber = getISOWeek(getDateForDay(0));

  return (
    <Card className="border-2 border-slate-200">
      <CardHeader>
        <CardTitle className="text-lg">Weekly Time Card - Week {weekNumber}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-2 text-sm font-semibold text-slate-700">Day</th>
                <th className="text-left py-3 px-2 text-sm font-semibold text-slate-700">Start Time</th>
                <th className="text-left py-3 px-2 text-sm font-semibold text-slate-700">End Time</th>
                <th className="text-left py-3 px-2 text-sm font-semibold text-slate-700">Break (min)</th>
                <th className="text-left py-3 px-2 text-sm font-semibold text-slate-700">Lunch (min)</th>
              </tr>
            </thead>
            <tbody>
              {DAYS.map((day, index) => {
                const dayDate = getDateForDay(index);
                const dateStr = format(dayDate, 'yyyy-MM-dd');
                const isWeekend = isWeekendDay(day);
                const weekendInfo = weekendData[dateStr];
                
                // Use weekend data if available for Saturday/Sunday
                const startTime = isWeekend && weekendInfo ? weekendInfo.start_time : timeData[`${day.toLowerCase()}_start`];
                const endTime = isWeekend && weekendInfo ? weekendInfo.end_time : timeData[`${day.toLowerCase()}_end`];
                const breakMin = isWeekend && weekendInfo ? weekendInfo.break_minutes : timeData[`${day.toLowerCase()}_break`];
                const lunchMin = isWeekend && weekendInfo ? weekendInfo.lunch_minutes : timeData[`${day.toLowerCase()}_lunch`];

                return (
                  <tr 
                    key={day} 
                    className={`border-b border-slate-100 ${isWeekend ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                  >
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="text-sm font-semibold text-slate-700">{day}</div>
                          <div className="text-xs text-slate-500">{format(dayDate, 'MMM d, yyyy')}</div>
                        </div>
                      </div>
                    </td>
                    
                    <td className="py-3 px-2">
                      <Input
                        type="time"
                        value={startTime || ''}
                        onChange={(e) => onTimeChange(`${day.toLowerCase()}_start`, e.target.value)}
                        className="h-9 w-32"
                      />
                      {startTime && (
                        <p className="text-xs text-slate-400 mt-1">
                          {formatTime12h(startTime)}
                        </p>
                      )}
                    </td>

                    <td className="py-3 px-2">
                      <Input
                        type="time"
                        value={endTime || ''}
                        onChange={(e) => onTimeChange(`${day.toLowerCase()}_end`, e.target.value)}
                        className="h-9 w-32"
                      />
                      {endTime && (
                        <p className="text-xs text-slate-400 mt-1">
                          {formatTime12h(endTime)}
                        </p>
                      )}
                    </td>

                    <td className="py-3 px-2">
                      <div>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={breakMin || 0}
                          onChange={(e) => onTimeChange(`${day.toLowerCase()}_break`, parseInt(e.target.value) || 0)}
                          className="h-9 w-32"
                          placeholder="30"
                        />
                        <div className="h-5 mt-1"></div>
                      </div>
                    </td>

                    <td className="py-3 px-2">
                      <div>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={lunchMin || 0}
                          onChange={(e) => onTimeChange(`${day.toLowerCase()}_lunch`, parseInt(e.target.value) || 0)}
                          className="h-9 w-32"
                          placeholder="60"
                        />
                        <div className="h-5 mt-1"></div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}