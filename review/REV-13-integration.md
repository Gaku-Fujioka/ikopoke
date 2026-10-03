# REV-13: pre-main integration review

- Task: REV-13
- Base: `main` `8762c5c`
- Target: `integration/kokoiko-mvp` `2d5e92b` (`2d5e92bf29e77879af77b2528f4cf59f17b28aea`)
- Verdict: P1 flows and reviewed code fixes are present; two documentation findings and one diff hygiene check remain.

## Findings

**Low — `docs/frontend.md` (“現在の画面・共通部品” and “状態管理と接続状態”):** The integrated document still says the `/app` mock routes, shared app frame/navigation, and URL search state are not implemented. At the target commit, these exist in `app/app/`, `components/layout/`, and `app/app/items/page.tsx`. This was accurate as a UI-01 inventory snapshot but is misleading as a current-state description after the P1 integration.

- Reproduction/evidence: Read the cited sections and inspect target paths `app/app/layout.tsx`, `components/layout/app-nav.tsx`, and `app/app/items/page.tsx`.
- Expected: Update the present-tense inventory to reflect the integrated local mock routes/search, or label it clearly as the historical pre-UI implementation snapshot.
- Actual: It describes those implemented pieces as absent.
- Suggested fix: Add a current implementation/status section and retain the original UI-01 findings as dated baseline notes.

**Low — `AGENTS.md` and `docs/development-flow.md` contain a broken relative link:** Both link to `docs/codex_reproducible_ai_development_workflow.md` (relative to the respective document), but that file is absent from the target tree.

- Reproduction/evidence: Follow the relative links in both files; target path does not exist. A tracked-Markdown relative-link scan found these two broken references and no others.
- Expected: Include the referenced document or point both links to a file that exists in the integration tree.
- Actual: The referenced procedure cannot be opened from this checkout.
- Suggested fix: Carry the intended reference document into the integration if appropriate, or update/remove the links.

## Reviewed behavior

- P1 candidate → reaction → outing plan → explicit visit → completion → memory is wired through `createMockRepository()` and browser `localStorage`; the app layout explicitly says business data APIs are not connected, data stays in this browser, and is not shared.
- UI-04 carries encoded `q` from filtered item cards to detail and back to the list; without `q`, the detail link returns to `/app/items`.
- AUTH-02 routes confirmation `next` through `safeNextPath()`. The helper rejects external, protocol-relative, and backslash paths and falls back to `/`; tests cover accepted query retention and unsafe inputs.
- Prior fixed commits are ancestors of the target: CORE-01 `6f21bb6`, FLOW-01 query fix `45c5795`, UI-04 `18fa001`, AUTH-02 `3fb5525`, and AUTH-01 text fix `d03ba67`. Integrated review reports include REV-11 and REV-12 resolution records.
- Five referenced PNG files resolve in the target tree. AUTH calls remain distinct from mock business-data persistence; no statement implies that local mock success is real service success.
- A tracked-file scan found no `.env`/private-key/credential-named paths and no matches for common private-key, GitHub token, Supabase secret-key, Stripe live-key, or AWS access-key patterns. This is a bounded pattern scan, not a guarantee against every secret format.

## Verification

- Confirmed core worktree was clean at `integration/kokoiko-mvp` and its HEAD was exactly `2d5e92b`; review worktree remains separate.
- Ran `node --experimental-strip-types --test tests/auth-redirect.test.mjs tests/mock-repository.test.mjs`: **7 passed, 0 failed**. Node emitted `MODULE_TYPELESS_PACKAGE_JSON` warnings for the TypeScript test imports.
- Relative Markdown link scan: **2 broken links**, both to the missing reproducible-workflow document above.
- Secret-pattern scan: no matches under the patterns listed above.
- `git diff --check 8762c5c 2d5e92b`: **failed** on trailing whitespace in the two metadata lines of newly added `docs/kokoiko-requirements.md` (lines 3–4). These may be intentional Markdown hard breaks; the gate still reports them.
- Did not rerun lint, typecheck, or build. Existing task records report successes for the integrated checks; no CI workflow exists and CI was not run.
- Browser operation and real Supabase Auth behavior remain unverified. No external API connection, CI trigger, push, or main merge was performed.
