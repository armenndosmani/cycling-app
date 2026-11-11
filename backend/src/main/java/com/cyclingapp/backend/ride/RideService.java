package com.cyclingapp.backend.ride;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import com.cyclingapp.backend.account.AccountDeletionHook;
import com.cyclingapp.backend.geo.Discipline;
import com.cyclingapp.backend.geo.GeoPoint;
import com.cyclingapp.backend.geo.RouteResult.LineString;
import com.cyclingapp.backend.geo.RouteResult.SurfaceShare;
import com.cyclingapp.backend.ride.RideRepository.Details;
import com.cyclingapp.backend.ride.RideRepository.RideRow;
import com.cyclingapp.backend.ride.RideRepository.RouteCopy;
import com.cyclingapp.backend.route.SavedRouteService;
import com.cyclingapp.backend.route.SavedRouteService.SavedRoute;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/**
 * Ride events (docs/specs/ride-event-creation.md). The creator is the admin and the first
 * participant. All visibility rules are applied here, on the server: drafts are visible
 * only to their admin, invite-only rides only to their participants, and the exact
 * meeting point and route line only to the admin and participants. Everyone else gets a
 * meeting area whose centre is offset from the real point by a random distance and
 * bearing chosen once per ride.
 */
@Service
public class RideService implements AccountDeletionHook {

	static final String RATING_16 = "16+";

	static final String RATING_18 = "18+";

	static final String CONFIRMED = "CONFIRMED";

	static final String NEEDS_RECONFIRMATION = "NEEDS_RECONFIRMATION";

	/** Radius of the public meeting area. */
	static final int MEETING_AREA_RADIUS_METERS = 500;

	/**
	 * The area's centre is 100 to 350 m from the real point: never on it, and the real
	 * point always lies well inside the 500 m circle.
	 */
	static final double MIN_AREA_OFFSET_METERS = 100;

	static final double MAX_AREA_OFFSET_METERS = 350;

	static final Duration MIN_LEAD_TIME = Duration.ofMinutes(30);

	static final Duration RECONFIRMATION_THRESHOLD = Duration.ofHours(1);

	private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm");

	private static final TypeReference<List<double[]>> PROFILE = new TypeReference<>() {
	};

	private static final TypeReference<List<SurfaceShare>> SURFACES = new TypeReference<>() {
	};

	private final RideRepository rides;

	private final SavedRouteService savedRoutes;

	private final JsonMapper json;

	private final SecureRandom random = new SecureRandom();

	RideService(RideRepository rides, SavedRouteService savedRoutes, JsonMapper json) {
		this.rides = rides;
		this.savedRoutes = savedRoutes;
		this.json = json;
	}

	/**
	 * Creates a draft. A saved route is copied into the ride.
	 * @throws com.cyclingapp.backend.route.SavedRouteNotFoundException if the route is
	 * not the rider's
	 */
	@Transactional
	public Ride create(UUID userId, RideInput input) {
		checkTimeZone(input.timeZone());
		Instant now = now();
		RouteCopy route = null;
		Discipline routeDiscipline = null;
		if (input.routeId() != null) {
			SavedRoute saved = savedRoutes.get(userId, input.routeId());
			route = copyOf(saved);
			routeDiscipline = saved.discipline();
		}
		String ageRating = ageRating(route);
		if (RATING_18.equals(ageRating) && !rides.isAdult(userId)) {
			throw RideException.adultConfirmationRequired();
		}
		Details details = details(input, route, routeDiscipline, ageRating);
		UUID id = UUID.randomUUID();
		// Uniform over the ring between the minimum and maximum offset
		double offset = Math.sqrt(random.nextDouble()
				* (MAX_AREA_OFFSET_METERS * MAX_AREA_OFFSET_METERS - MIN_AREA_OFFSET_METERS * MIN_AREA_OFFSET_METERS)
				+ MIN_AREA_OFFSET_METERS * MIN_AREA_OFFSET_METERS);
		double bearing = random.nextDouble() * 360;
		rides.insert(id, userId, details, route, offset, bearing, now);
		rides.addParticipant(id, userId, CONFIRMED, now);
		return get(userId, id);
	}

