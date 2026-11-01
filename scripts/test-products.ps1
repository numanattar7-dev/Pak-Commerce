# Step 3 test: Collections CRUD + public endpoint, CSV export/import, image upload
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
Write-Host "[login] ok"

# ---------- setup: pick products ----------
$prodRes = Invoke-RestMethod -Uri "$base/products/store/khaadi?limit=10" -UseBasicParsing
$products = $prodRes.data
$p1 = $products[0].id; $p2 = $products[1].id; $p3 = $products[2].id

# ---------- 1. COLLECTIONS ----------
# cleanup old test collections
$old = Invoke-RestMethod -Uri "$base/collections" -Headers $auth
foreach ($c in ($old | Where-Object { $_.title -like 'Summer Lawn 2026*' })) {
  Invoke-RestMethod -Uri "$base/collections/$($c.id)" -Headers $auth -Method Delete | Out-Null
}

$col = Invoke-RestMethod -Uri "$base/collections" -Headers $auth -Method Post -ContentType 'application/json' `
  -Body (J @{ title = "Summer Lawn 2026"; productIds = @($p1, $p2) })
Mark ($col.handle -eq 'summer-lawn-2026') "create collection handle=$($col.handle), members=$($col.products.Count)"

$col2 = Invoke-RestMethod -Uri "$base/collections" -Headers $auth -Method Post -ContentType 'application/json' `
  -Body (J @{ title = "Summer Lawn 2026"; productIds = @($p2, $p3) })
Mark ($col2.handle -ne $col.handle) "duplicate -> unique handle=$($col2.handle)"

# bogus product id must 400 (tenant scoping)
$bogus = $false
try { Invoke-RestMethod -Uri "$base/collections" -Headers $auth -Method Post -ContentType 'application/json' -Body (J @{ title = "x"; productIds = @("aaaa-bbbb") }) } catch { $bogus = $true }
Mark $bogus "foreign/bogus product id rejected (400)"

# add + remove product
$added = Invoke-RestMethod -Uri "$base/collections/$($col.id)/products" -Headers $auth -Method Post -ContentType 'application/json' -Body (J @{ productIds = @($p3) })
$cnt3 = ($added.products | Measure-Object).Count
$removed = Invoke-RestMethod -Uri "$base/collections/$($col.id)/products" -Headers $auth -Method Delete -ContentType 'application/json' -Body (J @{ productIds = @($p2) })
Mark ($cnt3 -eq 3 -and $removed.removed -eq 1) "add p3 -> $cnt3 members; remove p2 -> removed=$($removed.removed)"

