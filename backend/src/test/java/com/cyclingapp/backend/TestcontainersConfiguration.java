package com.cyclingapp.backend;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

@TestConfiguration(proxyBeanMethods = false)
class TestcontainersConfiguration {

	@Bean
	@ServiceConnection
	PostgreSQLContainer postgresContainer() {
		return new PostgreSQLContainer(DockerImageName.parse("postgres:18"));
	}

	// Emails are captured instead of sent, so tests can read codes and nothing reaches a
	// real inbox. Primary in case a profile also configures SMTP.
	@Bean
	@Primary
	CapturingMailSender capturingMailSender() {
		return new CapturingMailSender();
	}

}
