# 🚀 Pak Commerce — Build Plan v2

**Philosophy:** پہلے *exact Shopify* (core commerce engine) → پھر پاکستانی ضروری features اسی کے اوپر add
**Date:** 31 اکتوبر 2026
**Approach:** موجودہ codebase (backend ~90%, admin ~35%, storefront ~60%) کو بنیاد بنا کر آگے

---

## 🧭 مجموعی نقشہ (Bird's Eye View)

```
Phase 0: Stabilize                (~1 ہفتہ)    → مضبوط بنیاد
Phase 1: Shopify Core — Backend   (~4 ہفتے)   → Shopify جیسا API engine
Phase 2: Shopify Core — Admin     (~4 ہفتے)   → Shopify جیسا merchant dashboard
Phase 3: Shopify Core — Storefront(~3 ہفتے)   → Shopify جیسا customer-facing store
Phase 4: پاکستانی Essential Layer (~6 ہفتے)   → COD, wallets, couriers, WhatsApp, Urdu
Phase 5: Compliance & Scale       (مستقل)      → FBR, multi-location, theme engine, apps
```

> 🎯 **Milestone (Phase 3 کے بعد):** مکمل Shopify جیسا platform — international-level core
> 🇵🇰 **Milestone (Phase 4 کے بعد):** "پاکستان کا Shopify" — یعنی اصلی production-ready پراڈکٹ

---

# PHASE 0 — Stabilize (سب سے پہلے ضروری کام)

**ہدف:** جو کچھ بن چکا ہے اسے قابلِ اعتماد بنانا۔ نیا feature شروع کرنے سے پہلے یہ لازمی۔

| کام | تفصیل | کس کی ذمہ داری |
|---|---|---|
| JWT 401 فکس | `DATABASE_URL` runtime پر Prisma تک پہنچے؛ JWT strategy کو DB-free validation بنانا | میں |
| Git setup | `git init`, پہلا commit، `.env` ignore، branch rules (`main`/`dev`) | میں |
| Code audit | موجودہ 31 backend files کا review — inconsistencies, dead code, naming | میں |
| DB cleanup | Neon branches (main/dev)، seed review، indexes چیک | میں |
| Test بنیاد | auth + products + orders پر smoke tests (NestJS e2e) | میں |
| Deploy dry-run | Render (backend) + Vercel (frontend) پر staging deploy — free tier | میں |

✅ **قبول کا معیار:** login/token ہر endpoint پر کام کرے؛ کوڈ Git پر محفوظ؛ staging environment زندہ

---

# PHASE 1 — Shopify Core: Backend Parity (~4 ہفتے)

**ہدف:** Shopify جتنی گہرائی والا commerce API — پہلے REST (GraphQL Phase 5 میں)

## 1.1 Schema Upgrade (Prisma) — نئے models
- `Customer` — profiles, tags, addresses, order history
- `Discount` — codes, %/fixed/free-shipping, usage limits, date ranges
- `DraftOrder` — merchant-created orders
- `Location` + `InventoryLevel` — multi-location-ready schema (فی الحال 1 default location)
- `Fulfillment` / `Refund` / `Return` — مکمل order lifecycle
- `Webhook` + `WebhookDelivery` — event engine کی بنیاد
- `StaffUser` + permissions — roles: Owner / Admin / Staff
- موجودہ `Product/Variant/Order/Tenant` پر Shopify-parity fields کا اضافہ

## 1.2 Products & Catalog
- 3-option variants (size/color/material — Shopify جیسا)، images per variant
- Collections: manual + smart rules (tag/price/inventory based)
- CSV bulk import/export
- Product status: draft/active

## 1.3 Orders & OMS
- پورا lifecycle: open → paid/pending → fulfilled → returned/refunded/cancelled
- Fulfillment tracking (generic carrier fields — پاکستانی couriers Phase 4 میں plug ہوں گے)
- Refund calculation + inventory restore
- Draft orders
- Order timeline (event log — Shopify جیسا audit trail)

## 1.4 Discounts Engine
- Codes: % off, fixed off, free shipping, minimum amount, first-order-only
- Usage limits + expiry + customer eligibility

