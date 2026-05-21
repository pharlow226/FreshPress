# FreshPress - Deploy Supabase Edge Functions
# Run: powershell -ExecutionPolicy Bypass -File ".\deploy-edge-functions.ps1"

$ErrorActionPreference = "Continue"
$SUPABASE    = "$env:USERPROFILE\supabase-bin\supabase.exe"
$PROJECT_REF = "pofiytkpduprbkmgunbg"

Write-Host ""
Write-Host "=== FreshPress Edge Function Deployer ===" -ForegroundColor Cyan
Write-Host ""

# -- Check CLI exists ---------------------------------------------------------
if (-not (Test-Path $SUPABASE)) {
    Write-Host "ERROR: Supabase CLI not found at $SUPABASE" -ForegroundColor Red
    exit 1
}

# -- Read .env secrets ---------------------------------------------------------
$envFile = "$PSScriptRoot\.env"
if (-not (Test-Path $envFile)) {
    Write-Host "ERROR: .env file not found at $envFile" -ForegroundColor Red
    exit 1
}

$envVars = @{}
Get-Content $envFile | Where-Object { $_ -match "^[A-Z].*=.+" } | ForEach-Object {
    $parts = $_ -split "=", 2
    $envVars[$parts[0].Trim()] = $parts[1].Trim()
}

$RESEND_KEY       = $envVars["RESEND_API_KEY"]
$BREVO_KEY        = $envVars["BREVO_API_KEY"]
$BREVO_LIST       = $envVars["BREVO_LIST_ID"]
$SERVICE_ROLE_KEY = $envVars["SUPABASE_SERVICE_ROLE_KEY"]

if (-not $RESEND_KEY -or $RESEND_KEY -like "*your_*") {
    Write-Host "ERROR: RESEND_API_KEY is missing or still a placeholder in .env" -ForegroundColor Red
    exit 1
}

if (-not $SERVICE_ROLE_KEY -or $SERVICE_ROLE_KEY -like "*your_*") {
    Write-Host "ERROR: SUPABASE_SERVICE_ROLE_KEY is missing or still a placeholder in .env" -ForegroundColor Red
    exit 1
}

Write-Host "Secrets read from .env" -ForegroundColor Green

# -- Access token --------------------------------------------------------------
Write-Host ""
Write-Host "Get your Supabase access token from:" -ForegroundColor Yellow
Write-Host "  https://supabase.com/dashboard/account/tokens" -ForegroundColor Yellow
Write-Host ""
$ACCESS_TOKEN = Read-Host "Paste your Supabase Access Token (input is hidden)" 

if (-not $ACCESS_TOKEN -or $ACCESS_TOKEN.Length -lt 10) {
    Write-Host "ERROR: Token looks invalid." -ForegroundColor Red
    exit 1
}

# -- Step 1: Login -------------------------------------------------------------
Write-Host ""
Write-Host "[1/4] Logging in..." -ForegroundColor Cyan
$env:SUPABASE_ACCESS_TOKEN = $ACCESS_TOKEN
$loginOut = & $SUPABASE login --token $ACCESS_TOKEN 2>&1
$loginOut | Where-Object { $_ -notmatch 'new version' } | ForEach-Object { Write-Host "      $_" }
Write-Host "      OK" -ForegroundColor Green

# -- Step 2: Link project ------------------------------------------------------
Write-Host "[2/4] Linking project $PROJECT_REF..." -ForegroundColor Cyan
Set-Location $PSScriptRoot
$linkOut = & $SUPABASE link --project-ref $PROJECT_REF 2>&1
$linkOut | Where-Object { $_ -notmatch 'new version' } | ForEach-Object { Write-Host "      $_" }
Write-Host "      OK" -ForegroundColor Green

# -- Step 3: Set secrets -------------------------------------------------------
Write-Host "[3/4] Setting Edge Function secrets..." -ForegroundColor Cyan

$secretsList = @(
    "RESEND_API_KEY=$RESEND_KEY",
    "SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY"
)

if ($BREVO_KEY -and ($BREVO_KEY -notlike "*your_*")) {
    $secretsList += "BREVO_API_KEY=$BREVO_KEY"
    Write-Host "      Brevo API key included" -ForegroundColor Gray
} else {
    Write-Host "      Brevo key not configured yet - add later" -ForegroundColor Yellow
}

if ($BREVO_LIST -and ($BREVO_LIST -notlike "*your_*")) {
    $secretsList += "BREVO_LIST_ID=$BREVO_LIST"
}

# Splat the array as arguments to the external executable
$setArgs = @("secrets", "set") + $secretsList
& $SUPABASE @setArgs 2>&1 | ForEach-Object {
    Write-Host "      $_"
}
Write-Host "      Secrets set" -ForegroundColor Green

# -- Step 4: Deploy ------------------------------------------------------------
Write-Host "[4/4] Deploying create-order function..." -ForegroundColor Cyan
& $SUPABASE functions deploy create-order --project-ref $PROJECT_REF 2>&1 | ForEach-Object {
    Write-Host "      $_"
}

# -- Done ----------------------------------------------------------------------
Write-Host ""
Write-Host "=== Deployment Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Edge Function URL:" -ForegroundColor White
Write-Host "  https://$PROJECT_REF.supabase.co/functions/v1/create-order" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Restart the dev server (Ctrl+C then npm run dev)" -ForegroundColor Yellow
Write-Host "  2. Test a pickup booking at http://localhost:5173/request-pickup" -ForegroundColor Yellow
Write-Host "  3. Check your email for the Resend confirmation" -ForegroundColor Yellow
