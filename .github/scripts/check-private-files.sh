#!/usr/bin/env bash
# Quantora CI · private/prohibited file protection (tracked files only).
#
# Fails if the repository tracks files that must never exist in quantora-web:
#   - EA/binary artifacts: .mq5, .ex5, .set, .dll
#   - environment files: .env, .env.local, .env.* (except .env.example)
#   - credentials/private keys/secret- or token-named config files
#
# Scans tracked files only via `git ls-files` (never node_modules).
# Prints only file paths on failure — never file contents.
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
cd "$root"

report_and_fail() {
  local msg="$1" list="$2"
  echo "::error::$msg"
  printf '%s\n' "$list" | sed 's/^/  /'
  exit 1
}

# 1) Forbidden EA/binary extensions.
ea="$(git ls-files -z | tr '\0' '\n' | grep -Ei '\.(mq5|ex5|set|dll)$' || true)"
[ -z "$ea" ] || report_and_fail "Forbidden private EA file(s) tracked in the repository:" "$ea"

# 2) Environment files (.env.example is allowed).
env="$(git ls-files -z | tr '\0' '\n' \
  | grep -Ei '(^|/)(\.env(\.local)?|\.env\.[^/]+)$' \
  | grep -Ev '(^|/)\.env\.example$' || true)"
[ -z "$env" ] || report_and_fail "Forbidden environment file(s) tracked in the repository:" "$env"

# 3) Credentials, private keys and secret/token-named config files.
secrets="$(git ls-files -z | tr '\0' '\n' \
  | grep -Ei '\.(pem|key|p12|pfx)$|(^|/)(id_rsa|id_ed25519|id_ecdsa|\.git-credentials|\.netrc)$|(^|/)[^/]*(token|secret|credential)[^/]*\.(json|txt|env|ini|yml|yaml|sh|toml)$' || true)"
[ -z "$secrets" ] || report_and_fail "Forbidden credential/secret file(s) tracked in the repository:" "$secrets"

echo "Private file protection: OK (no .mq5/.ex5/.set/.dll or secret files tracked)"
