---
name: privacy-review
description: GDPR and privacy checklist for a branch or diff, based on the product's privacy principles. Run before opening or merging any PR that touches personal data, location, routes, profiles, chat, participants, logging, analytics or third-party services.
---

# Privacy review

Review the current branch against `main` (`git diff main...HEAD`), or the files the user names. Read `docs/product-context.md` section 4 and the privacy rules in `CLAUDE.md` first.

## Checklist

For each item: pass, fail (with file:line), or not applicable.

**Data collection**
- [ ] Only data the feature needs is collected. Optional profile fields stay optional.
- [ ] No background GPS or location tracking. Location is user-selected or a one-time "near me" action.
- [ ] No new analytics, ad, tracking or third-party SDKs. Any new third-party service is listed for the team to decide.
- [ ] Strava or other integrations are not required to use the feature.

**Visibility and access**
- [ ] Authorization is enforced server-side (Spring), not only in the app.
- [ ] Route drafts stay private until published.
- [ ] Private rides and invitations never appear in public discovery or public endpoints.
- [ ] Chat and participant details are visible only to approved ride members and admins.
- [ ] Route start/end points: considered whether to generalize them (they can reveal home or work). Exact points never leave the server for users who should not see them.
- [ ] API responses do not include fields the caller should not see (check DTOs, not just the UI).

**Storage and retention**
- [ ] New personal data has a defined retention period, or the gap is listed as an open question.
- [ ] Account deletion and data export still cover the new data.
- [ ] No personal data, tokens or exact locations in logs.

**Security**
- [ ] No secrets in code or config. `.env` files untouched.
- [ ] Input is validated server-side. No SQL built from strings.
- [ ] Only `/actuator/health` is exposed; API docs stay dev-only.

**Tests and data**
- [ ] Tests, seeds and fixtures use fake data only.

## Output

1. A short verdict: ready, or blocked by N items.
2. Failures with file:line and a concrete fix.
3. Items needing legal assessment (lawful basis, privacy notice, processor agreements, international transfers). Never call anything "GDPR exempt".
