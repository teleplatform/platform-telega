// User Session Service - Layer K1.2
// Provides user-safe session details with explain and receipt adapters

import { AgentSessionId, Subject } from '../../types/agentRuntime.js';
import { UsageLedger } from '../cost/usageLedger.js';
import { ExplainService, type DecisionResponse } from '../observability/explainService.js';
import { ReceiptService, type ReceiptResponse } from '../observability/receiptService.js';
import { AgentSessionManager } from '../agent/runtime/agentSession.js';
import { FileOwnershipStorage } from '../agent/runtime/ownershipStorage.js';

export type UserSessionStatus = 'running' | 'queued' | 'denied' | 'done' | 'failed' | 'terminated';

export type UserSessionSummary = {
  sid: AgentSessionId;
  status: UserSessionStatus;
  startedAt: string;
  updatedAt: string;
  summary: string; // Human-readable description of what was done
};

export type UserSafeExplain = {
  decision: 'allow' | 'deny' | 'stop' | 'completed';
  reason: string; // Human-readable reason (no internal codes)
  explanation: string; // User-friendly explanation
  suggestedActions: string[]; // Actionable user suggestions
};

export type UserSafeReceipt = {
  totalCostMicros: number;
  breakdown: {
    model: {
      tokensIn: number;
      tokensOut: number;
      costMicros: number;
    };
    tools: {
      count: number;
      costMicros: number;
      details: {
        kind: string;
        count: number;
        costMicros: number;
      }[];
    };
    storage: {
      bytes: number;
      costMicros: number;
    };
    compute: {
      durationMs: number;
      costMicros: number;
    };
  };
  // No internal identifiers like ledgerRefs
  // TECHNICAL DEBT: Cost display formatting should be consistent
  // TODO: Add display formatting fields (formattedCost, costCurrency)
};

export type UserSessionProgress = {
  percentage?: number; // 0-100 if calculable
  stepCount?: {
    current: number;
    total?: number; // undefined if unknown
  };
  status: 'in_progress' | 'completed' | 'pending';
};

export type UserSessionDetailResponse = {
  session: UserSessionSummary;
  explain: UserSafeExplain;
  receipt: UserSafeReceipt;
  progress: UserSessionProgress;
  ctaHint: string; // Call-to-action hint for next steps
};

export class UserSessionService {
  private usageLedger: UsageLedger;
  private explainService: ExplainService;
  private receiptService: ReceiptService;
  private sessionManager: AgentSessionManager;
  private ownershipStorage: FileOwnershipStorage;
  
  constructor(
    usageLedger: UsageLedger,
    explainService: ExplainService,
    receiptService: ReceiptService,
    sessionManager: AgentSessionManager,
    ownershipStorage: FileOwnershipStorage
  ) {
    this.usageLedger = usageLedger;
    this.explainService = explainService;
    this.receiptService = receiptService;
    this.sessionManager = sessionManager;
    this.ownershipStorage = ownershipStorage;
  }
  
  /**
   * Get user-safe session details
   */
  async getSessionDetail(
    sessionId: AgentSessionId,
    subjectId: Subject
  ): Promise<UserSessionDetailResponse> {
    // Verify ownership first (security invariant)
    const isOwner = await this.ownershipStorage.verifyOwnership(sessionId, subjectId);
    if (!isOwner) {
      throw new Error('FORBIDDEN: Not owner of session');
    }
    
    // Get session from manager
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error('NOT_FOUND: Session not found');
    }
    
    // Get raw explain and receipt
    const rawExplain = this.explainService.getDecisionExplanation(sessionId);
    const rawReceipt = this.receiptService.generateReceipt(sessionId);
    
    // Convert to user-safe formats
    const userSession = this.createUserSessionSummary(sessionId, session, rawReceipt);
    const userExplain = this.createUserSafeExplain(rawExplain, session.state);
    const userReceipt = this.createUserSafeReceipt(rawReceipt);
    const userProgress = this.createUserProgress(sessionId, session);
    const ctaHint = this.generateCtaHint(userSession.status, userExplain.decision);
    
