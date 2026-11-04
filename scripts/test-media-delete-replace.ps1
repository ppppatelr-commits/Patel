$ErrorActionPreference = 'Stop'
$base = 'http://localhost:3000'
$dishes = 'public\media\dishes\general'
$srcA = 'public\media\dishes\chicken-soups\chi-clear-soup.webp'
$srcB = 'public\media\dishes\chicken-soups\chi-manchow-soup.webp'

function Wait-Server {
  for ($i = 0; $i -lt 90; $i++) {
    try {
      $r = Invoke-WebRequest -Uri "$base/" -TimeoutSec 3 -UseBasicParsing
      if ($r.StatusCode -eq 200) { return $true }
    } catch {}
    Start-Sleep -Milliseconds 1000
  }
  return $false
}

function Check($name, $ok, $detail) {
  Write-Host ("{0,-46} {1}  {2}" -f $name, $(if ($ok) { 'PASS' } else { 'FAIL' }), $detail)
  if (-not $ok) { $script:failed++ }
}

$failed = 0
Write-Host '=== Waiting for dev server ==='
if (-not (Wait-Server)) { Write-Host 'FAIL: server not ready'; exit 1 }

New-Item -ItemType Directory -Force -Path $dishes | Out-Null

# ── 1. Single delete by local ID ─────────────────────────────────────
Copy-Item $srcA "$dishes\salman-test.webp" -Force
$media = Invoke-RestMethod -Uri "$base/api/media?search=salman-test" -TimeoutSec 30
Check 'New file appears in /api/media' (@($media).Count -ge 1) "count=$(@($media).Count)"

$del = Invoke-RestMethod -Uri "$base/api/media?id=local-general-salman-test.webp" -Method DELETE -TimeoutSec 30
Check 'Delete by local ID returns success' ($del.success -eq $true -and $del.physicalFileDeleted -eq $true) "deleted=$($del.physicalFileDeleted)"
Check 'File physically removed' (-not (Test-Path "$dishes\salman-test.webp")) 'gone'

# ── 2. Delete again -> 404, not a fake success ──────────────────────
try {
  Invoke-RestMethod -Uri "$base/api/media?id=local-general-salman-test.webp" -Method DELETE -TimeoutSec 30 | Out-Null
  Check 'Deleting missing file returns error' $false 'unexpected success'
} catch {
  $code = [int]$_.Exception.Response.StatusCode
  Check 'Deleting missing file returns error' ($code -eq 404) "status=$code"
}

# ── 3. Bulk delete ──────────────────────────────────────────────────
Copy-Item $srcA "$dishes\bulk-a.webp" -Force
Copy-Item $srcB "$dishes\bulk-b.webp" -Force
$body = @{ ids = @('local-general-bulk-a.webp', 'local-general-bulk-b.webp') } | ConvertTo-Json
$bulk = Invoke-RestMethod -Uri "$base/api/media/bulk" -Method POST -Body $body -ContentType 'application/json' -TimeoutSec 30
Check 'Bulk delete reports 2 deleted' ($bulk.deleted -eq 2) "deleted=$($bulk.deleted)/$($bulk.requested)"
Check 'Bulk files physically removed' ((-not (Test-Path "$dishes\bulk-a.webp")) -and (-not (Test-Path "$dishes\bulk-b.webp"))) 'gone'

# ── 4. Replace keeps the previous image ─────────────────────────────
Copy-Item $srcA "$dishes\replace-test.webp" -Force
$sizeA = (Get-Item "$dishes\replace-test.webp").Length
$sizeB = (Get-Item $srcB).Length
$raw = curl.exe -s -X POST -F "file=@public/media/dishes/chicken-soups/chi-manchow-soup.webp;type=image/webp" -F "path=/media/dishes/general/replace-test.webp" "$base/api/media/replace"
$rep = $raw | ConvertFrom-Json
Check 'Replace API returns success' ($rep.success -eq $true) "fileUrl=$($rep.fileUrl)"
Check 'Replace kept a previous copy' ($rep.archivedUrl -like '*replace-test-previous-*') "archived=$($rep.archivedUrl)"

$sizeAfter = (Get-Item "$dishes\replace-test.webp").Length
Check 'Canonical file now holds new bytes' ($sizeAfter -eq $sizeB) "size=$sizeAfter expected=$sizeB (old=$sizeA)"

$archivedName = Split-Path -Leaf $rep.archivedUrl
$archivedFull = Join-Path $dishes $archivedName
$archivedExists = Test-Path $archivedFull
Check 'Archived previous file exists on disk' $archivedExists $archivedName
if ($archivedExists) {
  $archivedSize = (Get-Item $archivedFull).Length
  Check 'Archived file holds the old bytes' ($archivedSize -eq $sizeA) "size=$archivedSize expected=$sizeA"
}

# ── 5. Media library lists both, old one marked (previous) ──────────
$list = Invoke-RestMethod -Uri "$base/api/media?search=replace-test" -TimeoutSec 30
$names = @($list | ForEach-Object { $_.dish_name })
Check 'Media list contains new + previous' (@($list).Count -eq 2) ($names -join ' | ')
Check 'Previous entry is labelled' (($names -join ' ') -match '\(previous\)') ($names -join ' | ')

# ── Clean up ────────────────────────────────────────────────────────
Remove-Item "$dishes\replace-test.webp" -Force -ErrorAction SilentlyContinue
Get-ChildItem $dishes -Filter 'replace-test-previous-*' -File | Remove-Item -Force -ErrorAction SilentlyContinue
if ((Test-Path $dishes) -and -not (Get-ChildItem $dishes -Force)) { Remove-Item $dishes -Force }

Write-Host ''
if ($failed -eq 0) { Write-Host 'MEDIA TEST: ALL PASS' } else { Write-Host "MEDIA TEST: $failed FAILED"; exit 1 }
