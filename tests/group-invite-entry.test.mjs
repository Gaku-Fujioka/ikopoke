import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({ resolve(specifier, context, next) {
  if (specifier === "./invite-cookie" && context.parentURL?.endsWith("/lib/groups/invite-entry.ts")) {
    return { url: new URL("../lib/groups/invite-cookie.ts", import.meta.url).href, shortCircuit: true };
  }
  return next(specifier, context);
} });
const { captureInviteEntry } = await import("../lib/groups/invite-entry.ts");
const token = "a".repeat(64);
function browser(url) {
  const result = { location: new URL(url), replacements: [], history: { replaceState(_state, _title, path) {
    result.replacements.push(path);
    result.location = new URL(path, result.location.origin);
  } } };
  return result;
}

test("a copy preserves the invitation across isolated browsers after the source address is cleaned", () => {
  const line = browser(`https://www.ikopoke.app/app/groups/join#${token}`);
  const entry = captureInviteEntry(line);
  assert.equal(line.location.hash, "");
  // Opening the sanitized address reproduces the failed handoff: no fragment,
  // and the other browser has no pending-invite cookie.
  assert.equal(captureInviteEntry(browser(line.location.href)), null);
  const safari = browser(entry.handoffLink);
  assert.equal(captureInviteEntry(safari).token, token);
  assert.equal(safari.location.hash, "");
  assert.equal(entry.handoffLink, `https://www.ikopoke.app/app/groups/join#${token}`);
});

test("a resumed cookie-only invitation neither clears the address nor creates a token to copy", () => {
  const page = browser("https://www.ikopoke.app/app/groups/join");
  assert.equal(captureInviteEntry(page), null);
  assert.deepEqual(page.replacements, []);
});

test("invalid fragments are removed but never offered as handoff links", () => {
  for (const fragment of ["invalid", "z".repeat(64), `${token}?next=https://example.com`, "%61".repeat(64)]) {
    const page = browser(`https://www.ikopoke.app/app/groups/join#${fragment}`);
    const entry = captureInviteEntry(page);
    assert.equal(entry.handoffLink, null);
    assert.equal(page.location.hash, "");
  }
});

test("copy links contain only the invitation path and fragment, never the original query", () => {
  const page = browser(`http://localhost:3000/app/groups/join?next=%2Fapp&code=synthetic#${token}`);
  const entry = captureInviteEntry(page);
  const copied = new URL(entry.handoffLink);
  assert.equal(copied.origin, "http://localhost:3000");
  assert.equal(copied.pathname, "/app/groups/join");
  assert.equal(copied.search, "");
  assert.equal(copied.hash, `#${token}`);
  assert.deepEqual(page.replacements, ["/app/groups/join?next=%2Fapp&code=synthetic"]);
});
