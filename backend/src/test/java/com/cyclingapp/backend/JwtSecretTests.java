package com.cyclingapp.backend;

import static org.assertj.core.api.Assertions.assertThat;

import com.cyclingapp.backend.auth.AuthProperties;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;

/**
 * Outside the dev profile and the tests there is no signing secret, and the app must not
 * start without a proper one.
 */
class JwtSecretTests {

	private final ApplicationContextRunner runner = new ApplicationContextRunner()
		.withUserConfiguration(AuthPropertiesConfiguration.class);

	@Test
	void failsToStartWithoutSecret() {
		runner.run(context -> assertThat(context).hasFailed());
	}

	@Test
	void failsToStartWithShortSecret() {
		runner.withPropertyValues("app.auth.jwt-secret=too-short-0123456789abcdef")
			.run(context -> assertThat(context).hasFailed());
	}

	@Test
	void startsWithSecretOfAtLeast32Bytes() {
		runner.withPropertyValues("app.auth.jwt-secret=" + "x".repeat(32))
			.run(context -> assertThat(context).hasNotFailed());
	}

	@Configuration(proxyBeanMethods = false)
	@EnableConfigurationProperties(AuthProperties.class)
	static class AuthPropertiesConfiguration {

	}

}
