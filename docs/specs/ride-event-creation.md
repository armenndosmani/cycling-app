# Ride event creation

**Requested by:** Product baseline (`docs/product-context.md` sections 3D, 3E and 9) · **Date:** 2026-11-11 · **Status:** In progress (backend: issue #40)

## Goal
Let a rider turn a planned route, or just an idea of a ride, into a group ride event with a time, a meeting point, a pace and a participant limit, and decide who may join. The creator becomes the ride admin. This is the second step of the core loop, after the route planner.

## User stories
- As a rider, I want to create a ride from one of my saved routes so that others can see what we will ride.
- As a rider, I want to create a ride before the route is ready, with a target distance, so that I can start inviting people early.
- As a ride admin, I want to set date, start time, meeting point, discipline, pace and a participant limit so that riders know what to expect.
- As a ride admin, I want to choose whether anyone can join, riders must request to join, or only invited riders can join so that I control who rides with me.
- As a ride admin, I want to save a ride as a draft and publish it later so that I can prepare it without anyone seeing it.
- As a ride admin, I want to edit the details, hand the ride over or cancel it so that riders always have current information.
- As a rider browsing rides, I want to see the key facts of a ride (when, where, discipline, distance, pace, age rating, places left) so that I can decide whether to join.

## Acceptance criteria

**Creating a ride**
- [ ] A rider can start "Create ride" from a saved route, or without a route.
- [ ] Required fields: ride name (3 to 80 characters), date, start time, meeting point, discipline, pace, participant limit, access mode.
- [ ] Optional field: description (up to 2,000 characters).
- [ ] The meeting point is set on the map or through place search. By default it is the route's start point; the admin can move it.
- [ ] Date and start time are in the meeting point's local time zone and are stored with that time zone. Riders in another time zone see the same local time, labelled with the zone.
- [ ] The start time must be at least 30 minutes in the future when the ride is published.
- [ ] Pace is one of: Relaxed, Steady, Fast, Mixed/regroup.
- [ ] Discipline is one of: road, gravel, MTB, urban. When created from a route, it defaults to the route's discipline.
- [ ] Participant limit is a whole number from 2 to 50, counting the admin.
- [ ] Access mode is one of:
  - **Open:** riders join directly while places are left. When no places are left, the ride is shown as "Full" and cannot be joined.
  - **Approval required:** riders request to join; the admin accepts or rejects.
  - **Invite only:** only riders the admin invited can join.
- [ ] Every field has a clear validation message next to it. The ride cannot be published while a required field is missing or invalid.
- [ ] All validation is repeated in the backend; the app's checks are for convenience only.

**Drafts**
- [ ] The admin can save a ride as a draft at any time, even with fields missing. A draft is visible only to its admin, never in discovery or to invited riders. Enforced by the backend.
- [ ] Publishing a draft runs the full validation.

**Route and distance**
- [ ] A ride created from a route stores its own copy of the route. Later edits to the saved route do not change the ride.
- [ ] The ride shows the route's calculated distance, elevation gain and elevation profile, read from the ride's copy, never typed in.
- [ ] A ride created without a route requires a target distance in km (1 to 500). It is shown as "about 60 km (planned)" and is never presented as a calculated route result.
- [ ] The admin can attach a saved route to a ride later. The calculated distance then replaces the target distance.

**Age rating**
- [ ] The backend sets each ride's age rating automatically: **16+** when the whole route stays inside one city's boundary (OpenStreetMap administrative boundary), **18+** otherwise. A ride without a route is 18+ until a route inside one city is attached.
- [ ] The admin cannot choose or override the age rating.
- [ ] The rating is shown on the ride ("16+" or "18+") everywhere the ride appears.
- [ ] Riders who have not confirmed "I am 18 or older" can see 18+ rides but cannot join them; the join check is enforced by the backend. (Joining itself is a separate spec.)
- [ ] The rating is recalculated whenever the route changes. A route change that would turn a 16+ ride into an 18+ ride is blocked while riders under 18 are confirmed, and the admin is told why.

**Publishing and visibility**
- [ ] The creator becomes the ride admin when the ride is created.
- [ ] Publishing makes an Open or Approval-required ride visible in discovery for its area. (Discovery itself is a separate spec.)
- [ ] An Invite-only ride never appears in discovery, search or on profiles, and is visible only to the admin and invited riders. Enforced by the backend.
- [ ] Before a rider is a confirmed participant, they see the ride's name, date, time, discipline, pace, distance, elevation gain, elevation profile, meeting area, age rating, places left and the admin's display name, but not the route line or the exact meeting point.
- [ ] Confirmed participants and the admin see the full route and the exact meeting point.
- [ ] The ride shows the participant limit and places left. (Joining and approval are a separate spec.)
- [ ] A ride cannot be joined after its start time.

**Editing, handing over and cancelling**
- [ ] Only the admin can edit, hand over or cancel the ride. Enforced by the backend.
- [ ] The admin can edit name, description, pace, meeting point, route, date and start time while the ride has not started. Every confirmed participant is notified of each change.
- [ ] If the date or start time moves by more than 1 hour, confirmed participants must confirm again. Until they do they keep their place but are shown as "not confirmed"; the reconfirmation flow belongs to the joining spec.
- [ ] The participant limit cannot be set below the number of confirmed participants.
- [ ] The admin can hand the ride over to a confirmed participant, who becomes the new admin. The previous admin stays a participant.
- [ ] If the admin deletes their account or leaves without handing over, upcoming rides they admin are cancelled and participants are notified.
- [ ] The admin can cancel the ride with an optional message. A cancelled ride is removed from discovery, is shown as "Cancelled" to participants and invited riders, and cannot be joined.
- [ ] A ride whose start time has passed is shown as past and is removed from discovery.

**Data model**
- [ ] A ride has an optional reference to a club. No club features or screens are built in this spec.

## Privacy notes
- **Personal data involved:** the admin's account and display name, the meeting point, the route, the date and time when a group of identifiable people will be at a place, and later the participant list.
- **Who can see it:** depends on the access mode. Drafts are visible only to the admin. Invite-only rides are visible only to the admin and invitees. For open and approval rides, the route line and exact meeting point are shown only to confirmed participants, because they can reveal where people live and when they will be away from home.
- **Generalisation:** non-participants see the meeting point as a circle of about 500 m. The circle's centre is offset from the real point by a random amount that is chosen once per ride and stored, so repeated requests cannot narrow it down. Exact coordinates and the route line are never sent to the app for these users; hiding them only in the app is not enough.
- **Retention:** past and cancelled rides are kept for 12 months after their start time, then anonymised (legal review pending). Account deletion must remove or anonymise the rider's rides and participation.
- **Notifications:** sent as push notifications directly through Apple (APNs) and Google (FCM), plus an in-app list. No third-party push service.
- **Logs:** no meeting points, coordinates or participant lists in logs.
- **Legal review:** lawful basis for showing participants to each other, retention periods, privacy notice wording, age self-declaration. No claim that any of this is "GDPR exempt".

## Out of scope
- Joining, join requests, approval, invitations, reconfirmation and the participant list (separate spec: peloton)
- Ride chat (separate spec)
- Ride discovery, filters and the map of rides (separate spec)
- Sending notifications (separate spec; channel decided: direct push + in-app list)
- Recurring rides, waitlists and club features
- Calendar invites (.ics), invite links and route export to devices (proposed for MVP elsewhere, not in this spec)
- Paid features

## Decisions (2026-11-11, see `docs/decisions.md`)
- Exact route and meeting point only for confirmed participants, including open rides.
- Rides can exist without a club; optional club reference in the data model.
- Notifications: direct push (APNs/FCM) plus an in-app list; email only for sign-in and account matters.
- Age rating 16+/18+ set automatically from the route; 16–17-year-olds can see 18+ rides but not join them.
- Full open rides are closed (no waitlist in the MVP); no joining after the start time.
- Route changes allowed, participants notified; date/time moved by more than 1 hour needs reconfirmation.
- Admin can hand over to a participant; otherwise the ride is cancelled when the admin leaves.
- Limits: 2 to 50 participants, published at least 30 minutes before the start. Drafts allowed.
- Meeting point generalisation: about 500 m circle with a random offset fixed per ride.
- Retention: 12 months after the start time, then anonymised.
- A route change that would make the ride 18+ is blocked while riders under 18 are confirmed.

## API (implemented, issue #40)
All endpoints need an access token (401 otherwise). Errors are Problem Details. Rides a rider may not see answer 404 (drafts for everyone but the admin, invite-only rides for everyone but the admin and participants); admin actions by a rider who can see the ride answer 403 `urn:cycling:problem:not-ride-admin`.
- `POST /api/rides` → 201 + `Location`, body = Ride (status `DRAFT`). Request, all optional while a draft except `name`: `{"name", "description", "startDate": "YYYY-MM-DD", "startTime": "HH:mm", "timeZone": IANA id, "meetingPoint": {"lat", "lon"}, "discipline": "ROAD|GRAVEL|MTB|URBAN", "pace": "RELAXED|STEADY|FAST|MIXED", "participantLimit", "accessMode": "OPEN|APPROVAL|INVITE_ONLY", "routeId", "targetDistanceKm"}`. Format rules apply even to drafts (name 3 to 80, description up to 2,000, limit 2 to 50, target 1 to 500, time `HH:mm`, a valid IANA time zone) → 400 with `errors: [{"field", "message"}]`. `routeId` must be one of the rider's saved routes (404 otherwise); the ride stores its own copy (geometry, distance, elevation gain and profile, surfaces), so later edits or deletion of the saved route never change it. Without a meeting point the route's start is used; without a discipline the route's discipline. With a route the target distance is dropped.
- `PUT /api/rides/{id}` same body, admin only. Replaces the details. A `routeId` uuid attaches or replaces the copy; `"routeId": null` removes it (then `targetDistanceKm` applies); a missing `routeId` property keeps the current copy (a `targetDistanceKm` sent along is then ignored). Not allowed when cancelled or (published and) started: 409 `urn:cycling:problem:ride-not-editable`. A published ride must stay complete (400 otherwise), and a new start must be at least 30 minutes ahead. Limit below the riders holding a place: 409 `urn:cycling:problem:limit-below-participants`. On a published ride a start moved by more than 1 hour sets every confirmed participant except the admin to "needs reconfirmation". Drafts can be edited whatever their date.
- `POST /api/rides/{id}/publish` → 200 Ride. Draft only (409 `urn:cycling:problem:ride-not-draft`). Full validation (all required fields, ranges, start at least 30 minutes ahead, target distance when there is no route) → 400 listing every failing field.
- `POST /api/rides/{id}/cancel` `{"message"?}` (up to 500 characters; the body may be left out) → 200 Ride with status `CANCELLED`. Drafts: 409 `urn:cycling:problem:ride-not-published`; already cancelled or started: 409 `ride-not-editable`.
- `POST /api/rides/{id}/handover` `{"userId"}` → 200 Ride. The target must be another participant with status confirmed (409 `urn:cycling:problem:handover-target-invalid`); the previous admin stays a participant.
- `DELETE /api/rides/{id}` → 204 for drafts; published or cancelled rides: 409 `ride-not-draft`.
- `GET /api/rides/mine` → `[RideSummary]`: rides the rider administers (drafts included) or holds a place on. Upcoming first (soonest first, drafts without a date after them), then past ones (most recent first); cancelled rides keep their place in that order and have status `CANCELLED`. RideSummary: `{"id", "status", "past", "name", "startsAt", "startDate", "startTime", "timeZone", "discipline", "ageRating", "distanceMeters", "distanceIsPlanned", "targetDistanceKm", "confirmedCount", "participantLimit", "viewerRole"}`.
- `GET /api/rides/{id}` → Ride: `{"id", "status": "DRAFT|PUBLISHED|CANCELLED", "past", "name", "description", "startDate", "startTime", "timeZone", "startsAt" (ISO-8601 instant, null until date, time and zone are set), "discipline", "pace", "participantLimit", "confirmedCount", "placesLeft", "accessMode", "ageRating": "16+|18+", "admin": {"id", "displayName"}, "viewerRole": "ADMIN|PARTICIPANT|NONE", "distanceMeters", "ascendMeters", "elevationProfile", "surfaces", "distanceIsPlanned", "targetDistanceKm", "meetingPoint", "meetingArea": {"lat", "lon", "radiusMeters": 500}, "routeGeometry", "cancelMessage", "needsReconfirmation"}`.
  - `confirmedCount` counts every rider holding a place, the admin included (riders who must reconfirm keep their place); `placesLeft = participantLimit - confirmedCount` (null while there is no limit). `admin` is null after the admin deleted their account. `distanceIsPlanned` is true when the ride has no route copy (then `targetDistanceKm` is the planned distance).
  - Admin and participants (`viewerRole` `ADMIN` or `PARTICIPANT`, including riders who must reconfirm): exact `meetingPoint` and `routeGeometry`, `meetingArea` null. Everyone else (`NONE`): `meetingPoint` and `routeGeometry` null and `meetingArea` set. The area's centre is 100 to 350 m from the real point (uniform over that ring) in a random direction; distance and direction are chosen once when the ride is created and stored, so repeated requests return the same circle and it moves with the meeting point. Exact coordinates are never in the response for these viewers.
- Age rating: the server sets `16+` when the ride has a route copy that lies entirely inside one city boundary (PostGIS `ST_Within` against `city_boundaries`), otherwise `18+`, and recalculates it on every route change. Creating an 18+ ride, publishing it, or changing the route so it becomes 18+ needs the admin's 18+ confirmation: 403 `urn:cycling:problem:adult-confirmation-required`. A route change that turns a 16+ ride into 18+ while any other rider holding a place has no 18+ confirmation: 409 `urn:cycling:problem:age-rating-change-blocked`.
- **City definition:** an OpenStreetMap administrative boundary relation that is tagged `place=city`, or whose `label` member node is `place=city`, or whose `admin_centre` member node is `place=city` and has the same name as the relation. The admin-centre rule is needed for Luxembourg City (the city node is only the admin centre of the commune, the canton and the country; the name check excludes the canton and the country). Limits: it depends on OSM tagging (`place=city` roughly means 100,000+ inhabitants, varying by country, so most towns are 18+); the boundary is the whole municipality including its rural edges; a route through two neighbouring cities is 18+; boundaries are loaded by an operator script (`backend/geo/README.md`) and existing ratings are only recalculated when a route changes.
- **Time zone:** the app sends the meeting point's IANA zone; the server checks it is a valid zone id but does not derive it from the coordinates.
- **Participants:** a minimal `ride_participants` table (`CONFIRMED` or `NEEDS_RECONFIRMATION`); the creator is added as confirmed. Joining, approval and invitations come with the peloton spec; until invitations exist, invite-only rides are visible only to the admin and participants.
- **Account deletion:** upcoming published rides the rider administers are cancelled without a message, their drafts are deleted, their past and cancelled rides keep no admin, and their participation is removed. Notifications follow with the notifications spec.
- **Retention:** a job every 6 hours deletes rides (with their participants and route copy) 12 months after the start, and drafts without a start 12 months after their last change. Deleting is the simplest complete anonymisation; nothing needs old rides yet.
- Logs never contain coordinates or ride details.

## Open questions
- **Description for non-participants:** the description is shown to everyone who can see the ride, but the spec's list of what non-participants see does not mention it. Admins could write the exact meeting address there. Hide it from non-participants, or show a hint in the app? *(BA)*