    return {
      session: userSession,
      explain: userExplain,
      receipt: userReceipt,
      progress: userProgress,
      ctaHint
    };
  }
  
  /**
   * Create user-safe session summary
   */
  private createUserSessionSummary(
    sessionId: AgentSessionId,
    session: any, // AgentSession type
    receipt: ReceiptResponse
  ): UserSessionSummary {
    // Map internal status to user-friendly status
    let userStatus: UserSessionStatus;
    switch (session.state) {
      case 'created':
      case 'queued':
        userStatus = 'queued';
        break;
      case 'active':
      case 'running':
        userStatus = 'running';
        break;
      case 'completed':
        userStatus = 'done';
        break;
      case 'failed':
        userStatus = 'failed';
        break;
      case 'terminated':
        userStatus = 'terminated';
        break;
      default:
        userStatus = 'done';
    }
    
    // Generate human-readable summary based on receipt
    const summary = this.generateSessionSummary(receipt);
    
    return {
      sid: sessionId,
      status: userStatus,
      startedAt: session.created_at,
      updatedAt: session.updated_at || session.created_at,
      summary
    };
  }
  
  /**
   * Generate human-readable session summary
   * 
   * TECHNICAL DEBT: Cost formatting and language pluralization
   * TODO: Proper Russian pluralization rules for all units
   * TODO: Consistent rounding for cost display
   */
  private generateSessionSummary(receipt: ReceiptResponse): string {
    const breakdown = receipt.breakdown;
    const totalCost = receipt.totalCostMicros;
    
    // If no cost, it was likely denied or queued
    if (totalCost === 0) {
      if (breakdown.tools.count > 0) {
        return `Сессия завершена с ошибкой инструментов`;
      }
      return `Сессия завершена без расходов`;
    }
    
    // Generate summary based on what was used
    const parts = [];
    
    if (breakdown.model.tokensIn > 0 || breakdown.model.tokensOut > 0) {
      const totalTokens = breakdown.model.tokensIn + breakdown.model.tokensOut;
      // Proper Russian pluralization for tokens
      const tokenWord = this.getPluralForm(totalTokens, 'токен', 'токена', 'токенов');
      parts.push(`${totalTokens} ${tokenWord}`);
    }
    
    if (breakdown.tools.count > 0) {
      // Proper Russian pluralization for tool calls
      const toolWord = this.getPluralForm(breakdown.tools.count, 'вызов', 'вызова', 'вызовов');
      const instrumentWord = this.getPluralForm(breakdown.tools.count, 'инструмента', 'инструментов', 'инструментов');
      parts.push(`${breakdown.tools.count} ${toolWord} ${instrumentWord}`);
    }
    
    if (breakdown.storage.bytes > 0) {
      const mb = Math.round(breakdown.storage.bytes / (1024 * 1024) * 100) / 100;
      // Proper Russian pluralization for MB
      const mbWord = this.getPluralForm(Math.floor(mb), 'мегабайт', 'мегабайта', 'мегабайт');
      parts.push(`${mb} ${mbWord} данных`);
    }
    
    if (parts.length === 0) {
      return `Сессия завершена`;
    }
    
    // Convert to Teletons for display with consistent rounding
    const teletons = totalCost / 1000000;
    let costStr: string;
    
    if (teletons >= 1) {
      // For 1+ Teletons, show 2 decimal places
      costStr = `${teletons.toFixed(2)} ${this.getPluralForm(Math.floor(teletons), 'Teleton', 'Teletonа', 'Teletonов')}`;
    } else if (teletons >= 0.01) {
      // For 0.01-0.99 Teletons, show 2 decimal places
      costStr = `${teletons.toFixed(2)} ${this.getPluralForm(Math.floor(teletons * 100), 'цент', 'цента', 'центов')}`;
    } else {
      // For very small amounts, show in micros
      costStr = `${totalCost} ${this.getPluralForm(totalCost, 'микротелетон', 'микротелетона', 'микротелетонов')}`;
    }
    
    return `Использовано: ${parts.join(', ')}, стоимость ${costStr}`;
  }
  
  /**
   * Get proper Russian plural form
   * 
   * TECHNICAL DEBT: This is a simplified implementation
   * TODO: Use proper i18n library for complex pluralization
   */
  private getPluralForm(count: number, one: string, few: string, many: string): string {
    const lastDigit = count % 10;
    const lastTwoDigits = count % 100;
    
    // Handle exceptions (11-14)
    if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
      return many;
    }
    
    // Handle 1
    if (lastDigit === 1) {
      return one;
    }
    
    // Handle 2-4
    if (lastDigit >= 2 && lastDigit <= 4) {
      return few;
    }
    
    // Handle 5-9, 0
    return many;
  }
  
  /**
   * Create user-safe explain (removes internal codes and technical details)
   * 
   * TECHNICAL DEBT: Decision logic needs context-aware mapping
   * TODO: Consider session status when determining user-facing decision
   */
  private createUserSafeExplain(rawExplain: DecisionResponse, sessionStatus?: string): UserSafeExplain {
    // Map internal decision to user-friendly terms with context awareness
    let userDecision: 'allow' | 'deny' | 'stop' | 'completed';
    let userReason: string;
    let userExplanation: string;
    let suggestedActions: string[] = [];
    
    // Context-aware decision mapping
    if (sessionStatus === 'done' || sessionStatus === 'completed') {
      // Session completed successfully - show as completed regardless of internal decision
      userDecision = 'completed';
      userReason = 'Сессия завершена';
      userExplanation = 'Операция успешно выполнена. Сессия завершена.';
      suggestedActions = ['Вернитесь в дашборд для продолжения работы'];
    } else {
      // Map based on internal decision for active/failed sessions
      switch (rawExplain.decision) {
        case 'allow':
          userDecision = 'allow';
          userReason = 'Операция разрешена';
          userExplanation = 'Система одобрила ваш запрос. Можно продолжать работу.';
          suggestedActions = ['Продолжайте использовать платформу'];
          break;
          
        case 'deny':
          userDecision = 'deny';
          userReason = this.adaptReasonForUser(rawExplain.rule, rawExplain.reasonCode);
          userExplanation = this.adaptExplanationForUser(rawExplain.humanSummary, rawExplain.rule);
          suggestedActions = this.adaptSuggestionsForUser(rawExplain.suggestedFix, rawExplain.rule);
          break;
          
        case 'stop':
          userDecision = 'stop';
          userReason = 'Операция остановлена';
          userExplanation = 'Система временно остановила выполнение. Это может быть связано с ограничениями или техническими проблемами.';
          suggestedActions = ['Попробуйте позже', 'Проверьте лимиты использования', 'Обратитесь в поддержку при повторении'];
          break;
          
        default:
          userDecision = 'completed';
          userReason = 'Операция завершена';
          userExplanation = 'Сессия завершена.';
          suggestedActions = ['Вернитесь в дашборд'];
      }
    }
    
    return {
      decision: userDecision,
      reason: userReason,
      explanation: userExplanation,
      suggestedActions
    };
  }
  
  /**
   * Adapt internal reason codes to user-friendly messages
   */
  private adaptReasonForUser(rule: string, reasonCode: string): string {
    const reasonMap: Record<string, string> = {
      'rate_limit': 'Превышен лимит запросов',
      'quota': 'Исчерпан квота использования',
      'backpressure': 'Система перегружена',
      'budget': 'Превышен бюджет',
      'tool_budget': 'Превышен лимит на инструменты',
      'recovery': 'Сессия в восстановлении',
      'max_steps': 'Достигнут лимит шагов',
      'timeout': 'Превышено время ожидания',
      'concurrency_limit': 'Превышен лимит параллельных операций'
    };
    
    return reasonMap[rule] || 'Операция отклонена';
  }
  
  /**
   * Adapt technical explanations to user-friendly language
   */
  private adaptExplanationForUser(humanSummary: string, rule: string): string {
    // Remove technical details and internal terminology
    let explanation = humanSummary
      .replace(/queue depth \([^)]+\)/gi, 'высокая нагрузка на систему')
      .replace(/budget exceeded.*?micros/gi, 'превышен лимит бюджета')
      .replace(/system overload/gi, 'система перегружена')
      .replace(/request rate exceeded/gi, 'слишком много запросов')
      .replace(/usage quota limit reached/gi, 'достигнут лимит использования')
      .replace(/internal.*?(?:error|failure)/gi, 'техническая проблема')
      .replace(/trace_ids?:\s*\[[^\]]*\]/gi, '')
      .replace(/rule:\s*\w+/gi, '')
      .replace(/reasonCode:\s*\w+/gi, '')
      .trim();
    
    // Add user-friendly context
    switch (rule) {
      case 'rate_limit':
        return `${explanation}. Система ограничивает частоту запросов для стабильной работы.`;
      case 'budget':
        return `${explanation}. Это защита от неожиданных расходов.`;
      case 'backpressure':
        return `${explanation}. Система временно ограничивает новые запросы.`;
      default:
        return explanation;
    }
  }
  
  /**
   * Adapt technical suggestions to user-friendly actions
   */
  private adaptSuggestionsForUser(suggestedFix: string[], rule: string): string[] {
    const userActions: string[] = [];
    
    for (const fix of suggestedFix) {
      let userFix = fix
        .replace(/Retry after.*?delay/gi, 'Попробуйте повторить позже')
        .replace(/Reduce.*?requests/gi, 'Уменьшите количество запросов')
        .replace(/Check.*?settings/gi, 'Проверьте настройки')
        .replace(/Increase.*?budget/gi, 'Увеличьте бюджет')
        .replace(/Optimize.*?usage/gi, 'Оптимизируйте использование')
        .replace(/Contact.*?support/gi, 'Обратитесь в поддержку')
        .trim();
      
      if (userFix) {
        userActions.push(userFix);
      }
    }
    
    // Add default actions based on rule
    if (userActions.length === 0) {
      switch (rule) {
        case 'rate_limit':
          userActions.push('Попробуйте повторить через несколько минут');
          break;
        case 'budget':
          userActions.push('Проверьте текущие лимиты в дашборде');
          userActions.push('Рассмотрите увеличение бюджета');
          break;
        default:
          userActions.push('Попробуйте повторить позже');
          userActions.push('Проверьте дашборд для дополнительной информации');
      }
    }
    
    return userActions;
  }
  
  /**
   * Create user-safe receipt (removes internal identifiers)
   */
  private createUserSafeReceipt(rawReceipt: ReceiptResponse): UserSafeReceipt {
    // Copy breakdown structure but remove ledgerRefs and internal identifiers
    return {
      totalCostMicros: rawReceipt.totalCostMicros,
      breakdown: {
        model: { ...rawReceipt.breakdown.model },
        tools: { ...rawReceipt.breakdown.tools },
        storage: { ...rawReceipt.breakdown.storage },
        compute: { ...rawReceipt.breakdown.compute }
      }
    };
  }
  
  /**
   * Create user progress information
   */
  private createUserProgress(sessionId: AgentSessionId, session: any): UserSessionProgress {
    // This would integrate with actual progress tracking
    // For now, providing basic status-based progress
    
    switch (session.state) {
      case 'created':
      case 'queued':
        return {
          percentage: 0,
          status: 'pending'
        };
        
      case 'active':
      case 'running':
        // In a real implementation, this would track actual progress
        // For now, we'll show indeterminate progress
        return {
          status: 'in_progress'
        };
        
      case 'completed':
        return {
          percentage: 100,
          status: 'completed'
        };
        
      case 'failed':
      case 'terminated':
        return {
          percentage: 100, // Show completion even for failures
          status: 'completed'
        };
        
      default:
        return {
          status: 'completed'
        };
    }
  }
  
  /**
   * Generate call-to-action hint based on session status and decision
   */
  private generateCtaHint(status: UserSessionStatus, decision: 'allow' | 'deny' | 'stop' | 'completed'): string {
    if (decision === 'deny' || status === 'failed' || status === 'terminated') {
      return 'Попробуйте изменить параметры запроса или увеличить лимиты';
    }
    
    if (decision === 'completed') {
      return 'Вернитесь в дашборд для продолжения работы';
    }
    
    if (status === 'running' || status === 'queued') {
      return 'Дождитесь завершения операции';
    }
    
    return 'Вернитесь в дашборд для продолжения работы';
  }
}