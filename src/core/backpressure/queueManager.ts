// Queue Manager - Backpressure & Queue Fairness v1
// Manages interactive and batch queues with fairness guarantees

import { Subject } from '../../types/agentRuntime.js';

export type QueueType = 'interactive' | 'batch';
export type QueueJob<T = any> = {
  id: string;
  subject: Subject;
  priority: number; // Higher number = higher priority
  submittedAt: Date;
  payload: T;
  queueType: QueueType;
};

export type QueueStats = {
  interactive: {
    pending: number;
    active: number;
    avgWaitTime: number;
  };
  batch: {
    pending: number;
    active: number;
    avgWaitTime: number;
  };
  subjects: {
    [subject: string]: {
      pending: number;
      active: number;
      credits: number;
    };
  };
};

export class QueueManager {
  private interactiveQueue: QueueJob[] = [];
  private batchQueue: QueueJob[] = [];
  private activeJobs = new Map<string, { jobId: string; subject: Subject; startedAt: Date }>();
  
  private subjectCredits = new Map<Subject, number>();
  private subjectLimits = new Map<Subject, { maxActive: number; maxPending: number }>();
  
  private readonly maxQueueDepth: number;
  private readonly maxActiveJobs: number;
  private readonly defaultMaxActivePerSubject: number;
  private readonly creditRefreshInterval: number; // ms
  
  constructor(
    maxQueueDepth: number = 1000,
    maxActiveJobs: number = 50,
    defaultMaxActivePerSubject: number = 1,
    creditRefreshInterval: number = 60000 // 1 minute
  ) {
    this.maxQueueDepth = maxQueueDepth;
    this.maxActiveJobs = maxActiveJobs;
    this.defaultMaxActivePerSubject = defaultMaxActivePerSubject;
    this.creditRefreshInterval = creditRefreshInterval;
    
    // Start credit refresh interval
    setInterval(() => {
      this.refreshCredits();
    }, this.creditRefreshInterval);
  }
  
  /**
   * Submit a job to the appropriate queue
   * Returns true if accepted, false if rejected due to backpressure
   */
  submit<T>(job: Omit<QueueJob<T>, 'id' | 'submittedAt'>): boolean {
    // Check system-wide load
    if (this.getTotalQueueDepth() >= this.maxQueueDepth) {
      return false; // Load-shed: queue too deep
    }
    
    // Check active job limits
    if (this.activeJobs.size >= this.maxActiveJobs) {
      return false; // Load-shed: too many active jobs
    }
    
    // Check subject limits
    const subjectLimit = this.subjectLimits.get(job.subject) || { 
      maxActive: this.defaultMaxActivePerSubject, 
      maxPending: this.maxQueueDepth / 10 // 10% of total queue as default
    };
    
    const subjectActiveCount = this.getSubjectActiveCount(job.subject);
    if (subjectActiveCount >= subjectLimit.maxActive) {
      // Check if we can queue this job
      const subjectPendingCount = this.getSubjectPendingCount(job.subject);
      if (subjectPendingCount >= subjectLimit.maxPending) {
        return false; // Fairness: subject has too many pending jobs
      }
    }
    
    // Assign ID and timestamp
    const queueJob: QueueJob<T> = {
      ...job,
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      submittedAt: new Date()
    };
    
    // Add to appropriate queue
    if (job.queueType === 'interactive') {
      this.interactiveQueue.push(queueJob);
    } else {
      this.batchQueue.push(queueJob);
    }
    
    // Refresh credits for subject (they used some by submitting)
    this.updateSubjectCredits(job.subject, -1);
    
    return true;
  }
  
  /**
   * Attempt to acquire a job for processing
   * Returns job if available, null if no suitable job or fairness prevents it
   */
  acquireNext(): QueueJob | null {
    // Check if we can take more active jobs
    if (this.activeJobs.size >= this.maxActiveJobs) {
      return null; // System at capacity
    }
    
    // Prioritize interactive jobs, but ensure fairness
    const nextInteractive = this.getNextInteractiveJob();
    if (nextInteractive) {
      return this.activateJob(nextInteractive);
    }
    
    // Fall back to batch jobs
    const nextBatch = this.getNextBatchJob();
    if (nextBatch) {
      return this.activateJob(nextBatch);
    }
    
    return null;
  }
  
  /**
   * Release a job from active processing
   */
  release(jobId: string): void {
    const activeJob = this.activeJobs.get(jobId);
    if (activeJob) {
      this.activeJobs.delete(jobId);
      
      // Refund credit to subject
      this.updateSubjectCredits(activeJob.subject, 1);
    }
  }
  
  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    const now = Date.now();
    
