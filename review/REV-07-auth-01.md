# REV-07: AUTH-01 document inventory review

- Task: AUTH-01
- Base: `1ccb82d`
- Target: `52ab6f1`
- Verdict: Listed statements are accurate; the inventory has one completeness gap.

## Finding

**Low — `docs/data-model.md` (AUTH-01 inventory, around lines 25–30):** The section describes password login, sign-up/confirmation, the confirmation handler, proxy protection, and the local mock boundary accurately. However, AUTH-01 is described as an inventory of current Auth calls and transitions, and it omits existing password reset, password update, and logout flows. `components/forgot-password-form.tsx` calls `resetPasswordForEmail()` with redirect `/auth/update-password`; `components/update-password-form.tsx` calls `updateUser()` and routes to `/protected`; `components/logout-button.tsx` calls `signOut()` and routes to `/auth/login`. `components/auth-button.tsx` and `app/protected/page.tsx` also call `getClaims()` outside the proxy.

- Reproduction/evidence: Read the source callsites listed above and compare them with the AUTH-01 inventory in the target commit.
- Expected: The inventory lists these current flows or explicitly scopes itself to login, sign-up, confirmation, and proxy behavior.
- Actual: They are absent, so the stated current-call/transition inventory is incomplete.
- Suggested fix: Add concise rows for reset/update/logout and note the other `getClaims()` callsites, or narrow the stated inventory scope.

## Checks

- Read the fixed diff `1ccb82d..52ab6f1` and the corresponding Auth components, route handler, proxy, matcher, and environment-variable helper.
- Confirmed the documented login, sign-up, confirmation, proxy environment-variable behavior, and localStorage mock boundary match the checked-in code.
- The confirmation handler uses the `next` query value as a redirect destination; the document correctly flags validation as needed.
- No Auth API, Supabase network call, lint, build, or test was run. This was a read-only documentation and source review.
- No other factual misstatement found in the reviewed claims. Runtime behavior with configured Supabase credentials and actual email delivery/redirect configuration remains unverified.
