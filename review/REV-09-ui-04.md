# REV-09: UI-04 search review

- Task: UI-04
- Base: `52ab6f1`
- Target: `3328981`
- UI branch status: clean at `3328981f729b1f77cbe0fd01f8e7aa0b91a96c99` (`feat/kokoiko-mvp-ui`).
- Verdict: One requested navigation behavior needs correction.

## Finding

**Low — `app/app/items/[itemId]/page.tsx` (back-to-list link):** The results list correctly encodes each item ID in its detail link, but the detail page's “行きたい一覧へ” link always points to `/app/items`. When opening a detail page from `/app/items?q=...`, returning this way drops `q` and displays the full list.

- Reproduction: Open `/app/items?q=カフェ`, choose a matching item, then select “行きたい一覧へ”.
- Expected: Return to the filtered list with `q=カフェ` retained.
- Actual: Navigate to `/app/items` without the query.
- Suggested fix: Carry the originating `q` into the detail URL and use it in the back link, or use browser history with a safe list fallback.

## Checks

- Read fixed diff `52ab6f1..3328981`, the item list and item detail pages.
- Confirmed the list reads and trims URL `q`, performs case-insensitive title filtering, exposes a search form and clear links, distinguishes an empty collection from zero matches, and URL-encodes item IDs.
- Confirmed a missing/deleted item renders “候補が見つかりません” once loading completes without error.
- Confirmed the UI worktree was clean at the requested fixed commit.
- No lint, typecheck, build, browser interaction, or tests were run independently; the UI worktree was inspected read-only. No external API calls were made.