    // Calculate average wait times
    const interactiveWaitSum = this.interactiveQueue.reduce(
      (sum, job) => sum + (now - job.submittedAt.getTime()), 0
    );
    const batchWaitSum = this.batchQueue.reduce(
      (sum, job) => sum + (now - job.submittedAt.getTime()), 0
    );
    
    return {
      interactive: {
        pending: this.interactiveQueue.length,
        active: this.getActiveCountForQueue('interactive'),
        avgWaitTime: this.interactiveQueue.length 
          ? interactiveWaitSum / this.interactiveQueue.length 
          : 0
      },
      batch: {
        pending: this.batchQueue.length,
        active: this.getActiveCountForQueue('batch'),
        avgWaitTime: this.batchQueue.length 
          ? batchWaitSum / this.batchQueue.length 
          : 0
      },
      subjects: this.getSubjectStats()
    };
  }
  
  /**
   * Set custom limits for a subject
   */
  setSubjectLimits(subject: Subject, maxActive: number, maxPending: number): void {
    this.subjectLimits.set(subject, { maxActive, maxPending });
  }
  
  private getNextInteractiveJob(): QueueJob | null {
    // Apply weighted fair scheduling within interactive queue
    // For now, simple FIFO with fairness check
    for (const job of this.interactiveQueue) {
      if (this.canSubjectTakeMore(job.subject)) {
        return job;
      }
    }
    return null;
  }
  
  private getNextBatchJob(): QueueJob | null {
    // Apply weighted fair scheduling within batch queue
    // For now, simple FIFO with fairness check
    for (const job of this.batchQueue) {
      if (this.canSubjectTakeMore(job.subject)) {
        return job;
      }
    }
    return null;
  }
  
  private canSubjectTakeMore(subject: Subject): boolean {
    const subjectLimit = this.subjectLimits.get(subject) || { 
      maxActive: this.defaultMaxActivePerSubject, 
      maxPending: this.maxQueueDepth / 10
    };
    
    const activeCount = this.getSubjectActiveCount(subject);
    return activeCount < subjectLimit.maxActive;
  }
  
  private activateJob(job: QueueJob): QueueJob {
    // Remove from queue
    if (job.queueType === 'interactive') {
      this.interactiveQueue = this.interactiveQueue.filter(j => j.id !== job.id);
    } else {
      this.batchQueue = this.batchQueue.filter(j => j.id !== job.id);
    }
    
    // Add to active jobs
    this.activeJobs.set(job.id, {
      jobId: job.id,
      subject: job.subject,
      startedAt: new Date()
    });
    
    return job;
  }
  
  private getTotalQueueDepth(): number {
    return this.interactiveQueue.length + this.batchQueue.length;
  }
  
  private getSubjectActiveCount(subject: Subject): number {
    let count = 0;
    for (const [, jobInfo] of this.activeJobs) {
      if (jobInfo.subject === subject) {
        count++;
      }
    }
    return count;
  }
  
  private getSubjectPendingCount(subject: Subject): number {
    let count = 0;
    count += this.interactiveQueue.filter(job => job.subject === subject).length;
    count += this.batchQueue.filter(job => job.subject === subject).length;
    return count;
  }
  
  private getActiveCountForQueue(queueType: QueueType): number {
    let count = 0;
    for (const [, jobInfo] of this.activeJobs) {
      // We need to determine queue type from the job ID or maintain a mapping
      // For now, we'll just count total active jobs
      count++;
    }
    return count;
  }
  
  private getSubjectStats(): QueueStats['subjects'] {
    const stats: QueueStats['subjects'] = {};
    
    // Collect all subjects from queues and active jobs
    const allSubjects = new Set<Subject>();
    
    [...this.interactiveQueue, ...this.batchQueue].forEach(job => {
      allSubjects.add(job.subject);
    });
    
    this.activeJobs.forEach(jobInfo => {
      allSubjects.add(jobInfo.subject);
    });
    
    allSubjects.forEach(subject => {
      stats[subject] = {
        pending: this.getSubjectPendingCount(subject),
        active: this.getSubjectActiveCount(subject),
        credits: this.subjectCredits.get(subject) || 0
      };
    });
    
    return stats;
  }
  
  private refreshCredits(): void {
    // Simple credit refresh - give each subject some credits periodically
    // In a real system, this would be more sophisticated
    for (const subject of this.subjectCredits.keys()) {
      const current = this.subjectCredits.get(subject) || 0;
      // Limit credits to prevent unlimited accumulation
      const newCredits = Math.min(current + 1, 5);
      this.subjectCredits.set(subject, newCredits);
    }
  }
  
  private updateSubjectCredits(subject: Subject, delta: number): void {
    const current = this.subjectCredits.get(subject) || 0;
    const newCredits = Math.max(0, current + delta); // Don't go below 0
    this.subjectCredits.set(subject, newCredits);
  }
}