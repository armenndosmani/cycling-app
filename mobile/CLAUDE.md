This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## API and sign-in

- `src/api/client.ts` `request()` for public endpoints; `session.authorized()` (`src/auth/session.ts`) for everything that needs sign-in. It adds the Bearer token and refreshes once on 401 (one shared refresh for concurrent requests).
- Errors are `ApiError` with parsed Problem Details; show them with `errorMessage()` (`src/api/errorMessage.ts`), never the backend's text.
- Tokens live only in `expo-secure-store` (`src/auth/tokenStorage.ts`). Never put them in AsyncStorage, files, route params or logs.
- `useAuth()` (`src/auth/AuthProvider.tsx`) gives the session state and profile. Routes are guarded with `Stack.Protected` in `src/app/_layout.tsx`: `(auth)` when signed out, `display-name` until the rider has one, `(app)` otherwise.
- Unit tests: `npm test` (Vitest in Node). Keep testable logic free of `react-native` imports; mock Expo modules with `vi.mock`.

## Maps and the route planner

- Map: `@maplibre/maplibre-react-native` (needs a development build, not Expo Go). The style is built in `src/map/mapStyle.ts` with `@protomaps/basemaps` (dark flavour); tiles, fonts and sprites come only from our tile server (`src/config/tiles.ts`, `EXPO_PUBLIC_TILES_URL`, default dev host port 3000). Martin path names live in `src/map/martin.ts`. Never add a style, font or sprite URL of a third party.
- API contract of routing, place search and saved routes: `src/api/routes.ts` (types and response parsing in one place).
- The planner draft (`src/planner/plannerStore.ts`) is kept in memory only and reset on sign-out, because route points can reveal where a rider lives. Never persist or log coordinates.
- Location: only `requestForegroundPermissionsAsync` on an explicit tap; background location is disabled in `app.json`.

## Ride events

- API contract (create, edit, publish, cancel, delete, my rides, details) and problem types: `src/api/rides.ts`. Plain-language messages per problem type: `src/rides/rideErrors.ts`.
- Dates and times are wall-clock values in the meeting point's IANA zone (`src/rides/dateTime.ts`, `Intl` only); the picker (`@react-native-community/datetimepicker`) only supplies the wall-clock fields.
- Show the exact meeting point and route only through `meetingDisplay` / `visibleRoute` (`src/rides/display.ts`): riders who have not joined see the generalised circle, never a point.
- `PUT /api/rides/{id}`: a `routeId` replaces the route copy; no `routeId` but a `targetDistanceKm` removes it; neither keeps it. Send `routeId` only when a route was attached in the form and `targetDistanceKm: null` while the ride has a copy (`toRideBody`).
- The ride form (`src/rides/rideFormStore.ts`) is in memory only and reset when the form closes and on sign-out, like the planner draft.

## Text and accessibility

Follow `docs/accessibility.md` (in `mobile/`) for every screen. In short:

- No user-facing string literals in components: all text, including accessibility labels and error messages, comes from `src/i18n/en.json` via `useTranslation()` (keys are type-checked).
- Every interactive element has a role and an accessible name; every input has an `accessibilityLabel`. Use `src/components/Button.tsx` for buttons.
- Touch targets at least 44 pt; never disable font scaling; theme colours only; never colour alone to carry meaning.

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
