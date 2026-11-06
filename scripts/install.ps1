# Installs or updates Agent Sessions Dashboard from the latest GitHub release.
#   irm https://raw.githubusercontent.com/kratner/agent-workspace-dashboard/main/scripts/install.ps1 | iex
# Works in Windows PowerShell 5.1 and PowerShell 7. Set $env:VSCODE_CLI to use another
# VS Code-compatible CLI (e.g. code-insiders).
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

$repo = 'kratner/agent-workspace-dashboard'
$headers = @{ 'User-Agent' = 'agent-workspace-dashboard-installer'; 'Accept' = 'application/vnd.github+json' }
$release = Invoke-RestMethod "https://api.github.com/repos/$repo/releases/latest" -Headers $headers
$asset = $release.assets | Where-Object { $_.name -like '*.vsix' } | Select-Object -First 1
if (-not $asset) { throw "Release $($release.tag_name) has no .vsix file." }

$file = Join-Path ([IO.Path]::GetTempPath()) $asset.name
Write-Host "Downloading $($asset.name)..."
Invoke-WebRequest $asset.browser_download_url -OutFile $file -UseBasicParsing

# GitHub publishes a SHA-256 for each release file; refuse anything that doesn't match.
if ($asset.digest -and $asset.digest.StartsWith('sha256:')) {
  $actual = (Get-FileHash $file -Algorithm SHA256).Hash.ToLower()
  if ($actual -ne $asset.digest.Substring(7)) {
    Remove-Item $file -Force
    throw "Checksum mismatch for $($asset.name): the download is not the published file."
  }
  Write-Host 'Checksum verified.'
}

$code = $env:VSCODE_CLI
if (-not $code) {
  if (Get-Command code -ErrorAction SilentlyContinue) { $code = 'code' }
  else { $code = Join-Path $env:LOCALAPPDATA 'Programs\Microsoft VS Code\bin\code.cmd' }
}
& $code --install-extension $file --force
if ($LASTEXITCODE -ne 0) { throw "Installing with '$code' failed." }
Remove-Item $file -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Agent Sessions Dashboard $($release.tag_name) installed."
Write-Host "In each open VS Code window, run: Developer: Reload Window"