	/**
	 * Replaces the ride's details. A {@code routeId} attaches or replaces the route copy,
	 * {@code removeRoute} (an explicit null routeId) removes it, otherwise it is kept.
	 */
	@Transactional
	public Ride update(UUID userId, UUID id, RideInput input) {
		RideRow ride = rideAsAdmin(userId, id);
		Instant now = now();
		requireChangeable(ride, now);
		checkTimeZone(input.timeZone());

		boolean routeChanged;
		RouteCopy route;
		Discipline routeDiscipline = null;
		if (input.routeId() != null) {
			SavedRoute saved = savedRoutes.get(userId, input.routeId());
			route = copyOf(saved);
			routeDiscipline = saved.discipline();
			routeChanged = true;
		}
		else if (input.removeRoute() && ride.route() != null) {
			route = null;
			routeChanged = true;
		}
		else {
			route = ride.route();
			routeChanged = false;
		}
		String oldRating = ride.details().ageRating();
		String ageRating = routeChanged ? ageRating(route) : oldRating;
		Details details = details(input, route, routeDiscipline, ageRating);
		boolean published = "PUBLISHED".equals(ride.status());
		Instant oldStart = ride.details().startsAt();
		boolean startChanged = !Objects.equals(oldStart, details.startsAt());

		if (published) {
			validateForPublishing(details, route != null, startChanged, now);
		}
		if (details.participantLimit() != null && details.participantLimit() < ride.placesTaken()) {
			throw RideException.limitBelowParticipants();
		}
		if (routeChanged && RATING_18.equals(ageRating)) {
			if (!rides.isAdult(userId)) {
				throw RideException.adultConfirmationRequired();
			}
			if (RATING_16.equals(oldRating) && rides.hasParticipantWithoutAdultConfirmation(id, userId)) {
				throw RideException.ageRatingChangeBlocked();
			}
		}

		rides.updateDetails(id, details, now);
		if (routeChanged) {
			rides.updateRoute(id, route);
		}
		// TODO(notifications spec): notify confirmed participants of every change
		if (published && startChanged
				&& Duration.between(oldStart, details.startsAt()).abs().compareTo(RECONFIRMATION_THRESHOLD) > 0) {
			rides.requireReconfirmation(id, userId);
		}
		return get(userId, id);
	}

	/** Runs the full validation and makes the ride visible. */
	@Transactional
	public Ride publish(UUID userId, UUID id) {
		RideRow ride = rideAsAdmin(userId, id);
		if (!"DRAFT".equals(ride.status())) {
			throw RideException.notDraft();
		}
		Instant now = now();
		validateForPublishing(ride.details(), ride.route() != null, true, now);
		if (RATING_18.equals(ride.details().ageRating()) && !rides.isAdult(userId)) {
			throw RideException.adultConfirmationRequired();
		}
		rides.publish(id, now);
		return get(userId, id);
	}

	@Transactional
	public Ride cancel(UUID userId, UUID id, String message) {
		RideRow ride = rideAsAdmin(userId, id);
		if ("DRAFT".equals(ride.status())) {
			throw RideException.notPublished();
		}
		requireChangeable(ride, now());
		rides.cancel(id, message, now());
		// TODO(notifications spec): notify participants of the cancellation
		return get(userId, id);
	}

	/** Makes another confirmed participant the admin; the previous admin stays. */
	@Transactional
	public Ride handOver(UUID userId, UUID id, UUID newAdminId) {
		RideRow ride = rideAsAdmin(userId, id);
		requireChangeable(ride, now());
		if (newAdminId.equals(userId) || !CONFIRMED.equals(rides.participantStatus(id, newAdminId).orElse(null))) {
			throw RideException.handoverTargetInvalid();
		}
		rides.setAdmin(id, newAdminId, now());
		// TODO(notifications spec): notify the new admin and the participants
		return get(userId, id);
	}

	/** Deletes a draft; published rides are cancelled instead. */
	@Transactional
	public void delete(UUID userId, UUID id) {
		RideRow ride = rideAsAdmin(userId, id);
		if (!"DRAFT".equals(ride.status())) {
			throw RideException.notDraft();
		}
		rides.delete(id);
	}

	/**
	 * @throws RideException 404 if the ride does not exist or the rider may not see it
	 */
	@Transactional(readOnly = true)
	public Ride get(UUID userId, UUID id) {
		RideRow ride = rides.find(id, userId).orElseThrow(RideException::notFound);
		ViewerRole role = role(ride, userId);
		if (!visible(ride, role)) {
			throw RideException.notFound();
		}
		return toRide(ride, role, now());
	}

