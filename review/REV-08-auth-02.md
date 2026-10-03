# REV-08: AUTH-02 redirect review

- Task: AUTH-02
- Base: `52ab6f1`
- Target: `3fb5525`
- Verdict: No finding in the reviewed redirect handling.

## Review

`app/auth/confirm/route.ts` passes the `next` query value through `safeNextPath()` before redirecting after successful OTP verification. The helper accepts only slash-prefixed paths, rejects protocol-relative `//` destinations and any literal backslash, then parses against a fixed app origin and verifies the parsed origin. It returns `/` for rejected or invalid inputs.

The helper preserves pathname, query, and fragment for accepted in-app destinations. The checked-in tests cover `/app/items?view=recent`, null fallback, external and protocol-relative URLs, and backslash variants including a newline-prefixed case. No bypass was identified in these checks.

## Checks and limits

- Read fixed diff `52ab6f1..3fb5525`, `app/auth/confirm/route.ts`, `lib/auth/safe-next-path.ts`, and `tests/auth-redirect.test.mjs`.
- Confirmed that invalid `next` values fall back to `/`, while valid in-app path/query/fragment values are retained.
- No Auth API or network connection was made. Lint, typecheck, build, and tests were not run independently; the reported core results (lint, tsc, seven Node tests, build) were not reproduced in this review.
- Auth-provider behavior and real confirmation-link handling remain unverified.
