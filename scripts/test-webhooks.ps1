# End-to-end webhook test for Pak Commerce
$ErrorActionPreference = 'Stop'
$base = "http://localhost:4000"
$recv = "http://localhost:4005"

function J($o) { return $o | ConvertTo-Json -Depth 10 -Compress }

# ---- 0. login ----
$login = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType 'application/json' -Body '{"email":"admin@khaadi.com","password":"admin123"}'
$token = $login.accessToken
$auth = @{ Authorization = "Bearer $token" }
Write-Host "[1] LOGIN ok"

# ---- 1. clean slate: delete existing webhooks ----
$existing = Invoke-RestMethod -Uri "$base/webhooks" -Headers $auth
foreach ($w in $existing) {
  Invoke-RestMethod -Uri "$base/webhooks/$($w.id)" -Headers $auth -Method Delete | Out-Null
}
Write-Host "[2] Cleaned $($existing.Count) old webhook(s)"

# ---- 2. pick a variant to order ----
$prodRes = Invoke-RestMethod -Uri "$base/products/store/khaadi?limit=10" -UseBasicParsing
$products = if ($prodRes.data) { $prodRes.data } else { $prodRes }
$variant = $null
foreach ($p in $products) {
  foreach ($v in $p.variants) { if ($v.stockQuantity -gt 2) { $variant = $v; $product = $p; break } }
  if ($variant) { break }
}
if (-not $variant) { throw "No variant with stock found" }
Write-Host "[3] Using variant $($variant.id) of '$($product.title)' stock=$($variant.stockQuantity) price=$($variant.price)"

# ---- 3. create test webhooks ----
$wa = Invoke-RestMethod -Uri "$base/webhooks" -Headers $auth -Method Post -ContentType 'application/json' `
  -Body (J @{ url = "$recv/ok"; events = @('order.created','order.fulfilled','order.refunded','order.status_changed','webhook.test') })
$wb = Invoke-RestMethod -Uri "$base/webhooks" -Headers $auth -Method Post -ContentType 'application/json' `
  -Body (J @{ url = "$recv/fail"; events = @('order.created') })
$wc = Invoke-RestMethod -Uri "$base/webhooks" -Headers $auth -Method Post -ContentType 'application/json' `
  -Body (J @{ url = "http://localhost:4999/nope"; events = @('order.created') })
Write-Host "[4] Webhooks created: A=$($wa.id.Substring(0,8)) B=$($wb.id.Substring(0,8)) C=$($wc.id.Substring(0,8))"
Write-Host "    secret learned: $($wa.secret.Substring(0,12))..."

# ---- 4. start mock receiver (background, with secret for HMAC verification) ----
$old = Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'mock-receiver' }
if ($old) { $old | ForEach-Object { Stop-Process -Id $_.ProcessId -Force } }
Start-Process -FilePath "node" -ArgumentList "C:\Users\numan\pak-commerce\scripts\mock-receiver.js", $wa.secret -WindowStyle Hidden
Start-Sleep -Seconds 2
$ping = Invoke-RestMethod -Uri "$recv/log"
Write-Host "[5] Receiver up, log empty: $($ping.Count -eq 0)"

# ---- 5. fire a TEST delivery on A ----
Invoke-RestMethod -Uri "$base/webhooks/$($wa.id)/test" -Headers $auth -Method Post | Out-Null

# ---- 6. place a COD order (fires order.created to A, B, C) ----
$order = Invoke-RestMethod -Uri "$base/orders" -Method Post -ContentType 'application/json' -Body (J @{
    subdomain = "khaadi"
    customerName = "Webhook Tester"
    customerPhone = "03001112233"
    shippingCity = "Lahore"
    shippingAddress = "12-B Test Street, Model Town"
    paymentMethod = "COD"
    items = @(@{ variantId = $variant.id; quantity = 1 })
  })
$orderId = $order.id
Write-Host "[6] Order placed: $orderId total=$($order.totalAmount) status=$($order.orderStatus)"

# ---- 7. fulfillment (fires order.fulfilled) ----
Start-Sleep -Seconds 4
$ful = Invoke-RestMethod -Uri "$base/orders/$orderId/fulfillments" -Headers $auth -Method Post -ContentType 'application/json' -Body (J @{})
Write-Host "[7] Fulfilled: status=$($ful.status) carrier=$($ful.carrier)"

# ---- 8. partial refund amount=10 restock=false (fires order.refunded, keeps order open) ----
$ref = Invoke-RestMethod -Uri "$base/orders/$orderId/refund" -Headers $auth -Method Post -ContentType 'application/json' `
  -Body (J @{ amount = 10; reason = "webhook-test"; restock = $false })
Write-Host "[8] Refunded amount=$($ref.refund.amount) orderStatus=$($ref.applied.orderStatus)"

# ---- 9. check delivery states on backend ----
Start-Sleep -Seconds 5
$delA = Invoke-RestMethod -Uri "$base/webhooks/$($wa.id)/deliveries" -Headers $auth
$delB = Invoke-RestMethod -Uri "$base/webhooks/$($wb.id)/deliveries" -Headers $auth
$delC = Invoke-RestMethod -Uri "$base/webhooks/$($wc.id)/deliveries" -Headers $auth
Write-Host "[9] Delivery status:"
foreach ($d in ($delA | Select-Object -First 6)) {
  Write-Host ("    A {0,-22} {1,-9} attempts={2} code={3}" -f $d.event, $d.status, $d.attempts, $d.responseCode)
}
foreach ($d in ($delB | Select-Object -First 2)) {
  Write-Host ("    B {0,-22} {1,-9} attempts={2} nextRetry={3}" -f $d.event, $d.status, $d.attempts, $d.nextRetryAt)
}
foreach ($d in ($delC | Select-Object -First 2)) {
  Write-Host ("    C {0,-22} {1,-9} attempts={2} error={3}" -f $d.event, $d.status, $d.attempts, $d.error)
}

# ---- 10. receiver-side signature verification + event census ----
$rlog = Invoke-RestMethod -Uri "$recv/log"
Write-Host "[10] Receiver received $($rlog.Count) POSTs:"
$sigOk = 0
foreach ($e in $rlog) {
  if ($e.sigVerify.ok -eq $true) { $sigOk++ }
  Write-Host ("     {0,-24} sigOk={1}" -f $e.topic, $e.sigVerify.ok)
}
Write-Host "    HMAC verified on $sigOk / $($rlog.Count)"
Write-Host "RESULT_WEBHOOK_TEST order=$orderId"
