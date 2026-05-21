# deploy-all-functions.ps1
# Run this from the FreshPress project root to deploy all 6 edge functions.
# Requires: Supabase CLI installed (winget install Supabase.CLI)
# Before running: supabase login

$project = "pofiytkpduprbkmgunbg"
$root    = "C:\Users\hp\Desktop\Laundry website\FreshPress"
$funDir  = "$root\supabase\functions"

# Map: function-name => standalone source file
$functions = @{
    "generate-invoice"      = "$funDir\generate-invoice-standalone.ts"
    "mark-picked-up"        = "$funDir\mark-picked-up-standalone.ts"
    "mark-delivered"        = "$funDir\mark-delivered-standalone.ts"
    "mark-order-delayed"    = "$funDir\mark-order-delayed-standalone.ts"
    "confirm-payment"       = "$funDir\confirm-payment-standalone.ts"
    "save-company-settings" = "$funDir\save-company-settings-standalone.ts"
}

Write-Host "`n== FreshPress Edge Function Deployer ==" -ForegroundColor Cyan
Write-Host "Project: $project`n"

foreach ($name in $functions.Keys) {
    $src     = $functions[$name]
    $destDir = "$funDir\$name"
    $dest    = "$destDir\index.ts"

    # Create proper function directory
    if (-not (Test-Path $destDir)) {
        New-Item -ItemType Directory -Path $destDir | Out-Null
    }

    # Copy standalone file as index.ts
    Copy-Item -Path $src -Destination $dest -Force
    Write-Host "Copied: $name" -ForegroundColor Gray

    # Deploy via Supabase CLI
    Write-Host "Deploying: $name ..." -ForegroundColor Yellow
    $result = supabase functions deploy $name --project-ref $project 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  SUCCESS: $name deployed" -ForegroundColor Green
    } else {
        Write-Host "  FAILED: $name" -ForegroundColor Red
        Write-Host "  $result"
    }
}

Write-Host "`nDone! Check Supabase Dashboard -> Edge Functions to verify." -ForegroundColor Cyan
