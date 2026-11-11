---
name: write-spec
description: Turn a feature request (usually a Discord message from the BA or developer) into a spec file at docs/specs/<feature>.md using the team template. Use when a new feature or change request arrives, before any implementation.
---

# Write a spec

Turn the request into `docs/specs/<feature>.md`. Do not write code. Implementation waits for "go".

## Steps

1. Read `docs/specs/_template.md` and follow its sections exactly.
2. Read `docs/decisions.md`. Only entries there are confirmed. Read the relevant parts of `docs/product-context.md` for product rules and privacy principles.
3. Pick a short kebab-case file name, e.g. `route-planner.md`. If a spec for this feature already exists, update it instead of creating a second one.
4. Fill in the template:
   - **Requested by / Date / Status**: who asked, today's date, `Draft`.
   - **Goal**: one or two sentences, the problem and for whom.
   - **User stories**: as a rider / ride admin.
   - **Acceptance criteria**: specific and testable. One behavior per checkbox. No vague words like "fast" or "intuitive" without a measure.
   - **Privacy notes**: what personal data is involved, who can see it, how long it is kept. Flag anything that needs legal review. Never claim something is "GDPR exempt".
   - **Out of scope**: what this feature deliberately does not include.
   - **Open questions**: each with who should answer (BA or developer).
5. Keep to the request. Do not add features that are not asked for. Put ideas under Open questions instead.
6. Never assume an undecided provider (maps, routing, push, hosting). If the feature needs one, list the decision as an open question.

## Reply

After saving, reply with a 3 to 5 line summary: the file path, the goal in one line, and the open questions. Then wait for "go".
