#!/usr/bin/env bash
# Loads the city boundaries extracted by download-dev-data.sh (data/boundaries/
# cities.geojsonseq) into the development database's city_boundaries table, which the
# backend uses for the rides' age rating (16+ inside one city, otherwise 18+). Replaces
# whatever was loaded before. See README.md.
#
# Needs the Postgres container from compose.yaml running (it starts with
# ./mvnw spring-boot:run) and the database migrated (start the backend once).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FILE="$SCRIPT_DIR/data/boundaries/cities.geojsonseq"
cd "$SCRIPT_DIR/.."

if [ ! -f "$FILE" ]; then
	echo "No $FILE; run ./geo/download-dev-data.sh first" >&2
	exit 1
fi
if [ -z "$(docker compose ps -q postgres 2>/dev/null)" ]; then
	echo "The postgres container is not running; start the backend (./mvnw spring-boot:run) first" >&2
	exit 1
fi

psql() {
	docker compose exec -T postgres sh -c 'psql -X -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"' psql "$@"
}

if [ "$(psql -At -c "select to_regclass('city_boundaries') is not null")" != "t" ]; then
	echo "Table city_boundaries does not exist yet; start the backend once so Flyway migrates the database" >&2
	exit 1
fi

# One GeoJSON feature per line. CSV with control characters as quote and delimiter, so
# the JSON is read as it is (no escaping).
{
	cat <<'SQL'
begin;
create temporary table city_import (feature jsonb) on commit drop;
copy city_import from stdin with (format csv, quote e'\x01', delimiter e'\x02');
SQL
	cat "$FILE"
	printf '\.\n'
	cat <<'SQL'
delete from city_boundaries;
insert into city_boundaries (name, osm_id, geom)
select left(feature -> 'properties' ->> 'name', 200), (feature -> 'properties' ->> '@id')::bigint,
	ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(feature ->> 'geometry'), 4326)), 3))
from city_import
where feature -> 'properties' ->> '@type' = 'relation';
commit;
SQL
} | psql

echo "City boundaries loaded:"
psql -c "select osm_id, name, round((ST_Area(geom::geography) / 1e6)::numeric, 1) as km2 from city_boundaries order by name"