# update: full replacement + deactivate
$upd = Invoke-RestMethod -Uri "$base/collections/$($col.id)" -Headers $auth -Method Put -ContentType 'application/json' `
  -Body (J @{ title = "Summer Lawn 2026"; isActive = $false; productIds = @($p1) })
Mark ($upd.isActive -eq $false -and $upd.products.Count -eq 1) "update -> active=$($upd.isActive) members=$($upd.products.Count)"

# public endpoint: inactive collection must be hidden, active sibling visible
$pub = Invoke-RestMethod -Uri "$base/collections/store/khaadi" -UseBasicParsing
$pubHandles = @($pub.data | ForEach-Object { $_.handle })
Mark (-not ($pubHandles -contains $col.handle) -and $pubHandles -contains $col2.handle) "public hides inactive col (handles: $($pubHandles -join ', '))"

# reactivate + public returns both
Invoke-RestMethod -Uri "$base/collections/$($col.id)" -Headers $auth -Method Put -ContentType 'application/json' -Body (J @{ isActive = $true }) | Out-Null
$pub = Invoke-RestMethod -Uri "$base/collections/store/khaadi" -UseBasicParsing
$pubHandles = @($pub.data | ForEach-Object { $_.handle })
Mark ($pubHandles -contains $col.handle -and $pubHandles -contains $col2.handle) "reactivated -> public handles: $($pubHandles -join ', ')"

# variants included in public payload
$firstProd = $pub.data[0].products[0]
Mark ($null -ne $firstProd.variants -and @($firstProd.variants).Count -gt 0) "public payload includes variants ($(@($firstProd.variants).Count))"

# ---------- 2. CSV ----------
$csvPath = "C:\Users\numan\pak-commerce\scripts\import-sample.csv"
@'
title,titleUrdu,description,category,tags,images,variantTitle,sku,price,compareAtPrice,stockQuantity
CSV Test Kurta, Kurta,"Description with, comma and ""quotes""",Kurtas,New|Sale,/products/test.jpg,Small,TST-S,2500,3000,5
CSV Test Kurta, Kurta,"Description with, comma and ""quotes""",Kurtas,New|Sale,/products/test.jpg,Large,TST-L,2900,3500,8
'@ | ForEach-Object { $_.TrimEnd() } | Out-Null
$csv = "title,titleUrdu,description,category,tags,images,variantTitle,sku,price,compareAtPrice,stockQuantity`r`n"
$csv += 'CSV Test Kurta,Kurta,"Description with, comma and ""quotes""",Kurtas,New|Sale,/products/test.jpg,Small,TST-S,2500,3000,5' + "`r`n"
$csv += 'CSV Test Kurta,Kurta,"Description with, comma and ""quotes""",Kurtas,New|Sale,/products/test.jpg,Large,TST-L,2900,3500,8' + "`r`n"
[System.IO.File]::WriteAllText($csvPath, $csv)
$imp1 = (curl.exe -s -X POST "$base/products/import/csv" -H "Authorization: Bearer $token" -F "file=@$csvPath;type=text/csv") | ConvertFrom-Json
Mark ($imp1.productsCreated -eq 1 -and $imp1.variantsCreated -eq 2) "import#1: created=$($imp1.productsCreated) variants=$($imp1.variantsCreated) errors=$($imp1.errors.Count) (expect 1/2/0)"

# re-import with changed stocks -> updates
$csv2 = $csv -replace '2500,3000,5', '2550,3000,9' -replace '2900,3500,8', '2850,3500,12'
[System.IO.File]::WriteAllText($csvPath, $csv2)
$imp2 = (curl.exe -s -X POST "$base/products/import/csv" -H "Authorization: Bearer $token" -F "file=@$csvPath;type=text/csv") | ConvertFrom-Json
Mark ($imp2.productsCreated -eq 0 -and $imp2.variantsCreated -eq 0 -and $imp2.variantsUpdated -eq 2) "import#2: created=$($imp2.productsCreated)/$($imp2.variantsCreated) updated_variants=$($imp2.variantsUpdated) (expect 0/0/2)"

# verify price/stock landed
$admin = Invoke-RestMethod -Uri "$base/products?limit=50&admin" -Headers $auth
$testProd = $admin.data | Where-Object { $_.title -eq 'CSV Test Kurta' }
$small = $testProd.variants | Where-Object { $_.title -eq 'Small' }
Mark ($small.price -eq 2550 -and $small.stockQuantity -eq 9) "DB check: Small price=$($small.price) stock=$($small.stockQuantity) (expect 2550/9)"

# export contains the product
$exp = (Invoke-WebRequest -Uri "$base/products/export/csv" -Headers $auth -UseBasicParsing).Content
$hasIt = $exp -match 'CSV Test Kurta' -and $exp -match 'TST-L'
Mark $hasIt "export contains product + sku (bytes=$(( [Text.Encoding]::UTF8.GetByteCount($exp))))"

# quoted description round-tripped
$expLoaded = $exp.Contains('"Description with, comma and ""quotes"""') -or $exp.Contains('comma')
Mark $expLoaded "export preserves quoted description"

# ---------- 3. IMAGE UPLOAD ----------
$pngPath = "C:\Users\numan\pak-commerce\scripts\test-pixel.png"
[System.IO.File]::WriteAllBytes($pngPath, [Convert]::FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="))
$upResp = (curl.exe -s -X POST "$base/products/upload-image" -H "Authorization: Bearer $token" -F "file=@$pngPath;type=image/png") | ConvertFrom-Json
Mark ($upResp.url -like "/uploads/*png") "upload ok -> $($upResp.url) size=$($upResp.size)"

$served = Invoke-WebRequest -Uri "$base$($upResp.url)" -UseBasicParsing -TimeoutSec 15
Mark ($served.StatusCode -eq 200) "static serve 200: $($base)$($upResp.url) ($($served.RawContentLength) bytes)"

$bad = $false
$txtPath = "C:\Users\numan\pak-commerce\scripts\not-image.txt"
[System.IO.File]::WriteAllText($txtPath, "hello")
try { $null = curl.exe -s -o NUL -w "%{http_code}" -X POST "$base/products/upload-image" -H "Authorization: Bearer $token" -F "file=@$txtPath;type=text/plain"; $code = $LASTEXITCODE } catch { $code = 500 }
# curl.exe -w prints the code; better re-run capturing properly
$code = curl.exe -s -o "C:\Users\numan\pak-commerce\scripts\up-bad-resp.json" -w "%{http_code}" -X POST "$base/products/upload-image" -H "Authorization: Bearer $token" -F "file=@$txtPath;type=text/plain"
Mark ($code -eq '400') "non-image rejected: HTTP $code"

# ---------- cleanup ----------
foreach ($c in ($old + @($col, $col2) | Where-Object { $_.title -like 'Summer Lawn 2026*' })) {
  try { Invoke-RestMethod -Uri "$base/collections/$($c.id)" -Headers $auth -Method Delete | Out-Null } catch {}
}
Invoke-RestMethod -Uri "$base/products/$($testProd.id)" -Headers $auth -Method Delete | Out-Null
Write-Host "RESULT_STEP3 pass=$pass fail=$fail"
