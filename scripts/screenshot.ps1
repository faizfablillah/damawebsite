# Full-page screenshots of a site page with headless Edge, for visual checks.
# Usage: powershell -File scripts\screenshot.ps1 index [outDir]
# Mobile is captured at 540px: headless Edge will not lay out narrower than that.
param([string]$Page = "index", [string]$OutDir = "screenshots")
$edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") |
  Where-Object { Test-Path $_ } | Select-Object -First 1
New-Item -ItemType Directory -Force $OutDir | Out-Null
$root = Split-Path $PSScriptRoot -Parent
$url = "file:///" + ((Join-Path $root "docs\$Page.html") -replace '\\', '/')
foreach ($v in @(@{n = "desktop"; w = 1440; h = 9000 }, @{n = "mobile"; w = 540; h = 16000 })) {
  $out = Join-Path (Resolve-Path $OutDir) "$Page-$($v.n).png"
  & $edge --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=5000 "--window-size=$($v.w),$($v.h)" "--screenshot=$out" $url 2>$null | Out-Null
  Write-Output $out
}
