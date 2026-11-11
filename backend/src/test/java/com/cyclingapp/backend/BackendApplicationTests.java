package com.cyclingapp.backend;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
class BackendApplicationTests {

	@Autowired
	private JdbcTemplate jdbc;

	@Test
	void contextLoads() {
	}

	@Test
	void postgisIsEnabledByTheMigrations() {
		assertThat(jdbc.queryForObject("select extversion from pg_extension where extname = 'postgis'", String.class))
			.startsWith("3.");
	}

}
