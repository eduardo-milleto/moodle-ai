#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: scripts/deploy-vps.sh root@SERVER_IP"
  exit 1
fi

TARGET="$1"
REMOTE_SETUP="/tmp/moodle-ai-setup.sh"

scp setup.sh "$TARGET:$REMOTE_SETUP"
ssh "$TARGET" "chmod +x $REMOTE_SETUP && $REMOTE_SETUP"

