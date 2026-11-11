# Route planner

**Requested by:** Product baseline (`docs/product-context.md` sections 3C and 9) · **Date:** 2026-11-11 · **Status:** Decisions made, waiting for "go"

## Goal
Let a rider plan a cycling route on a map for their discipline (road, gravel, MTB, urban), see how long and how hilly it is, and save it privately so it can become a group ride. This is the first step of the core loop and the first development priority.

## User stories
- As a rider, I want to set a start and a destination on the map so that the app calculates a cycling route between them.
- As a rider, I want to add, move and remove waypoints so that I can shape the route the way I want to ride it.
- As a rider, I want to choose road, gravel, MTB or urban so that the route suits my bike and the surfaces I want.
- As a rider, I want to see distance, elevation gain and an elevation profile so that I know how hard the route is before I share it.
- As a rider, I want to search for a place by name so that I don't have to find it by scrolling the map.
- As a rider, I want to save the route as a private draft and come back to it later so that I can plan without publishing anything.
- As a ride admin, I want to pick one of my saved routes when creating a ride so that riders see what we will ride (see `ride-event-creation.md`).

## Acceptance criteria

**Map and location**
- [ ] The planner opens on a map. The starting view is an area the rider picked earlier, or a default area if they never picked one.
- [ ] A "Use my location" button centres the map once on the rider's current position. The app asks for location permission only when the rider taps it, and only for while the app is in use.
- [ ] The app never tracks location in the background and does not store the rider's current position on the server.
- [ ] The map shows the attribution its data licence requires (e.g. "© OpenStreetMap contributors").

**Building a route**
- [ ] The rider sets a start and a destination by tapping the map or by searching for a place. The destination may be the same point as the start (a loop).
- [ ] Every segment follows mapped roads and paths; straight off-road segments are not possible.
- [ ] Once start and destination are set, the app calculates and draws the route without an extra tap.
- [ ] The rider can add a waypoint between existing points, drag any point to move it, and delete any waypoint. The route recalculates after each change.
- [ ] Waypoints can be reordered.
- [ ] The rider can undo the last change to the route at least 10 times.
- [ ] A route has at most 25 waypoints plus start and destination (proposed limit, see open questions). Adding more shows a clear message.
- [ ] While a route is calculating, the previous route stays visible and a loading state is shown. Rapid edits do not leave an outdated route on screen.
- [ ] If no route can be found for the chosen discipline (e.g. a point is unreachable), the app says so in plain words and keeps the rider's points.
- [ ] If the routing service is unreachable, the app shows an error with a retry option and nothing is lost.

**Discipline**
- [ ] The rider chooses one discipline per route: road, gravel, MTB or urban. Default: the first bicycle type in the rider's profile, otherwise road.
- [ ] Changing the discipline recalculates the route with that discipline's routing preferences.
- [ ] The route's discipline is saved with the route.

**Route information**
- [ ] The app shows total distance in kilometres with one decimal (e.g. 42.3 km).
- [ ] The app shows total elevation gain in metres, rounded to the nearest metre, where elevation data exists for the area.
- [ ] The app shows an elevation profile along the route. Touching the profile marks the matching point on the map.
- [ ] Where elevation data is missing, the app says "Elevation not available" instead of showing 0.
- [ ] The app shows a surface breakdown as percentages of the route (e.g. asphalt, gravel, unpaved, unknown), based on the map data.

**Saving**
- [ ] The rider can save the route with a name (1 to 80 characters, required) and an optional note (up to 1,000 characters).
- [ ] A saved route stores: points, the calculated geometry, discipline, distance, elevation gain, elevation profile, name, note, created and updated time. Viewing a saved route later does not recalculate it.
- [ ] Every saved route is a private draft. Only its owner can see, edit or delete it. This is enforced by the backend: another user requesting it by id gets "not found".
- [ ] Drafts never appear in discovery, search, other riders' profiles or any public endpoint.
- [ ] The rider sees a list of their saved routes, newest first, with name, discipline, distance and elevation gain.
- [ ] The rider can open, edit, rename and delete a saved route. Deleting asks for confirmation and removes the route from the server.
- [ ] A ride event stores its own copy of the route. Editing or deleting the saved route does not change any ride that already uses it.
- [ ] Unsaved changes are not lost when the app goes to the background.

**Quality**
- [ ] The planner works on iOS and Android, on phones from about 5.5 to 7 inches, in portrait.
- [ ] Buttons and map controls have accessible labels for screen readers; text meets contrast requirements on the dark theme.
- [ ] Route calculation for a route up to 200 km returns within 3 seconds in 95% of requests on the launch infrastructure (proposed target).

