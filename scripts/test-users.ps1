$ErrorActionPreference = 'Stop'
$base = 'http://localhost:3000'

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

function Post-Json($url, $obj, $session) {
  return Invoke-RestMethod -Uri $url -Method POST -Body ($obj | ConvertTo-Json) -ContentType 'application/json' -WebSession $session
}
function Put-Json($url, $obj, $session) {
  return Invoke-RestMethod -Uri $url -Method PUT -Body ($obj | ConvertTo-Json) -ContentType 'application/json' -WebSession $session
}
function Get-Json($url, $session) {
  return Invoke-RestMethod -Uri $url -WebSession $session
}

Write-Host '=== Waiting for dev server ==='
if (-not (Wait-Server)) { Write-Host 'FAIL: server not ready'; exit 1 }
Write-Host 'Server ready.'

$results = @()
function Check($name, $ok, $detail) {
  $script:results += [pscustomobject]@{ Test = $name; Result = $(if ($ok) { 'PASS' } else { 'FAIL' }); Detail = $detail }
  Write-Host ("{0,-46} {1}  {2}" -f $name, $(if ($ok) { 'PASS' } else { 'FAIL' }), $detail)
}

# 1. Admin login
$admin = New-Object Microsoft.PowerShell.Commands.WebRequestSession
try {
  $login = Post-Json "$base/api/auth/login" @{ email = 'admin@hindustanrestaurant.com'; password = 'admin123' } $admin
  Check 'Admin login (default credentials)' ($login.user.role -eq 'admin') "role=$($login.user.role)"
} catch {
  Check 'Admin login (default credentials)' $false $_.Exception.Message
}

# 2. /api/auth/me
try {
  $me = Get-Json "$base/api/auth/me" $admin
  Check 'Admin /api/auth/me' ($me.authenticated -and $me.isAdmin) "role=$($me.user.role) backend=$($me.backend)"
} catch { Check 'Admin /api/auth/me' $false $_.Exception.Message }

# 3. List users
$before = 0
try {
  $users = Get-Json "$base/api/users" $admin
  $before = @($users).Count
  Check 'Admin can list users' ($before -ge 1) "count=$before"
} catch { Check 'Admin can list users' $false $_.Exception.Message }

# 4. Create a user-role account
$staffId = $null
try {
  $new = Post-Json "$base/api/users" @{ name = 'Test Staff'; email = 'staff@hindustanrestaurant.com'; password = 'staff123'; role = 'user' } $admin
  $staffId = $new.id
  Check 'Admin creates user (role=user)' ($new.role -eq 'user' -and $new.email -eq 'staff@hindustanrestaurant.com') "id=$($new.id)"
} catch { Check 'Admin creates user (role=user)' $false $_.Exception.Message }

# 5. New user can log in
$staff = New-Object Microsoft.PowerShell.Commands.WebRequestSession
try {
  $staffLogin = Post-Json "$base/api/auth/login" @{ email = 'staff@hindustanrestaurant.com'; password = 'staff123' } $staff
  Check 'New user can log in' ($staffLogin.user.role -eq 'user') "role=$($staffLogin.user.role)"
} catch { Check 'New user can log in' $false $_.Exception.Message }

# 6. Staff cannot manage users (403)
try {
  Get-Json "$base/api/users" $staff | Out-Null
  Check 'Staff blocked from user management' $false 'unexpected success'
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  Check 'Staff blocked from user management' ($code -eq 403) "status=$code"
}

# 7. Staff cannot open /admin/users page (redirect 307)
try {
  $r = Invoke-WebRequest -Uri "$base/admin/users" -WebSession $staff -TimeoutSec 10 -UseBasicParsing -MaximumRedirection 0
  Check 'Staff redirected from /admin/users' ([int]$r.StatusCode -eq 307) "status=$($r.StatusCode)"
} catch {
  $code = [int]$_.Exception.Response.StatusCode
  Check 'Staff redirected from /admin/users' ($code -eq 307) "status=$code"
}

