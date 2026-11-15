import type { D1Database, ExecutionContext, RateLimit, ScheduledController } from "@cloudflare/workers-types";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { hashAccountId, hashIp } from "./hash";

type Bindings = {
	DB: D1Database;
	ACCOUNT_HASH_SECRET: string;
	POST_LIMIT: RateLimit;
	MODULE_LIMIT: RateLimit;
	// Optional: unset means the nightly check still runs and stays quiet.
	ALERT_WEBHOOK_URL?: string;
	// Telegram only, where sendMessage requires it.
	ALERT_CHAT_ID?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Only the Spotify client may call this API (matches the cors-proxy policy).
app.use(
	"/*",
	cors({
		origin: "https://xpui.app.spotify.com",
		allowMethods: ["GET", "POST", "OPTIONS"],
		allowHeaders: ["Content-Type"],
	}),
);

app.get("/", (c) => c.json({ message: "installs API is working" }));

// GET /v1/installs?modules=a,b,c -> { counts: { a: 12, b: 3 } }
// Modules with no installs are omitted. The client chunks ids in 100s; cap here too.
app.get("/v1/installs", async (c) => {
	const modules = (c.req.query("modules") ?? "")
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean)
		.slice(0, 100);
	if (modules.length === 0) return c.json({ counts: {} });

	const placeholders = modules.map(() => "?").join(",");
	const { results } = await c.env.DB.prepare(
		`SELECT module, COUNT(*) AS n FROM installs WHERE module IN (${placeholders}) GROUP BY module`,
	)
		.bind(...modules)
		.all<{ module: string; n: number }>();

	const counts: Record<string, number> = {};
	for (const row of results) counts[row.module] = Number(row.n);
	return c.json({ counts });
});

