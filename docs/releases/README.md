# Production Release Versioning

This repo now tracks production releases with:

1. A git tag on the production commit: `prod-YYYY.MM.DD.N`
2. A release note file in `docs/releases/`

## Release Steps

1. Confirm `staging` is ready.
2. Compare divergence:
   - `git rev-list --left-right --count origin/production...origin/staging`
3. Promote staging to production:
   - `git switch production`
   - `git merge --ff-only origin/staging`
   - `git push origin production`
4. Create a production tag:
   - `git tag -a prod-YYYY.MM.DD.N <production_sha> -m "Production release prod-YYYY.MM.DD.N"`
   - `git push origin prod-YYYY.MM.DD.N`
5. Add release notes:
   - Create `docs/releases/prod-YYYY.MM.DD.N.md`
   - Include compare base, key updates, and commit list.
6. Commit release note on `staging`, then merge to `production`.

## Notes Template

Use this structure:

- Release ID and date
- Compare range (`<previous_prod_sha>..<new_prod_sha>`)
- What shipped (grouped by area)
- Change size (`files changed`, `insertions`, `deletions`)
- Included commits / PRs
