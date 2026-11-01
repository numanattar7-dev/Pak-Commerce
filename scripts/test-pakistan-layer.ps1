# Step 4 test: Pakistan layer mock — couriers, OTP resend/expiry, FBR, English notifications
$ErrorActionPreference = 'Continue'
$base = "http://localhost:4000"
$pass = 0; $fail = 0
function Mark($ok, $msg) {
  if ($ok) { Write-Host "[PASS] $msg" -ForegroundColor Green; $script:pass++ }
  else { Write-Host "[FAIL] $msg" -ForegroundColor Red; $script:fail++ }
}
function J($o) { $o | ConvertTo-Json -Depth 10 -Compress }

$login = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType 'application/json' -Body '{"email":"admin@khaadi.com","password":"admin123"}'
$auth = @{ Authorization = "Bearer $($login.accessToken)" }
$token = $login.accessToken

# ---------- 1. courier rates ----------
$r1 = Invoke-RestMethod -Uri "$base/couriers/rates" -Headers $auth -Method Post -ContentType 'application/json' -Body (J @{ city = "Lahore"; weightGrams = 1500 })
Mark ($r1.cityGroup -eq 'METRO' -and @($r1.rates).Count -eq 4 -and $r1.rates[0].serviceCharge -eq 310) "rates Lahore/1500g -> $($r1.cityGroup), TCS=$($r1.rates[0].serviceCharge) (220+90) COD=$($r1.rates[0].codFee)"

$r2 = Invoke-RestMethod -Uri "$base/couriers/rates" -Headers $auth -Method Post -ContentType 'application/json' -Body (J @{ city = "Gilgit"; weightGrams = 500 })
$tcs = ($r2.rates | Where-Object { $_.courier -eq 'TCS' })[0]
Mark ($r2.cityGroup -eq 'REMOTE' -and $tcs.serviceCharge -eq 370 -and $tcs.estimatedDays.min -eq 4) "rates Gilgit -> REMOTE, TCS=$($tcs.serviceCharge) etaG$($tcs.estimatedDays.min)-$($tcs.estimatedDays.max) (expect 370, 4-5)"

# ---------- 2. COD order + OTP lifecycle ----------
$prodRes = Invoke-RestMethod -Uri "$base/products/store/khaadi?limit=10" -UseBasicParsing
$variant = ($prodRes.data | ForEach-Object { $_.variants } | Where-Object { $_.stockQuantity -gt 3 } | Select-Object -First 1)

$order = Invoke-RestMethod -Uri "$base/orders" -Method Post -ContentType 'application/json' -Body (J @{
    subdomain = "khaadi"
    customerName = "Pakistan Layer Tester"
    customerPhone = "03455556666"
    shippingCity = "Karachi"
    shippingAddress = "Flat 3B, Sea View Apartments, DHA Phase 6"
    paymentMethod = "COD"
    items = @(@{ variantId = $variant.id; quantity = 1 })
  })
$orderId = $order.id
Mark ($order.otpRequired -eq $true) "COD order placed $orderId"

$ordDet = Invoke-RestMethod -Uri "$base/orders/$orderId" -Headers $auth
$codObj = $ordDet.codVerification
Mark ($null -ne $codObj.expiresAt) "OTP created with expiresAt=$($codObj.expiresAt)"

# wrong OTP -> Invalid OTP
$e = $null
try { Invoke-RestMethod -Uri "$base/orders/$orderId/verify-otp" -Headers $auth -Method Post -ContentType 'application/json' -Body (J @{ orderId = $orderId; otpCode = "000000" }) } catch { $e = $_ }
$bad = ($e.ErrorDetails.Message -match 'Invalid OTP') -or ($e.Exception.Message -match 'Invalid OTP')
Mark $bad "wrong OTP rejected"

# force expiry then correct OTP -> expired
node "C:\Users\numan\pak-commerce\scripts\set-otp-expiry.js" $orderId -1 | Out-Null
$e = $null
try { Invoke-RestMethod -Uri "$base/orders/$orderId/verify-otp" -Headers $auth -Method Post -ContentType 'application/json' -Body (J @{ orderId = $orderId; otpCode = $codObj.otpCode }) } catch { $e = $_ }
$exp = ($e.ErrorDetails.Message -match 'OTP expired') -or ($e.Exception.Message -match 'OTP expired')
Mark $exp "expired OTP rejected (5-min window enforced)"

# resend -> new window + fresh code + attempts reset
$rr = Invoke-RestMethod -Uri "$base/orders/$orderId/resend-otp" -Headers $auth -Method Post
$ordDet = Invoke-RestMethod -Uri "$base/orders/$orderId" -Headers $auth
$codObj = $ordDet.codVerification
Mark ($rr.success -eq $true -and $codObj.otpCode -ne $orderId -and $null -ne $codObj.expiresAt -and [DateTime]$codObj.expiresAt -gt (Get-Date)) "resend -> new OTP $($codObj.otpCode), window $($rr.otpExpiresAt)"

