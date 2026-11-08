#!/usr/bin/env bash
# Push every variable in a .env-style file to a Vercel project environment.
#
#   npx vercel link                      # once, in the repo root
#   cp .env.example .env.production.local
#   # edit .env.production.local with your production values
#   scripts/vercel-env.sh .env.production.local production
#
# Existing variables with the same name are replaced. Lines starting with #
# and blank lines are ignored. Values may be quoted.
set -euo pipefail

FILE="${1:-.env.production.local}"
TARGET="${2:-production}"
[ -f "$FILE" ] || { echo "No such file: $FILE" >&2; exit 1; }

while IFS= read -r line || [ -n "$line" ]; do
  line="${line%%$'\r'}"
  [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
  key="${line%%=*}"; value="${line#*=}"
  key="$(echo "$key" | xargs)"
  value="$(echo "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")"
  [ -z "$key" ] && continue
  npx vercel env rm "$key" "$TARGET" --yes >/dev/null 2>&1 || true
  printf '%s' "$value" | npx vercel env add "$key" "$TARGET" >/dev/null
  echo "set $key ($TARGET)"
done < "$FILE"
echo "Done. Redeploy for the changes to take effect: npx vercel --prod"
