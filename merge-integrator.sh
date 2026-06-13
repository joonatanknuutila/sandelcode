#!/usr/bin/env bash
# Auto-integrator: every INTERVAL seconds, merge each pushed person/* branch into
# main, gated by a successful `crm/` build, then push main (→ Vercel deploys).
#
# Design notes:
#  - Runs in the ROOT worktree, which is checked out on `main`. The 4 sessions work
#    in worktrees/<name> on person/*, so this never collides with their edits.
#  - Per-branch merge+build: a branch is only merged if `crm/` still builds afterward;
#    if it breaks the build, that merge is rolled back (git reset --hard) and the
#    branch is simply skipped until its owner fixes it. One bad branch never blocks
#    the others, and the live site never gets a non-building commit.
#  - Lanes (disjoint folders per person) + re-rooted branches mean merges are
#    normally conflict-free; a conflicting merge is aborted and logged.
#  - Idempotent: a cycle with nothing new does no merge, no build, no push.
#
# Run in the background:
#   nohup ./merge-integrator.sh > watcher/integrator.log 2>&1 &
#   tail -f watcher/integrator.log
#   pkill -f merge-integrator.sh   # stop
set -u
cd "$(dirname "$0")"
INTERVAL="${1:-60}"
PEOPLE=(joonatan arttu nuutti aarni)
log() { echo "[$(date -u +%FT%TZ)] $*"; }

# Build the CRM with CI-style placeholder env. Returns 0 on success.
build_crm() {
  ( cd crm && \
    NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key \
    npm run build ) > /tmp/integrator-build.out 2>&1
}

# Ensure crm/ deps exist once up front (build gate needs them).
if [ ! -d crm/node_modules ]; then
  log "installing crm/ deps (first run)…"
  ( cd crm && npm ci ) > /tmp/integrator-install.out 2>&1 || log "WARN: npm ci failed, see /tmp/integrator-install.out"
fi

log "auto-integrator up — merging person/* into main every ${INTERVAL}s (build-gated)"
while true; do
  # Never operate over uncommitted work in the root worktree.
  if [ -n "$(git status --porcelain)" ]; then
    log "root worktree dirty — skipping cycle (commit/stash to resume)"
    sleep "$INTERVAL"; continue
  fi
  git fetch origin --quiet "${PEOPLE[@]/#/person/}" 2>/dev/null || git fetch origin --quiet

  start=$(git rev-parse HEAD)
  for p in "${PEOPLE[@]}"; do
    target="origin/person/$p"
    # Anything new on this branch vs main?
    if [ -z "$(git rev-list -n1 "main..$target" 2>/dev/null)" ]; then
      continue
    fi
    before=$(git rev-parse HEAD)
    if ! git merge --no-edit "$target" > /tmp/integrator-merge.out 2>&1; then
      git merge --abort 2>/dev/null
      log "CONFLICT merging person/$p — aborted, skipped (check lanes/overlap)"
      continue
    fi
    [ "$(git rev-parse HEAD)" = "$before" ] && continue   # nothing actually merged
    if build_crm; then
      log "merged person/$p ✓ (build passed)"
    else
      git reset --hard "$before" --quiet
      log "merged person/$p but BUILD FAILED → rolled back; branch skipped (see /tmp/integrator-build.out)"
    fi
  done

  if [ "$(git rev-parse HEAD)" != "$start" ]; then
    if git push origin main > /tmp/integrator-push.out 2>&1; then
      log "pushed main → live deploy ($(git rev-parse --short HEAD))"
    else
      log "WARN: push main failed (probably remote moved) — will retry; see /tmp/integrator-push.out"
      git pull --rebase --quiet origin main 2>/dev/null || true
    fi
  fi
  sleep "$INTERVAL"
done
