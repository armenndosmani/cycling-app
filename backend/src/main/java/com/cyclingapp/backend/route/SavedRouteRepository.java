package com.cyclingapp.backend.route;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * Saved routes in PostGIS. Every query is limited to the owner's rows ({@code user_id}),
 * so another rider's route behaves as if it did not exist. Geometry goes in and out as
 * GeoJSON; points, profile and surfaces are stored as JSON.
 */
@Repository
class SavedRouteRepository {

	private final JdbcClient jdbc;

	SavedRouteRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	void insert(UUID userId, StoredRoute route) {
		jdbc.sql("""
				insert into saved_routes (id, user_id, name, note, discipline, points, geometry, distance_meters,
					ascend_meters, elevation_profile, surfaces, created_at, updated_at)
				values (:id, :userId, :name, :note, :discipline, cast(:points as jsonb),
					ST_SetSRID(ST_GeomFromGeoJSON(:geometry), 4326), :distance, :ascend,
					cast(:profile as jsonb), cast(:surfaces as jsonb), :createdAt, :updatedAt)""")
			.param("id", route.id())
			.param("userId", userId)
			.params(values(route))
			.param("createdAt", Timestamp.from(route.createdAt()))
			.update();
	}

	/**
	 * @return false if the route does not exist or belongs to someone else
	 */
	boolean update(UUID userId, StoredRoute route) {
		return jdbc.sql("""
				update saved_routes set name = :name, note = :note, discipline = :discipline,
					points = cast(:points as jsonb), geometry = ST_SetSRID(ST_GeomFromGeoJSON(:geometry), 4326),
					distance_meters = :distance, ascend_meters = :ascend,
					elevation_profile = cast(:profile as jsonb), surfaces = cast(:surfaces as jsonb),
					updated_at = :updatedAt
				where id = :id and user_id = :userId""")
			.param("id", route.id())
			.param("userId", userId)
			.params(values(route))
			.update() == 1;
	}

	Optional<StoredRoute> find(UUID userId, UUID id) {
		return jdbc.sql("""
				select id, name, note, discipline, points::text as points, ST_AsGeoJSON(geometry) as geometry,
					distance_meters, ascend_meters, elevation_profile::text as elevation_profile,
					surfaces::text as surfaces, created_at, updated_at
				from saved_routes where id = :id and user_id = :userId""")
			.param("id", id)
			.param("userId", userId)
			.query((rs, row) -> new StoredRoute(rs.getObject("id", UUID.class), rs.getString("name"),
					rs.getString("note"), rs.getString("discipline"), rs.getString("points"), rs.getString("geometry"),
					rs.getDouble("distance_meters"), rs.getObject("ascend_meters", Double.class),
					rs.getString("elevation_profile"), rs.getString("surfaces"),
					rs.getTimestamp("created_at").toInstant(), rs.getTimestamp("updated_at").toInstant()))
			.optional();
	}

	/** The owner's routes, most recently changed first, without the heavy columns. */
	List<RouteSummary> list(UUID userId) {
		return jdbc.sql("""
				select id, name, discipline, distance_meters, ascend_meters, updated_at
				from saved_routes where user_id = :userId order by updated_at desc, id""")
			.param("userId", userId)
			.query((rs, row) -> new RouteSummary(rs.getObject("id", UUID.class), rs.getString("name"),
					rs.getString("discipline"), rs.getDouble("distance_meters"),
					rs.getObject("ascend_meters", Double.class), rs.getTimestamp("updated_at").toInstant()))
			.list();
	}

	/**
	 * @return false if the route does not exist or belongs to someone else
	 */
	boolean delete(UUID userId, UUID id) {
		return jdbc.sql("delete from saved_routes where id = :id and user_id = :userId")
			.param("id", id)
			.param("userId", userId)
			.update() == 1;
	}

	int deleteAll(UUID userId) {
		return jdbc.sql("delete from saved_routes where user_id = :userId").param("userId", userId).update();
	}

	private static Map<String, Object> values(StoredRoute route) {
		Map<String, Object> values = new HashMap<>();
		values.put("name", route.name());
		values.put("note", route.note());
		values.put("discipline", route.discipline());
		values.put("points", route.pointsJson());
		values.put("geometry", route.geometryJson());
		values.put("distance", route.distanceMeters());
		values.put("ascend", route.ascendMeters());
		values.put("profile", route.elevationProfileJson());
		values.put("surfaces", route.surfacesJson());
		values.put("updatedAt", Timestamp.from(route.updatedAt()));
		return values;
	}

	/** A row as stored; JSON columns as text. */
	record StoredRoute(UUID id, String name, String note, String discipline, String pointsJson, String geometryJson,
			double distanceMeters, Double ascendMeters, String elevationProfileJson, String surfacesJson,
			Instant createdAt, Instant updatedAt) {

	}

	record RouteSummary(UUID id, String name, String discipline, double distanceMeters, Double ascendMeters,
			Instant updatedAt) {

	}

}
