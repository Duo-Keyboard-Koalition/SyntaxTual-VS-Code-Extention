#!/usr/bin/env bash
# Wait for an X display, start a lightweight WM + panel, then exec an app.
# Usage: start-app.sh <display_num> <command> [args...]
set -e

export HOME=/home/user
export USER=user

DISPLAY_NUM="$1"
shift
export DISPLAY=":${DISPLAY_NUM}"

# Wait until the X display from start-vnc.sh is up
for i in $(seq 1 30); do
    if xdpyinfo >/dev/null 2>&1; then
        break
    fi
    sleep 1
done

# Lightweight window manager + panel for this display
openbox &
tint2 &

exec "$@"
