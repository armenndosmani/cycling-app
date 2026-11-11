# osmium-tool for extracting city boundaries from the OSM extract (see ../README.md).
# osmium-tool comes from Debian trixie (1.18.x); the base image is pinned to a dated tag.
FROM debian:trixie-20261020-slim

RUN apt-get update \
	&& apt-get install -y --no-install-recommends osmium-tool \
	&& rm -rf /var/lib/apt/lists/*
COPY extract-cities.sh /usr/local/bin/extract-cities.sh
RUN chmod a+rx /usr/local/bin/extract-cities.sh

# Non-root; /data (OSM extract in, boundaries out) is a bind mount
USER nobody
WORKDIR /tmp
ENTRYPOINT ["/usr/local/bin/extract-cities.sh"]
