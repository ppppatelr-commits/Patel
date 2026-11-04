$ErrorActionPreference = 'Stop'
$base = 'http://localhost:3000'

function Post-Json($url, $obj, $session) {
  return Invoke-RestMethod -Uri $url -Method POST -Body ($obj | ConvertTo-Json) -ContentType 'application/json' -WebSession $session
}

$admin = New-Object Microsoft.PowerShell.Commands.WebRequestSession
Post-Json "$base/api/auth/login" @{ email = 'admin@hindustanrestaurant.com'; password = 'admin123' } $admin | Out-Null

$tmp = Post-Json "$base/api/users" @{ name = 'Guard Check'; email = 'guard-check@hindustanrestaurant.com'; password = 'test123'; role = 'user' } $admin
$staff = New-Object Microsoft.PowerShell.Commands.WebRequestSession
Post-Json "$base/api/auth/login" @{ email = 'guard-check@hindustanrestaurant.com'; password = 'test123' } $staff | Out-Null

function Get-Status($url, $session) {
  try {
    $r = Invoke-WebRequest -Uri $url -WebSession $session -TimeoutSec 15 -UseBasicParsing -MaximumRedirection 0
    return [int]$r.StatusCode
  } catch {
    return [int]$_.Exception.Response.StatusCode
  }
}

Write-Host "Admin /admin/users      : $(Get-Status "$base/admin/users" $admin)"
Write-Host "Admin /admin/account    : $(Get-Status "$base/admin/account" $admin)"
Write-Host "Admin /admin/settings   : $(Get-Status "$base/admin/settings" $admin)"
Write-Host "User  /admin/users      : $(Get-Status "$base/admin/users" $staff)"
Write-Host "User  /admin/settings   : $(Get-Status "$base/admin/settings" $staff)"
Write-Host "User  /admin/account    : $(Get-Status "$base/admin/account" $staff)"
Write-Host "User  /admin            : $(Get-Status "$base/admin" $staff)"
Write-Host "Public /                : $(Get-Status "$base/" $staff)"
Write-Host "Public /menu            : $(Get-Status "$base/menu" $staff)"

$page = (Invoke-WebRequest -Uri "$base/admin/users" -WebSession $admin -TimeoutSec 15 -UseBasicParsing).Content
Write-Host "Admin users page has 'User Management': $($page -match 'User Management')"
Write-Host "Admin users page has 'Loading users': $($page -match 'Loading users')"
Write-Host "Sidebar has 'My Account': $($page -match 'My Account')"
Write-Host "Sidebar has 'User Management' nav: $($page -match 'User Management')"

$staffDash = (Invoke-WebRequest -Uri "$base/admin" -WebSession $staff -TimeoutSec 15 -UseBasicParsing).Content
Write-Host "User dashboard hides 'User Management' nav: $(-not ($staffDash -match 'User Management'))"
Write-Host "User dashboard hides 'Restaurant Settings' nav: $(-not ($staffDash -match 'Restaurant Settings'))"
Write-Host "User dashboard shows 'My Account' nav: $($staffDash -match 'My Account')"

$accountPage = (Invoke-WebRequest -Uri "$base/admin/account" -WebSession $staff -TimeoutSec 15 -UseBasicParsing).Content
Write-Host "Account page has 'Change Password': $($accountPage -match 'Change Password')"

Invoke-RestMethod -Uri "$base/api/users/$($tmp.id)" -Method DELETE -WebSession $admin | Out-Null
Write-Host 'Cleaned up temporary user.'
