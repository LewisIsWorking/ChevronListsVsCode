# release.ps1 - Chevron Lists release helper
# Usage: .\release.ps1 -Version 0.0.2

param (
    [Parameter(Mandatory=$true)]
    [string]$Version
)

$ProjectRoot = $PSScriptRoot
$PackageJson = Join-Path $ProjectRoot "package.json"
$Changelog   = Join-Path $ProjectRoot "CHANGELOG.md"

# ── 1. Validate version format ────────────────────────────────────────────────
if ($Version -notmatch '^\d+\.\d+\.\d+$') {
    Write-Error "Version must be in format X.Y.Z (e.g. 0.0.2)"
    exit 1
}

# ── 2. Read current version from package.json ─────────────────────────────────
$pkg = Get-Content $PackageJson -Raw | ConvertFrom-Json
$currentVersion = $pkg.version

if ($Version -eq $currentVersion) {
    Write-Error "Version $Version is already the current version. Bump it first."
    exit 1
}

Write-Host ""
Write-Host "  Chevron Lists - Release Script" -ForegroundColor Cyan
Write-Host "  $currentVersion  →  $Version" -ForegroundColor Cyan
Write-Host ""

# ── 3. Check CHANGELOG has an entry for this version ─────────────────────────
$changelogContent = Get-Content $Changelog -Raw
if ($changelogContent -notmatch [regex]::Escape("## [$Version]")) {
    Write-Host "  ⚠  No CHANGELOG entry found for [$Version]." -ForegroundColor Yellow
    Write-Host "     Please add one to CHANGELOG.md before releasing." -ForegroundColor Yellow
    Write-Host ""
    $confirm = Read-Host "  Continue anyway? (y/N)"
    if ($confirm -ne 'y') { exit 1 }
}

# ── 4. Run tests ─────────────────────────────────────────────────────────────
Write-Host "  [1/5] Running tests..." -ForegroundColor Gray
Push-Location $ProjectRoot
$testResult = & bun test src/__tests__ 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Tests failed - release aborted:`n$testResult"
    Pop-Location
    exit 1
}
Write-Host "        All tests passed." -ForegroundColor Green
Pop-Location

# ── 5. Bump version in package.json ──────────────────────────────────────────
Write-Host "  [2/5] Bumping package.json to $Version..." -ForegroundColor Gray
$pkg.version = $Version
$pkg | ConvertTo-Json -Depth 10 | Set-Content $PackageJson -Encoding UTF8
Write-Host "        Done." -ForegroundColor Green

# ── 6. Bundle ────────────────────────────────────────────────────────────────
Write-Host "  [3/5] Type-checking and bundling..." -ForegroundColor Gray
Push-Location $ProjectRoot
$compileResult = & bun run compile 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Type-check failed:`n$compileResult"
    Pop-Location
    exit 1
}
$bundleResult = & bun run bundle:prod 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Bundle failed:`n$bundleResult"
    Pop-Location
    exit 1
}
Write-Host "        Done." -ForegroundColor Green

# ── 7. Package ────────────────────────────────────────────────────────────────
Write-Host "  [4/5] Packaging .vsix..." -ForegroundColor Gray
$packageResult = & bunx @vscode/vsce package 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Packaging failed:`n$packageResult"
    Pop-Location
    exit 1
}
$vsixFile = "chevron-lists-$Version.vsix"
Write-Host "        Created: $vsixFile" -ForegroundColor Green

# ── 8. Commit and push ────────────────────────────────────────────────────────
Write-Host "  [5/5] Committing and pushing to GitHub..." -ForegroundColor Gray
& git add .
& git commit -m "Release v$Version"
& git push origin master
Write-Host "        Done." -ForegroundColor Green

Pop-Location

# ── 9. Done - open Marketplace upload page ───────────────────────────────────
Write-Host ""
Write-Host "  ✅ Release $Version ready!" -ForegroundColor Green
Write-Host ""
Write-Host "  Next step - upload the .vsix to the Marketplace:" -ForegroundColor White
Write-Host "  https://marketplace.visualstudio.com/manage/publishers/lewisisworking" -ForegroundColor Cyan
Write-Host ""
Write-Host "  File to upload:" -ForegroundColor White
Write-Host "  $ProjectRoot\$vsixFile" -ForegroundColor Cyan
Write-Host ""

$open = Read-Host "  Open the Marketplace page now? (Y/n)"
if ($open -ne 'n') {
    Start-Process "https://marketplace.visualstudio.com/manage/publishers/lewisisworking"
}
