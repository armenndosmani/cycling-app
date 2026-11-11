-- Saved routes of the route planner (docs/specs/route-planner.md). Always private drafts:
-- every query filters by user_id.
-- Personal data: route points and geometry (can reveal where a rider lives or works), name
-- and note. Retention: until the rider deletes the route or the account (deleted
-- immediately; backups expire within 30 days).
create table saved_routes (
	id uuid primary key,
	user_id uuid not null references users (id) on delete cascade,
	name varchar(80) not null,
	note varchar(1000),
	discipline varchar(10) not null,
	-- Points picked by the rider: [{"lat": ..., "lon": ...}, ...] (start, waypoints,
	-- destination)
	points jsonb not null,
	-- Calculated route: a line in WGS 84 (SRID 4326), with elevation as Z when available.
	-- No type modifier, because it would fix the line to either 2D or 3D; checked below.
	geometry geometry not null,
	distance_meters double precision not null,
	-- Null when there is no elevation data
	ascend_meters double precision,
	-- [[distanceMeters, elevationMeters], ...], null without elevation data
	elevation_profile jsonb,
	-- [{"surface": "asphalt", "meters": ...}, ...]
	surfaces jsonb not null,
	created_at timestamptz not null,
	updated_at timestamptz not null,
	constraint saved_routes_discipline_check check (discipline in ('ROAD', 'GRAVEL', 'MTB', 'URBAN')),
	constraint saved_routes_geometry_check check (ST_SRID(geometry) = 4326 and GeometryType(geometry) = 'LINESTRING')
);

create index saved_routes_user_id_updated_at_idx on saved_routes (user_id, updated_at desc);
