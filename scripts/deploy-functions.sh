#!/usr/bin/env bash
set -euo pipefail

"$(dirname "$0")/vendor-functions.sh"
supabase functions deploy daily-suggest --no-verify-jwt
supabase functions deploy delete-account