## 1.5 Analytics API
- Revenue, orders, AOV, conversion rate, top products, sales-over-time

## 1.6 Webhook Engine (BullMQ)
- Events: `order.created`, `order.fulfilled`, `product.updated`, `inventory.low`
- Signed payloads + exponential retry

✅ **قبول کا معیار:** products/orders/customers/discounts/analytics — سب core operations REST API پر مکمل

---

# PHASE 2 — Shopify Core: Admin Dashboard (~4 ہفتے، Phase 1 کے ساتھ overlap)

**ہدف:** Shopify جیسا صاف، تیز، mobile-friendly merchant panel

## 2.1 Design System
- Sidebar: **Home | Orders | Products | Customers | Discounts | Analytics | Settings**
- Shopify جیسی design language: white cards, status badges (paid/unfulfilled), data-dense tables

## 2.2 Screen-by-Screen
1. **Home** — KPI cards + sales chart + recent orders + onboarding checklist ("add product → set shipping → go live")
2. **Orders** — list + status tabs/filters؛ order detail (timeline, fulfill, refund, customer contact)
3. **Products** — list + bulk actions؛ product editor (variants matrix, image upload, SEO section، bilingual fields کی جگہ — Phase 4 میں active)
4. **Customers** — list, profile, order history, tags
5. **Discounts** — builder UI
6. **Analytics** — line/bar charts + reports
7. **Settings** — store info, domains, payments (adapter placeholders), generic shipping zones, generic taxes, users/roles, notification templates

## 2.3 Professional UX
- Staff login + role permissions (API-level Phase 1 سے، UI-level یہاں)
- Toasts, empty states, skeleton loading
- Global search (orders/products/customers — `Ctrl+K`)

✅ **قبول کا معیار:** نیا merchant بغیر کسی مدد کے panel استعمال کر سکے

---

# PHASE 3 — Shopify Core: Storefront (~3 ہفتے)

**ہدف:** professional، تیز، mobile-first buyer experience — ہلکا JS bundle (< 80KB gzipped)

## 3.1 Theme System v1
- Theme settings: logo, colors, fonts, hero/banners, menus, footer
- ایک premium default theme + section blocks (hero, featured collection, testimonials, announcement bar)
- (Full drag-drop builder = Phase 5)

## 3.2 Pages
- Home, Collection listing/filters, Product page (variants, gallery, quantity), Cart, **one-page checkout**, Order status/lookup, Customer login + order history, Policy/About pages, Contact
- Search (پہلے SQL/trigram — Meilisearch Phase 5 میں)

## 3.3 Performance & SEO
- Next.js ISR/SSR, image optimization (WebP), lazy loading
- Meta tags, OpenGraph, `sitemap.xml`, `robots.txt`, JSON-LD
- PWA بنیاد (manifest, offline shell)

✅ **قبول کا معیار:** Lighthouse mobile ≥ 90؛ checkout صرف 3 قدم (cart → address → confirm)

---

# PHASE 4 🇵🇰 — پاکستانی Essential Layer (~6 ہفتے)

**ہدف:** وہ features جو Shopify نہیں دیتا — اسی ترتیب سے (کاروباری اہمیت کے مطابق):

## 4.1 COD Operating System (سب سے پہلے — موجودہ کام کو upgrade)
- موجودہ: OTP (simulated) + basic risk score → **upgrade:**
- Real SMS gateway (آپ سے credentials — local aggregator)
- COD flow: OTP verify → risk score → high-risk پر upfront deposit rule (wallet/Raast سے)
- **Cash Reconciliation Ledger** — courier settlement (AWB → collected → fee → net payout)، short-payment flags

## 4.2 Payment Adapter Layer
- Interface: `PaymentProvider { authorize, capture, refund, verifyWebhook }`
- Implementations: **Easypaisa / JazzCash / Raast QR / NayaPay / cards** (PayFast یا Safepay aggregator سے: sandbox → live)
- Checkout پر prepayment discount rule ("Raast/Easypaisa سے ادائیگی پر بچت") — RTO کم کرنے کے لیے

