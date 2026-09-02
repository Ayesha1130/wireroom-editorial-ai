import { describe, it, expect, vi } from "vitest";
import { withRetry, TimeoutError } from "@/lib/retry";

describe("withRetry", () => {
  it("returns the result on first success without retrying", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn, { retries: 2 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure and succeeds within the bound", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("flaky"))
      .mockResolvedValueOnce("ok");

    const result = await withRetry(fn, { retries: 2, backoffMs: 1 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws the last error after exhausting retries — retries are bounded, not infinite", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("always fails"));

    await expect(withRetry(fn, { retries: 2, backoffMs: 1 })).rejects.toThrow("always fails");
    expect(fn).toHaveBeenCalledTimes(3); // initial attempt + 2 retries, never more
  });

  it("aborts and reports a timeout when fn hangs past the deadline", async () => {
    const fn = () => new Promise((resolve) => setTimeout(resolve, 200));

    await expect(withRetry(fn, { retries: 0, timeoutMs: 10 })).rejects.toThrow(TimeoutError);
  });

  it("calls onRetry with the attempt number on each retry", async () => {
    const onRetry = vi.fn();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("first"))
      .mockRejectedValueOnce(new Error("second"))
      .mockResolvedValueOnce("ok");

    await withRetry(fn, { retries: 2, backoffMs: 1, onRetry });
    expect(onRetry).toHaveBeenNthCalledWith(1, 1, expect.any(Error));
    expect(onRetry).toHaveBeenNthCalledWith(2, 2, expect.any(Error));
  });
});