# 8. Admin can open /admin/users page
try {
  $r = Invoke-WebRequest -Uri "$base/admin/users" -WebSession $admin -TimeoutSec 15 -UseBasicParsing -MaximumRedirection 0
  Check 'Admin can open /admin/users' ($r.StatusCode -eq 200) "status=$($r.StatusCode)"
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  Check 'Admin can open /admin/users' ($code -eq 200) "status=$code"
}

# 9. Admin resets the user's password
try {
  Put-Json "$base/api/users/$staffId" @{ password = 'staff456' } $admin | Out-Null
  Check 'Admin changes user password' $true 'updated'
} catch { Check 'Admin changes user password' $false $_.Exception.Message }

# 10. Old password rejected, new password works
$staff2 = New-Object Microsoft.PowerShell.Commands.WebRequestSession
try {
  Post-Json "$base/api/auth/login" @{ email = 'staff@hindustanrestaurant.com'; password = 'staff123' } $staff2 | Out-Null
  Check 'Old password rejected after reset' $false 'unexpected success'
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  Check 'Old password rejected after reset' ($code -eq 401) "status=$code"
}
try {
  $l2 = Post-Json "$base/api/auth/login" @{ email = 'staff@hindustanrestaurant.com'; password = 'staff456' } $staff2
  Check 'New password works' ($l2.user.email -eq 'staff@hindustanrestaurant.com') 'logged in'
} catch { Check 'New password works' $false $_.Exception.Message }

# 11. User changes own password via My Account
try {
  Put-Json "$base/api/auth/password" @{ currentPassword = 'staff456'; newPassword = 'staff789' } $staff2 | Out-Null
  Check 'User changes own password' $true 'updated'
} catch { Check 'User changes own password' $false $_.Exception.Message }

$staff3 = New-Object Microsoft.PowerShell.Commands.WebRequestSession
try {
  $l3 = Post-Json "$base/api/auth/login" @{ email = 'staff@hindustanrestaurant.com'; password = 'staff789' } $staff3
  Check 'Own-password change works' ($l3.user.email -eq 'staff@hindustanrestaurant.com') 'logged in'
} catch { Check 'Own-password change works' $false $_.Exception.Message }

# 12. Promote to admin
try {
  $promoted = Put-Json "$base/api/users/$staffId" @{ role = 'admin' } $admin
  Check 'Admin can promote user to administrator' ($promoted.role -eq 'admin') "role=$($promoted.role)"
} catch { Check 'Admin can promote user to administrator' $false $_.Exception.Message }

# 13. Delete the test user
try {
  Invoke-RestMethod -Uri "$base/api/users/$staffId" -Method DELETE -WebSession $admin | Out-Null
  $after = @(Get-Json "$base/api/users" $admin).Count
  Check 'Admin deletes user' ($after -eq $before) "count=$after"
} catch { Check 'Admin deletes user' $false $_.Exception.Message }

# 14. Cannot delete self
try {
  $meAdmin = Get-Json "$base/api/auth/me" $admin
  Invoke-RestMethod -Uri "$base/api/users/$($meAdmin.user.id)" -Method DELETE -WebSession $admin | Out-Null
  Check 'Admin cannot delete own account' $false 'unexpected success'
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  Check 'Admin cannot delete own account' ($code -eq 400) "status=$code"
}

# 15. Duplicate email rejected
try {
  Post-Json "$base/api/users" @{ name = 'Dup'; email = 'admin@hindustanrestaurant.com'; password = 'abcdef'; role = 'user' } $admin | Out-Null
  Check 'Duplicate email rejected' $false 'unexpected success'
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  Check 'Duplicate email rejected' ($code -eq 400) "status=$code"
}

Write-Host ''
Write-Host '=== SUMMARY ==='
$results | Format-Table -AutoSize
$failed = @($results | Where-Object { $_.Result -eq 'FAIL' }).Count
Write-Host "Passed: $($results.Count - $failed) / $($results.Count)"
if ($failed -gt 0) { exit 1 }
