# Blog Image Uploads — Cloudflare R2 Setup

The blog editor lets authors upload cover images and inline images
straight from the toolbar. Uploads land in a Cloudflare R2 bucket
(S3-compatible, free egress) and the public URL is written into the
post HTML.

> **You can ship the blog without R2.** The editor still works — it
> falls back to a friendly "paste a URL instead" message and the
> rest of the editor functions normally. Set up R2 when you actually
> want one-click uploads.

## 1. Create the bucket (5 min)

1. Sign in at [https://dash.cloudflare.com](https://dash.cloudflare.com)
2. Sidebar → **R2 Object Storage** → **Create bucket**
3. Name: `hansmed-blog` (or anything — note it for step 4)
4. Location: **Asia-Pacific (APAC)** for best Singapore/Malaysia latency
5. **Create**

## 2. Generate API credentials (2 min)

1. R2 → **Manage R2 API tokens** (top-right)
2. **Create API token** →
   - Name: `hansmed-blog-uploads`
   - Permissions: **Object Read & Write**
   - Specify bucket: `hansmed-blog`
   - TTL: forever (or your policy)
3. **Create API token**
4. Copy these three values — they are shown **once**:
   - **Access Key ID**
   - **Secret Access Key**
   - **Account ID** (also visible at top-right of the dashboard)

## 3. Make the bucket public (3 min)

1. R2 → bucket → **Settings** → **Public access**
2. Either:
   - **Quick option:** enable the `r2.dev` public URL (good for testing — Cloudflare rate-limits it, not for production traffic)
   - **Production option:** **Connect domain** → e.g. `blog-cdn.hansmed.my`
     - Add the suggested CNAME record at your DNS provider
     - Wait ~2 min for SSL certificate to provision
3. Note the resulting public URL prefix — e.g. `https://blog-cdn.hansmed.my`

## 4. Set Railway env vars (2 min)

In the Railway project → **Variables** tab → add:

```
R2_ACCOUNT_ID=<your-cloudflare-account-id>
R2_ACCESS_KEY_ID=<from-step-2>
R2_SECRET_ACCESS_KEY=<from-step-2>
R2_BUCKET=hansmed-blog
R2_PUBLIC_URL=https://blog-cdn.hansmed.my
```

> Match `R2_PUBLIC_URL` exactly to the URL prefix from step 3 — no
> trailing slash. The controller appends `/blog/YYYY/MM/<uuid>.<ext>`
> to it.

Railway redeploys automatically when env vars change.

## 5. Confirm aws-sdk-php is installed

`composer.json` already pins `aws/aws-sdk-php ^3.300`. On the next
Railway build, `composer install` pulls it in. To verify locally:

```sh
cd backend && composer install
```

If you see `Class "Aws\S3\S3Client" not found` in Railway logs, the
deploy did not run `composer install` — trigger a redeploy.

## 6. Test the upload

1. Sign in to admin → **Blog · 部落格**
2. **+ New Post** → click the image button in the Quill toolbar
3. Pick a small JPG/PNG
4. The image should appear in the editor within 1–2 s
5. Check the URL — it should be e.g.
   `https://blog-cdn.hansmed.my/blog/2026/04/<uuid>.jpg`
6. Open that URL in a new tab to confirm it renders publicly

## Troubleshooting

| Error / symptom | Likely cause | Fix |
| --- | --- | --- |
| `503 Image upload is not configured` | Missing one or more `R2_*` env vars | Re-check Railway → Variables → all five values present |
| `403 Access denied` from R2 | Bucket name mismatch, or token bound to a different bucket | Re-issue the API token bound to the right bucket name |
| `Class "Aws\S3\S3Client" not found` | `aws/aws-sdk-php` not installed | `composer install` in the backend container — trigger a Railway redeploy |
| Image uploads OK but the public URL 404s | `R2_PUBLIC_URL` does not match the bucket's actual public URL prefix | Copy the URL from Cloudflare → R2 → bucket → Settings → Public access — paste with no trailing slash |
| Slow uploads from Malaysia | Bucket region is set to North America / Europe | Re-create bucket in **APAC** and migrate (R2 has no in-place region change) |

## Costs

Cloudflare R2 free tier covers most early-stage usage:

- **10 GB** storage
- **1M Class A** ops/month (writes — uploads count as ~1)
- **10M Class B** ops/month (reads — image views)
- **Zero egress fees** (this is R2's main selling point vs. S3)

Beyond free: **$0.015/GB-month** storage, **$4.50 per 1M Class A**
ops, **$0.36 per 1M Class B** ops. A typical blog with daily uploads
and modest traffic stays under $1/month.

## Security notes

- The upload endpoint is gated to `admin` and `doctor` roles only
  (enforced in `BlogImageController::upload`)
- Files are limited to 8 MB and to `jpeg/png/jpg/webp/gif` mimetypes
- Object keys use a UUID, not the original filename — prevents
  filename-collision attacks and avoids leaking user-supplied paths
- `Cache-Control: public, max-age=31536000, immutable` is set so
  Cloudflare caches uploads at the edge for a year (safe because the
  UUID makes each path effectively immutable)
