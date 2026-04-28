// User Dashboard Service - Layer K1.1
// Provides user-facing usage metrics and insights

import { AgentSessionId, Subject } from '../../types/agentRuntime.js';
import { UsageLedger } from '../cost/usageLedger.js';
import { OpsSignalsEngine, type OpsSignal } from '../ops-intelligence/opsSignals.js';

export type UsagePeriod = 'today' | 'month';
export type DashboardInsightLevel = 'info' | 'warning';

export type DashboardUsage = {
  used_micros: number;
  limit_micros: number;
  pct: number | null; // 0-100, null when no limit
};

export type DashboardSession = {
  sid: AgentSessionId;
  status: 'running' | 'queued' | 'denied' | 'done';
  started_at: string;
  updated_at: string;
  cost_micros: number;
};

export type DashboardInsight = {
  level: DashboardInsightLevel;
  message: string;
};

export type UserDashboardResponse = {
  subject: {
    id: Subject;
    tier: 'free' | 'pro' | 'enterprise' | 'custom';
  };
  period: {
    tz: string;
    today: string; // YYYY-MM-DD
    month: string; // YYYY-MM
  };
  usage: {
    today: DashboardUsage;
    month: DashboardUsage;
  };
  active_sessions: DashboardSession[];
  insight: DashboardInsight;
};

export type PlanLimits = {
  day_limit_micros: number | null;
  month_limit_micros: number | null;
};

export class UserDashboardService {
  private usageLedger: UsageLedger;
  private opsSignalsEngine: OpsSignalsEngine;
  private tz: string;
  
  constructor(usageLedger: UsageLedger, opsSignalsEngine: OpsSignalsEngine, timezone: string = 'Asia/Tashkent') {
    this.usageLedger = usageLedger;
    this.opsSignalsEngine = opsSignalsEngine;
    this.tz = timezone;
  }
  
  /**
   * Get user dashboard data
   */
  async getDashboard(subjectId: Subject): Promise<UserDashboardResponse> {
    // Calculate date ranges
    const { startDay, startMonth, todayStr, monthStr } = this.calculateDateRanges();
    
    // Get usage data in parallel
    const [todayUsed, monthUsed] = await Promise.all([
      this.getUsageForPeriod(subjectId, startDay, new Date()),
      this.getUsageForPeriod(subjectId, startMonth, new Date())
    ]);
    
    // Get plan limits
    const limits = this.getPlanLimits(subjectId);
    
    // Get active sessions
    const activeSessions = await this.getActiveSessions(subjectId);
    
    // Get user-safe insight
    const insight = this.getUserSafeInsight(subjectId);
    
    // Calculate percentages with proper precision
    const todayPct = limits.day_limit_micros && limits.day_limit_micros > 0
      ? Math.min(100, Math.round((todayUsed / limits.day_limit_micros) * 10000) / 100)
      : null;
      
    const monthPct = limits.month_limit_micros && limits.month_limit_micros > 0
      ? Math.min(100, Math.round((monthUsed / limits.month_limit_micros) * 10000) / 100)
      : null;
    
    return {
      subject: {
        id: subjectId,
        tier: this.getSubjectTier(subjectId)
      },
      period: {
        tz: this.tz,
        today: todayStr,
        month: monthStr
      },
      usage: {
        today: {
          used_micros: todayUsed,
          limit_micros: limits.day_limit_micros || 0,
          pct: todayPct
        },
        month: {
          used_micros: monthUsed,
          limit_micros: limits.month_limit_micros || 0,
          pct: monthPct
        }
      },
      active_sessions: activeSessions,
      insight
    };
  }
  
  /**
   * Calculate date ranges for today and month
   */
  private calculateDateRanges(): {
    startDay: Date;
    startMonth: Date;
    todayStr: string;
    monthStr: string;
  } {
    const now = new Date();
    
    // Get today's start (00:00:00 in specified timezone)
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    
    // Get month start (00:00:00 on 1st day of month)
    const monthStart = new Date(now);
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    
    // Format as strings
    const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
    const monthStr = monthStart.toISOString().slice(0, 7); // YYYY-MM
    
    return {
      startDay: today,
      startMonth: monthStart,
      todayStr,
      monthStr
    };
  }
  
  /**
   * Get usage for a specific period
   */
  private async getUsageForPeriod(subjectId: Subject, from: Date, to: Date): Promise<number> {
    // In a real implementation, this would query the ledger with date filters
    // For now, we'll aggregate from the in-memory ledger
    const entries = this.usageLedger.getEntries({
      subject: subjectId,
      startDate: from,
      endDate: to
    });
    
    return entries.reduce((sum, entry) => sum + entry.costMicros, 0);
  }
  
