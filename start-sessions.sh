#!/usr/bin/env bash
# Launch all 4 visible Claude sessions in ONE tmux window as a 2x2 grid of panes.
# All panes run in the SAME repo checkout on `main` (no per-person worktrees).
# Each pane gets a TITLE (= person name); the poller (watcher/poll.mjs) injects
# later Notion prompts into the matching pane by title.
set -euo pipefail

cd "$(dirname "$0")"
ROOT="$(pwd)"
SESSION="hmd"
PEOPLE=(joonatan arttu nuutti aarni)

tmux kill-session -t "$SESSION" 2>/dev/null || true

first=1
for p in "${PEOPLE[@]}"; do
  cmd="claude \"\$(cat '$ROOT/prompts/$p.md')\""
  if [ $first -eq 1 ]; then
    tmux new-session -d -s "$SESSION" -n grid -c "$ROOT"
    first=0
  else
    tmux split-window -t "$SESSION:grid" -c "$ROOT"
    tmux select-layout -t "$SESSION:grid" tiled   # rebalance after each split
  fi
  pane=$(tmux display-message -p -t "$SESSION:grid" '#{pane_id}')
  tmux select-pane -t "$pane" -T "$p"             # title used by poller for routing
  tmux send-keys -t "$pane" "$cmd" Enter
done

# Final 2x2 grid + label each quadrant with its pane title (= person name)
tmux select-layout -t "$SESSION:grid" tiled
tmux set-option -t "$SESSION" pane-border-status top
tmux set-option -t "$SESSION" pane-border-format " #{pane_title} "

echo "tmux session '$SESSION' started — 2x2 grid (all on main): ${PEOPLE[*]}"
echo
echo "Attach:        tmux attach -t $SESSION"
echo "Zoom one pane: Ctrl-b z  (toggle fullscreen for that pane, Ctrl-b z again to return)"
echo "Move panes:    Ctrl-b then arrow keys"
echo "Detach:        Ctrl-b then d"
echo
echo "Then start the poller in another terminal:  npm run watch"
