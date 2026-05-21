# FreshPress Phase 1 — File Copy Script
# Run this once from: C:\Users\hp\Desktop\Laundry website
# Usage: powershell -ExecutionPolicy Bypass -File .\copy-to-freshpress.ps1

$root = "C:\Users\hp\Desktop\Laundry website"
$src1 = "$root\freshpresslaundryservice-main\src"  # Customer
$src2 = "$root\stafffreshpress-main\src"            # Staff
$dst  = "$root\FreshPress\src"                      # Merged

Write-Host "FreshPress Phase 1 - File Copy" -ForegroundColor Cyan

# 1. shadcn UI components (49 files — single copy)
New-Item -Path "$dst\components\ui" -ItemType Directory -Force | Out-Null
Copy-Item "$src1\components\ui\*" "$dst\components\ui\" -Recurse -Force
Write-Host "✅ UI components: $((Get-ChildItem "$dst\components\ui").Count) files"

# 2. Hooks
New-Item -Path "$dst\hooks" -ItemType Directory -Force | Out-Null
Copy-Item "$src1\hooks\*" "$dst\hooks\" -Force
Write-Host "✅ Hooks: $((Get-ChildItem "$dst\hooks").Count) files"

# 3. Assets
New-Item -Path "$dst\assets" -ItemType Directory -Force | Out-Null
Copy-Item "$src1\assets\*" "$dst\assets\" -Recurse -Force
Write-Host "✅ Assets: $((Get-ChildItem "$dst\assets" -Recurse -File).Count) files"

# 4. Customer: PriceCard + Landing
$custDst = "$dst\routes\customer\components"
New-Item -Path $custDst -ItemType Directory -Force | Out-Null
Copy-Item "$src1\components\PriceCard.tsx" "$custDst\PriceCard.tsx" -Force
Write-Host "✅ PriceCard copied"

# Note: OrderPage, ChatWidget, OrderTrackingPage, PricingPage already written
# by the migration tool with corrected imports. Do NOT overwrite them.

# 5. Admin sub-components (OverviewPage, AllOrdersPage, etc.)
$adminDst = "$dst\routes\admin\components"
New-Item -Path $adminDst -ItemType Directory -Force | Out-Null
foreach ($f in @("OverviewPage","AllOrdersPage","StaffManagementPage","CustomersPage","ActivityLogPage","PricingManagementPage")) {
  if (-not (Test-Path "$adminDst\$f.tsx")) {
    Copy-Item "$src2\components\admin\$f.tsx" "$adminDst\$f.tsx" -Force
    Write-Host "  Copied: $f.tsx"
  } else {
    Write-Host "  Skipped (already exists): $f.tsx"
  }
}
Write-Host "✅ Admin components done"

# 6. Accountant sub-components
$accDst = "$dst\routes\accountant\components"
New-Item -Path $accDst -ItemType Directory -Force | Out-Null
Copy-Item "$src2\components\accountant\*" "$accDst\" -Force
Write-Host "✅ Accountant components: $((Get-ChildItem $accDst).Count) files"

Write-Host ""
Write-Host "Phase 1 copy complete!" -ForegroundColor Green
Write-Host "Next: cd FreshPress && npm install && npm run dev"