	/**
	 * Upcoming rides first (soonest first, drafts without a date last), then past ones.
	 */
	@Transactional(readOnly = true)
	public List<RideSummary> mine(UUID userId) {
		Instant now = now();
		Comparator<RideSummary> upcoming = Comparator.comparing(RideSummary::startsAt,
				Comparator.nullsLast(Comparator.naturalOrder()));
		Comparator<RideSummary> past = Comparator.comparing(RideSummary::startsAt, Comparator.reverseOrder());
		return rides.findMine(userId).stream().map(ride -> toSummary(ride, role(ride, userId), now)).sorted((a, b) -> {
			if (a.past() != b.past()) {
				return a.past() ? 1 : -1;
			}
			int order = a.past() ? past.compare(a, b) : upcoming.compare(a, b);
			return (order != 0) ? order : a.id().compareTo(b.id());
		}).toList();
	}

	/**
	 * Upcoming rides the rider administers are cancelled, their drafts deleted, their
	 * participation removed and their past rides kept without an admin.
	 */
	@Override
	public void deleteAccountData(UUID userId) {
		Instant now = now();
		rides.deleteDraftsOf(userId);
		rides.cancelUpcomingOf(userId, now);
		// TODO(notifications spec): notify the participants of the rides cancelled above
		rides.removeAdmin(userId);
		rides.deleteParticipationOf(userId);
	}

	private RideRow rideAsAdmin(UUID userId, UUID id) {
		if (!rides.lock(id)) {
			throw RideException.notFound();
		}
		RideRow ride = rides.find(id, userId).orElseThrow(RideException::notFound);
		ViewerRole role = role(ride, userId);
		if (role != ViewerRole.ADMIN) {
			throw visible(ride, role) ? RideException.notRideAdmin() : RideException.notFound();
		}
		return ride;
	}

	/** Cancelled rides and published rides that have started cannot be changed. */
	private static void requireChangeable(RideRow ride, Instant now) {
		if ("CANCELLED".equals(ride.status())) {
			throw RideException.cancelled();
		}
		if ("PUBLISHED".equals(ride.status()) && hasStarted(ride.details().startsAt(), now)) {
			throw RideException.started();
		}
	}

	private static ViewerRole role(RideRow ride, UUID userId) {
		if (userId.equals(ride.adminId())) {
			return ViewerRole.ADMIN;
		}
		return (ride.viewerStatus() != null) ? ViewerRole.PARTICIPANT : ViewerRole.NONE;
	}

	private static boolean visible(RideRow ride, ViewerRole role) {
		if (role == ViewerRole.ADMIN) {
			return true;
		}
		if ("DRAFT".equals(ride.status())) {
			return false;
		}
		return role == ViewerRole.PARTICIPANT || !"INVITE_ONLY".equals(ride.details().accessMode());
	}

	private String ageRating(RouteCopy route) {
		return (route != null && rides.isInsideOneCity(route.geometryJson())) ? RATING_16 : RATING_18;
	}

	private RouteCopy copyOf(SavedRoute route) {
		return new RouteCopy(json.writeValueAsString(route.geometry()), route.distanceMeters(), route.ascendMeters(),
				(route.elevationProfile() != null) ? json.writeValueAsString(route.elevationProfile()) : null,
				json.writeValueAsString(route.surfaces()));
	}

	/**
	 * The stored fields for the input. The meeting point defaults to the route's start,
	 * the discipline to the discipline of a route attached now; a target distance is kept
	 * only without a route.
	 */
	private Details details(RideInput input, RouteCopy route, Discipline routeDiscipline, String ageRating) {
		GeoPoint meetingPoint = input.meetingPoint();
		if (meetingPoint == null && route != null) {
			double[] start = json.readValue(route.geometryJson(), LineString.class).coordinates().getFirst();
			meetingPoint = new GeoPoint(start[1], start[0]);
		}
		Discipline discipline = (input.discipline() != null) ? input.discipline() : routeDiscipline;
		Instant startsAt = (input.startDate() != null && input.startTime() != null && input.timeZone() != null)
				? input.startDate().atTime(input.startTime()).atZone(ZoneId.of(input.timeZone())).toInstant() : null;
		return new Details(input.name(), input.description(), input.startDate(), input.startTime(), input.timeZone(),
				startsAt, (meetingPoint != null) ? meetingPoint.lat() : null,
				(meetingPoint != null) ? meetingPoint.lon() : null, (discipline != null) ? discipline.name() : null,
				(input.pace() != null) ? input.pace().name() : null, input.participantLimit(),
				(input.accessMode() != null) ? input.accessMode().name() : null,
				(route == null) ? input.targetDistanceKm() : null, ageRating);
	}

