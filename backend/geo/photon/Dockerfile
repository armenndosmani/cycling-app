# Photon place search for local development (see ../README.md).
# Runs the official release jar; the checksum is the one GitHub publishes for the release asset.
FROM eclipse-temurin:25.0.5_8-jre-noble

ADD --checksum=sha256:a89707c0045e4807b2a1180e132e68e108d998709f48b6c94b98a6e281f571a5 \
	https://github.com/komoot/photon/releases/download/1.3.0/photon-1.3.0.jar \
	/opt/photon/photon.jar
RUN chmod a+r /opt/photon/photon.jar

# Non-root; /data/photon/photon_data is a bind mount (the unpacked Photon database dump)
USER ubuntu
WORKDIR /opt/photon
EXPOSE 2322
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar photon.jar serve -data-dir /data/photon -listen-ip 0.0.0.0 -listen-port 2322"]
