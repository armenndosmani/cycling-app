# Cycling Community App

Privacy-first cycling community app for iOS and Android. Core loop: plan a route → create a ride event → invite or discover riders → approve participants → ride-specific chat → ride together. It is not a performance tracker or leaderboard app.

Team of two. The **developer** builds, reviews and merges. The **BA** (business analyst) writes requirements, usually in Discord.

## Status

Early stage. First priority: route planner and event creation. Stack is decided (see below). Product name, hosting, map/routing providers and launch geography are NOT decided. Never assume a provider: propose options with trade-offs (cost, privacy, lock-in, coverage) and let the team decide.

## Where knowledge lives (read on demand)

- `docs/product-context.md`: full product baseline (features, MVP scope, privacy principles, open product rules)
- `docs/setup-and-workflow.md`: how this team works with you (Discord, context strategy, CI/CD, tools)
- `docs/decisions.md`: confirmed decisions. Only entries here are confirmed; everything else is a suggestion or open question
- `docs/specs/`: one spec per feature, based on `docs/specs/_template.md`

When a decision is made in Discord or in a session, append it to `docs/decisions.md` as `YYYY-MM-DD | decision | why`.

## Stack (confirmed, see `docs/decisions.md`)

One repo. No web app for now.

- `mobile/`: React Native with Expo, one codebase for iOS and Android
- `backend/`: Spring Boot, REST + WebSocket (chat)
- PostgreSQL, managed by the team; S3-compatible file storage for avatars

Third-party services (map tiles, routing, push notifications) are NOT decided yet.

## Commands

TBD: fill in once the project is initialized (dev, build, test, lint, e2e).

## Privacy rules (non-negotiable)

- No background GPS or location tracking. Location is user-selected or a deliberate one-time "near me" action.
- No ad trackers, no selling data, no unnecessary analytics or third-party SDKs.
- Collect the minimum data. Optional profile fields stay optional. Strava is never required.
- Route drafts stay private until published. Private rides and invitations never appear in public discovery.
- Consider generalizing route start/end points, since they can reveal home or work locations.
- Enforce authorization server-side (e.g. row-level security), never only in the client.
- Chat and participant details are visible only to approved ride members and admins.
- No real personal data in tests, seeds, fixtures or staging. Use fake data.
- Never call the app "GDPR exempt". Flag anything that needs legal assessment.

## Working rules

- Never commit to `main`. One branch per feature: `feat/<name>` or `fix/<name>`.
- Never merge pull requests and never deploy to production. The developer does both.
- Never read, print or commit `.env` files or secrets.
- Prefer simple, buildable MVP choices. Don't add features beyond the spec.
- Delegate heavy work to subagents (implementer, test-runner, reviewer) to keep the main session lean.
- Use the `gh` CLI for GitHub. Use Context7 to check current library docs before using unfamiliar APIs.

## Discord workflow

Requests arrive from the developer or the BA through the Discord channel.

1. Save the request as a spec in `docs/specs/<feature>.md` using the template.
2. Reply in Discord with a 3 to 5 line summary and any open questions. Keep Discord replies short.
3. Wait for "go" before implementing. If something is unclear, ask instead of guessing.
4. Delegate implementation to the implementer subagent on a new branch.
5. Run the ship workflow in `docs/setup-and-workflow.md` (once CI exists).
6. Report in Discord: what changed, PR link, preview link, and anything that needs a decision.

## Compact instructions

When compacting, keep: the current task, active spec names, open questions per spec, branch and PR names with their status, and decisions not yet written to `docs/decisions.md`. Drop file contents and tool output.
