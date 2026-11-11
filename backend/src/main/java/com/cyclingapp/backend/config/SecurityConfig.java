package com.cyclingapp.backend.config;

import com.cyclingapp.backend.web.ProblemResponses;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter.ReferrerPolicy;

/**
 * Secure by default: every endpoint is closed unless it is listed here. There is no login
 * yet, so closed endpoints answer 401 to everyone. New endpoints stay closed until a
 * feature opens them with an explicit rule.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

	@Bean
	SecurityFilterChain securityFilterChain(HttpSecurity http, Environment environment) throws Exception {
		boolean dev = environment.matchesProfiles("dev");

		http.authorizeHttpRequests(auth -> {
			auth.requestMatchers("/actuator/health", "/actuator/health/**").permitAll();
			// Spring's error page, so errors from open endpoints are not turned into 401s
			auth.requestMatchers("/error").permitAll();
			if (dev) {
				auth.requestMatchers("/v3/api-docs/**", "/swagger-ui.html", "/swagger-ui/**").permitAll();
			}
			auth.anyRequest().authenticated();
		})
			// Stateless API for the mobile app: no sessions, no cookies, no login form
			.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
			.csrf(csrf -> csrf.disable())
			.formLogin(form -> form.disable())
			.httpBasic(basic -> basic.disable())
			.logout(logout -> logout.disable())
			.requestCache(cache -> cache.disable())
			.headers(headers -> headers.referrerPolicy(referrer -> referrer.policy(ReferrerPolicy.NO_REFERRER)))
			.exceptionHandling(errors -> errors
				.authenticationEntryPoint((request, response, ex) -> ProblemResponses.write(response,
						HttpStatus.UNAUTHORIZED, "Authentication is required."))
				.accessDeniedHandler((request, response, ex) -> ProblemResponses.write(response, HttpStatus.FORBIDDEN,
						"You are not allowed to do this.")));

		return http.build();
	}

}
