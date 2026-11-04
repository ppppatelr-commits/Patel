$ErrorActionPreference = 'Stop'
$base = 'http://localhost:3000'

function Post-Json($url, $obj, $session) {
  return Invoke-RestMethod -Uri $url -Method POST -Body ($obj | ConvertTo-Json) -ContentType 'application/json' -WebSession $session
}

function Get-Status($url, $session) {
  try {
    $r = Invoke-WebRequest -Uri $url -WebSession $session -TimeoutSec 15 -UseBasicParsing -MaximumRedirection 0
    return [int]$r.StatusCode
  } catch {
    return [int]$_.Exception.Response.StatusCode
  }
}

$s = New-Object Microsoft.PowerShell.Commands.WebRequestSession
Post-Json "$base/api/auth/login" @{ email = 'admin@hindustanrestaurant.com'; password = 'admin123' } $s | Out-Null

$meBefore = Get-Status "$base/api/auth/me" $s
$adminBefore = Get-Status "$base/admin" $s
Write-Host "Before logout /api/auth/me : $meBefore"
Write-Host "Before logout /admin       : $adminBefore"

Invoke-RestMethod -Uri "$base/api/auth/logout" -Method POST -WebSession $s | Out-Null

$meAfter = Get-Status "$base/api/auth/me" $s
$adminAfter = Get-Status "$base/admin" $s
Write-Host "After  logout /api/auth/me : $meAfter"
Write-Host "After  logout /admin       : $adminAfter"

$s2 = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$l = Post-Json "$base/api/auth/login" @{ email = 'admin@hindustanrestaurant.com'; password = 'admin123' } $s2
$adminAgain = Get-Status "$base/admin" $s2
Write-Host "Re-login role              : $($l.user.role)"
Write-Host "Re-login /admin            : $adminAgain"

$ok = ($meBefore -eq 200) -and ($adminBefore -eq 200) -and ($meAfter -eq 401) -and ($adminAfter -eq 307) -and ($l.user.role -eq 'admin') -and ($adminAgain -eq 200)
Write-Host ""
if ($ok) { Write-Host 'LOGOUT TEST: PASS' } else { Write-Host 'LOGOUT TEST: FAIL'; exit 1 }