	/** Drafts may have any field missing; a published ride needs all of them. */
	private static void validateForPublishing(Details ride, boolean hasRoute, boolean checkLeadTime, Instant now) {
		Map<String, String> errors = new LinkedHashMap<>();
		if (ride.name() == null || ride.name().isBlank() || ride.name().length() < 3 || ride.name().length() > 80) {
			errors.put("name", "must be between 3 and 80 characters");
		}
		if (ride.description() != null && ride.description().length() > 2000) {
			errors.put("description", "must be at most 2000 characters");
		}
		requireValue(errors, "startDate", ride.startDate());
		requireValue(errors, "startTime", ride.startTime());
		requireValue(errors, "timeZone", ride.timeZone());
		if (checkLeadTime && ride.startsAt() != null && ride.startsAt().isBefore(now.plus(MIN_LEAD_TIME))) {
			errors.put("startTime", "must be at least 30 minutes in the future");
		}
		requireValue(errors, "meetingPoint", ride.meetingLat());
		requireValue(errors, "discipline", ride.discipline());
		requireValue(errors, "pace", ride.pace());
		if (ride.participantLimit() == null || ride.participantLimit() < 2 || ride.participantLimit() > 50) {
			errors.put("participantLimit", "must be between 2 and 50");
		}
		requireValue(errors, "accessMode", ride.accessMode());
		if (!hasRoute
				&& (ride.targetDistanceKm() == null || ride.targetDistanceKm() < 1 || ride.targetDistanceKm() > 500)) {
			errors.put("targetDistanceKm", "must be between 1 and 500 when the ride has no route");
		}
		if (!errors.isEmpty()) {
			throw RideException.invalid(errors.entrySet()
				.stream()
				.map(error -> Map.of("field", error.getKey(), "message", error.getValue()))
				.toList());
		}
	}

	private static void requireValue(Map<String, String> errors, String field, Object value) {
		if (value == null) {
			errors.put(field, "must not be empty");
		}
	}

	private static void checkTimeZone(String timeZone) {
		if (timeZone != null && !ZoneId.getAvailableZoneIds().contains(timeZone)) {
			throw RideException.invalid(List
				.of(Map.of("field", "timeZone", "message", "must be an IANA time zone such as Europe/Luxembourg")));
		}
	}

	private Ride toRide(RideRow ride, ViewerRole role, Instant now) {
		Details details = ride.details();
		RouteCopy route = ride.route();
		// Only the admin and participants get exact coordinates; never serialise them
		// for anyone else
		boolean exact = role != ViewerRole.NONE;
		GeoPoint meetingPoint = (exact && details.meetingLat() != null)
				? new GeoPoint(details.meetingLat(), details.meetingLon()) : null;
		MeetingArea meetingArea = (!exact && ride.areaLat() != null)
				? new MeetingArea(ride.areaLat(), ride.areaLon(), MEETING_AREA_RADIUS_METERS) : null;
		LineString routeGeometry = (exact && route != null) ? json.readValue(route.geometryJson(), LineString.class)
				: null;
		Integer placesLeft = (details.participantLimit() != null)
				? Math.max(0, details.participantLimit() - ride.placesTaken()) : null;
		return new Ride(ride.id(), RideStatus.valueOf(ride.status()), hasStarted(details.startsAt(), now),
				details.name(), details.description(), details.startDate(), format(details.startTime()),
				details.timeZone(), details.startsAt(), enumOrNull(Discipline.class, details.discipline()),
				enumOrNull(Pace.class, details.pace()), details.participantLimit(), ride.placesTaken(), placesLeft,
				enumOrNull(AccessMode.class, details.accessMode()), details.ageRating(),
				(ride.adminId() != null) ? new Admin(ride.adminId(), ride.adminDisplayName()) : null, role,
				(route != null) ? route.distanceMeters() : null, (route != null) ? route.ascendMeters() : null,
				(route != null && route.elevationProfileJson() != null)
						? json.readValue(route.elevationProfileJson(), PROFILE) : null,
				(route != null) ? json.readValue(route.surfacesJson(), SURFACES) : null, route == null,
				details.targetDistanceKm(), meetingPoint, meetingArea, routeGeometry, ride.cancelMessage(),
				NEEDS_RECONFIRMATION.equals(ride.viewerStatus()));
	}

