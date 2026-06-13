#!/usr/bin/env bash
# Launch all 4 visible Claude sessions in ONE tmux window as a 2x2 grid of panes,
# each in its own worktree and seeded with that person's kickoff prompt. The poller
# (watcher/poll.mjs) injects later Notion prompts into the matching pane by worktree.
set -euo pipefail

cd "$(dirname "$0")"
ROOT="$(pwd)"
SESSION="hmd"
PEOPLE=(joonatan arttu nuutti aarni)

tmux kill-session -t "$SESSION" 2>/dev/null || true

first=1
for p in "${PEOPLE[@]}"; do
  wt="$ROOT/worktrees/$p"
  if [ ! -d "$wt" ]; then
    echo "WARN: worktree missing for $p ($wt) — skipping" >&2
    continue
  fi
  cmd="cd '$wt' && claude \"\$(cat '$ROOT/prompts/$p.md')\""
  if [ $first -eq 1 ]; then
    tmux new-session -d -s "$SESSION" -n grid -c "$wt"
    first=0
  else
    tmux split-window -t "$SESSION:grid" -c "$wt"
    tmux select-layout -t "$SESSION:grid" tiled   # rebalance after each split
  fi
  tmux send-keys -t "$SESSION:grid" "$cmd" Enter
done

# Final 2x2 grid + label each quadrant with its worktree (= person name)
tmux select-layout -t "$SESSION:grid" tiled
tmux set-option -t "$SESSION" pane-border-status top
tmux set-option -t "$SESSION" pane-border-format " #{b:pane_current_path} "

echo "tmux session '$SESSION' started — 2x2 grid: ${PEOPLE[*]}"
echo
echo "Attach:        tmux attach -t $SESSION"
echo "Zoom one pane: Ctrl-b z  (toggle fullscreen for that pane, Ctrl-b z again to return)"
echo "Move panes:    Ctrl-b then arrow keys"
echo "Detach:        Ctrl-b then d"
echo
echo "Then start the poller in another terminal:  npm run watch"
