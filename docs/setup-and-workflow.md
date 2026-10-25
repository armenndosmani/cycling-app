# Setup and Workflow

How this two-person team works with Claude Code. Read this when setting up tooling, CI/CD, or when unsure how a request should flow. Items marked **Planned** are agreed direction but not built yet; items marked **Open** are undecided.

## 1. Team and roles

- **Developer:** runs Claude Code on their PC, reviews every pull request, merges, approves production deploys.
- **BA (business analyst):** writes feature requests and answers product questions in Discord. Does not touch code.
- **Claude:** turns requests into specs, implements on branches, runs the test and preview pipeline, reports back in Discord.

## 2. How requests reach Claude

- Requests arrive through **Claude Code Channels** using the official Discord plugin (`discord@claude-plugins-official`).
- Claude Code runs in the developer's VS Code terminal, started with `claude --channels plugin:discord@claude-plugins-official`, inside tmux so it keeps running.
- Only the developer and the BA are on the allowlist. Both can send requests and approve tool use.
- Discord server layout: `#requests` (BA posts features, Claude replies with specs and questions), `#status` (Claude reports finished work and preview links), `#general` (humans only).
- There is one running session. All Discord messages land in the same context, so separate Discord channels or threads do NOT give separate contexts.
- The session is restarted regularly (e.g. every morning). Anything that must survive a restart has to be written to a file: specs in `docs/specs/`, decisions in `docs/decisions.md`.
- No Jira or separate ticket system. Discord messages are the tickets; the spec file in the repo is the durable version.

## 3. Context strategy

Goal: keep the always-loaded context small and load everything else only when needed.

| Layer | Location | Loads | Status |
| --- | --- | --- | --- |
| Core instructions | `CLAUDE.md` | Every session, keep under ~150 lines | Done |
| Product knowledge | `docs/product-context.md` | On demand | Done |
| Decisions log | `docs/decisions.md` | On demand | Done |
| Specs | `docs/specs/` | On demand, one per feature | Template done |
| Path-scoped rules | `.claude/rules/*.md` with `paths:` frontmatter | Only when matching files are touched | Planned, create per code area as it appears |
| Skills | `.claude/skills/<name>/SKILL.md` | Only when invoked | Planned |
| Subagents | `.claude/agents/<name>.md` | Separate context, only summary returns | Planned |
| Hooks | `.claude/settings.json` | Filter output before it reaches context | Planned |

Planned skills:
- `write-spec`: turn a Discord message into `docs/specs/<feature>.md` using the template.
- `privacy-review`: GDPR and privacy checklist based on section 4 of `docs/product-context.md`; run before merging anything that touches personal data.
- `architecture`: folder layout and conventions; write once the project structure exists.
- `ship`: the build, test, preview and e2e loop in section 5.

Planned subagents:
- `implementer` (Sonnet): builds a feature from a spec on a branch, returns a short summary of changes.
- `test-runner` (Haiku): runs tests, returns only failures.
- `reviewer`: reviews a branch for security and privacy issues before merge.

Planned path-scoped rules: `maps-routing.md` (map and routing code), `database.md` (migrations and access policies), `mobile.md` (mobile app folder).

Planned hooks:
- Filter test and build output down to failures and errors.
- Format and lint after each file edit.
- Block reading `.env*` files and pushing to `main`.

Model use: Opus with plan mode for large designs (e.g. route planner architecture), Sonnet for implementation, Haiku for the test-runner.

## 4. Tools and plugins

| Tool | Status | Notes |
| --- | --- | --- |
| Discord channel plugin | Use | Official plugin, allowlist only |
| TypeScript code intelligence plugin | Use | From the official marketplace, once the TS project exists |
| Context7 MCP | Use | Current docs for Expo, MapLibre, Supabase and other fast-moving libraries |
| `gh` CLI | Use | Preferred over the GitHub MCP server (less context) |
| Playwright tests | Planned | E2E test suite in the repo, run in CI |
| Playwright MCP | Later | For exploratory checks once a web UI exists |
| Graphify | Later | Only if the codebase grows large and code search becomes slow |
| Serena, memory MCP servers, large skill bundles | Skip | Overlap with existing tools or bloat context |

Before installing any new plugin or MCP server: confirm it solves a real problem, prefer official or widely used ones, and check `/usage` afterwards.

## 5. Build, test, deploy pipeline (Planned)

GitHub Actions builds, deploys and tests. Claude drives the loop and fixes failures. Deploy credentials live only in GitHub Actions secrets, never on the developer's PC.

The ship loop:
1. Run a quick local build and unit tests through the test-runner subagent.
2. Push the branch and open a pull request with `gh pr create`.
3. CI builds the app and runs backend tests.
4. CI deploys the branch to a preview environment with its own URL.
5. CI runs Playwright e2e tests against the preview URL.
6. Wait with `gh pr checks --watch`. On failure, read only failed logs with `gh run view --log-failed`, fix, push again.
7. After 3 failed fix attempts on the same problem, stop and ask in Discord.
8. When green, post the PR link and preview link in `#status`.
9. The developer reviews and merges. Production deploys only from `main`, through a GitHub `production` environment that requires the developer's approval.

Hard rules: Claude never deploys to production, never merges, never uses real user data in staging or tests.

Requirements:
- A staging/preview backend separate from production, seeded with fake data only.
- A hosting provider with per-branch preview deployments.
- One workflow with jobs in order: build, backend tests, preview deploy, e2e tests (preview URL passed as an environment variable).
- Pre-allowed commands in `.claude/settings.json`: tests, lint, build, `git status`, `git diff`, `gh pr create`, `gh pr checks`, `gh run view`.

## 6. Safety

- Normal permission prompts by default. Do not use `--dangerously-skip-permissions` on the developer's main PC.
- No production keys or real user data on the machine running Claude Code.
- `main` is protected on GitHub: changes only through reviewed pull requests.

## 7. Open decisions

- Hosting provider (must support preview deployments)
- Backend: Supabase or alternative
- Map tile provider and routing provider (cost, licensing, regional coverage, privacy)
- Launch geography
- Discord: shared `#requests` channel vs direct messages to the bot

## 8. Bootstrap tasks for Claude Code

When asked to bootstrap the setup, do these in order and ask before choosing any provider or framework:
1. Create `.claude/rules`, `.claude/skills`, `.claude/agents` and a `.gitignore` covering `.env*` and `.claude/settings.local.json`.
2. Write the skills `write-spec` and `privacy-review`.
3. Write the subagents `implementer`, `test-runner` and `reviewer`.
4. Write `.claude/settings.json` with the safe pre-allowed commands and the hooks from section 3 (formatting and test-filter hooks can wait until the toolchain exists).
5. Report what was created and what still depends on open decisions.
