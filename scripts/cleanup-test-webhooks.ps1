# Cleanup: delete leftover test webhook endpoints (localhost:4005 / :4999 receivers)
$ErrorActionPreference = "Stop"
$base = "http://localhost:4000"

$login = Invoke-RestMethod -Method Post -Uri "$base/auth/login" -ContentType "application/json" -Body '{"email":"admin@khaadi.com","password":"admin123"}'
$token = $login.accessToken
if (-not $token) { throw "login failed" }

$headers = @{ Authorization = "Bearer $token" }
$hooks = Invoke-RestMethod -Method Get -Uri "$base/webhooks" -Headers $headers
# Response may be an array or wrapped; normalize
if ($hooks.data) { $hooks = $hooks.data }

$stale = @($hooks | Where-Object { $_.url -match ":4005" -or $_.url -match ":4999" })
"total webhooks: $(@($hooks).Count) | stale test ones: $($stale.Count)"

foreach ($h in $stale) {
  "deleting: $($h.id) -> $($h.url) (events: $($h.events -join ','))"
  Invoke-RestMethod -Method Delete -Uri "$base/webhooks/$($h.id)" -Headers $headers | Out-Null
}

$after = Invoke-RestMethod -Method Get -Uri "$base/webhooks" -Headers $headers
if ($after.data) { $after = $after.data }
"remaining webhooks: $(@($after).Count)"
if ($after) { $after | ForEach-Object { "  kept: $($_.url) [$($_.events -join ',')]" } }