	private static RideSummary toSummary(RideRow ride, ViewerRole role, Instant now) {
		Details details = ride.details();
		return new RideSummary(ride.id(), RideStatus.valueOf(ride.status()), hasStarted(details.startsAt(), now),
				details.name(), details.startsAt(), details.startDate(), format(details.startTime()),
				details.timeZone(), enumOrNull(Discipline.class, details.discipline()), details.ageRating(),
				(ride.route() != null) ? ride.route().distanceMeters() : null, ride.route() == null,
				details.targetDistanceKm(), ride.placesTaken(), details.participantLimit(), role);
	}

	private static boolean hasStarted(Instant startsAt, Instant now) {
		return startsAt != null && !startsAt.isAfter(now);
	}

	private static String format(LocalTime time) {
		return (time != null) ? time.format(TIME) : null;
	}

	private static <E extends Enum<E>> E enumOrNull(Class<E> type, String value) {
		return (value != null) ? Enum.valueOf(type, value) : null;
	}

	/** Microseconds, like the database stores them. */
	private static Instant now() {
		return Instant.now().truncatedTo(ChronoUnit.MICROS);
	}

	public enum RideStatus {

		DRAFT, PUBLISHED, CANCELLED

	}

	public enum Pace {

		RELAXED, STEADY, FAST, MIXED

	}

	public enum AccessMode {

		OPEN, APPROVAL, INVITE_ONLY

	}

	public enum ViewerRole {

		ADMIN, PARTICIPANT, NONE

	}

	/**
	 * What the admin sends; every field may be missing while the ride is a draft.
	 *
	 * @param routeId a saved route to copy into the ride, null for none or to keep the
	 * current copy
	 * @param removeRoute remove the current route copy (only for updates)
	 */
	public record RideInput(String name, String description, LocalDate startDate, LocalTime startTime, String timeZone,
			GeoPoint meetingPoint, Discipline discipline, Pace pace, Integer participantLimit, AccessMode accessMode,
			UUID routeId, boolean removeRoute, Double targetDistanceKm) {

	}

	/**
	 * A ride as one viewer may see it.
	 *
	 * @param confirmedCount participants holding a place, the admin included (riders who
	 * must reconfirm a moved start keep their place and are counted)
	 * @param placesLeft {@code participantLimit - confirmedCount}, null without a limit
	 * @param admin null once the admin deleted their account
	 * @param meetingPoint exact, only for the admin and participants
	 * @param meetingArea only for everyone else: a circle that contains the meeting
	 * point, fixed per ride
	 * @param routeGeometry only for the admin and participants
	 */
	public record Ride(UUID id, RideStatus status, boolean past, String name, String description, LocalDate startDate,
			String startTime, String timeZone, Instant startsAt, Discipline discipline, Pace pace,
			Integer participantLimit, int confirmedCount, Integer placesLeft, AccessMode accessMode, String ageRating,
			Admin admin, ViewerRole viewerRole, Double distanceMeters, Double ascendMeters,
			List<double[]> elevationProfile, List<SurfaceShare> surfaces, boolean distanceIsPlanned,
			Double targetDistanceKm, GeoPoint meetingPoint, MeetingArea meetingArea, LineString routeGeometry,
			String cancelMessage, boolean needsReconfirmation) {

	}

	public record Admin(UUID id, String displayName) {

	}

	public record MeetingArea(double lat, double lon, int radiusMeters) {

	}

	public record RideSummary(UUID id, RideStatus status, boolean past, String name, Instant startsAt,
			LocalDate startDate, String startTime, String timeZone, Discipline discipline, String ageRating,
			Double distanceMeters, boolean distanceIsPlanned, Double targetDistanceKm, int confirmedCount,
			Integer participantLimit, ViewerRole viewerRole) {

	}

}
