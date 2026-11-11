package com.cyclingapp.backend.ride;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * Rides and their participants in PostGIS. Points and lines go in and out as numbers and
 * GeoJSON; the public meeting area is calculated here from the stored random offset, so
 * the service never has to do geodesy.
 */
@Repository
class RideRepository {

	/** Everything a ride view needs, for one viewer. */
	private static final String SELECT_RIDE = """
			select r.id, r.admin_id, a.display_name as admin_display_name, r.status, r.name, r.description,
				r.start_date, r.start_time, r.time_zone, r.starts_at,
				ST_Y(r.meeting_point) as meeting_lat, ST_X(r.meeting_point) as meeting_lon,
				ST_Y(area.centre) as area_lat, ST_X(area.centre) as area_lon,
				r.discipline, r.pace, r.participant_limit, r.access_mode, r.target_distance_km,
				ST_AsGeoJSON(r.route_geometry) as route_geometry, r.distance_meters, r.ascend_meters,
				r.elevation_profile::text as elevation_profile, r.surfaces::text as surfaces, r.age_rating,
				r.cancel_message,
				(select count(*) from ride_participants p where p.ride_id = r.id) as places_taken,
				(select p.status from ride_participants p where p.ride_id = r.id and p.user_id = :viewerId)
					as viewer_status
			from rides r
			left join users a on a.id = r.admin_id
			cross join lateral (select ST_Project(r.meeting_point::geography, r.meeting_area_offset_meters,
				radians(r.meeting_area_bearing_degrees))::geometry as centre) area
			""";

	private final JdbcClient jdbc;

	RideRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	void insert(UUID id, UUID adminId, Details details, RouteCopy route, double areaOffsetMeters,
			double areaBearingDegrees, Instant now) {
		jdbc.sql("""
				insert into rides (id, admin_id, status, name, description, start_date, start_time, time_zone,
					starts_at, meeting_point, meeting_area_offset_meters, meeting_area_bearing_degrees, discipline,
					pace, participant_limit, access_mode, target_distance_km, route_geometry, distance_meters,
					ascend_meters, elevation_profile, surfaces, age_rating, created_at, updated_at)
				values (:id, :adminId, 'DRAFT', :name, :description, cast(:startDate as date),
					cast(:startTime as time), :timeZone, cast(:startsAt as timestamptz),
					ST_SetSRID(ST_MakePoint(cast(:lon as double precision), cast(:lat as double precision)), 4326),
					:offset, :bearing, :discipline, :pace, cast(:participantLimit as integer), :accessMode,
					cast(:targetDistanceKm as double precision),
					ST_SetSRID(ST_GeomFromGeoJSON(cast(:geometry as text)), 4326),
					cast(:distance as double precision), cast(:ascend as double precision),
					cast(:profile as jsonb), cast(:surfaces as jsonb), :ageRating, :now, :now)""")
			.param("id", id)
			.param("adminId", adminId)
			.params(values(details))
			.params(values(route))
			.param("offset", areaOffsetMeters)
			.param("bearing", areaBearingDegrees)
			.param("now", Timestamp.from(now))
			.update();
	}

	/**
	 * Replaces the editable fields; the route copy is changed by {@link #updateRoute}.
	 */
	void updateDetails(UUID id, Details details, Instant now) {
		jdbc.sql("""
				update rides set name = :name, description = :description, start_date = cast(:startDate as date),
					start_time = cast(:startTime as time), time_zone = :timeZone,
					starts_at = cast(:startsAt as timestamptz),
					meeting_point = ST_SetSRID(ST_MakePoint(cast(:lon as double precision),
						cast(:lat as double precision)), 4326),
					discipline = :discipline, pace = :pace, participant_limit = cast(:participantLimit as integer),
					access_mode = :accessMode, target_distance_km = cast(:targetDistanceKm as double precision),
					age_rating = :ageRating, updated_at = :now
				where id = :id""").param("id", id).params(values(details)).param("now", Timestamp.from(now)).update();
	}

	/** Attaches, replaces or (with null) removes the ride's route copy. */
	void updateRoute(UUID id, RouteCopy route) {
		jdbc.sql("""
				update rides set route_geometry = ST_SetSRID(ST_GeomFromGeoJSON(cast(:geometry as text)), 4326),
					distance_meters = cast(:distance as double precision),
					ascend_meters = cast(:ascend as double precision), elevation_profile = cast(:profile as jsonb),
					surfaces = cast(:surfaces as jsonb)
				where id = :id""").param("id", id).params(values(route)).update();
	}

