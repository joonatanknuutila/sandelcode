#!/usr/bin/env bash
# Launch all 4 visible Claude sessions in a tmux layout, each in its own worktree
# and seeded with that person's kickoff prompt. The poller (watcher/poll.mjs)
# injects later Notion prompts into these same windows via tmux send-keys.
set -euo pipefail

cd "$(dirname "$0")"
ROOT="$(pwd)"
SESSION="hmd"
PEOPLE=(joonatan arttu nuutti aarni)

# Recreate cleanly
tmux kill-session -t "$SESSION" 2>/dev/null || true

first=1
for p in "${PEOPLE[@]}"; do
  wt="$ROOT/worktrees/$p"
  if [ ! -d "$wt" ]; then
    echo "WARN: worktree missing for $p ($wt) — skipping" >&2
    continue
  fi
  # Open an interactive claude session seeded with the kickoff prompt.
  cmd="cd '$wt' && claude \"\$(cat '$ROOT/prompts/$p.md')\""
  if [ $first -eq 1 ]; then
    tmux new-session -d -s "$SESSION" -n "$p" -c "$wt"
    first=0
  else
    tmux new-window -t "$SESSION" -n "$p" -c "$wt"
  fi
  tmux send-keys -t "$SESSION:$p" "$cmd" Enter
done

echo "tmux session '$SESSION' started — windows: ${PEOPLE[*]}"
echo
echo "Attach:        tmux attach -t $SESSION"
echo "Switch window: Ctrl-b then 0/1/2/3   (or Ctrl-b n / p for next/prev)"
echo "Detach:        Ctrl-b then d"
echo
echo "Then start the poller in another terminal:  npm run watch"
