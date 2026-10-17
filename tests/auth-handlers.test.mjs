import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { beforeEach } from "node:test";

// Test the actual handlers without contacting Supabase or creating real users.
// Node runs each test file in its own process, so these import stubs stay local.
const dataModule = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
const envModule = dataModule(`
  export let hasEnvVars = true;
  export function configure(value) { hasEnvVars = value; }
`);
const navigationModule = dataModule(`
  export function redirect(location) {
    const error = new Error('test redirect');
    error.location = location;
    throw error;
  }
`);
const serverModule = dataModule(`
  export const calls = [];
  let outcome = 'success';
  export function configure(value) { outcome = value; calls.length = 0; }
  function result(method, input) {
    calls.push({ method, input });
    if (outcome === 'throw') throw new Error('private-provider-detail');
    return { error: outcome === 'error' ? new Error('private-provider-detail') : null };
  }
  export async function createClient() {
    return { auth: {
      verifyOtp: async (input) => result('verifyOtp', input),
      exchangeCodeForSession: async (input) => result('exchangeCodeForSession', input),
    }};
  }
`);

registerHooks({
  resolve(specifier, context, nextResolve) {
    const url = {
      "@/lib/utils": envModule,
      "@/lib/supabase/server": serverModule,
      "@/lib/auth/safe-next-path": new URL("../lib/auth/safe-next-path.ts", import.meta.url).href,
      "next/navigation": navigationModule,
    }[specifier];
    return url ? { url, shortCircuit: true } : nextResolve(specifier, context);
  },
});

const env = await import(envModule);
const provider = await import(serverModule);
const callback = await import("../app/auth/callback/route.ts");
const confirmation = await import("../app/auth/confirm/route.ts");
const request = (path) => {
  const url = new URL(path, "http://localhost:3000");
  return { url: url.href, nextUrl: url };
};
const redirectsTo = (handler, path, destination) => assert.rejects(
  handler(request(path)),
  (error) => error.location === destination,
);

beforeEach(() => {
  env.configure(true);
  provider.configure("success");
});

test("unconfigured email endpoints never contact the provider", async () => {
  env.configure(false);
  await redirectsTo(callback.GET, "/auth/callback?code=test-code", "/auth/error?reason=configuration");
  await redirectsTo(confirmation.GET, "/auth/confirm?token_hash=test-token&type=email", "/auth/error?reason=configuration");
  assert.equal(provider.calls.length, 0);
});

test("missing or unsupported verification input fails before a provider request", async () => {
  await redirectsTo(callback.GET, "/auth/callback?error_description=private-provider-detail", "/auth/error?reason=confirmation");
  for (const query of ["", "?type=email", "?token_hash=test-token&type=unsupported"]) {
    await redirectsTo(confirmation.GET, `/auth/confirm${query}`, "/auth/error?reason=confirmation");
  }
  assert.equal(provider.calls.length, 0);
});

test("a successful PKCE exchange resumes an app path with query intact", async () => {
  await redirectsTo(callback.GET, "/auth/callback?code=test-code&next=%2Fapp%2Fitems%3Fq%3Dcafe", "/app/items?q=cafe");
  assert.deepEqual(provider.calls, [{ method: "exchangeCodeForSession", input: "test-code" }]);
});

test("callback permits recovery while rejecting external navigation and auth loops", async () => {
  for (const next of ["https://example.com", "//example.com", "/auth/login"]) {
    await redirectsTo(callback.GET, `/auth/callback?code=test-code&next=${encodeURIComponent(next)}`, "/app");
  }
  await redirectsTo(callback.GET, "/auth/callback?code=test-code&next=/auth/update-password", "/auth/update-password");
});

test("PKCE failures do not expose codes or provider details in redirects", async () => {
  for (const outcome of ["error", "throw"]) {
    provider.configure(outcome);
    await redirectsTo(callback.GET, "/auth/callback?code=test-code&next=/app", "/auth/error?reason=confirmation");
  }
});

test("recovery token verification always opens the password update form", async () => {
  await redirectsTo(confirmation.GET, "/auth/confirm?token_hash=test-token&type=recovery&next=https://example.com", "/auth/update-password");
  assert.deepEqual(provider.calls, [{ method: "verifyOtp", input: { type: "recovery", token_hash: "test-token" } }]);
});

test("email token verification defaults to the app and supports safe app destinations", async () => {
  await redirectsTo(confirmation.GET, "/auth/confirm?token_hash=test-token&type=email", "/app");
  await redirectsTo(confirmation.GET, "/auth/confirm?token_hash=test-token&type=signup&next=/app/outings", "/app/outings");
});

test("token failures do not expose tokens or provider details in redirects", async () => {
  for (const outcome of ["error", "throw"]) {
    provider.configure(outcome);
    await redirectsTo(confirmation.GET, "/auth/confirm?token_hash=test-token&type=email", "/auth/error?reason=confirmation");
  }
});
