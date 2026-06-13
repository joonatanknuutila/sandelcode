#!/usr/bin/env bash
# RETIRED (2026-06-13). The per-person worktree/branch model was dropped — all
# sessions now work directly in this single checkout on `main`. There are no
# `person/*` branches to merge, so there is nothing to integrate.
#
# Push is handled by ./autopush.sh (pushes `main`). CI still builds crm/ on
# every PR to main (.github/workflows/ci.yml). See HANDOFF.md.
echo "merge-integrator.sh is retired: everyone works on 'main' now; nothing to merge." >&2
exit 0
