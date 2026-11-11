# Decisions

Confirmed decisions only. One line each: `YYYY-MM-DD | decision | why`. Newest at the bottom.

2026-10-25 | Requests reach Claude Code through Discord using the official Claude Code Channels Discord plugin | Best fit for a two-person team; organized channels and shared history
2026-10-25 | No Jira or separate ticket system; Discord messages are the tickets and specs live in docs/specs/ | Avoid overhead for a two-person project
2026-10-25 | Claude never merges or deploys to production; the developer reviews and merges every PR | Safety and review

2026-10-25 | Mobile app only (iOS + Android); no web app for now | Focus the team of two on one client
2026-10-25 | Mobile built with React Native + Expo, one codebase for iOS and Android | Mature MapLibre bindings, iOS cloud builds from Windows via EAS, over-the-air updates
2026-10-25 | Backend built with Spring Boot | Developer's strongest stack
2026-10-25 | PostgreSQL as the database, managed by the team | Simple, scales well for this workload
2026-10-25 | Architecture: mobile app → Spring Boot backend (REST + WebSocket) → PostgreSQL, plus S3-compatible file storage for avatars; third-party APIs (maps, routing, push) decided later | Minimal structure that covers the core loop
2026-10-25 | Backend: Spring Boot 4.1.2, Java 25 (LTS), Maven, base package com.cyclingapp.backend | Latest stable Spring Boot and Java LTS; Java and Maven are the developer's strongest tools
2026-10-25 | Mobile: Expo SDK 58 (React Native 0.88), TypeScript, Expo Router | Latest stable Expo SDK
2026-10-25 | PostgreSQL 18, pinned image version for local dev and tests | Latest stable major; pinned so dev, tests and CI match
2026-10-25 | Keep the repo in the developer's OneDrive folder | Developer preference; build output is git-ignored
2026-10-25 | mobile: override zod to ^4.6.7 (Expo CLI pins zod 3) | Fixes GHSA-mrhx-c7xc-m3w5; no 3.x backport exists; Expo CLI verified working with zod 4. Remove the override once Expo ships zod 4 itself
2026-10-26 | Temporary audit exception: node-forge GHSA-86w9-cpqp-85rv (high) via Expo CLI | No patched release exists (<=1.4.0, latest is 1.4.0). Dev-time CLI only, not in the app bundle; we don't use expo-updates code signing. Recheck when CI is set up and on every Expo update; remove once node-forge releases a fix. Not pointing at unmerged upstream PRs (supply-chain risk)
2026-11-11 | node-forge exception resolved: Expo 58.0.23 + node-forge 1.4.3 (outside GHSA-86w9-cpqp-85rv range) | Fix released upstream; npm audit is at 0
2026-11-11 | mobile: scoped overrides glob@^13 -> ^14.0.4 and minimatch@^10 -> ^11.0.8 | Fix GHSA-3g3m-2fjr-6pw4 and GHSA-g3hv-75wg-m249 (no backports). Checked Expo CLI, @expo/fingerprint and typescript-eslint only use APIs kept in the new majors; tsc, lint, fingerprint, iOS/Android export, dev server and expo-doctor pass. zod override now only needed for eslint-plugin-react-hooks. Remove overrides once upstream deps move on
2026-11-11 | Security baseline is 0 known vulnerabilities in mobile (npm audit) and backend (OSV check of all Maven deps) | Agreed bar before feature work starts; CI will enforce it
2026-11-11 | main is protected: PRs only (0 approvals, single account), applies to admins, no force push/deletion, branches auto-deleted on merge | Enforces "never commit to main" for everyone, including Claude
2026-11-11 | CI: one GitHub Actions workflow (ci.yml) with change detection; single required check `ci-ok`; actions pinned to commit SHAs | Path-filtered required checks would block merges when skipped; SHA pins prevent tag hijacking
2026-11-11 | Vulnerability gate in CI: npm audit (mobile) + OSV check of resolved Maven deps (backend), on every PR and weekly | Keeps the 0-vulnerability baseline without paid tools or NVD API keys
2026-11-11 | Dependabot weekly; npm in lockfile-only mode so Expo SDK versions are never bumped automatically | Expo SDK upgrades must go through `npx expo install --fix`
2026-11-11 | Claude Code guard hook (.claude/hooks/guard.mjs, Node) blocks .env access (except .env.example), git push to main and gh pr merge | Node runs the same on Windows and CI; branch protection remains the real enforcement
2026-11-11 | Backend secure by default with Spring Security: stateless, every endpoint 401 unless explicitly opened, no generated default user | Server-side authorization rule; no endpoint can become public by accident before login is specified
2026-11-11 | API errors use RFC 9457 Problem Details without exception messages, stack traces or rejected values | One error format for the app; no internal or personal data in responses
