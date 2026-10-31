# Pak Commerce — API Smoke Test
# Usage: .\scripts\smoke-test.ps1 [-BaseUrl http://localhost:4000] [-Email admin@khaadi.com] [-Password admin123]
param(
    [string]$BaseUrl = "http://localhost:4000",
    [string]$Email = "admin@khaadi.com",
    [string]$Password = "admin123"
)

$pass = 0
$fail = 0

function Test-Endpoint {
    param($Name, $Url, $Method = "Get", $Headers = @{}, $Body = $null)
    try {
        $params = @{
            Uri             = $Url
            Method          = $Method
            Headers         = $Headers
            UseBasicParsing = $true
            TimeoutSec      = 15
        }
        if ($Body) { $params.Body = $Body; $params.ContentType = "application/json" }
        $r = Invoke-WebRequest @params
        Write-Host "[PASS] $Name  (HTTP $($r.StatusCode))" -ForegroundColor Green
        $script:pass++
        return $r
    } catch {
        $code = $null
        if ($_.Exception.Response) { $code = $_.Exception.Response.StatusCode.value__ }
        Write-Host "[FAIL] $Name  (HTTP $code) $($_.Exception.Message)" -ForegroundColor Red
        $script:fail++
        return $null
    }
}

Write-Host "Pak Commerce Smoke Test -> $BaseUrl" -ForegroundColor Cyan
Write-Host ("-" * 60)

# 1. Public storefront API
Test-Endpoint "GET /products/store/khaadi (public)" "$BaseUrl/products/store/khaadi?limit=5" | Out-Null

# 2. Login (JWT)
$login = Test-Endpoint "POST /auth/login" "$BaseUrl/auth/login" -Method Post -Body ('{"email":"' + $Email + '","password":"' + $Password + '"}')
if (-not $login) {
    Write-Host "Login fail -> baqi authenticated tests skip." -ForegroundColor Yellow
    exit 1
}
$token = ($login.Content | ConvertFrom-Json).accessToken
$auth = @{ Authorization = "Bearer $token" }

# 3. Protected endpoints
Test-Endpoint "GET /products (auth)" "$BaseUrl/products?limit=5" -Headers $auth | Out-Null
Test-Endpoint "GET /orders (auth)" "$BaseUrl/orders" -Headers $auth | Out-Null
Test-Endpoint "GET /tenants/me (auth)" "$BaseUrl/tenants/me" -Headers $auth | Out-Null

Write-Host ("-" * 60)
Write-Host "RESULT: $pass passed, $fail failed" -ForegroundColor $(if ($fail -eq 0) { "Green" } else { "Red" })
exit $(if ($fail -eq 0) { 0 } else { 1 })