	/** Locks the ride row until the end of the transaction. */
	boolean lock(UUID id) {
		return jdbc.sql("select id from rides where id = :id for update")
			.param("id", id)
			.query()
			.listOfRows()
			.size() == 1;
	}

	Optional<RideRow> find(UUID id, UUID viewerId) {
		return jdbc.sql(SELECT_RIDE + "where r.id = :id")
			.param("id", id)
			.param("viewerId", viewerId)
			.query(RideRepository::rideRow)
			.optional();
	}

	/**
	 * Rides the rider administers (drafts included) or holds a place on (published or
	 * cancelled only), unordered.
	 */
	List<RideRow> findMine(UUID userId) {
		return jdbc.sql(SELECT_RIDE + """
				where r.admin_id = :viewerId
					or (r.status <> 'DRAFT' and exists (select 1 from ride_participants p
						where p.ride_id = r.id and p.user_id = :viewerId))""")
			.param("viewerId", userId)
			.query(RideRepository::rideRow)
			.list();
	}

	/** Exactly one boundary has to contain the whole line (elevation is ignored). */
	boolean isInsideOneCity(String lineGeoJson) {
		return Boolean.TRUE.equals(jdbc.sql("""
				select exists (select 1 from city_boundaries b
					where ST_Within(ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON(:geometry), 4326)), b.geom))""")
			.param("geometry", lineGeoJson)
			.query(Boolean.class)
			.single());
	}

	boolean isAdult(UUID userId) {
		return Boolean.TRUE
			.equals(jdbc.sql("select exists (select 1 from users where id = :id and adult_confirmed_at is not null)")
				.param("id", userId)
				.query(Boolean.class)
				.single());
	}

	/** Whether a participant other than {@code exceptUserId} has no 18+ confirmation. */
	boolean hasParticipantWithoutAdultConfirmation(UUID rideId, UUID exceptUserId) {
		return Boolean.TRUE.equals(jdbc.sql("""
				select exists (select 1 from ride_participants p join users u on u.id = p.user_id
					where p.ride_id = :rideId and p.user_id <> :exceptUserId and u.adult_confirmed_at is null)""")
			.param("rideId", rideId)
			.param("exceptUserId", exceptUserId)
			.query(Boolean.class)
			.single());
	}

	Optional<String> participantStatus(UUID rideId, UUID userId) {
		return jdbc.sql("select status from ride_participants where ride_id = :rideId and user_id = :userId")
			.param("rideId", rideId)
			.param("userId", userId)
			.query(String.class)
			.optional();
	}

	void addParticipant(UUID rideId, UUID userId, String status, Instant now) {
		jdbc.sql("""
				insert into ride_participants (ride_id, user_id, status, joined_at)
				values (:rideId, :userId, :status, :now)""")
			.param("rideId", rideId)
			.param("userId", userId)
			.param("status", status)
			.param("now", Timestamp.from(now))
			.update();
	}

	/** Confirmed participants other than the admin must confirm again. */
	void requireReconfirmation(UUID rideId, UUID adminId) {
		jdbc.sql("""
				update ride_participants set status = 'NEEDS_RECONFIRMATION'
				where ride_id = :rideId and user_id <> :adminId and status = 'CONFIRMED'""")
			.param("rideId", rideId)
			.param("adminId", adminId)
			.update();
	}

	void publish(UUID id, Instant now) {
		jdbc.sql("update rides set status = 'PUBLISHED', updated_at = :now where id = :id")
			.param("id", id)
			.param("now", Timestamp.from(now))
			.update();
	}

	void cancel(UUID id, String message, Instant now) {
		jdbc.sql("update rides set status = 'CANCELLED', cancel_message = :message, updated_at = :now where id = :id")
			.param("id", id)
			.param("message", message)
			.param("now", Timestamp.from(now))
			.update();
	}

	void setAdmin(UUID id, UUID adminId, Instant now) {
		jdbc.sql("update rides set admin_id = :adminId, updated_at = :now where id = :id")
			.param("id", id)
			.param("adminId", adminId)
			.param("now", Timestamp.from(now))
			.update();
	}

	void delete(UUID id) {
		jdbc.sql("delete from rides where id = :id").param("id", id).update();
	}

	// Account deletion

	void deleteDraftsOf(UUID adminId) {
		jdbc.sql("delete from rides where admin_id = :adminId and status = 'DRAFT'").param("adminId", adminId).update();
	}

	void cancelUpcomingOf(UUID adminId, Instant now) {
		jdbc.sql("""
				update rides set status = 'CANCELLED', cancel_message = null, updated_at = :now
				where admin_id = :adminId and status = 'PUBLISHED' and starts_at > :now""")
			.param("adminId", adminId)
			.param("now", Timestamp.from(now))
			.update();
	}

