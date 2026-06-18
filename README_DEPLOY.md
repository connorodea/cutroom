# Deploying Cutroom

Cutroom ships to **https://cutroom.preecursor.com** on the Hetzner CO VPS (`5.161.239.237`):
nginx serves the static web build and reverse-proxies `/api/` to the Node agent server (systemd).

## Layout on the VPS
```
/var/www/cutroom/
  web/      ← apps/web/dist  (static SPA, nginx root)
  server/   ← apps/server/dist (index.mjs, run by systemd)
  deploy/   ← deploy scripts (cutroom.service, deploy.sh)
/etc/cutroom.env            ← ANTHROPIC_API_KEY, PORT=8787, CUTROOM_AGENT_MODEL (0600)
/etc/systemd/system/cutroom.service
/etc/nginx/sites-available/cutroom.preecursor.com  (+ symlink in sites-enabled)
```

## One-time provisioning (per box)
1. Install Node 20+ and nginx/certbot if absent.
2. `mkdir -p /var/www/cutroom/{web,server,deploy}`
3. Write `/etc/cutroom.env`:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   PORT=8790
   CUTROOM_AGENT_MODEL=claude-sonnet-4-6
   ```
   `chmod 600 /etc/cutroom.env`
4. Install nginx site: copy `deploy/nginx.cutroom.conf` → `/etc/nginx/sites-available/cutroom.preecursor.com`, symlink into `sites-enabled`, `nginx -t && systemctl reload nginx`.
5. DNS: A record `cutroom.preecursor.com → 5.161.239.237` (Namecheap, connorodea).
6. TLS: `certbot --nginx -d cutroom.preecursor.com` (auto-renew via the certbot timer).
7. Install the service: copy `deploy/cutroom.service` → `/etc/systemd/system/`, `systemctl daemon-reload && systemctl enable --now cutroom`.

## Build + deploy
- Local build: `pnpm build` → `apps/web/dist` + `apps/server/dist/index.mjs`.
- Manual deploy: rsync `apps/web/dist/` → `…/web/`, `apps/server/dist/` → `…/server/`, `deploy/` → `…/deploy/`, then `bash /var/www/cutroom/deploy/deploy.sh`.
- **Automated:** push to `main` → `.github/workflows/deploy.yml` runs CI (typecheck/test/build) then deploys.

## GitHub secrets (repo: connorodea/cutroom)
- `HETZNER_CO_HOST` = `5.161.239.237`
- `HETZNER_CO_USER` = `root`
- `HETZNER_CO_SSH_KEY` = private key of a dedicated deploy keypair (public half in the VPS `authorized_keys`)

## Verify
- `curl https://cutroom.preecursor.com/api/health` → `{"ok":true,"keyPresent":true,…}`
- Open the site, switch tabs, hit ⌘K → the agent returns a real plan.
