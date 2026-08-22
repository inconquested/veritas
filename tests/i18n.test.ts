import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const LOCALES_DIR = path.join(ROOT, "app", "_i18n", "locales");
const LOCALES = ["en", "id", "es", "zh-CN"] as const;

function flatKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? flatKeys(v as Record<string, unknown>, prefix + k + ".")
      : [prefix + k]
  );
}

function extractUsedKeys(): Set<string> {
  const keys = new Set<string>();
  const files: string[] = [];
  (function walk(d: string) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (!["node_modules", ".next", "tests", "_i18n"].includes(e.name)) walk(p);
      } else if (/\.(tsx?|jsx?)$/.test(e.name)) {
        files.push(p);
      }
    }
  })(ROOT);

  for (const f of files) {
    const src = fs.readFileSync(f, "utf8");
    const varToNs: Record<string, string> = {};
    const declRe = /(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*["'`]([\w-]+)["'`]\s*\)/g;
    let m: RegExpExecArray | null;
    while ((m = declRe.exec(src))) varToNs[m[1]] = m[2];
    for (const [v, ns] of Object.entries(varToNs)) {
      const esc = v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const callRe = new RegExp(
        "\\b" + esc + "\\s*(?:\\.\\s*(?:rich|markup|raw))?\\s*\\(\\s*[\"'`]([\\w.-]+)[\"'`]",
        "g"
      );
      while ((m = callRe.exec(src))) keys.add(ns + "." + m[1]);
    }
  }
  return keys;
}

test("all used i18n keys exist in every locale", () => {
  const used = extractUsedKeys();
  assert.ok(used.size > 0, "should find at least one used key");

  for (const locale of LOCALES) {
    const json = JSON.parse(
      fs.readFileSync(path.join(LOCALES_DIR, locale + ".json"), "utf8")
    );
    const have = new Set(flatKeys(json));
    const missing = [...used].filter((k) => !have.has(k));
    assert.deepEqual(
      missing,
      [],
      `Locale "${locale}" missing ${missing.length} keys: ${missing.slice(0, 10).join(", ")}`
    );
  }
});

test("all locales have identical key sets", () => {
  const keySets = LOCALES.map((l) => {
    const json = JSON.parse(
      fs.readFileSync(path.join(LOCALES_DIR, l + ".json"), "utf8")
    );
    return new Set(flatKeys(json));
  });
  const base = keySets[0];
  for (let i = 1; i < keySets.length; i++) {
    const missing = [...base].filter((k) => !keySets[i].has(k));
    const extra = [...keySets[i]].filter((k) => !base.has(k));
    assert.deepEqual(missing, [], `"${LOCALES[i]}" missing ${missing.length} keys vs en`);
    assert.deepEqual(extra, [], `"${LOCALES[i]}" has ${extra.length} extra keys vs en`);
  }
});
