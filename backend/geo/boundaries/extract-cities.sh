#!/bin/sh
# Runs inside the boundaries container. Reads /data/osm/region.osm.pbf and writes the
# boundaries of cities as GeoJSON text sequence (one feature per line) to
# /data/boundaries/cities.geojsonseq.
#
# A city is an OpenStreetMap administrative boundary relation (boundary=administrative)
# for which one of these holds:
#   1. the relation itself is tagged place=city
#   2. its "label" member node is tagged place=city
#   3. its "admin_centre" member node is tagged place=city and has the same name as the
#      relation (so the canton or country whose capital is the city does not count).
#      Luxembourg City is mapped this way.
set -eu

in=/data/osm/region.osm.pbf
out=/data/boundaries/cities.geojsonseq
work=$(mktemp -d)

osmium tags-filter --no-progress "$in" r/boundary=administrative -o "$work/admin.osm.pbf"
# Member nodes tagged place=city, and all boundary relations, as OPL text: one object per
# line, tags after " T", members after " M" (special characters are %-escaped, so commas
# and spaces only separate)
osmium tags-filter --no-progress "$work/admin.osm.pbf" n/place=city -R -f opl -o "$work/city-nodes.opl"
osmium cat --no-progress "$work/admin.osm.pbf" -t relation -f opl -o "$work/relations.opl"

awk '
function field(prefix,   i) {
	for (i = 2; i <= NF; i++) if (substr($i, 1, 1) == prefix) return substr($i, 2)
	return ""
}
function tag(tags, key,   n, i, kv) {
	n = split(tags, kv, ",")
	for (i = 1; i <= n; i++) if (index(kv[i], key "=") == 1) return substr(kv[i], length(key) + 2)
	return ""
}
FNR == NR { city[$1] = tag(field("T"), "name"); next }
{
	tags = field("T"); name = tag(tags, "name")
	ok = (tag(tags, "place") == "city")
	n = split(field("M"), members, ",")
	for (i = 1; i <= n; i++) {
		split(members[i], ref, "@")
		if (!(ref[1] in city)) continue
		if (ref[2] == "label") ok = 1
		if (ref[2] == "admin_centre" && name != "" && city[ref[1]] == name) ok = 1
	}
	if (ok) print $1
}' "$work/city-nodes.opl" "$work/relations.opl" > "$work/ids.txt"

echo "Cities found: $(wc -l < "$work/ids.txt")"
mkdir -p "$(dirname "$out")"
if [ -s "$work/ids.txt" ]; then
	# -r adds the members the relations need for their geometry; --remove-tags strips the
	# tags of those members, so subarea relations (city quarters) do not become areas too
	osmium getid --no-progress -r --remove-tags "$work/admin.osm.pbf" -i "$work/ids.txt" -o "$work/cities.osm.pbf"
	osmium export --no-progress "$work/cities.osm.pbf" --geometry-types=polygon -a type,id \
		-f geojsonseq -x print_record_separator=false --overwrite -o "$out.part"
else
	: > "$out.part"
fi
mv "$out.part" "$out"
rm -rf "$work"
