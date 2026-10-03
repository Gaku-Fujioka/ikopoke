# REV-11: AUTH-01 inventory recheck

- Task: AUTH-01
- Base: `e0f7c47`
- Target: `d03ba67`
- Verdict: Both REV-10 findings are resolved; no remaining finding in the rechecked text.

## Recheck

- The password reset bullet now distinguishes `forgot-password-form.tsx` from the separate destination `update-password-form.tsx` and accurately states the `updateUser()` then `/protected` transition.
- The confirmation bullet now says `next` passes through `safeNextPath()`, unsafe values fall back to `/`, and in-app query and fragment are preserved. This matches the target route and helper.
- The document correctly limits real confirmation-link behavior to unverified; no real Auth connection was performed.

## Checks and limits

- Read fixed diff `e0f7c47..d03ba67`, target `app/auth/confirm/route.ts`, `lib/auth/safe-next-path.ts`, and `components/update-password-form.tsx`.
- No Auth API/network calls, lint, typecheck, build, or tests were run. This was a read-only recheck.
