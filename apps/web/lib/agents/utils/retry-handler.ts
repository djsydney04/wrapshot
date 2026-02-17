/**
 * Retry Handler with exponential backoff and jitter
 *
 * Provides resilient API call handling for LLM requests
 */

import { RETRY_CONFIG } from '../constants';
import type { AgentError, AgentErrorCode } from '../types';

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  jitterFactor?: number;
  retryableErrors?: AgentErrorCode[];
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}

const DEFAULT_RETRYABLE_ERRORS: AgentErrorCode[] = [
  'LLM_ERROR',
  'LLM_RATE_LIMIT',
  'LLM_TIMEOUT',
];

export class RetryHandler {
  private options: Required<Omit<RetryOptions, 'onRetry'>> & { onRetry?: RetryOptions['onRetry'] };

  constructor(options: RetryOptions = {}) {
    this.options = {
      maxRetries: options.maxRetries ?? RETRY_CONFIG.MAX_RETRIES,
      initialDelayMs: options.initialDelayMs ?? RETRY_CONFIG.INITIAL_DELAY_MS,
      maxDelayMs: options.maxDelayMs ?? RETRY_CONFIG.MAX_DELAY_MS,
      backoffMultiplier: options.backoffMultiplier ?? RETRY_CONFIG.BACKOFF_MULTIPLIER,
      jitterFactor: options.jitterFactor ?? RETRY_CONFIG.JITTER_FACTOR,
      retryableErrors: options.retryableErrors ?? DEFAULT_RETRYABLE_ERRORS,
      onRetry: options.onRetry,
    };
  }

  /**
   * Execute a function with retry logic
   */
  async execute<T>(
    fn: () => Promise<T>,
    context?: string
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if we should retry
        if (attempt === this.options.maxRetries) {
          break;
        }

        if (!this.isRetryable(lastError)) {
          break;
        }

        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateDelay(attempt);

        // Call retry callback if provided
        if (this.options.onRetry) {
          this.options.onRetry(attempt + 1, lastError, delay);
        }

        // Log retry attempt
        console.log(
          `[RetryHandler] ${context || 'Operation'} failed (attempt ${attempt + 1}/${this.options.maxRetries + 1}). ` +
          `Retrying in ${delay}ms. Error: ${lastError.message}`
        );

        await this.sleep(delay);
      }
    }

    // All retries exhausted
    throw this.wrapError(lastError!, context);
  }

  /**
   * Execute multiple operations with individual retry logic
   */
  async executeAll<T>(
    operations: Array<{ fn: () => Promise<T>; context?: string }>,
    options?: { continueOnError?: boolean }
  ): Promise<Array<{ success: true; data: T } | { success: false; error: Error }>> {
    const results: Array<{ success: true; data: T } | { success: false; error: Error }> = [];

    for (const { fn, context } of operations) {
      try {
        const data = await this.execute(fn, context);
        results.push({ success: true, data });
      } catch (error) {
        const wrappedError = error instanceof Error ? error : new Error(String(error));
        results.push({ success: false, error: wrappedError });

        if (!options?.continueOnError) {
          break;
        }
      }
    }

    return results;
  }

  /**
   * Check if an error is retryable
   */
  private isRetryable(error: Error): boolean {
    const message = error.message.toLowerCase();

    // Rate limit errors
    if (message.includes('rate limit') || message.includes('429') || message.includes('too many requests')) {
      return true;
    }

    // Timeout errors
    if (message.includes('timeout') || message.includes('timed out') || message.includes('etimedout')) {
      return true;
    }

    // Network errors
    if (message.includes('network') || message.includes('connection') || message.includes('econnreset')) {
      return true;
    }

    // Server errors (5xx)
    if (message.includes('500') || message.includes('502') || message.includes('503') || message.includes('504')) {
      return true;
    }

    // Check for AgentError with retryable flag
    if ('retryable' in error && 'code' in error && (error as unknown as AgentError).retryable === true) {
      return true;
    }

    return false;
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  private calculateDelay(attempt: number): number {
    // Exponential backoff
    const exponentialDelay = this.options.initialDelayMs * Math.pow(this.options.backoffMultiplier, attempt);

    // Cap at max delay
    const cappedDelay = Math.min(exponentialDelay, this.options.maxDelayMs);

    // Add jitter (random variation to prevent thundering herd)
    const jitterRange = cappedDelay * this.options.jitterFactor;
    const jitter = Math.random() * jitterRange * 2 - jitterRange;

    return Math.max(0, Math.round(cappedDelay + jitter));
  }

  /**
   * Wrap error with context
   */
  private wrapError(error: Error, context?: string): Error {
    const prefix = context ? `[${context}] ` : '';
    const wrappedError = new Error(`${prefix}${error.message}`);
    wrappedError.stack = error.stack;
    return wrappedError;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create an AgentError from a regular error
   */
  static toAgentError(error: Error, code?: AgentErrorCode): AgentError {
    const message = error.message.toLowerCase();

    // Determine error code if not provided
    let errorCode: AgentErrorCode = code || 'UNKNOWN_ERROR';
    let retryable = false;

    if (message.includes('rate limit') || message.includes('429')) {
      errorCode = 'LLM_RATE_LIMIT';
      retryable = true;
    } else if (message.includes('timeout')) {
      errorCode = 'LLM_TIMEOUT';
      retryable = true;
    } else if (message.includes('json') || message.includes('parse')) {
      errorCode = 'JSON_PARSE_ERROR';
      retryable = false;
    } else if (message.includes('database') || message.includes('supabase')) {
      errorCode = 'DATABASE_ERROR';
      retryable = false;
    }

    return {
      code: errorCode,
      message: error.message,
      details: error.stack ? { stack: error.stack } : undefined,
      retryable,
    };
  }

  /**
   * Create a retry handler with custom configuration
   */
  static create(options?: RetryOptions): RetryHandler {
    return new RetryHandler(options);
  }

  /**
   * Quick execution with default settings
   */
  static async retry<T>(fn: () => Promise<T>, context?: string): Promise<T> {
    return new RetryHandler().execute(fn, context);
  }
}
