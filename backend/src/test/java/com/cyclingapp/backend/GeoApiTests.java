package com.cyclingapp.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.closeTo;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.List;

import com.cyclingapp.backend.GeoStub.Reply;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/** Route calculation and place search against a fake GraphHopper and Photon. */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class GeoApiTests {

	private static final String TWO_POINTS = "[{\"lat\":45.0,\"lon\":10.0},{\"lat\":45.0,\"lon\":10.01}]";

	@DynamicPropertySource
	static void geo(DynamicPropertyRegistry registry) {
		GeoStub.register(registry);
	}

	@Autowired
	private MockMvc mvc;

	@Autowired
	private CapturingMailSender mail;

	private AuthTestClient client;

	private String token;

	@BeforeEach
	void setUp() throws Exception {
		GeoStub.reset();
		client = new AuthTestClient(mvc, mail);
		token = client.signUp(AuthTestClient.newEmail()).accessToken();
	}

	@Test
	void routeHasGeometryDistanceElevationProfileAndSurfaces() throws Exception {
		GeoStub.route(Reply.ok(GeoStub.SIMPLE_ROUTE));

		route("GRAVEL", TWO_POINTS).andExpect(status().isOk())
			.andExpect(jsonPath("$.geometry.type").value("LineString"))
			.andExpect(jsonPath("$.geometry.coordinates.length()").value(3))
			.andExpect(jsonPath("$.geometry.coordinates[1][0]").value(10.005))
			.andExpect(jsonPath("$.geometry.coordinates[1][1]").value(45.0))
			.andExpect(jsonPath("$.geometry.coordinates[1][2]").value(110.0))
			.andExpect(jsonPath("$.distanceMeters").value(790.0))
			.andExpect(jsonPath("$.ascendMeters").value(10.0))
			.andExpect(jsonPath("$.elevationProfile.length()").value(3))
			.andExpect(jsonPath("$.elevationProfile[0][0]").value(0.0))
			.andExpect(jsonPath("$.elevationProfile[0][1]").value(100.0))
			.andExpect(jsonPath("$.elevationProfile[1][0]").value(closeTo(395.0, 0.2)))
			.andExpect(jsonPath("$.elevationProfile[2][0]").value(790.0))
			.andExpect(jsonPath("$.elevationProfile[2][1]").value(105.0))
			.andExpect(jsonPath("$.surfaces.length()").value(2))
			.andExpect(jsonPath("$.surfaces[?(@.surface=='asphalt')].meters").value(contains(closeTo(395.0, 0.2))))
			.andExpect(jsonPath("$.surfaces[?(@.surface=='unknown')].meters").value(contains(closeTo(395.0, 0.2))));

		// GraphHopper gets the discipline's profile and [lon, lat] points
		assertThat(GeoStub.routeRequests).hasSize(1);
		String sent = GeoStub.routeRequests.getFirst();
		assertThat((String) JsonPath.read(sent, "$.profile")).isEqualTo("gravel");
		assertThat(JsonPath.<List<Object>>read(sent, "$.points[1]")).containsExactly(10.01, 45.0);
		assertThat((Boolean) JsonPath.read(sent, "$.elevation")).isTrue();
		assertThat((Boolean) JsonPath.read(sent, "$.points_encoded")).isFalse();
		assertThat(JsonPath.<List<Object>>read(sent, "$.details")).containsExactly("surface");
	}

	@Test
	void eachDisciplineUsesItsOwnProfile() throws Exception {
		GeoStub.route(Reply.ok(GeoStub.SIMPLE_ROUTE));
		for (String discipline : new String[] { "ROAD", "GRAVEL", "MTB", "URBAN" }) {
			route(discipline, TWO_POINTS).andExpect(status().isOk());
		}
		assertThat(GeoStub.routeRequests.stream().map(body -> (String) JsonPath.read(body, "$.profile")))
			.containsExactly("road", "gravel", "mtb", "urban");
	}

	@Test
	void withoutElevationDataAscendAndProfileAreNull() throws Exception {
		GeoStub.route(Reply.ok(GeoStub.graphhopperRoute(786.0, 0, "[[10.0,45.0],[10.01,45.0]]", "[]")));

		route("ROAD", TWO_POINTS).andExpect(status().isOk())
			.andExpect(jsonPath("$.distanceMeters").value(786.0))
			.andExpect(jsonPath("$.ascendMeters").value(nullValue()))
			.andExpect(jsonPath("$.elevationProfile").value(nullValue()))
			.andExpect(jsonPath("$.surfaces").isEmpty());
	}

	@Test
	void elevationProfileHasAtMost300Points() throws Exception {
		List<String> coordinates = new ArrayList<>();
		for (int i = 0; i < 1000; i++) {
			coordinates.add("[%s,45.0,%s]".formatted(10 + i * 0.001, 100 + i % 7));
		}
		GeoStub.route(Reply.ok(GeoStub.graphhopperRoute(78_600.0, 300.0, "[" + String.join(",", coordinates) + "]",
				"[[0,999,\"gravel\"]]")));

		route("GRAVEL", TWO_POINTS).andExpect(status().isOk())
			.andExpect(jsonPath("$.geometry.coordinates.length()").value(1000))
			.andExpect(jsonPath("$.elevationProfile.length()").value(300))
			.andExpect(jsonPath("$.elevationProfile[0][0]").value(0.0))
			.andExpect(jsonPath("$.elevationProfile[299][0]").value(78_600.0))
			.andExpect(jsonPath("$.surfaces[0].surface").value("gravel"))
			.andExpect(jsonPath("$.surfaces[0].meters").value(78_600.0));
	}

	@Test
	void loopsAndTheMaximumNumberOfPointsAreAllowed() throws Exception {
		GeoStub.route(Reply.ok(GeoStub.SIMPLE_ROUTE));
		route("MTB", "[{\"lat\":45.0,\"lon\":10.0},{\"lat\":45.01,\"lon\":10.0},{\"lat\":45.0,\"lon\":10.0}]")
			.andExpect(status().isOk());
		route("MTB", points(27)).andExpect(status().isOk());
	}

	@Test
	void noRouteIs422WithoutGraphHoppersMessage() throws Exception {
		GeoStub.route(Reply.status(400, """
				{"message":"Cannot find point 1: 45.0,10.01","hints":[{"message":"Cannot find point 1: 45.0,10.01",
				"details":"com.graphhopper.util.exceptions.PointNotFoundException","point_index":1}]}"""));

		route("ROAD", TWO_POINTS).andExpect(status().is(422))
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.type").value("urn:cycling:problem:route-not-found"))
			.andExpect(content().string(not(containsString("45.0"))));

		GeoStub.route(Reply.status(400,
				"""
						{"message":"Connection between locations not found","hints":[{"message":"Connection between locations not found",
						"details":"com.graphhopper.util.exceptions.ConnectionNotFoundException"}]}"""));
		route("ROAD", TWO_POINTS).andExpect(status().is(422))
			.andExpect(jsonPath("$.type").value("urn:cycling:problem:route-not-found"));
	}

	@Test
	void routingFailuresAre503() throws Exception {
		GeoStub.route(Reply.status(500, "{\"message\":\"boom\"}"));
		route("ROAD", TWO_POINTS).andExpect(status().isServiceUnavailable())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.type").value("urn:cycling:problem:routing-unavailable"));

		// Any other GraphHopper error is our problem, not the rider's
		GeoStub.route(Reply.status(400,
				"{\"message\":\"unknown profile\",\"hints\":[{\"details\":\"java.lang.IllegalArgumentException\"}]}"));
		route("ROAD", TWO_POINTS).andExpect(status().isServiceUnavailable());

		GeoStub.route(Reply.ok("not json"));
		route("ROAD", TWO_POINTS).andExpect(status().isServiceUnavailable());

		GeoStub.route(Reply.slow(GeoStub.SIMPLE_ROUTE));
		route("ROAD", TWO_POINTS).andExpect(status().isServiceUnavailable())
			.andExpect(jsonPath("$.type").value("urn:cycling:problem:routing-unavailable"));
	}

	@Test
	void invalidRouteRequestsAre400WithoutCallingGraphHopper() throws Exception {
		String[] invalid = { "{\"discipline\":\"ROAD\",\"points\":[{\"lat\":45.0,\"lon\":10.0}]}",
				"{\"discipline\":\"ROAD\",\"points\":" + points(28) + "}", "{\"discipline\":\"ROAD\"}",
				"{\"points\":" + TWO_POINTS + "}", "{\"discipline\":\"BMX\",\"points\":" + TWO_POINTS + "}",
				"{\"discipline\":\"ROAD\",\"points\":[{\"lat\":91.0,\"lon\":10.0},{\"lat\":45.0,\"lon\":10.0}]}",
				"{\"discipline\":\"ROAD\",\"points\":[{\"lat\":45.0,\"lon\":-180.5},{\"lat\":45.0,\"lon\":10.0}]}",
				"{\"discipline\":\"ROAD\",\"points\":[{\"lat\":45.0},{\"lat\":45.0,\"lon\":10.0}]}",
				"{\"discipline\":\"ROAD\",\"points\":[null,{\"lat\":45.0,\"lon\":10.0}]}" };
		for (String body : invalid) {
			mvc.perform(client.withToken(post("/api/routing/route"), token)
				.contentType(MediaType.APPLICATION_JSON)
				.content(body))
				.andExpect(status().isBadRequest())
				.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
		}
		assertThat(GeoStub.routeRequests).isEmpty();
	}

	@Test
	void placeSearchReturnsNameLabelAndPosition() throws Exception {
		GeoStub.places(Reply.ok("""
				{"type":"FeatureCollection","features":[
				 {"type":"Feature","geometry":{"type":"Point","coordinates":[10.5,45.5]},
				  "properties":{"osm_type":"R","name":"Fakeville","city":"Fakeville","state":"Fake State",
				  "country":"Fakeland","type":"city"}},
				 {"type":"Feature","geometry":{"type":"Point","coordinates":[10.6,45.6]},
				  "properties":{"street":"Example Street","housenumber":"12","postcode":"12345","city":"Fakeville",
				  "country":"Fakeland","type":"house"}}]}"""));

		mvc.perform(client.withToken(get("/api/places"), token)
			.param("q", "  Fake & ville+  ")
			.param("lat", "45.1")
			.param("lon", "10.2"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.length()").value(2))
			.andExpect(jsonPath("$[0].name").value("Fakeville"))
			.andExpect(jsonPath("$[0].label").value("Fakeville, Fake State, Fakeland"))
			.andExpect(jsonPath("$[0].lat").value(45.5))
			.andExpect(jsonPath("$[0].lon").value(10.5))
			.andExpect(jsonPath("$[1].name").value("Example Street 12"))
			.andExpect(jsonPath("$[1].label").value("Example Street 12, 12345 Fakeville, Fakeland"));

		// The trimmed term is encoded as one parameter; the bias position is passed on
		String query = GeoStub.placeQueries.getFirst();
		assertThat(query).contains("q=Fake%20%26%20ville%2B&")
			.contains("limit=10")
			.contains("lat=45.1")
			.contains("lon=10.2");
	}

	@Test
	void placeSearchReturnsAtMost10Places() throws Exception {
		List<String> features = new ArrayList<>();
		for (int i = 0; i < 12; i++) {
			features.add("""
					{"type":"Feature","geometry":{"type":"Point","coordinates":[10.0,45.0]},
					 "properties":{"name":"Place %d"}}""".formatted(i));
		}
		GeoStub.places(Reply.ok("{\"features\":[" + String.join(",", features) + "]}"));

		mvc.perform(client.withToken(get("/api/places"), token).param("q", "Place"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.length()").value(10));
		assertThat(GeoStub.placeQueries.getFirst()).doesNotContain("lat=");
	}

	@Test
	void placeSearchFailuresAre503() throws Exception {
		GeoStub.places(Reply.status(500, "{}"));
		mvc.perform(client.withToken(get("/api/places"), token).param("q", "Fakeville"))
			.andExpect(status().isServiceUnavailable())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.type").value("urn:cycling:problem:place-search-unavailable"));

		GeoStub.places(Reply.slow("{\"features\":[]}"));
		mvc.perform(client.withToken(get("/api/places"), token).param("q", "Fakeville"))
			.andExpect(status().isServiceUnavailable());
	}

	@Test
	void invalidSearchesAre400WithoutEchoingTheTerm() throws Exception {
		String secret = "Secretplace";
		List<org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder> invalid = List.of(
				get("/api/places"), get("/api/places").param("q", "S"), get("/api/places").param("q", "  S  "),
				get("/api/places").param("q", secret + "x".repeat(100)),
				get("/api/places").param("q", secret).param("lat", "45.0"),
				get("/api/places").param("q", secret).param("lat", "95.0").param("lon", "10.0"),
				get("/api/places").param("q", secret).param("lat", "north").param("lon", "10.0"));
		for (var request : invalid) {
			mvc.perform(client.withToken(request, token))
				.andExpect(status().isBadRequest())
				.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
				.andExpect(content().string(not(containsString(secret))))
				.andExpect(content().string(not(containsString("north"))));
		}
		assertThat(GeoStub.placeQueries).isEmpty();
	}

	@Test
	void routingAndSearchNeedAnAccessToken() throws Exception {
		mvc.perform(post("/api/routing/route").contentType(MediaType.APPLICATION_JSON)
			.content("{\"discipline\":\"ROAD\",\"points\":" + TWO_POINTS + "}")).andExpect(status().isUnauthorized());
		mvc.perform(get("/api/places").param("q", "Fakeville")).andExpect(status().isUnauthorized());
		assertThat(GeoStub.routeRequests).isEmpty();
		assertThat(GeoStub.placeQueries).isEmpty();
	}

	private ResultActions route(String discipline, String points) throws Exception {
		return mvc.perform(client.withToken(post("/api/routing/route"), token)
			.contentType(MediaType.APPLICATION_JSON)
			.content("{\"discipline\":\"%s\",\"points\":%s}".formatted(discipline, points)));
	}

	static String points(int count) {
		List<String> points = new ArrayList<>();
		for (int i = 0; i < count; i++) {
			points.add("{\"lat\":%s,\"lon\":10.0}".formatted(45.0 + i * 0.001));
		}
		return "[" + String.join(",", points) + "]";
	}

}
