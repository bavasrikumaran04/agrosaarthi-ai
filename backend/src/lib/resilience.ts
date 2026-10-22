/**
 * Resilience primitives for calls to external providers (AI, speech, model
 * service, telephony APIs): bounded retries with exponential backoff, hard
 * timeouts, a concurrency limiter and a circuit breaker. Nothing here retries
 * forever — every loop is bounded by explicit limits.
 */

export class TimeoutError extends Error {
  constructor(message = 'Operation timed out') {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class CircuitOpenError extends Error {
  constructor(name: string) {
    super(`Circuit "${name}" is open; skipping call`);
    this.name = 'CircuitOpenError';
  }
}

export class ConcurrencyLimitError extends Error {
  constructor(name: string) {
    super(`Too many concurrent "${name}" operations`);
    this.name = 'ConcurrencyLimitError';
  }
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason instanceof Error ? signal.reason : new Error('Aborted'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason instanceof Error ? signal.reason : new Error('Aborted'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Run `fn` with an AbortSignal that fires after `ms`. The returned promise
 * rejects with TimeoutError even if `fn` ignores the signal.
 */
export async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, ms: number, label = 'operation'): Promise<T> {
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const err = new TimeoutError(`${label} timed out after ${ms} ms`);
      controller.abort(err);
      reject(err);
    }, ms);
  });
  try {
    return await Promise.race([fn(controller.signal), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export interface RetryOptions {
  /** Number of retries after the first attempt (0 = no retry). */
  retries: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Only errors for which this returns true are retried (e.g. 429/5xx/timeouts). */
  isRetryable: (err: unknown) => boolean;
  onRetry?: (err: unknown, attempt: number, delayMs: number) => void;
  /** Optional Retry-After hint extracted from the error, in ms. */
  retryAfterMs?: (err: unknown) => number | undefined;
  signal?: AbortSignal;
}

/** Exponential backoff with full jitter, bounded by `retries` and `maxDelayMs`. */
export async function withRetry<T>(fn: (attempt: number) => Promise<T>, opts: RetryOptions): Promise<T> {
  const base = opts.baseDelayMs ?? 300;
  const max = opts.maxDelayMs ?? 4_000;
  let attempt = 0;
  for (;;) {
    try {
      return await fn(attempt);
    } catch (err) {
      if (attempt >= opts.retries || !opts.isRetryable(err)) throw err;
      const hinted = opts.retryAfterMs?.(err);
      const backoff = Math.min(max, base * 2 ** attempt);
      const delay = hinted !== undefined ? Math.min(max, Math.max(0, hinted)) : Math.round(Math.random() * backoff);
      opts.onRetry?.(err, attempt + 1, delay);
      await sleep(delay, opts.signal);
      attempt += 1;
    }
  }
}

/**
 * Counting semaphore with a bounded wait queue. When the queue is full the
 * call fails fast with ConcurrencyLimitError instead of piling up requests.
 */
export class Semaphore {
  private active = 0;
  private readonly waiters: Array<() => void> = [];

  constructor(
    private readonly name: string,
    private readonly maxConcurrent: number,
    private readonly maxQueue = 100,
  ) {
    if (maxConcurrent < 1) throw new Error('maxConcurrent must be >= 1');
  }

  get activeCount(): number {
    return this.active;
  }

  get queuedCount(): number {
    return this.waiters.length;
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.active < this.maxConcurrent) {
      this.active += 1;
      return Promise.resolve();
    }
    if (this.waiters.length >= this.maxQueue) return Promise.reject(new ConcurrencyLimitError(this.name));
    return new Promise<void>((resolve) => {
      this.waiters.push(() => {
        this.active += 1;
        resolve();
      });
    });
  }

  private release(): void {
    this.active -= 1;
    const next = this.waiters.shift();
    if (next) next();
  }
}

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * Minimal circuit breaker: after `failureThreshold` consecutive failures the
 * circuit opens for `cooldownMs`; then a single trial call is allowed.
 * Prevents hammering a provider that is down and gives users a fast,
 * honest "temporarily unavailable" response.
 */
export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private consecutiveFailures = 0;
  private openedAt = 0;
  private trialInFlight = false;

  constructor(
    readonly name: string,
    private readonly failureThreshold = 5,
    private readonly cooldownMs = 30_000,
    private readonly now: () => number = Date.now,
  ) {}

  get currentState(): CircuitState {
    if (this.state === 'OPEN' && this.now() - this.openedAt >= this.cooldownMs) return 'HALF_OPEN';
    return this.state;
  }

  async exec<T>(fn: () => Promise<T>, countsAsFailure: (err: unknown) => boolean = () => true): Promise<T> {
    const state = this.currentState;
    if (state === 'OPEN') throw new CircuitOpenError(this.name);
    if (state === 'HALF_OPEN') {
      if (this.trialInFlight) throw new CircuitOpenError(this.name);
      this.trialInFlight = true;
    }
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      if (countsAsFailure(err)) this.onFailure();
      else if (state === 'HALF_OPEN') this.onSuccess();
      throw err;
    } finally {
      if (state === 'HALF_OPEN') this.trialInFlight = false;
    }
  }

  private onSuccess(): void {
    this.state = 'CLOSED';
    this.consecutiveFailures = 0;
  }

  private onFailure(): void {
    this.consecutiveFailures += 1;
    if (this.state === 'HALF_OPEN' || this.currentState === 'HALF_OPEN' || this.consecutiveFailures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.openedAt = this.now();
    }
  }
}
