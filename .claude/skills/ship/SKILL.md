---
name: ship
description: Take finished work on a feature branch through local checks, a pull request and green CI, fixing failures along the way. Use when implementation on a branch is done and it should become a PR.
---

# Ship a branch

Goal: a PR with green CI and a clear description. You never merge and never deploy; the developer does both.

## 1. Check the branch

- Run `git branch --show-current`. If it is `main`, stop: create `feat/<name>` or `fix/<name>` first.
- `git status`: everything that belongs to the change is committed; nothing else (no `.env`, no build output, no `docs/presentations/`).

## 2. Local checks

Use the `test-runner` subagent for the areas the branch touched (`git diff --name-only main...HEAD`):
- `backend/` changed: `./mvnw -B -ntp verify` (JDK 25, Docker running)
- `mobile/` changed: `npx tsc --noEmit` and `npx expo lint`
- dependencies changed: `npm audit` in `mobile/`

Fix failures before pushing. If the change touches personal data, location, routes, profiles, chat or participants, run the `privacy-review` skill too.

## 3. Pull request

1. `git push -u origin <branch>`
2. `gh pr create --base main` with:
   - a title in plain words
   - Summary: what changed and why, grouped by backend / mobile / docs
   - Tested: what you ran and the result; say plainly what was not tested (e.g. not run on a device)
   - `Closes #<issue>` for each ticket the PR finishes
   - the PR attribution line from the session instructions

## 4. CI loop

1. `gh pr checks <pr> --watch`
2. On failure: `gh run view <run-id> --log-failed`, read only the failed steps, fix, commit, push, watch again.
3. After 3 failed attempts on the same problem, stop and report: what fails, what you tried, what you need.

`ci-ok` is the required check. Skipped jobs are fine; failed or cancelled ones are not.

## 5. Report

Reply in 3 to 5 lines (in Discord `#status` when the request came from Discord): PR link, CI result, what changed, and anything that needs a decision. Then stop. Merging is the developer's call.
