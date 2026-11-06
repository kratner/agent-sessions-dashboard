#!/bin/sh
# Installs or updates Agent Sessions Dashboard from the latest GitHub release.
#   curl -fsSL https://raw.githubusercontent.com/kratner/agent-sessions-dashboard/main/scripts/install.sh | sh
# macOS and Linux. Set VSCODE_CLI to use another VS Code-compatible CLI (e.g. code-insiders).
set -eu

REPO=kratner/agent-sessions-dashboard
json=$(curl -fsSL -H 'User-Agent: agent-sessions-dashboard-installer' -H 'Accept: application/vnd.github+json' \
  "https://api.github.com/repos/$REPO/releases/latest")

# Each release carries exactly one .vsix; pull its URL and published SHA-256 out of the JSON.
url=$(printf '%s' "$json" | grep -o '"browser_download_url": *"[^"]*\.vsix"' | head -n 1 | sed 's/.*"\(https[^"]*\)"$/\1/')
digest=$(printf '%s' "$json" | grep -o '"digest": *"sha256:[0-9a-f]*"' | head -n 1 | sed 's/.*sha256:\([0-9a-f]*\)"$/\1/' || true)
tag=$(printf '%s' "$json" | grep -o '"tag_name": *"[^"]*"' | head -n 1 | sed 's/.*"\([^"]*\)"$/\1/')
[ -n "$url" ] || { echo "Release $tag has no .vsix file." >&2; exit 1; }

file="${TMPDIR:-/tmp}/$(basename "$url")"
echo "Downloading $(basename "$url")..."
curl -fsSL -o "$file" "$url"

if [ -n "$digest" ]; then
  if command -v sha256sum >/dev/null 2>&1; then actual=$(sha256sum "$file" | cut -d' ' -f1)
  else actual=$(shasum -a 256 "$file" | cut -d' ' -f1); fi
  if [ "$actual" != "$digest" ]; then
    rm -f "$file"
    echo "Checksum mismatch: the download is not the published file." >&2
    exit 1
  fi
  echo "Checksum verified."
fi

code="${VSCODE_CLI:-}"
if [ -z "$code" ]; then
  if command -v code >/dev/null 2>&1; then code=code
  elif [ -x "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code" ]; then code="/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code"
  else echo "Can't find the 'code' command. In VS Code run: Shell Command: Install 'code' command in PATH" >&2; exit 1; fi
fi
"$code" --install-extension "$file" --force
rm -f "$file"

echo ""
echo "Agent Sessions Dashboard $tag installed."
echo "In each open VS Code window, run: Developer: Reload Window"
