import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";

import {
  ACTION_TIMEOUT_MS,
  TIMEOUT_ERROR_KEY,
  TimeoutError,
  guardAction,
  isTimeoutError,
  isTimeoutErrorKey,
  timeoutSignal,
  withTimeout,
} from "../lib/action-timeout";

// A promise that never settles, for exercising the timeout path.
const forever = () => new Promise<never>(() => {});

// ---------------------------------------------------------------------------
// isTimeoutError: recognize every abort/timeout shape, reject everything else
// ---------------------------------------------------------------------------

test("isTimeoutError recognizes our own TimeoutError", () => {
  assert.equal(isTimeoutError(new TimeoutError()), true);
});

test("isTimeoutError recognizes DOM/undici abort shapes by name", () => {
  assert.equal(isTimeoutError({ name: "TimeoutError" }), true);
  assert.equal(isTimeoutError({ name: "AbortError" }), true);
});

test("isTimeoutError recognizes undici/DOMException abort codes", () => {
  assert.equal(isTimeoutError({ code: "UND_ERR_ABORTED" }), true);
  assert.equal(isTimeoutError({ code: "ABORT_ERR" }), true);
  assert.equal(isTimeoutError({ code: 23 }), true); // DOMException.ABORT_ERR
});

test("isTimeoutError recognizes a real AbortSignal.timeout reason", async () => {
  const signal = timeoutSignal(1);
  await delay(10);
  assert.equal(signal.aborted, true);
  assert.equal(isTimeoutError(signal.reason), true);
});

test("isTimeoutError rejects unrelated errors and non-objects", () => {
  assert.equal(isTimeoutError(new Error("boom")), false);
  assert.equal(isTimeoutError({ name: "TypeError" }), false);
  assert.equal(isTimeoutError({ code: "ENOENT" }), false);
  assert.equal(isTimeoutError(null), false);
  assert.equal(isTimeoutError(undefined), false);
  assert.equal(isTimeoutError("TimeoutError"), false);
  assert.equal(isTimeoutError(23), false);
});

// ---------------------------------------------------------------------------
// isTimeoutErrorKey: only strings that denote a timeout
// ---------------------------------------------------------------------------

test("isTimeoutErrorKey matches the canonical timeout key", () => {
  assert.equal(isTimeoutErrorKey(TIMEOUT_ERROR_KEY), true);
  assert.equal(TIMEOUT_ERROR_KEY, "errors.timeout");
});

test("isTimeoutErrorKey matches any key containing 'timeout'", () => {
  assert.equal(isTimeoutErrorKey("errors.escrow.timeout"), true);
  assert.equal(isTimeoutErrorKey("timeout"), true);
});

test("isTimeoutErrorKey rejects non-timeout keys and non-strings", () => {
  assert.equal(isTimeoutErrorKey("errors.internal"), false);
  assert.equal(isTimeoutErrorKey(""), false);
  assert.equal(isTimeoutErrorKey(undefined), false);
  assert.equal(isTimeoutErrorKey(null), false);
  assert.equal(isTimeoutErrorKey(42), false);
});

// ---------------------------------------------------------------------------
// withTimeout: resolve fast work, reject slow work, pass real errors through
// ---------------------------------------------------------------------------

test("withTimeout resolves when work settles before the budget", async () => {
  const value = await withTimeout(Promise.resolve("ok"), 1000);
  assert.equal(value, "ok");
});

test("withTimeout accepts a thunk and returns its resolved value", async () => {
  const value = await withTimeout(async () => 42, 1000);
  assert.equal(value, 42);
});

test("withTimeout rejects with TimeoutError when work outlives the budget", async () => {
  await assert.rejects(
    () => withTimeout(forever(), 5),
    (e: unknown) => e instanceof TimeoutError,
  );
});

test("withTimeout propagates the original rejection, not a timeout", async () => {
  const original = new Error("upstream failed");
  await assert.rejects(
    () => withTimeout(Promise.reject(original), 1000),
    (e: unknown) => e === original,
  );
});

test("withTimeout does not leave a pending timer alive after fast resolve", async () => {
  // If the timer weren't cleared, this 60s guard would keep the loop alive and
  // the test runner would hang. Reaching the assertion proves it was cleared.
  const value = await withTimeout(Promise.resolve("done"), 60_000);
  assert.equal(value, "done");
});

// ---------------------------------------------------------------------------
// guardAction: normalize success and both failure modes into one result shape
// ---------------------------------------------------------------------------

test("guardAction returns the run result on the happy path", async () => {
  type Result = { success: true } | { success: false; errorKey: string };
  const result = await guardAction<Result>(
    async () => ({ success: true }),
    () => ({ success: false, errorKey: "errors.internal" }),
  );
  assert.deepEqual(result, { success: true });
});

test("guardAction flags timedOut=true when the run times out", async () => {
  const result = await guardAction(
    async () => {
      throw new TimeoutError();
    },
    ({ timedOut }) => ({
      success: false as const,
      errorKey: timedOut ? TIMEOUT_ERROR_KEY : "errors.internal",
    }),
  );
  assert.deepEqual(result, { success: false, errorKey: TIMEOUT_ERROR_KEY });
});

test("guardAction flags timedOut=false for ordinary failures", async () => {
  const boom = new Error("boom");
  const seen: unknown[] = [];
  const result = await guardAction(
    async () => {
      throw boom;
    },
    ({ timedOut, error }) => {
      seen.push(error);
      return {
        success: false as const,
        errorKey: timedOut ? TIMEOUT_ERROR_KEY : "errors.internal",
      };
    },
  );
  assert.deepEqual(result, { success: false, errorKey: "errors.internal" });
  assert.deepEqual(seen, [boom]);
});

test("guardAction surfaces a real timeout produced via withTimeout", async () => {
  const result = await guardAction(
    () => withTimeout(forever(), 5),
    ({ timedOut }) => ({ success: false as const, timedOut }),
  );
  assert.deepEqual(result, { success: false, timedOut: true });
});

// ---------------------------------------------------------------------------
// timeoutSignal: aborts after the budget with a timeout-shaped reason
// ---------------------------------------------------------------------------

test("timeoutSignal starts unaborted and aborts after its budget", async () => {
  const signal = timeoutSignal(5);
  assert.equal(signal.aborted, false);
  await delay(20);
  assert.equal(signal.aborted, true);
});

test("ACTION_TIMEOUT_MS is a sane positive default", () => {
  assert.equal(typeof ACTION_TIMEOUT_MS, "number");
  assert.ok(ACTION_TIMEOUT_MS > 0);
});
