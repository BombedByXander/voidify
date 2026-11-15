import makeFetchCookie from "fetch-cookie";
import { Hono } from "hono";
import pkg from "../package.json";
import { buildProxyHeaders } from "./headers";
import { checkBlacklistedTarget, isValidURL } from "./request";

// Only the Spotify client may use the proxy (browser-enforced; the raw check
// below mirrors the original service's behaviour).
const ALLOWED_ORIGIN = "https://xpui.app.spotify.com";
const PAYLOAD_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const app = new Hono();

// Everything is a catch-all: the path after "/" is the target URL, e.g.
// cors-proxy.spicetify.app/https://github.com/owner/repo/releases/... .
app.all("/*", async (c) => {
	const origin = c.req.header("origin");

	// Preflight: reflect the requested headers so the X-* forwarding headers
	// pass, restricted to the Spotify origin.
	if (c.req.method === "OPTIONS") {
		return new Response(null, {
			status: 204,
			headers: {
				"Access-Control-Allow-Origin": origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : "",
				"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH",
				"Access-Control-Allow-Headers": c.req.header("access-control-request-headers") ?? "*",
				Vary: "Origin",
			},
		});
	}

	const url = new URL(c.req.url);
	const dest = url.pathname.slice(1); // strip the leading "/"
	if (!dest) return c.json({ message: `Proxy is working as expected (v${pkg.version})` });

	// The target keeps its own query string; the proxy rejects encoded targets.
	const target = dest + url.search;
	if (checkBlacklistedTarget(target) || !isValidURL(target) || (origin && origin !== ALLOWED_ORIGIN)) {
		return c.json({ error: "Invalid target" }, 400);
	}

	const method = c.req.method;
	const body = PAYLOAD_METHODS.has(method) ? await c.req.arrayBuffer() : undefined;

	// Per-request cookie jar so cookies set on a redirect carry to the next hop.
	const fetchWithCookies = makeFetchCookie(fetch, new makeFetchCookie.toughCookie.CookieJar());

	let upstream: Response;
	try {
		upstream = await fetchWithCookies(target, {
			method,
			headers: buildProxyHeaders(c.req.raw.headers),
			body,
			redirect: "follow",
		});
	} catch (e) {
		console.log("Error fetching", e);
		return c.json({ error: "Upstream fetch failed" }, 502);
	}

	// Pass the upstream response through; drop the encoding/length headers since
	// the body is already decoded, expose the (browser-blocked) Set-Cookie as
	// X-Set-Cookie, and open CORS like the original service did.
	const headers = new Headers(upstream.headers);
	headers.delete("content-encoding");
	headers.delete("content-length");
	const setCookie = upstream.headers.get("set-cookie");
	if (setCookie) headers.set("X-Set-Cookie", setCookie);
	headers.set("Access-Control-Allow-Origin", "*");
	headers.set("Access-Control-Expose-Headers", "*");
	headers.set("Vary", "Origin");
	headers.set("X-Final-Destination", upstream.url);

	return new Response(upstream.body, { status: upstream.status, headers });
});

export default app;
