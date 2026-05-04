# v3 → v2 Rollback Plan

## When to use this

If v3 (the new live site) breaks in a way that's hurting real visitors,
follow these steps to revert to v2 in under 5 minutes.

## Symptoms that warrant rollback

- Homepage doesn't load at all
- Booking flow breaks for a meaningful number of users
- A critical bug surfaces that can't be hot-fixed within 30 minutes
- Performance degrades severely

## Rollback steps (5 minutes total)

1. Open `index.html` at the repo root.
2. Find this line:
   ```html
   <meta http-equiv="refresh" content="0; url=v3/index.html">
   ```
   Change `v3/index.html` to `v2/index.html`.
3. Find this line:
   ```js
   location.replace('v3/index.html');
   ```
   Change `v3/index.html` to `v2/index.html`.
4. Commit and push:
   ```
   git add index.html
   git commit -m "Rollback: redirect root to v2 instead of v3"
   git push
   ```
5. GitHub Pages rebuilds in 30-60 seconds. Root URL now lands on v2.
6. Tell anyone testing v3 that v3 is temporarily off; they can still
   visit v3 directly at /v3/index.html if needed.

## Re-enabling v3 after fix

Reverse the same steps — change `v2/index.html` back to `v3/index.html`,
commit, push.

## Notes

- v2 and v3 are both kept on disk. Neither is deleted.
- All v2 URLs (e.g., /v2/about.html) keep working throughout — the
  rollback only changes which version the bare repo URL routes to.
- Bookmark / search-engine-indexed v3 URLs (/v3/index.html etc.) keep
  working; they're not affected by the rollback.