## Privacy notes
- **Personal data involved:** saved routes linked to an account, their names and notes, and search terms entered in place search. Start and end points can reveal where a rider lives or works.
- **Who can see it:** only the route's owner. A route becomes visible to others only through a published ride event, under that event's rules (see `ride-event-creation.md`).
- **Location:** only on an explicit "Use my location" tap, while the app is in use, never stored on the server.
- **Third parties:** route calculation, place search and map tiles each send coordinates or search terms to whatever serves them. All three are self-hosted on our own EU server (decided), so riders' planned routes and searches never reach an outside company.
- **Logs:** no coordinates, route geometry or search terms in application logs.
- **Retention:** a saved route is kept until the owner deletes it or deletes their account. Deleted routes are removed from the database immediately and from backups when they expire, within 30 days.
- **Data export:** saved routes must be included in the rider's personal data export (separate feature).
- **Legal review:** OpenStreetMap's licence (ODbL) may apply to a large stored database of routes derived from OSM. Map attribution requirements. No claim that any of this is "GDPR exempt".

## Out of scope
- Turn-by-turn navigation and recording a ride
- Offline maps
- Importing GPX/FIT files, and exporting routes to files or devices (separate specs)
- Sharing a route on its own, outside a ride event
- Round-trip suggestions ("give me a 50 km loop")
- Own trails layer and club routes
- 3D terrain
- Imperial units

## Decisions (2026-11-11, see `docs/decisions.md`)
- **Map tiles:** self-hosted OpenStreetMap vector tiles (Protomaps basemap + Martin) on our own server; MapTiler as fallback.
- **Routing engine:** self-hosted GraphHopper, one profile per discipline (road, gravel, MTB, urban).
- **Place search:** self-hosted Photon.
- **Storage:** PostGIS for route geometry.
- **Launch region:** decided before release. Development and the proof of concept use a small OpenStreetMap extract.
- **Loops:** allowed. The destination may be the same point as the start.
- **Off-road segments:** not in the MVP. Every segment follows the map.
- **Surface breakdown:** in the first version.
- **Units:** kilometres and metres only.
- **Routes used by events:** a ride keeps its own copy of the route. Editing or deleting the saved route never changes an existing ride.
- **Backups:** deleted data stays in backups for at most 30 days (legal review pending).

## Backend API (issue #38)
All endpoints need an access token. Errors are Problem Details.
- `POST /api/routing/route` `{"discipline": "ROAD|GRAVEL|MTB|URBAN", "points": [{"lat", "lon"}, ...]}` (2 to 27 points, destination may equal start) → `{"geometry": GeoJSON LineString with [lon, lat, ele], "distanceMeters", "ascendMeters" (null without elevation data), "elevationProfile": [[distanceMeters, elevationMeters], ...] (at most 300, null without elevation data), "surfaces": [{"surface", "meters"}, ...]}` (longest first; OSM surface values, "unknown" where not mapped). No route: 422 `urn:cycling:problem:route-not-found`. Routing down or slower than 5 s: 503 `urn:cycling:problem:routing-unavailable`.
- `GET /api/places?q=...&lat=&lon=` (q 2 to 100 characters; lat and lon optional, together) → `[{"name", "label", "lat", "lon"}]`, at most 10. Search down: 503 `urn:cycling:problem:place-search-unavailable`.
- `GET /api/routes` → own routes, most recently changed first: `[{"id", "name", "discipline", "distanceMeters", "ascendMeters", "updatedAt"}]`.
- `POST /api/routes` `{"name", "note", "discipline", "points"}` → 201 with the full route. `PUT /api/routes/{id}` same body → 200. `GET /api/routes/{id}` → `{"id", "name", "note", "discipline", "points", "geometry", "distanceMeters", "ascendMeters", "elevationProfile", "surfaces", "createdAt", "updatedAt"}`. `DELETE /api/routes/{id}` → 204. Another rider's route or an unknown id: 404.
- The server calculates the route when it is saved, and again on update only if the points or the discipline changed; calculated values sent by the app are ignored, so stored distances and geometry cannot be forged. Viewing never recalculates. Saving needs routing to be up (503 otherwise).

## Open questions
- **Limits:** 25 waypoints and the 3-second target for routes up to 200 km are proposals, to confirm after the proof of concept. *(developer)*
