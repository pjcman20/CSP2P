/**
 * Rate Limiter for Steam API Requests
 * Implements exponential backoff and request queuing
 * 
 * NOTE: This is currently NOT USED because Steam blocks cloud IPs entirely.
 * This is here for future use with residential proxies or browser extensions.
 */

interface RateLimitConfig {
  maxRequestsPerMinute: number;
  baseBackoffMs: number;
  maxBackoffMs: number;
  retryAttempts: number;
}

interface QueuedRequest {
  execute: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  attemptCount: number;
  priority: number;
}

class RateLimiter {
  private queue: QueuedRequest[] = [];
  private requestTimestamps: number[] = [];
  private isProcessing = false;
  private backoffUntil: number = 0;
  
  constructor(private config: RateLimitConfig) {}

  /**
   * Add a request to the queue
   */
  async queueRequest<T>(
    execute: () => Promise<T>,
    priority: number = 0
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        execute,
        resolve,
        reject,
        attemptCount: 0,
        priority,
      });

      // Sort by priority (higher priority first)
      this.queue.sort((a, b) => b.priority - a.priority);

      this.processQueue();
    });
  }

  /**
   * Process queued requests with rate limiting
   */
  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    
    this.isProcessing = true;

    while (this.queue.length > 0) {
      // Check if we're in backoff period
      if (Date.now() < this.backoffUntil) {
        const waitTime = this.backoffUntil - Date.now();
        console.log(`⏳ Rate limiter: Backing off for ${waitTime}ms`);
        await this.sleep(waitTime);
      }

      // Check rate limit
      if (!this.canMakeRequest()) {
        const waitTime = this.getWaitTime();
        console.log(`⏳ Rate limiter: Waiting ${waitTime}ms for rate limit`);
        await this.sleep(waitTime);
        continue;
      }

      const request = this.queue.shift()!;
      
      try {
        this.recordRequest();
        const result = await request.execute();
        request.resolve(result);
      } catch (error: any) {
        // Handle rate limiting
        if (error?.status === 429 || error?.message?.includes('429')) {
          console.warn('⚠️ Rate limit hit (429), implementing exponential backoff');
          
          request.attemptCount++;
          
          if (request.attemptCount < this.config.retryAttempts) {
            // Calculate exponential backoff
            const backoffMs = Math.min(
              this.config.baseBackoffMs * Math.pow(2, request.attemptCount),
              this.config.maxBackoffMs
            );
            
            this.backoffUntil = Date.now() + backoffMs;
            
            // Re-queue the request
            this.queue.unshift(request);
            
            console.log(`🔄 Retrying request (attempt ${request.attemptCount}/${this.config.retryAttempts}) after ${backoffMs}ms`);
          } else {
            console.error('❌ Max retry attempts reached');
            request.reject(new Error('Max retry attempts exceeded'));
          }
        } else {
          request.reject(error);
        }
      }
    }

    this.isProcessing = false;
  }

  /**
   * Check if we can make a request without exceeding rate limit
   */
  private canMakeRequest(): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Clean old timestamps
    this.requestTimestamps = this.requestTimestamps.filter(t => t > oneMinuteAgo);
    
    return this.requestTimestamps.length < this.config.maxRequestsPerMinute;
  }

  /**
   * Get wait time until next request is allowed
   */
  private getWaitTime(): number {
    if (this.requestTimestamps.length === 0) return 0;
    
    const oldestTimestamp = this.requestTimestamps[0];
    const timeSinceOldest = Date.now() - oldestTimestamp;
    const waitTime = Math.max(0, 60000 - timeSinceOldest);
    
    return waitTime;
  }

  /**
   * Record that a request was made
   */
  private recordRequest() {
    this.requestTimestamps.push(Date.now());
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get stats about the rate limiter
   */
  getStats() {
    return {
      queueLength: this.queue.length,
      requestsInLastMinute: this.requestTimestamps.length,
      isBackedOff: Date.now() < this.backoffUntil,
      backoffEndsIn: Math.max(0, this.backoffUntil - Date.now()),
    };
  }

  /**
   * Clear the queue and reset state
   */
  reset() {
    this.queue = [];
    this.requestTimestamps = [];
    this.backoffUntil = 0;
  }
}

// Create singleton instance with Steam-safe defaults
export const steamRateLimiter = new RateLimiter({
  maxRequestsPerMinute: 20, // Conservative limit for Steam API
  baseBackoffMs: 1000, // Start with 1 second
  maxBackoffMs: 60000, // Max 1 minute backoff
  retryAttempts: 3,
});

/**
 * Wrapper for making rate-limited Steam API requests
 */
export async function rateLimitedSteamRequest<T>(
  requestFn: () => Promise<T>,
  priority: number = 0
): Promise<T> {
  return steamRateLimiter.queueRequest(requestFn, priority);
}

/**
 * Get rate limiter statistics
 */
export function getRateLimiterStats() {
  return steamRateLimiter.getStats();
}
