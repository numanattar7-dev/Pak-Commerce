# Pak Commerce — Build Plan v2

**Philosophy:** First build an *exact Shopify* core commerce engine → then add Pakistan-specific essentials on top of it.
**Date:** October 31, 2026
**Approach:** Build on the existing codebase (backend ~90%, admin ~35%, storefront ~60%).

---

## Roadmap (Bird's Eye View)

```
Phase 0: Stabilize                     (~1 week)  -> solid foundation
Phase 1: Shopify Core — Backend        (~4 weeks) -> Shopify-grade API engine
Phase 2: Shopify Core — Admin          (~4 weeks) -> Shopify-grade merchant dashboard
Phase 3: Shopify Core — Storefront     (~3 weeks) -> Shopify-grade customer store
Phase 4: Pakistan Essential Layer      (~6 weeks) -> COD, wallets, couriers, WhatsApp, notifications
Phase 5: Compliance & Scale            (ongoing)  -> FBR, multi-location, theme engine, apps
```

> Milestone (after Phase 3): a complete Shopify-grade platform — international-level core
> Milestone (after Phase 4): "Shopify of Pakistan" — i.e., a genuinely production-ready product

---

# PHASE 0 — Stabilize (first priority)

**Goal:** Make everything already built trustworthy. Mandatory before starting new features.

| Task | Detail | Owner |
|---|---|---|
| JWT 401 fix | `DATABASE_URL` reaches Prisma at runtime; JWT strategy validates without DB | done |
| Git setup | `git init`, first commit, `.env` ignored, branch rules (`main`/`dev`) | done |
| Code audit | Review existing backend files — inconsistencies, dead code, naming | done |
| DB cleanup | Neon branches (main/dev), seed review, index check | done (single Neon main branch) |
| Test foundation | Smoke tests for auth + products + orders (+ per-step E2E suites in `scripts/`) | done |
| Deploy dry-run | Staging deploy on Render (backend) + Vercel (frontend) — free tier | BLOCKED (needs user accounts) |

Acceptance: login/token works on every endpoint; code is committed to Git; staging environment is live.

---

# PHASE 1 — Shopify Core: Backend Parity (~4 weeks)

**Goal:** A commerce API as deep as Shopify — REST first (GraphQL in Phase 5).

## 1.1 Schema upgrade (Prisma) — new models — DONE
- `Customer` — profiles, tags, addresses, order history ✔
- `Discount` — codes, %/fixed/free-shipping, usage limits, date ranges ✔
- `Location` — multi-location-ready schema (1 default location for now) ✔
- `Fulfillment` / `Refund` — full order lifecycle ✔
- `Webhook` + `WebhookDelivery` — event engine foundation ✔ (+ Collections, FBR fields, CodVerification.expiresAt)

## 1.2 Products & Catalog — DONE (core)
- Variants (size/color style), images ✔ (upload to `/uploads` + static serving)
- Collections: manual ✔ (smart rules reserved via `rules` column)
- CSV bulk import/export ✔ (quote-aware parser, product/variant upsert, error capture)
- Product status: draft/active — `isActive` field exists ✔

## 1.3 Orders & checkout — DONE
- Server-verified checkout: server computes prices/totals from DB (client never sets them) ✔
- Subdomain-scoped public endpoints (no random-tenant fallback) ✔
- COD verification with OTP (5-min validity, attempts lock, resend) ✔
- Bank transfer proof upload model ✔
- Risk score ✔ · order number generation ✔

## 1.4 Discounts engine — DONE
- PERCENTAGE / FIXED / FREE_SHIPPING, min-order, first-order-only, max-uses with race-safe consume ✔
- Public validate endpoint + checkout apply ✔ (storefront discount box live)

## 1.5 Customers CRM — DONE
- Full CRUD + auto customer profile at checkout with ordersCount/totalSpent ✔

## 1.6 Fulfillments & Refunds — DONE
- 1-click + partial fulfillment, over-fulfillment guard, deliveredAt stamping ✔
- Full/partial refunds with restock control (default false), closed-order guard ✔
- Cancel/RTO always restores stock ✔

## 1.7 Webhooks engine — DONE
- DB-backed delivery queue + 10s retry worker (no Redis dependency) ✔
- Events: order.created / order.status_changed / order.fulfilled / order.shipped / order.refunded / webhook.test ✔
- HMAC-SHA256 signing (`X-Pak-Commerce-Signature`), 5 retries with backoff [30s, 2m, 10m, 30m, 2h], FAILED terminal state ✔
- Admin CRUD + deliveries log + test-send endpoint ✔

## 1.8 Analytics — DONE
- Summary (revenue excl. CANCELLED/RTO, AOV, COD share, status breakdown), daily revenue-series, top-products (product/variant join), status-breakdown ✔

# PHASE 4 (early slice) — Pakistan Essential Layer — SANDBOX DONE

| Feature | Status |
|---|---|
| COD OTP verification (English SMS + WhatsApp, Twilio SIMULATION when unconfigured) | done (mock) |
| OTP resend + expiry + attempts lock | done |
| Courier adapters (TCS / Leopards / PostEx / Trax) — rate card, booking, tracking timeline | done (mock, deterministic) |
| FBR POS invoice — sandbox issue (idempotent) + invoice list | done (mock) |
| English WhatsApp/SMS order-status templates | done |
| Real courier APIs / real Twilio credentials / FBR production API | pending (user credentials) |
| Raast / JazzCash / EasyPaisa live payment gateways | pending (Phase 4 full) |

---

# PHASE 2 — Shopify Core: Admin (~4 weeks) — NEXT

- Home: analytics widgets (endpoints ready)
- Orders: list, detail, fulfill, refund, book shipment, FBR invoice, resend OTP
- Products: list, create with variants + images (upload endpoint ready), CSV import/export, collections editor
- Discounts editor + usage stats
- Customers list/detail
- Webhooks manager (endpoints ready)
- Settings: tenant profile, shipping rules by city

# PHASE 3 — Shopify Core: Storefront (~3 weeks) — partially started

- Home + catalog (done in prototype form), product detail page, cart, checkout (with discount box — done), order status page + public tracking (`GET /orders/track/:orderNumber/:phone` ready)
- Multi-page Next.js routes instead of single-page prototype
- Tenant theming (logo/banner colors from Tenant fields)

# PHASE 4 — Pakistan Essential Layer (full)

- Live integrations: courier APIs (TCS/Leopards/PostEx/Trax), Twilio/WhatsApp Business (or local gateways e.g. Jazz Business SMS), Raast/JazzCash/EasyPaisa gateways
- FBR production POS integration
- UDNP/COD risk scoring expansions, settlements report

# PHASE 5 — Compliance & Scale

- GraphQL API, multi-location fulfillment, theme engine, app/store extensions, usage billing per tenant
