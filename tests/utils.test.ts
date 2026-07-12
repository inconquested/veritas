import assert from "node:assert/strict";
import test from "node:test";

import { getErrorStateMessage } from "../lib/utils";

test("getErrorStateMessage returns a sign-in message for unauthorized errors", () => {
  const message = getErrorStateMessage("errors.unauthorized");

  assert.match(message, /sign in/i);
});

test("getErrorStateMessage falls back to a generic message for unknown errors", () => {
  const message = getErrorStateMessage("errors.unknown");

  assert.match(message, /couldn't load/i);
});
