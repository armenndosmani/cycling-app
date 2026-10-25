# Cycling Community App — Project Context

## 1. Project summary

Working concept: a privacy-first cycling community app available on mobile and in the browser.

The product helps cyclists plan routes, organize group rides, discover local cycling communities, and form a ride-specific group (“peloton”). It is not primarily a performance tracker or leaderboard app.

**Core product loop:** Plan a route → create a ride event → invite or discover riders → approve participants when required → coordinate in a ride-specific chat → ride together.

The app should support:
- Road cycling
- Gravel cycling
- Mountain biking (MTB)
- Urban cycling

The working product identity and name are not finalized.

## 2. Product direction

- **Audience:** All cyclists, including MTB and urban riders.
- **Visual style:** Premium, minimalist, dark interface with subtle green accents.
- **Discovery:** Local rides and nearby communities, with location chosen by the user wherever possible.
- **First feature priority:** Route planner and event creation.
- **Platforms:** Mobile app and responsive browser app.
- **Product values:** Simplicity, good visual design, community, privacy by design, and GDPR-aware implementation.

Working tagline idea: “Ride together. Ride your way.” This is a concept, not a final brand decision.

## 3. Core product areas

### A. Rider profile
Keep profiles basic:
- Avatar
- Display name
- Nickname/handle
- Bicycle type or types
- Optional short bio

Strava integration may be offered later, but must not be required to use the app.

### B. Community and discovery
Riders should be able to:
- Select or search a city/area to discover rides
- Browse upcoming public rides and local communities
- Filter rides by discipline, date, distance, pace, and available places
- Follow other riders
- Invite friends
- Join clubs or persistent cycling communities

Following a rider must not automatically join them to a ride.

### C. Route planner
The route planner is the first development priority. It should allow users to:
- Select a starting point and destination
- Add waypoints and shape a route on an interactive map
- Choose a cycling discipline: road, gravel, MTB, or urban
- View estimated distance and elevation gain/profile where supported
- Save route drafts privately
- Use a saved or newly created route to create an event

Routing should respect the selected cycling discipline where map/routing data supports it. Map tiles, routing APIs, licensing, regional coverage, and operating costs must be assessed before choosing providers.

### D. Ride event creation
A route can be turned into an event with:
- Ride name
- Optional description
- Date and start time
- Meeting point
- Cycling discipline
- Distance and elevation information from the route
- Expected pace (suggested options: Relaxed, Steady, Fast, Mixed/regroup)
- Participant limit
- Access policy

Suggested access modes:
1. **Open:** riders can join, subject to capacity and any configured rules.
2. **Approval required:** riders request to join; an admin accepts or rejects them.
3. **Invite only:** only invited riders can participate.

The distance entered before a route is created should be treated as a target, not as a calculated route result.

### E. Peloton / ride participants
A “peloton” is the group of participants for a specific ride event, not necessarily a separate permanent club.

- The ride creator is the initial ride admin.
- The admin can approve/reject join requests when applicable.
- The admin can remove participants, moderate the ride chat, update details, and cancel the event.
- Show confirmed riders and remaining capacity.
- Invitations and join requests need clear statuses.
- Define what happens if the admin leaves or transfers ownership.

### F. Ride-specific chat
- Only approved participants and authorized admins can access the chat.
- Keep route and event details accessible from the ride.
- Support relevant event updates and cancellation notices.
- Establish moderation, abuse-reporting, retention, and deletion rules before launch.

## 4. Privacy and GDPR principles

Privacy is a product principle, not a marketing claim. The goal is to collect as little personal data as practical while still operating a secure and useful service.

Principles:
- Do not require Strava.
- No background GPS tracking by default.
- Prefer user-selected locations or a deliberate, one-time “find rides near me” action.
- Do not sell personal data or use advertising trackers.
- Avoid unnecessary analytics and third-party SDKs.
- Make optional profile information genuinely optional.
- Keep private rides and invitations out of public discovery.
- Allow route drafts to remain private until explicitly published.
- Consider hiding/generalizing route start and end points because routes can reveal home or work locations.
- Restrict chats and participant details according to ride membership and permissions.
- Implement appropriate account deletion and data access/correction/export workflows.
- Define retention periods for messages, logs, uploaded images, and backups.
- Protect sessions, enforce server-side authorization, and guard against scraping and abuse.
- Document hosting providers and data processors and assess international transfers where relevant.

**Important legal qualification:** Minimizing data does not mean GDPR does not apply. Account details, handles, avatars, messages, and identifiable route information may be personal data. GDPR and other applicable obligations need legal assessment, including lawful basis, privacy notices, processor agreements, retention, and user rights. Do not claim the app is “GDPR exempt.”

## 5. Proposed technical direction (not finalized)

Potential architecture to evaluate:
- **Mobile:** React Native with Expo
- **Browser:** React responsive web app
- **Backend/data:** PostgreSQL, potentially through Supabase or a comparable managed backend
- **Maps:** MapLibre plus a suitable tile provider
- **Routing:** Cycling-aware routing provider/service
- **Realtime chat:** managed realtime service or a self-hosted option

Mobile and browser clients should use the same backend identity model, event data, and authorization rules.

This is a proposal only. Compare costs, vendor lock-in, security, privacy, map/routing coverage, maintenance burden, and deployment options before deciding. Do not assume a specific provider has already been selected.

## 6. MVP scope

Initial release should focus on:
1. Basic account and rider profile
2. Interactive route planning
3. Saving route drafts
4. Creating and publishing ride events
5. Local ride discovery and filtering
6. Following and invitations
7. Join requests and admin approval
8. Ride participant list and capacity
9. Private ride-specific chat
10. Privacy controls, account deletion, and basic moderation
11. Responsive browser experience and mobile experience

Likely defer until later:
- Strava integration
- Live location sharing or background GPS
- Performance analytics and leaderboards
- Advanced social feed
- Complex training metrics

## 7. Design direction

- Dark charcoal/near-black surfaces
- Subtle forest or cycling green accents
- Soft white typography and restrained contrast
- Premium, calm, uncluttered layouts
- Strong map visibility and clear route information
- Compact event cards with date, discipline, distance, pace, and availability
- Avoid excessive whitespace, noisy gamification, and data-heavy dashboards
- Make key actions easy: Plan route, Create ride, Request to join, Invite riders

Any mockups created so far are conceptual only, not a functioning app.

## 8. Important product rules to resolve during planning

Discuss and document:
- Whether clubs/groups are in the MVP or rides can exist independently
- Whether public rides expose exact routes before approval
- What “open” means when capacity is reached
- Whether users can join after a ride has started
- Whether chat opens immediately after approval or only closer to departure
- Cancellation, rescheduling, no-show, and admin-transfer behavior
- Blocking, reporting, and moderation
- Notification channels and user controls
- Route editing after an event is published
- Account recovery and abuse prevention with minimal personal data
- Age requirements and safety expectations
- Accessibility and language/localization requirements
- Pricing and ongoing costs for maps, routing, chat, and hosting

## 9. Current status

This is an early product concept and planning stage. No final brand name, architecture, map provider, routing provider, or launch geography has been confirmed. The first planned deliverable is a detailed route-planner and event-creation specification, potentially preceded by a clickable prototype.

When discussing this project in a new chat:
- Treat this file as the current baseline, not as a finalized specification.
- Separate confirmed product decisions from suggestions and open questions.
- Prefer simple, buildable MVP choices.
- Keep privacy, security, and GDPR considerations central.
- Do not add features unless they strengthen the core loop or solve a clear user need.
