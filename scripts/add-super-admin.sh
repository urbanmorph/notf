#!/bin/bash
# Add a NOTF super admin (maintainer only). Super admins can't be added or changed
# from the admin panel; everyone else is invited there (Admins page) as an admin
# or viewer. See ACCESS.md "Admin accounts".
#
#   1. Supabase emails them an invitation; its link opens
#      https://www.notf.in/admin/reset-password.html, where they set a password.
#      (Needs Auth → URL Configuration: Site URL https://www.notf.in, and that page
#      in Redirect URLs.)
#   2. Makes their admin_users row role 'super_admin', notf_role 'admin', active.
#
# Uses SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from scripts/.env (gitignored).
# Prints no keys. Safe to re-run: no second invitation, no duplicate row.
#
# Usage: bash scripts/add-super-admin.sh <email> "<Name>"
set -euo pipefail
EMAIL="${1:?usage: bash scripts/add-super-admin.sh <email> \"<Name>\"}"
NAME="${2:?usage: bash scripts/add-super-admin.sh <email> \"<Name>\"}"
cd "$(dirname "$0")"
set -a; . ./.env; set +a
AUTH=(-H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" -H "Content-Type: application/json")
REDIRECT="https://www.notf.in/admin/reset-password.html"
json() { python3 -c 'import json,os,sys; print(json.dumps({k: os.environ[k] for k in sys.argv[1:]}))' "$@"; }

# 1. Invite, or find the existing account.
USER_ID=$(curl -s "$SUPABASE_URL/auth/v1/admin/users?per_page=1000" "${AUTH[@]}" |
  EMAIL="$EMAIL" python3 -c 'import json,os,sys; print(next((u["id"] for u in json.load(sys.stdin).get("users",[]) if u.get("email","").lower()==os.environ["EMAIL"].lower()),""))')
if [ -z "$USER_ID" ]; then
  RESP=$(email="$EMAIL" json email | curl -s -X POST "$SUPABASE_URL/auth/v1/invite?redirect_to=$REDIRECT" "${AUTH[@]}" --data @-)
  USER_ID=$(printf '%s' "$RESP" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("id",""))' 2>/dev/null || true)
  [ -n "$USER_ID" ] || { echo "Invite failed: $(printf '%s' "$RESP" | head -c 300)"; exit 1; }
  echo "Invitation emailed to $EMAIL"
else
  echo "$EMAIL already has an account; no invitation sent (they can use \"Forgot password?\")."
fi

# 2. Super admin with full NOTF access.
EXISTING=$(curl -s "$SUPABASE_URL/rest/v1/admin_users?select=id&user_id=eq.$USER_ID" "${AUTH[@]}")
ROW=$(user_id="$USER_ID" name="$NAME" email="$EMAIL" role="super_admin" notf_role="admin" json user_id name email role notf_role)
if [ "$EXISTING" = "[]" ]; then
  CODE=$(printf '%s' "$ROW" | curl -s -o /dev/null -w "%{http_code}" -X POST "$SUPABASE_URL/rest/v1/admin_users" "${AUTH[@]}" -H "Prefer: return=minimal" --data @-)
else
  CODE=$(printf '{"role":"super_admin","notf_role":"admin","is_active":true}' | curl -s -o /dev/null -w "%{http_code}" -X PATCH "$SUPABASE_URL/rest/v1/admin_users?user_id=eq.$USER_ID" "${AUTH[@]}" -H "Prefer: return=minimal" --data @-)
fi
case "$CODE" in 201|204) echo "$NAME is a super admin." ;; *) echo "Updating admin_users failed (HTTP $CODE)"; exit 1 ;; esac
