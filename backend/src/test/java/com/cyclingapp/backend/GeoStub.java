package com.cyclingapp.backend;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.springframework.test.context.DynamicPropertyRegistry;

/**
 * A fake GraphHopper ({@code POST /route}) and Photon ({@code GET /api}) on a local port,
 * using the JDK's built-in HTTP server. Tests set the response; the app talks to it over
 * real HTTP with its real timeouts. One server for all test classes, so they share one
 * Spring context.
 */
final class GeoStub {

	/** Shorter than the default 5 s, so timeout tests are quick. */
	static final long TIMEOUT_MILLIS = 1000;

	private static HttpServer server;

	private static volatile Reply routeReply = Reply.ok("{}");

	private static volatile Reply placesReply = Reply.ok("{\"features\":[]}");

	/** Bodies of the route requests and query strings of the search requests received. */
	static final List<String> routeRequests = new CopyOnWriteArrayList<>();

	static final List<String> placeQueries = new CopyOnWriteArrayList<>();

	private GeoStub() {
	}

	static void register(DynamicPropertyRegistry registry) {
		String url = url();
		registry.add("app.geo.graphhopper-url", () -> url);
		registry.add("app.geo.photon-url", () -> url);
		registry.add("app.geo.timeout", () -> TIMEOUT_MILLIS + "ms");
	}

	static void reset() {
		routeReply = Reply.ok("{}");
		placesReply = Reply.ok("{\"features\":[]}");
		routeRequests.clear();
		placeQueries.clear();
	}

	static void route(Reply reply) {
		routeReply = reply;
	}

	static void places(Reply reply) {
		placesReply = reply;
	}

	private static synchronized String url() {
		if (server == null) {
			try {
				server = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
			}
			catch (IOException ex) {
				throw new IllegalStateException(ex);
			}
			server.setExecutor(Executors.newCachedThreadPool(runnable -> {
				Thread thread = new Thread(runnable, "geo-stub");
				thread.setDaemon(true);
				return thread;
			}));
			server.createContext("/route", exchange -> {
				routeRequests.add(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
				send(exchange, routeReply);
			});
			server.createContext("/api", exchange -> {
				placeQueries.add(exchange.getRequestURI().getRawQuery());
				send(exchange, placesReply);
			});
			server.start();
		}
		return "http://127.0.0.1:" + server.getAddress().getPort();
	}

	private static void send(HttpExchange exchange, Reply reply) throws IOException {
		try (exchange) {
			if (reply.delayMillis() > 0) {
				Thread.sleep(reply.delayMillis());
			}
			byte[] body = reply.body().getBytes(StandardCharsets.UTF_8);
			exchange.getResponseHeaders().set("Content-Type", "application/json");
			exchange.sendResponseHeaders(reply.status(), body.length);
			try (OutputStream out = exchange.getResponseBody()) {
				out.write(body);
			}
		}
		catch (InterruptedException ex) {
			Thread.currentThread().interrupt();
		}
		catch (IOException ex) {
			// The client gave up (timeout tests)
		}
	}

	/** A GraphHopper route response. Fake coordinates only. */
	static String graphhopperRoute(double distance, double ascend, String coordinates, String surfaces) {
		return """
				{"hints":{},"info":{"copyrights":["GraphHopper","OpenStreetMap contributors"],"took":3},
				 "paths":[{"distance":%s,"weight":1.0,"time":1000,"ascend":%s,"descend":1.0,"points_encoded":false,
				  "points":{"type":"LineString","coordinates":%s},"details":{"surface":%s}}]}""".formatted(distance,
				ascend, coordinates, surfaces);
	}

	/** A short fake route: three points going east, with elevation. */
	static final String SIMPLE_ROUTE = graphhopperRoute(790.0, 10.0,
			"[[10.0,45.0,100.0],[10.005,45.0,110.0],[10.01,45.0,105.0]]", "[[0,1,\"asphalt\"],[1,2,\"missing\"]]");

	record Reply(int status, String body, long delayMillis) {

		static Reply ok(String body) {
			return new Reply(200, body, 0);
		}

		static Reply status(int status, String body) {
			return new Reply(status, body, 0);
		}

		static Reply slow(String body) {
			return new Reply(200, body, TIMEOUT_MILLIS * 2);
		}

	}

}
