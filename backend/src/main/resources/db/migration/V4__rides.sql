-- Ride events (docs/specs/ride-event-creation.md).

-- City boundaries for the age rating: a ride is 16+ when its whole route lies inside one
-- of these polygons, otherwise 18+. Public OpenStreetMap data (ODbL), no personal data.
-- Loaded by an operator script (backend/geo/README.md), never by the app; the definition
-- of "city" is in the spec.
create table city_boundaries (
	id bigint generated always as identity primary key,
	name varchar(200),
	-- OSM relation id
	osm_id bigint not null unique,
	geom geometry(MultiPolygon, 4326) not null
);

create index city_boundaries_geom_idx on city_boundaries using gist (geom);

-- Personal data: who organises a ride (admin_id), when and where a group of identifiable
-- people will be (date, time, meeting point, route copy), name and description.
-- Retention: deleted 12 months after the start time by the retention job (RideRetention);
-- drafts without a start time 12 months after their last change. Account deletion
-- cancels the admin's upcoming rides, deletes their drafts and clears admin_id
-- (on delete set null).
create table rides (
	id uuid primary key,
	-- Null once the admin deleted their account
	admin_id uuid references users (id) on delete set null,
	-- Optional club reference (Club Pro, later); no clubs table yet
	club_id uuid,
	status varchar(10) not null,
	name varchar(80) not null,
	description varchar(2000),
	-- Local date and time at the meeting point, with its IANA time zone. starts_at is the
	-- same moment as an instant, for ordering and the "past" and "started" checks.
	start_date date,
	start_time time,
	time_zone varchar(64),
	starts_at timestamptz,
	meeting_point geometry(Point, 4326),
	-- Offset of the public meeting area's centre from the real meeting point: chosen once,
	-- at random, when the ride is created, so repeated requests return the same circle
	meeting_area_offset_meters double precision not null,
	meeting_area_bearing_degrees double precision not null,
	discipline varchar(10),
	pace varchar(10),
	participant_limit integer,
	access_mode varchar(12),
	-- Only for rides without a route ("about 60 km (planned)")
	target_distance_km double precision,
	-- The ride's own copy of a saved route: a line in WGS 84, elevation as Z when available
	route_geometry geometry,
	distance_meters double precision,
	ascend_meters double precision,
	elevation_profile jsonb,
	surfaces jsonb,
	-- Set by the server from the route: '16+' inside one city boundary, otherwise '18+'
	age_rating varchar(3) not null,
	cancel_message varchar(500),
	created_at timestamptz not null,
	updated_at timestamptz not null,
	constraint rides_status_check check (status in ('DRAFT', 'PUBLISHED', 'CANCELLED')),
	constraint rides_discipline_check check (discipline in ('ROAD', 'GRAVEL', 'MTB', 'URBAN')),
	constraint rides_pace_check check (pace in ('RELAXED', 'STEADY', 'FAST', 'MIXED')),
	constraint rides_access_mode_check check (access_mode in ('OPEN', 'APPROVAL', 'INVITE_ONLY')),
	constraint rides_age_rating_check check (age_rating in ('16+', '18+')),
	constraint rides_route_geometry_check check (route_geometry is null
		or (ST_SRID(route_geometry) = 4326 and GeometryType(route_geometry) = 'LINESTRING'))
);

create index rides_admin_id_idx on rides (admin_id);
create index rides_starts_at_idx on rides (starts_at);

-- Participants holding a place on a ride; the admin is one of them. Minimal for now:
-- joining, approval and invitations come with the peloton spec.
-- Personal data: who rides with whom. Retention: deleted with the ride (12 months after
-- the start) and with the rider's account.
create table ride_participants (
	ride_id uuid not null references rides (id) on delete cascade,
	user_id uuid not null references users (id) on delete cascade,
	-- NEEDS_RECONFIRMATION: the start moved by more than 1 hour; the rider keeps the place
	status varchar(25) not null,
	joined_at timestamptz not null,
	primary key (ride_id, user_id),
	constraint ride_participants_status_check check (status in ('CONFIRMED', 'NEEDS_RECONFIRMATION'))
);

create index ride_participants_user_id_idx on ride_participants (user_id);
