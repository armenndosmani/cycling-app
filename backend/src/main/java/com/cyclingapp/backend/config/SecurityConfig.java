package com.cyclingapp.backend.config;

import com.cyclingapp.backend.web.ProblemResponses;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.server.resource.web.BearerTokenResolver;
import org.springframework.security.oauth2.server.resource.web.DefaultBearerTokenResolver;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter.ReferrerPolicy;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;
import org.springframework.security.web.util.matcher.OrRequestMatcher;
import org.springframework.security.web.util.matcher.RequestMatcher;

/**
 * Secure by default: every endpoint is closed unless it is listed here. Closed endpoints
 * need a valid access token (a JWT from the sign-in endpoints, see
 * {@code auth/JwtConfig}); without one they answer 401. New endpoints stay closed until a
 * feature opens them with an explicit rule.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

	/** Sign-in endpoints that work without an access token. */
	private static final RequestMatcher PUBLIC_AUTH_ENDPOINTS = new OrRequestMatcher(
			PathPatternRequestMatcher.withDefaults().matcher(HttpMethod.POST, "/api/auth/email/code"),
			PathPatternRequestMatcher.withDefaults().matcher(HttpMethod.POST, "/api/auth/email/verify"),
			PathPatternRequestMatcher.withDefaults().matcher(HttpMethod.POST, "/api/auth/refresh"));

	private static final AuthenticationEntryPoint UNAUTHORIZED = (request, response, ex) -> ProblemResponses
		.write(response, HttpStatus.UNAUTHORIZED, "Authentication is required.");

	private static final AccessDeniedHandler FORBIDDEN = (request, response, ex) -> ProblemResponses.write(response,
			HttpStatus.FORBIDDEN, "You are not allowed to do this.");

	@Bean
	SecurityFilterChain securityFilterChain(HttpSecurity http, Environment environment) throws Exception {
		boolean dev = environment.matchesProfiles("dev");

		http.authorizeHttpRequests(auth -> {
			auth.requestMatchers("/actuator/health", "/actuator/health/**").permitAll();
			auth.requestMatchers(PUBLIC_AUTH_ENDPOINTS).permitAll();
			// Spring's error page, so errors from open endpoints are not turned into 401s
			auth.requestMatchers("/error").permitAll();
			if (dev) {
				auth.requestMatchers("/v3/api-docs/**", "/swagger-ui.html", "/swagger-ui/**").permitAll();
			}
			// Route planner (docs/specs/route-planner.md): signed-in riders only; saved
			// routes
			// are further limited to their owner in the queries
			auth.requestMatchers("/api/routing/**", "/api/places", "/api/routes", "/api/routes/**").authenticated();
			// Rides (docs/specs/ride-event-creation.md): signed-in riders only; who may
			// see or
			// change a ride is checked per ride in RideService
			auth.requestMatchers("/api/rides", "/api/rides/**").authenticated();
			auth.anyRequest().authenticated();
		})
			// Access tokens: "Authorization: Bearer <jwt>"
			.oauth2ResourceServer(oauth2 -> oauth2.bearerTokenResolver(bearerTokenResolver()).jwt(jwt -> {
			}).authenticationEntryPoint(UNAUTHORIZED).accessDeniedHandler(FORBIDDEN))
			// Stateless API for the mobile app: no sessions, no cookies, no login form
			.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
			.csrf(csrf -> csrf.disable())
			.formLogin(form -> form.disable())
			.httpBasic(basic -> basic.disable())
			.logout(logout -> logout.disable())
			.requestCache(cache -> cache.disable())
			.headers(headers -> headers.referrerPolicy(referrer -> referrer.policy(ReferrerPolicy.NO_REFERRER)))
			.exceptionHandling(errors -> errors.authenticationEntryPoint(UNAUTHORIZED).accessDeniedHandler(FORBIDDEN));

		return http.build();
	}

	/**
	 * The public sign-in endpoints ignore any access token, so an expired one sent along
	 * by the app cannot block signing in or refreshing.
	 */
	private static BearerTokenResolver bearerTokenResolver() {
		DefaultBearerTokenResolver header = new DefaultBearerTokenResolver();
		return request -> PUBLIC_AUTH_ENDPOINTS.matches(request) ? null : header.resolve(request);
	}

}
