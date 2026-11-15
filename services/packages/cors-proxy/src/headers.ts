// The browser can't set Cookie/Referer/Origin/User-Agent on a fetch, so the
// client passes them X-* prefixed; they're remapped to the real names upstream.
const HEADER_MAP: Record<string, string> = {
	"x-cookie": "cookie",
	"x-referer": "referer",
	"x-origin": "origin",
	"x-user-agent": "user-agent",
	"x-x-real-ip": "x-real-ip",
};

const DEFAULT_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:93.0) Gecko/20100101 Firefox/93.0";

// Never forwarded upstream: Cloudflare/proxy metadata, forwarding headers, the
// X-* map keys (re-added mapped), content-length (recomputed by the runtime),
// and the hop-by-hop headers (incl. host, which must come from the target).
const BLACKLIST = new Set([
	"cf-connecting-ip",
	"cf-worker",
	"cf-ray",
	"cf-visitor",
	"cf-ew-via",
	"cdn-loop",
	"x-amzn-trace-id",
	"cf-ipcountry",
	"x-forwarded-for",
	"x-forwarded-host",
	"x-forwarded-proto",
	"forwarded",
	"x-real-ip",
	"content-length",
	"host",
	"connection",
	"keep-alive",
	"proxy-authenticate",
	"proxy-authorization",
	"te",
	"trailer",
	"transfer-encoding",
	"upgrade",
	...Object.keys(HEADER_MAP),
]);

// Build the outgoing headers: pass the incoming ones minus the blacklist, force
// the default user agent, then overlay the mapped X-* values (so X-User-Agent
// wins over the default).
export function buildProxyHeaders(incoming: Headers): Headers {
	const out = new Headers();
	for (const [key, value] of incoming) {
		if (!BLACKLIST.has(key.toLowerCase())) out.set(key, value);
	}
	out.set("user-agent", DEFAULT_UA);
	for (const [prefixed, real] of Object.entries(HEADER_MAP)) {
		const value = incoming.get(prefixed);
		if (value !== null) out.set(real, value);
	}
	return out;
}