## 4.3 Courier Adapter Layer
- Interface: `CourierProvider { createAwb, track, cancel, settlementImport }`
- Implementations: **TCS / Leopards / PostEx / Trax / CallCourier**
- Admin میں: 1-click AWB booking, label printing, tracking webhooks, courier performance report

## 4.4 Urdu / Roman Urdu
- Storefront اردو RTL (Noto Nastaliq font)، UR/EN toggle
- Roman Urdu fuzzy search (kurta/koorta/kurti — spelling variants match)
- Admin interface کی ترجمانی (UR/EN)

## 4.5 WhatsApp Commerce
- WhatsApp Business Cloud API (آپ سے token)
- Templates: order confirm / dispatch / out-for-delivery / delivered
- Abandoned cart recovery (30 منٹ بعد)
- Click-to-WhatsApp order capture

✅ **قبول کا معیار:** کسٹمر موبائل سے COD پر آرڈر کرے؛ merchant ایک کلک میں AWB بنائے؛ پیسوں کا حساب self-reconcile ہو

---

# PHASE 5 — Compliance & Scale (مستقل جاری)

- **FBR Digital Invoicing** (S.R.O. 709): IRN generation + invoice QR (آپ سے intermediary registration)
- Provincial taxes (PRA/SRB/KPRA) module
- Multi-location inventory (Phase 1 schema پر UI + APIs)
- Theme engine v2 (drag-drop sections editor — Shopify online store editor جیسا)
- Storefront GraphQL API + headless starter kit
- App/Plugin ecosystem کی بنیاد (OAuth apps)
- React Native merchant app (اختیاری)
- NADRA e-KYC onboarding (اختیاری — unbanked merchants کے لیے)

---

## 📋 ہر Phase میں آپ سے کیا چاہیے ہوگا

| Phase | آپ کی طرف سے |
|---|---|
| 0 | کچھ نہیں — میں خود کر لوں گا |
| 1–3 | کچھ نہیں (شاید design feedback) |
| 4.1 | SMS gateway account/credentials |
| 4.2 | PayFast/Safepay + Easypaisa/JazzCash merchant onboarding (پہلے sandbox) |
| 4.3 | Courier company accounts (TCS/PostEx/Leopards میں سے کوئی ایک بھی کافی) |
| 4.5 | Meta developer app + WhatsApp Business API verification |
| 5 | FBR intermediary registration |

> 💡 **نوٹ:** Phase 4 میں ہر integration پہلے **sandbox/mock mode** میں بنے گا۔ آپ کے credentials آتے ہی ایک config switch سے live۔ کوئی کام رک نہیں گا۔

---

## ⚠️ Rules (خطرات پہلے سے دکھے گئے)

| خطرہ | حل |
|---|---|
| Scope creep (سب ایک ساتھ) | سخت phase discipline — ایک phase مکمل، پھر اگلا |
| "Shopify exact" کا وسیع مطلب | اوپر کی list = حتمی scope؛ باہر کا feature پہلے پوچھ کر |
| Couriers/payments کے accounts دیر سے ملیں | mock mode سے کام نہیں رکے گا |
| کوڈ خطرے میں | Phase 0 میں فوری Git setup |
| Cloud لاگت | اب Neon free + Render/Vercel free tier؛ scale کا فیصلہ بعد میں |

---

## 🗓️ پہلا اسبوع (Phase 0) — مثال کے طور پر

1. JWT فکس + سب endpoints ٹیسٹ
2. `git init` + پہلا commit
3. Prisma schema پر Shopify-parity models کا design (Phase 1 کا blueprint)
4. Staging deploy (Render + Vercel free)

**کل اندازہ:** Phase 0 → 4 = تقریباً **18 ہفتے**؛ اس کے بعد Phase 5 جاری۔ موجودہ کوڈ re-use ہوگا — کچھ ضائع نہیں ہوگا۔

---

*یہ plan زندہ دستاویز ہے — آپ کے فیصلوں کے ساتھ بدل سکتا ہے۔ شروع کرنے سے پہلے آپ کی اجازت چاہیے۔*
