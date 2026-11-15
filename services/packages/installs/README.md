# installs

The unique-install counter behind `installs.spicetify.app`, consumed by the
Spicetify module store to show "N installs" badges and the "Most installed"
sort. A Hono app on Cloudflare Workers with a D1 database.

## API

The contract is fixed by the store client (`modules/modules/store`):

- `GET /v1/installs?modules=a,b,c` → `{ "counts": { "a": 12, "b": 3 } }`
  Modules with no installs are omitted. Client chunks ids in 100s.

- `POST /v1/installs` with body `{ "module": "id", "version": "1.2.3",
"account": "<spotify account id>" }`
  → `{ "ok": true }` for any accepted report, `400` for a bad body, `429` when
  rate limited. The response deliberately does **not** say whether the row was
  new (see below).

### How it counts (anti-abuse + privacy)

The v3 client has no token that authenticates against Spotify's Web API, so the
account id is **client-asserted** (`Platform.UserAPI.getUser().username`). Only
an **HMAC-SHA256 of it** (keyed by `ACCOUNT_HASH_SECRET`) is stored — never the
raw id — and the table has `UNIQUE(module, account_hash)`, so a real account
counts once per module. The count is a cosmetic ranking signal, not an audited
metric.

Because the id is not server-verified, anyone can POST fabricated ids and each
one counts. Three things bound the damage rather than prevent it:

- **Per-IP rate limiting** (30/min) caps how fast one source can inflate.
- **Per-module rate limiting** (60/min) caps one module's intake however many
  IPs a flood is spread across, which the per-IP limit alone cannot do. It sits
  far above any real global install rate for a single module.
- **Attribution columns** (`ip_hash`, `asn`, `country`) make a spike prunable
  by origin. Without them the only cleanup is truncating the module, which
  throws away the genuine counts too. `ip_hash` is an HMAC under the same
  secret, prefixed so it cannot be correlated with `account_hash`, and a
  nightly cron nulls it after 30 days. `asn`/`country` are coarse enough to
  keep, so an old flood is still roughly prunable; the row itself is never
  deleted, so counts are unaffected either way.

Note that CORS is **not** one of these. It is browser-enforced, so it scopes
which pages may call the API and stops nothing that isn't a browser.

The POST response is uniform on purpose. Returning whether the insert was new
would turn the endpoint into an oracle: POST a known Spotify username (they
appear in `open.spotify.com/user/<id>` links) against a module and the answer
reveals whether that account had installed it.

CORS is restricted to `https://xpui.app.spotify.com` (matches cors-proxy).

### Spike detection

The nightly cron also looks for inflation, and reports it rather than acting on
it: pruning stays a decision you make after seeing the evidence.

Volume alone cannot tell a module going viral from a flood of fabricated ids,
since both are just a lot of rows. **Concentration** can: real installs arrive
from many addresses across many networks, fabricated ones from few. So the
rules are ratios over the trailing 24h, which hold at any traffic level:

| Rule                   | Trips when   |
| ---------------------- | ------------ |
| installs per address   | ≥ 5          |
| share from one address | ≥ 50%        |
| absolute volume        | ≥ 500 in 24h |

All of them require ≥ 25 installs in the window first, below which a ratio is
noise. The absolute-volume rule is the one number here that ages: it is a "come
and look" signal, not a verdict, and a genuinely popular module will trip it
eventually.

Flags POST to `ALERT_WEBHOOK_URL`. One payload serves Discord (`content`),
Slack (`text`) and Telegram (`text` + `chat_id`), since each ignores the keys
it does not know. **Unset is fine**: the check still runs and simply stays
quiet, so nothing has to be configured before deploying.

For Telegram, the URL is the bot's `sendMessage` endpoint and `ALERT_CHAT_ID`
names the chat:

```sh
wrangler secret put ALERT_WEBHOOK_URL   # https://api.telegram.org/bot<token>/sendMessage
wrangler secret put ALERT_CHAT_ID       # e.g. 123456789
```

To get both: message [@BotFather](https://t.me/BotFather) with `/newbot` for
the token, then send your new bot any message and read the chat id back out of

```sh
curl -s "https://api.telegram.org/bot<token>/getUpdates" | jq '.result[-1].message.chat.id'
```

A bot cannot open a conversation, so that first message from you is required;
without it `sendMessage` fails with `chat not found`. For a group, add the bot
to it and use the group's negative chat id.

Alerts are plain text with no markdown. Telegram renders markup only under a
`parse_mode`, and its MarkdownV2 would need every `.`, `-`, `(` and `%` in
these numbers escaped, where one miss turns the whole alert into a 400.

Detection depends on `ip_hash`, which expires at 30 days, so it only ever sees
recent windows. That is what it is for.

## Deploy (one-time)

```sh
nub install
wrangler d1 create spicetify-installs           # paste the id into wrangler.toml
wrangler d1 execute spicetify-installs --remote --file schema.sql
wrangler secret put ACCOUNT_HASH_SECRET         # a long random string, kept stable
nub run deploy                                  # wrangler bundles src/index.ts
```

Then add the `installs.spicetify.app` custom domain (already declared in
`wrangler.toml` `routes`).

## Migrating the live database

`schema.sql` is `CREATE TABLE IF NOT EXISTS`, so it will not add columns to the
database that is already deployed. Apply the one-time migration **before**
deploying the worker that writes those columns:

```sh
wrangler d1 execute spicetify-installs --remote --file migrations/0001-attribution.sql
nub run deploy
```

It is not idempotent (SQLite has no `ADD COLUMN IF NOT EXISTS`), so a second
run errors instead of silently doing nothing.

## Local dev

```sh
nub install
cp .dev.vars.example .dev.vars                  # sets ACCOUNT_HASH_SECRET
wrangler d1 execute spicetify-installs --local --file schema.sql
nub run dev                                     # wrangler dev: local D1 + workerd, :8787
```

Smoke test:

```sh
curl -s "http://127.0.0.1:8787/v1/installs?modules=stdlib,new-releases"
curl -s -XPOST http://127.0.0.1:8787/v1/installs \
  -H "content-type: application/json" \
  -d '{"module":"stdlib","version":"0.3.0","account":"me"}'  # -> {"ok":true}
```

Trigger the nightly job (ip_hash expiry, then spike detection) without waiting
for 04:23:

```sh
nub run dev -- --test-scheduled                 # then, in another shell
curl "http://127.0.0.1:8787/__scheduled?cron=23+4+*+*+*"
```

Dedup is not visible in the response, so check it in the database:

```sh
wrangler d1 execute spicetify-installs --local \
  --command "SELECT module, COUNT(*) FROM installs GROUP BY module"
```

To see the badges populate in the live store, point it at a reachable HTTPS
instance (a deployed preview or a tunnel — the client is https and won't call an
http origin): `localStorage["spicetify:installsApiUrl"] = "https://<url>"`.
