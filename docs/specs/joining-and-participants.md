# Joining a ride, approvals, invitations and participants

**Requested by:** Product baseline (`docs/product-context.md` sections 3D, 3E) and decisions of 2026-11-11 · **Date:** 2026-11-11 · **Status:** Approved with defaults (BA may change them)

## Goal
Let riders join a published ride according to its access mode (open, approval required, invite only), let the admin manage who rides, and give every confirmed participant a clear, private participant list. This is the "invite → approve" part of the core loop and the step before ride chat.

## User stories
- As a rider, I want to join an open ride with one tap so that I have my place.
- As a rider, I want to request to join an approval ride, with an optional message, so that the admin can decide.
- As a ride admin, I want to see join requests and accept or reject them so that I control who rides with me.
- As a ride admin, I want to invite riders with a link so that friends can join my invite-only ride.
- As a participant, I want to see who else is riding so that I know the group.
- As a participant, I want to leave a ride easily so that the admin knows I'm not coming.
- As a participant, I want to confirm again when the ride time moves so that the admin knows I can still make it.
- As a ride admin, I want to remove a participant so that I can keep the ride safe.

## Acceptance criteria

**Statuses**
- [ ] A rider's relation to a ride has one status: `REQUESTED`, `CONFIRMED`, `NEEDS_RECONFIRMATION`, `REJECTED`, `LEFT` or `REMOVED`. The app shows each in plain words.
- [ ] Only `CONFIRMED` and `NEEDS_RECONFIRMATION` riders count towards the participant limit and are "participants".

**Joining (all modes)**
- [ ] A rider can join or request only a published, not cancelled ride whose start time has not passed.
- [ ] 18+ rides: a rider without the 18+ confirmation cannot join or request; the app offers the one-time confirmation. Enforced by the backend.
- [ ] A rider who blocked the admin, or whom the admin blocked, cannot join or request (once blocking exists, see #60).
- [ ] The admin is always a participant and cannot join, leave or request their own ride.

**Open rides**
- [ ] Joining makes the rider `CONFIRMED` immediately while places are left.
- [ ] When no places are left, the ride shows "Full" and joining is refused. Two riders taking the last place at the same moment cannot both get it (enforced in the database).

**Approval rides**
- [ ] The rider sends a request with an optional message (up to 300 characters). Status: `REQUESTED`.
- [ ] The admin sees pending requests (display name, message, time) and accepts or rejects each.
- [ ] Accepting is refused when the ride is full.
- [ ] A rejected rider cannot request the same ride again.
- [ ] The rider can withdraw a pending request.
- [ ] Pending requests expire at the ride's start time.

**Invite-only rides and invite links**
- [ ] The admin can create an invite link for the ride, copy it and share it through any app. The link contains a random token, not the ride id.
- [ ] A signed-in rider who opens the link sees the ride (as a non-participant) and can join directly, subject to places and the 18+ rule.
- [ ] The admin can revoke the link and create a new one; the old link stops working immediately.
- [ ] Links stop working when the ride starts or is cancelled.
- [ ] Open and approval rides can also have an invite link; it then simply opens the ride.
- [ ] Opening a link without the app is handled by the invite landing page (#61).
- [ ] The admin can change the access mode of a published ride; it applies only to future joins. Pending requests stay pending when switching to open (the admin still decides them).

**Participant list**
- [ ] Participants and the admin see the list of participants: display name, "admin" label, and "needs to reconfirm" when applicable. Nothing else about them.
- [ ] Riders who are not participants see only the number of participants and places left.
- [ ] Requests, rejections, departures and removals are visible only to the admin and the rider concerned.

**Leaving and removing**
- [ ] A participant can leave until the start time. The admin is notified (notifications spec #59).
- [ ] A rider who left can join or request again while the ride allows it.
- [ ] The admin can remove a participant, with an optional reason shown to that rider. A removed rider cannot join or request that ride again.
- [ ] The admin cannot leave; they hand the ride over or cancel it (see `ride-event-creation.md`).

**Reconfirmation**
- [ ] When the admin moves the start by more than 1 hour, every participant except the admin becomes `NEEDS_RECONFIRMATION`.
- [ ] The participant can confirm again (back to `CONFIRMED`) or leave.
- [ ] Unconfirmed participants keep their place until 2 hours before the new start time. Then their place is released, their status becomes `LEFT`, and they are notified.

**Server-side rules**
- [ ] Every rule above is enforced by the backend. The app's checks are for convenience only.
- [ ] Exact route and meeting point become visible to a rider as soon as they are `CONFIRMED` or `NEEDS_RECONFIRMATION`, and are hidden again after they leave or are removed.

## Privacy notes
- **Personal data involved:** who takes part in which ride (and so where they will be, and when), join request messages, removal reasons.
- **Who can see it:** participant lists only for participants and the admin; requests and removals only for the admin and the rider concerned. Never in discovery or on profiles.
- **Invite links:** anyone holding the link can see the ride's public facts and join; the link never reveals the exact meeting point to non-participants. Links must be long random tokens and revocable.
- **Retention:** participation records follow the ride (anonymised 12 months after the start). Request messages and removal reasons are deleted when the ride is anonymised.
- **Logs:** no participant lists, messages or invite tokens in logs.
- **Legal review:** lawful basis for showing participants to each other (already on the launch checklist).

## Out of scope
- Ride chat (#58)
- Notifications delivery (#59): this spec only says when a notification is due
- Blocking and reporting (#60): this spec only respects blocks once they exist
- Invite landing page and universal links (#61)
- Inviting riders by searching for them in the app, following riders, waitlists, no-show tracking (decided: no tracking in the MVP)

## Defaults (2026-11-11, chosen by Claude because the BA asked to continue; the BA may change them)
- Invitations: invite links only in the MVP. Inviting riders from past rides comes later.
- Reconfirmation deadline: 2 hours before the new start time.
- Changing the access mode after publishing: allowed, affects only future joins.
- Join request message: optional, up to 300 characters.
- Rejoining after removal: never for that ride.

## Open questions
None.