// POST /v1/installs { module, version, account }
//   -> { ok: true } for any accepted report; 400 bad body; 429 rate limited
// The v3 client has no token that authenticates against Spotify's Web API, so
// the account id is client-asserted (Platform.UserAPI). Only an HMAC of it is
// stored and dedup is UNIQUE(module, account_hash), so counts stay unique per
// claimed account and no raw id is retained. Rate limiting is the abuse speed
// bump — the count is a cosmetic ranking signal, not an audited metric.
//
// The response never reveals whether the row was new. Reporting that would let
// anyone probe a known Spotify username against a module and learn from the
// answer whether that account had installed it.
app.post("/v1/installs", async (c) => {
	const ip = c.req.header("cf-connecting-ip") ?? "unknown";
	if (!(await c.env.POST_LIMIT.limit({ key: ip })).success) return c.json({ ok: false }, 429);

	const body = await c.req.json<{ module?: string; version?: string; account?: string }>().catch(() => null);
	const moduleId = body?.module?.trim();
	if (!moduleId || moduleId.length > 64 || !/^[a-z0-9][a-z0-9._-]*$/i.test(moduleId)) {
		return c.json({ error: "module is required" }, 400);
	}
	const account = body?.account?.trim();
	if (!account || account.length > 128) return c.json({ error: "account is required" }, 400);
	const version = typeof body?.version === "string" ? body.version.slice(0, 64) : null;

	// Per-IP limiting caps one source; this caps one module however many
	// sources a flood is spread across. Well above any real global install
	// rate for a single module, so legitimate reports never reach it.
	if (!(await c.env.MODULE_LIMIT.limit({ key: moduleId })).success) return c.json({ ok: false }, 429);

	// Attribution, so a future spike can be pruned by origin instead of by
	// truncating the module and losing genuine counts with it.
	const cf = c.req.raw.cf as { asn?: number } | undefined;
	const [accountHash, ipHash] = await Promise.all([
		hashAccountId(c.env.ACCOUNT_HASH_SECRET, account),
		hashIp(c.env.ACCOUNT_HASH_SECRET, ip),
	]);
	await c.env.DB.prepare(
		`INSERT OR IGNORE INTO installs (module, account_hash, version, ts, ip_hash, asn, country)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
	)
		.bind(moduleId, accountHash, version, Date.now(), ipHash, cf?.asn ?? null, c.req.header("cf-ipcountry") ?? null)
		.run();

	return c.json({ ok: true });
});

// A spike is investigated within days, so the precise origin has no value past
// a month while the row itself is kept forever. asn and country stay: they are
// coarse enough not to identify anyone and still allow rough pruning of an old
// flood. ip_hash is the identifying one, so it is what expires.
const IP_HASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

async function expireIpHashes(env: Bindings): Promise<number> {
	const res = await env.DB.prepare("UPDATE installs SET ip_hash = NULL WHERE ip_hash IS NOT NULL AND ts < ?")
		.bind(Date.now() - IP_HASH_RETENTION_MS)
		.run();
	return res.meta?.changes ?? 0;
}

// Spike detection. Volume alone cannot separate a module going viral from a
// flood of fabricated account ids, because both are just a lot of rows. What
// separates them is concentration: real installs arrive from many addresses
// across many networks, fabricated ones from few. So the rules below are
// ratios, which hold at any traffic level, plus one absolute ceiling for the
// attacker who does spread across enough addresses to look diffuse.
//
// HARD_VOLUME is the one number here that ages: it is a "come and look" signal,
// not a verdict, and a genuinely popular module will eventually trip it.
const WINDOW_MS = 24 * 60 * 60 * 1000;
const MIN_VOLUME = 25; // below this a ratio is noise, not a signal
const MAX_PER_IP = 5; // installs per distinct address
const MAX_TOP_IP_SHARE = 0.5; // share of the window from a single address
const HARD_VOLUME = 500;

type Window = { module: string; n: number; ips: number; asns: number; top_ip: number | null };

async function findSpikes(env: Bindings): Promise<{ w: Window; reasons: string[] }[]> {
	const { results } = await env.DB.prepare(
		`WITH recent AS (SELECT module, ip_hash, asn FROM installs WHERE ts >= ?),
		      per_ip AS (SELECT module, ip_hash, COUNT(*) AS c FROM recent GROUP BY module, ip_hash)
		 SELECT r.module AS module,
		        COUNT(*) AS n,
		        COUNT(DISTINCT r.ip_hash) AS ips,
		        COUNT(DISTINCT r.asn) AS asns,
		        (SELECT MAX(c) FROM per_ip p WHERE p.module = r.module) AS top_ip
		 FROM recent r GROUP BY r.module HAVING n >= ?`,
	)
		.bind(Date.now() - WINDOW_MS, MIN_VOLUME)
		.all<Window>();

	const flagged: { w: Window; reasons: string[] }[] = [];
	for (const w of results) {
		const reasons: string[] = [];
		// ips is 0 only for rows whose ip_hash has already expired, which a
		// 24h window cannot contain; guard anyway so it degrades to the
		// volume rule instead of dividing by zero.
		if (w.ips > 0 && w.n / w.ips >= MAX_PER_IP) {
			reasons.push(`${(w.n / w.ips).toFixed(1)} installs per address (limit ${MAX_PER_IP})`);
		}
		if (w.top_ip && w.top_ip / w.n >= MAX_TOP_IP_SHARE) {
			reasons.push(`${Math.round((w.top_ip / w.n) * 100)}% from one address`);
		}
		if (w.n >= HARD_VOLUME) reasons.push(`${w.n} installs in 24h`);
		if (reasons.length) flagged.push({ w, reasons });
	}
	return flagged;
}

// One payload for three services: Discord reads content, Slack and Telegram
// read text, and each ignores the keys it does not know. Telegram additionally
// requires chat_id, so it rides along whenever it is configured.
//
// The message is deliberately plain text. Telegram renders markdown only under
// a parse_mode, and its MarkdownV2 needs every '.', '-', '(' and '%' escaped —
// all of which appear in these numbers, so one missed escape turns the whole
// alert into a 400.
async function alert(
	url: string,
	chatId: string | undefined,
	flagged: { w: Window; reasons: string[] }[],
): Promise<void> {
	const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
	const lines = flagged.map(
		({ w, reasons }) =>
			`• ${w.module}: ${plural(w.n, "install", "installs")}, ${plural(w.ips, "address", "addresses")}, ` +
			`${plural(w.asns, "network", "networks")} — ${reasons.join("; ")}`,
	);
	const message = [`Install-count spike on ${flagged.length} module(s) in the last 24h:`, ...lines].join("\n");
	const res = await fetch(url, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			content: message,
			text: message,
			...(chatId ? { chat_id: chatId } : {}),
		}),
	});
	// Telegram explains itself in the body ("chat not found", "bot was blocked
	// by the user"), and a bare status code would hide that.
	if (!res.ok) {
		throw new Error(`alert POST returned ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
	}
}

export default {
	fetch: app.fetch,
	// Nightly. A failure here must surface as a failed cron rather than being
	// swallowed, so the promise is awaited instead of handed to waitUntil.
	// Expiry runs first so a webhook outage cannot cost a night of retention.
	async scheduled(_controller: ScheduledController, env: Bindings, _ctx: ExecutionContext): Promise<void> {
		const cleared = await expireIpHashes(env);
		console.log(`expired ip_hash on ${cleared} row(s)`);

		const flagged = await findSpikes(env);
		console.log(flagged.length ? `spikes: ${flagged.map((f) => f.w.module).join(", ")}` : "no spikes");
		if (flagged.length && env.ALERT_WEBHOOK_URL) await alert(env.ALERT_WEBHOOK_URL, env.ALERT_CHAT_ID, flagged);
	},
};
