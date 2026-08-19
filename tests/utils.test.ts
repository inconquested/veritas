import assert from "node:assert/strict";
import test from "node:test";

import {
  getErrorStateMessage,
  getActionErrorMessage,
  formatZodIssues,
  toJsonSafe,
  slugify,
  TIMEOUT_MESSAGE,
} from "../lib/utils";

test("getErrorStateMessage returns a sign-in message for unauthorized errors", () => {
  const message = getErrorStateMessage("errors.unauthorized");
  assert.match(message, /sign in/i);
});

test("getErrorStateMessage falls back to a generic message for unknown errors", () => {
  const message = getErrorStateMessage("errors.unknown");
  assert.match(message, /couldn't load/i);
});

test("getErrorStateMessage returns forbidden message", () => {
  const message = getErrorStateMessage("errors.forbidden");
  assert.ok(message.length > 0);
});

test("getErrorStateMessage returns notExist message", () => {
  const message = getErrorStateMessage("errors.notExist");
  assert.ok(message.length > 0);
});

test("getActionErrorMessage prefers result.message over errorKey", () => {
  const msg = getActionErrorMessage(
    { message: "Gateway error" } as any,
    "Fallback",
  );
  assert.equal(msg, "Gateway error");
});

test("getActionErrorMessage returns TIMEOUT_MESSAGE for timeout errorKey", () => {
  const msg = getActionErrorMessage(
    { errorKey: "errors.timeout" },
    "Fallback",
  );
  assert.equal(msg, TIMEOUT_MESSAGE);
});

test("getActionErrorMessage falls back to provided default", () => {
  const msg = getActionErrorMessage(
    {} as any,
    "Default fallback",
  );
  assert.equal(msg, "Default fallback");
});

test("formatZodIssues maps path and message", () => {
  const issues = formatZodIssues([
    { path: ["title"], message: "errors.required" },
    { path: [], message: "errors.validation_failed" },
  ]);
  assert.equal(issues[0].field, "title");
  assert.equal(issues[0].key, "errors.required");
  assert.equal(issues[1].field, "_form");
  assert.equal(issues[1].key, "errors.validation_failed");
});

test("formatZodIssues maps non-errors-prefixed message to validation_failed", () => {
  const issues = formatZodIssues([
    { path: ["amount"], message: "Invalid input" },
  ]);
  assert.equal(issues[0].key, "errors.validation_failed");
});

test("toJsonSafe converts bigint to string", () => {
  const data = { id: "1", amount: 5000n };
  const safe = toJsonSafe(data);
  assert.equal(typeof (safe as any).amount, "string");
  assert.equal((safe as any).amount, "5000");
});

test("toJsonSafe handles nested bigint", () => {
  const data = { items: [{ price: 100n }] };
  const safe = toJsonSafe(data);
  assert.equal(typeof (safe as any).items[0].price, "string");
});

test("slugify lowercases and kebab-cases", () => {
  assert.equal(slugify("Hello World"), "hello-world");
  assert.equal(slugify("  Multiple   Spaces  "), "multiple-spaces");
  assert.equal(slugify("Special!@#Chars"), "special-chars");
  assert.equal(slugify("Already-Kebab"), "already-kebab");
  assert.equal(slugify(""), "");
});
