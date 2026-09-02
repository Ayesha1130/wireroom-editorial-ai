export interface RetryOptions {
  retries?: number; // number of *extra* attempts after the first
  timeoutMs?: number;
  backoffMs?: number;
  onRetry?: (attempt: number, error: unknown) => void;
}

export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Operation timed out after ${ms}ms`);
    this.name = "TimeoutError";
  }
}

/**
 * Runs `fn` with a hard timeout and bounded retries with exponential
 * backoff. This is deliberately simple — no jitter library, no queueing —
 * because the failure modes we actually care about here (a flaky model
 * call, a slow search API) don't need more than that.
 */
export async function withRetry<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { retries = 2, timeoutMs = 20_000, backoffMs = 500, onRetry } = options;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new TimeoutError(timeoutMs));
      }, timeoutMs);
    });

    try {
      // Race the operation against a timeout that actively rejects. Passing
      // the AbortSignal lets cooperating callers (fetch, the OpenAI SDK)
      // cancel the underlying network request too — but the race is what
      // guarantees withRetry itself moves on even if `fn` ignores the
      // signal entirely.
      const result = await Promise.race([fn(controller.signal), timeoutPromise]);
      clearTimeout(timer!);
      return result;
    } catch (err) {
      clearTimeout(timer!);
      lastError = err;
      if (attempt < retries) {
        onRetry?.(attempt + 1, err);
        await sleep(backoffMs * Math.pow(2, attempt));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
