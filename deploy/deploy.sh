#!/usr/bin/env bash
# Remote deploy script — runs on the VPS after web/ + server/ + deploy/ are rsynced.
# Idempotent: refreshes the systemd unit if changed, restarts the service, health-checks.
set -euo pipefail

APP=/var/www/cutroom
UNIT=/etc/systemd/system/cutroom.service

# Refresh the systemd unit only when it changed.
if ! cmp -s "$APP/deploy/cutroom.service" "$UNIT" 2>/dev/null; then
  echo "→ updating systemd unit"
  cp "$APP/deploy/cutroom.service" "$UNIT"
  systemctl daemon-reload
fi

systemctl enable cutroom >/dev/null 2>&1 || true
echo "→ restarting cutroom"
systemctl restart cutroom
sleep 1
systemctl --no-pager --lines=0 status cutroom | head -4

# Health check against the local server.
echo -n "→ health: "
if curl -fsS --max-time 5 http://127.0.0.1:8790/health; then
  echo " OK"
else
  echo "FAILED"; journalctl -u cutroom --no-pager --lines=20; exit 1
fi
