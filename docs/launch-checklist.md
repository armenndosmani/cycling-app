# Launch checklist

Everything that has to be checked by hand before the app goes live. Claude adds to this list whenever something is flagged for later; the team works through it in the final test before production.

Legend: **Who:** L = lawyer, T = team (developer + BA), D = developer.

## Legal review (L)
- [ ] OpenStreetMap licence (ODbL): does our stored database of routes derived from OSM count as a derivative database, and what must we publish or attribute?
- [ ] Map attribution shown in the app meets the OSM and Protomaps requirements
- [ ] Terms of use, including:
  - [ ] age self-declaration (16+, 18+ for rides outside cities) and that false age declarations break the terms; suspension or deletion of the account
  - [ ] "rides are organised by riders, not by us"; riders join at their own risk and judge their own fitness
  - [ ] liability wording that is valid in the EU (no blanket exclusion for injury or gross negligence)
- [ ] Is a self-declared age confirmation enough for the 18+ rule?
- [ ] Deleting accounts of riders found to be under 16 (consent was never valid)
- [ ] Privacy notice and lawful basis for every kind of data, including showing participants to each other
- [ ] Data processing agreements: Hetzner, Mailjet, Apple (APNs), Google (FCM)
- [ ] Retention periods: backups 30 days, past and cancelled rides 12 months then anonymised, ride chat 12 months, logs
- [ ] EU Digital Services Act: notice-and-action, statement of reasons, contact point; which duties apply at our size
- [ ] Accessibility: confirm whether the European Accessibility Act applies to us
- [ ] Inactive accounts: delete accounts unused for a long time (e.g. 2 years)?
- [ ] Garmin Connect developer terms (income permission, FIT SDK licence) before any Garmin integration
- [ ] Strava API terms before any Strava integration
- [ ] Trademark clearance for the chosen product name (TMview, WIPO Global Brand Database), and whether to file an EU trademark

## Accounts and business (T)
- [ ] Decide the product name and the permanent app ID
- [ ] Register the domains for the chosen name
- [ ] Claim the social media handles for the chosen name
- [ ] Apple Developer Program ($99/year) and Google Play Console ($25 once)
- [ ] Garmin, Wahoo and Hammerhead developer applications (need the name and a privacy policy)
- [ ] Running-cost budget (estimate: about EUR 120-150 per month plus about EUR 150 per year)
- [ ] Mailjet plan: the free tier allows 200 emails per day, which may be too low for sign-in codes at launch
- [ ] Launch region (decides the map and routing data and the server size)
- [ ] Published support contact address (App Store guideline 1.2)

## Before production (D)
- [ ] Final end-to-end test on real iOS and Android devices
- [ ] Revisit who may merge pull requests once the app is live
- [ ] Remove the npm overrides (zod, glob, minimatch) if upstream has caught up
- [ ] Backups configured and a restore tested
- [ ] Admin app or at least the moderation endpoints in place (issue #30)
- [ ] Link the published terms of use and privacy notice on the sign-up screen (`mobile/src/app/(auth)/register.tsx`, currently a "not available yet" placeholder)
- [ ] Remove the "Backend status" test screen from the signed-in home (`mobile/src/app/(app)/index.tsx`) once real screens exist
- [ ] Sign-in tested end to end against the real backend on both platforms, including one-time-code autofill, 429 messages and token refresh after 15 minutes
