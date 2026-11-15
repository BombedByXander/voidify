# spicetify services

Cloudflare Workers behind `*.spicetify.app`, managed as one workspace so they
share tooling and can be bumped together.

## Packages

| Package                                      | Domain                     | What it does                                        |
| -------------------------------------------- | -------------------------- | --------------------------------------------------- |
| [`packages/cors-proxy`](packages/cors-proxy) | `cors-proxy.spicetify.app` | Proxies CORS-less external requests for the client. |
| [`packages/installs`](packages/installs)     | `installs.spicetify.app`   | Unique-install counter for the module store.        |

## Tooling

- Lint: `nub run lint` (oxlint) · Format: `nub run fmt` / `nub run fmt:check` (oxfmt)
- Each worker is a Nitro app; build/dev/deploy steps live in its own README.

Both workers deploy to Cloudflare via `wrangler` (custom domains declared in each
`wrangler.toml`).