  /**
   * Get plan limits for a subject
   * 
   * TECHNICAL DEBT: Currently returns mock data
   * TODO: Replace with actual plan/subscription system integration
   * - Query user subscription table
   * - Get real plan limits from billing system
   * - Handle custom enterprise limits
   * - Support dynamic limit adjustments
   */
  private getPlanLimits(subjectId: Subject): PlanLimits {
    // This would integrate with the actual plan/subscription system
    // For now, returning mock limits based on subject ID
    if (subjectId.includes('pro')) {
      return {
        day_limit_micros: 10000000, // 10 Teletons
        month_limit_micros: 100000000 // 100 Teletons
      };
    } else if (subjectId.includes('enterprise')) {
      return {
        day_limit_micros: 100000000, // 100 Teletons
        month_limit_micros: 1000000000 // 1000 Teletons
      };
    } else {
      // Free tier
      return {
        day_limit_micros: 1000000, // 1 Teleton
        month_limit_micros: 5000000 // 5 Teletons
      };
    }
  }
  
  /**
   * Get subject tier
   */
  private getSubjectTier(subjectId: Subject): 'free' | 'pro' | 'enterprise' | 'custom' {
    if (subjectId.includes('enterprise')) {
      return 'enterprise';
    } else if (subjectId.includes('pro')) {
      return 'pro';
    } else if (subjectId.includes('custom')) {
      return 'custom';
    } else {
      return 'free';
    }
  }
  
  /**
   * Get active sessions for a subject
   * 
   * TECHNICAL DEBT: Currently returns mock data
   * TODO: Replace with actual session repository query
   * - Query sessions table with subject_id filter
   * - Filter by active statuses (running, queued, denied, done)
   * - Sort by updated_at DESC
   * - Limit to 5 results
   * - Calculate real session costs from ledger
   */
  private async getActiveSessions(subjectId: Subject): Promise<DashboardSession[]> {
    // This would query the actual session repository
    // For now, returning mock data
    
    return [
      {
        sid: `sess-${subjectId.substring(0, 8)}-001` as AgentSessionId,
        status: 'running',
        started_at: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
        updated_at: new Date().toISOString(),
        // TECHNICAL DEBT: Mock cost - should query ledger for actual session cost
        cost_micros: 12500 // 0.0125 Teletons
      },
      {
        sid: `sess-${subjectId.substring(0, 8)}-002` as AgentSessionId,
        status: 'done',
        started_at: new Date(Date.now() - 1800000).toISOString(), // 30 minutes ago
        updated_at: new Date(Date.now() - 1500000).toISOString(), // 25 minutes ago
        // TECHNICAL DEBT: Mock cost - should query ledger for actual session cost
        cost_micros: 8750 // 0.00875 Teletons
      }
    ];
  }
  
  /**
   * Get user-safe insight from operational signals
   */
  private getUserSafeInsight(subjectId: Subject): DashboardInsight {
    // Get active signals for this subject
    const activeSignals = this.opsSignalsEngine.getActiveSignals();
    
    // Filter signals relevant to this subject
    // In a real implementation, signals would be tagged with subject IDs
    const subjectSignals = activeSignals.filter(signal => {
      // For demo purposes, we'll show a signal if it's a warning or critical
      // and relates to general system health
      return signal.severity !== 'info' && 
             (signal.category === 'capacity' || signal.category === 'cost');
    });
    
    if (subjectSignals.length > 0) {
      // Get the most severe signal
      const mostSevere = subjectSignals.reduce((prev, current) => {
        const severityOrder = { critical: 3, warning: 2, info: 1 };
        return severityOrder[current.severity] > severityOrder[prev.severity] ? current : prev;
      });
      
      return {
        level: mostSevere.severity === 'critical' ? 'warning' : 'info',
        message: this.adaptSignalForUser(mostSevere)
      };
    }
    
    // No active signals - return normal status
    return {
      level: 'info',
      message: 'Всё работает штатно'
    };
  }
  
  /**
   * Adapt operational signal message for user consumption
   * Removes internal codes and technical details
   */
  private adaptSignalForUser(signal: OpsSignal): string {
    // Remove internal technical terms and codes
    let message = signal.summary;
    
    // Replace technical terms with user-friendly language
    message = message
      .replace(/deny rate/gi, 'отказы')
      .replace(/queue depth/gi, 'нагрузка')
      .replace(/backpressure/gi, 'перегрузка')
      .replace(/cost spike/gi, 'повышенные расходы')
      .replace(/tools cost/gi, 'расходы на инструменты')
      .replace(/\d+\.\d+\/min/g, '') // Remove rate numbers
      .replace(/\d+\/\d+/g, '') // Remove ratio numbers
      .replace(/\(.+?\)/g, '') // Remove parentheses
      .replace(/\d+\s*(micros|tokens|calls)/gi, '') // Remove technical units
      .trim();
    
    // Add context based on severity
    if (signal.severity === 'critical') {
      return `Важно: ${message}. Возможны временные задержки.`;
    } else if (signal.severity === 'warning') {
      return `Внимание: ${message}. Рекомендуем следить за использованием.`;
    }
    
    return message;
  }
}