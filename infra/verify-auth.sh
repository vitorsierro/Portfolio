#!/usr/bin/env bash
# Asserts the auth contract the whole design rests on. Run against the API
# directly (dev) or through nginx (VPS rehearsal / production).
#
#   ./infra/verify-auth.sh http://localhost:3001 admin@vitorsierro.dev 'ChangeMe123!'
#
# Every check is a claim that must hold. A failure here means the login gate
# or the CSRF protection is not doing what it's supposed to.
set -uo pipefail

BASE="${1:?usage: verify-auth.sh <base-url> <email> <password>}"
EMAIL="${2:?missing email}"
PASSWORD="${3:?missing password}"
ORIGIN="${ORIGIN:-http://localhost:3000}"

JAR="$(mktemp)"
trap 'rm -f "$JAR"' EXIT

pass=0; fail=0
check() { # check <label> <expected> <actual>
  if [ "$2" = "$3" ]; then
    printf '  \033[32mPASS\033[0m  %-58s %s\n' "$1" "$3"; pass=$((pass+1))
  else
    printf '  \033[31mFAIL\033[0m  %-58s got %s, want %s\n' "$1" "$3" "$2"; fail=$((fail+1))
  fi
}
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

echo "== Public surface =="
check "GET /posts is public"                200 "$(code "$BASE/posts?limit=1")"
check "GET /admin/posts needs a token"      401 "$(code "$BASE/admin/posts")"

echo
echo "== Forward-auth contract (what nginx relies on) =="
check "/auth/verify without a session"      401 "$(code "$BASE/auth/verify")"

echo
echo "== Login =="
check "POST /auth/login with credentials"   200 "$(code -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' -H "Origin: $ORIGIN" -c "$JAR" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")"
check "wrong password is rejected"          401 "$(code -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' -H "Origin: $ORIGIN" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"definitely-not-it\"}")"

SESSION_SET=$(grep -c -E 'admin_session' "$JAR" || true)
check "login sets a session cookie"           1 "$SESSION_SET"

echo
echo "== Session gates the tools =="
check "/auth/verify with a session"         204 "$(code -b "$JAR" "$BASE/auth/verify")"

echo
echo "== Forward-auth must survive a tool's Origin header =="
# Regression: nginx copies the original request's headers into the auth
# subrequest, so a browser's cross-origin subresource request arrives here
# carrying the TOOL's Origin — which is deliberately absent from the CORS
# allowlist. Rejecting it with an error turned every asset request into a
# 500 and broke the gate. Must stay a clean 204.
check "/auth/verify with a tool Origin"     204 "$(code -b "$JAR" \
  -H 'Origin: https://draw.example.com' "$BASE/auth/verify")"

echo
echo "== CSRF invariant: cookies must NEVER authorise a mutation =="
# The whole design depends on JwtAuthGuard reading only the Authorization
# header. If this ever returns 2xx, every admin mutation became forgeable
# from any page the browser can be lured to.
check "POST /posts with cookie but no bearer" 401 "$(code -X POST "$BASE/posts" \
  -b "$JAR" -H 'Content-Type: application/json' -H "Origin: $ORIGIN" \
  -d '{"title":"csrf","slug":"csrf-probe","body":"x"}')"
check "DELETE /posts/:id with cookie only"    401 "$(code -X DELETE "$BASE/posts/any-id" -b "$JAR")"

echo
echo "== Cookie routes reject foreign origins =="
TOOL_ORIGIN=$(code -X POST "$BASE/auth/refresh" -b "$JAR" -H 'Origin: https://draw.example.com')
if [ "$TOOL_ORIGIN" = "403" ] || [ "$TOOL_ORIGIN" = "500" ]; then
  printf '  \033[32mPASS\033[0m  %-58s %s (blocked)\n' "/auth/refresh from a tool subdomain" "$TOOL_ORIGIN"; pass=$((pass+1))
else
  printf '  \033[31mFAIL\033[0m  %-58s got %s, want 403/500\n' "/auth/refresh from a tool subdomain" "$TOOL_ORIGIN"; fail=$((fail+1))
fi

echo
echo "== Logout revokes the session server-side =="
check "POST /auth/logout"                   200 "$(code -X POST "$BASE/auth/logout" -b "$JAR" -c "$JAR" -H "Origin: $ORIGIN")"
check "/auth/verify after logout"           401 "$(code -b "$JAR" "$BASE/auth/verify")"

echo
printf '%s passed, %s failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ] || exit 1
