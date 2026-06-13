#!/usr/bin/env bash
# Keep GitHub continuously up to date: every INTERVAL seconds, push each person's
# branch (whatever the sessions have committed locally). Safe & idempotent —
# pushes nothing when there's nothing new. Run in the background:
#   nohup ./autopush.sh > watcher/autopush.log 2>&1 &
set -u
cd "$(dirname "$0")"
INTERVAL="${1:-60}"
PEOPLE=(joonatan arttu nuutti aarni)

echo "[$(date -u +%FT%TZ)] autopush up — pushing person/* every ${INTERVAL}s"
while true; do
  for p in "${PEOPLE[@]}"; do
    out=$(git push origin "person/$p" 2>&1)
    if ! echo "$out" | grep -q 'up-to-date'; then
      echo "[$(date -u +%FT%TZ)] pushed person/$p"
    fi
  done
  sleep "$INTERVAL"
done
