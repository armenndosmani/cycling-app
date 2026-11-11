package com.cyclingapp.backend.geo;

import java.net.URI;
import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Self-hosted routing and place search (docs/decisions.md). Defaults match the local geo
 * stack in {@code backend/geo}.
 *
 * @param graphhopperUrl base URL of the GraphHopper server
 * @param photonUrl base URL of the Photon server
 * @param timeout connect and read timeout for both
 */
@ConfigurationProperties("app.geo")
public record GeoProperties(@DefaultValue("http://localhost:8989") URI graphhopperUrl,
		@DefaultValue("http://localhost:2322") URI photonUrl, @DefaultValue("5s") Duration timeout) {

}
