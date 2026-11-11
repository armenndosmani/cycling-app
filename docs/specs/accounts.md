# Accounts and sign-in

**Requested by:** Decisions of 2026-11-11 (A2, A3, A4) · **Date:** 2026-11-11 · **Status:** Approved

## Goal
Let a rider create an account and sign in with only an email address, without a password, and keep the data we hold to the minimum the core loop needs. Every other feature (routes, rides, chat) builds on these accounts.

## User stories
- As a new rider, I want to enter my email, receive a code and be signed in, so that I don't have to create a password.
- As a returning rider, I want to sign in the same way on a new phone, so that losing a phone never locks me out.
- As a rider, I want to stay signed in on my phone until I sign out.
- As a rider, I want to choose a display name, so that other riders know who I am without seeing my email.
- As a rider aged 18 or older, I want to confirm that once, so that I can join rides outside cities.
- As a rider, I want to delete my account and data myself.

## Acceptance criteria

**Requesting a code**
- [ ] The rider enters an email address. The backend accepts syntactically valid addresses up to 254 characters and normalises them (trim, lower-case).
- [ ] The backend sends a 6-digit code by email. The code is valid for 10 minutes and can be used once. Requesting a new code invalidates the previous one.
- [ ] The response is the same whether or not an account exists for the address, so the API never reveals who is registered.
- [ ] Rate limits: at most 3 code requests per email address per 15 minutes and 20 per IP address per hour. Over the limit the API answers 429 (Problem Details) and the app says when to try again.
- [ ] Codes are stored only as a hash, never in plain text.

**Verifying a code**
- [ ] The rider enters the code. A correct code signs them in. After 5 wrong attempts the code is invalid and a new one must be requested.
- [ ] If no account exists for the address, the rider must confirm "I am 16 or older" and accept the terms of use and privacy notice before the account is created. The backend refuses to create an account without both.
- [ ] The backend stores the date of the 16+ confirmation and the version and date of the accepted terms. It never asks for or stores a birth date.

**Sessions**
- [ ] Signing in returns a short-lived access token (15 minutes) and a refresh token (valid 60 days from its last use).
- [ ] Refresh tokens are single-use: each refresh returns a new pair. Reusing an old refresh token revokes that whole session, and the rider must sign in again.
- [ ] Refresh tokens are stored only as a hash on the server, and in the phone's secure storage (Keychain / Keystore) in the app.
- [ ] Signing out revokes the current session on the server and deletes the tokens on the phone.
- [ ] Every endpoint except health, code request, code verification and token refresh requires a valid access token.

**Profile**
- [ ] Required: display name, 2 to 40 characters, chosen after the first sign-in. It does not have to be unique.
- [ ] Optional: the bicycle types the rider rides (road, gravel, MTB, urban). The route planner uses the first one as its default discipline.
- [ ] The email address is never shown to other riders.
- [ ] The rider can change the display name and bicycle types at any time.

**18+ confirmation**
- [ ] The rider can confirm "I am 18 or older" once. The backend stores only the date of the confirmation. It cannot be undone in the app.
- [ ] Endpoints that need it (joining an 18+ ride) check it on the server.

**Deleting an account**
- [ ] The rider can delete their account in the app after confirming with a fresh email code.
- [ ] Deleting removes the account, profile, sessions and saved routes immediately. Upcoming rides the rider administers are cancelled (see `ride-event-creation.md`). Their participation in other rides is removed. Chat messages stay for the other participants but are shown as "Deleted rider".
- [ ] Deleted data disappears from backups within 30 days.
- [ ] The same email address can be used for a new account later. It starts from scratch.

**Emails**
- [ ] Emails are sent over SMTP: Mailjet in production, a local catch-all mail server (Mailpit) in development. No email ever reaches a real inbox from development or tests.
- [ ] The sign-in email contains the code and nothing about the rider's activity. English only.

**Quality**
- [ ] Errors use Problem Details and never hint whether an address is registered.
- [ ] Every input has an accessible label; the code field supports the phone's one-time-code autofill.

## Privacy notes
- **Personal data involved:** email address, display name, optional bicycle types, dates of the 16+ and 18+ confirmations, accepted terms version, session records (created and last-used time; no IP address or device fingerprint stored with them).
- **Who can see it:** the rider. Other riders see only the display name. The email address is used only for sign-in and account emails.
- **Logs:** no email addresses, codes or tokens in logs. Rate limiting may keep IP addresses in memory for at most one hour.
- **Retention:** until the rider deletes the account. Whether to delete long-inactive accounts is on the launch checklist.
- **Third parties:** Mailjet receives the email address and the code (data processing agreement on the launch checklist).
- **Legal review:** terms of use and privacy notice wording, self-declared age, inactive accounts. No claim that any of this is "GDPR exempt".

## Out of scope
- Sign in with Apple and Google (issue #35)
- Changing the email address
- Profile photo
- Data export (separate spec)
- Blocking and reporting (separate spec)
- Notification settings (separate spec)
- Admin roles and moderation (issue #30)

## Open questions
None. Code length, token lifetimes and rate limits are defaults chosen by Claude and can be tuned later.
