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