# 5 wrong attempts -> Too many attempts + next correct attempt blocked
for ($i = 0; $i -lt 5; $i++) {
  try { $null = Invoke-RestMethod -Uri "$base/orders/$orderId/verify-otp" -Headers $auth -Method Post -ContentType 'application/json' -Body (J @{ orderId = $orderId; otpCode = "111111" }) } catch {}
}
$e = $null
try { Invoke-RestMethod -Uri "$base/orders/$orderId/verify-otp" -Headers $auth -Method Post -ContentType 'application/json' -Body (J @{ orderId = $orderId; otpCode = $codObj.otpCode }) } catch { $e = $_ }
$many = ($e.ErrorDetails.Message -match 'Too many attempts') -or ($e.Exception.Message -match 'Too many attempts')
Mark $many "attempts>=5 -> OTP verification locked"

# resend resets attempts -> correct code verifies
$rr = Invoke-RestMethod -Uri "$base/orders/$orderId/resend-otp" -Headers $auth -Method Post
$ordDet = Invoke-RestMethod -Uri "$base/orders/$orderId" -Headers $auth
$codObj = $ordDet.codVerification
$v = Invoke-RestMethod -Uri "$base/orders/$orderId/verify-otp" -Headers $auth -Method Post -ContentType 'application/json' -Body (J @{ orderId = $orderId; otpCode = $codObj.otpCode })
Mark ($v.success -eq $true) "resend->reset->verify OK (order VERIFIED)"

# ---------- 3. fulfillment + courier booking ----------
$ful = Invoke-RestMethod -Uri "$base/orders/$orderId/fulfillments" -Headers $auth -Method Post -ContentType 'application/json' -Body (J @{})
Mark ($ful.status -eq 'FULFILLED') "fulfilled"

$book = Invoke-RestMethod -Uri "$base/couriers/shipments" -Headers $auth -Method Post -ContentType 'application/json' -Body (J @{ orderId = $orderId; courier = "TCS" })
Mark ($book.trackingNumber -match '^\d{9,12}$') "TCS booking -> tracking $($book.trackingNumber) mode=$($book.mode)"

$e = $null
try { Invoke-RestMethod -Uri "$base/couriers/shipments" -Headers $auth -Method Post -ContentType 'application/json' -Body (J @{ orderId = $orderId; courier = "POSTEX" }) } catch { $e = $_ }
$dup = ($e.ErrorDetails.Message -match 'already booked') -or ($e.Exception.Message -match 'already booked')
Mark $dup "double booking rejected"

$track = Invoke-RestMethod -Uri "$base/couriers/track/$($book.trackingNumber)" -Headers $auth
Mark ($track.events[0].status -eq 'BOOKED' -and $track.delivered -eq $false -and $null -ne $track.estimatedDeliveryAt) "track -> booked event, eta=$($track.estimatedDeliveryAt)"

# ---------- 4. delivered + FBR invoice ----------
Invoke-RestMethod -Uri "$base/orders/$orderId/status" -Headers $auth -Method Put -ContentType 'application/json' -Body (J @{ status = "DELIVERED" }) | Out-Null
$track = Invoke-RestMethod -Uri "$base/couriers/track/$($book.trackingNumber)" -Headers $auth
$last = $track.events[-1]
Mark ($track.delivered -eq $true -and $last.status -eq 'DELIVERED') "track after DELIVERED -> delivered event at $($last.at)"

$paid = Invoke-RestMethod -Uri "$base/orders/$orderId" -Headers $auth
Mark ($paid.paymentStatus -eq 'PAID') "COD paymentStatus after delivery: $($paid.paymentStatus)"

$inv = Invoke-RestMethod -Uri "$base/orders/$orderId/fbr-invoice" -Headers $auth -Method Post
Mark ($inv.invoiceNo -match '^FBR-\d{6}-[0-9A-F]{8}$') "FBR invoice no: $($inv.invoiceNo)"

$inv2 = Invoke-RestMethod -Uri "$base/orders/$orderId/fbr-invoice" -Headers $auth -Method Post
Mark ($inv2.idempotent -eq $true -and $inv2.invoiceNo -eq $inv.invoiceNo) "FBR idempotent: $($inv2.invoiceNo) (idempotent=$($inv2.idempotent))"

$invList = Invoke-RestMethod -Uri "$base/fbr/invoices?limit=5" -Headers $auth
$found = @($invList.data | Where-Object { $_.id -eq $orderId }).Count -gt 0
Mark $found "GET /fbr/invoices contains order (total=$($invList.meta.total))"

Write-Host "RESULT_STEP4 pass=$pass fail=$fail"
