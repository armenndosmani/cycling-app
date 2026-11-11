#!/usr/bin/env bash
# Downloads the development map data for the local geo stack (see README.md) into
# backend/geo/data/ (git-ignored):
#   data/osm/region.osm.pbf       OpenStreetMap extract (Geofabrik), imported by GraphHopper
#   data/photon/photon_data/      ready-to-use Photon database (GraphHopper's Photon dumps)
#   data/tiles/basemap.pmtiles    Protomaps basemap cut to the region, served by Martin
#   data/assets/fonts, sprites    map fonts (glyphs) and the dark sprite sheet, so the app
#                                 loads nothing from third parties at runtime
#   data/boundaries/cities.geojsonseq
#                                 city boundaries cut from the OSM extract, for the rides'
#                                 age rating; load them with ./geo/load-city-boundaries.sh
#
# Works in Git Bash on Windows, and on Linux and macOS. Needs curl, tar with bzip2, and
# Docker (pmtiles and osmium run in containers). Re-running skips files that already
# exist; pass --force to download everything again.
#
# The region is Luxembourg: small (about 46 MB of OSM data), with a real city boundary
# (Luxembourg City) for the "urban ride" check, hills, and gravel and MTB tracks. To use
# another region, change the four values below (Photon dumps exist per country, see
# https://download1.graphhopper.com/public/) and delete data/graphhopper.
set -euo pipefail

REGION=luxembourg
OSM_URL=https://download.geofabrik.de/europe/luxembourg-latest.osm.pbf
PHOTON_URL=https://download1.graphhopper.com/public/europe/luxemburg/photon-db-luxemburg-1.0-latest.tar.bz2
# min lon, min lat, max lon, max lat (from Geofabrik's luxembourg.poly, rounded outwards)
BBOX=5.73,49.44,6.54,50.19

PMTILES_IMAGE=protomaps/go-pmtiles:v1.31.2
PROTOMAPS_BUILDS=https://build-metadata.protomaps.dev/builds.json
PROTOMAPS_BASE=https://build.protomaps.com
# Fonts (SIL OFL) and sprites (derived from MIT-licensed tangrams/icons) for the Protomaps
# basemap styles, pinned to a commit. Sprites v4 match basemap tiles 4.x.
ASSETS_COMMIT=028c18f713baecad011301ff7a69acc39bcc2ae7
ASSETS_URL=https://github.com/protomaps/basemaps-assets/archive/$ASSETS_COMMIT.tar.gz
ASSETS_FONTS=("Noto Sans Regular" "Noto Sans Medium" "Noto Sans Italic")
ASSETS_SPRITES=dark
# osmium-tool image built from boundaries/Dockerfile, for the city boundaries
OSMIUM_IMAGE=cycling-dev/osmium:1.18

FORCE=false
if [ "${1:-}" = "--force" ]; then
	FORCE=true
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA="$SCRIPT_DIR/data"
mkdir -p "$DATA/osm" "$DATA/photon" "$DATA/tiles" "$DATA/graphhopper" "$DATA/srtm" "$DATA/assets"

needed() {
	[ "$FORCE" = true ] || [ ! -e "$1" ]
}

seconds() {
	date +%s
}

echo "Region: $REGION (bbox $BBOX)"

# 1. OpenStreetMap extract for GraphHopper
if needed "$DATA/osm/region.osm.pbf"; then
	echo "Downloading the OpenStreetMap extract..."
	start=$(seconds)
	curl -fL --progress-bar --retry 3 -o "$DATA/osm/region.osm.pbf.part" "$OSM_URL"
	mv "$DATA/osm/region.osm.pbf.part" "$DATA/osm/region.osm.pbf"
	echo "  done in $(($(seconds) - start)) s"
	# A new extract needs a new graph and new city boundaries
	rm -rf "$DATA/graphhopper" "$DATA/boundaries/cities.geojsonseq"
	mkdir -p "$DATA/graphhopper"
else
	echo "OpenStreetMap extract exists, skipping"
fi

# 2. Photon database (ready to serve, no import needed)
if needed "$DATA/photon/photon_data"; then
	echo "Downloading and unpacking the Photon database..."
	start=$(seconds)
	rm -rf "$DATA/photon/photon_data" "$DATA/photon/unpack"
	mkdir -p "$DATA/photon/unpack"
	curl -fL --progress-bar --retry 3 "$PHOTON_URL" | tar -xjf - -C "$DATA/photon/unpack"
	# Never unpack over an existing database (Photon docs): unpack aside, then move
	mv "$DATA/photon/unpack/photon_data" "$DATA/photon/photon_data"
	rm -rf "$DATA/photon/unpack"
	echo "  done in $(($(seconds) - start)) s"
