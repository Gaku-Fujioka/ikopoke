import assert from "node:assert/strict";
import test from "node:test";
import { appNextPath, confirmationNextPath, safeNextPath } from "../lib/auth/safe-next-path.ts";

test("keeps an in-app confirmation destination", () => {
  assert.equal(safeNextPath("/app/items?view=recent"), "/app/items?view=recent");
  assert.equal(safeNextPath(null), "/");
});

test("login resumes app paths and never follows an external URL or auth loop", () => {
  assert.equal(appNextPath("/app/items?q=cafe&kind=spot#list"), "/app/items?q=cafe&kind=spot#list");
  for (const input of [null, "/", "/protected", "/auth/login", "/app-other", "//example.com", "https://example.com", "/\\example.com", "/app/../auth/login"]) {
    assert.equal(appNextPath(input), "/app", String(input));
  }
});

test("recovery confirmations always reach the password form", () => {
  assert.equal(confirmationNextPath(null, "recovery"), "/auth/update-password");
  assert.equal(confirmationNextPath("https://example.com", "recovery"), "/auth/update-password");
  assert.equal(confirmationNextPath("/auth/update-password"), "/auth/update-password");
  assert.equal(confirmationNextPath("/auth/login", "email"), "/app");
  assert.equal(confirmationNextPath("/app/items?q=cafe", "email"), "/app/items?q=cafe");
});

test("rejects external and protocol-relative confirmation destinations", () => {
  for (const input of [
    "https://example.com/", "//example.com/", "/\\example.com/", "\\example.com/", "\n//example.com/",
  ]) {
    assert.equal(safeNextPath(input), "/", input);
  }
});
