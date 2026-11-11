# Ride event creation

**Requested by:** Product baseline (`docs/product-context.md` sections 3D, 3E and 9) · **Date:** 2026-11-11 · **Status:** Draft

## Goal
Let a rider turn a planned route, or just an idea of a ride, into a group ride event with a time, a meeting point, a pace and a participant limit, and decide who may join. The creator becomes the ride admin. This is the second step of the core loop, after the route planner.

## User stories
- As a rider, I want to create a ride from one of my saved routes so that others can see what we will ride.
- As a rider, I want to create a ride before the route is ready, with a target distance, so that I can start inviting people early.
- As a ride admin, I want to set date, start time, meeting point, discipline, pace and a participant limit so that riders know what to expect.
- As a ride admin, I want to choose whether anyone can join, riders must request to join, or only invited riders can join so that I control who rides with me.
- As a ride admin, I want to edit the details or cancel the ride so that riders always have current information.
- As a rider browsing rides, I want to see the key facts of a ride (when, where, discipline, distance, pace, places left) so that I can decide whether to join.

## Acceptance criteria

**Creating a ride**
- [ ] A rider can start "Create ride" from a saved route, or without a route.
- [ ] Required fields: ride name (3 to 80 characters), date, start time, meeting point, discipline, pace, participant limit, access mode.
- [ ] Optional field: description (up to 2,000 characters).
- [ ] The meeting point is set on the map or through place search. By default it is the route's start point; the admin can move it.
- [ ] Date and start time are in the meeting point's local time zone and are stored with that time zone. Riders in another time zone see the same local time, labelled with the zone.
- [ ] The start time must be at least 30 minutes in the future when the ride is published (proposed, see open questions).
- [ ] Pace is one of: Relaxed, Steady, Fast, Mixed/regroup.
- [ ] Discipline is one of: road, gravel, MTB, urban. When created from a route, it defaults to the route's discipline.
- [ ] Participant limit is a whole number from 2 to 50, counting the admin (proposed range, see open questions).
- [ ] Access mode is one of:
  - **Open:** riders join directly while places are left.
  - **Approval required:** riders request to join; the admin accepts or rejects.
  - **Invite only:** only riders the admin invited can join.
- [ ] Every field has a clear validation message next to it. The ride cannot be published while a required field is missing or invalid.
- [ ] All validation is repeated in the backend; the app's checks are for convenience only.

**Route and distance**
- [ ] A ride created from a route shows the route's calculated distance, elevation gain and elevation profile. These are read from the saved route, not typed in.
- [ ] A ride created without a route requires a target distance in km (1 to 500). It is shown as "about 60 km (planned)" and is never presented as a calculated route result.
- [ ] The admin can attach a saved route to a ride later. The calculated distance then replaces the target distance.

**Publishing and visibility**
- [ ] The creator becomes the ride admin when the ride is created.
- [ ] Publishing makes an Open or Approval-required ride visible in discovery for its area. (Discovery itself is a separate spec.)
- [ ] An Invite-only ride never appears in discovery, search or on profiles, and is visible only to the admin and invited riders. Enforced by the backend.
- [ ] Before a rider is a confirmed participant, they see the ride's name, date, time, discipline, pace, distance, elevation gain, meeting area, places left and admin's display name, but not the exact route line or exact meeting point (proposed privacy default, see open questions).
- [ ] Confirmed participants and the admin see the full route and the exact meeting point.
- [ ] The ride shows the participant limit and places left. (Joining and approval are a separate spec.)

**Editing and cancelling**
- [ ] Only the admin can edit or cancel the ride. Enforced by the backend.
- [ ] The admin can edit name, description, pace, meeting point, date and start time while the ride has not started.
- [ ] The participant limit cannot be set below the number of confirmed participants.
- [ ] The admin can cancel the ride with an optional message. A cancelled ride is removed from discovery, is shown as "Cancelled" to participants and invited riders, and cannot be joined.
- [ ] A ride whose start time has passed is shown as past and is removed from discovery.

## Privacy notes
- **Personal data involved:** the admin's account and display name, the meeting point, the route, the date and time when a group of identifiable people will be at a place, and later the participant list.
- **Who can see it:** depends on the access mode. Invite-only rides are visible only to the admin and invitees. For open and approval rides, the exact route and meeting point are shown only to confirmed participants by default, because they can reveal where people live and when they will be away from home.
- **Generalisation:** for non-participants, the meeting point is shown as an area (e.g. a circle of about 500 m or the neighbourhood name) and the route line is hidden or blurred near start and end (method to be decided by the developer). The exact coordinates must not be sent to the app for these users; hiding them only in the app is not enough.
- **Retention:** how long past and cancelled rides, their routes and participant lists are kept is not defined yet (open question). Account deletion must remove or anonymise the rider's rides and participation.
- **Logs:** no meeting points, coordinates or participant lists in logs.
- **Legal review:** lawful basis for showing participants to each other, retention periods, privacy notice wording. No claim that any of this is "GDPR exempt".

## Out of scope
- Joining, join requests, approval, invitations and the participant list (separate spec: peloton)
- Ride chat (separate spec)
- Ride discovery, filters and the map of rides (separate spec)
- Notifications about edits and cancellations (separate spec; the channel is undecided)
- Recurring rides, waitlists and clubs
- Calendar invites (.ics), invite links and route export to devices (proposed for MVP elsewhere, not in this spec)
- Transferring admin rights
- Paid features

## Open questions
- **Exact route before approval:** is the proposed default (exact route and meeting point only for confirmed participants) right for open rides too? Product-context section 8. *(BA)*
- **Clubs:** can rides exist on their own in the MVP, or must every ride belong to a club or group? Affects the data model now. *(BA)*
- **Full rides:** what does "Open" mean when no places are left: closed, or a waitlist? *(BA)*
- **Late joining:** can riders join after the start time? *(BA)*
- **Route changes after publishing:** may the admin swap or edit the route after riders have joined? If so, how are they told? *(BA)*
- **Date or time changes:** do confirmed participants stay confirmed when the admin moves the ride, or do they need to confirm again? *(BA)*
- **Admin leaves:** what happens when the admin deletes their account or wants to hand the ride over? *(BA)*
- **Limits:** are 2 to 50 participants and "at least 30 minutes in the future" the right defaults? *(BA)*
- **Draft rides:** should the admin be able to save a ride without publishing it? *(BA)*
- **Meeting point generalisation:** circle radius or neighbourhood name, and how to hide the route ends? *(developer, proposal for BA review)*
- **Retention:** how long are past and cancelled rides kept? *(BA, with legal review)*
- **Notifications:** how are participants told about edits and cancellations (push, email, in-app only)? *(BA + developer)*
