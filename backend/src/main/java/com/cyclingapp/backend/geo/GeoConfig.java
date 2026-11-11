package com.cyclingapp.backend.geo;

import java.net.URI;
import java.net.http.HttpClient;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

/** HTTP clients for GraphHopper and Photon, both with short timeouts. */
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(GeoProperties.class)
class GeoConfig {

	@Bean
	RestClient graphhopperClient(GeoProperties properties) {
		return client(properties.graphhopperUrl(), properties);
	}

	@Bean
	RestClient photonClient(GeoProperties properties) {
		return client(properties.photonUrl(), properties);
	}

	private static RestClient client(URI baseUrl, GeoProperties properties) {
		HttpClient http = HttpClient.newBuilder()
			.connectTimeout(properties.timeout())
			.followRedirects(HttpClient.Redirect.NEVER)
			.build();
		JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(http);
		factory.setReadTimeout(properties.timeout());
		return RestClient.builder().baseUrl(baseUrl.toString()).requestFactory(factory).build();
	}

}