	void removeAdmin(UUID adminId) {
		jdbc.sql("update rides set admin_id = null where admin_id = :adminId").param("adminId", adminId).update();
	}

	void deleteParticipationOf(UUID userId) {
		jdbc.sql("delete from ride_participants where user_id = :userId").param("userId", userId).update();
	}

	// Retention

	/**
	 * Deletes rides (and with them their participants) that started before the cutoff,
	 * and drafts without a start that were last changed before it.
	 */
	int deleteOlderThan(Instant cutoff) {
		return jdbc.sql("""
				delete from rides
				where starts_at < :cutoff or (starts_at is null and updated_at < :cutoff)""")
			.param("cutoff", Timestamp.from(cutoff))
			.update();
	}

	private static Map<String, Object> values(Details details) {
		Map<String, Object> values = new HashMap<>();
		values.put("name", details.name());
		values.put("description", details.description());
		values.put("startDate", details.startDate());
		values.put("startTime", details.startTime());
		values.put("timeZone", details.timeZone());
		values.put("startsAt", (details.startsAt() != null) ? Timestamp.from(details.startsAt()) : null);
		values.put("lat", details.meetingLat());
		values.put("lon", details.meetingLon());
		values.put("discipline", details.discipline());
		values.put("pace", details.pace());
		values.put("participantLimit", details.participantLimit());
		values.put("accessMode", details.accessMode());
		values.put("targetDistanceKm", details.targetDistanceKm());
		values.put("ageRating", details.ageRating());
		return values;
	}

	private static Map<String, Object> values(RouteCopy route) {
		Map<String, Object> values = new HashMap<>();
		values.put("geometry", (route != null) ? route.geometryJson() : null);
		values.put("distance", (route != null) ? route.distanceMeters() : null);
		values.put("ascend", (route != null) ? route.ascendMeters() : null);
		values.put("profile", (route != null) ? route.elevationProfileJson() : null);
		values.put("surfaces", (route != null) ? route.surfacesJson() : null);
		return values;
	}

	private static RideRow rideRow(ResultSet rs, int row) throws SQLException {
		Timestamp startsAt = rs.getTimestamp("starts_at");
		String geometry = rs.getString("route_geometry");
		return new RideRow(rs.getObject("id", UUID.class), rs.getObject("admin_id", UUID.class),
				rs.getString("admin_display_name"), rs.getString("status"),
				new Details(rs.getString("name"), rs.getString("description"),
						rs.getObject("start_date", LocalDate.class), rs.getObject("start_time", LocalTime.class),
						rs.getString("time_zone"), (startsAt != null) ? startsAt.toInstant() : null,
						rs.getObject("meeting_lat", Double.class), rs.getObject("meeting_lon", Double.class),
						rs.getString("discipline"), rs.getString("pace"),
						rs.getObject("participant_limit", Integer.class), rs.getString("access_mode"),
						rs.getObject("target_distance_km", Double.class), rs.getString("age_rating")),
				(geometry != null) ? new RouteCopy(geometry, rs.getDouble("distance_meters"),
						rs.getObject("ascend_meters", Double.class), rs.getString("elevation_profile"),
						rs.getString("surfaces")) : null,
				rs.getObject("area_lat", Double.class), rs.getObject("area_lon", Double.class),
				rs.getString("cancel_message"), rs.getInt("places_taken"), rs.getString("viewer_status"));
	}

	/** The editable fields of a ride, plus the derived start instant and age rating. */
	record Details(String name, String description, LocalDate startDate, LocalTime startTime, String timeZone,
			Instant startsAt, Double meetingLat, Double meetingLon, String discipline, String pace,
			Integer participantLimit, String accessMode, Double targetDistanceKm, String ageRating) {

	}

	/** The ride's own copy of a route; JSON columns as text. */
	record RouteCopy(String geometryJson, double distanceMeters, Double ascendMeters, String elevationProfileJson,
			String surfacesJson) {

	}

	/**
	 * A ride as stored, seen by one viewer. Holds exact coordinates: the service decides
	 * what may leave the server.
	 *
	 * @param placesTaken participants holding a place (the admin included)
	 * @param viewerStatus the viewer's participant status, null if not a participant
	 */
	record RideRow(UUID id, UUID adminId, String adminDisplayName, String status, Details details, RouteCopy route,
			Double areaLat, Double areaLon, String cancelMessage, int placesTaken, String viewerStatus) {

	}

}
