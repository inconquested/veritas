import assert from "node:assert/strict";
import test from "node:test";

import { isDisabled, isEnabled, parseFlags } from "../lib/flags";

test("parse: csv dasar + case-insensitive + spasi", () => {
  const m = parseFlags("public-api, White-Label ,offline-queue");
  assert.equal(m.get("public-api"), true);
  assert.equal(m.get("white-label"), true);
  assert.equal(m.get("offline-queue"), true);
});

test("parse: nilai eksplisit on/off, terakhir menang", () => {
  assert.equal(parseFlags("a=1").get("a"), true);
  assert.equal(parseFlags("a=true").get("a"), true);
  assert.equal(parseFlags("a=on").get("a"), true);
  assert.equal(parseFlags("a=0").get("a"), false);
  assert.equal(parseFlags("a=false").get("a"), false);
  assert.equal(parseFlags("a=off").get("a"), false);
  assert.equal(parseFlags("a=1,a=0").get("a"), false);
  assert.equal(parseFlags("").size, 0);
});

test("isEnabled/isDisabled membaca VERITAS_FLAGS", () => {
  const saved = process.env.VERITAS_FLAGS;
  try {
    process.env.VERITAS_FLAGS = "public-api,white-label,semantic-search";
    assert.equal(isEnabled("public-api"), true);
    assert.equal(isEnabled("white-label"), true);
    assert.equal(isEnabled("push"), false);
    assert.equal(isDisabled("push"), true);
    assert.equal(isDisabled("public-api"), false);
    process.env.VERITAS_FLAGS = "white-label=0";
    assert.equal(isEnabled("white-label"), false);
  } finally {
    if (saved === undefined) delete process.env.VERITAS_FLAGS;
    else process.env.VERITAS_FLAGS = saved;
  }
});

test("isEnabled: argumen env eksplisit (tanpa sentuh process.env)", () => {
  assert.equal(isEnabled("public-api", "public-api"), true);
  assert.equal(isEnabled("public-api", ""), false);
});
