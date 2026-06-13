#!/usr/bin/env bash
# Keep GitHub up to date: every INTERVAL seconds, push `main` (whatever the
# sessions have committed locally). Safe & idempotent — pushes nothing when
# there's nothing new. Run in the background:
#   nohup ./autopush.sh > watcher/autopush.log 2>&1 &
set -u
cd "$(dirname "$0")"
INTERVAL="${1:-60}"
BRANCH="main"

echo "[$(date -u +%FT%TZ)] autopush up — pushing $BRANCH every ${INTERVAL}s"
while true; do
  out=$(git push origin "$BRANCH" 2>&1)
  if ! echo "$out" | grep -q 'up-to-date'; then
    echo "[$(date -u +%FT%TZ)] pushed $BRANCH"
  fi
  sleep "$INTERVAL"
done
