#!/usr/bin/env bash
# ============================================================
#  Start script for www.riviratech.com  (Ubuntu / Linux)
#  The Linux counterpart of start.bat:
#  - Backend server (Express)  : http://localhost:5000
#  - Frontend app (Vite/React) : http://localhost:5173
#  - AI Assistant (FastAPI/py) : http://127.0.0.1:8000
#  All three run in this one terminal; every line is tagged with
#  [api] / [app] / [assistant]. Ctrl+C stops all three.
#
#  Run:  bash start.sh        (or once: chmod +x start.sh, then ./start.sh)
#
#  On the server the systemd services (riviratech-web / -api /
#  -assistant) already run these. A port that is already in use is
#  skipped, so this never fights a running service.
# ============================================================
set -u
set -m   # each service in its own process group, so Ctrl+C stops its children too

# cd into the script's own folder (equivalent of %~dp0)
cd "$(dirname "$(readlink -f "$0")")" || exit 1
ROOT="$PWD"

echo
echo "=== KKR GenAI Innovations - Starting App + Server ==="
echo

need() {
  command -v "$1" >/dev/null 2>&1 || { echo "[ERROR] '$1' is not installed. $2"; exit 1; }
}
need node "Install Node.js (for example with nvm, or: sudo apt install nodejs npm)."
need npm "Install npm (sudo apt install npm)."

# --- Install frontend dependencies if needed ---
if [ ! -d "node_modules" ]; then
  echo "[app] node_modules not found. Installing frontend dependencies..."
  npm install || { echo "[ERROR] Frontend npm install failed."; exit 1; }
fi

# --- Install backend dependencies if needed ---
if [ ! -d "api/node_modules" ]; then
  echo "[server] node_modules not found. Installing backend dependencies..."
  npm install --prefix api || { echo "[ERROR] Backend npm install failed."; exit 1; }
fi

# true when something is already listening on the port
port_busy() {
  if command -v ss >/dev/null 2>&1; then
    [ -n "$(ss -ltnH "sport = :$1" 2>/dev/null)" ]
  else
    return 1
  fi
}

PIDS=()
NAMES=()
URLS=()

# start NAME PORT URL DIR CMD... : runs CMD in DIR in the background, output tagged [NAME]
start() {
  local name=$1 port=$2 url=$3 dir=$4
  shift 4
  if port_busy "$port"; then
    echo "[$name] port $port is already in use - skipped (already running?)"
    return
  fi
  # the tagger ignores Ctrl+C, so it keeps printing until the service has stopped
  ( cd "$dir" && exec "$@" ) < /dev/null > >(trap "" INT; exec sed -u "s/^/[$name] /") 2>&1 &
  PIDS+=($!)
  NAMES+=("$name")
  URLS+=("$url")
}

# signal SIG to a process and everything it started (npm -> vite, run.py -> workers)
signal_tree() {
  local sig=$1 pid=$2 child
  for child in $(pgrep -P "$pid" 2>/dev/null); do
    signal_tree "$sig" "$child"
  done
  kill "-$sig" "$pid" 2>/dev/null
}

any_running() {
  local pid
  for pid in "${PIDS[@]}"; do
    kill -0 "$pid" 2>/dev/null && return 0
  done
  return 1
}

STOPPING=0
stop_all() {
  [ "$STOPPING" = 1 ] && return
  STOPPING=1
  [ ${#PIDS[@]} -eq 0 ] && return
  echo
  echo "Stopping..."
  local pid i
  for pid in "${PIDS[@]}"; do
    kill -TERM -- "-$pid" 2>/dev/null # the service's process group
    signal_tree TERM "$pid"           # and its process tree, in case it left the group
  done
  # give them up to 10 s to shut down cleanly, then force it
  for i in $(seq 1 20); do
    any_running || break
    sleep 0.5
  done
  if any_running; then
    echo "Some services did not stop in 10 s - forcing them."
    for pid in "${PIDS[@]}"; do
      kill -KILL -- "-$pid" 2>/dev/null
      signal_tree KILL "$pid"
    done
  fi
  wait "${PIDS[@]}" 2>/dev/null
  sleep 0.3 # let the last tagged lines print
  echo "All stopped."
}
trap 'stop_all; exit 130' INT TERM
trap stop_all EXIT

# --- AI assistant: check the models here, in the foreground, so a download
#     prompt can be answered before everything runs in the background ---
ASSISTANT=1
if ! command -v python3 >/dev/null 2>&1; then
  echo "[assistant] python3 is not installed - skipped (sudo apt install python3 python3-venv)"
  ASSISTANT=0
elif [ ! -f "assistant/.env" ]; then
  echo "[assistant] assistant/.env not found - skipped (copy .env.example to .env and set DB_PASSWORD)"
  ASSISTANT=0
elif ! bash "assistant/start.sh" --check-models; then
  echo "[assistant] models missing - skipped"
  ASSISTANT=0
fi

echo "Starting backend server on http://localhost:5000 ..."
start api 5000 "http://localhost:5000" "$ROOT/api" env PORT=5000 node server.js

echo "Starting frontend app on http://localhost:5173 ..."
start app 5173 "http://localhost:5173" "$ROOT" npm run dev

if [ "$ASSISTANT" = 1 ]; then
  echo "Starting AI assistant on http://127.0.0.1:8000 ..."
  start assistant 8000 "http://127.0.0.1:8000" "$ROOT/assistant" bash start.sh --no-prompt
fi

if [ ${#PIDS[@]} -eq 0 ]; then
  echo
  echo "Nothing was started."
  exit 0
fi

echo
echo "Started (press Ctrl+C to stop):"
for i in "${!NAMES[@]}"; do
  printf '  %-10s: %s\n' "${NAMES[$i]}" "${URLS[$i]}"
done
echo

# Keep running until every service has stopped; say which one ended.
running=${#PIDS[@]}
while [ "$running" -gt 0 ]; do
  wait -n 2>/dev/null
  running=0
  for i in "${!PIDS[@]}"; do
    if kill -0 "${PIDS[$i]}" 2>/dev/null; then
      running=$((running + 1))
    elif [ -n "${NAMES[$i]}" ]; then
      echo "[${NAMES[$i]}] stopped."
      NAMES[$i]=""
    fi
  done
done
