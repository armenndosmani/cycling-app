# GraphHopper routing server for local development (see ../README.md).
# Runs the official release jar; the checksum is the one GitHub publishes for the release asset.
FROM eclipse-temurin:25.0.5_8-jre-noble

ADD --checksum=sha256:8462f758d9ea49edaded557cec5c687a0a24f004ec371cd4daaeb0534824ea33 \
	https://github.com/graphhopper/graphhopper/releases/download/11.1/graphhopper-web-11.1.jar \
	/opt/graphhopper/graphhopper-web.jar
COPY config.yml /opt/graphhopper/config.yml
COPY custom_models /opt/graphhopper/custom_models
RUN chmod -R a+r /opt/graphhopper

# Non-root; /data (OSM extract, graph cache, elevation cache) is a bind mount
USER ubuntu
WORKDIR /opt/graphhopper
EXPOSE 8989
# The first start imports /data/osm/region.osm.pbf into /data/graphhopper (a few minutes),
# later starts load the graph from there. Delete /data/graphhopper to re-import.
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar graphhopper-web.jar server config.yml"]
