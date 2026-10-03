# REV-10: AUTH-01 inventory recheck

- Task: AUTH-01
- Base: `52ab6f1`
- Target: `e0f7c47`
- Verdict: The omitted callsites were added, but two documentation issues remain.

## Findings

**Medium — `docs/data-model.md` AUTH-01 confirmation-handler bullet:** It still says the `next` query is used directly as the destination and needs validation before connection. At the target commit, `app/auth/confirm/route.ts` calls `safeNextPath(searchParams.get("next"))`, and `lib/auth/safe-next-path.ts` enforces same-app paths. AUTH-02 `3fb5525` is an ancestor of this commit, so the paragraph is stale and contradicts current code.

- Reproduction/evidence: Compare the paragraph at target with `e0f7c47:app/auth/confirm/route.ts` and `e0f7c47:lib/auth/safe-next-path.ts`.
- Expected: Describe the current validation/fallback behavior, or clearly label the sentence as a historical pre-AUTH-02 observation.
- Actual: Current code sanitizes `next`, while the document says it is passed through directly.
- Suggested fix: State that unsafe values fall back to `/` and app-local pathname, query, and fragment are retained.

**Low — `docs/data-model.md` AUTH-01 password-reset bullet:** “同画面のフォーム” suggests the password update form is on the forgot-password screen. In code, `forgot-password-form.tsx` sends the reset email to `/auth/update-password`; the separate page renders `update-password-form.tsx`, whose `updateUser()` success routes to `/protected`.

- Reproduction/evidence: Compare `app/auth/forgot-password/page.tsx` and `app/auth/update-password/page.tsx` with the two form components.
- Expected: Identify the update form as the separate `/auth/update-password` page.
- Actual: The text can be read as saying the form is on the same screen.
- Suggested fix: Replace “同画面のフォーム” with “遷移先の`/auth/update-password`画面”.

## Reconfirmed additions

- `forgot-password-form.tsx`: `resetPasswordForEmail()` with redirect target `/auth/update-password`.
- `update-password-form.tsx`: `updateUser({ password })`, then `/protected`.
- `logout-button.tsx`: `signOut()`, then `/auth/login`.
- `auth-button.tsx` and `app/protected/page.tsx`: both call `getClaims()`; the protected page redirects to `/auth/login` if claim lookup fails or has no claims.

## Checks and limits

- Read fixed diff `52ab6f1..e0f7c47`, the relevant Auth components/pages, and target-commit confirmation route/helper.
- No Auth API/network calls, lint, typecheck, build, or tests were run. This was a read-only recheck.