else
	echo "Photon database exists, skipping"
fi

# 3. Map tiles: cut the region out of the latest Protomaps daily planet build. pmtiles
# reads only the needed byte ranges, it does not download the whole planet.
if needed "$DATA/tiles/basemap.pmtiles"; then
	echo "Finding the latest Protomaps build..."
	build=$(curl -fsSL "$PROTOMAPS_BUILDS" | grep -o '"key":"[0-9]\{8\}\.pmtiles"' | sed 's/.*"\([0-9]\{8\}\.pmtiles\)"/\1/' | sort | tail -n 1)
	if [ -z "$build" ]; then
		echo "Could not find a Protomaps build in $PROTOMAPS_BUILDS" >&2
		exit 1
	fi
	echo "Extracting tiles from $build..."
	start=$(seconds)
	tiles_dir="$DATA/tiles"
	# Git Bash: give Docker a Windows path and stop MSYS from rewriting arguments
	if pwd -W >/dev/null 2>&1; then
		tiles_dir="$(cd "$tiles_dir" && pwd -W)"
	fi
	rm -f "$DATA/tiles/basemap.pmtiles"
	MSYS_NO_PATHCONV=1 docker run --rm -v "$tiles_dir:/out" "$PMTILES_IMAGE" \
		extract "$PROTOMAPS_BASE/$build" /out/basemap.pmtiles --bbox="$BBOX"
	echo "  done in $(($(seconds) - start)) s"
else
	echo "Map tiles exist, skipping"
fi

# 4. Fonts and sprites for the map style
if needed "$DATA/assets/fonts"; then
	echo "Downloading map fonts and sprites..."
	start=$(seconds)
	rm -rf "$DATA/assets/fonts" "$DATA/assets/sprites" "$DATA/assets/unpack"
	mkdir -p "$DATA/assets/unpack" "$DATA/assets/fonts" "$DATA/assets/sprites"
	curl -fsSL --retry 3 "$ASSETS_URL" | tar -xzf - -C "$DATA/assets/unpack"
	src="$DATA/assets/unpack/basemaps-assets-$ASSETS_COMMIT"
	for font in "${ASSETS_FONTS[@]}"; do
		cp -R "$src/fonts/$font" "$DATA/assets/fonts/"
	done
	cp "$src/fonts/OFL.txt" "$DATA/assets/fonts/"
	cp "$src/sprites/v4/$ASSETS_SPRITES".* "$src/sprites/v4/$ASSETS_SPRITES"@2x.* "$DATA/assets/sprites/"
	rm -rf "$DATA/assets/unpack"
	echo "  done in $(($(seconds) - start)) s"
else
	echo "Map fonts and sprites exist, skipping"
fi

# 5. City boundaries for the rides' age rating, cut from the OSM extract with osmium
# (boundaries/extract-cities.sh has the definition of "city"). Loaded into the database
# separately with load-city-boundaries.sh, because the database may not be running yet.
if needed "$DATA/boundaries/cities.geojsonseq"; then
	echo "Extracting city boundaries..."
	start=$(seconds)
	mkdir -p "$DATA/boundaries"
	docker build -q -t "$OSMIUM_IMAGE" "$SCRIPT_DIR/boundaries" >/dev/null
	data_dir="$DATA"
	if pwd -W >/dev/null 2>&1; then
		data_dir="$(cd "$data_dir" && pwd -W)"
	fi
	MSYS_NO_PATHCONV=1 docker run --rm -v "$data_dir:/data" "$OSMIUM_IMAGE"
	echo "  done in $(($(seconds) - start)) s"
else
	echo "City boundaries exist, skipping"
fi

echo
echo "Data in $DATA:"
du -sh "$DATA/osm" "$DATA/photon" "$DATA/tiles" "$DATA/assets" "$DATA/boundaries" 2>/dev/null || true
echo
echo "Load the city boundaries into the dev database (Postgres running, backend started once):"
echo "  ./geo/load-city-boundaries.sh"
echo "Start the geo services (from backend/): docker compose --profile geo up -d"
echo "The first GraphHopper start imports the extract and downloads elevation tiles (a few minutes)."
