# OneDrive Cloudflare Index

A Next.js file browser that publishes a configured portion of one OneDrive account through Microsoft Graph. It supports folder navigation, file previews, direct downloads, browser-generated ZIP files, protected folders, search, and an optional OPDS catalog.

## Requirements

- Node.js 24 or newer
- npm 12 or newer
- A Microsoft OAuth application with `http://localhost` registered as a redirect URI
- A Cloudflare Workers project and KV namespace bound as `CLOUDFLARE_KV`

## Configuration

Install dependencies and copy the local environment template:

```bash
npm ci
cp .dev.vars.example .dev.vars
cp wrangler.example.toml wrangler.toml
```

Replace both placeholder KV namespace IDs in `wrangler.toml`. Keep the binding name as `CLOUDFLARE_KV`.

Configure these server-side values in `.dev.vars` locally and as Cloudflare Worker secrets or variables for production:

- `OAUTH_CLIENT_ID`: Microsoft application client ID.
- `OAUTH_CLIENT_SECRET`: Plain Microsoft application secret. Do not encrypt or expose it to the browser.
- `USER_PRINCIPAL_NAME`: Exact Microsoft account principal name allowed to initialize this deployment. The legacy misspelling `USER_PRINCIPLE_NAME` is also accepted.
- `BASE_DIRECTORY`: OneDrive directory published as the site root; defaults to `/`.

Customize presentation, protected routes, page size, browser preview/archive limits, and OPDS in
`config/site.config.js`.

## Local development

The OpenNext development integration exposes the local bindings from `wrangler.toml` to Next.js. Start the development
server with:

```bash
npm run dev
```

For an end-to-end preview in the Cloudflare Workers runtime, run:

```bash
npm run cloudflare:preview
```

Build and deploy with:

```bash
npm run cloudflare:build
npm run cloudflare:deploy
```

## Initial OAuth setup

1. Visit the deployed site. With no tokens in KV, it redirects to `/oauth/step-1`.
2. Open the Microsoft authorization link in step 2.
3. After Microsoft redirects to `http://localhost`, copy the complete URL back into step 2.
4. Step 2 submits the complete redirect URL to the server with POST. The server validates a short-lived OAuth state
   cookie and PKCE challenge, exchanges the code, verifies `USER_PRINCIPAL_NAME`, and writes the tokens directly to KV.
5. Step 3 reports whether storage succeeded. Authorization codes and OAuth tokens are never placed in this site's URLs
   or browser page properties.

The access token is stored with its expiry. The refresh token is retained and used to renew access automatically.

## Protected folders

Add protected directory paths to `protectedRoutes`, then create a `.password` file inside each corresponding OneDrive folder. The `.password` file is hidden from listings.

The browser submits a password once to `/api/auth`. After validation, the server creates a random, short-lived session in
Cloudflare KV and sends only its opaque identifier in an `HttpOnly`, `SameSite=Strict` cookie (`Secure` in production).
Passwords and password hashes are never stored in the browser or added to URLs. Successful login rotates the session
identifier, logout revokes it from KV, and authenticated responses are marked private and non-cacheable.

Configure session lifetime and the basic Cloudflare-IP login attempt limit with `protectedSessionTtl`,
`protectedLoginAttempts`, and `protectedLoginWindow`. Cloudflare WAF rate limiting is still recommended for public
deployments. Existing `odpt` links from older versions no longer grant access, and legacy browser hashes are deleted when
the updated UI loads.

Protected Office files intentionally do not use the remote Office viewer because the third-party viewer cannot receive
the same-site session cookie. Download and open them locally instead.

Raw HTML in Markdown files is ignored. This prevents drive content from injecting active markup into the application.
Internet Shortcut (`.url`) previews only open HTTP or HTTPS targets, and Graph-issued file URLs are accepted only over
HTTPS. Proxied file responses use an explicit response-header allowlist so upstream cookies and security policies cannot
be applied to this site's origin.

Text-like previews and browser-generated ZIP archives have configurable size limits. These limits protect the browser
from attempting to hold unexpectedly large files and archives in memory.

## OPDS

Enable `siteConfig.opds` to expose `/api/opds`. Public catalogs need no extra parameters. Protected catalogs use the same
session cookie as the web UI; clients that cannot retain same-site cookies can only access public catalogs.

## Verification

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run cloudflare:build
```

The focused tests cover protected-route boundaries, session rotation and revocation, cookie security, login throttling,
Graph-to-share path conversion and URL encoding, pagination, OAuth response validation and PKCE, download limits, raw
proxy handling, and the Node/Web API route adapter.
