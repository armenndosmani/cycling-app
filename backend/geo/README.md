# Local map stack (development only)

Self-hosted map tiles, routing and place search for development (decisions in
`docs/decisions.md`: Protomaps + Martin, GraphHopper, Photon, PostGIS). Nothing here calls a
third-party service at runtime; downloads happen once, when you fetch the data.

The services are in the Compose profile `geo`, so `./mvnw spring-boot:run` and the tests
never start them and CI does not need them. Postgres (with PostGIS) and Mailpit have no
profile and start with the backend as before.

## Start

From `backend/` (Git Bash on Windows, or any shell on Linux/macOS; needs Docker, curl, tar
and bzip2):

```bash
./geo/download-dev-data.sh          # about 250 MB, under a minute on a fast connection
docker compose --profile geo up -d  # first start: GraphHopper imports the extract (~30 s)
docker compose --profile geo down   # stop
```

Data goes to `backend/geo/data/` (git-ignored). Re-running the script skips what exists;
`--force` downloads everything again. After changing GraphHopper profiles or encoded values
in `graphhopper/config.yml`, delete `data/graphhopper` and start again to re-import.

The repo lives in OneDrive: consider excluding `backend/geo/data` from sync (it is only
downloaded data and a generated graph).

## What runs

All ports are bound to 127.0.0.1 only.

| Service | Port | What | Version |
|---|---|---|---|
| `map` | 3000 | Map gateway (nginx): tiles from Martin, fonts and sprites as static files | nginx 1.30.6, Martin 1.16.1 |
| `graphhopper` | 8989 | Routing, profiles `road`, `gravel`, `mtb`, `urban` | GraphHopper 11.1 (official jar) |
| `photon` | 2322 | Place search | Photon 1.3.0 (official jar) |
| `martin` | (internal) | Serves `data/tiles/basemap.pmtiles` | Martin 1.16.1 |

### Map URLs for the app's style

| What | URL |
|---|---|
| Tiles (TileJSON, vector source id `basemap`) | `http://<host>:3000/basemap` |
| Tiles directly | `http://<host>:3000/basemap/{z}/{x}/{y}` |
| Glyphs | `http://<host>:3000/font/{fontstack}/{range}` (fontstacks `Noto Sans Regular`, `Noto Sans Medium`, `Noto Sans Italic`; one font per request, no comma-separated stacks) |
| Sprites (Protomaps `dark` flavour, v4) | `http://<host>:3000/sprite/basemap-dark` (MapLibre adds `.json`, `.png`, `@2x.json`, `@2x.png`) |

The tiles are Protomaps basemap v4 (build version 4.x), so use a Protomaps v4 style
(`@protomaps/basemaps` 4.x, flavour `dark`). Martin can only build glyphs from TTF/OTF
files and sprites from SVG folders, while Protomaps publishes ready-made glyphs and sprite
sheets, so the gateway serves those as static files under Martin's URL pattern.

`<host>`: `localhost` from the iOS simulator, `10.0.2.2` from the Android emulator. A
physical phone cannot reach 127.0.0.1: on a trusted network start with
`GEO_MAP_BIND=0.0.0.0 docker compose --profile geo up -d` and use the computer's LAN
address, or on Android use `adb reverse tcp:3000 tcp:3000`.

### Examples

```bash
curl -s -X POST localhost:8989/route -H 'Content-Type: application/json' -d \
  '{"profile":"gravel","points":[[6.1319,49.6116],[6.0,49.75]],"points_encoded":false,
    "elevation":true,"instructions":false,"details":["surface"]}'
curl -s 'localhost:2322/api?q=Esch-sur-Alzette&limit=5&lat=49.61&lon=6.13'
curl -s localhost:3000/basemap
```

## Data

Development region: **Luxembourg**. One small country for everything: it contains a real
city with an OSM administrative boundary (Luxembourg City) for the planned "urban ride"
check, hills (about 130 to 570 m) and many gravel and MTB tracks. The launch region is not
decided yet (see `docs/launch-checklist.md`); to switch, change the values at the top of
`download-dev-data.sh`.

| Data | Source | Size |
|---|---|---|
| OSM extract | Geofabrik `luxembourg-latest.osm.pbf` | ~46 MB |
| Photon database | `photon-db-luxemburg-1.0-latest.tar.bz2` from GraphHopper's Photon dumps (download1.graphhopper.com), ready to serve, no import | ~64 MB download, ~89 MB unpacked |
| Map tiles | `pmtiles extract` of the latest Protomaps daily planet build (build.protomaps.com) cut to the bbox, zoom 0 to 15 | ~98 MB |
| Fonts and sprites | `protomaps/basemaps-assets` at a pinned commit | ~12 MB |
| GraphHopper graph | built on first start (4 CH profiles with elevation) | ~54 MB |
| Elevation | SRTM tiles downloaded by GraphHopper during the import | ~5 MB |

Memory while running: GraphHopper ~1.3 GB (heap limit 2 GB), Photon ~0.4 GB, Martin and
nginx under 50 MB. Plan for about 2 GB free RAM and 400 MB disk.

## Routing profiles

`graphhopper/config.yml` uses GraphHopper's built-in custom models (shipped in the jar):

- `road`: `racingbike.json` + `bike_elevation.json`
- `gravel`: `bike.json` + `bike_elevation.json` + our `custom_models/gravel.json` (paved
  and busy roads less attractive, so compacted/gravel/dirt surfaces and good tracks win
  more often; a starting point to tune)
- `mtb`: `mtb.json` + `bike_elevation.json`
- `urban`: `bike.json` + `bike_elevation.json` (city bike)

All four use contraction hierarchies (fast, no per-request custom models). The `surface`
encoded value is stored, so routes can return the `surface` path detail for the surface
breakdown.

## Licences and attribution

- **OpenStreetMap data** (tiles, routing, search): ODbL. The map must show
  "© OpenStreetMap contributors" (linked to https://www.openstreetmap.org/copyright).
- **Protomaps basemap tiles**: an ODbL Produced Work derived from OpenStreetMap (also
  Natural Earth, public domain); OSM attribution required. Protomaps asks not to hotlink
  its builds, which is why we extract and serve our own copy.
- **Fonts** (Noto Sans): SIL Open Font License 1.1 (`data/assets/fonts/OFL.txt`).
- **Sprites**: Protomaps, derived from MIT-licensed tangrams/icons.
- **Elevation**: NASA SRTM 3 arc-second (SRTM3, about 90 m), public domain (US government
  work, NASA/USGS); attribution is not required but courteous. GraphHopper downloads the
  tiles from the srtm.kurviger.de mirror during the import only. CGIAR SRTM was not used
  because its licence restricts commercial use.
- **Software**: GraphHopper and Photon Apache 2.0, Martin MIT/Apache 2.0, nginx BSD-2,
  go-pmtiles BSD-3.
- **Photon dumps**: built by GraphHopper from OSM data (ODbL).

Open legal questions are tracked in `docs/launch-checklist.md`.
