package com.cyclingapp.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;
import java.util.UUID;

import com.cyclingapp.backend.GeoStub.Reply;
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

/** Saved routes: CRUD, owner-only access and deletion with the account. */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class SavedRoutesTests {

	private static final String POINTS = "[{\"lat\":45.0,\"lon\":10.0},{\"lat\":45.0,\"lon\":10.01}]";

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

	private AuthTestClient client;

	@BeforeEach
	void setUp() {
		GeoStub.reset();
		GeoStub.route(Reply.ok(GeoStub.SIMPLE_ROUTE));
		client = new AuthTestClient(mvc, mail);
	}

	@Test
	void riderSavesListsOpensEditsAndDeletesARoute() throws Exception {
		String token = signUp();

		// Calculated values sent by the app are ignored: the server calculates the route
		String body = save(token,
				"""
						{"name":"  Sunday loop  ","note":"Fake note","discipline":"GRAVEL","points":%s,
						 "distanceMeters":1,"ascendMeters":99999,"geometry":{"type":"LineString","coordinates":[[0,0],[1,1]]}}"""
					.formatted(POINTS))
			.andExpect(status().isCreated())
			.andExpect(header().string("Location", containsString("/api/routes/")))
			.andExpect(jsonPath("$.name").value("Sunday loop"))
			.andExpect(jsonPath("$.note").value("Fake note"))
			.andExpect(jsonPath("$.discipline").value("GRAVEL"))
			.andExpect(jsonPath("$.points.length()").value(2))
			.andExpect(jsonPath("$.points[1].lon").value(10.01))
			.andExpect(jsonPath("$.distanceMeters").value(790.0))
			.andExpect(jsonPath("$.ascendMeters").value(10.0))
			.andExpect(jsonPath("$.geometry.type").value("LineString"))
			.andExpect(jsonPath("$.geometry.coordinates.length()").value(3))
			.andExpect(jsonPath("$.createdAt").exists())
			.andReturn()
			.getResponse()
			.getContentAsString();
		String id = JsonPath.read(body, "$.id");
		assertThat(GeoStub.routeRequests).hasSize(1);

		// Stored as a PostGIS line with elevation
		Map<String, Object> stored = jdbc
			.queryForMap("select ST_SRID(geometry) as srid, GeometryType(geometry) as type, ST_NDims(geometry) as dims "
					+ "from saved_routes where id = ?::uuid", id);
		assertThat(stored).containsEntry("srid", 4326).containsEntry("type", "LINESTRING").containsEntry("dims", 3);

		// Opening never recalculates
		mvc.perform(client.withToken(get("/api/routes/" + id), token))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.id").value(id))
			.andExpect(jsonPath("$.name").value("Sunday loop"))
			.andExpect(jsonPath("$.geometry.coordinates[1][2]").value(110.0))
			.andExpect(jsonPath("$.elevationProfile.length()").value(3))
			.andExpect(jsonPath("$.surfaces.length()").value(2))
			.andExpect(jsonPath("$.updatedAt").exists());
		assertThat(GeoStub.routeRequests).hasSize(1);

		mvc.perform(client.withToken(get("/api/routes"), token))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.length()").value(1))
			.andExpect(jsonPath("$[0].id").value(id))
			.andExpect(jsonPath("$[0].name").value("Sunday loop"))
			.andExpect(jsonPath("$[0].discipline").value("GRAVEL"))
			.andExpect(jsonPath("$[0].distanceMeters").value(790.0))
			.andExpect(jsonPath("$[0].ascendMeters").value(10.0))
			.andExpect(jsonPath("$[0].updatedAt").exists())
			.andExpect(jsonPath("$[0].geometry").doesNotExist());

		// Renaming keeps the route and does not call the routing engine
		update(token, id, "{\"name\":\"Renamed\",\"discipline\":\"GRAVEL\",\"points\":%s}".formatted(POINTS))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.name").value("Renamed"))
			.andExpect(jsonPath("$.note").value(nullValue()))
			.andExpect(jsonPath("$.distanceMeters").value(790.0));
		assertThat(GeoStub.routeRequests).hasSize(1);

		// New points or a new discipline recalculate
		GeoStub.route(Reply.ok(GeoStub.graphhopperRoute(1500.0, 20.0,
				"[[10.0,45.0,100.0],[10.01,45.0,110.0],[10.02,45.0,120.0]]", "[[0,2,\"compacted\"]]")));
		update(token, id, "{\"name\":\"Renamed\",\"discipline\":\"MTB\",\"points\":%s}".formatted(POINTS))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.discipline").value("MTB"))
			.andExpect(jsonPath("$.distanceMeters").value(1500.0))
			.andExpect(jsonPath("$.surfaces[0].surface").value("compacted"));
		assertThat(GeoStub.routeRequests).hasSize(2);
		assertThat((String) JsonPath.read(GeoStub.routeRequests.get(1), "$.profile")).isEqualTo("mtb");

		mvc.perform(client.withToken(delete("/api/routes/" + id), token)).andExpect(status().isNoContent());
		mvc.perform(client.withToken(get("/api/routes/" + id), token))
			.andExpect(status().isNotFound())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
		mvc.perform(client.withToken(get("/api/routes"), token)).andExpect(jsonPath("$").isEmpty());
	}

	@Test
	void listIsNewestFirst() throws Exception {
		String token = signUp();
		String first = idOf(save(token, request("First")));
		String second = idOf(save(token, request("Second")));

		mvc.perform(client.withToken(get("/api/routes"), token))
			.andExpect(jsonPath("$[0].id").value(second))
			.andExpect(jsonPath("$[1].id").value(first));

		// Editing moves a route to the top
		update(token, first, request("First, edited")).andExpect(status().isOk());
		mvc.perform(client.withToken(get("/api/routes"), token)).andExpect(jsonPath("$[0].id").value(first));
	}

	@Test
	void otherRidersCannotSeeChangeOrDeleteARoute() throws Exception {
		String owner = signUp();
		String other = signUp();
		String id = idOf(save(owner, request("Private draft")));
		save(other, request("Other's route")).andExpect(status().isCreated());

		mvc.perform(client.withToken(get("/api/routes/" + id), other))
			.andExpect(status().isNotFound())
			.andExpect(content().string(not(containsString("Private draft"))));
		update(other, id, request("Taken over")).andExpect(status().isNotFound());
		mvc.perform(client.withToken(delete("/api/routes/" + id), other)).andExpect(status().isNotFound());
		mvc.perform(client.withToken(get("/api/routes"), other))
			.andExpect(jsonPath("$.length()").value(1))
			.andExpect(content().string(not(containsString(id))));

		// Unchanged for the owner
		mvc.perform(client.withToken(get("/api/routes/" + id), owner))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.name").value("Private draft"));

		// Unknown ids look the same as other riders' ids
		mvc.perform(client.withToken(get("/api/routes/" + UUID.randomUUID()), owner)).andExpect(status().isNotFound());
	}

	@Test
	void invalidRoutesAreRejected() throws Exception {
		String token = signUp();
		String[] invalid = { request(""), request("   "), request("x".repeat(81)), request("Tab\tname"),
				"{\"name\":\"Ok\",\"note\":\"%s\",\"discipline\":\"ROAD\",\"points\":%s}".formatted("x".repeat(1001),
						POINTS),
				"{\"name\":\"Ok\",\"discipline\":\"ROAD\",\"points\":[{\"lat\":45.0,\"lon\":10.0}]}",
				"{\"name\":\"Ok\",\"discipline\":\"ROAD\",\"points\":" + GeoApiTests.points(28) + "}",
				"{\"name\":\"Ok\",\"points\":" + POINTS + "}" };
		for (String body : invalid) {
			save(token, body).andExpect(status().isBadRequest())
				.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
		}
		save(token, request("x".repeat(80))).andExpect(status().isCreated());
		mvc.perform(client.withToken(get("/api/routes/not-a-uuid"), token))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.detail").value(not(containsString("not-a-uuid"))));
		assertThat(GeoStub.routeRequests).hasSize(1);
	}

	@Test
	void nothingIsSavedWhenRoutingFails() throws Exception {
		String token = signUp();
		GeoStub.route(Reply.status(500, "{}"));
		save(token, request("Fails")).andExpect(status().isServiceUnavailable())
			.andExpect(jsonPath("$.type").value("urn:cycling:problem:routing-unavailable"));

		GeoStub.route(Reply.status(400,
				"{\"hints\":[{\"details\":\"com.graphhopper.util.exceptions.ConnectionNotFoundException\"}]}"));
		save(token, request("Fails")).andExpect(status().is(422));

		mvc.perform(client.withToken(get("/api/routes"), token)).andExpect(jsonPath("$").isEmpty());
	}

	@Test
	void savedRoutesNeedAnAccessToken() throws Exception {
		String id = UUID.randomUUID().toString();
		mvc.perform(get("/api/routes")).andExpect(status().isUnauthorized());
		mvc.perform(post("/api/routes").contentType(MediaType.APPLICATION_JSON).content(request("Anonymous")))
			.andExpect(status().isUnauthorized());
		mvc.perform(get("/api/routes/" + id)).andExpect(status().isUnauthorized());
		mvc.perform(put("/api/routes/" + id).contentType(MediaType.APPLICATION_JSON).content(request("Anonymous")))
			.andExpect(status().isUnauthorized());
		mvc.perform(delete("/api/routes/" + id)).andExpect(status().isUnauthorized());
		assertThat(GeoStub.routeRequests).isEmpty();
	}

	@Test
	void deletingTheAccountDeletesItsRoutes() throws Exception {
		String email = AuthTestClient.newEmail();
		String token = client.signUp(email).accessToken();
		String other = signUp();
		save(token, request("Mine")).andExpect(status().isCreated());
		save(token, request("Also mine")).andExpect(status().isCreated());
		save(other, request("Someone else's")).andExpect(status().isCreated());
		String userId = jdbc.queryForObject("select id::text from users where email = ?", String.class, email);
		assertThat(routesOf(userId)).isEqualTo(2);

		mvc.perform(client.withToken(post("/api/me/deletion-code"), token)).andExpect(status().isAccepted());
		mvc.perform(client.withToken(post("/api/me/delete"), token)
			.contentType(MediaType.APPLICATION_JSON)
			.content("{\"code\":\"%s\"}".formatted(client.codeSentTo(email)))).andExpect(status().isNoContent());

		assertThat(routesOf(userId)).isZero();
		mvc.perform(client.withToken(get("/api/routes"), other)).andExpect(jsonPath("$.length()").value(1));
	}

	private String signUp() throws Exception {
		return client.signUp(AuthTestClient.newEmail()).accessToken();
	}

	private static String request(String name) {
		return "{\"name\":\"%s\",\"discipline\":\"ROAD\",\"points\":%s}".formatted(name, POINTS);
	}

	private ResultActions save(String token, String json) throws Exception {
		return mvc.perform(
				client.withToken(post("/api/routes"), token).contentType(MediaType.APPLICATION_JSON).content(json));
	}

	private ResultActions update(String token, String id, String json) throws Exception {
		return mvc.perform(client.withToken(put("/api/routes/" + id), token)
			.contentType(MediaType.APPLICATION_JSON)
			.content(json));
	}

	private static String idOf(ResultActions created) throws Exception {
		return JsonPath.read(created.andExpect(status().isCreated()).andReturn().getResponse().getContentAsString(),
				"$.id");
	}

	private int routesOf(String userId) {
		return jdbc.queryForObject("select count(*) from saved_routes where user_id = ?::uuid", Integer.class, userId);
	}

}
