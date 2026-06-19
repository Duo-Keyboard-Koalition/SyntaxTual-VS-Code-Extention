#!/usr/bin/env bash
# Start an X server with VNC on a given display/port, no VNC password.
# Usage: start-vnc.sh <display_num> <rfbport>
set -e

export HOME=/home/user
export USER=user

DISPLAY_NUM="$1"
RFBPORT="$2"

# Clean up any stale lock from a previous run
rm -f "/tmp/.X${DISPLAY_NUM}-lock" "/tmp/.X11-unix/X${DISPLAY_NUM}" 2>/dev/null || true

exec Xtigervnc ":${DISPLAY_NUM}" \
    -geometry 1440x900 \
    -depth 24 \
    -rfbport "${RFBPORT}" \
    -SecurityTypes None \
    -AlwaysShared
