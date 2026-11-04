$ErrorActionPreference = 'Stop'
$base = 'http://localhost:3000'

function Post-Json($url, $obj, $session) {
  return Invoke-RestMethod -Uri $url -Method POST -Body ($obj | ConvertTo-Json) -ContentType 'application/json' -WebSession $session
}

function Get-Status($url, $session) {
  try {
    $r = Invoke-WebRequest -Uri $url -WebSession $session -TimeoutSec 20 -UseBasicParsing -MaximumRedirection 0
    return [int]$r.StatusCode
  } catch {
    return [int]$_.Exception.Response.StatusCode
  }
}

$admin = New-Object Microsoft.PowerShell.Commands.WebRequestSession
Post-Json "$base/api/auth/login" @{ email = 'admin@hindustanrestaurant.com'; password = 'admin123' } $admin | Out-Null

$tmp = Post-Json "$base/api/users" @{ name = 'Page Check'; email = 'page-check@hindustanrestaurant.com'; password = 'test123'; role = 'user' } $admin
$staff = New-Object Microsoft.PowerShell.Commands.WebRequestSession
Post-Json "$base/api/auth/login" @{ email = 'page-check@hindustanrestaurant.com'; password = 'test123' } $staff | Out-Null

$routes = @('/admin', '/admin/categories', '/admin/items', '/admin/media', '/admin/settings', '/admin/users', '/admin/account')
Write-Host ("{0,-20} {1,-8} {2,-8}" -f 'Route', 'Admin', 'User')
foreach ($route in $routes) {
  $a = Get-Status "$base$route" $admin
  $u = Get-Status "$base$route" $staff
  Write-Host ("{0,-20} {1,-8} {2,-8}" -f $route, $a, $u)
}

$login = Invoke-WebRequest -Uri "$base/login" -TimeoutSec 20 -UseBasicParsing
Write-Host ""
Write-Host "Login page status        : $([int]$login.StatusCode)"
Write-Host "Login page has Sign In   : $($login.Content -match 'Sign In')"
Write-Host "Login page has email fld : $($login.Content -match 'email')"

Invoke-RestMethod -Uri "$base/api/users/$($tmp.id)" -Method DELETE -WebSession $admin | Out-Null
Write-Host 'Cleaned up temporary user.'
