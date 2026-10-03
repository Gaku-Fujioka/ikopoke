# REV-12: UI-04 search return recheck

- Task: UI-04 / REV-09 recheck
- Acceptance baseline: `3328981`
- Target: `18fa001`
- UI branch: `feat/kokoiko-mvp-ui`, clean at `18fa00136321dc67c80a4a89a4a6c022a1ff4c4b`.
- Verdict: The REV-09 finding is resolved; no remaining finding in the requested behavior.

## Recheck

- The filtered list appends the trimmed `q` value to each detail URL using `encodeURIComponent()`.
- The detail page reads `q` from its query string and builds the “行きたい一覧へ” URL with the same encoded value.
- With no non-empty `q`, both links use the plain list/detail paths without an empty query parameter.
- This satisfies the acceptance item “詳細から戻る時の条件保持” at source level.

## Checks and limits

- Read fixed diff `3328981..18fa001`, the list and detail pages, and the UI-04 acceptance text in core `TASKS.md`.
- Confirmed the UI worktree was clean at the requested target commit.
- Per the UI report, lint, typecheck, build, and related URL HTTP 200 checks succeeded; these were not independently rerun in this read-only review.
- Browser interaction was not performed, consistent with the reported limitation. No external API calls were made.
