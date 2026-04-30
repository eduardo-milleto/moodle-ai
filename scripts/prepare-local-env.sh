#!/usr/bin/env bash
set -euo pipefail

LOCAL_ENV="${LOCAL_ENV:-/Users/eduardomilleto/Documents/env/.env}"

if [ ! -f "$LOCAL_ENV" ]; then
  echo "Missing $LOCAL_ENV"
  exit 1
fi

chmod 600 "$LOCAL_ENV"
echo "Using local secret file: $LOCAL_ENV"

if ! grep -q '^hostinger_api_nexor=' "$LOCAL_ENV"; then
  echo "hostinger_api_nexor is not present. Add it when you want VPS automation."
fi

