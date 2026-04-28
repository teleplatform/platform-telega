// Backpressure Handler - Backpressure & Queue Fairness v1
// Provides backpressure detection and load-shedding

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { QueueManager } from './queueManager.js';
import { getAuthContext } from '../../server/middleware/auth.js';

export type BackpressureConfig = {
  maxQueueDepth: number;
  maxActiveJobs: number;
  defaultMaxActivePerSubject: number;
  creditRefreshInterval: number; // ms
};

export class BackpressureHandler {
  private queueManager: QueueManager;
  private config: BackpressureConfig;
  
  constructor(config: Partial<BackpressureConfig> = {}) {
    this.config = {
      maxQueueDepth: config.maxQueueDepth ?? 1000,
      maxActiveJobs: config.maxActiveJobs ?? 50,
      defaultMaxActivePerSubject: config.defaultMaxActivePerSubject ?? 1,
      creditRefreshInterval: config.creditRefreshInterval ?? 60000,
    };
    
    this.queueManager = new QueueManager(
      this.config.maxQueueDepth,
      this.config.maxActiveJobs,
      this.config.defaultMaxActivePerSubject,
      this.config.creditRefreshInterval
    );
  }
  
  /**
   * Middleware to check for backpressure before accepting requests
   */
  backpressureMiddleware() {
    return async (req: FastifyRequest, reply: FastifyReply) => {
      // Get subject from auth context
      const authContext = getAuthContext(req);
      if (!authContext) {
        return reply.status(401).send({
          ok: false,
          error: { code: 'UNAUTHORIZED', message: 'No valid subject found' }
        });
      }
      
      // Check if system is overloaded
      const stats = this.queueManager.getStats();
      const totalQueueDepth = stats.interactive.pending + stats.batch.pending;
      
      if (totalQueueDepth >= this.config.maxQueueDepth) {
        // Load-shed: system is overloaded
        return reply.status(503).send({
          ok: false,
          error: {
            code: 'BACKPRESSURE',
            message: 'System overloaded, please try again later',
            retry_after: 30, // seconds
          }
        });
      }
      
      // Continue with request
      return;
    };
  }
  
  /**
   * Submit a job to the queue
   */
  submitJob<T>(jobPayload: {
    subject: string;
    priority: number;
    payload: T;
    queueType: 'interactive' | 'batch';
  }): boolean {
    return this.queueManager.submit({
      subject: jobPayload.subject,
      priority: jobPayload.priority,
      payload: jobPayload.payload,
      queueType: jobPayload.queueType,
    });
  }
  
  /**
   * Acquire next job for processing
   */
  acquireNextJob() {
    return this.queueManager.acquireNext();
  }
  
  /**
   * Release a job after processing
   */
  releaseJob(jobId: string) {
    this.queueManager.release(jobId);
  }
  
  /**
   * Get current system stats
   */
  getStats() {
    return this.queueManager.getStats();
  }
  
  /**
   * Register routes for monitoring
   */
  registerRoutes(app: FastifyInstance) {
    app.get('/v1/system/backpressure/stats', async (req, reply) => {
      const stats = this.getStats();
      return reply.send({
        ok: true,
        stats,
        config: this.config,
      });
    });
  }
}