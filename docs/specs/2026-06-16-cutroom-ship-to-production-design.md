# Cutroom — ship to production design spec

**Date:** 2026-06-16
**Status:** Approved — in build
**Goal:** Turn the Studio Editor into deployable, reliable software live at **https://cutroom.preecursor.com**.

This milestone is about production-readiness and getting live — **not** new editor features and **not** real video editing. The agent's edits stay mocked; only the plan is real.

## Facts

- **VPS:** Hetzner CO `5.161.239.237`, `root` via `ssh hetznerCO`. Agent server runs here as systemd; web served by nginx.
- **DNS:** `preecursor.com` is on **Namecheap** (connorodea; NS `dns1/dns2.registrar-servers.com`). Add A record `cutroom` → `5.161.239.237` via the Namecheap API (user connorodea, ClientIp `75.70.129.239`). **`setHosts` replaces all records — read existing + append.**
- **TLS:** Let's Encrypt (certbot) on nginx — not behind Cloudflare's proxy for this domain.
- **GitHub:** `connorodea/cutroom` (litigation rule: `unset GITHUB_TOKEN`; account must be `connorodea`).

## Architecture

```
Browser ── HTTPS ──► nginx (cutroom.preecursor.com, VPS)
                       ├── /            → static apps/web/dist (SPA fallback)
                       └── /api/*        → 127.0.0.1:8787 (systemd: cutroom)
                                            └── Hono + Anthropic SDK → managed Cutroom Agent
```

## 1. Production build
- **web:** `vite build` → `apps/web/dist` (static SPA, base `/`).
- **server:** esbuild bundle → `apps/server/dist/index.js` — one self-contained ESM file (Hono + `@anthropic-ai/sdk` + `@cutroom/core` inlined), run with `node`. Env: `ANTHROPIC_API_KEY`, `PORT`, `CUTROOM_AGENT_MODEL`.
- root `pnpm build` runs both. `pnpm build` must succeed in CI.

## 2. Serving on the VPS
- nginx `server` block for `cutroom.preecursor.com`: static root `/var/www/cutroom/web` with `try_files $uri /index.html`; `location /api/ { proxy_pass http://127.0.0.1:8787; }`.
- systemd unit `cutroom`: `node /var/www/cutroom/server/index.js`, `EnvironmentFile=/etc/cutroom.env` (`0600`, holds the API key), restart-on-failure.

## 3. DNS + TLS
- Namecheap A record `cutroom.preecursor.com` → `5.161.239.237` (read-then-append).
- certbot `--nginx -d cutroom.preecursor.com`, auto-renew timer.

## 4. CI/CD (Hetzner standard)
- `.github/workflows/deploy.yml`: push to `main` → **ci** (pnpm install → typecheck → test → build → e2e) → **deploy** (owner connorodea → `HETZNER_CO_HOST/USER/SSH_KEY`; rsync web dist → `/var/www/cutroom/web`, server bundle → `/var/www/cutroom/server`, `ssh … deploy/deploy.sh` → `systemctl restart cutroom`). Concurrency group prevents races; fail-fast on missing secrets.
- Files: `deploy/deploy.sh`, `deploy/cutroom.service`, `deploy/nginx.cutroom.conf`, `README_DEPLOY.md`.
- Secrets: `HETZNER_CO_HOST/USER/SSH_KEY` (dedicated deploy key added to the VPS). The `ANTHROPIC_API_KEY` lives in `/etc/cutroom.env` on the box — **never** a repo secret or in nginx.

## 5. Agent hardening (`apps/server`)
- `generatePlan`: retry transient errors (≤2, small backoff); keep the wall-clock deadline + `baseEditSteps` fallback.
- `/health`: `{ ok, agent, keyPresent }` (no secret).
- Response already returns `source` ("agent" | "fallback"); the web palette shows a small badge when a run came from the fallback, so degradation is visible.
- Boots without a key (returns fallback + logs a clear warning) — never crashes the box.

## 6. e2e tests (Playwright)
- `apps/web/e2e/`: build → `vite preview`; load app, switch all 5 tabs (assert each page marker), open ⌘K, run a preset, assert steps animate and "Apply to timeline" appears. Deterministic by running with no `ANTHROPIC_API_KEY` (fallback plan). Headless; gated in CI.

## Execution order
1. Prod build (esbuild server bundle, verify `vite build` + `node dist/index.js`).
2. Agent hardening + `/health` + fallback badge.
3. e2e tests.
4. Deploy infra files + CI workflow.
5. VPS recon (read-only) → provision (nginx, systemd, node, certbot) — **dry-run + approval per prod-safety**.
6. Namecheap DNS A record.
7. GitHub secrets + deploy key.
8. Initial manual deploy → verify live over HTTPS → screenshot.

## Risks / notes
- VPS already hosts other connorodea sites — recon first, never touch existing nginx server blocks/services. Add a new isolated site only.
- Managed-agent latency: palette shows loading + falls back, so prod UX never stalls.
- First deploy is manual to validate; subsequent `main` pushes auto-deploy via CI.

## Out of scope
Editor-feature interactivity, real media/playback/export, Docker, multi-env/staging, auth.
