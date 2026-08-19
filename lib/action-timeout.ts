/**
 * Timeout primitives for server actions.
 *
 * This module is intentionally free of any Next.js / React imports so it can be
 * imported from both server actions and client components, and unit-tested in a
 * plain Node (`node:test`) runtime.
 *
 * The goal is that a slow or unresponsive upstream (the Hono API, Clerk, a
 * payment gateway) never leaves an interface hanging forever. Actions abort the
 * in-flight request and return a normalized `{ success: false, errorKey }`
 * result that the UI can render gracefully.
 */

/** Default budget for a single server-action round trip. */
export const ACTION_TIMEOUT_MS = 10_000;

/** Translation key returned by actions when a request times out. */
export const TIMEOUT_ERROR_KEY = "errors.timeout";

/** Error thrown by {@link withTimeout} when the wrapped work outlives its budget. */
export class TimeoutError extends Error {
  constructor(message = "The request timed out.") {
    super(message);
    this.name = "TimeoutError";
  }
}

/**
 * A signal that aborts after `ms`. Attach it to a `fetch`/Hono request `init`
 * so the underlying socket is actually cancelled on timeout instead of leaking.
 */
export function timeoutSignal(ms: number = ACTION_TIMEOUT_MS): AbortSignal {
  return AbortSignal.timeout(ms);
}

/**
 * True when `error` represents a timeout or an aborted request, across the
 * shapes Node/undici and the DOM throw: our own {@link TimeoutError}, a
 * `TimeoutError`/`AbortError` DOMException, or undici's abort codes.
 */
export function isTimeoutError(error: unknown): boolean {
  if (error instanceof TimeoutError) return true;
  if (typeof error !== "object" || error === null) return false;

  const name = (error as { name?: unknown }).name;
  if (name === "TimeoutError" || name === "AbortError") return true;

  const code = (error as { code?: unknown }).code;
  // undici: UND_ERR_ABORTED; DOMException.ABORT_ERR === 23.
  return code === "UND_ERR_ABORTED" || code === "ABORT_ERR" || code === 23;
}

/**
 * True when an action's `errorKey` denotes a timeout, so interfaces can show a
 * dedicated "try again" message instead of a raw key.
 *
 * Returns a plain `boolean` rather than a `key is string` type predicate on
 * purpose: callers often pass an already-`string` `errorKey`, and a predicate
 * would narrow the *negative* branch to `never`, breaking subsequent string
 * checks on the same value.
 */
export function isTimeoutErrorKey(key: unknown): boolean {
  return typeof key === "string" && key.includes("timeout");
}

/**
 * Reject `work` with a {@link TimeoutError} if it does not settle within `ms`.
 *
 * Use for upstreams that don't accept an `AbortSignal` (e.g. Clerk's SDK). The
 * underlying work isn't cancelled, but the action stops waiting so the caller
 * can recover. Accepts a promise or a thunk that returns one.
 */
export function withTimeout<T>(
  work: Promise<T> | (() => Promise<T>),
  ms: number = ACTION_TIMEOUT_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const guard = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError()), ms);
  });

  const promise = typeof work === "function" ? work() : work;

  return Promise.race([promise, guard]).finally(() => {
    if (timer) clearTimeout(timer);
  }) as Promise<T>;
}

/**
 * Run an action body and convert any thrown error into a normalized result via
 * `onError`, distinguishing timeouts from other failures. This keeps every
 * action's happy path readable while guaranteeing it resolves to a value the
 * interface can handle instead of throwing into an error boundary.
 */
export async function guardAction<T>(
  run: () => Promise<T>,
  onError: (info: { timedOut: boolean; error: unknown }) => T,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    return onError({ timedOut: isTimeoutError(error), error });
  }
}
