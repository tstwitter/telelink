import assert from "node:assert/strict";
import test from "node:test";
import { rangeFor } from "../src/worker.js";

test("período de hoje começa à meia-noite de São Paulo", () => {
  const now = Date.UTC(2026, 9, 28, 2, 55);
  const range = rangeFor("today", now);
  assert.equal(range.start, Date.UTC(2026, 9, 27, 3, 0));
  assert.equal(range.end, now);
});
