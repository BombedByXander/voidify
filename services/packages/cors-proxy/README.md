# cors-proxy

Reverse proxy to bypass CORS, used by [spicetify](https://spicetify.app) at
`cors-proxy.spicetify.app`. A Hono app on Cloudflare Workers.

Call it as `cors-proxy.spicetify.app/<target-url>` — the path after `/` is the
target (keep it unencoded), e.g.
`cors-proxy.spicetify.app/https://github.com/owner/repo/releases/...`.

## Features

- Bypasses CORS for the Spotify client (origin restricted to `xpui.app.spotify.com`).
- Rewrites protected request headers: send `X-Cookie` / `X-Referer` / `X-Origin`
  / `X-User-Agent` / `X-X-Real-Ip`, they're mapped to the real header upstream.
- Surfaces the (browser-blocked) upstream `Set-Cookie` as `X-Set-Cookie` and the
  final URL as `X-Final-Destination`.
- Per-request cookie jar (`fetch-cookie`) so cookies carry across redirects.

## Develop / deploy

```sh
nub install
nub run dev       # wrangler dev on http://127.0.0.1:8787
nub run deploy    # wrangler deploy (custom domain in wrangler.toml)
```
