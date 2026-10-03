import assert from "node:assert/strict";
import test from "node:test";
import { safeNextPath } from "../lib/auth/safe-next-path.ts";

test("keeps an in-app confirmation destination", () => {
  assert.equal(safeNextPath("/app/items?view=recent"), "/app/items?view=recent");
  assert.equal(safeNextPath(null), "/");
});

test("rejects external and protocol-relative confirmation destinations", () => {
  for (const input of [
    "https://example.com/", "//example.com/", "/\\example.com/", "\\example.com/", "\n//example.com/",
  ]) {
    assert.equal(safeNextPath(input), "/", input);
  }
});
