package com.cyclingapp.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItems;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

import com.cyclingapp.backend.GeoStub.Reply;
import com.cyclingapp.backend.ride.RideRetention;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import tools.jackson.databind.json.JsonMapper;

/**
 * Ride events: drafts, publishing, route copies, age rating, visibility per viewer,
 * editing rules, handover, cancelling, deleting, "my rides", account deletion and
 * retention. Fake places only: a made-up city polygon around 45.0 N / 10.0 E.
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class RidesTests {

	private static final ZoneId ZONE = ZoneId.of("Europe/Luxembourg");

	/** A fake city: about 2.3 km by 2.2 km. */
	private static final String TEST_CITY = "MULTIPOLYGON(((9.99 44.99, 10.02 44.99, 10.02 45.01, 9.99 45.01, 9.99 44.99)))";

	/** Inside the test city, with distinctive coordinates for the raw JSON checks. */
	private static final String ROUTE_INSIDE = GeoStub.graphhopperRoute(1234.0, 12.0,
			"[[10.00111,45.00222,100.0],[10.00333,45.00444,110.0],[10.00555,45.00666,105.0]]", "[[0,2,\"asphalt\"]]");

	/** Leaves the test city to the east. */
	private static final String ROUTE_CROSSING = GeoStub.graphhopperRoute(4000.0, 30.0,
			"[[10.0,45.0,100.0],[10.03,45.0,110.0],[10.05,45.0,120.0]]", "[[0,2,\"gravel\"]]");

	private static final String POINTS = "[{\"lat\":45.0,\"lon\":10.0},{\"lat\":45.0,\"lon\":10.01}]";

	/** Exact meeting point used by the full ride body. */
	private static final double MEETING_LAT = 45.006789;

	private static final double MEETING_LON = 10.007654;

	@DynamicPropertySource
	static void geo(DynamicPropertyRegistry registry) {
		GeoStub.register(registry);
	}

	@Autowired
	private MockMvc mvc;

	@Autowired
	private CapturingMailSender mail;

	@Autowired
	private JdbcTemplate jdbc;

	@Autowired
	private JsonMapper json;

	@Autowired
	private RideRetention retention;

	private AuthTestClient client;

	@BeforeEach
	void setUp() {
		GeoStub.reset();
		client = new AuthTestClient(mvc, mail);
		jdbc.update("""
				insert into city_boundaries (name, osm_id, geom)
				values ('Testville', -1, ST_GeomFromText(?, 4326)) on conflict (osm_id) do nothing""", TEST_CITY);
	}

	// Creating and publishing

	@Test
	void draftIsCreatedWithOnlyANameAndPublishedOnceComplete() throws Exception {
		Rider admin = adult();
		String body = create(admin, Map.of("name", "  Fake morning ride  ")).andExpect(status().isCreated())
			.andExpect(header().string("Location", containsString("/api/rides/")))
			.andExpect(jsonPath("$.status").value("DRAFT"))
			.andExpect(jsonPath("$.name").value("Fake morning ride"))
			.andExpect(jsonPath("$.past").value(false))
			.andExpect(jsonPath("$.ageRating").value("18+"))
			.andExpect(jsonPath("$.viewerRole").value("ADMIN"))
			.andExpect(jsonPath("$.admin.id").value(admin.id()))
			.andExpect(jsonPath("$.admin.displayName").value("Fake Rider"))
			.andExpect(jsonPath("$.confirmedCount").value(1))
			.andExpect(jsonPath("$.placesLeft").value(nullValue()))
			.andExpect(jsonPath("$.startsAt").value(nullValue()))
			.andExpect(jsonPath("$.distanceIsPlanned").value(true))
			.andExpect(jsonPath("$.meetingPoint").value(nullValue()))
			.andExpect(jsonPath("$.meetingArea").value(nullValue()))
			.andExpect(jsonPath("$.needsReconfirmation").value(false))
			.andReturn()
			.getResponse()
			.getContentAsString();
		String id = JsonPath.read(body, "$.id");

		// Publishing runs the full validation and lists every missing field
		publish(admin, id).andExpect(status().isBadRequest())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.errors[*].field", hasItems("startDate", "startTime", "timeZone", "meetingPoint",
					"discipline", "pace", "participantLimit", "accessMode", "targetDistanceKm")));

		LocalDate date = LocalDate.now(ZONE).plusDays(7);
		update(admin, id, fullRide()).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("DRAFT"));
		publish(admin, id).andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("PUBLISHED"))
			.andExpect(jsonPath("$.startDate").value(date.toString()))
			.andExpect(jsonPath("$.startTime").value("09:30"))
			.andExpect(jsonPath("$.timeZone").value("Europe/Luxembourg"))
			.andExpect(jsonPath("$.startsAt").value(date.atTime(9, 30).atZone(ZONE).toInstant().toString()))
			.andExpect(jsonPath("$.discipline").value("ROAD"))
			.andExpect(jsonPath("$.pace").value("STEADY"))
			.andExpect(jsonPath("$.accessMode").value("OPEN"))
			.andExpect(jsonPath("$.participantLimit").value(10))
			.andExpect(jsonPath("$.placesLeft").value(9))
			.andExpect(jsonPath("$.targetDistanceKm").value(60.0))
			.andExpect(jsonPath("$.distanceMeters").value(nullValue()))
			.andExpect(jsonPath("$.distanceIsPlanned").value(true))
			.andExpect(jsonPath("$.meetingPoint.lat").value(MEETING_LAT));

		// Publishing twice is a conflict
		publish(admin, id).andExpect(status().isConflict())
			.andExpect(jsonPath("$.type").value("urn:cycling:problem:ride-not-draft"));
	}

	@Test
	void invalidRidesAreRejected() throws Exception {
		Rider admin = adult();
		List<Map<String, Object>> invalid = List.of(Map.of("name", "ab"), Map.of("name", "   "),
				Map.of("name", "x".repeat(81)), Map.of("description", "Fake ride"),
				with(fullRide(), "description", "x".repeat(2001)), with(fullRide(), "participantLimit", 1),
				with(fullRide(), "participantLimit", 51), with(fullRide(), "targetDistanceKm", 0.5),
				with(fullRide(), "targetDistanceKm", 501), with(fullRide(), "startTime", "7:30"),
				with(fullRide(), "startTime", "24:00"), with(fullRide(), "timeZone", "Mars/Olympus"),
				with(fullRide(), "timeZone", "+01:00"), with(fullRide(), "pace", "SPRINT"),
				with(fullRide(), "meetingPoint", Map.of("lat", 91, "lon", 10)));
		for (Map<String, Object> body : invalid) {
			create(admin, body).andExpect(status().isBadRequest())
				.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
		}
		create(admin, with(fullRide(), "timeZone", "Mars/Olympus"))
			.andExpect(jsonPath("$.errors[0].field").value("timeZone"));

		// The start must be at least 30 minutes in the future when publishing
		ZonedDateTime soon = ZonedDateTime.now(ZONE).plusMinutes(10);
		Map<String, Object> tooSoon = with(fullRide(), "startDate", soon.toLocalDate().toString());
		tooSoon.put("startTime", soon.format(DateTimeFormatter.ofPattern("HH:mm")));
		String id = idOf(create(admin, tooSoon));
		publish(admin, id).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors.length()").value(1))
			.andExpect(jsonPath("$.errors[0].field").value("startTime"));

		assertThat(
				jdbc.queryForObject("select count(*) from rides where admin_id = ?::uuid", Integer.class, admin.id()))
			.isEqualTo(1);
	}

	// Route copy and age rating

	@Test
	void rideKeepsItsOwnCopyOfTheRoute() throws Exception {
		Rider admin = adult();
		String routeId = saveRoute(admin, ROUTE_INSIDE, "GRAVEL");
		Map<String, Object> body = new LinkedHashMap<>(Map.of("name", "Fake route ride", "routeId", routeId));
		String id = idOf(create(admin, body).andExpect(jsonPath("$.distanceMeters").value(1234.0))
			.andExpect(jsonPath("$.ascendMeters").value(12.0))
			.andExpect(jsonPath("$.distanceIsPlanned").value(false))
			.andExpect(jsonPath("$.targetDistanceKm").value(nullValue()))
			.andExpect(jsonPath("$.elevationProfile.length()").value(3))
			.andExpect(jsonPath("$.surfaces[0].surface").value("asphalt"))
			.andExpect(jsonPath("$.routeGeometry.type").value("LineString"))
			.andExpect(jsonPath("$.routeGeometry.coordinates.length()").value(3))
			// Defaults from the route: start point and discipline
			.andExpect(jsonPath("$.meetingPoint.lat").value(45.00222))
			.andExpect(jsonPath("$.meetingPoint.lon").value(10.00111))
			.andExpect(jsonPath("$.discipline").value("GRAVEL")));

		// Changing and then deleting the saved route does not touch the ride
		GeoStub.route(Reply.ok(ROUTE_CROSSING));
		mvc.perform(client.withToken(put("/api/routes/" + routeId), admin.token())
			.contentType(MediaType.APPLICATION_JSON)
			.content("{\"name\":\"Changed\",\"discipline\":\"ROAD\",\"points\":[{\"lat\":45.0,\"lon\":10.0},"
					+ "{\"lat\":45.0,\"lon\":10.05}]}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.distanceMeters").value(4000.0));
		ride(admin, id).andExpect(jsonPath("$.distanceMeters").value(1234.0))
			.andExpect(jsonPath("$.routeGeometry.coordinates[0][0]").value(10.00111))
			.andExpect(jsonPath("$.ageRating").value("16+"));
		mvc.perform(client.withToken(delete("/api/routes/" + routeId), admin.token()))
			.andExpect(status().isNoContent());
		ride(admin, id).andExpect(status().isOk()).andExpect(jsonPath("$.distanceMeters").value(1234.0));

		// Another rider's saved route cannot be used
		Rider other = adult();
		String othersRoute = saveRoute(other, ROUTE_INSIDE, "ROAD");
		create(admin, Map.of("name", "Borrowed", "routeId", othersRoute)).andExpect(status().isNotFound());
		update(admin, id, Map.of("name", "Borrowed", "routeId", othersRoute)).andExpect(status().isNotFound());
	}

	@Test
	void ageRatingFollowsTheRoute() throws Exception {
		Rider admin = adult();
		String inside = saveRoute(admin, ROUTE_INSIDE, "URBAN");
		String crossing = saveRoute(admin, ROUTE_CROSSING, "ROAD");

		create(admin, Map.of("name", "Inside", "routeId", inside)).andExpect(jsonPath("$.ageRating").value("16+"));
		create(admin, Map.of("name", "Crossing", "routeId", crossing)).andExpect(jsonPath("$.ageRating").value("18+"));
		String id = idOf(create(admin, Map.of("name", "No route", "targetDistanceKm", 30))
			.andExpect(jsonPath("$.ageRating").value("18+")));

		// Attaching a route replaces the target distance and recalculates the rating
		update(admin, id, Map.of("name", "No route", "routeId", inside, "targetDistanceKm", 30))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.ageRating").value("16+"))
			.andExpect(jsonPath("$.distanceMeters").value(1234.0))
			.andExpect(jsonPath("$.distanceIsPlanned").value(false))
			.andExpect(jsonPath("$.targetDistanceKm").value(nullValue()));
		// Without routeId and target distance the copy stays
		update(admin, id, Map.of("name", "Renamed")).andExpect(jsonPath("$.ageRating").value("16+"))
			.andExpect(jsonPath("$.distanceMeters").value(1234.0));
		// routeId null with a target distance removes it
		update(admin, id, Map.of("name", "Renamed", "targetDistanceKm", 45))
			.andExpect(jsonPath("$.ageRating").value("18+"))
			.andExpect(jsonPath("$.distanceMeters").value(nullValue()))
			.andExpect(jsonPath("$.routeGeometry").value(nullValue()))
			.andExpect(jsonPath("$.targetDistanceKm").value(45.0))
			.andExpect(jsonPath("$.distanceIsPlanned").value(true));
	}

	@Test
	void ridersWithoutTheAdultConfirmationCanOnlyCreate16PlusRides() throws Exception {
		Rider minor = rider();
		String inside = saveRoute(minor, ROUTE_INSIDE, "URBAN");
		String crossing = saveRoute(minor, ROUTE_CROSSING, "ROAD");

		create(minor, Map.of("name", "No route")).andExpect(status().isForbidden())
			.andExpect(jsonPath("$.type").value("urn:cycling:problem:adult-confirmation-required"));
		create(minor, Map.of("name", "Crossing", "routeId", crossing)).andExpect(status().isForbidden())
			.andExpect(jsonPath("$.type").value("urn:cycling:problem:adult-confirmation-required"));

		Map<String, Object> body = with(fullRide(), "routeId", inside);
		String id = idOf(create(minor, body).andExpect(jsonPath("$.ageRating").value("16+")));
		publish(minor, id).andExpect(status().isOk());
		update(minor, id, with(fullRide(), "routeId", crossing)).andExpect(status().isForbidden())
			.andExpect(jsonPath("$.type").value("urn:cycling:problem:adult-confirmation-required"));
		ride(minor, id).andExpect(jsonPath("$.ageRating").value("16+"));
	}

	@Test
	void routeChangeTo18PlusIsBlockedWhileRidersUnder18HaveAPlace() throws Exception {
		Rider admin = adult();
		String inside = saveRoute(admin, ROUTE_INSIDE, "URBAN");
		String crossing = saveRoute(admin, ROUTE_CROSSING, "ROAD");
		String id = publishedRide(admin, with(fullRide(), "routeId", inside));
		Rider minor = rider();
		join(id, minor);

		update(admin, id, with(fullRide(), "routeId", crossing)).andExpect(status().isConflict())
			.andExpect(jsonPath("$.type").value("urn:cycling:problem:age-rating-change-blocked"));
		ride(admin, id).andExpect(jsonPath("$.ageRating").value("16+"))
			.andExpect(jsonPath("$.distanceMeters").value(1234.0));
		// Removing the route would make it 18+ too
		update(admin, id, fullRide()).andExpect(status().isConflict());

		// Once only adults have a place, the change goes through
		jdbc.update("delete from ride_participants where user_id = ?::uuid", minor.id());
		join(id, adult());
		update(admin, id, with(fullRide(), "routeId", crossing)).andExpect(status().isOk())
			.andExpect(jsonPath("$.ageRating").value("18+"));
	}

	// Visibility

	@Test
	void eachViewerSeesOnlyWhatTheyMay() throws Exception {
		Rider admin = adult();
		Rider participant = adult();
		Rider stranger = adult();
		String routeId = saveRoute(admin, ROUTE_INSIDE, "ROAD");

		// Draft: only the admin
		String draft = idOf(create(admin, with(fullRide(), "routeId", routeId)));
		ride(admin, draft).andExpect(status().isOk());
		ride(stranger, draft).andExpect(status().isNotFound())
			.andExpect(content().string(not(containsString("Fake Sunday ride"))));

		// Open ride: everyone signed in, exact data only for the admin and participants
		String open = draft;
		publish(admin, open).andExpect(status().isOk());
		join(open, participant);
		ride(admin, open).andExpect(jsonPath("$.viewerRole").value("ADMIN"))
			.andExpect(jsonPath("$.meetingPoint.lat").value(MEETING_LAT))
			.andExpect(jsonPath("$.routeGeometry.coordinates.length()").value(3))
			.andExpect(jsonPath("$.meetingArea").value(nullValue()));
		ride(participant, open).andExpect(jsonPath("$.viewerRole").value("PARTICIPANT"))
			.andExpect(jsonPath("$.meetingPoint.lon").value(MEETING_LON))
			.andExpect(jsonPath("$.routeGeometry.coordinates.length()").value(3))
			.andExpect(jsonPath("$.meetingArea").value(nullValue()))
			.andExpect(jsonPath("$.confirmedCount").value(2))
			.andExpect(jsonPath("$.placesLeft").value(8));
		String raw = ride(stranger, open).andExpect(status().isOk())
			.andExpect(jsonPath("$.viewerRole").value("NONE"))
			.andExpect(jsonPath("$.meetingPoint").value(nullValue()))
			.andExpect(jsonPath("$.routeGeometry").value(nullValue()))
			.andExpect(jsonPath("$.meetingArea.radiusMeters").value(500))
			// What a rider needs to decide
			.andExpect(jsonPath("$.name").value("Fake Sunday ride"))
			.andExpect(jsonPath("$.distanceMeters").value(1234.0))
			.andExpect(jsonPath("$.ascendMeters").value(12.0))
			.andExpect(jsonPath("$.elevationProfile.length()").value(3))
			.andExpect(jsonPath("$.ageRating").value("16+"))
			.andExpect(jsonPath("$.placesLeft").value(8))
			.andExpect(jsonPath("$.admin.displayName").value("Fake Rider"))
			.andReturn()
			.getResponse()
			.getContentAsString();
		// No exact coordinate anywhere in the response
		for (String exact : List.of("45.006789", "10.007654", "10.00111", "45.00222", "10.00333", "45.00444",
				"10.00555", "45.00666")) {
			assertThat(Pattern.compile("(?<![\\d.])" + Pattern.quote(exact) + "(?!\\d)").matcher(raw).find())
				.as("exact coordinate %s in the response", exact)
				.isFalse();
		}
		assertThat(raw).doesNotContain("coordinates").contains("\"meetingPoint\":null", "\"routeGeometry\":null");

		// The area is the same on every request and contains the real point
		double lat = JsonPath.read(raw, "$.meetingArea.lat");
		double lon = JsonPath.read(raw, "$.meetingArea.lon");
		for (int i = 0; i < 3; i++) {
			ride(stranger, open).andExpect(jsonPath("$.meetingArea.lat").value(lat))
				.andExpect(jsonPath("$.meetingArea.lon").value(lon));
		}
		assertThat(distanceMeters(lat, lon, MEETING_LAT, MEETING_LON)).isBetween(98.0, 353.0);

		// Invite only: admin and participants only
		String inviteOnly = publishedRide(admin, with(fullRide(), "accessMode", "INVITE_ONLY"));
		join(inviteOnly, participant);
		ride(admin, inviteOnly).andExpect(status().isOk());
		ride(participant, inviteOnly).andExpect(status().isOk())
			.andExpect(jsonPath("$.meetingPoint.lat").value(MEETING_LAT));
		ride(stranger, inviteOnly).andExpect(status().isNotFound());

		// Admin actions by others: 403 where they can see the ride, 404 where not
		for (String id : List.of(open, inviteOnly)) {
			int expected = id.equals(open) ? 403 : 404;
			update(stranger, id, fullRide()).andExpect(status().is(expected));
			publish(stranger, id).andExpect(status().is(expected));
			cancel(stranger, id, "{}").andExpect(status().is(expected));
			handOver(stranger, id, stranger.id()).andExpect(status().is(expected));
			mvc.perform(client.withToken(delete("/api/rides/" + id), stranger.token()))
				.andExpect(status().is(expected));
		}
		update(participant, open, fullRide()).andExpect(status().isForbidden())
			.andExpect(jsonPath("$.type").value("urn:cycling:problem:not-ride-admin"));
		ride(stranger, UUID.randomUUID().toString()).andExpect(status().isNotFound());
	}

	// Editing, handover, cancelling, deleting

	@Test
	void startedAndCancelledRidesCannotBeChanged() throws Exception {
		Rider admin = adult();
		String started = publishedRide(admin, fullRide());
		jdbc.update("update rides set starts_at = now() - interval '1 hour' where id = ?::uuid", started);
		ride(admin, started).andExpect(jsonPath("$.past").value(true));
		update(admin, started, fullRide()).andExpect(status().isConflict())
			.andExpect(jsonPath("$.type").value("urn:cycling:problem:ride-not-editable"));
		cancel(admin, started, "{}").andExpect(status().isConflict());

		String cancelled = publishedRide(admin, fullRide());
		cancel(admin, cancelled, "{}").andExpect(status().isOk());
		update(admin, cancelled, fullRide()).andExpect(status().isConflict())
			.andExpect(jsonPath("$.type").value("urn:cycling:problem:ride-not-editable"));
		cancel(admin, cancelled, "{}").andExpect(status().isConflict());
	}

	@Test
	void movingTheStartByMoreThanOneHourNeedsReconfirmation() throws Exception {
		Rider admin = adult();
		Rider participant = adult();
		String id = publishedRide(admin, fullRide());
		join(id, participant);

		update(admin, id, with(fullRide(), "startTime", "10:30")).andExpect(status().isOk());
		assertThat(statusOf(id, participant)).isEqualTo("CONFIRMED");

		update(admin, id, with(fullRide(), "startTime", "11:31")).andExpect(status().isOk())
			.andExpect(jsonPath("$.needsReconfirmation").value(false));
		assertThat(statusOf(id, participant)).isEqualTo("NEEDS_RECONFIRMATION");
		assertThat(statusOf(id, admin)).isEqualTo("CONFIRMED");
		ride(participant, id).andExpect(jsonPath("$.needsReconfirmation").value(true))
			.andExpect(jsonPath("$.viewerRole").value("PARTICIPANT"))
			.andExpect(jsonPath("$.confirmedCount").value(2));

		// Moving a published ride's start to less than 30 minutes ahead is invalid
		ZonedDateTime soon = ZonedDateTime.now(ZONE).plusMinutes(10);
		Map<String, Object> tooSoon = with(fullRide(), "startDate", soon.toLocalDate().toString());
		tooSoon.put("startTime", soon.format(DateTimeFormatter.ofPattern("HH:mm")));
		update(admin, id, tooSoon).andExpect(status().isBadRequest());
	}

	@Test
	void limitCannotGoBelowTheRidersWithAPlace() throws Exception {
		Rider admin = adult();
		String id = publishedRide(admin, fullRide());
		join(id, adult());
		join(id, adult());

		update(admin, id, with(fullRide(), "participantLimit", 2)).andExpect(status().isConflict())
			.andExpect(jsonPath("$.type").value("urn:cycling:problem:limit-below-participants"));
		update(admin, id, with(fullRide(), "participantLimit", 3)).andExpect(status().isOk())
			.andExpect(jsonPath("$.placesLeft").value(0));
	}

	@Test
	void adminHandsTheRideOverToAConfirmedParticipant() throws Exception {
		Rider admin = adult();
		Rider participant = adult();
		Rider reconfirming = adult();
		Rider stranger = adult();
		String id = publishedRide(admin, fullRide());
		join(id, participant);
		join(id, reconfirming);
		jdbc.update("update ride_participants set status = 'NEEDS_RECONFIRMATION' where user_id = ?::uuid",
				reconfirming.id());

		handOver(admin, id, stranger.id()).andExpect(status().isConflict())
			.andExpect(jsonPath("$.type").value("urn:cycling:problem:handover-target-invalid"));
		handOver(admin, id, reconfirming.id()).andExpect(status().isConflict());
		handOver(admin, id, admin.id()).andExpect(status().isConflict());

		handOver(admin, id, participant.id()).andExpect(status().isOk())
			.andExpect(jsonPath("$.admin.id").value(participant.id()))
			.andExpect(jsonPath("$.viewerRole").value("PARTICIPANT"))
			.andExpect(jsonPath("$.meetingPoint.lat").value(MEETING_LAT))
			.andExpect(jsonPath("$.confirmedCount").value(3));
		ride(participant, id).andExpect(jsonPath("$.viewerRole").value("ADMIN"));
		update(admin, id, fullRide()).andExpect(status().isForbidden());
		update(participant, id, with(fullRide(), "name", "Taken over")).andExpect(status().isOk());
	}

	@Test
	void adminCancelsAPublishedRide() throws Exception {
		Rider admin = adult();
		Rider participant = adult();
		String id = publishedRide(admin, fullRide());
		join(id, participant);

		cancel(admin, id, "{\"message\":\"%s\"}".formatted("x".repeat(501))).andExpect(status().isBadRequest());
		cancel(admin, id, "{\"message\":\"  Fake storm warning  \"}").andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("CANCELLED"))
			.andExpect(jsonPath("$.cancelMessage").value("Fake storm warning"));
		ride(participant, id).andExpect(jsonPath("$.status").value("CANCELLED"));

		// Without a body or message
		String other = publishedRide(admin, fullRide());
		mvc.perform(client.withToken(post("/api/rides/" + other + "/cancel"), admin.token()))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.cancelMessage").value(nullValue()));

		// Drafts are deleted, not cancelled
		String draft = idOf(create(admin, fullRide()));
		cancel(admin, draft, "{}").andExpect(status().isConflict())
			.andExpect(jsonPath("$.type").value("urn:cycling:problem:ride-not-published"));
	}

	@Test
	void onlyDraftsCanBeDeleted() throws Exception {
		Rider admin = adult();
		Rider participant = adult();
		String draft = idOf(create(admin, fullRide()));
		mvc.perform(client.withToken(delete("/api/rides/" + draft), admin.token())).andExpect(status().isNoContent());
		ride(admin, draft).andExpect(status().isNotFound());

		String published = publishedRide(admin, fullRide());
		join(published, participant);
		mvc.perform(client.withToken(delete("/api/rides/" + published), admin.token()))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.type").value("urn:cycling:problem:ride-not-draft"));
		ride(participant, published).andExpect(status().isOk());
	}

	// My rides

	@Test
	void myRidesListsUpcomingFirstThenPast() throws Exception {
		Rider me = adult();
		Rider other = adult();
		String inThreeDays = publishedRide(me, with(fullRide(), "startDate", inDays(3)));
		String inOneDay = publishedRide(me, with(fullRide(), "startDate", inDays(1)));
		String cancelled = publishedRide(me, with(fullRide(), "startDate", inDays(2)));
		cancel(me, cancelled, "{}").andExpect(status().isOk());
		String undatedDraft = idOf(create(me, Map.of("name", "Undated draft")));
		String joined = publishedRide(other, with(fullRide(), "startDate", inDays(5)));
		join(joined, me);
		String recentPast = publishedRide(me, fullRide());
		jdbc.update("update rides set starts_at = now() - interval '1 day' where id = ?::uuid", recentPast);
		String olderPast = publishedRide(other, fullRide());
		join(olderPast, me);
		jdbc.update("update rides set starts_at = now() - interval '10 days' where id = ?::uuid", olderPast);
		// Not mine: someone else's draft (even with a participant row) and a ride I'm not
		// on
		String othersDraft = idOf(create(other, fullRide()));
		join(othersDraft, me);
		publishedRide(other, fullRide());

		String body = mvc.perform(client.withToken(get("/api/rides/mine"), me.token()))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[0].status").value("PUBLISHED"))
			.andExpect(jsonPath("$[0].viewerRole").value("ADMIN"))
			.andExpect(jsonPath("$[0].past").value(false))
			.andExpect(jsonPath("$[0].startTime").value("09:30"))
			.andExpect(jsonPath("$[0].confirmedCount").value(1))
			.andExpect(jsonPath("$[0].participantLimit").value(10))
			.andExpect(jsonPath("$[0].distanceIsPlanned").value(true))
			.andExpect(jsonPath("$[0].targetDistanceKm").value(60.0))
			.andExpect(jsonPath("$[0].ageRating").value("18+"))
			.andExpect(jsonPath("$[0].meetingPoint").doesNotExist())
			.andExpect(jsonPath("$[1].status").value("CANCELLED"))
			.andExpect(jsonPath("$[3].viewerRole").value("PARTICIPANT"))
			.andExpect(jsonPath("$[4].status").value("DRAFT"))
			.andExpect(jsonPath("$[5].past").value(true))
			.andReturn()
			.getResponse()
			.getContentAsString();
		List<String> ids = JsonPath.read(body, "$[*].id");
		assertThat(ids).containsExactly(inOneDay, cancelled, inThreeDays, joined, undatedDraft, recentPast, olderPast);
	}

	// Account deletion and retention

	@Test
	void deletingTheAccountCancelsUpcomingRidesAndRemovesParticipation() throws Exception {
		String email = AuthTestClient.newEmail();
		Rider leaving = adult(email);
		Rider participant = adult();
		Rider other = adult();
		String draft = idOf(create(leaving, fullRide()));
		String upcoming = publishedRide(leaving, fullRide());
		join(upcoming, participant);
		String past = publishedRide(leaving, fullRide());
		join(past, participant);
		jdbc.update("update rides set starts_at = now() - interval '1 day' where id = ?::uuid", past);
		String othersRide = publishedRide(other, fullRide());
		join(othersRide, leaving);

		mvc.perform(client.withToken(post("/api/me/deletion-code"), leaving.token())).andExpect(status().isAccepted());
		mvc.perform(client.withToken(post("/api/me/delete"), leaving.token())
			.contentType(MediaType.APPLICATION_JSON)
			.content("{\"code\":\"%s\"}".formatted(client.codeSentTo(email)))).andExpect(status().isNoContent());

		assertThat(jdbc.queryForObject("select count(*) from rides where id = ?::uuid", Integer.class, draft)).isZero();
		ride(participant, upcoming).andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("CANCELLED"))
			.andExpect(jsonPath("$.cancelMessage").value(nullValue()))
			.andExpect(jsonPath("$.admin").value(nullValue()));
		ride(participant, past).andExpect(jsonPath("$.status").value("PUBLISHED"))
			.andExpect(jsonPath("$.admin").value(nullValue()));
		ride(other, othersRide).andExpect(jsonPath("$.confirmedCount").value(1));
		assertThat(jdbc.queryForObject("select count(*) from ride_participants where user_id = ?::uuid", Integer.class,
				leaving.id()))
			.isZero();
	}

	@Test
	void ridesAreDeleted12MonthsAfterTheirStart() throws Exception {
		Rider admin = adult();
		String old = publishedRide(admin, fullRide());
		join(old, adult());
		jdbc.update("update rides set starts_at = now() - interval '13 months' where id = ?::uuid", old);
		String recent = publishedRide(admin, fullRide());
		jdbc.update("update rides set starts_at = now() - interval '11 months' where id = ?::uuid", recent);
		String oldDraft = idOf(create(admin, Map.of("name", "Forgotten draft")));
		jdbc.update("update rides set updated_at = now() - interval '13 months' where id = ?::uuid", oldDraft);

		retention.deleteExpired();

		assertThat(jdbc.queryForList("select id::text from rides where admin_id = ?::uuid", String.class, admin.id()))
			.containsExactly(recent);
		assertThat(jdbc.queryForObject("select count(*) from ride_participants where ride_id = ?::uuid", Integer.class,
				old))
			.isZero();
	}

	@Test
	void ridesNeedAnAccessToken() throws Exception {
		String id = UUID.randomUUID().toString();
		String body = "{\"name\":\"Anonymous\"}";
		mvc.perform(post("/api/rides").contentType(MediaType.APPLICATION_JSON).content(body))
			.andExpect(status().isUnauthorized());
		mvc.perform(get("/api/rides/mine")).andExpect(status().isUnauthorized());
		mvc.perform(get("/api/rides/" + id)).andExpect(status().isUnauthorized());
		mvc.perform(put("/api/rides/" + id).contentType(MediaType.APPLICATION_JSON).content(body))
			.andExpect(status().isUnauthorized());
		mvc.perform(post("/api/rides/" + id + "/publish")).andExpect(status().isUnauthorized());
		mvc.perform(post("/api/rides/" + id + "/cancel")).andExpect(status().isUnauthorized());
		mvc.perform(post("/api/rides/" + id + "/handover").contentType(MediaType.APPLICATION_JSON)
			.content("{\"userId\":\"%s\"}".formatted(id))).andExpect(status().isUnauthorized());
		mvc.perform(delete("/api/rides/" + id)).andExpect(status().isUnauthorized());
	}

	// Helpers

	private record Rider(String token, String id) {

	}

	private Rider rider() throws Exception {
		return rider(AuthTestClient.newEmail());
	}

	private Rider rider(String email) throws Exception {
		String token = client.signUp(email).accessToken();
		String body = mvc
			.perform(client.withToken(patch("/api/me"), token)
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"displayName\":\"Fake Rider\"}"))
			.andExpect(status().isOk())
			.andReturn()
			.getResponse()
			.getContentAsString();
		return new Rider(token, JsonPath.read(body, "$.id"));
	}

	private Rider adult() throws Exception {
		return adult(AuthTestClient.newEmail());
	}

	private Rider adult(String email) throws Exception {
		Rider rider = rider(email);
		mvc.perform(client.withToken(post("/api/me/adult-confirmation"), rider.token()))
			.andExpect(status().isNoContent());
		return rider;
	}

	/** Adds a confirmed participant directly (joining is a separate spec). */
	private void join(String rideId, Rider rider) {
		jdbc.update("insert into ride_participants (ride_id, user_id, status, joined_at) "
				+ "values (?::uuid, ?::uuid, 'CONFIRMED', now())", rideId, rider.id());
	}

	private String statusOf(String rideId, Rider rider) {
		return jdbc.queryForObject("select status from ride_participants where ride_id = ?::uuid and user_id = ?::uuid",
				String.class, rideId, rider.id());
	}

	private String saveRoute(Rider rider, String graphhopperResponse, String discipline) throws Exception {
		GeoStub.route(Reply.ok(graphhopperResponse));
		String body = mvc
			.perform(client.withToken(post("/api/routes"), rider.token())
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"Fake route\",\"discipline\":\"%s\",\"points\":%s}".formatted(discipline, POINTS)))
			.andExpect(status().isCreated())
			.andReturn()
			.getResponse()
			.getContentAsString();
		return JsonPath.read(body, "$.id");
	}

	/** A complete ride a week ahead, without a route. */
	private static Map<String, Object> fullRide() {
		Map<String, Object> ride = new LinkedHashMap<>();
		ride.put("name", "Fake Sunday ride");
		ride.put("description", "Fake description");
		ride.put("startDate", inDays(7));
		ride.put("startTime", "09:30");
		ride.put("timeZone", "Europe/Luxembourg");
		ride.put("meetingPoint", Map.of("lat", MEETING_LAT, "lon", MEETING_LON));
		ride.put("discipline", "ROAD");
		ride.put("pace", "STEADY");
		ride.put("participantLimit", 10);
		ride.put("accessMode", "OPEN");
		ride.put("targetDistanceKm", 60);
		return ride;
	}

	private static Map<String, Object> with(Map<String, Object> ride, String key, Object value) {
		Map<String, Object> copy = new LinkedHashMap<>(ride);
		copy.put(key, value);
		return copy;
	}

	private static String inDays(int days) {
		return LocalDate.now(ZONE).plusDays(days).toString();
	}

	private String publishedRide(Rider admin, Map<String, Object> body) throws Exception {
		String id = idOf(create(admin, body));
		publish(admin, id).andExpect(status().isOk());
		return id;
	}

	private ResultActions create(Rider rider, Map<String, Object> body) throws Exception {
		return mvc.perform(client.withToken(post("/api/rides"), rider.token())
			.contentType(MediaType.APPLICATION_JSON)
			.content(json.writeValueAsString(body)));
	}

	private ResultActions update(Rider rider, String id, Map<String, Object> body) throws Exception {
		return mvc.perform(client.withToken(put("/api/rides/" + id), rider.token())
			.contentType(MediaType.APPLICATION_JSON)
			.content(json.writeValueAsString(body)));
	}

	private ResultActions publish(Rider rider, String id) throws Exception {
		return mvc.perform(client.withToken(post("/api/rides/" + id + "/publish"), rider.token()));
	}

	private ResultActions cancel(Rider rider, String id, String body) throws Exception {
		return mvc.perform(client.withToken(post("/api/rides/" + id + "/cancel"), rider.token())
			.contentType(MediaType.APPLICATION_JSON)
			.content(body));
	}

	private ResultActions handOver(Rider rider, String id, String userId) throws Exception {
		return mvc.perform(client.withToken(post("/api/rides/" + id + "/handover"), rider.token())
			.contentType(MediaType.APPLICATION_JSON)
			.content("{\"userId\":\"%s\"}".formatted(userId)));
	}

	private ResultActions ride(Rider rider, String id) throws Exception {
		return mvc.perform(client.withToken(get("/api/rides/" + id), rider.token()));
	}

	private static String idOf(ResultActions created) throws Exception {
		return JsonPath.read(created.andExpect(status().isCreated()).andReturn().getResponse().getContentAsString(),
				"$.id");
	}

	/** Great-circle distance, good enough for a few hundred metres. */
	private static double distanceMeters(double lat1, double lon1, double lat2, double lon2) {
		double dLat = Math.toRadians(lat2 - lat1);
		double dLon = Math.toRadians(lon2 - lon1);
		double a = Math.pow(Math.sin(dLat / 2), 2)
				+ Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) * Math.pow(Math.sin(dLon / 2), 2);
		return 2 * 6_371_000 * Math.asin(Math.sqrt(a));
	}

}
