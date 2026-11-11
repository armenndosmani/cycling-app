package com.cyclingapp.backend;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.concurrent.atomic.AtomicInteger;

import com.jayway.jsonpath.JsonPath;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * Calls the sign-in endpoints like the app does. Every test uses its own fake email and
 * IP address, so the in-memory rate limits of one test do not affect another.
 */
class AuthTestClient {

	private static final AtomicInteger counter = new AtomicInteger();

	private final MockMvc mvc;

	private final CapturingMailSender mail;

	final String ip;

	AuthTestClient(MockMvc mvc, CapturingMailSender mail) {
		this.mvc = mvc;
		this.mail = mail;
		int n = counter.incrementAndGet();
		this.ip = "10.0.%d.%d".formatted(n / 250, n % 250 + 1);
	}

	static String newEmail() {
		return "rider-" + counter.incrementAndGet() + "@example.test";
	}

	MockHttpServletRequestBuilder fromIp(MockHttpServletRequestBuilder request) {
		return request.with(r -> {
			r.setRemoteAddr(ip);
			return r;
		});
	}

	ResultActions requestCode(String email) throws Exception {
		return mvc.perform(fromIp(post("/api/auth/email/code")).contentType(MediaType.APPLICATION_JSON)
			.content("{\"email\":\"%s\"}".formatted(email)));
	}

	ResultActions verify(String email, String code) throws Exception {
		return verify("{\"email\":\"%s\",\"code\":\"%s\"}".formatted(email, code));
	}

	ResultActions verifyWithConfirmations(String email, String code, boolean confirmAge16, String termsVersion)
			throws Exception {
		return verify("{\"email\":\"%s\",\"code\":\"%s\",\"confirmAge16\":%s,\"acceptTermsVersion\":\"%s\"}"
			.formatted(email, code, confirmAge16, termsVersion));
	}

	ResultActions verify(String json) throws Exception {
		return mvc
			.perform(fromIp(post("/api/auth/email/verify")).contentType(MediaType.APPLICATION_JSON).content(json));
	}

	ResultActions refresh(String refreshToken) throws Exception {
		return mvc.perform(fromIp(post("/api/auth/refresh")).contentType(MediaType.APPLICATION_JSON)
			.content("{\"refreshToken\":\"%s\"}".formatted(refreshToken)));
	}

	ResultActions getMe(String accessToken) throws Exception {
		return mvc.perform(withToken(get("/api/me"), accessToken));
	}

	MockHttpServletRequestBuilder withToken(MockHttpServletRequestBuilder request, String accessToken) {
		return fromIp(request).header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken);
	}

	String codeSentTo(String email) {
		return mail.lastCodeTo(email);
	}

	/** Creates a new account and returns its tokens. */
	Tokens signUp(String email) throws Exception {
		requestCode(email).andExpect(status().isAccepted());
		String body = verifyWithConfirmations(email, codeSentTo(email), true, "draft-1").andExpect(status().isOk())
			.andReturn()
			.getResponse()
			.getContentAsString();
		return Tokens.from(body);
	}

	/** Signs in to an existing account and returns its tokens. */
	Tokens signIn(String email) throws Exception {
		requestCode(email).andExpect(status().isAccepted());
		String body = verify(email, codeSentTo(email)).andExpect(status().isOk())
			.andReturn()
			.getResponse()
			.getContentAsString();
		return Tokens.from(body);
	}

	record Tokens(String accessToken, String refreshToken) {

		static Tokens from(String body) {
			return new Tokens(JsonPath.read(body, "$.accessToken"), JsonPath.read(body, "$.refreshToken"));
		}

	}

}
