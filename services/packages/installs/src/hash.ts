// HMAC-SHA256 keyed by a server secret, so the database holds opaque,
// non-reversible tokens instead of raw identifiers. The key must be stable
// (changing it resets every module's unique-count basis).
async function hmacHex(secret: string, message: string): Promise<string> {
	if (!secret) throw new Error("ACCOUNT_HASH_SECRET is not configured");
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
	return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// The account id is hashed unprefixed: this value is the dedup key of every
// row already stored, so prefixing it would orphan them and reset all counts.
export function hashAccountId(secret: string, accountId: string): Promise<string> {
	return hmacHex(secret, accountId);
}

// Prefixed, so an IP and an account id that happen to be the same string
// cannot be correlated across the two columns.
export function hashIp(secret: string, ip: string): Promise<string> {
	return hmacHex(secret, `ip:${ip}`);
}
