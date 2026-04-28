import { UsageLedger } from '../cost/usageLedger.js';
import { Subject } from '../../types/agentRuntime.js';

export type PlanTier = 'free' | 'pro' | 'enterprise' | 'custom';

export type PlanUsage = {
  used_micros: number;
  limit_micros: number | null;
  remaining_micros: number | null;
  pct: number | null;
  forecast_end_micros: number;
};

export type UserPlanResponse = {
  subject: {
    id: Subject;
    tier: PlanTier;
  };
  period: {
    tz: string;
    today: string;
    month: string;
  };
  usage: {
    today: PlanUsage;
    month: PlanUsage;
  };
  source: {
    ledger: 'usage-ledger-v1';
    forecast: 'calendar-deterministic-v1';
  };
};

type PlanLimits = {
  day_limit_micros: number | null;
  month_limit_micros: number | null;
};

export class UserPlanService {
  private readonly usageLedger: UsageLedger;
  private readonly tz: string;

  constructor(usageLedger: UsageLedger, timezone: string = 'Asia/Tashkent') {
    this.usageLedger = usageLedger;
    this.tz = timezone;
  }

  getPlan(subjectId: Subject, now: Date = new Date()): UserPlanResponse {
    const period = this.getPeriodKeys(now);
    const subjectEntries = this.usageLedger.getEntries({ subject: subjectId });

    let todayUsed = 0;
    let monthUsed = 0;
    for (const entry of subjectEntries) {
      const entryPeriod = this.getPeriodKeys(entry.timestamp);
      if (entryPeriod.today === period.today) {
        todayUsed += entry.costMicros;
      }
      if (entryPeriod.month === period.month) {
        monthUsed += entry.costMicros;
      }
    }

    const limits = this.getPlanLimits(subjectId);
    const dayElapsed = this.getDayElapsedSeconds(now);
    const monthElapsed = this.getMonthElapsedSeconds(now);
    const monthTotal = this.getMonthTotalSeconds(now);

    return {
      subject: {
        id: subjectId,
        tier: this.getSubjectTier(subjectId),
      },
      period,
      usage: {
        today: this.buildUsage(todayUsed, limits.day_limit_micros, dayElapsed, 86400),
        month: this.buildUsage(monthUsed, limits.month_limit_micros, monthElapsed, monthTotal),
      },
      source: {
        ledger: 'usage-ledger-v1',
        forecast: 'calendar-deterministic-v1',
      },
    };
  }

  private buildUsage(
    usedMicros: number,
    limitMicros: number | null,
    elapsedSeconds: number,
    totalSeconds: number
  ): PlanUsage {
    const remainingMicros = limitMicros === null ? null : Math.max(0, limitMicros - usedMicros);
    const pct = limitMicros === null || limitMicros <= 0
      ? null
      : Math.min(100, Math.round((usedMicros / limitMicros) * 10000) / 100);
    const safeElapsed = Math.max(1, elapsedSeconds);
    const forecastEndMicros = Math.round((usedMicros / safeElapsed) * totalSeconds);

    return {
      used_micros: usedMicros,
      limit_micros: limitMicros,
      remaining_micros: remainingMicros,
      pct,
      forecast_end_micros: Math.max(usedMicros, forecastEndMicros),
    };
  }

  private getPeriodKeys(date: Date): { tz: string; today: string; month: string } {
    const dayFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const monthFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.tz,
      year: 'numeric',
      month: '2-digit',
    });

    return {
      tz: this.tz,
      today: dayFormatter.format(date),
      month: monthFormatter.format(date),
    };
  }

  private getParts(date: Date): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const read = (type: string): number => Number(parts.find((part) => part.type === type)?.value ?? '0');

    return {
      year: read('year'),
      month: read('month'),
      day: read('day'),
      hour: read('hour'),
      minute: read('minute'),
      second: read('second'),
    };
  }

  private getDayElapsedSeconds(now: Date): number {
    const p = this.getParts(now);
    return p.hour * 3600 + p.minute * 60 + p.second;
  }

  private getMonthElapsedSeconds(now: Date): number {
    const p = this.getParts(now);
    return (p.day - 1) * 86400 + this.getDayElapsedSeconds(now);
  }

  private getMonthTotalSeconds(now: Date): number {
    const p = this.getParts(now);
    const daysInMonth = new Date(Date.UTC(p.year, p.month, 0)).getUTCDate();
    return daysInMonth * 86400;
  }

  private getSubjectTier(subjectId: Subject): PlanTier {
    if (subjectId.includes('enterprise')) {
      return 'enterprise';
    }
    if (subjectId.includes('pro')) {
      return 'pro';
    }
    if (subjectId.includes('custom')) {
      return 'custom';
    }
    return 'free';
  }

  /**
   * TECHNICAL DEBT: Limits are derived from subject naming conventions.
   * Integrate with the canonical billing/plan repository once available.
   */
  private getPlanLimits(subjectId: Subject): PlanLimits {
    const tier = this.getSubjectTier(subjectId);
    if (tier === 'pro') {
      return { day_limit_micros: 10000000, month_limit_micros: 100000000 };
    }
    if (tier === 'enterprise') {
      return { day_limit_micros: null, month_limit_micros: null };
    }
    if (tier === 'custom') {
      return { day_limit_micros: null, month_limit_micros: 500000000 };
    }
    return { day_limit_micros: 1000000, month_limit_micros: 5000000 };
  }
}
