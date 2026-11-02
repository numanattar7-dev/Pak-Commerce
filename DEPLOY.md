# Staging Deploy Guide — Pak Commerce

Three deployables: **API (Render)** · **Storefront (Vercel)** · **Admin (Vercel)**.
Database already lives on **Neon** (no Render Postgres needed).

---

## 1. API — Render (render.yaml included)

1. Push this repo to GitHub (repo currently has **no remote**):
   ```
   git remote add origin https://github.com/<you>/pak-commerce.git
   git push -u origin main
   ```
2. Render Dashboard → **New → Blueprint** → select the repo. `render.yaml` pre-fills:
   - Node service `pak-commerce-api` (Singapore region, free plan)
   - Build: install → prisma generate → **prisma db push** (schema sync) → nest build
   - Start: `node apps/api-backend/dist/main.js`
   - `JWT_SECRET` auto-generated
3. Fill the `sync: false` env vars when prompted:
   | Key | Value |
   |---|---|
   | `DATABASE_URL` | Neon **pooled** connection string (from Neon dashboard → Connection Details → "Pooled connection") |
   | `STOREFRONT_URL` | `https://<storefront-project>.vercel.app` (fill after step 2) |
   | `ADMIN_URL` | `https://<admin-project>.vercel.app` |
   | `CORS_ORIGINS` | leave empty (`*.vercel.app` + `*.pakcommerce.pk` + localhost are allowed by default) |
4. Deploy. Health check: `GET https://<api>.onrender.com/products/store/khaadi` → 200 JSON.
5. **Demo seed**: the staging API uses the same Neon database as local dev, so the demo
   tenant (`khaadi`), products, and admin login (`admin@khaadi.com` / `admin123`) already exist.
   > Optional isolation later: create a Neon **branch** in the Neon console and point
   > `DATABASE_URL` at the branch endpoint — instant copy-on-write staging data.

Notes:
- `prisma db push` (not `migrate deploy`) — this repo manages schema by push, there is no migrations folder.
- Uploads (`/uploads`) are served from the instance disk → **ephemeral on Render free tier**; images vanish on redeploy. Fine for staging.
- Free tier sleeps after 15 min idle → first request cold-starts (~30–60 s).

## 2. Storefront — Vercel (project A)

1. Vercel Dashboard → **Add New → Project** → import the GitHub repo.
2. **Root Directory**: `apps/storefront` · Framework: Next.js (auto-detected).
3. Environment variable (Production + Preview):
   | Key | Value |
   |---|---|
   | `NEXT_PUBLIC_API_BASE` | `https://<api>.onrender.com` |
4. Deploy → note the URL → go back and set the API's `STOREFRONT_URL` env var to it (needed for wallet payment redirect links + callback URLs).

## 3. Admin — Vercel (project B)

Same as storefront but:
- **Root Directory**: `apps/web-admin`
- `NEXT_PUBLIC_API_BASE` → same Render API URL

## 4. Post-deploy smoke

1. Storefront → browse products (API base now points at Render).
2. Place a COD order → OTP code appears in **Render logs** (`[COD OTP ...]`).
3. Place a JAZZCASH order → order page → **Pay now** → sandbox checkout → order flips PAID/VERIFIED.
4. Admin → login with `admin@khaadi.com` / `admin123` → Payments ledger shows the transaction.

## Security checklist before going live

- [ ] `JWT_SECRET` — Render-generated (never reuse the dev value).
- [ ] Change `admin@khaadi.com` password or create a real admin user.
- [ ] Neon: enable IP restrictions / use the pooled endpoint only for the API.
- [ ] Live gateway keys go in **Admin → Settings → Integrations** (per-tenant, write-only) — never env vars.
- [ ] `/uploads` is public — move to S3/Cloudinary before production.
