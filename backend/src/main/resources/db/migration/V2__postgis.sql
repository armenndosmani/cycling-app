-- PostGIS for route geometry and spatial queries (docs/decisions.md, 2026-11-11).
-- Creating the extension needs a database role that is allowed to (superuser, or the
-- extension created beforehand by an admin); see docs/launch-checklist.md.
create extension if not exists postgis;
